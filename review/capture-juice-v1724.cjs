// V1724 C: 쥬스 두더지가 게임 안에서 나오는지 캡처(순서대로 잡아라 1라운드)
const puppeteer = require('puppeteer-core');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(), errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await wait(12000);
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartOrder(1); });
    for (let k = 0; k < 60; k++) { await wait(1000); const o = await p.evaluate(() => window.__debugOrder()); if (o && o.phase === 'play') break; }
    await wait(15000); // 느린 환경에서 자리 잡고 동작이 나올 때까지
    const o = await p.evaluate(() => window.__debugOrder());
    await p.screenshot({ path: 'C:/Users/master/Desktop/음료두더지_시안/게임화면_쥬스두더지.png' });
    console.log('쥬스 두더지 칸:', o.pops.filter((q) => q.traits.beh === 'drink').map((q) => q.regionId + 1).join(','), '| 제시어:', await p.evaluate(() => document.getElementById('order-clues').textContent), '| 오류:', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
