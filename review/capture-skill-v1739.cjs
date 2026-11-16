// V1739 C: 게임 화면 뿅망치 확인
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/상점_새그림_시안/무기';
require('fs').mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(), errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await wait(12000);
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('easy', 2); });
    await wait(14000);
    await new Promise((q) => setTimeout(q, 12000)); const tA = await p.evaluate(() => document.getElementById('hud-time') ? document.getElementById('hud-time').textContent : [...document.querySelectorAll('.ms-time .ms-val')].map((x) => x.textContent).join()); await p.evaluate(() => window.__debugAiOn && window.__debugAiOn(true)); await new Promise((q) => setTimeout(q, 2500)); const tB = await p.evaluate(() => [...document.querySelectorAll('.ms-time .ms-val')].map((x) => x.textContent).join()); console.log('timer', tA, '->', tB, 'src', await p.evaluate(() => [...document.scripts].map((x) => x.src).filter((x) => /game.js/.test(x)).join()));
    await p.screenshot({ path: `${OUT}/스킬_AI_대기.png` });
    console.log(await p.evaluate(() => { const bar = document.getElementById('lane-button-bar'); const b = bar ? [...bar.querySelectorAll('.lane-button')] : []; const st = window.__debugGetConfig ? '' : ''; return 'buttons=' + b.length + ' first inline=' + (b[0] ? b[0].getAttribute('style') : '-') + ' cap=' + (b[0] ? getComputedStyle(b[0]).getPropertyValue('--cap-top') : '-') + ' aiUntil-now=' + (window.__debugGetFeverState ? '' : ''); }));
    console.log(await p.evaluate(() => { const i = document.getElementById('invincible-countdown'), ir = i.getBoundingClientRect(); return 'inv hidden=' + i.hidden + ' text=' + i.textContent + ' rect ' + Math.round(ir.left) + ',' + Math.round(ir.top) + ' ' + Math.round(ir.width) + 'x' + Math.round(ir.height) + ' parent=' + i.parentElement.id + ' vis=' + getComputedStyle(i).visibility + ' disp=' + getComputedStyle(i).display; }));
    console.log(await p.evaluate(() => { const e = document.getElementById('ai-countdown'); const r = e.getBoundingClientRect(); return 'ai hidden=' + e.hidden + ' text=' + e.textContent + ' rect ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' parent=' + e.parentElement.id + ' z=' + getComputedStyle(e).zIndex + ' vis=' + getComputedStyle(e).visibility + ' op=' + getComputedStyle(e).opacity + ' top=' + document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).slice(0, 4).map((x) => x.id || x.className).join(' > '); }));
    console.log(await p.evaluate(() => ['#mole-hammer-layer','#mole-board','#hud-panel','.clay-mole-canvas--world','#lane-button-bar','.lane-boxing-glove'].map((q) => { const e = document.querySelector(q); if (!e) return q + ' 없음'; const cs = getComputedStyle(e); return q + ' z=' + cs.zIndex + ' parent=' + (e.parentElement.id || e.parentElement.className); }).join(' || ')));
    for (let i = 0; i < 3; i++) { const r = await p.evaluate(() => window.__debugHittableMoleRegion && window.__debugHittableMoleRegion()); if (r != null) await p.evaluate((r) => window.__debugHitCell(r), r); await new Promise((q) => setTimeout(q, 250)); await p.screenshot({ path: `${OUT}/스킬_AI_타격${i + 1}.png` }); await new Promise((q) => setTimeout(q, 2500)); }
    console.log('오류', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
