// 게임판 시인성 비교 캡처(현재 / 배경 투명 50% / 배경 어둡게 75%) — 6라운드(색깔 두더지 등장)
const puppeteer = require('puppeteer-core'), fs = require('fs');
const OUT = 'C:/Users/master/Desktop/게임판_시인성_비교';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 8000));
    const st = await p.evaluate(() => ({ splash: !!document.getElementById('splash'), splashText: (document.getElementById('splash') || {}).innerText || '', hooks: typeof window.__debugStartGame, build: (document.getElementById('build-tag') || {}).textContent }));
    console.log('STATE', JSON.stringify(st).slice(0, 400));
    await p.screenshot({ path: OUT + '/0_loading.png' });
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    await p.evaluate(() => window.__debugStartGame('easy', 2));
    await new Promise(r => setTimeout(r, 1500));
    await p.evaluate(() => window.__debugStartRound(6));
    for (let i = 0; i < 100; i++) { if (!(await p.evaluate(() => window.__debugIntroActive()))) break; await new Promise(r => setTimeout(r, 100)); }
    await new Promise(r => setTimeout(r, 4500));
    await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.style.display = 'none'; });
    await new Promise(r => setTimeout(r, 1500));
    const info = await p.evaluate(() => {
      const board = document.getElementById('mole-board'), gs = document.getElementById('game-screen');
      const kids = el => Array.from(el.children).map(c => c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + (c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\s+/).join('.') : ''));
      return { game: kids(gs), board: board ? kids(board).slice(0, 20) : null, pops: document.querySelectorAll('#mole-pop-layer .mole-pop').length };
    });
    fs.writeFileSync(OUT + '/dom.json', JSON.stringify(info, null, 1));
    await p.screenshot({ path: OUT + '/1_새규칙_배경그대로.png' });
    // 배경 칸만 덮는 막(구멍·버튼 자리는 뚫음). 시안 비교용 — 게임 코드 변경 아님
    const addVeil = (mode) => p.evaluate((mode) => {
      document.querySelectorAll('.contrast-veil').forEach(e => e.remove());
      const gs = document.getElementById('game-screen'), canvas = gs.querySelector('canvas.clay-mole-canvas');
      for (const [sel, holes] of [['#mole-board', 'hole'], ['.dialpad', 'button']]) {
        const el = document.querySelector(sel); if (!el) continue; const r = el.getBoundingClientRect(), g = gs.getBoundingClientRect();
        const v = document.createElement('div'); v.className = 'contrast-veil';
        Object.assign(v.style, { position: 'absolute', left: (r.left - g.left) + 'px', top: (r.top - g.top) + 'px', width: r.width + 'px', height: r.height + 'px', pointerEvents: 'none', zIndex: 5,
          background: mode === 'fade70' ? 'rgba(255,255,255,.7)' : mode === 'fade' ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.25)' });
        const masks = [];
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
          const cx = (col + .5) * 25, cy = holes === 'hole' ? (row + .55) * 25 : (row + .5) * 25;
          const sz = holes === 'hole' ? (r.width / 4 * .49) + 'px ' + (r.height / 4 * .33) + 'px' : (r.width / 4 * .48) + 'px ' + (r.width / 4 * .48) + 'px';
          masks.push(`radial-gradient(${sz} at ${cx}% ${cy}%, transparent 94%, #000 100%)`);
        }
        v.style.maskImage = masks.join(','); v.style.webkitMaskImage = masks.join(','); v.style.maskComposite = 'intersect'; v.style.webkitMaskComposite = 'source-in';
        gs.insertBefore(v, canvas);
      }
    }, mode);
    await addVeil('fade70'); await new Promise(r => setTimeout(r, 300)); await p.screenshot({ path: OUT + '/4_배경투명70_새규칙.png' });
    console.log('CAP_DONE', JSON.stringify(info).slice(0, 1500));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
