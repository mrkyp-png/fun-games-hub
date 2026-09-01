const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/common/scripts/fixture.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });

    // 1) 버튼 2개 주입
    assert.ok(await page.$('#fgh-lang-btn'), 'lang button injected');
    assert.ok(await page.$('#fgh-settings-btn'), 'settings button injected');

    // 2) 멱등 — 다시 mount 해도 하나뿐
    await page.evaluate(() => FGH.SettingsUI.mount());
    assert.strictEqual((await page.$$('#fgh-settings-btn')).length, 1, 'mount is idempotent');

    // 3) 설정 모달 열기 → 진동 토글 off → localStorage 반영
    await page.click('#fgh-settings-btn');
    assert.strictEqual(await page.evaluate(() => document.getElementById('fgh-settings-modal').hidden), false, 'modal opens');
    await page.click('.fgh-set-row[data-set="vibration"] .fgh-set-toggle');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('vibrationOn')), '0', 'vibration toggled off');
    await page.click('#fgh-settings-close');
    assert.strictEqual(await page.evaluate(() => document.getElementById('fgh-settings-modal').hidden), true, 'modal closes');

    // 4) 언어 메뉴 → English → appLang + 모달 제목 번역
    await page.click('#fgh-lang-btn');
    await page.click('#fgh-lang-menu [data-lang="en"]');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('appLang')), 'en', 'lang switched to en');
    await page.click('#fgh-settings-btn');
    const title = await page.evaluate(() => document.querySelector('#fgh-settings-modal [data-i18n="settings.title"]').textContent);
    assert.strictEqual(title, 'Settings', 'modal title re-localized to en');

    await page.evaluate(() => localStorage.clear());
    console.log('verify-settings-ui-smoke.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
