// V1730 C: 순서대로 잡아라 성공 결과 창 위치·성공 두더지 배경 확인
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = 'C:/Users/master/Desktop/순서대로잡아라_결과';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const log = [];
  try {
    const open = async () => {
      const p = await b.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(String(e)));
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
      await wait(12000);
      await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); localStorage.removeItem('mole.order.v1'); });
      return p;
    };
    // 한 번 정답을 치는 함수: 지금 제시어에 맞는 두더지 구멍을 누름
    const hit = (p, kind) => p.evaluate((kind) => {
      const o = window.__debugOrder(); if (!o || o.phase !== 'play') return 'wait';
      const c = o.mission.clues[o.mission.progress], OG = window.MoleGame.OrderGame;
      const ready = o.pops.filter((q) => !q.dying && q.hitAt < 0);
      const t = kind === 'good' ? ready.find((q) => q.traits.good) : kind === 'wrong' ? ready.find((q) => !q.traits.good && !OG.matches(q.traits, c)) : ready.find((q) => OG.matches(q.traits, c));
      if (!t) return 'none';
      const btn = document.querySelector('#lane-button-bar [data-region="' + t.regionId + '"]');
      if (!btn) return 'nobtn';
      const r = btn.getBoundingClientRect(), o2 = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      btn.dispatchEvent(new PointerEvent('pointerdown', o2)); btn.dispatchEvent(new PointerEvent('pointerup', o2));
      return 'ok';
    }, kind);

    // 1) 광장: 버튼 4개 + 라운드 선택 창
    let p = await open();
    await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.remove(); localStorage.setItem('mole.order.v1', JSON.stringify({ unlocked: 8, best: {} })); window.__debugStartOrder(1); });
    for (let k = 0; k < 400; k++) { const s = await p.evaluate(() => window.__debugOrder()); if (s && s.stats.score >= 2000) break; if (s && s.time < 30) await p.evaluate(() => window.__debugSetTimeRemaining(80)); await hit(p, 'ok'); await wait(700); }
    await p.evaluate(() => window.__debugSetTimeRemaining(0.5));
    await p.waitForSelector('#win-choice .wc-next', { timeout: 90000 });
    await wait(3000);
    await p.screenshot({ path: OUT + '/결과_성공.png' });
    for (let i = 1; i <= 4; i++) { await wait(900); await p.screenshot({ path: OUT + '/결과_성공_' + i + '.png' }); }
    console.log('ok');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });