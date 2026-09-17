# Historical design-stage QA; use python tools/review-rent.py for the current rental route.
"""Exercise the redesigned sidebar against the existing bundled preview."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'verification'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':950})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8085/listings.html', wait_until='networkidle')
    expect(page.locator('#filterMatchingCount')).to_have_text('3 matching properties')
    page.screenshot(path=str(out / 'sidebar-desktop.png'), full_page=True)
    dimensions = []
    for width, height in [(1440,950),(1024,768),(901,600),(900,800),(768,900),(390,844),(360,740)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        if width <= 900:
            page.locator('#mobileFiltersButton').click()
            expect(page.locator('#listingSearchForm')).to_be_visible()
            expect(page.locator('[data-listing-purpose="For Sale"]')).to_be_visible()
            assert page.locator('#listingFiltersDialog').evaluate('(e) => e.scrollWidth <= e.clientWidth')
            page.locator('#moreFiltersButton').click()
            expect(page.locator('#bedroomsFilter')).to_be_visible()
            page.locator('#moreFiltersButton').click()
            page.locator('#priceSummary').click()
            expect(page.locator('#maxPriceInput')).to_be_visible()
            page.locator('#maxPriceInput').fill('5000000')
            page.locator('#priceSummary').click()
            if width == 390:
                page.screenshot(path=str(out / 'sidebar-mobile.png'))
            page.locator('.search-button').click()
            expect(page.locator('#listingFiltersDialog')).not_to_be_visible()
        else:
            heights = page.locator('.search-rail .discovery-control:visible').evaluate_all('(es)=>es.map(e=>e.getBoundingClientRect().height)')
            assert all(h == 48 for h in heights), heights
        dimensions.append({'width':width,'height':height,'noOverflow':True})

    page.set_viewport_size({'width':1440,'height':950})
    def reset():
        page.locator('#moreFiltersButton').click()
        page.locator('#resetFilters').click()
        page.keyboard.press('Escape')
    reset()
    page.locator('[data-listing-purpose="For Rent"]').click()
    expect(page.locator('[data-listing-purpose="For Rent"]')).to_have_attribute('aria-pressed','true')
    page.locator('.search-button').click()
    expect(page.locator('#filterMatchingCount')).to_have_text('2 matching properties')
    expect(page.locator('#listingPageTitle')).to_have_text('Properties to Rent')
    reset()
    location = page.locator('#quickFilterOptions button').first.inner_text()
    page.locator('#listingLocationInput').fill(location)
    page.locator('.search-button').click()
    assert page.locator('.property-card').count() > 0
    assert page.locator('#filterPropertyCount').inner_text().startswith(str(page.locator('.property-card').count()))
    reset()
    page.locator('#listingTypeFilterTrigger').click()
    page.get_by_role('radio',name='Houses',exact=True).click()
    page.locator('.search-button').click()
    expect(page.locator('#filterMatchingCount')).to_have_text('1 matching property')
    page.locator('#priceSummary').click()
    page.locator('#minPriceInput').fill('1')
    page.locator('#maxPriceInput').fill('2')
    page.locator('#priceDone').click()
    expect(page.locator('#priceValue')).to_have_text('2 (min. 1)')
    page.locator('.search-button').click()
    expect(page.locator('#filterMatchingCount')).to_have_text('0 matching properties')
    reset()
    page.locator('#moreFiltersButton').click()
    page.locator('#bedroomsFilter').select_option('5')
    page.locator('#applyFilters').click()
    expect(page.locator('#filterMatchingCount')).to_have_text('0 matching properties')
    reset()
    page.locator('#moreFiltersButton').click()
    page.locator('input[name="feature"][value="Pool"]').check()
    page.locator('#applyFilters').click()
    assert page.locator('.property-card').count() < 3
    reset()
    page.locator('#listingTypeFilterTrigger').click()
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    expect(page.locator('#listingTypeFilter')).to_have_value('House')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#mobileFiltersButton').click()
    expect(page.locator('#listingTypeFilter')).to_have_value('House')
    page.locator('#listingTypeFilter').select_option('Land')
    page.locator('#listingLocationInput').fill('')
    page.locator('.search-button').click()
    expect(page.locator('#filterMatchingCount')).to_have_text('2 matching properties')
    page.set_viewport_size({'width':1440,'height':950})
    expect(page.locator('#listingTypeFilterTrigger')).to_contain_text('Stands & Residential Land')
    reset()
    page.locator('#listingSortSelect').select_option('price-high')
    expect(page.locator('#filterMatchingCount')).to_have_text('3 matching properties')
    page.locator('#quickFilterOptions button').first.click()
    expect(page.locator('#listingLocationInput')).to_have_value(location)
    reset()
    page.evaluate('window.scrollTo(0, 300)')
    assert page.locator('.filter-sidebar').bounding_box()['y'] >= 18
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=str(out / 'sidebar-desktop.png'), full_page=True)
    assert not errors, errors
    # Compare untouched results markup and styles with the pre-edit snapshot.
    before = out / 'filter-before'
    assert (root/'listings.css').read_bytes() == (before/'listings.css').read_bytes()
    current = (root/'listings.html').read_text(encoding='utf-8')
    original = (before/'listings.html').read_text(encoding='utf-8')
    section = lambda s: s[s.index('<div class="listings-content">'):s.index('<dialog class="filter-dialog"')]
    assert section(current) == section(original)
    result = {'viewports': dimensions, 'runtimeErrors':errors,
              'checked':['sale/rent','location','type and keyboard','price range','advanced bedrooms/features','search','counts 0/1/3','clear filters','responsive value preservation','mobile drawer','sorting','quick filters','sticky sidebar','unchanged results markup and CSS'],
              'limitations':'Existing bundled-data preview has no URL filter restoration or Supabase integration.'}
    (out/'sidebar-review.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
