// 상점 화면 캡처 + 지정 위치에 겹친 요소 확인
const puppeteer = require('puppeteer-core');
const OUT = 'C:/Users/master/Desktop/상점_새그림_시안/오리알';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
  await wait(15000);
  await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); window.__debugOpenMore('workshop-screen'); });
  await wait(25000);
  await p.screenshot({ path: OUT + '/workshop.png' });
  await p.evaluate(() => { const b = document.querySelector('[data-ws-go]'); if (b) b.click(); }); for (let i = 1; i <= 3; i++) { await wait(1500); await p.screenshot({ path: OUT + '/workshop_enhance' + i + '.png' }); }
  const info = await p.evaluate(() => [[8, 300], [195, 25], [195, 60]].map(([x, y]) => x + ',' + y + ': ' + document.elementsFromPoint(x, y).slice(0, 5).map((e) => e.tagName + '.' + (typeof e.className === 'string' ? e.className : '') + (e.id ? '#' + e.id : '')).join(' > ')));
  await b.close();
})();
