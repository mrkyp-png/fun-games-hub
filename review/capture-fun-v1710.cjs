// V1710 C 재미 요소: 게임 시작 → 미션 안내·두더지 장면 캡처 + 페이지 오류 확인
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/재미요소_V1710';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 12000));
    await p.evaluate(() => { localStorage.setItem('mole.difficulty', 'mid'); const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('mid', 2); });
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, i ? 2500 : 4000));
      await p.screenshot({ path: `${OUT}/${i}.png` });
      const info = await p.evaluate(() => (window.__debugGetActivePops ? window.__debugGetActivePops() : []).map(q => (q.golden ? 'GOLD' : q.behavior || (q.good ? 'normal' : q.type))).join(','));
      console.log(i, info);
    }
    console.log('ERR', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
