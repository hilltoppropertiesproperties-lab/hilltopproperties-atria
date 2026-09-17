"""Check the combined static root and Firebase Hosting emulator; never deploy."""
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
from urllib.request import urlopen
from urllib.error import HTTPError
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.codex-artifacts' / 'construction-deployment'
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {'assets': [], 'routes': [], 'views': [], 'optional_missing': []}

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img', 'source', 'video'):
            self.urls.extend(attrs[key] for key in ('src', 'poster') if attrs.get(key))
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.urls.append(attrs['href'])

def get(url):
    try:
        with urlopen(url, timeout=20) as response:
            return response.status, response.url, response.headers.get_content_type(), response.read()
    except HTTPError as error:
        return error.code, url, error.headers.get_content_type(), b''

def asset(url, seen):
    path = unquote(urlparse(url).path)
    if path in seen or not path.startswith('/construction/'):
        return
    seen.add(path)
    file = ROOT / path.lstrip('/')
    assert file.is_file(), path
    current = ROOT
    for part in file.relative_to(ROOT).parts:
        assert part in [item.name for item in current.iterdir()], ('case mismatch', path)
        current /= part
    status, final, mime, content = get(url)
    assert status == 200 and mime != 'text/html', (url, status, mime)
    assert content == file.read_bytes(), ('wrong file', url)
    REPORT['assets'].append({'path': path, 'status': status, 'mime': mime})
    if file.suffix in ('.css', '.js'):
        text = content.decode('utf-8')
        if file.suffix == '.css':
            refs = re.findall(r'url\([\s\"\']*([^\)\"\']+)', text)
        else:
            refs = re.findall(r'(?:from\s*|import\s*\()[\"\']([^\"\']+)', text)
            refs += re.findall(r'[\"\'](/construction/assets/[^\"\']+)', text)
        for ref in refs:
            if ref == '../supabase-env.js' and not (file.parent / ref).exists():
                REPORT['optional_missing'].append('/construction/supabase-env.js (existing caught optional import)')
                continue
            asset(urljoin(final, ref), seen)

for base in ('http://127.0.0.1:8765', 'http://127.0.0.1:5000'):
    for route in ('/', '/construction/', '/construction/admin/'):
        status, final, mime, content = get(base + route)
        assert status == 200 and mime == 'text/html', (route, status)
        REPORT['routes'].append({'url': base + route, 'final': final, 'status': status})
        if route.startswith('/construction'):
            parser = Assets()
            parser.feed(content.decode('utf-8'))
            seen = set()
            for ref in parser.urls:
                asset(urljoin(final, ref), seen)

for route in ('/listings', '/properties', '/property-details', '/sales/', '/rent/',
              '/property%20replica/sales/listings', '/property%20replica/rent/listings'):
    status, final, mime, _ = get('http://127.0.0.1:5000' + route)
    REPORT['routes'].append({'url': route, 'final': final, 'status': status})

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width in (1440, 390):
        samples = []
        for port in (8765, 5000):
            page = browser.new_page(viewport={'width': width, 'height': 900})
            errors, failures = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failures.append(response.url) if response.status >= 400 and '/construction/' in response.url else None)
            # Isolate the existing local design from changing CMS content/network.
            page.route('https://**/*', lambda route: route.abort())
            page.goto(f'http://127.0.0.1:{port}/construction/', wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            state = page.evaluate('''() => ({
                header: getComputedStyle(document.querySelector('.site-header')).position,
                font: getComputedStyle(document.body).fontFamily,
                fonts: Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family).sort(),
                overflow: document.documentElement.scrollWidth > innerWidth,
                hero: Array.from(document.querySelectorAll('*')).map(e => getComputedStyle(e).backgroundImage).find(v => v.includes('hero-construction.jpg'))?.replace(location.origin, ''),
                brokenImages: Array.from(document.images).filter(i => i.src.startsWith(location.origin) && i.loading !== 'lazy' && (!i.complete || !i.naturalWidth)).map(i=>i.src)
            })''')
            assert not errors and not state['overflow'] and not state['brokenImages'], (width, port, errors, state)
            assert not [url for url in failures if not url.endswith('/supabase-env.js')], failures
            if width == 390:
                page.locator('#navToggle').click()
                assert page.locator('#navToggle').get_attribute('aria-expanded') == 'true'
                assert page.locator('#mainNav').is_visible()
                page.locator('#navToggle').click()
            page.screenshot(path=str(OUT / f'construction-{port}-{width}.png'), full_page=True)
            page.screenshot(path=str(OUT / f'construction-{port}-{width}-hero.png'))
            REPORT['views'].append({'port': port, 'width': width, 'state': state, 'errors': errors, 'failures': failures})
            samples.append(state)
            page.close()
        assert samples[0] == samples[1], ('static/emulator design differs', samples)
    for route in ('/', '/construction/'):
        for width in (1440, 390):
            page = browser.new_page(viewport={'width': width, 'height': 900})
            errors, failures = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failures.append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            page.goto('http://127.0.0.1:5000' + route, wait_until='load', timeout=60000)
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(2500)
            overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
            assert not errors and not overflow, (route, width, errors, overflow)
            if route == '/':
                assert page.locator('link[href*="website.css"]').count() > 0
                if width == 390:
                    page.locator('#navToggle').click()
                    assert page.locator('#navToggle').get_attribute('aria-expanded') == 'true'
                    page.locator('#navToggle').click()
            else:
                assert page.locator('[data-hero-heading]').inner_text().strip()
            label = 'real-estate' if route == '/' else 'construction'
            page.screenshot(path=str(OUT / f'{label}-live-{width}.png'))
            REPORT['views'].append({'route': route, 'width': width, 'external_content': True, 'overflow': overflow, 'errors': errors, 'failures': failures})
            page.close()
    browser.close()

(OUT / 'report.json').write_text(json.dumps(REPORT, indent=2), encoding='utf-8')
print(json.dumps(REPORT, indent=2))
