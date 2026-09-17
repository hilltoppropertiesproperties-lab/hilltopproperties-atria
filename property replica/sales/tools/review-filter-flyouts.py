"""Verify sidebar flyout placement, selection, keyboard use and responsive transitions."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).resolve().parents[1] / 'verification'
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1468, 'height': 950})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8085/listings.html', wait_until='networkidle')
    checks = []
    controls = [
        ('#listingPurposeFilterTrigger', '#listingPurposeFilterPanel'),
        ('#listingTypeFilterTrigger', '#listingTypeFilterPanel'),
        ('#priceSummary', '#pricePanel'),
        ('#moreFiltersButton', '#listingFiltersDialog'),
    ]
    for width, height in [(1468, 950), (1024, 768), (901, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        for trigger, panel in controls:
            page.locator(trigger).click()
            box = page.locator(panel).bounding_box()
            rail = page.locator('.filter-sidebar').bounding_box()
            assert box['x'] > rail['x'] + rail['width'], (width, panel, box)
            assert abs(box['y'] - rail['y']) < 2, (width, panel, box, rail)
            assert box['x'] + box['width'] <= width, (width, panel, box)
            assert box['y'] + box['height'] <= height, (width, panel, box)
            assert page.locator(trigger).get_attribute('aria-expanded') == 'true'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            if width == 1468:
                page.screenshot(path=str(OUT / (panel[1:] + '-desktop.png')))
            page.keyboard.press('Escape')
            assert not page.locator(panel).is_visible()
            assert page.locator(trigger).evaluate('(el) => el === document.activeElement')
        checks.append({'width': width, 'height': height, 'allPanelsFitToRight': True})

    page.set_viewport_size({'width': 1468, 'height': 950})
    page.locator('#listingPurposeFilterTrigger').click()
    page.get_by_role('radio', name='To Rent', exact=True).click()
    assert page.locator('#listingPurposeFilter').input_value() == 'For Rent'
    assert page.locator('#listingPurposeFilterTrigger').inner_text() == 'To Rent'
    page.locator('.search-button').click()
    assert page.locator('#listingPageTitle').inner_text() == 'Properties to Rent'
    page.locator('#listingTypeFilterTrigger').click()
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    assert page.locator('#listingTypeFilter').input_value() == 'House'
    assert not page.locator('#listingTypeFilterPanel').is_visible()

    page.locator('#listingPurposeFilterTrigger').click()
    page.locator('#priceSummary').click()
    assert not page.locator('#listingPurposeFilterPanel').is_visible()
    assert page.locator('#pricePanel').is_visible()
    page.locator('#minPriceInput').fill('100000')
    page.locator('#priceDone').click()
    assert page.locator('#minPriceInput').input_value() == '100000'
    page.locator('#moreFiltersButton').click()
    page.locator('#resetFilters').click()
    assert page.locator('#listingPurposeFilterTrigger').inner_text() == 'For Sale'
    assert page.locator('#listingTypeFilterTrigger').inner_text() == 'Type'
    assert page.locator('#minPriceInput').input_value() == ''
    page.locator('#listingPageTitle').click()
    assert not page.locator('#listingFiltersDialog').is_visible()
    page.locator('#moreFiltersButton').click()
    page.locator('#applyFilters').click()
    assert page.locator('.property-card').count() == 3

    page.locator('#listingTypeFilterTrigger').click()
    page.set_viewport_size({'width': 390, 'height': 844})
    expect(page.locator('#listingTypeFilterPanel')).to_be_hidden()
    page.locator('#mobileFiltersButton').click()
    page.locator('#listingTypeFilter').select_option('Land')
    page.screenshot(path=str(OUT / 'filter-flyouts-mobile.png'))
    page.locator('#applyFilters').click()
    assert page.locator('.property-card').count() == 2
    page.set_viewport_size({'width': 1468, 'height': 950})
    expect(page.locator('#listingTypeFilterTrigger')).to_contain_text('Residential Land')
    page.locator('#moreFiltersButton').click()
    page.set_viewport_size({'width': 390, 'height': 844})
    expect(page.locator('#listingFiltersDialog')).to_be_hidden()
    page.locator('#mobileFiltersButton').click()
    assert page.locator('#listingFiltersDialog').is_visible()
    page.keyboard.press('Escape')
    assert page.evaluate('document.body.style.overflow') == ''
    assert not errors, errors
    report = {'placement': checks, 'selectionAndSearch': True, 'keyboardAndDismissal': True,
              'responsiveTransitions': True, 'errors': errors}
    (OUT / 'filter-flyouts-review.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    browser.close()
