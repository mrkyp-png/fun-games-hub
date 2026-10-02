// 리듬팡 버튼 = 홈 개편(v902) 뒤 넓은 보라 버튼(region 13 의 .lane-face--wide). 곡 2분(v948)이라 결과 대기 170초.
const puppeteer = require('C:/Users/master/Desktop/fun-games-hub/node_modules/puppeteer-core');
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844 });
  await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'networkidle0' });
  await W(1200); try { await p.click('#splash'); } catch (e) {} await W(400);
  await p.evaluate(() => { const x = document.querySelector('[id*="skip" i], [class*="skip" i]'); if (x) x.click(); }); await W(9000);
  const c = await p.evaluate(() => { const x = document.querySelector('#lane-button-bar [data-region="13"] .lane-face--wide'); const r = x.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(c.x, c.y); await W(1200);
  await p.evaluate((d) => document.querySelector('[data-rp-diff="' + d + '"]').click(), process.argv[2] || 'HARD'); await W(2000);
  await p.evaluate(() => { window.__bot = setInterval(() => { const d = window.__rhythm.dbg(); if (!d) return; d.notes.forEach((n) => { if (n.state === 'live' && !n.__p && n.targetTime - 0.21 - d.t <= 0.008) { n.__p = 1; window.__rhythm.press(n.targetLane); } }); }, 4); });
  for (let i = 0; i < 170; i++) { if (await p.evaluate(() => !document.querySelector('[data-rp-result]').hidden)) break; await W(1000); }
  console.log(process.argv[2], JSON.stringify(await p.evaluate(() => [document.querySelector('[data-rp-result]').className, ...['combo','perfect','great','good','miss'].map((k) => document.querySelector('[data-rp-res-' + k + ']').textContent)])), errs.slice(0, 3));
  await b.close();
})();
