"""Check sidebar sticky boundaries, responsive placement and existing actions."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification/sidebar-actions'
before = json.loads((OUT / 'before.json').read_text())
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8091/listings.html')
    page.reload()
    page.evaluate('document.fonts.ready')
    assert page.locator('#listingsGrid').inner_html() == before['cards']
    assert page.locator('#listingPagination').evaluate('(e)=>e.outerHTML') == before['pagination']
    assert page.locator('.private-link,.listings-lower-alert').count() == 0
    for width in [1440,1280,1024,768,430,390,320]:
        for height in ([700,950,1100,600] if width > 900 else [850]):
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('scrollTo(0,0)')
            page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            def metrics():
                return page.evaluate('''() => {
                    const rect=s=>document.querySelector(s).getBoundingClientRect();
                    const f=rect('.filter-sidebar'), a=rect('.sidebar-actions'), b=rect('.filter-scroll-boundary');
                    return {top:f.top,bottom:f.bottom,actionTop:a.top,actionDocumentTop:a.top+scrollY,
                        boundaryBottom:b.bottom+scrollY,filterHeight:f.height,scroll:scrollY,
                        position:getComputedStyle(document.querySelector('.filter-sidebar')).position,
                        overflow:document.documentElement.scrollWidth>innerWidth,
                        sidebarWidth:f.width,actionsWidth:a.width};
                }''')
            start=metrics()
            assert not start['overflow'] and start['sidebarWidth']==start['actionsWidth'], start
            assert start['actionTop']-start['bottom']>=31.9, start
            if width>900 and height>650:
                stop=start['boundaryBottom']-start['filterHeight']-18
                for scroll in [200,stop-1,stop,stop+1,stop+100,200,0]:
                    page.evaluate('(y)=>scrollTo(0,y)',scroll)
                    m=metrics()
                    assert abs(m['actionDocumentTop']-start['actionDocumentTop'])<1, m
                    assert m['actionTop']-m['bottom']>=31.9, m
                    expected=min(max(start['top']-m['scroll'],18),start['boundaryBottom']-m['scroll']-start['filterHeight'])
                    assert abs(m['top']-expected)<1, (m,expected)
                if width==1440 and height==950:
                    page.evaluate('(y)=>scrollTo(0,y)',stop)
                    page.screenshot(path=str(OUT/'desktop-boundary.png'))
            else:
                assert start['position']=='static', start
                page.evaluate('scrollTo(0,200)')
                m=metrics()
                assert abs(m['top']+m['scroll']-start['top'])<1, m
            results.append({'width':width,'height':height,'passed':True})
        page.evaluate('scrollTo(0,0)')
        if width in [1440,1024,390]:
            page.screenshot(path=str(OUT/f'top-{width}.png'))
        for label, message in [('List Property','List privately'),('Get Email Alerts','Property alerts')]:
            page.get_by_role('button',name=label,exact=True).click()
            expect(page.locator('#previewToast')).to_contain_text(message+' is not connected')
        assert page.locator('#listingsGrid').inner_html()==before['cards']
    # Mobile controls stay in normal flow and retain their search handlers.
    page.set_viewport_size({'width':390,'height':850})
    page.locator('#mobileFiltersButton').click()
    expect(page.locator('#listingLocationInput')).to_be_focused()
    page.locator('#moreFiltersButton').click()
    expect(page.locator('#advancedFilters')).to_be_visible()
    page.locator('#moreFiltersButton').click()
    page.locator('#priceSummary').click()
    expect(page.locator('#maxPriceInput')).to_be_visible()
    page.locator('#maxPriceInput').fill('1000000')
    page.locator('.search-button').click()
    expect(page.locator('#listingsCount')).to_have_text('1 - 1 of 1 sample property')
    page.locator('#priceSummary').click()
    page.locator('#maxPriceInput').fill('')
    page.locator('#listingLocationInput').fill('No matching location')
    page.locator('.search-button').click()
    expect(page.locator('#listingPagination')).to_be_hidden()
    page.locator('#listingLocationInput').fill('')
    page.locator('[data-listing-purpose="For Rent"]').click()
    page.locator('.search-button').click()
    expect(page.locator('#listingPageTitle')).to_have_text('Properties to Rent')
    page.locator('[data-listing-purpose="For Sale"]').click()
    page.locator('.search-button').click()
    page.set_viewport_size({'width':1440,'height':950})
    page.locator('#moreFiltersButton').click()
    expect(page.locator('#listingFiltersDialog')).to_be_visible()
    page.locator('#closeFilters').click()
    page.locator('#listingSortSelect').select_option('price-low')
    expect(page.locator('.property-price').first).to_have_text('K980,000')
    assert not errors, errors
    browser.close()
(OUT/'results.json').write_text(json.dumps({'viewports':results,'errors':errors,'actions_and_filters':'passed'},indent=2))
print(f'Passed {len(results)} viewport checks, sticky boundaries, action handlers, mobile/desktop filters and sorting.')
