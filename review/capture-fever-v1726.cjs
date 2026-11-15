// V1726 C: 피버타임 화면 캡처(사용자 보고: 피버타임 화면 깨짐)
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/피버타임_확인_V1726';
require('fs').mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(), errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await wait(12000);
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('easy', 2); });
    await wait(14000);
    await p.screenshot({ path: `${OUT}/0_게임.png` });
    // 콤보를 올리고 두더지를 하나 쳐서 피버 조건 확인이 돌게 함
    await p.evaluate(() => { window.__debugPumpCombo(10); const r = window.__debugHittableMoleRegion && window.__debugHittableMoleRegion(); if (r != null) window.__debugHitCell(r); });
    for (let i = 1; i <= 8; i++) {
      await wait(4000);
      const f = await p.evaluate(() => window.__debugGetFeverState && window.__debugGetFeverState());
      await p.screenshot({ path: `${OUT}/${i}_피버.png` });
      console.log(i, JSON.stringify(f));
    }
    console.log('오류', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
