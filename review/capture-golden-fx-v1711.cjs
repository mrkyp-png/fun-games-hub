// V1711 C: 황금 두더지 반짝임 모양 확인 — 게임 중 칸 하나에 같은 요소를 띄워 캡처
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 12000));
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('mid', 2); });
    await new Promise(r => setTimeout(r, 14000));
    await p.evaluate(() => {
      const board = document.getElementById('mole-board'), q = window.__debugGetActivePops().find((q) => q.type === 'mole'), id = q ? q.regionId : 5, pop = { x: (id % 4 + .5) / 4, y: (Math.floor(id / 4) + .5) / 4 };
      const d = document.createElement('div'); d.className = 'hit-fx-golden'; d.style.left = pop.x * 100 + '%'; d.style.top = pop.y * 100 + '%'; d.style.setProperty('--g', 4);
      d.innerHTML = '<i></i><b>✦</b><b>✧</b><b>✦</b><b>✧</b><b>✦</b>'; board.appendChild(d);
    });
    await new Promise(r => setTimeout(r, 1500));
    await p.screenshot({ path: 'C:/Users/master/Desktop/재미요소_V1710/황금반짝임.png' });
    console.log('ERR', JSON.stringify(errs.slice(0, 2)));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
