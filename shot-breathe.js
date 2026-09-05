const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: false,
    args: ['--window-size=430,932']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 850 });
  await page.goto('http://localhost:8845/mole/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  async function readTransform() {
    return page.evaluate(() => getComputedStyle(document.querySelector('#btn-back-to-hub svg')).transform);
  }
  const t0 = await readTransform();
  await new Promise(r => setTimeout(r, 450)); // ~1/4 cycle of 1.8s
  const t1 = await readTransform();
  await new Promise(r => setTimeout(r, 450)); // ~1/2 cycle
  const t2 = await readTransform();
  console.log('home t0:', t0);
  console.log('home t1:', t1);
  console.log('home t2:', t2);

  // capture a frame mid-shrink for visual proof (force via inline style at min scale)
  await page.evaluate(() => {
    const svg = document.querySelector('#btn-back-to-hub svg');
    svg.style.animation = 'none';
    svg.style.transform = 'scale(0.5)';
  });
  const btn = await page.$('#btn-back-to-hub');
  const box = await btn.boundingBox();
  const pad = 25;
  await page.screenshot({
    path: 'C:/Users/master/Desktop/두더지팡_홈버튼_숨쉬기_최소.png',
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }
  });
  await page.evaluate(() => {
    const svg = document.querySelector('#btn-back-to-hub svg');
    svg.style.transform = 'scale(1)';
  });
  await page.screenshot({
    path: 'C:/Users/master/Desktop/두더지팡_홈버튼_숨쉬기_최대.png',
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }
  });

  // sanity: confirm it does NOT animate while playing
  await page.evaluate(() => { const svg = document.querySelector('#btn-back-to-hub svg'); svg.style.animation = ''; svg.style.transform = ''; });
  const startBtn = await page.$('#lane-button-bar .lane-button--call');
  await startBtn.click();
  await new Promise(r => setTimeout(r, 500));
  const p0 = await readTransform();
  await new Promise(r => setTimeout(r, 900));
  const p1 = await readTransform();
  console.log('playing p0:', p0);
  console.log('playing p1:', p1, '(should equal p0 - no animation while playing)');

  await browser.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
