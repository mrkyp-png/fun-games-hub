// V1365 C 리듬팡 판정·동기화 자동 테스트 (네온 B + 비치 A). 실제 게임 화면을 띄우고 오디오 시계(currentTime)만 멈춰 원하는 시각에 누른다.
//   node scripts/serve.js (PORT=8846) 가 떠 있어야 함 →  node scripts/rhythm/verify-judge-sync.js
const puppeteer = require('puppeteer-core');
const URL = process.env.URL || 'http://localhost:8846/mole/index.html';
const W = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const p = await browser.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    // 오디오 시계 제어: __clk.freeze 에 값이 있으면 currentTime 이 그 값으로 고정, __clk.lat 은 출력 지연 가짜값
    await p.evaluateOnNewDocument(() => {
      window.__clk = { freeze: null, lat: null };
      const B = window.BaseAudioContext || window.AudioContext, d = Object.getOwnPropertyDescriptor(B.prototype, 'currentTime');
      Object.defineProperty(B.prototype, 'currentTime', { configurable: true, get() { return window.__clk.freeze != null ? window.__clk.freeze : d.get.call(this); } });
      const A = window.AudioContext.prototype, o = Object.getOwnPropertyDescriptor(A, 'outputLatency');
      Object.defineProperty(A, 'outputLatency', { configurable: true, get() { return window.__clk.lat != null ? window.__clk.lat : (o ? o.get.call(this) : 0); } });
      let hidden = false; Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      window.__setHidden = v => { hidden = v; document.dispatchEvent(new Event('visibilitychange')); };
    });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForSelector('#splash.is-ready', { timeout: 60000 }).catch(() => {}); await W(300);
    for (let i = 0; i < 10 && await p.$('#splash'); i++) { await p.mouse.click(195, 680); await W(800); }
    await p.evaluate(() => { const x = document.querySelector('.intro-skip'); if (x) x.click(); }); await W(2500);

    // ---------- 공통 규칙 ----------
    const rules = await p.evaluate(() => {
      const R = MoleGame.Rhythm.rules, out = {};
      localStorage.removeItem('mole.rp.offsetMs');
      out.lat0 = R.latency({ outputLatency: 0.1 }); out.latBase = R.latency({ outputLatency: 0, baseLatency: 0.02 }); out.latCap = R.latency({ outputLatency: 2 });
      localStorage.setItem('mole.rp.offsetMs', '30'); out.latUser = R.latency({ outputLatency: 0.1 });
      localStorage.setItem('mole.rp.offsetMs', '-999'); out.latUserCap = R.latency({ outputLatency: 0.1 });
      localStorage.removeItem('mole.rp.offsetMs');
      out.lagNow = R.eventLag({ timeStamp: performance.now() }); out.lag80 = R.eventLag({ timeStamp: performance.now() - 80 }); out.lagCap = R.eventLag({ timeStamp: performance.now() - 5000 });
      return out;
    });
    const near = (a, b) => Math.abs(a - b) < 0.003;
    check('출력지연 보정 = outputLatency', near(rules.lat0, 0.1), rules.lat0);
    check('outputLatency 없으면 baseLatency', near(rules.latBase, 0.02), rules.latBase);
    check('출력지연 상한 0.3초', near(rules.latCap, 0.3), rules.latCap);
    check('사용자 보정 +30ms 합산', near(rules.latUser, 0.13), rules.latUser);
    check('사용자 보정 하한 -200ms', near(rules.latUserCap, -0.1), rules.latUserCap);
    check('터치 밀림 0 / 80ms / 상한 150ms', rules.lagNow < 0.01 && near(rules.lag80, 0.08) && near(rules.lagCap, 0.15), rules);

    // ---------- 네온(B) ----------
    { const c = await p.evaluate(() => { const r = document.querySelector('.h2w-rhythm').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await p.mouse.click(c.x, c.y); } await W(2500);
    await p.evaluate(() => document.querySelector('[data-rp-type="B"]').click()); await W(800);
    await p.evaluate(() => document.querySelector('[data-rp-song="take-this-night-around"]').click()); await W(800);
    await p.evaluate(() => { window.__clk.lat = 0.05; document.querySelector('[data-rp-diff="HARD"]').click(); });
    for (let i = 0; i < 60; i++) { const ok = await p.evaluate(() => { const d = window.__rhythmB && window.__rhythmB.dbg(); return d && !d.loading; }); if (ok) break; await W(500); }
    const neon = await p.evaluate(() => {
      const G = window.__rhythmB;
      window.__clk.freeze = 0; const c = -G.dbg().t; window.__clk.freeze = c + 1; const t1 = G.dbg().t; window.__clk.freeze = c + 5; const t2 = G.dbg().t;
      return { offset: c, out: { clockFollows: Math.abs(t1 - 1) < 1e-9 && Math.abs(t2 - 5) < 1e-9 } }; // currentTime = 게임시각 + offset, 5초에 고정
    });
    console.log('neon setup', JSON.stringify(neon.out));
    check('네온: 판정 시계 = 오디오 시계(프레임 무관)', neon.out.clockFollows);
    const neonRes = await p.evaluate(async (offset) => {
      const G = window.__rhythmB, raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const at = x => { window.__clk.freeze = x + offset; };
      const btn = lane => document.querySelectorAll('[data-rp-b] .rb-hit')[lane];
      const tap = (lane, lagMs) => { const b = btn(lane); const ts = performance.now() - (lagMs || 0);
        const e = new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 10 + lane, pointerType: 'touch', isPrimary: lane === 0 });
        Object.defineProperty(e, 'timeStamp', { value: ts }); b.dispatchEvent(e);
        b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 10 + lane, pointerType: 'touch' })); };
      const st = n => G.dbg().notes.find(m => m.id === n.id).state;
      const cnt = () => ({ ...G.dbg().cnt });
      const notes = G.dbg().notes, R = MoleGame.Rhythm.rules, J = R.diffs.HARD.judge;
      const win = { P: J.perfectMs, G: J.greatMs * 1.21, D: J.goodMs * 1.21 };
      const solo = notes.filter(n => n.targetTime > 8).sort((a, b) => a.targetTime - b.targetTime); // 같은 칸 노트는 1.6초 이상 떨어져 있어 서로 간섭 없음
      const out = { buttons: document.querySelectorAll('[data-rp-b] .rb-hit').length, win, solo: solo.length, cases: [] };
      try {
      // 경계값: (오차ms, 기대판정)
      const cases = [[0, 'PERFECT'], [win.P - 1, 'PERFECT'], [-(win.P - 1), 'PERFECT'], [win.P + 1, 'GREAT'], [win.G - 1, 'GREAT'], [-(win.G + 1), 'GOOD'], [win.D - 1, 'GOOD'], [-(win.D + 2), null]];
      let i = 0;
      for (const [d, want] of cases) {
        const n = solo[i++ * 5]; at(n.targetTime + d / 1000); const before = cnt(); tap(n.lane); const after = cnt();
        const got = ['PERFECT', 'GREAT', 'GOOD', 'MISS'].find(k => after[k] > before[k]) || null;
        out.cases.push({ d: Math.round(d * 10) / 10, want, got, state: st(n) });
      }
      // 터치 밀림 보정: 처리 시각은 +90ms 늦지만 실제 누른 시각은 정확 → PERFECT
      { const n = solo[i++ * 5]; at(n.targetTime + 0.09); const b = cnt(); tap(n.lane, 90); const a = cnt(); out.lag = { got: a.PERFECT > b.PERFECT ? 'PERFECT' : JSON.stringify(a) }; }
      // 중복 판정 방지
      { const n = solo[i++ * 5]; at(n.targetTime); tap(n.lane); const c1 = cnt(); tap(n.lane); tap(n.lane); const c2 = cnt(); out.dup = JSON.stringify(c1) === JSON.stringify(c2); }
      // 콤보: 지금까지 성공 연속 → MISS 나면 0
      out.comboBeforeMiss = G.dbg().combo;
      { const n = solo[i++ * 5]; at(n.targetTime + win.D / 1000 + 0.05); await raf(); out.missState = st(n); out.comboAfterMiss = G.dbg().combo; }
      // 동시 타격: 같은 시각 3개 이상
      const groups = {}; G.dbg().notes.forEach(n => { if (n.state === 'pending') (groups[n.targetTime] = groups[n.targetTime] || []).push(n); });
      const chord = Object.values(groups).filter(g => g.length >= 3).sort((a, b) => a[0].targetTime - b[0].targetTime)[0];
      if (chord) { at(chord[0].targetTime + 0.01); const c0 = G.dbg().combo; chord.forEach(n => tap(n.lane)); out.chord = { size: chord.length, hit: chord.filter(n => st(n) === 'hit').length, comboUp: G.dbg().combo - c0 }; }
      // 일시정지 동기화: 일시정지 중 누름 무시, 재개 후 그대로 판정
      { const n = G.dbg().notes.filter(m => m.state === 'pending' && m.targetTime > (chord ? chord[0].targetTime + 1 : 0)).sort((a, b) => a.targetTime - b.targetTime)[0];
        at(n.targetTime); window.__setHidden(true); window.__setHidden(false);
        out.autoPause = { paused: G.dbg().paused, window: !document.querySelector('[data-rp-pause]').hidden };
        const b = cnt(); tap(n.lane); out.pausedIgnored = JSON.stringify(b) === JSON.stringify(cnt()) && st(n) === 'pending';
        document.querySelector('[data-rp-resume]') ? document.querySelector('[data-rp-resume]').click() : null;
        out.resumed = !G.dbg().paused; tap(n.lane); out.afterResume = st(n); }
      // 점수 = 판정 합계와 일치
      const d = G.dbg(); out.hud = { score: d.score, hudScore: document.querySelector('[data-rb-score]').textContent, combo: d.combo, hudCombo: document.querySelector('[data-rb-combo]').textContent };
      // 끝까지 넘겨 결과·기록 저장
      at(9999); await raf(); await raf(); await new Promise(r => setTimeout(r, 1500));
      const fd = G.dbg(); out.final = { ended: fd.ended, cnt: fd.cnt, score: fd.score, maxCombo: fd.maxCombo, total: fd.notes.length, sum: fd.cnt.PERFECT + fd.cnt.GREAT + fd.cnt.GOOD + fd.cnt.MISS };
      const r = document.querySelector('[data-rp-result]');
      out.result = { shown: r && !r.hidden, miss: (document.querySelector('[data-rp-res-miss]') || {}).textContent, perfect: (document.querySelector('[data-rp-res-perfect]') || {}).textContent, best: localStorage.getItem('mole.rp.b.best.take-this-night-around.HARD') };
      } catch (e) { out.err = e.message + ' @ ' + Object.keys(out).join(','); }
      window.__clk.freeze = null;
      return out;
    }, neon.offset);
    console.log('neon', JSON.stringify(neonRes));
    check('네온: 버튼 9개', neonRes.buttons === 9, neonRes.buttons);
    neonRes.cases.forEach(c => check('네온 경계 ' + c.d + 'ms → ' + (c.want || '판정없음'), c.got === c.want && (c.want ? c.state === 'hit' : c.state === 'pending'), c));
    check('네온: 터치 밀림 90ms 보정 → PERFECT', neonRes.lag.got === 'PERFECT', neonRes.lag);
    check('네온: 같은 노트 중복 판정 없음', neonRes.dup);
    check('네온: GOOD 범위 지나면 MISS + 콤보 0', neonRes.missState === 'miss' && neonRes.comboBeforeMiss > 0 && neonRes.comboAfterMiss === 0, { b: neonRes.comboBeforeMiss, a: neonRes.comboAfterMiss, s: neonRes.missState });
    check('네온: 동시 타격 전부 판정 + 콤보 증가', neonRes.chord && neonRes.chord.hit === neonRes.chord.size && neonRes.chord.comboUp === neonRes.chord.size, neonRes.chord);
    check('네온: 앱 가려지면 자동 일시정지(창 표시)', neonRes.autoPause.paused && neonRes.autoPause.window, neonRes.autoPause);
    check('네온: 일시정지 중 입력 무시', neonRes.pausedIgnored);
    check('네온: 재개 후 같은 시각 정상 판정', neonRes.resumed && neonRes.afterResume === 'hit', { r: neonRes.resumed, s: neonRes.afterResume });
    check('네온: 점수·콤보 표시 = 내부값', neonRes.hud.score === Number(neonRes.hud.hudScore.replace(/,/g, '')) && neonRes.hud.combo === Number(neonRes.hud.hudCombo.replace(/,/g, '')), neonRes.hud);
    check('네온: 판정 합계 = 노트 수', neonRes.final.ended && neonRes.final.sum === neonRes.final.total, neonRes.final);
    check('네온: 결과창 숫자 = 내부값, 최고기록 저장', neonRes.result.shown && Number(neonRes.result.miss) === neonRes.final.cnt.MISS && Number(neonRes.result.perfect) === neonRes.final.cnt.PERFECT && Number(neonRes.result.best) === neonRes.final.score, neonRes.result);

    // ---------- 비치(A) ----------
    for (const k of ['other', 'song-back', 'songs-back']) { await p.evaluate(k => document.querySelector('[data-rp-' + k + ']').click(), k); await W(700); }
    await p.evaluate(() => document.querySelector('[data-rp-type="A"]').click()); await W(800);
    await p.evaluate(() => { const s = [...document.querySelectorAll('[data-rp-song]')].find(e => e.offsetParent); if (s) s.click(); }); await W(800);
    await p.evaluate(() => { window.__clk.lat = 0.05; document.querySelector('[data-rp-diff="HARD"]').click(); });
    for (let i = 0; i < 60; i++) { const ok = await p.evaluate(() => { const d = window.__rhythm.dbg(); return d && d.notes && d.notes.length; }); if (ok) break; await W(500); }
    await W(500);
    const beach = await p.evaluate(async () => {
      const G = window.__rhythm, C = G.CONFIG, R = MoleGame.Rhythm.rules, J = R.diffs.HARD.judge, raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.__clk.freeze = 0; const offset = -G.dbg().t; window.__clk.freeze = offset + 1; const t1 = G.dbg().t; window.__clk.freeze = offset + 5; const clockFollows = Math.abs(t1 - 1) < 1e-9 && Math.abs(G.dbg().t - 5) < 1e-9;
      const at = x => { window.__clk.freeze = x + offset; }, apex = (C.apexFrame + 0.5) * C.jumpFrameMs / 1000;
      const btn = lane => document.querySelectorAll('[data-rp-btns] .rp-btn')[lane];
      const tap = (lane, lagMs) => { const e = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 20 + lane, pointerType: 'touch' }); Object.defineProperty(e, 'timeStamp', { value: performance.now() - (lagMs || 0) }); btn(lane).dispatchEvent(e); };
      const notes = G.dbg().notes.slice().sort((a, b) => a.targetTime - b.targetTime);
      const solo = notes.filter(n => n.targetTime > 8 && notes.every(m => m === n || m.targetLane !== n.targetLane || Math.abs(m.targetTime - n.targetTime) > 0.8));
      const out = { clockFollows, buttons: document.querySelectorAll('[data-rp-btns] .rp-btn').length, J, cases: [] };
      const cases = [[0, 'PERFECT'], [J.perfectMs - 1, 'PERFECT'], [J.perfectMs + 1, 'GREAT'], [-(J.greatMs - 1), 'GREAT'], [J.greatMs + 1, 'GOOD'], [-(J.goodMs - 1), 'GOOD'], [J.goodMs + 2, null]];
      let k = 0;
      for (const [d, want] of cases) { const n = solo[k]; k += 3; at(n.targetTime - apex + d / 1000); await raf(); tap(n.targetLane); out.cases.push({ d, want, got: n.press ? n.press.grade : 'none' }); }
      { const n = solo[k]; k += 3; at(n.targetTime - apex + 0.07); await raf(); tap(n.targetLane, 70); out.lag = n.press && n.press.grade; }
      // 실제 충돌까지 진행했을 때 PERFECT 로 눌린 노트가 hit 되는지 (판정 문구 = 결과)
      { const n = solo[k]; k += 3; const c0 = { ...G.dbg().cnt }; at(n.targetTime - apex); await raf(); tap(n.targetLane); for (let x = 0; x < 30 && n.state !== 'hit' && n.state !== 'miss'; x++) { at(n.targetTime - apex + x * 0.016); await raf(); } out.collide = { state: n.state, perfectUp: G.dbg().cnt.PERFECT - c0.PERFECT }; }
      { const n = solo[k]; at(n.targetTime - 0.3); window.__setHidden(true); window.__setHidden(false); out.autoPause = !document.querySelector('[data-rp-pause]').hidden; }
      window.__clk.freeze = null; return out;
    });
    console.log('beach', JSON.stringify(beach));
    check('비치: 판정 시계 = 오디오 시계', beach.clockFollows);
    check('비치: 버튼 4개', beach.buttons === 4, beach.buttons);
    beach.cases.forEach(c => check('비치 경계 ' + c.d + 'ms → ' + (c.want || '판정없음'), c.got === c.want, c));
    check('비치: 터치 밀림 70ms 보정 → PERFECT', beach.lag === 'PERFECT', beach.lag);
    check('비치: 눌러둔 판정대로 충돌 시 성공 처리', beach.collide.state === 'hit' && beach.collide.perfectUp === 1, beach.collide);
    check('비치: 앱 가려지면 자동 일시정지', beach.autoPause);
  } catch (e) { console.log('ERROR', e.stack); results.push({ name: 'script', ok: false }); }
  finally {
    console.log('page errors:', errors.slice(0, 5));
    const fail = results.filter(r => !r.ok).length; console.log(`\n${results.length - fail}/${results.length} 통과`);
    await browser.close(); process.exit(fail ? 1 : 0);
  }
})();
