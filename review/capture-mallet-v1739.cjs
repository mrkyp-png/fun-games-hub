// V1739 C: 게임 화면 뿅망치 확인
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/상점_새그림_시안/무기';
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
    await p.screenshot({ path: `${OUT}/게임_뿅망치_대기.png` });
    for (let i = 0; i < 3; i++) { const r = await p.evaluate(() => window.__debugHittableMoleRegion && window.__debugHittableMoleRegion()); if (r != null) await p.evaluate((r) => window.__debugHitCell(r), r); await new Promise((q) => setTimeout(q, 250)); await p.screenshot({ path: `${OUT}/게임_뿅망치_타격${i + 1}.png` }); await new Promise((q) => setTimeout(q, 2500)); }
    console.log('오류', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
