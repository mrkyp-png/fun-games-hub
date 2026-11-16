// V1725 C: 게임 안 콜라 두더지 확대 캡처(한국어 '콜라' / 영어 'COLA')
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/콜라두더지_시안';
require('fs').mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const lang of ['ko']) {
      const p = await b.newPage(), errs = []; p.on('pageerror', (e) => errs.push(String(e)));
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
      await wait(12000);
      await p.evaluate((lang) => { window.FGH.I18N.setLang(lang); const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); }, lang);
      let cell = -1;
      for (let tries = 0; tries < 4 && cell < 0; tries++) {
        await p.evaluate(() => window.__debugStartOrder(1));
        for (let k = 0; k < 60; k++) { await wait(1000); const o = await p.evaluate(() => window.__debugOrder()); if (o && o.phase === 'play') { const c = o.pops.find((q) => q.traits.beh === 'drink'); cell = c ? c.regionId : -2; break; } }
        if (cell < 0) { await p.evaluate(() => document.getElementById('btn-back-to-hub').click()); await wait(3000); await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.remove(); }); cell = -1; }
      }
      if (cell < 0) { console.log(lang, '콜라 두더지 없음'); await p.close(); continue; }
      const box = await p.evaluate((c) => { const r = document.querySelector('#mole-board .checkerboard-cell[data-region="' + c + '"]').getBoundingClientRect(); return { x: r.left - r.width * 0.35, y: r.top - r.height * 0.6, width: r.width * 1.7, height: r.height * 1.75 }; }, cell);
      box.x = Math.max(0, box.x); box.y = Math.max(0, box.y);
      for (let i = 0; i < 4; i++) { await wait(4000); await p.screenshot({ path: `${OUT}/게임_${lang}_${i + 1}.png`, clip: box }); }
      console.log(lang, '칸', cell + 1, '제시어', await p.evaluate(() => document.getElementById('order-clues').textContent), '오류', JSON.stringify(errs.slice(0, 2)));
      await p.close();
    }
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
