const {chromium}=require('C:/Users/Asus/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try {res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/rest/v1/'))assert.equal(r.method(),'GET');});
 const base='http://127.0.0.1:'+server.address().port;

 await page.goto(base+'/index.html');
 await page.waitForFunction(()=>document.querySelectorAll('#homePropertySections .property-card').length>0,null,{timeout:45000});
 assert.equal(await page.locator('#homePropertySections > .property-section').count(),3);
 assert.equal(await page.locator('#featured').count(),1);
 assert(await page.locator('#featuredGrid .property-card').count()>0);
 assert.equal(await page.locator('.featured-listings-action').count(),1);
 assert(await page.evaluate(()=>Boolean(document.querySelector('#featured').compareDocumentPosition(document.querySelector('#homePropertySections')) & Node.DOCUMENT_POSITION_FOLLOWING)));
 for(const width of [1440,768,390,360]) {
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#property-section-sale-track').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(__dirname,'homepage-divisions-'+width+'.png')});
  console.log('PASS homepage layout',width);
 }
 await page.getByRole('button',{name:'Next property for sale',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#property-section-sale-track').scrollLeft>10);
 assert.equal(await page.locator('#property-section-rent-track').evaluate(t=>t.scrollLeft),0);
 console.log('PASS independent carousel navigation');
 await page.getByRole('link',{name:'View all property for rent',exact:true}).click();
 await page.waitForFunction(()=>typeof publicState!=='undefined'&&publicState.listingsLoaded,null,{timeout:45000});
 assert.equal(await page.locator('.property-section').count(),0);
 assert(await page.evaluate(()=>publicState.purpose==='For Rent'&&filteredListings().every(p=>p.purpose==='For Rent')));
 assert.equal(await page.locator('#listingsGrid .property-card').count(),await page.evaluate(()=>filteredListings().length));
 console.log('PASS View All opens filtered listings grid');
 assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

