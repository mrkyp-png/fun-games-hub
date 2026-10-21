// V1366 C 리듬팡 티켓 테스트: 하루 첫 판 무료 → 티켓 1장 사용 → 없으면 시작 안 함(안내) → 오른쪽 위 표시 → 로딩 취소 시 환불.
//   node scripts/serve.js (PORT=8846) →  node scripts/rhythm/verify-rhythm-tickets.js
const puppeteer = require('puppeteer-core');
const URL = process.env.URL || 'http://localhost:8846/mole/index.html';
const W = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, info) { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const p = await browser.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForSelector('#splash.is-ready', { timeout: 60000 }).catch(() => {}); await W(300);
    for (let i = 0; i < 10 && await p.$('#splash'); i++) { await p.mouse.click(195, 680); await W(800); }
    await p.evaluate(() => { const x = document.querySelector('.intro-skip'); if (x) x.click(); }); await W(2500);

    // 경제 함수
    const eco = await p.evaluate(() => {
      const E = MoleGame.Economy, o = {};
      localStorage.removeItem('mole.rp.freeDay'); localStorage.setItem('mole.rp.b.tickets', '1');
      o.free = E.spendRhythmPlay(); o.ticket = E.spendRhythmPlay(); o.none = E.spendRhythmPlay(); o.left = E.getRhythmBTickets();
      E.refundRhythmPlay('ticket'); o.afterRefund = E.getRhythmBTickets(); E.refundRhythmPlay('free'); o.freeBack = E.rhythmFreeToday();
      return o;
    });
    check('하루 첫 판 무료 → 다음은 티켓 → 없으면 거절', eco.free === 'free' && eco.ticket === 'ticket' && eco.none === false && eco.left === 0, eco);
    check('환불: 티켓 +1, 무료 판 복구', eco.afterRefund === 1 && eco.freeBack, eco);

    // 화면: 티켓 0장·무료 사용함·코인 0 상태로 네온 곡 시작
    await p.evaluate(() => { const d = new Date(); localStorage.setItem('mole.rp.freeDay', d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()); localStorage.setItem('mole.rp.b.tickets', '0'); });
    { const c = await p.evaluate(() => { const r = document.querySelector('.h2w-rhythm').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await p.mouse.click(c.x, c.y); } await W(2500);
    const typesBadge = await p.evaluate(() => { const b = document.querySelector('.rp-ticket-badge--types'), r = b.getBoundingClientRect(), h = document.querySelector('[data-rp-types-home]').getBoundingClientRect(); return { text: b.textContent.trim(), below: Math.round(r.top - h.bottom), centerDiff: Math.round((r.left + r.right) / 2 - (h.left + h.right) / 2) }; });
    check('타입 선택 화면: 홈 버튼 아래 표시', typesBadge.text === '0' && typesBadge.below >= 0 && typesBadge.below < 30 && Math.abs(typesBadge.centerDiff) < 8, typesBadge);
    await p.screenshot({ path: process.env.SHOT3 || 'review/rhythm-ticket-types.png' });
    await p.evaluate(() => document.querySelector('[data-rp-type="B"]').click()); await W(800);
    const badge = await p.evaluate(() => { const b = document.querySelector('.rp-ticket-badge--songs'), r = b.getBoundingClientRect(), f = document.querySelector('.rb-song-footer').getBoundingClientRect(), c = document.querySelector('.rb-song-card').getBoundingClientRect(), t = document.querySelector('[data-rp-songs-back]').getBoundingClientRect(); return { text: b.textContent.trim(), below: Math.round(r.top - f.bottom), off: Math.round((r.left + r.right) / 2 - (c.left + c.right) / 2), h: Math.round(r.height), btnW: Math.round(t.width), inScreen: r.bottom <= innerHeight }; });
    check('곡 선택 창: 버튼 줄 아래 좌우 가운데, 버튼 원래 폭', badge.text === '0' && badge.below >= 0 && badge.below < 20 && Math.abs(badge.off) <= 2 && badge.h <= 42 && badge.btnW > 110 && badge.inScreen, badge);
    await p.screenshot({ path: process.env.SHOT2 || 'review/rhythm-ticket-badge.png' });
    await p.evaluate(() => document.querySelector('[data-rp-song="take-this-night-around"]').click()); await W(800);
    await p.evaluate(() => document.querySelector('[data-rp-diff="EASY"]').click()); await W(500);
    const sel = await p.evaluate(() => { const b = document.querySelector('.rp-ticket-badge--select'), r = b.getBoundingClientRect(), h = document.querySelector('[data-rp-sel-close]').getBoundingClientRect(); return { text: b.textContent.trim(), below: Math.round(r.top - h.bottom), centerDiff: Math.round((r.left + r.right) / 2 - (h.left + h.right) / 2), inScreen: r.bottom <= innerHeight }; });
    check('난이도 창: 홈 버튼 아래 표시', sel.text === '0' && sel.below >= 0 && sel.below < 24 && Math.abs(sel.centerDiff) < 8 && sel.inScreen, sel);
    await p.screenshot({ path: process.env.SHOT4 || 'review/rhythm-ticket-select.png' });
    const no = await p.evaluate(() => ({ msg: document.querySelector('[data-rp-selected-song]').textContent, select: !document.querySelector('[data-rp-select]').hidden, started: !!(window.__rhythmB && window.__rhythmB.dbg()) }));
    check('티켓 없으면 시작 안 하고 난이도 창에 안내', no.select && !no.started && /티켓이 없어요/.test(no.msg), no);
    await p.evaluate(() => MoleGame.Economy.addRhythmBTickets(1));
    await p.evaluate(() => document.querySelector('[data-rp-diff="EASY"]').click());
    for (let i = 0; i < 40; i++) { if (await p.evaluate(() => { const d = window.__rhythmB && window.__rhythmB.dbg(); return d && !d.loading; })) break; await W(500); }
    const go = await p.evaluate(() => ({ tickets: MoleGame.Economy.getRhythmBTickets(), playing: !!(window.__rhythmB.dbg() && !window.__rhythmB.dbg().loading), badgeHidden: [...document.querySelectorAll('.rp-ticket-badge')].every(b => !b.offsetParent) }));
    check('티켓 있으면 1장 쓰고 시작, 게임 중엔 표시 숨김', go.tickets === 0 && go.playing && go.badgeHidden, go);

    // 로딩 중 취소 → 환불
    await p.evaluate(() => { document.querySelector('[data-rp-pausebtn]').click(); }); await W(300);
    await p.evaluate(() => document.querySelector('[data-rp-other]') && document.querySelector('[data-rp-other]').click()); await W(600);
    await p.evaluate(() => MoleGame.Economy.addRhythmBTickets(1));
    await p.evaluate(() => { document.querySelector('[data-rp-diff="NORMAL"]').click(); document.querySelector('[data-rp-preload-cancel]').click(); }); await W(500);
    const refund = await p.evaluate(() => MoleGame.Economy.getRhythmBTickets());
    check('로딩 중 취소하면 티켓 돌려받음', refund === 1, refund);
  } catch (e) { console.log('ERROR', e.stack); results.push(false); }
  finally {
    console.log('page errors:', errors.filter(e => !/setPointerCapture/.test(e)).slice(0, 5));
    const fail = results.filter(r => !r).length; console.log(`\n${results.length - fail}/${results.length} 통과`);
    await browser.close(); process.exit(fail ? 1 : 0);
  }
})();
