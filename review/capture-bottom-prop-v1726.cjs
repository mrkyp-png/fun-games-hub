// V1726 C: 맨 아래 줄 콜라 두더지 병이 버튼판 앞에 보이는지 + 두더지·구멍 자리 어긋남 없는지
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/피버타임_확인_V1726';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(), errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await wait(12000);
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); });
    let cell = -1;
    for (let tries = 0; tries < 8 && cell < 0; tries++) {
      await p.evaluate(() => window.__debugStartOrder(1));
      for (let k = 0; k < 60; k++) { await wait(1000); const o = await p.evaluate(() => window.__debugOrder()); if (o && o.phase === 'play') { const c = o.pops.find((q) => q.traits.beh === 'drink' && q.regionId >= 12); cell = c ? c.regionId : -1; break; } }
      if (cell < 0) { await p.evaluate(() => document.getElementById('btn-back-to-hub').click()); await wait(3000); await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.remove(); }); }
    }
    console.log('맨 아래 줄 콜라 칸', cell + 1);
    for (let i = 0; i < 3; i++) { await wait(7000); await p.screenshot({ path: `${OUT}/아래줄_콜라_${i + 1}.png` }); }
    console.log('오류', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
