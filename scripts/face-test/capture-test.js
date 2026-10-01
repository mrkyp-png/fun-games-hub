const puppeteer = require('C:/Users/master/Desktop/fun-games-hub/node_modules/puppeteer-core');
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const SP = __dirname.split(String.fromCharCode(92)).join('/') + '/'; // face.y4m 은 이 폴더에(README 참고, 저장소엔 올리지 않음)
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + SP + 'face.y4m'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'networkidle0' });
  await W(1200); try { await p.click('#splash'); } catch (e) {} await W(400);
  await p.evaluate(() => { const x = document.querySelector('[id*="skip" i], [class*="skip" i]'); if (x) x.click(); }); await W(4000);
  await p.evaluate(() => { document.getElementById('face-studio').hidden = false; document.querySelector('[data-ws-photo]').click(); });
  await W(800); await p.evaluate(() => document.querySelector('[data-fs-agree]').click()); const cdp = await p.target().createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const res = [];
  for (let trial = 0; trial < 5; trial++) {
    // 촬영 가능 상태 대기
    let ok = false;
    for (let i = 0; i < 200; i++) { ok = await p.evaluate(() => !document.querySelector('[data-fs-shutter]').disabled); if (ok) break; await W(100); }
    if (!ok) { res.push(await p.evaluate(() => [document.querySelector('[data-fs-hint]').textContent, document.querySelector('[data-fs-video]').videoWidth, typeof FaceMesh])); await p.screenshot({ path: 'fsdbg.png' }); break; }
    await W(Math.random() * 300); // 실시간 인식과 겹치는 순간을 랜덤하게
    await p.evaluate(() => document.querySelector('[data-fs-shutter]').click());
    let r = 'pending';
    for (let i = 0; i < 100; i++) {
      r = await p.evaluate(() => { const s3 = document.querySelector('[data-fs-screen~="3"]'); const t = document.querySelector('[data-fs-toast]');
        if (s3 && !s3.hidden) return 'next'; if (t && !t.hidden && /다시|again/i.test(t.textContent)) return 'retake'; return 'pending'; });
      if (r !== 'pending') break; await W(100);
    }
    res.push(r);
    if (r === 'next') { await p.evaluate(() => document.querySelector('[data-fs-back]').click()); await W(800); }
    else await W(2200);
  }
  console.log(process.argv[2], JSON.stringify(res), errs.slice(0, 2));
  await b.close();
})();
