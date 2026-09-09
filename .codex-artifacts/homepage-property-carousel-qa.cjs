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

async function waitForHomepage(page) {
  await page.waitForFunction(() => window.publicState && publicState.listingsLoaded, null, { timeout: 45000 });
  await page.waitForSelector('#property-section-sale-viewport .property-card');
}

function expectedFullCards(width) {
  if (width >= 1100) return 3;
  if (width >= 768) return 2;
  return 1;
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
  const page = await context.newPage();
  const output = { viewports: [], navigation: {}, touch: {}, consoleErrors: [] };
  page.on('pageerror', error => output.consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') output.consoleErrors.push(message.text());
  });

  try {
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await waitForHomepage(page);

    for (const width of [390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => {
        renderPropertySections(document.querySelector('#homePropertySections'), publicState.properties);
        document.querySelectorAll('.property-section__viewport').forEach(viewport => viewport.scrollTo({ left: 0, behavior: 'auto' }));
      });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const metadata = document.querySelector('#property-section-sale-track .property-card-location');
        const metadataColor = getComputedStyle(metadata).color;
        const sections = ['sale', 'rent'].map(key => {
          const section = document.querySelector('#property-section-' + key + '-title').closest('.property-section');
          const viewport = section.querySelector('.property-section__viewport');
          const track = section.querySelector('.property-section__track');
          const cards = [...track.querySelectorAll('.property-card')];
          const viewportRect = viewport.getBoundingClientRect();
          const cardRects = cards.map(card => card.getBoundingClientRect());
          const visibleWidths = cardRects.map(rect => Math.max(0, Math.min(rect.right, viewportRect.right) - Math.max(rect.left, viewportRect.left)));
          const fullCards = visibleWidths.filter((visible, index) => visible >= cardRects[index].width - 1).length;
          const partialIndex = visibleWidths.findIndex((visible, index) => visible > 2 && visible < cardRects[index].width - 1);
          const partialRatio = partialIndex === -1 ? 0 : visibleWidths[partialIndex] / cardRects[partialIndex].width;
          const previous = section.querySelector('[data-direction="-1"]');
          const next = section.querySelector('[data-direction="1"]');
          const viewAll = section.querySelector('.property-section__view-all');
          const titleRect = section.querySelector('h2').getBoundingClientRect();
          const controlsRect = section.querySelector('.property-section__controls').getBoundingClientRect();
          const firstImage = section.querySelector('.property-card-img');
          return {
            key,
            cards: cards.length,
            fullCards,
            partialRatio,
            cardWidth: cardRects[0] ? cardRects[0].width : 0,
            gap: parseFloat(getComputedStyle(track).columnGap),
            viewportWidth: viewport.clientWidth,
            scrollable: viewport.scrollWidth > viewport.clientWidth,
            overflowX: getComputedStyle(viewport).overflowX,
            scrollSnapType: getComputedStyle(viewport).scrollSnapType,
            firstSnapAlign: cards[0] ? getComputedStyle(cards[0]).scrollSnapAlign : '',
            previousDisabled: previous.disabled && previous.getAttribute('aria-disabled') === 'true',
            nextEnabled: !next.disabled && next.getAttribute('aria-disabled') === 'false',
            arrowsVisible: getComputedStyle(previous).display !== 'none',
            metadataColor,
            viewAllColor: getComputedStyle(viewAll).color,
            arrowColor: getComputedStyle(next).color,
            arrowBorderColor: getComputedStyle(next).borderColor,
            headerSingleLine: Math.abs((titleRect.top + titleRect.height / 2) - (controlsRect.top + controlsRect.height / 2)) < 3,
            headerClear: titleRect.right <= controlsRect.left + 1,
            imageHealthy: !firstImage || (
              firstImage.getBoundingClientRect().width > 0 &&
              firstImage.getBoundingClientRect().height > 0 &&
              getComputedStyle(firstImage).objectFit === 'cover'
            ),
            imageNaturalWidth: firstImage ? firstImage.naturalWidth : null
          };
        });
        return {
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          sections
        };
      });

      assert.equal(state.pageOverflow, false, width + ': page-level horizontal overflow');
      for (const section of state.sections) {
        assert.equal(section.fullCards, expectedFullCards(width), width + ' ' + section.key + ': full-card count');
        assert(section.partialRatio >= 0.12 && section.partialRatio <= 0.18, width + ' ' + section.key + ': next-card peek ratio ' + section.partialRatio);
        assert.equal(section.scrollable, true, width + ' ' + section.key + ': viewport is scrollable');
        assert.equal(section.overflowX, 'auto', width + ' ' + section.key + ': horizontal overflow mode');
        assert.match(section.scrollSnapType, /^x mandatory$/, width + ' ' + section.key + ': snap type');
        assert.equal(section.firstSnapAlign, 'start', width + ' ' + section.key + ': card snap alignment');
        assert.equal(section.previousDisabled, true, width + ' ' + section.key + ': previous disabled initially');
        assert.equal(section.nextEnabled, true, width + ' ' + section.key + ': next enabled initially');
        assert.equal(section.arrowsVisible, width >= 768, width + ' ' + section.key + ': responsive arrows');
        assert.equal(section.viewAllColor, section.metadataColor, width + ' ' + section.key + ': View All metadata color');
        assert.equal(section.arrowColor, section.metadataColor, width + ' ' + section.key + ': arrow metadata color');
        assert.equal(section.arrowBorderColor, section.metadataColor, width + ' ' + section.key + ': arrow border metadata color');
        assert.equal(section.headerSingleLine, true, width + ' ' + section.key + ': header vertical alignment');
        assert.equal(section.headerClear, true, width + ' ' + section.key + ': controls clear heading');
        assert.equal(section.imageHealthy, true, width + ' ' + section.key + ': image health');
      }
      output.viewports.push({ width, ...state });

      if (width === 390 || width === 1440) {
        const saleSection = page.locator('#property-section-sale-title').locator('xpath=ancestor::section[1]');
        await saleSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await saleSection.screenshot({
          path: path.join(__dirname, width === 390 ? 'homepage-property-carousel-mobile.png' : 'homepage-property-carousel-desktop.png')
        });
      }
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => document.querySelector('#property-section-sale-viewport').scrollTo({ left: 0, behavior: 'auto' }));
    await page.waitForTimeout(200);
    const navigationBefore = await page.evaluate(() => {
      const viewport = document.querySelector('#property-section-sale-viewport');
      const track = document.querySelector('#property-section-sale-track');
      const card = track.querySelector('.property-card');
      return {
        left: viewport.scrollLeft,
        step: card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap)
      };
    });
    await page.getByRole('button', { name: 'Next properties for sale' }).click();
    await page.waitForTimeout(700);
    const navigationAfter = await page.evaluate(() => ({
      left: document.querySelector('#property-section-sale-viewport').scrollLeft,
      previousDisabled: document.querySelector('#property-section-sale-title').closest('.property-section').querySelector('[data-direction="-1"]').disabled
    }));
    assert(Math.abs((navigationAfter.left - navigationBefore.left) - navigationBefore.step) < 3, 'next moves exactly one card plus gap');
    assert.equal(navigationAfter.previousDisabled, false, 'previous becomes enabled after navigation');
    await page.evaluate(() => {
      const viewport = document.querySelector('#property-section-sale-viewport');
      viewport.scrollLeft = viewport.scrollWidth;
    });
    await page.waitForTimeout(300);
    const navigationEnd = await page.evaluate(() => {
      const section = document.querySelector('#property-section-sale-title').closest('.property-section');
      const next = section.querySelector('[data-direction="1"]');
      return { disabled: next.disabled, ariaDisabled: next.getAttribute('aria-disabled') };
    });
    assert.equal(navigationEnd.disabled, true, 'next is disabled at the end');
    assert.equal(navigationEnd.ariaDisabled, 'true', 'next exposes its disabled state');

    await page.evaluate(() => document.querySelector('#property-section-sale-viewport').scrollTo({ left: 0, behavior: 'auto' }));
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Next properties for sale' }).press('Enter');
    await page.waitForTimeout(700);
    const keyboardLeft = await page.evaluate(() => document.querySelector('#property-section-sale-viewport').scrollLeft);
    assert(Math.abs(keyboardLeft - navigationBefore.step) < 3, 'keyboard activation moves one card plus gap');
    output.navigation = { before: navigationBefore, after: navigationAfter, end: navigationEnd, keyboardLeft };

    await page.setViewportSize({ width: 390, height: 1000 });
    await page.evaluate(() => document.querySelector('#property-section-sale-viewport').scrollTo({ left: 0, behavior: 'auto' }));
    await page.waitForTimeout(200);
    const touchViewport = page.locator('#property-section-sale-viewport');
    const box = await touchViewport.boundingBox();
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.8, y: box.y + Math.min(160, box.height * 0.4) }] });
    for (let index = 1; index <= 6; index += 1) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (0.8 - index * 0.1), y: box.y + Math.min(160, box.height * 0.4) }] });
      await page.waitForTimeout(35);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(700);
    output.touch = await page.evaluate(() => {
      const viewport = document.querySelector('#property-section-sale-viewport');
      const track = document.querySelector('#property-section-sale-track');
      const card = track.querySelector('.property-card');
      const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
      return { scrollLeft: viewport.scrollLeft, step, snapped: Math.abs(viewport.scrollLeft / step - Math.round(viewport.scrollLeft / step)) < 0.03 };
    });
    assert(output.touch.scrollLeft > 10, 'touch swipe moves the carousel');
    assert.equal(output.touch.snapped, true, 'touch swipe settles at a card snap point');
    assert.deepEqual(output.consoleErrors, [], 'no carousel runtime errors');

    fs.writeFileSync(path.join(__dirname, 'homepage-property-carousel-results.json'), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
    console.log('PASS homepage property carousel QA');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
