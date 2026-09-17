import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
out=root/'verification'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':950})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.route('**/favicon.ico',lambda r:r.fulfill(status=204))
    page.goto('http://127.0.0.1:8091/listings.html?check=carousel')
    page.evaluate('document.fonts.ready')
    chips=page.locator('#quickFilterOptions .quick-filter:visible')
    prev=page.get_by_role('button',name='Previous quick filter locations')
    nxt=page.get_by_role('button',name='Next quick filter locations')
    def state():
        return [page.url,page.locator('#listingsCount').inner_text(),page.locator('#listingsGrid').inner_html(),page.locator('#listingLocationInput').input_value()]
    initial=state()
    sequences=[['Kabulonga','Levy Junction','Cairo Road'],['Levy Junction','Cairo Road','Chalala'],['Cairo Road','Chalala','Victoria Falls']]
    expect(chips).to_have_text(sequences[0]); expect(prev).to_be_hidden()
    nxt.focus(); page.keyboard.press('Enter'); expect(chips).to_have_text(sequences[1]); assert state()==initial
    page.keyboard.press('Enter'); expect(chips).to_have_text(sequences[2]); expect(nxt).to_be_hidden(); expect(prev).to_be_focused(); assert state()==initial
    page.keyboard.press('Enter'); expect(chips).to_have_text(sequences[1])
    page.keyboard.press('Enter'); expect(chips).to_have_text(sequences[0]); expect(nxt).to_be_focused(); assert state()==initial
    page.get_by_role('button',name='Kabulonga',exact=True).click()
    expect(page.locator('.property-card')).to_have_count(1)
    selected=state()
    nxt.click(); expect(page.locator('.quick-filter[aria-pressed="true"]')).to_have_text('Kabulonga'); assert state()==selected
    prev.click(); expect(page.get_by_role('button',name='Kabulonga',exact=True)).to_have_attribute('aria-pressed','true')
    page.reload(); page.evaluate('document.fonts.ready')
    orders={}
    for value in ['default','price-low','price-high','newest']:
        page.locator('#listingSortSelect').select_option(value)
        orders[value]=page.locator('.property-price').all_text_contents()
    assert orders['price-low']==list(reversed(orders['price-high']))
    dimensions=[]
    for width in [1600,1440,1280,1024,901,768,601,430,390]:
        page.set_viewport_size({'width':width,'height':950})
        page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if width>600:
            assert 1<=chips.count()<=3
            assert page.locator('#quickFilterOptions').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
            count=chips.count()
            for _ in range(5-count):
                if nxt.is_visible(): nxt.click()
            page.locator('#quickFilterOptions').evaluate('(e)=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished))')
            assert page.locator('#quickFilterOptions').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
            while prev.is_visible(): prev.click()
        else:
            expect(prev).to_be_hidden(); expect(nxt).to_be_hidden(); assert chips.count()==5
            page.get_by_role('button',name='Victoria Falls',exact=True).click()
            expect(page.locator('.property-card')).to_have_count(1)
        page.locator('#quickFilterOptions').evaluate('(e)=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished))')
        page.screenshot(path=str(out/f'quick-carousel-{width}.png'))
        dimensions.append({'width':width,'visibleCount':chips.count(),'overflow':False})
    page.emulate_media(reduced_motion='reduce')
    page.set_viewport_size({'width':1440,'height':950})
    page.reload(); page.evaluate('document.fonts.ready')
    nxt.click()
    assert page.locator('#quickFilterOptions').evaluate('(e)=>e.getAnimations({subtree:true}).length')==0
    assert not errors, errors
    (out/'quick-carousel-results.json').write_text(json.dumps({'dimensions':dimensions,'errors':errors,'sequence':'passed','filterState':'passed','sorting':'passed','reducedMotion':'passed'},indent=2))
    print(json.dumps(dimensions))
    browser.close()


