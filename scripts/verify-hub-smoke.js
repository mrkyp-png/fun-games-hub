const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });

    // 1) 탭 4개 + 홈이 기본
    assert.strictEqual((await page.$$('#tab-bar .fgh-tab')).length, 4, '4 tabs render');
    assert.strictEqual(await page.evaluate(() => document.getElementById('home-screen').hidden), false, 'home visible by default');
    assert.strictEqual(await page.evaluate(() => document.getElementById('score-screen').hidden), true, 'score hidden by default');

    // 2) 게임 카드 4개
    assert.strictEqual((await page.$$('#home-screen .theme-card')).length, 4, '4 game cards on home');

    // 3) 탭 전환
    await page.click('#tab-bar .fgh-tab[data-tab="shop"]');
    assert.strictEqual(await page.evaluate(() => document.getElementById('shop-screen').hidden), false, 'shop shows on tab click');
    assert.strictEqual(await page.evaluate(() => document.getElementById('home-screen').hidden), true, 'home hides');
    await page.click('#tab-bar .fgh-tab[data-tab="home"]');

    // 4) 설정 UI 주입됨 + 진동 토글 저장/복원
    await page.click('#fgh-settings-btn');
    await page.click('.fgh-set-row[data-set="music"] .fgh-set-toggle');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('musicOn')), '1', 'music toggled on');
    await page.reload({ waitUntil: 'load' });
    await page.click('#fgh-settings-btn');
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('.fgh-set-row[data-set="music"] .fgh-set-toggle').getAttribute('aria-pressed')),
      'true', 'music toggle restored after reload');
    await page.click('#fgh-settings-close');

    // 5) 언어 전환 → 탭 라벨 영어 + 유지
    await page.click('#fgh-lang-btn');
    await page.click('#fgh-lang-menu [data-lang="en"]');
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('#tab-bar .fgh-tab[data-tab="score"] .fgh-tab-lbl').textContent),
      'Score', 'tab label localized to en');
    await page.reload({ waitUntil: 'load' });
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('#tab-bar .fgh-tab[data-tab="score"] .fgh-tab-lbl').textContent),
      'Score', 'language persists after reload');

    // 정리 — 다음 실행이 ko 로 시작하도록
    await page.evaluate(() => localStorage.clear());

    console.log('verify-hub-smoke.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
