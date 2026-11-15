// 타격 위치를 주면 그 칸만 흔들리고 판 전체는 안 흔들리는지(V1710 C)
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 12000));
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('easy', 1); });
    await new Promise(r => setTimeout(r, 1500)); await p.screenshot({ path: 'C:/Users/master/Desktop/재미요소_V1710/미션창.png' }); await new Promise(r => setTimeout(r, 13000));
    const res = await p.evaluate(async () => {
      const board = document.getElementById('mole-board'), MG = window.MoleGame;
      const seen = []; const orig = Element.prototype.animate; Element.prototype.animate = function (...a) { seen.push(this.id === 'mole-board' ? 'BOARD' : this.className === 'checkerboard-cell-art' ? 'ART' + this.parentElement.dataset.region : (this.dataset && this.dataset.region) || this.className); return orig.apply(this, a); };
      const out = {}; const br = board.getBoundingClientRect(); const cs = [...board.querySelectorAll('.checkerboard-cell')]; out.n = cs.length; out.fx = MG.HitFx.shake.toString().slice(0, 60); out.clay = MG.ClayRoundOne.shakeBoard.toString().slice(0, 50); out.board = [br.left, br.top, br.width, br.height].map(Math.round); out.c = cs.slice(0, 2).map(c => { const q = c.getBoundingClientRect(); return [c.dataset.region, q.left, q.top, q.width, q.height].map(v => Math.round(v)); });
      MG.HitFx.shake(board, 0.5, 0.3);
      await new Promise(r => setTimeout(r, 1500));
      out.hit = seen.splice(0);
      MG.HitFx.shake(board);
      await new Promise(r => setTimeout(r, 1500));
      out.quake = seen.splice(0);
      return out;
    });
    console.log(JSON.stringify(res), 'ERR', JSON.stringify(errs.slice(0, 2)));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
