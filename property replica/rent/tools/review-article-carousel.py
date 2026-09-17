"""Check the related article carousel without changing surrounding listings UI."""
from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'verification'/'article-carousel'
SHOTS=ROOT/'verification'/'article-carousel-correction'
SHOTS.mkdir(exist_ok=True)
baseline=json.loads((OUT/'baseline.json').read_text())
results={'viewports':[], 'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':950})
 reference=browser.new_page(viewport={'width':1440,'height':950})
 reference.route('**/listings.html',lambda route:route.fulfill(path=str(OUT/'before-listings.html'),content_type='text/html'))
 reference.route('**/listings.css?*',lambda route:route.fulfill(path=str(OUT/'before-listings.css'),content_type='text/css'))
 reference.goto('http://127.0.0.1:8091/listings.html'); reference.evaluate('document.fonts.ready')
 page.on('pageerror',lambda error:results['errors'].append(str(error)))
 page.goto('http://127.0.0.1:8091/listings.html'); page.evaluate('document.fonts.ready')
 track=page.locator('#relatedArticlesTrack')
 previous=page.get_by_role('button',name='Previous article',exact=True)
 next_button=page.get_by_role('button',name='Next article',exact=True)
 for width in [1920,1440,1280,1024,901,768,600,430,390,360,320]:
  page.set_viewport_size({'width':width,'height':950})
  page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  reference.set_viewport_size({'width':width,'height':950})
  reference.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  protected='.filter-sidebar, #listingsGrid, .listings-lower-prices, .listings-lower-alert, .listings-footer'
  measure='(els)=>els.map(e=>({text:e.textContent.replace(/\\s+/g," ").trim(),width:e.getBoundingClientRect().width,font:getComputedStyle(e).font}))'
  assert page.locator(protected).evaluate_all(measure)==reference.locator(protected).evaluate_all(measure),f'Protected content changed: {width}'
  track.focus(); track.press('Home')
  page.wait_for_function('document.querySelector("#relatedArticlesTrack").scrollLeft < 1')
  expect(previous).to_be_disabled()
  track.scroll_into_view_if_needed()
  metrics=track.evaluate('''t=>{const c=t.querySelector('.editorial-card'), i=c.querySelector('img');return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,track:t.clientWidth,card:c.getBoundingClientRect().width,imageWidth:i.clientWidth,imageHeight:i.clientHeight,stacked:getComputedStyle(c.querySelector('a')).gridTemplateColumns.split(' ').length===1,snap:getComputedStyle(t).scrollSnapType,scrollbar:getComputedStyle(t).scrollbarWidth}}''')
  metrics['originalPageWidth']=reference.evaluate('document.documentElement.scrollWidth')
  assert metrics['pageWidth']==metrics['originalPageWidth'],metrics
  assert page.locator('#relatedPropertyArticles').evaluate('e=>e.getBoundingClientRect().right<=innerWidth'),metrics
  assert metrics['snap']=='x mandatory' and metrics['scrollbar']=='none',metrics
  assert metrics['card']<metrics['track'],metrics
  if width<=600: assert metrics['stacked'] and 1.05<metrics['track']/metrics['card']<1.15,metrics
  if width>=901 or width==768:
   assert not metrics['stacked'] and abs(2*metrics['card']+16-metrics['track'])<1,metrics
   assert metrics['imageWidth']>metrics['imageHeight'],metrics
   assert metrics['imageHeight']<180,metrics
  def assert_complete_pair():
   if width<901 and width!=768: return
   pair=track.evaluate('''t=>{const r=t.getBoundingClientRect(); const visible=[...t.children].map(c=>c.getBoundingClientRect()).filter(c=>c.right>r.left+1 && c.left<r.right-1);return {count:visible.length,complete:visible.every(c=>c.left>=r.left-1 && c.right<=r.right+1),contained:r.right<=t.closest('section').getBoundingClientRect().right,images:[...t.querySelectorAll('img')].map(i=>[i.clientWidth,i.clientHeight])}}''')
   assert pair['count']==2 and pair['complete'] and pair['contained'],pair
   assert all(i==pair['images'][0] for i in pair['images']),pair
  assert_complete_pair()
  results['viewports'].append(metrics)
  if width in [1440,768,390]:
   track.evaluate('e=>e.blur()')
   page.locator('.editorial-card-image').first.evaluate('e=>e.decode()')
   page.locator('#relatedPropertyArticles').screenshot(path=str(SHOTS/f'articles-{width}.png'))
   if width==1440: page.screenshot(path=str(SHOTS/'desktop-1440.png'))
  final_index=3 if width>=901 or width==768 else 4
  for index in range(1,final_index+1):
   next_button.click()
   page.wait_for_function('''index=>{const t=document.querySelector('#relatedArticlesTrack'),c=t.querySelectorAll('.editorial-card');const expected=Math.min(t.scrollWidth-t.clientWidth,c[index].getBoundingClientRect().left-c[0].getBoundingClientRect().left);return Math.abs(t.scrollLeft-expected)<1}''',arg=index)
   assert_complete_pair()
   if index<final_index: expect(next_button).to_be_enabled()
  expect(next_button).to_be_disabled()
  for index in range(final_index-1,-1,-1):
   previous.click()
   page.wait_for_function('''index=>{const t=document.querySelector('#relatedArticlesTrack'),c=t.querySelectorAll('.editorial-card');return Math.abs(t.scrollLeft-(c[index].getBoundingClientRect().left-c[0].getBoundingClientRect().left))<1}''',arg=index)
   assert_complete_pair()
  expect(previous).to_be_disabled()
 # Full-card image activation, original content, Escape and focus restoration.
 first=page.locator('.editorial-card-link').first
 first.locator('img').click()
 dialog=page.locator('#articlePreviewDialog')
 expect(dialog).to_be_visible()
 expect(page.locator('#articlePreviewTitle')).to_have_text(first.locator('h3').inner_text())
 expect(page.locator('#articlePreviewDescription')).to_have_text(first.locator('p').inner_text())
 page.keyboard.press('Escape'); expect(dialog).not_to_be_visible(); expect(first).to_be_focused()
 # Native horizontal mouse wheel/trackpad scrolling.
 page.set_viewport_size({'width':1440,'height':950}); track.scroll_into_view_if_needed(); track.hover()
 page.mouse.wheel(600,0)
 page.wait_for_function('document.querySelector("#relatedArticlesTrack").scrollLeft > 100')
 # Respect reduced motion, including button navigation.
 page.emulate_media(reduced_motion='reduce')
 assert track.evaluate('e=>getComputedStyle(e).scrollBehavior')=='auto'
 track.focus(); track.press('End'); expect(next_button).to_be_disabled()
 # Real browser touch input under mobile emulation.
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 mobile=context.new_page(); mobile.goto('http://127.0.0.1:8091/listings.html')
 mt=mobile.locator('#relatedArticlesTrack'); mt.scroll_into_view_if_needed()
 box=mt.bounding_box(); session=context.new_cdp_session(mobile)
 x=box['x']+box['width']*.8; y=box['y']+90
 session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for distance in range(20,241,20):
  session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-distance,'y':y}]})
 session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 mobile.wait_for_function('document.querySelector("#relatedArticlesTrack").scrollLeft > 100')
 expect(mobile.locator('#articlePreviewDialog')).not_to_be_visible()
 assert mobile.evaluate('document.documentElement.scrollWidth===innerWidth')
 results['touch_swipe']='passed'
 context.close(); browser.close()
assert not results['errors'],results
before=(OUT/'before-listings.html').read_text(encoding='utf-8'); after=(ROOT/'listings.html').read_text(encoding='utf-8')
original=re.findall(r'<article>\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>',before,re.S)
def outside_articles(html):
 html=re.sub(r'        <section class="listings-lower-articles".*?        </section>','',html,flags=re.S)
 html=re.sub(r'listings.css\?v=[^"]+','listings.css',html)
 return re.sub(r'  <script src="listings-articles.js\?v=\d+"></script>\n','',html)
assert outside_articles(before)==outside_articles(after),'Markup outside article section changed'
assert len(original)==5 and all(title in after and desc in after for title,desc in original)
assert (ROOT/'listings-ui.js').read_bytes()==(OUT/'before-listings-ui.js').read_bytes()
results.update({'protected_content':'unchanged','original_copy':'preserved','arrow_steps_and_boundaries':'passed','preview_keyboard_and_focus':'passed','horizontal_wheel':'passed','reduced_motion':'passed'})
(SHOTS/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
