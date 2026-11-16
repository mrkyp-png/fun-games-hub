// 상점 화면 캡처 + 지정 위치에 겹친 요소 확인
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/상점색_비교';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
  await wait(15000);
  await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); window.__debugOpenMore('shop-screen'); });
  await wait(25000);
  await p.screenshot({ path: OUT + '/shop-screen.png' });
  await p.evaluate(() => { const t = document.querySelector('[data-shop-tabs] [data-tab="ticket"], [data-shop-tabs] button:nth-child(3)'); if (t) t.click(); });
  await wait(8000); await p.screenshot({ path: OUT + '/shop-ticket.png' });
  const info = await p.evaluate(() => [[8, 300], [195, 25], [195, 60]].map(([x, y]) => x + ',' + y + ': ' + document.elementsFromPoint(x, y).slice(0, 5).map((e) => e.tagName + '.' + (typeof e.className === 'string' ? e.className : '') + (e.id ? '#' + e.id : '')).join(' > ')));
  console.log(info.join('\n'));
  console.log(await p.evaluate(() => [...document.querySelectorAll('#more-menu, #more-menu *, #game-screen > *')].map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 330 && r.bottom > 360 && r.bottom < 480).map(({ e, r }) => (e.id || e.className) + ' ' + Math.round(r.top) + '~' + Math.round(r.bottom) + ' bg=' + getComputedStyle(e).backgroundColor + ' b4=' + getComputedStyle(e, '::before').content + '/' + getComputedStyle(e, '::before').backgroundColor).join('\n')));
  await b.close();
})();
