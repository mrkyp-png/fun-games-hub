// 3D 홈에서 섬이 보이는지 캡처(높이 올라간 시점 + 기본 시점)
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 15000));
    await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    await new Promise(r => setTimeout(r, 6000));
    await p.screenshot({ path: 'C:/Users/master/Desktop/동서남북_섬_시안/게임_기본시점.png' });
    const hooks = await p.evaluate(() => Object.keys(window).filter(k => /home3d|Home3D|__debug.*(fly|cam|home)/i.test(k)).slice(0, 20));
    console.log('HOOKS', JSON.stringify(hooks), 'ERR', JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
