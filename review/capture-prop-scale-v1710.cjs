// 나쁜 두더지 소품 크기 비교: 라이브(V1709, 지금 크기) vs 로컬(1.3배) — 게임 시작 후 여러 장 캡처
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/소품_1.3배_비교';
require('fs').mkdirSync(OUT, { recursive: true });
async function shoot(b, url, tag) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(url, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 12000));
  await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame && window.__debugStartGame('easy', 1); });
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, i ? 2500 : 9000));
    const pops = await p.evaluate(() => (window.__debugGetActivePops ? window.__debugGetActivePops() : []).map(q => q.behavior || (q.good ? 'normal' : '?')).join(','));
    await p.screenshot({ path: `${OUT}/${tag}_${i}.png` });
    console.log(tag, i, pops);
  }
  await p.close();
}
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    await shoot(b, 'https://mrkyp-png.github.io/fun-games-hub/mole/index.html?nocache=' + Date.now(), 'A_지금');
    await shoot(b, 'http://localhost:8844/mole/index.html', 'B_1.3배');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
