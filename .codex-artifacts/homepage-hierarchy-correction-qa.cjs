const { chromium } = require('C:/Users/Asus/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/favicon.ico') return response.writeHead(204).end();
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    const types = {
      '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
      '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2'
    };
    response.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

function collectConsole(page, label, output) {
  page.on('pageerror', error => output.errors.push(label + ' pageerror: ' + error.message));
  page.on('console', message => {
    const source = message.location().url ? ' @ ' + message.location().url : '';
    if (message.type() === 'error') output.errors.push(label + ' console: ' + message.text() + source);
    if (message.type() === 'warning') output.warnings.push(label + ' console: ' + message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) output.failedResponses.push({ label, status: response.status(), url: response.url() });
  });
}

async function waitForHomepage(page) {
  await page.waitForFunction(() => window.publicState && publicState.listingsLoaded, null, { timeout: 45000 });
  await page.waitForSelector('#property-section-sale-title');
  await page.waitForSelector('#property-section-developments-title');
  await page.waitForSelector('#listingMapHolder svg');
}

async function verifyHomepageAlias(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForHomepage(page);
  return page.evaluate(() => {
    const discovery = document.querySelector('.property-discovery');
    const divisions = document.querySelector('.home-property-divisions');
    const exclusive = document.querySelector('.exclusive-properties-section');
    const services = document.querySelector('[data-property-services-section]');
    const titles = [...document.querySelectorAll('#homePropertySections > .property-section h2')].map(node => node.textContent.trim());
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    return {
      titles,
      duplicateIds,
      propertyCount: publicState.properties.length,
      exclusiveCount: publicState.exclusiveProperties.length,
      order: discovery.compareDocumentPosition(divisions) & Node.DOCUMENT_POSITION_FOLLOWING
        && divisions.compareDocumentPosition(exclusive) & Node.DOCUMENT_POSITION_FOLLOWING
        && exclusive.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING,
      featuredDomCount: document.querySelectorAll('#featured, #featuredGrid, #featuredEmpty, .featured-properties-section').length,
      featuredTextPresent: /Featured Properties/i.test(document.body.innerText),
      goExclusivePresent: Boolean([...document.querySelectorAll('a')].find(link => link.textContent.trim() === 'GO EXCLUSIVE'))
    };
  });
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const output = { errors: [], warnings: [], failedResponses: [], viewports: [], interactions: {}, aliases: {} };

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
    collectConsole(page, 'homepage', output);
    output.aliases.index = await verifyHomepageAlias(page, base + '/index.html');
    assert.deepEqual(output.aliases.index.titles, ['Property for Sale', 'Property for Rent', 'New Developments']);
    assert.equal(Boolean(output.aliases.index.order), true);
    assert.deepEqual(output.aliases.index.duplicateIds, []);
    assert.equal(output.aliases.index.featuredDomCount, 0);
    assert.equal(output.aliases.index.featuredTextPresent, false);
    assert.equal(output.aliases.index.goExclusivePresent, true);
    assert(output.aliases.index.propertyCount > 0);

    const developmentState = await page.evaluate(() => {
      const title = document.querySelector('#property-section-developments-title');
      const section = title.closest('.property-section');
      const buttons = [...section.querySelectorAll('.property-section__arrow')];
      const viewAll = section.querySelector('.property-section__view-all');
      return {
        cards: section.querySelectorAll('.property-card').length,
        controls: buttons.length,
        controlsDisabled: buttons.every(button => button.disabled),
        viewAllTag: viewAll.tagName,
        viewAllDisabled: viewAll.getAttribute('aria-disabled'),
        emptyText: section.querySelector('.property-section__empty')?.textContent.trim() || ''
      };
    });
    assert.equal(developmentState.controls, 2);
    output.interactions.developments = developmentState;

    const loadingState = await page.evaluate(() => {
      renderMorePropertiesLoading();
      const section = document.querySelector('#morePropertiesSection');
      const state = {
        visible: !section.hidden,
        busy: section.getAttribute('aria-busy'),
        skeletons: section.querySelectorAll('.more-property-card--skeleton').length
      };
      renderMoreProperties();
      return state;
    });
    assert.equal(loadingState.visible, true);
    assert.equal(loadingState.busy, 'true');
    assert.equal(loadingState.skeletons, 5);
    output.interactions.exclusiveLoading = loadingState;

    for (const width of [1440, 1024, 768, 430, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => {
        const titles = [...document.querySelectorAll('#homePropertySections > .property-section h2')].map(node => node.textContent.trim());
        const development = document.querySelector('#property-section-developments-title').closest('.property-section');
        const exclusive = document.querySelector('.exclusive-properties-section');
        const firstExclusiveContent = exclusive.querySelector('#morePropertiesSection:not([hidden])') || exclusive.querySelector('.exclusive-properties-action');
        const gap = firstExclusiveContent.getBoundingClientRect().top - development.getBoundingClientRect().bottom;
        return {
          titles,
          overflow: document.documentElement.scrollWidth > innerWidth,
          gap: Math.round(gap),
          saleScrollable: document.querySelector('#property-section-sale-track').scrollWidth > document.querySelector('#property-section-sale-track').clientWidth,
          discoveryBeforeDivisions: Boolean(document.querySelector('.property-discovery').compareDocumentPosition(document.querySelector('.home-property-divisions')) & Node.DOCUMENT_POSITION_FOLLOWING),
          divisionsBeforeExclusive: Boolean(document.querySelector('.home-property-divisions').compareDocumentPosition(exclusive) & Node.DOCUMENT_POSITION_FOLLOWING)
        };
      });
      assert.deepEqual(layout.titles, ['Property for Sale', 'Property for Rent', 'New Developments']);
      assert.equal(layout.overflow, false);
      assert.equal(layout.discoveryBeforeDivisions, true);
      assert.equal(layout.divisionsBeforeExclusive, true);
      assert(layout.gap >= 30 && layout.gap <= 160);
      assert.equal(layout.saleScrollable, true);
      output.viewports.push({ width, ...layout });

      if (width === 1440 || width === 375) {
        await page.screenshot({
          path: path.join(__dirname, width === 1440 ? 'homepage-hierarchy-desktop.png' : 'homepage-hierarchy-mobile.png'),
          fullPage: true
        });
      }
    }

    await page.setViewportSize({ width: 768, height: 1000 });
    await page.locator('#property-section-sale-track').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const saleCard = page.locator('#property-section-sale-track .property-card').first();
    assert(await saleCard.count() > 0);
    await saleCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    const cardHref = await saleCard.getAttribute('href');
    assert.match(cardHref, /^property-details\.html\?id=/);
    const imageState = await page.locator('#property-section-sale-track img.property-card-img').evaluateAll(images => images.map(image => ({ complete: image.complete, naturalWidth: image.naturalWidth, src: image.currentSrc || image.src })));
    assert(imageState.length === 0 || imageState.some(image => image.complete && image.naturalWidth > 0));
    output.interactions.saleCard = { href: cardHref, images: imageState };

    const nextSale = page.locator('#property-section-sale-title').locator('xpath=ancestor::section[1]').locator('[data-direction="1"]');
    const carouselEnabled = !(await nextSale.isDisabled());
    let carouselMoved = null;
    if (carouselEnabled) {
      const before = await page.locator('#property-section-sale-track').evaluate(track => track.scrollLeft);
      await nextSale.click();
      await page.waitForTimeout(650);
      const after = await page.locator('#property-section-sale-track').evaluate(track => track.scrollLeft);
      carouselMoved = after > before + 2;
      assert.equal(carouselMoved, true);
    }
    output.interactions.saleCarousel = { enabled: carouselEnabled, moved: carouselMoved };

    await page.locator('#morePropertiesTrack').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    const exclusiveState = await page.evaluate(() => {
      const section = document.querySelector('#morePropertiesSection');
      const images = [...section.querySelectorAll('.more-property-card img')].map(image => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        src: image.currentSrc || image.src
      }));
      return {
        hidden: section.hidden,
        cards: section.querySelectorAll('.more-property-card:not(.more-property-card--skeleton)').length,
        images,
        goExclusiveHref: [...document.querySelectorAll('.exclusive-properties-action a')].find(link => link.textContent.includes('GO EXCLUSIVE'))?.getAttribute('href') || ''
      };
    });
    assert.equal(exclusiveState.hidden, false);
    assert(exclusiveState.cards > 0);
    assert(exclusiveState.images.every(image => image.naturalWidth > 0));
    assert.equal(exclusiveState.goExclusiveHref, 'listings.html');
    const exclusiveNext = page.locator('#morePropertiesNext');
    const exclusiveCarouselEnabled = !(await exclusiveNext.isDisabled());
    let exclusiveCarouselMoved = null;
    if (exclusiveCarouselEnabled) {
      const before = await page.locator('#morePropertiesTrack').evaluate(track => track.scrollLeft);
      await exclusiveNext.click();
      await page.waitForTimeout(650);
      const after = await page.locator('#morePropertiesTrack').evaluate(track => track.scrollLeft);
      exclusiveCarouselMoved = after > before + 2;
      assert.equal(exclusiveCarouselMoved, true);
      assert.equal(await page.locator('#morePropertiesPrev').isDisabled(), false);
    }
    output.interactions.exclusive = { ...exclusiveState, carouselEnabled: exclusiveCarouselEnabled, carouselMoved: exclusiveCarouselMoved };

    const detailPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    collectConsole(detailPage, 'property-details', output);
    await detailPage.goto(base + '/' + cardHref, { waitUntil: 'domcontentloaded' });
    await detailPage.waitForSelector('#detailsContent:not(.hidden)', { timeout: 45000 });
    output.interactions.cardOpened = { url: detailPage.url(), title: await detailPage.locator('#propertyTitle').innerText() };
    await detailPage.close();

    const listingPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    collectConsole(listingPage, 'view-all', output);
    await listingPage.goto(base + '/listings.html?purpose=sale', { waitUntil: 'domcontentloaded' });
    await listingPage.waitForFunction(() => window.publicState && publicState.listingsLoaded, null, { timeout: 45000 });
    output.interactions.viewAll = await listingPage.evaluate(() => ({
      purpose: publicState.purpose,
      matching: filteredListings().every(property => property.purpose === 'For Sale'),
      renderedCards: document.querySelectorAll('#listingsGrid .property-card').length
    }));
    assert.equal(output.interactions.viewAll.purpose, 'For Sale');
    assert.equal(output.interactions.viewAll.matching, true);
    await listingPage.close();

    const aliasPage = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
    collectConsole(aliasPage, 'website-alias', output);
    output.aliases.website = await verifyHomepageAlias(aliasPage, base + '/website.html');
    assert.deepEqual(output.aliases.website.titles, ['Property for Sale', 'Property for Rent', 'New Developments']);
    assert.equal(Boolean(output.aliases.website.order), true);
    assert.deepEqual(output.aliases.website.duplicateIds, []);
    assert.equal(output.aliases.website.featuredDomCount, 0);
    assert.equal(output.aliases.website.featuredTextPresent, false);
    await aliasPage.close();

    fs.writeFileSync(path.join(__dirname, 'homepage-hierarchy-correction-results.json'), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
    assert.deepEqual(output.errors, []);
    console.log('PASS homepage hierarchy correction QA');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
