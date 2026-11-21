// V1787 C: 크라켄 바로 → 배 던지기 동작 연속 캡처(0.2초 간격)
const puppeteer = require('puppeteer-core'), fs = require('node:fs');
const OUT = process.argv[2];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: +(process.argv[3] || 390), height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:8844/mole/index.html?v=' + Date.now(), { waitUntil: 'load' });
  await wait(12000);
  await p.evaluate(() => { document.getElementById('splash')?.remove(); window.MoleGame.PangCannon.open({ onClose() {} }); });
  const click = (txt) => p.evaluate((txt) => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(txt) && x.offsetParent); if (el) el.click(); return !!el; }, txt);
  let ok = false;
  for (let s = 0; s < 120 && !ok; s++) { await wait(1000); ok = await click('라운드 선택'); }
  console.log('라운드 선택', ok, 'ERR', JSON.stringify(errs.slice(0, 5)));
  if (!ok) { await p.screenshot({ path: OUT + '/fail.png' }); await b.close(); return; }
  await wait(800);
  console.log('크라켄 바로', await click('크라켄 바로'));
  await wait(6000);
  for (let i = 0; i < 160; i++) { await p.screenshot({ path: OUT + '/f' + String(i).padStart(3, '0') + '.jpg', quality: 80 }); await wait(120); }
  console.log('ERR', JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
