// 3D 광장이 오류 없이 뜨는지(셰이더 컴파일 포함) 확인 + 광장 캡처
const puppeteer = require('puppeteer-core');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(), logs = [];
  p.on('console', (m) => { if (m.type() === 'error' || /shader|3D home/i.test(m.text())) logs.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => logs.push(String(e).slice(0, 300)));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
  await wait(30000);
  await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
  await wait(8000);
  await p.screenshot({ path: process.argv[2] });
  console.log('로그', JSON.stringify(logs.slice(0, 6)));
  await b.close();
})();
