const { chromium } = require('C:/Users/Asus/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const seedPropertyId = 'e95bb8cc-a5a4-4837-9360-9c1108d16a16';
const browsers = [
  { name: 'Chrome', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  { name: 'Edge', executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }
];
const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLQAAAAAElFTkSuQmCC', 'base64');

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function createServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(root, `.${requestedPath}`);

    if (!filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }

    try {
      response.setHeader('Content-Type', contentTypes[path.extname(filePath)] || 'application/octet-stream');
      response.end(fs.readFileSync(filePath));
    } catch {
      response.writeHead(404).end();
    }
  });
}

async function loadPropertyPage(page, baseUrl) {
  await page.goto(`${baseUrl}/property-details.html?id=${seedPropertyId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.hilltopSupabase, null, { timeout: 15000 });
  const propertyId = await page.evaluate(async () => {
    const response = await window.hilltopSupabase
      .from('properties')
      .select('id, latitude, longitude')
      .in('status', ['Active', 'Under Offer'])
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1);

    if (response.error) throw new Error(response.error.message);
    if (!response.data || !response.data.length) throw new Error('No active property with coordinates is available for browser QA.');
    return response.data[0].id;
  });
  await page.goto(`${baseUrl}/property-details.html?id=${propertyId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.propertyLocationMap && !document.querySelector('#propertyLocationSection').classList.contains('hidden'), null, { timeout: 30000 });
  await page.waitForSelector('#propertyMap.leaflet-container');
}

async function centerMap(page) {
  await page.locator('#propertyMap').evaluate((element) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const top = window.scrollY + element.getBoundingClientRect().top - ((window.innerHeight - element.offsetHeight) / 2);
    window.scrollTo(0, top);
  });
  await page.waitForTimeout(250);
  const box = await page.locator('#propertyMap').boundingBox();
  if (!box) throw new Error('The property map has no visible bounding box.');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  return { box, point };
}

async function mapState(page) {
  return page.evaluate(() => ({
    zoom: window.propertyLocationMap.getZoom(),
    center: window.propertyLocationMap.getCenter(),
    scrollY: window.scrollY,
    wheelEnabled: window.propertyLocationMap.scrollWheelZoom.enabled(),
    draggingEnabled: window.propertyLocationMap.dragging.enabled(),
    touchZoomEnabled: window.propertyLocationMap.touchZoom.enabled(),
    markerCount: document.querySelectorAll('#propertyMap .leaflet-marker-icon').length,
    zoomInCount: document.querySelectorAll('#propertyMap .leaflet-control-zoom-in').length,
    zoomOutCount: document.querySelectorAll('#propertyMap .leaflet-control-zoom-out').length,
    tileUsesExistingProvider: Array.from(document.querySelectorAll('#propertyMap .leaflet-tile')).some((tile) => /openstreetmap\.fr\/hot/.test(tile.src))
  }));
}

