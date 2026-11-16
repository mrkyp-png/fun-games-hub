const puppeteer = require('puppeteer-core');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' }); await wait(12000);
  await p.evaluate(() => { document.getElementById('splash')?.remove(); document.getElementById('home3d')?.remove(); window.__debugStartOrder(1); });
  await wait(15000);
  console.log(await p.evaluate(() => { const t = document.querySelector('#btn-back-to-hub .hud-home-text'), gs = document.getElementById('game-screen'); return JSON.stringify({ cls: gs.className, fs: getComputedStyle(t).fontSize, parent: t.parentElement.parentElement.className, rules: [...document.styleSheets].filter((s) => /order-game/.test(s.href || '')).map((s) => [...s.cssRules].filter((r) => /hud-home/.test(r.cssText)).map((r) => r.cssText + ' MATCH=' + t.matches(r.selectorText))) }); }));
  await b.close();
})();
