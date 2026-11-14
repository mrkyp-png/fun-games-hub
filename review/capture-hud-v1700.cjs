// 상단 전광판 캡처(세로 390x844)
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 8000));
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    await p.evaluate(() => window.__debugStartGame('easy', 2));
    await new Promise(r => setTimeout(r, 1500));
    await p.evaluate(() => window.__debugStartRound(6));
    for (let i = 0; i < 100; i++) { if (!(await p.evaluate(() => window.__debugIntroActive()))) break; await new Promise(r => setTimeout(r, 100)); }
    await new Promise(r => setTimeout(r, 2500));
    await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.style.display = 'none'; });
    await new Promise(r => setTimeout(r, 800));
    const box = await p.evaluate(() => { const r = document.getElementById('hud-panel').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await p.screenshot({ path: 'C:/Users/master/Desktop/상단전광판_V1700.png', clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: box.w + 12, height: box.h + 12 } });
    console.log('HUD_DONE', JSON.stringify(box));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
