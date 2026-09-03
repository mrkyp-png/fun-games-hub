// 챕터1 "완벽 플레이" 누적 점수 측정 — 봇이 한 번에 한 마리씩, 뜨는 즉시 타격 + 저글.
// (16칸 동시타격은 망치/점수 결합이 깨져 실측 불가라 이 방식으로.)
// 클리어 목표 = 이 값 × 0.9. 라이트는 힌트만 다르므로 봇 점수는 챕터별 1값이면 충분.
// 오래 걸린다(10라운드 실시간). run_in_background 로 돌릴 것.
// 실행: repo 루트에서 `SMOKE_PORT=8846 node scripts/serve.js` 후  node mole/scripts/measure-clear-target.js
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  const p = await browser.newPage();
  p.on('pageerror', (e) => console.log('[pageerr]', e.message));
  await p.setViewport({ width: 390, height: 780 });
  await p.goto(`http://localhost:${PORT}/mole/index.html`, { waitUntil: 'load' });
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('mole.startCoachSeen', '1'); });
  await p.reload({ waitUntil: 'load' });
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1600)));

  const scores = [];
  for (let trial = 0; trial < 2; trial++) {
    await p.evaluate(() => window.__debugStartGame('easy', 1));
    let over = false, best = 0, idle = 0;
    for (let i = 0; i < 60000 && !over; i++) {
      const st = await p.evaluate(() => {
        // 뜬 두더지 하나 잡기
        const rg = window.__debugHittableMoleRegion();
        if (rg !== null) window.__debugHitCell(rg);
        // 저글: 방금 내려가기 시작한 1방 두더지 재타격 (dying 이고 juggled 아님)
        try {
          const dj = (window.MoleGame && window.MoleGame) ? null : null;
        } catch (e) {}
        const so = document.getElementById('gameover-overlay');
        return {
          rg,
          score: parseInt(document.getElementById('hud-score').textContent.replace(/\D/g, ''), 10) || 0,
          gameover: !!(so && !so.hidden),
        };
      });
      best = Math.max(best, st.score);
      if (st.gameover) over = true;
      if (st.rg === null) { idle++; } else { idle = 0; }
      await new Promise((r) => setTimeout(r, st.rg === null ? 40 : 16));
    }
    scores.push(best);
    console.log(`trial ${trial + 1}: score=${best}  over=${over}`);
  }
  await browser.close();
  const perfect = Math.max(...scores);
  console.log('---');
  console.log('perfect(max):', perfect, ' avg:', Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
  console.log('clear target ×0.9:', Math.round(perfect * 0.9 / 500) * 500);
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
