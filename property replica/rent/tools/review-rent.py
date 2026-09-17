"""Current rental-route regression checks. Run: python tools/review-rent.py.
Starts its own server at the site parent so sibling Sales links resolve.
"""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification' / 'rent'
OUT.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT.parent)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
url = base + '/rent/listings.html'
errors, backend = [], []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width':1440,'height':950})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: backend.append(r.url) if 'supabase.co' in r.url else None)
        def rental_state(count=2):
            expect(page.locator('.property-card')).to_have_count(count)
            expect(page.locator('#listingPageTitle')).to_have_text('Properties to Rent')
            expect(page.locator('#listingPurposeFilter')).to_have_value('For Rent')
            expect(page.locator('[data-listing-purpose="For Rent"]')).to_have_attribute('aria-pressed', 'true')
            assert all(x == 'For Rent' for x in page.locator('.purpose-badge').all_text_contents())
            assert page.locator('#listingsCount').inner_text() == page.locator('#listingBottomCount').inner_text()
            expect(page.locator('#averagePriceTitle')).to_contain_text('for rent')
        for query in ['', '?purpose=For%20Sale', '?purpose=sale', '?purpose=For%20Rent', '?category=all']:
            page.goto(url + query, wait_until='domcontentloaded')
            rental_state()
        expect(page.locator('#quickFilterOptions button')).to_have_text(['Levy Junction', 'Cairo Road'])
        expect(page.locator('.property-price')).to_have_text(['K8,500 / month', 'K22,000 / month'])
        # Defensive filtering even if mixed inventory is accidentally bundled later.
        def mixed_data(route):
            data = (ROOT / 'listings-preview-data.js').read_text(encoding='utf-8')
            route.fulfill(body=data + "\nwindow.propertyPreviewData.properties.push({id:'sale-test',purpose:'For Sale',title:'Sale sentinel',area:'Sale only',price:1});\nwindow.propertyPreviewData.properties[0].billing_period='week';", content_type='application/javascript')
        page.route('**/listings-preview-data.js*', mixed_data)
        page.reload(wait_until="domcontentloaded")
        rental_state()
        expect(page.locator('.property-price').first).to_have_text('K8,500 / week')
        expect(page.locator('#quickFilterOptions button')).to_have_count(2)
        page.unroute('**/listings-preview-data.js*')
        page.reload(wait_until="domcontentloaded")
        for width in [1440,1024,901,900,768,390,360]:
            page.set_viewport_size({'width':width,'height':950})
            page.reload(wait_until="domcontentloaded")
            page.evaluate('document.fonts.ready')
            rental_state()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.get_by_role('button', name='Levy Junction', exact=True).click()
            rental_state(1)
            page.locator('#listingLocationInput').fill('Missing location')
            page.locator('.search-button').click()
            rental_state(0)
            expect(page.locator('#listingPagination')).to_be_hidden()
            page.locator('#moreFiltersButton').click()
            page.locator('#resetFilters').click()
            page.keyboard.press('Escape')
            rental_state()
            if width in [1440,390]:
                page.screenshot(path=str(OUT / f'rent-{width}.png'), full_page=True)
        page.set_viewport_size({'width':1440,'height':950})
        page.reload(wait_until="domcontentloaded")
        page.locator('#listingTypeFilterTrigger').click()
        page.get_by_role('radio', name='Flats & Apartments', exact=True).click()
        page.locator('.search-button').click()
        rental_state(1)
        page.reload(wait_until="domcontentloaded")
        page.locator('#priceSummary').click()
        page.locator('#maxPriceInput').fill('10000')
        page.locator('#priceDone').click()
        page.locator('.search-button').click()
        rental_state(1)
        page.reload(wait_until="domcontentloaded")
        page.locator('#listingSortSelect').select_option('price-high')
        expect(page.locator('.property-price').first).to_have_text('K22,000 / month')
        page.locator('.save-property').first.click()
        expect(page.locator('.save-property').first).to_have_attribute('aria-pressed','true')
        for selector in ['[data-listing-purpose="For Sale"]', '#siteNav [data-listings-route="../sales/listings.html"]', '.listings-footer a[href="../sales/listings.html"]']:
            page.goto(url, wait_until="domcontentloaded")
            page.locator(selector).click()
            page.wait_for_url(base + '/sales/listings.html')
            expect(page.locator('#listingPageTitle')).to_have_text('Properties for Sale')
        page.goto(url, wait_until="domcontentloaded")
        page.locator('#siteNav [aria-current="page"]').click()
        rental_state()
        link = page.locator('.property-title a').first.get_attribute('href')
        assert '0002' in link
        assert not errors, errors
        assert not backend, backend
        browser.close()
    report = {'status':'passed','viewports':[1440,1024,901,900,768,390,360], 'checks':['rental-only default and conflicting URLs','mixed dataset defense','billing periods','rental locations','empty state and reset','type and price filters','sorting and save','Sales navigation','Rent self navigation','detail URL'], 'runtimeErrors':errors,'backendRequests':backend}
    (OUT / 'results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
finally:
    server.shutdown()
