// V1722 C: '순서대로 잡아라' 실제 화면 검사 + 캡처 (기존 두더지팡도 한 판 돌려 오류 확인)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = 'C:/Users/master/Desktop/순서대로잡아라_V1722';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const log = [];
  try {
    const open = async () => {
      const p = await b.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(String(e)));
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await p.goto('http://localhost:8844/mole/index.html', { waitUntil: 'load' });
      await wait(12000);
      await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); localStorage.removeItem('mole.order.v1'); });
      return p;
    };
    // 한 번 정답을 치는 함수: 지금 제시어에 맞는 두더지 구멍을 누름
    const hit = (p, kind) => p.evaluate((kind) => {
      const o = window.__debugOrder(); if (!o || o.phase !== 'play') return 'wait';
      const c = o.mission.clues[o.mission.progress], OG = window.MoleGame.OrderGame;
      const ready = o.pops.filter((q) => !q.dying && q.hitAt < 0);
      const t = kind === 'good' ? ready.find((q) => q.traits.good) : kind === 'wrong' ? ready.find((q) => !q.traits.good && !OG.matches(q.traits, c)) : ready.find((q) => OG.matches(q.traits, c));
      if (!t) return 'none';
      const btn = document.querySelector('#lane-button-bar [data-region="' + t.regionId + '"]');
      if (!btn) return 'nobtn';
      const r = btn.getBoundingClientRect(), o2 = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      btn.dispatchEvent(new PointerEvent('pointerdown', o2)); btn.dispatchEvent(new PointerEvent('pointerup', o2));
      return 'ok';
    }, kind);

    // 1) 광장: 버튼 4개 + 라운드 선택 창
    let p = await open();
    await p.screenshot({ path: `${OUT}/1_광장.png` });
    await p.evaluate(() => window.__debugOrderSelect());
    await wait(800);
    await p.screenshot({ path: `${OUT}/2_라운드선택.png` });
    log.push('라운드 선택 창: ' + await p.evaluate(() => [...document.querySelectorAll('#order-select .os-round')].map((x) => x.disabled ? 'X' : 'O').join('')));
    await p.evaluate(() => { document.getElementById('order-select').remove(); const h = document.getElementById('home3d'); if (h) h.remove(); });

    // 2) 라운드 1~8: 시작 → 제시어 수·시간·16마리 확인, 1·6·8 은 캡처
    for (let n = 1; n <= 8; n++) {
      await p.evaluate((n) => { localStorage.setItem('mole.order.v1', JSON.stringify({ unlocked: 8, best: {} })); window.__debugStartOrder(n); }, n);
      await wait(n === 1 ? 16000 : 9000);
      let o = await p.evaluate(() => window.__debugOrder());
      for (let k = 0; k < 20 && (!o || o.phase !== 'play'); k++) { await wait(500); o = await p.evaluate(() => window.__debugOrder()); }
      log.push(`R${n}: 제시어 ${o.mission.clues.length}개, 두더지 ${o.pops.length}마리, 남은 시간 ${o.time.toFixed(0)}초, 하트 ${o.lives}`);
      if (n === 1 || n === 6 || n === 8) await p.screenshot({ path: `${OUT}/3_라운드${n}_시작.png` });
      if (n === 1) {
        // 정답 → 오답 → 착한 두더지 → 미션 성공까지
        let r = await hit(p, 'ok'); await wait(1500); let a = await p.evaluate(() => window.__debugOrder());
        log.push('정답 1번: ' + r + ' 진행도 ' + a.mission.progress + ' 점수 ' + a.stats.score);
        await p.screenshot({ path: `${OUT}/4_정답1번뒤.png` });
        r = await hit(p, 'wrong'); await wait(1500); a = await p.evaluate(() => window.__debugOrder());
        log.push('오답: ' + r + ' 진행도 ' + a.mission.progress + ' 하트 ' + a.lives + ' 오답수 ' + a.stats.wrong);
        r = await hit(p, 'good'); await wait(1500); a = await p.evaluate(() => window.__debugOrder());
        log.push('착한 두더지: ' + r + ' 하트 ' + a.lives + ' 진행도 ' + a.mission.progress);
        const firstClues = JSON.stringify(a.mission.clues);
        for (let k = 0; k < 40; k++) { const s = await p.evaluate(() => window.__debugOrder()); if (s.stats.missions >= 1) break; await hit(p, 'ok'); await wait(900); }
        a = await p.evaluate(() => window.__debugOrder());
        log.push('미션 성공 ' + a.stats.missions + '번, 점수 ' + a.stats.score + ', 재배치 단계 ' + a.phase);
        const blocked = await hit(p, 'ok');
        for (let k = 0; k < 60; k++) { await wait(1000); a = await p.evaluate(() => window.__debugOrder()); if (a.phase === 'play' && JSON.stringify(a.mission.clues) !== firstClues) break; } // 캡처 환경은 느려서 넉넉히 기다림
        log.push('재배치 중 입력: ' + blocked + ' / 새 제시어로 바뀜: ' + (JSON.stringify(a.mission.clues) !== firstClues) + ' / 16마리: ' + a.pops.length);
        await p.screenshot({ path: `${OUT}/5_새미션.png` });
      }
      await p.evaluate(() => document.getElementById('btn-back-to-hub').click());
      await wait(2500);
      await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.remove(); });
    }
    log.push('오류(1~8R): ' + JSON.stringify(p.errs.slice(0, 3)));
    await p.close();

    // 3) 결과 화면: 성공(목표 달성) / 실패(하트 0)
    p = await open();
    await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartOrder(1); });
    await wait(16000);
    for (let k = 0; k < 400; k++) { const s = await p.evaluate(() => window.__debugOrder()); if (!s || s.stats.score >= 2000) break; if (s.time < 30) await p.evaluate(() => window.__debugSetTimeRemaining(80)); await hit(p, 'ok'); await wait(700); }
    await p.evaluate(() => window.__debugSetTimeRemaining(0.5));
    await p.waitForSelector('#win-choice .wc-next', { timeout: 60000 }); // 성공 5초 뒤 창(느린 환경이라 뜰 때까지 기다림)
    await p.screenshot({ path: `${OUT}/6_결과_성공.png` });
    log.push('성공 결과: ' + await p.evaluate(() => document.getElementById('gameover-reason').textContent + ' | ' + document.getElementById('gameover-score').textContent + ' | ' + (document.getElementById('order-result') || {}).textContent + ' | 저장 ' + localStorage.getItem('mole.order.v1') + ' | 버튼 ' + [...document.querySelectorAll('#win-choice .wc-btn')].map((x) => x.textContent).join(',')));
    await p.evaluate(() => document.querySelector('#win-choice .wc-next').click());
    await wait(10000);
    let o = await p.evaluate(() => window.__debugOrder());
    log.push('다음 라운드 버튼 → R' + (o && o.round) + ' 제시어 ' + (o && o.mission.clues.length));
    for (let k = 0; k < 12; k++) { const s = await p.evaluate(() => window.__debugOrder()); if (!s || s.lives <= 0) break; await hit(p, 'good'); await wait(1600); }
    await p.waitForSelector('#win-choice .wc-retry', { timeout: 60000 });
    await p.screenshot({ path: `${OUT}/7_결과_실패.png` });
    log.push('실패 결과: ' + await p.evaluate(() => document.getElementById('gameover-reason').textContent + ' | ' + (document.getElementById('order-result') || {}).textContent + ' | 버튼 ' + [...document.querySelectorAll('#win-choice .wc-btn')].map((x) => x.textContent).join(',')));
    await p.evaluate(() => document.querySelector('#win-choice .wc-home').click());
    await wait(4000);
    log.push('홈 복귀 뒤 상태창 정리: ' + await p.evaluate(() => !document.getElementById('game-screen').classList.contains('gs-order') && !document.getElementById('order-result')));
    // 4) 기존 두더지팡 한 판(상태창·결과 화면이 그대로인지)
    await p.evaluate(() => { const h = document.getElementById('home3d'); if (h) h.remove(); window.__debugStartGame('mid', 2); });
    await wait(13000);
    await p.screenshot({ path: `${OUT}/8_기존_두더지팡.png` });
    log.push('기존 두더지팡: 두더지 ' + await p.evaluate(() => window.__debugGetActivePops().length) + ', 상태창 SCORE 줄 보임 ' + await p.evaluate(() => { const c = document.querySelector('#hud-trailing .ms-combo'); return !!c && getComputedStyle(c).display !== 'none' && !document.getElementById('order-clues'); }));
    await p.evaluate(() => { window.__debugPumpCombo(400); window.__debugEndRound(); });
    await wait(4000);
    await p.screenshot({ path: `${OUT}/9_기존_결과.png` });
    log.push('기존 결과: ' + await p.evaluate(() => document.getElementById('gameover-reason').textContent + ' | ' + document.getElementById('gameover-score').textContent));
    log.push('오류(결과·기존): ' + JSON.stringify(p.errs.slice(0, 3)));
    await p.close();
  } finally { await b.close(); console.log(log.join('\n')); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
