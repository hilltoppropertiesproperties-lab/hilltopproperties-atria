from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
out=Path(__file__).resolve().parents[1]/'verification'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':950})
    page.goto('http://127.0.0.1:8091/listings.html')
    page.evaluate('document.fonts.ready')
    page.locator('#listingSortSelect').select_option('price-low')
    order=page.locator('#listingsGrid').inner_html()
    measurements=[]
    for width in [1600,1440,1280,1201,1200,1101,1100,1024,950,901,900,768,430,390]:
        page.set_viewport_size({'width':width,'height':950})
        page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        expect(page.locator('#listingSortSelect')).to_have_value('price-low')
        assert page.locator('#listingsGrid').inner_html()==order
        assert page.locator('#listingSortSelect').count()==1
        assert page.locator(('.header-actions' if width>900 else '.results-header')+' #listingSortSelect').count()==1
        data=page.evaluate('''()=>{
            const rect=e=>e.getBoundingClientRect().toJSON();
            const visible=e=>e.getBoundingClientRect().width>0;
            return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,header:[...document.querySelectorAll('.header-inner > .brand, .site-nav button, .header-actions > *')].filter(visible).map(e=>({text:e.textContent,box:rect(e)})),quick:rect(document.querySelector('.quick-filter-carousel')),grid:rect(document.querySelector('#listingsGrid'))};
        }''')
        assert not data['overflow'],width
        if width>900:
            for i,a in enumerate(data['header']):
                assert a['box']['right']<=width, (width,a)
                for b in data['header'][i+1:]:
                    x,y=a['box'],b['box']
                    assert x['right']<=y['x'] or y['right']<=x['x'] or x['bottom']<=y['y'] or y['bottom']<=x['y'],(width,a,b)
            assert abs(data['quick']['right']-data['grid']['right'])<1
        measurements.append({'width':width,'gridTop':data['grid']['top'],'sortLocation':'header' if width>900 else 'results','noOverlap':True})
        if width in [1440,1024,901,390]:page.screenshot(path=str(out/f'header-position-{width}.png'))
    page.set_viewport_size({'width':1440,'height':950})
    page.get_by_role('button',name='Account',exact=True).click()
    expect(page.locator('#previewToast')).to_contain_text('Account')
    page.get_by_role('button',name='List Privately',exact=False).click()
    expect(page.locator('#previewToast')).to_contain_text('List privately')
    (out/'header-position-results.json').write_text(json.dumps(measurements,indent=2))
    print(json.dumps(measurements))
    browser.close()

