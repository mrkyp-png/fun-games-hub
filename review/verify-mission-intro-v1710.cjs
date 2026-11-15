// V1710 C: 라운드 시작 → 카운트다운 전에 미션 창(#mission-intro)이 3초 뜨는지, 그 동안 카운트다운이 안 나오는지
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', (m) => { if (m.text().startsWith('DBG')) console.log(m.text()); });
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 12000));
    const ch = Number(process.argv[2] || 3);
    await p.evaluate((c) => { const s = document.getElementById('splash'); if (s) s.remove(); const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('mid', c); }, ch);
    const log = [];
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 500));
      const s = await p.evaluate(() => { const m = document.getElementById('mission-intro'); const c = document.querySelector('.round-intro-count'); return (m ? 'M:' + m.innerText.replace(/\s+/g, ' ') : '-') + ' | count:' + (c && !c.hidden ? c.textContent : '-'); });
      log.push((i + 1) * 0.5 + 's ' + s);
      if (i === 3) await p.screenshot({ path: 'C:/Users/master/Desktop/재미요소_V1710/미션창.png' });
    }
    console.log(log.join('\n')); console.log('ERR', JSON.stringify(errs.slice(0, 2)));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
