# Historical design-stage QA; use python tools/review-rent.py for the current rental route.
"""Visual regression review against the saved pre-change listing page."""
from pathlib import Path
import hashlib
import json
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification' / 'lower-page'
baseline = json.loads((OUT / 'before-cards.json').read_text())
hashes = json.loads((OUT / 'before-hashes.json').read_text())
results = {'viewports': [], 'errors': [], 'backend_requests': []}

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 950})
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.on('request', lambda request: results['backend_requests'].append(request.url)
            if 'supabase' in request.url else None)
    page.goto('http://127.0.0.1:8091/listings.html')
    page.evaluate('document.fonts.ready')
    for width in [1920, 1440, 1280, 1024, 900, 768, 600, 390, 360, 320]:
        page.set_viewport_size({'width': width, 'height': 950})
        page.evaluate('window.scrollTo(0, 0)')
        page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        if str(width) in baseline:
            cards = page.locator('#listingsGrid').evaluate('''e=>({html:e.innerHTML,
                box:e.getBoundingClientRect().toJSON(),cards:[...e.children].map(c=>({
                box:c.getBoundingClientRect().toJSON(),font:getComputedStyle(c).font}))})''')
            assert cards == baseline[str(width)], f'Property cards changed at {width}'
        metrics = page.evaluate('''()=>{
            const rect=s=>document.querySelector(s).getBoundingClientRect();
            const style=s=>getComputedStyle(document.querySelector(s));
            return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
                lowerWidth:rect('.listings-lower').width,
                aligned:rect('.listings-lower').left===rect('#listingsGrid').left,
                footerWidth:rect('.listings-footer').width,
                footerColumns:style('.listings-footer-grid').gridTemplateColumns.split(' ').length,
                alertDirection:style('.listings-lower-alert').flexDirection,
                paginationHeight:rect('.listings-lower-current').height,
                tableInViewport:rect('.listings-lower-table-wrap').right<=innerWidth,
                descriptionsTruncate:style('.listings-lower-articles article p').textOverflow==='ellipsis'};
        }''')
        assert not metrics['overflow'], metrics
        assert metrics['aligned'] and metrics['lowerWidth'] <= 880, metrics
        assert metrics['footerWidth'] == width, metrics
        assert metrics['tableInViewport'] and metrics['descriptionsTruncate'], metrics
        assert metrics['paginationHeight'] == 32, metrics
        assert metrics['footerColumns'] == (4 if width > 1100 else 2 if width > 360 else 1), metrics
        assert metrics['alertDirection'] == ('column' if width <= 600 else 'row'), metrics
        results['viewports'].append(metrics)
        if width in [1440, 768, 390]:
            bounds = page.locator('.listings-lower').bounding_box()
            y = bounds['y'] - 12
            height = page.evaluate('document.documentElement.scrollHeight') - y
            page.screenshot(path=str(OUT / f'lower-page-{width}.png'), full_page=True,
                            clip={'x': 0, 'y': y, 'width': width, 'height': height})

    page.set_viewport_size({'width': 1440, 'height': 950})
    expect(page.locator('#listingBottomCount')).to_have_text(page.locator('#listingsCount').inner_text())
    expect(page.get_by_role('button', name='Previous page', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Next page', exact=True)).to_be_disabled()
    page.locator('#listingLocationInput').fill('No matching location')
    page.locator('#listingSearchForm').get_by_role('button', name='Search Properties', exact=True).click()
    expect(page.locator('#listingBottomCount')).to_have_text('0 sample properties')
    expect(page.locator('#listingPagination')).to_be_hidden()
    expect(page.get_by_role('heading', name='No properties found')).to_be_visible()
    page.locator('#listingLocationInput').fill('')
    page.locator('[data-listing-purpose="For Rent"]').click()
    page.locator('#listingSearchForm').get_by_role('button', name='Search Properties', exact=True).click()
    expect(page.locator('#listingPageTitle')).to_have_text('Properties to Rent')
    expect(page.locator('#averagePriceTitle')).to_contain_text('for rent in Zambia')
    expect(page.locator('#listingBottomCount')).to_have_text(page.locator('#listingsCount').inner_text())
    page.locator('[data-listing-purpose="For Sale"]').click()
    page.locator('#listingSearchForm').get_by_role('button', name='Search Properties', exact=True).click()
    expect(page.locator('#listingBottomCount')).to_have_text('1 - 3 of 3 sample properties')
    page.locator('#listingSortSelect').select_option('price-low')
    before_alert = page.locator('#listingsGrid').inner_html()
    page.get_by_role('button', name='Get email alerts', exact=True).click()
    expect(page.locator('#previewToast')).to_contain_text('Property alerts is not connected')
    assert before_alert == page.locator('#listingsGrid').inner_html()
    page.locator('.listings-footer').get_by_role('button', name='Request a property', exact=True).click()
    expect(page.locator('#requestDialog')).to_be_visible()
    page.get_by_role('button', name='Close request', exact=True).click()
    expect(page.locator('#requestDialog')).not_to_be_visible()
    # Newly added real links must resolve to existing files/anchors.
    for href in page.locator('.listings-footer a').evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))'):
        file, _, anchor = href.partition('#')
        target = ROOT / (file or 'listings.html')
        assert target.is_file(), href
        assert not anchor or f'id="{anchor}"' in target.read_text(encoding='utf-8'), href
    browser.close()

results['changed_source_files'] = [name for name, digest in hashes.items()
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest]
assert set(results['changed_source_files']) == {'listings.html', 'listings.css', 'listings-ui.js'}
assert not results['errors'] and not results['backend_requests'], results
results['property_cards_unchanged'] = True
results['count_empty_rent_sort_alert_request_checks'] = 'passed'
(OUT / 'review-results.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
