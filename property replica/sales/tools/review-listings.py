"""Visual QA for the Hilltop results-page preview."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'verification'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]; requests=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('request',lambda req:requests.append(req.url))
    page.goto('http://127.0.0.1:8085/listings.html',wait_until='networkidle',timeout=60000)
    font_family=page.locator('body').evaluate('(el)=>getComputedStyle(el).fontFamily')
    font_loaded=page.evaluate("document.fonts.check('15px Concise-RegularDemo')")
    assert 'Concise-RegularDemo' in font_family, font_family
    assert font_loaded
    page.screenshot(path=str(OUT/'listings-desktop.png'))
    checks=[]
    for width in [1600,1440,1280,1024,900,820,768,600,430,390,360]:
        page.set_viewport_size({'width':width,'height':844 if width<600 else 1100})
        page.locator('#listingPageTitle').click()
        metrics=page.evaluate('''() => ({
          width:innerWidth,
          pageWidth:document.documentElement.scrollWidth,
          marketplaceColumns:getComputedStyle(document.querySelector('.marketplace-layout')).gridTemplateColumns,
          resultsColumns:getComputedStyle(document.querySelector('.property-grid')).gridTemplateColumns,
          sidebarVisible:getComputedStyle(document.querySelector('.filter-sidebar')).display !== 'none',
          horizontalSearchExists:Boolean(document.querySelector('.search-section')),
          rightSidebarExists:Boolean(document.querySelector('.listing-sidebar'))
        })''')
        checks.append(metrics)
        assert metrics['width']==metrics['pageWidth'], metrics
        assert len(metrics['resultsColumns'].split()) == (2 if width > 600 else 1), metrics
        assert not metrics['horizontalSearchExists'], metrics
        assert not metrics['rightSidebarExists'], metrics
        assert metrics['sidebarVisible'] == (width > 900), metrics
        if width==390: page.screenshot(path=str(OUT/'listings-mobile.png'))
        button=page.locator('#mobileFiltersButton' if width<=900 else '#moreFiltersButton')
        button.click()
        assert page.locator('#listingFiltersDialog').is_visible()
        if width==390: page.screenshot(path=str(OUT/'listings-mobile-filters.png'))
        page.keyboard.press('Escape')
        assert not page.locator('#listingFiltersDialog').is_visible()
        assert button.evaluate('(el)=>el===document.activeElement')
    page.locator('#navToggle').click()
    assert page.locator('#siteNav').is_visible()
    page.keyboard.press('Escape')
    page.locator('.mobile-search-actions .request-trigger').click()
    assert page.locator('#requestDialog').is_visible()
    page.locator('#requestForm button[type=submit]').click()
    assert 'no request has been sent' in page.locator('#previewToast').inner_text()
    page.set_viewport_size({'width':1440,'height':1100})
    page.locator('#priceSummary').click()
    assert page.locator('.price-popover').is_visible()
    page.locator('#priceDone').click()
    assert not page.locator('.price-popover').is_visible()
    page.locator('.save-property').first.click()
    assert page.locator('.save-property').first.get_attribute('aria-pressed')=='true'
    initial_url=page.url
    first=page.locator('.property-gallery').first
    second=page.locator('.property-gallery').nth(1)
    second_src=second.locator('img').get_attribute('src')
    assert second.locator('.gallery-arrow,.gallery-counter').count()==0
    first.locator('.gallery-next').click()
    assert first.locator('.gallery-counter').inner_text()=='2 / 3'
    assert second.locator('img').get_attribute('src')==second_src
    assert page.url==initial_url
    first.locator('.gallery-previous').focus()
    page.keyboard.press('Enter')
    assert first.locator('.gallery-counter').inner_text()=='1 / 3'
    page.keyboard.press('Space')
    assert first.locator('.gallery-counter').inner_text()=='3 / 3'
    assert page.locator('.property-contact,.gallery-thumbnails').count()==0
    assert '0 beds' not in page.locator('#listingsGrid').inner_text()
    assert '0 baths' not in page.locator('#listingsGrid').inner_text()
    assert 'Active' not in page.locator('#listingsGrid').inner_text()
    page.locator('#listingSortSelect').select_option('price-low')
    assert '980,000' in page.locator('.property-price').first.inner_text()
    page.locator('#listingSortSelect').select_option('price-high')
    assert '3,200,000' in page.locator('.property-price').first.inner_text()
    page.locator('.quick-filter',has_text='Kabulonga').click()
    assert page.locator('.property-card').count()==1
    page.locator('.gallery-next').click()
    assert page.locator('.gallery-counter').inner_text()=='2 / 3'
    page.locator('#listingLocationInput').fill('no-such-location')
    page.locator('.search-button').click()
    assert page.locator('.listings-empty').is_visible()
    page.locator('#moreFiltersButton').click()
    page.locator('#resetFilters').click()
    page.keyboard.press('Escape')
    assert page.locator('.property-card').count()==3
    page.locator('#listingTypeFilterTrigger').click()
    page.get_by_role('radio',name='Stands & Residential Land').click()
    page.locator('.search-button').click()
    assert page.locator('.property-card').count()==2
    page.locator('#moreFiltersButton').click()
    page.locator('#resetFilters').click()
    page.keyboard.press('Escape')
    page.locator('#priceSummary').click()
    page.locator('#maxPriceInput').fill('1000000')
    page.locator('#priceDone').click()
    page.locator('.search-button').click()
    assert page.locator('.property-card').count()==1
    page.locator('#moreFiltersButton').click()
    page.locator('#resetFilters').click()
    page.keyboard.press('Escape')
    page.locator('#listingPurposeFilterTrigger').click()
    page.get_by_role('radio',name='To Rent',exact=True).click()
    page.locator('.search-button').click()
    assert page.locator('.property-card').count()==2
    assert page.locator('#listingPageTitle').inner_text()=='Properties to Rent'
    page.locator('#moreFiltersButton').click()
    page.locator('#resetFilters').click()
    page.keyboard.press('Escape')
    page.set_viewport_size({'width':1440,'height':700})
    page.evaluate('window.scrollTo(0,250)')
    assert abs(page.locator('.filter-sidebar').bounding_box()['y']-18)<2
    page.evaluate('window.scrollTo(0,0)')
    page.reload(wait_until='networkidle')
    page.screenshot(path=str(OUT/'hilltop-listings-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUT/'hilltop-listings-mobile.png'),full_page=True)
    # Native touch input exercises horizontal browsing and ordinary vertical scrolling.
    touch=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=touch.new_page()
    mobile.goto(initial_url,wait_until='networkidle')
    cdp=touch.new_cdp_session(mobile)
    def swipe(dx,dy):
        box=mobile.locator('.gallery-main').first.bounding_box()
        x=box['x']+box['width']*.7; y=box['y']+box['height']*.5
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for i in range(1,6):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/5,'y':y+dy*i/5}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    swipe(-130,4)
    assert mobile.locator('.gallery-counter').first.inner_text()=='2 / 3'
    assert mobile.url==initial_url
    swipe(0,-110)
    assert mobile.evaluate('scrollY')>0
    assert mobile.locator('.gallery-counter').first.inner_text()=='2 / 3'
    touch.close()
    link=page.locator('.property-title a').first
    expected=link.get_attribute('href')
    link.click()
    assert page.url.endswith(expected)
    assert not errors, errors
    assert not any('supabase.co' in url for url in requests)
    result={'widths':checks,'errors':errors,'font':{'family':font_family,'loaded':font_loaded},'backendRequests':0,'interactions':['filter drawer','Escape and focus restoration','mobile navigation','request preview only','price popover','save visual state','independent carousel, counter, wrap and keyboard','sort, quick filters, empty recovery, type, price, rent','native touch horizontal swipe and vertical scroll','detail URL','sticky filters']}
    (OUT/'listings-review.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
    browser.close()
