const {chromium}=require('C:/Users/Asus/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(8131);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8131/index.html');await page.waitForFunction(()=>publicState.listingsLoaded,{timeout:30000});await page.waitForSelector('#listingMapHolder svg');
console.log('LIVE',await page.evaluate(()=>({count:publicState.properties.length,types:[...new Set(publicState.properties.map(p=>p.property_type))],purposes:[...new Set(publicState.properties.map(p=>p.purpose))],missingProvince:publicState.properties.filter(p=>!p.province_id).length,missingCity:publicState.properties.filter(p=>!p.city_id).length})));
for(const width of [1920,1440,1024,820,768,430,390,360]){await page.setViewportSize({width,height:1000});const layout=await page.evaluate(()=>{const f=document.querySelector('.discovery-filter').getBoundingClientRect(),m=document.querySelector('.discovery-map').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,fx:f.x,fy:f.y,fw:f.width,mx:m.x,my:m.y,mw:m.width};});assert(!layout.overflow);if(width>900){assert(layout.mx>layout.fx+layout.fw);assert(layout.mw>layout.fw);}else assert(layout.my>layout.fy);await page.locator('.property-discovery').screenshot({path:path.join(__dirname,`discovery-${width}.png`)});console.log('PASS viewport',width);}
await page.getByRole('button',{name:'For Rent',exact:true}).tap();assert(await page.evaluate(()=>publicState.purpose==='For Rent'&&filteredListings().every(p=>p.purpose==='For Rent')));
await page.getByRole('button',{name:'For Sale',exact:true}).click();assert(await page.evaluate(()=>filteredListings().every(p=>p.purpose==='For Sale')));
await page.locator('#discoveryType').selectOption('House');assert(await page.evaluate(()=>filteredListings().every(p=>p.property_type==='House')));
await page.locator('#discoveryType').selectOption('all');
const area=await page.evaluate(()=>discoveryLocations().find(o=>o.area!=='all'));
assert(area);await page.locator('#discoveryLocation').selectOption(area.value);assert(await page.evaluate(()=>filteredListings().every(matchesListingLocation)&&filteredListings().every(matchesListingArea)));
assert.equal(await page.locator('#listingMapHolder [aria-pressed="true"]').getAttribute('data-province'),area.province);
await page.locator('[data-province="southern"]').press('Enter');assert(await page.evaluate(()=>publicState.province==='southern'&&publicState.city==='all'&&publicState.area==='all'));
await page.getByRole('button',{name:'All Zambia',exact:true}).click();assert.equal(await page.locator('#discoveryLocation').inputValue(),'all');
const price=await page.locator('#discoveryPrice option').nth(1).getAttribute('value');await page.locator('#discoveryPrice').selectOption(price);assert(await page.evaluate(()=>filteredListings().every(p=>p.currency_code===publicState.currency&&Number(p.price)<=Number(publicState.maxPrice))));
await page.locator('#discoveryType').selectOption('House');assert(await page.evaluate(()=>filteredListings().every(p=>p.purpose==='For Sale'&&p.property_type==='House'&&Number(p.price)<=Number(publicState.maxPrice))));
await page.goto('http://localhost:8131/index.html?purpose=rent&currency=ZMW&maxPrice=0');await page.waitForFunction(()=>publicState.listingsLoaded);assert.equal(await page.evaluate(()=>filteredListings().length),0);assert.match(await page.locator('#discoveryStatus').innerText(),/No properties match/);
await page.locator('#discoveryPrice').selectOption('');await page.getByRole('button',{name:'Search Properties',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'homePropertySections');
await page.goto('http://localhost:8131/website.html');await page.waitForFunction(()=>publicState.listingsLoaded);assert.equal(await page.locator('[data-discovery-purpose]').count(),2);
await page.goto('http://localhost:8131/listings.html?purpose=rent');await page.waitForFunction(()=>publicState.listingsLoaded);assert(await page.evaluate(()=>filteredListings().every(p=>p.purpose==='For Rent')));
assert.deepEqual(errors,[]);console.log('PASS transactions, touch, location, keyboard map, price, combined, empty, search, homepage alias, listings regression; no runtime errors');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

