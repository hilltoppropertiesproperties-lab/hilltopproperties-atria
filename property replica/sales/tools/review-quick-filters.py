import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[1]
out = root / 'verification'
widths = [1600,1440,1280,1024,768,430,390]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':950})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: errors.append(m.text) if m.type == 'error' else None)
    baseline={}
    page.route('**/listings.html',lambda r:r.fulfill(path=str(out/'quick-filters-before/listings.html'),content_type='text/html'))
    page.route('**/listings.css',lambda r:r.fulfill(path=str(out/'quick-filters-before/listings.css'),content_type='text/css'))
    page.route('**/favicon.ico',lambda r:r.fulfill(status=204))
    page.goto('http://127.0.0.1:8091/listings.html')
    page.evaluate('document.fonts.ready')
    for w in widths:
        page.set_viewport_size({'width':w,'height':950})
        baseline[w]=page.locator('#listingsGrid').bounding_box()['y']
    page.unroute('**/listings.html'); page.unroute('**/listings.css')
    page.reload(); page.evaluate('document.fonts.ready')
    results=[]
    for w in widths:
        page.set_viewport_size({'width':w,'height':950})
        metrics=page.evaluate('''() => {
            const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
            return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,title:rect('#listingPageTitle'),tools:rect('.results-header-tools'),sort:rect('.sort-control'),header:rect('.results-header'),grid:rect('#listingsGrid'),chips:[...document.querySelectorAll('.quick-filter')].map(e=>e.getBoundingClientRect().toJSON())};
        }''')
        assert not metrics['overflow'],metrics
        assert metrics['sort']['right'] <= metrics['grid']['right']+1
        assert metrics['sort']['x'] >= metrics['title']['right']-1
        assert metrics['grid']['y'] < baseline[w], (w,metrics['grid']['y'],baseline[w])
        if w>900:
            assert abs(metrics['grid']['y']-metrics['header']['bottom']-20)<1
            assert all(c['right']<=metrics['grid']['right']+1 for c in metrics['chips'])
        for i,c in enumerate(metrics['chips']):
            for d in metrics['chips'][i+1:]:
                assert c['right']<=d['x'] or d['right']<=c['x'] or c['bottom']<=d['y'] or d['bottom']<=c['y']
        page.screenshot(path=str(out/f'quick-filters-{w}.png'))
        results.append({'width':w,'cardsMovedUp':round(baseline[w]-metrics['grid']['y'],1),'chipRows':len(set(c['y'] for c in metrics['chips'])),'gridTop':metrics['grid']['y'],'sortTop':metrics['sort']['y'],'chipTop':metrics['chips'][0]['y']})
        page.get_by_role('button',name='Kabulonga',exact=True).click()
        expect(page.get_by_role('button',name='Kabulonga',exact=True)).to_have_attribute('aria-pressed','true')
        expect(page.locator('.property-card')).to_have_count(1)
        page.locator('#listingSortSelect').select_option('price-low')
        expect(page.locator('.property-card')).to_have_count(1)
        page.reload(); page.evaluate('document.fonts.ready')
    page.set_viewport_size({'width':1440,'height':950})
    orders={}
    for value in ['default','price-low','price-high','newest']:
        page.locator('#listingSortSelect').select_option(value)
        orders[value]=page.locator('.property-price').all_text_contents()
    assert orders['price-low']==list(reversed(orders['price-high']))
    assert not errors,errors
    (out/'quick-filters-results.json').write_text(json.dumps({'widths':results,'sortOrders':orders,'errors':errors},indent=2))
    print(json.dumps(results,indent=2))
    browser.close()


