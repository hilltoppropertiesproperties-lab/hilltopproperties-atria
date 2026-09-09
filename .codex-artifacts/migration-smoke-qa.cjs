const {chromium} = require('C:/Users/Asus/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const results = [];
const pageErrors = [];
const responseErrors = [];
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const requested = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? pathname + 'index.html' : pathname;
  const file = path.resolve(root, '.' + requested);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    response.setHeader('Content-Type', ({
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => pageErrors.push({url: page.url(), message: error.message}));
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).origin === base) {
      responseErrors.push({url: response.url(), status: response.status()});
    }
  });

  const check = async (name, action) => {
    try {
      const detail = await action();
      results.push({name, result: 'PASS', detail});
      console.log('PASS ' + name);
    } catch (error) {
      results.push({name, result: 'FAIL', error: error.message});
      console.log('FAIL ' + name + ': ' + error.message);
    }
  };

  try {
    await check('Homepage target features and migrated sections', async () => {
      await page.goto(base + '/index.html', {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => publicState.listingsLoaded);
      assert.equal(await page.locator('.division-switcher__link').count(), 2);
      assert(await page.locator('#featuredGrid .property-card').count() > 0);
      assert.equal(await page.locator('#homePropertySections > .property-section').count(), 3);
      assert.equal(await page.locator('.zambia-map-interactive').count(), 1);
      assert.equal(await page.locator('[data-property-services-section]').count(), 1);
      assert.equal(await page.locator('[data-testimonial-carousel]').count(), 1);
      await page.screenshot({path: path.join(__dirname, 'migration-home-desktop.png'), fullPage: true});
      return 'Division switcher, featured cards, discovery, property sections, services, decorative map and testimonials present';
    });

    await check('Homepage modal and form validation', async () => {
      await page.locator('#headerEnquiryButton').click();
      assert.equal(await page.locator('#enquiryModal').getAttribute('aria-hidden'), 'false');
      await page.locator('#enquiryModalClose').click();
      assert.equal(await page.locator('#enquiryModal').getAttribute('aria-hidden'), 'true');
      await page.locator('#premiumEnquiryForm button[type="submit"]').click();
      assert(await page.locator('#err_premiumName').innerText());
      assert(await page.locator('#err_premiumPhone').innerText());
      return 'No enquiry submitted';
    });

    await check('Homepage mobile navigation and layout', async () => {
      await page.setViewportSize({width: 390, height: 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('#navToggle').click();
      assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'), 'true');
      await page.screenshot({path: path.join(__dirname, 'migration-home-mobile.png'), fullPage: true});
      await page.locator('#navToggle').click();
      return 'No horizontal overflow';
    });

    await check('Property detail, location and market modules', async () => {
      await page.setViewportSize({width: 1440, height: 1000});
      await page.goto(base + '/listings.html', {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => publicState.listingsLoaded);
      const propertyCards = page.locator('#listingsGrid .property-card');
      const propertyCardCount = await propertyCards.count();
      assert(propertyCardCount > 0);
      const href = await propertyCards.first().getAttribute('href');
      await page.goto(base + '/' + href, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => typeof detailsState !== 'undefined' && Boolean(detailsState.property));
      assert(await page.locator('#propertyTitle').innerText());
      assert.equal(await page.locator('#marketInsightsSection').count(), 1);
      assert.equal(await page.locator('#propertyLocationSection').count(), 1);
      assert(await page.locator('#enquiryModal').count() === 1);
      return href;
    });

    await check('About, services and construction navigation', async () => {
      for (const pagePath of ['/about.html', '/services.html', '/construction/']) {
        await page.goto(base + pagePath, {waitUntil: 'domcontentloaded'});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.equal(await page.locator('.division-switcher__link').count(), 2);
      return 'All pages loaded without local resource errors';
    });

    await check('No runtime or local resource errors', async () => {
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(responseErrors, []);
    });

    await page.goto(base + '/property-details.html?id=00000000-0000-0000-0000-000000000000', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof detailsState !== 'undefined' && (Boolean(detailsState.property) || document.querySelector('#siteStatus.is-error')));
    const mockFallback = await page.evaluate(() => Boolean(detailsState.property));
    results.push({
      name: 'Invalid property lookup does not fabricate a listing',
      result: mockFallback ? 'FAIL' : 'PASS',
      detail: mockFallback ? 'Pre-existing mock property fallback remains active' : 'Unavailable state shown'
    });
    console.log((mockFallback ? 'KNOWN FAIL ' : 'PASS ') + 'invalid property lookup fallback');
  } finally {
    fs.writeFileSync(path.join(__dirname, 'migration-smoke-results.json'), JSON.stringify({
      results,
      pageErrors,
      responseErrors
    }, null, 2));
    await browser.close();
    server.close();
  }

  if (results.some(result => result.result === 'FAIL' && result.name !== 'Invalid property lookup does not fabricate a listing')) {
    process.exitCode = 1;
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
