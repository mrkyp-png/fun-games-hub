// V1714 C: 성공 결과 화면(모히칸 점프·SUCCESS·뿌연 게임판) / 실패 결과 캡처
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/결과화면_시안';
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [tag, n] of [['성공', 30]]) {
      const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 12000));
      await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('easy', 1); });
      await new Promise(r => setTimeout(r, 13000));
      await p.evaluate((k) => { if (k) window.__debugPumpCombo(k); window.__debugEndRound(); }, n);
      await new Promise(r => setTimeout(r, 6000));
      await p.screenshot({ path: `${OUT}/게임_${tag}화면.png` });
      await new Promise(r => setTimeout(r, 4500));
      await p.screenshot({ path: `${OUT}/게임_${tag}_팝업.png` });
      console.log('popup', await p.evaluate(() => !!document.getElementById('win-choice')));
      await p.evaluate(() => { const b = document.querySelector('#win-choice .wc-next'); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 8000));
      await p.screenshot({ path: `${OUT}/게임_다음라운드.png` });
      console.log('after next: result hidden', await p.evaluate(() => document.getElementById('gameover-overlay').hidden), 'chapter', await p.evaluate(() => localStorage.getItem('mole.chapter')));
      console.log(tag, 'ERR', JSON.stringify(errs.slice(0, 2)), await p.evaluate(() => document.getElementById('gameover-reason').textContent));
      await p.close();
    }
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
