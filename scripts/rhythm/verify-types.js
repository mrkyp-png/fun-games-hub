// 실행: node scripts/rhythm/verify-types.js (로컬 서버 :8844 필요)
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:8844/mole/index.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#splash.is-ready');
    await page.click('#splash');
    await page.waitForFunction(() => !document.querySelector('#splash'));
    await page.waitForSelector('.intro-skip');
    await page.click('.intro-skip');
    await new Promise(r => setTimeout(r, 14000));
    const home = '#lane-button-bar [data-region="13"] .lane-face--wide';
    await page.waitForSelector(home);
    await page.click(home);
    await page.waitForSelector('[data-rp-types]:not([hidden])');
    assert.equal(await page.$eval('[data-rp-select]', el => el.hidden), true);
    await page.click('[data-rp-type="B"]');
    await page.waitForSelector('[data-rp-b]:not([hidden])');
    assert.equal(await page.evaluate(() => window.__rhythm.dbg()), null);
    assert.equal(await page.$$eval('.rb-circuit', els => els.length), 18);
    await page.evaluate(() => window.__rhythm.open()); // 정적 B 시안 확인 후 A 회귀 검사
    await page.waitForSelector('[data-rp-types]:not([hidden])');
    for (const [width, height] of [[390, 844], [844, 390], [1280, 800]]) {
      await page.setViewport({ width, height });
      assert.equal(await page.$$eval('[data-rp-types] button', buttons => buttons.every(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      })), true, `button bounds ${width}x${height}`);
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.click('[data-rp-type="A"]');
    await page.waitForSelector('[data-rp-select]:not([hidden])');
    assert.equal(await page.$$eval('[data-rp-diff]', els => els.length), 3);
    await page.click('[data-rp-diff="EASY"]');
    await page.waitForFunction(() => window.__rhythm.dbg() !== null, { timeout: 15000 });
    await page.click('[data-rp-pausebtn]');
    await page.waitForSelector('[data-rp-pause]:not([hidden])');
    await page.click('[data-rp-quit]');
    await page.waitForSelector('#rhythm-screen[hidden]');
    await page.click(home);
    await page.waitForSelector('[data-rp-types]:not([hidden])');
    await page.click('[data-rp-types-home]');
    await page.waitForSelector('#rhythm-screen[hidden]');
    assert.deepEqual(errors, []);
    console.log('PASS: home → types; B static skeleton + 9 circuits; A → difficulties → EASY → pause → quit; reopen → types → home; three viewport sizes; no page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
