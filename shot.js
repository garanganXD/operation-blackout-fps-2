// screenshot via puppeteer-core + local chromium
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/opt/ms-playwright/chromium-1208/chrome-linux64/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
  const url = process.argv[2], out = process.argv[3], waitMs = +(process.argv[4] || 6000);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, waitMs));
  await page.screenshot({ path: out });
  await browser.close();
  console.log('SAVED', out);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