async function runDesktop(browser, browserName, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/openstreetmap.fr/hot/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await loadPropertyPage(page, baseUrl);
  const initial = await mapState(page);
  let { point } = await centerMap(page);

  const normalBefore = await mapState(page);
  await page.mouse.wheel(0, 140);
  await page.waitForTimeout(250);
  const overlayVisible = await page.locator('#propertyMapInstruction').evaluate((element) => element.classList.contains('is-visible') && element.textContent.trim());
  if (browserName === 'Chrome') {
    await page.locator('.property-location-shell').screenshot({ path: path.join(__dirname, 'property-map-cooperative-overlay.png') });
  }
  let normalAfter = await mapState(page);
  if (normalAfter.scrollY === normalBefore.scrollY) {
    await page.mouse.wheel(0, 140);
    await page.waitForTimeout(250);
    normalAfter = await mapState(page);
  }
  await page.waitForTimeout(1700);
  const overlayHidden = await page.locator('#propertyMapInstruction').evaluate((element) => !element.classList.contains('is-visible'));

  ({ point } = await centerMap(page));
  const ctrlInBefore = await mapState(page);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForTimeout(350);
  const ctrlInAfter = await mapState(page);

  const ctrlOutBefore = await mapState(page);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Control');
  await page.waitForTimeout(350);
  const ctrlOutAfter = await mapState(page);

  ({ point } = await centerMap(page));
  const dragBefore = await mapState(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 120, point.y + 45, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const dragAfter = await mapState(page);

  const zoomControlBefore = await mapState(page);
  await page.locator('#propertyMap .leaflet-control-zoom-in').click();
  await page.waitForTimeout(350);
  const zoomControlIn = await mapState(page);
  await page.locator('#propertyMap .leaflet-control-zoom-out').click();
  await page.waitForTimeout(350);
  const zoomControlOut = await mapState(page);

  await centerMap(page);
  const flowBefore = await mapState(page);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(100);
  const flowAfterMap = await mapState(page);
  await page.mouse.move(1200, 850);
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(100);
  const contentFlow = await page.evaluate(() => ({
    scrollY: window.scrollY,
    contactTop: document.querySelector('#propertyContactSection').getBoundingClientRect().top,
    similarTop: document.querySelector('#similarSection').getBoundingClientRect().top
  }));

  const result = {
    browser: browserName,
    configuration: initial,
    normalWheel: {
      pass: normalAfter.scrollY > normalBefore.scrollY && normalAfter.zoom === normalBefore.zoom,
      scrollDelta: normalAfter.scrollY - normalBefore.scrollY,
      zoomBefore: normalBefore.zoom,
      zoomAfter: normalAfter.zoom,
      overlayVisible,
      overlayHidden
    },
    ctrlZoomIn: {
      pass: ctrlInAfter.zoom > ctrlInBefore.zoom && Math.abs(ctrlInAfter.scrollY - ctrlInBefore.scrollY) <= 2,
      zoomBefore: ctrlInBefore.zoom,
      zoomAfter: ctrlInAfter.zoom,
      scrollDelta: ctrlInAfter.scrollY - ctrlInBefore.scrollY
    },
    ctrlZoomOut: {
      pass: ctrlOutAfter.zoom < ctrlOutBefore.zoom && Math.abs(ctrlOutAfter.scrollY - ctrlOutBefore.scrollY) <= 2,
      zoomBefore: ctrlOutBefore.zoom,
      zoomAfter: ctrlOutAfter.zoom,
      scrollDelta: ctrlOutAfter.scrollY - ctrlOutBefore.scrollY
    },
    dragPan: {
      pass: dragAfter.center.lat !== dragBefore.center.lat || dragAfter.center.lng !== dragBefore.center.lng,
      centerBefore: dragBefore.center,
      centerAfter: dragAfter.center
    },
    zoomControls: {
      pass: zoomControlIn.zoom > zoomControlBefore.zoom && zoomControlOut.zoom < zoomControlIn.zoom,
      before: zoomControlBefore.zoom,
      afterPlus: zoomControlIn.zoom,
      afterMinus: zoomControlOut.zoom
    },
    contentFlow: {
      pass: flowAfterMap.scrollY > flowBefore.scrollY && flowAfterMap.zoom === flowBefore.zoom && contentFlow.scrollY > flowAfterMap.scrollY,
      mapWheelScrollDelta: flowAfterMap.scrollY - flowBefore.scrollY,
      zoomBefore: flowBefore.zoom,
      zoomAfter: flowAfterMap.zoom,
      final: contentFlow
    },
    consoleErrors
  };

  await context.close();
  return result;
}

async function runMobile(browser, width, height, baseUrl) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1
  });
  await context.route('**/openstreetmap.fr/hot/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await loadPropertyPage(page, baseUrl);
  const { point } = await centerMap(page);
  const before = await mapState(page);
  const touchAction = await page.locator('#propertyMap').evaluate((element) => getComputedStyle(element).touchAction);
  const client = await context.newCDPSession(page);
  const gesturePoint = {
    x: Math.min(width - 5, Math.max(5, Math.round(point.x))),
    y: Math.min(height - 5, Math.max(5, Math.round(point.y)))
  };
  await client.send('Input.synthesizeScrollGesture', {
    x: gesturePoint.x,
    y: gesturePoint.y,
    yDistance: -260,
    speed: 800,
    gestureSourceType: 'touch'
  });
  await page.waitForTimeout(500);
  let after = await mapState(page);
  if (after.scrollY === before.scrollY) {
    await client.send('Input.synthesizeScrollGesture', {
      x: gesturePoint.x,
      y: gesturePoint.y,
      yDistance: -260,
      speed: 500,
      gestureSourceType: 'touch'
    });
    await page.waitForTimeout(500);
    after = await mapState(page);
  }
  const zoomControlsUsable = await page.locator('#propertyMap .leaflet-control-zoom-in').isVisible()
    && await page.locator('#propertyMap .leaflet-control-zoom-out').isVisible();

  const result = {
    viewport: `${width}x${height}`,
    pass: after.scrollY > before.scrollY
      && after.zoom === before.zoom
      && after.center.lat === before.center.lat
      && after.center.lng === before.center.lng
      && !before.draggingEnabled
      && before.touchZoomEnabled
      && touchAction.includes('pan-y')
      && touchAction.includes('pinch-zoom')
      && zoomControlsUsable,
    scrollDelta: after.scrollY - before.scrollY,
    zoomBefore: before.zoom,
    zoomAfter: after.zoom,
    centerBefore: before.center,
    centerAfter: after.center,
    draggingEnabled: before.draggingEnabled,
    touchZoomEnabled: before.touchZoomEnabled,
    touchAction,
    zoomControlsUsable,
    consoleErrors
  };

  await context.close();
  return result;
}

(async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const results = { desktop: [], mobile: [], firefox: { available: false, note: 'Firefox is not installed on this machine.' } };

  try {
    for (const browserDefinition of browsers) {
      const browser = await chromium.launch({ executablePath: browserDefinition.executablePath, headless: true });
      try {
        results.desktop.push(await runDesktop(browser, browserDefinition.name, baseUrl));
        if (browserDefinition.name === 'Chrome') {
          for (const viewport of [[375, 667], [390, 844], [430, 932]]) {
            results.mobile.push(await runMobile(browser, viewport[0], viewport[1], baseUrl));
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }

  fs.writeFileSync(path.join(__dirname, 'property-map-cooperative-qa.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
