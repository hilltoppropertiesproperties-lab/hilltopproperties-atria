const { chromium } = require('C:/Users/Asus/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baseUrl = 'http://127.0.0.1:8765/index.html';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForDiscovery(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#listingMapHolder svg .listing-province-path');
  await page.waitForFunction(() => {
    const status = document.querySelector('#discoveryStatus');
    return status && !status.textContent.includes('Loading properties');
  }, null, { timeout: 30000 });
}

async function inspectDesktop(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForDiscovery(page);

  const visual = await page.evaluate(() => {
    const section = document.querySelector('.property-discovery');
    const inner = document.querySelector('.property-discovery__inner');
    const filter = document.querySelector('.discovery-filter');
    const map = document.querySelector('.discovery-map');
    const firstControl = document.querySelector('.discovery-control');
    const label = document.querySelector('label[for="discoveryLocation"]');
    const mapHolder = document.querySelector('#listingMapHolder');
    const sectionStyle = getComputedStyle(section);
    const bodyStyle = getComputedStyle(document.body);
    const innerRect = inner.getBoundingClientRect();
    const filterRect = filter.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const controlRect = firstControl.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    return {
      sectionBackground: sectionStyle.backgroundColor,
      bodyBackground: bodyStyle.backgroundColor,
      sectionWidth: section.getBoundingClientRect().width,
      innerLeft: innerRect.left,
      innerRight: innerRect.right,
      centeredDelta: Math.abs(innerRect.left - (innerWidth - innerRect.right)),
      columns: getComputedStyle(inner).gridTemplateColumns,
      filterLeft: filterRect.left,
      filterRight: filterRect.right,
      mapLeft: mapRect.left,
      filterBorder: getComputedStyle(filter).borderTopWidth,
      filterBackground: getComputedStyle(filter).backgroundColor,
      filterShadow: getComputedStyle(filter).boxShadow,
      controlHeight: controlRect.height,
      controlRadius: getComputedStyle(firstControl).borderRadius,
      controlBorder: getComputedStyle(firstControl).borderTopWidth,
      labelAboveControl: labelRect.bottom < controlRect.top,
      mapBorder: getComputedStyle(map).borderTopWidth,
      mapBackground: getComputedStyle(map).backgroundColor,
      mapShadow: getComputedStyle(map).boxShadow,
      mapText: mapHolder.textContent.trim(),
      provincePaths: mapHolder.querySelectorAll('.listing-province-path').length,
      provinceLabels: Array.from(mapHolder.querySelectorAll('.listing-map-label')).map((node) => node.textContent.trim()),
      status: document.querySelector('#discoveryStatus').textContent.trim(),
      count: document.querySelector('#discoveryCount').textContent.trim()
    };
  });

  assert(visual.sectionBackground !== visual.bodyBackground, 'Shared section background must differ from the page background.');
  assert(Math.abs(visual.sectionWidth - 1440) < 2, 'Shared section must span the viewport.');
  assert(visual.centeredDelta < 2, 'Filter and map composition must be centered.');
  assert(visual.filterRight < visual.mapLeft, 'Desktop filter must be left of the map.');
  assert(visual.filterBorder === '0px' && visual.filterBackground === 'rgba(0, 0, 0, 0)' && visual.filterShadow === 'none', 'Filter must not render as an independent card.');
  assert(visual.controlBorder === '1px' && visual.controlRadius === '2px' && visual.controlHeight >= 46 && visual.controlHeight <= 50, 'Controls must use the flat property-contact geometry.');
  assert(visual.labelAboveControl, 'Location label must sit above its field.');
  assert(visual.mapBorder === '0px' && visual.mapBackground === 'rgba(0, 0, 0, 0)' && visual.mapShadow === 'none', 'Map must be unframed.');
  assert(visual.provincePaths === 10 && visual.provinceLabels.length === 10, 'All ten interactive provinces and labels must remain.');
  assert(!/All Zambia|paintmaps/i.test(visual.mapText), 'Removed map-adjacent text must not render.');
  assert(visual.status.length > 0 && visual.count.length > 0, 'Dynamic result status and count must render.');

  await page.locator('.property-discovery').screenshot({
    path: path.join(root, '.codex-artifacts', 'property-discovery-redesign-desktop.png')
  });

  const rent = page.getByRole('button', { name: 'For Rent', exact: true });
  assert(await rent.count() === 1, 'For Rent toggle must be unique.');
  await rent.click();
  assert(await rent.getAttribute('aria-pressed') === 'true', 'For Rent toggle must update aria-pressed.');

  const optionCounts = {};
  for (const id of ['discoveryLocation', 'discoveryType', 'discoveryPrice']) {
    const select = page.locator(`#${id}`);
    optionCounts[id] = await select.locator('option').count();
    if (optionCounts[id] > 1) {
      await select.selectOption({ index: 1 });
      assert(await select.inputValue() !== (id === 'discoveryPrice' ? '' : 'all'), `${id} must accept a populated option.`);
    }
  }

  const firstProvince = page.locator('#listingMapHolder .listing-province-path').first();
  await firstProvince.click();
  assert(await firstProvince.getAttribute('aria-pressed') === 'true', 'Province click must preserve map interaction.');

  const search = page.getByRole('button', { name: 'Search Properties', exact: true });
  assert(await search.count() === 1, 'Search button must be unique.');
  await search.click();
  const interaction = await page.evaluate(() => ({
    activeElement: document.activeElement && document.activeElement.id,
    url: location.href,
    count: document.querySelector('#discoveryCount').textContent.trim(),
    status: document.querySelector('#discoveryStatus').textContent.trim()
  }));
  assert(interaction.activeElement === 'homePropertySections', 'Search must move focus to the results section.');

  return { visual, optionCounts, interaction };
}

async function inspectMobile(page) {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#listingMapHolder svg .listing-province-path');
  await page.waitForFunction(() => {
    const status = document.querySelector('#discoveryStatus');
    return status && !status.textContent.includes('Loading properties');
  }, null, { timeout: 30000 });
  const mobile = await page.evaluate(() => {
    const section = document.querySelector('.property-discovery');
    const inner = document.querySelector('.property-discovery__inner');
    const filter = document.querySelector('.discovery-filter');
    const map = document.querySelector('.discovery-map');
    const sectionRect = section.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const filterRect = filter.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    return {
      sectionWidth: sectionRect.width,
      innerWidth: innerRect.width,
      innerLeft: innerRect.left,
      filterWidth: filterRect.width,
      filterBottom: filterRect.bottom,
      mapTop: mapRect.top,
      sectionOverflow: section.scrollWidth - section.clientWidth,
      columns: getComputedStyle(inner).gridTemplateColumns
    };
  });
  assert(Math.abs(mobile.sectionWidth - 390) < 2, 'Mobile section background must remain full width.');
  assert(Math.abs(mobile.innerLeft - 16) < 2 && Math.abs(mobile.innerWidth - 358) < 2, 'Mobile content must use normal centered gutters.');
  assert(Math.abs(mobile.filterWidth - mobile.innerWidth) < 2, 'Mobile filter must use the full inner width.');
  assert(mobile.mapTop > mobile.filterBottom, 'Mobile map must stack beneath the filter.');
  assert(mobile.sectionOverflow <= 0, 'Mobile shared section must not overflow horizontally.');

  await page.locator('.property-discovery').screenshot({
    path: path.join(root, '.codex-artifacts', 'property-discovery-redesign-mobile.png')
  });
  return mobile;
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    const desktop = await inspectDesktop(page);
    const mobile = await inspectMobile(page);
    console.log(JSON.stringify({ pass: true, desktop, mobile, pageErrors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
