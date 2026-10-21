// V1367 C 스코어 화면 리듬팡 탭 테스트: 진입 전 잠김 → 진입하면 해금, 비치·네온 × 곡별 순위(난이도 P>N>A → 등급 → 점수), 'P · A' 표기 + 점수.
//   node scripts/serve.js (PORT=8846) →  node scripts/rhythm/verify-score-rhythm.js
const puppeteer = require('puppeteer-core');
const URL = process.env.URL || 'http://localhost:8846/mole/index.html';
const W = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, info) { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [];
  try {
    const p = await browser.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForSelector('#splash.is-ready', { timeout: 60000 }).catch(() => {}); await W(300);
    for (let i = 0; i < 10 && await p.$('#splash'); i++) { await p.mouse.click(195, 680); await W(800); }
    await p.evaluate(() => { const x = document.querySelector('.intro-skip'); if (x) x.click(); }); await W(2500);

    // 정렬 규칙(단위)
    const order = await p.evaluate(() => {
      const c = MoleGame.ScoreScreen.rpCmp, L = [{ diff: 'EASY', grade: 'SSS', score: 900 }, { diff: 'HARD', grade: 'A', score: 300 }, { diff: 'HARD', grade: 'S', score: 100 }, { diff: 'NORMAL', grade: 'SS', score: 500 }, { diff: 'HARD', grade: 'S', score: 200 }];
      return L.sort(c).map(e => e.diff[0] + e.grade + e.score).join(',');
    });
    check('정렬: 난이도(P>N>A) → 등급 → 점수', order === 'HS200,HS100,HA300,NSS500,ESSS900', order);

    // 기록 넣기: 네온 Take This Night Around = EASY SSS 900000 / NORMAL S 500000 / HARD A 300000 → 내 대표 = P · A 300,000
    await p.evaluate(() => {
      localStorage.removeItem('mole.rp.entered'); localStorage.removeItem('mole.score.view');
      const set = (k, s, r) => { localStorage.setItem(k, String(s)); localStorage.setItem(k + '.result', JSON.stringify({ rank: r })); };
      set('mole.rp.b.best.take-this-night-around.EASY', 900000, 'SSS'); set('mole.rp.b.best.take-this-night-around.NORMAL', 500000, 'S'); set('mole.rp.b.best.take-this-night-around.HARD', 300000, 'A');
      set('mole.rp.best.le-monde-attendra-demain.NORMAL', 222000, 'B');
    });
    const openScore = async () => { await p.evaluate(() => { const b = [...document.querySelectorAll('#lane-button-bar .lane-button')].find(x => /스코어|Score/i.test(x.textContent)); const r = b.getBoundingClientRect(); window.__sc = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); const c = await p.evaluate(() => window.__sc); await p.mouse.click(c.x, c.y); await W(1500); };
    await openScore();
    const locked = await p.evaluate(() => { document.querySelector('[data-sr-game="rhythm"]').click(); return { rpHidden: document.querySelector('[data-sr-rp]').hidden, toast: document.querySelector('[data-sr-toast]').textContent }; });
    check('리듬팡 진입 전: 리듬팡 탭 잠김(안내만)', locked.rpHidden && /리듬팡/.test(locked.toast), locked);

    // 리듬팡 진입 = 해금
    await p.evaluate(() => document.querySelector('[data-back="score"]').click()); await W(1200);
    { const c = await p.evaluate(() => { const r = document.querySelector('.h2w-rhythm').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await p.mouse.click(c.x, c.y); } await W(2000);
    const entered = await p.evaluate(() => localStorage.getItem('mole.rp.entered'));
    check('리듬팡에 들어가면 해금 기록', entered === '1', entered);
    await p.evaluate(() => document.querySelector('[data-rp-types-home]').click()); await W(2000);
    await openScore();
    await p.evaluate(() => document.querySelector('[data-sr-game="rhythm"]').click()); await W(500);
    const list = await p.evaluate(() => ({ shown: !document.querySelector('[data-sr-albums]').hidden, albums: document.querySelectorAll('.sr-album').length, btns: [...document.querySelectorAll('.sr-album')][0].querySelectorAll('.sr-album-btn').length, imgs: [...document.querySelectorAll('.sr-album-img')].every(i => /albums-v1170/.test(i.src)), top3Hidden: getComputedStyle(document.querySelector('[data-sr-top3]')).display === 'none' }));
    check('리듬팡 탭 = 앨범 목록(앨범마다 비치·네온 버튼), 랭킹은 숨김', list.shown && list.albums === 6 && list.btns === 2 && list.imgs && list.top3Hidden, list);
    await p.screenshot({ path: process.env.SHOT_LIST || 'review/score-rhythm-albums.png' });
    const pick = (title, type) => p.evaluate((title, type) => { const box = [...document.querySelectorAll('.sr-album')].find(b => b.querySelector('.sr-album-title').textContent.includes(title)); box.querySelector('[data-type="' + type + '"]').click(); }, title, type);
    await pick('Take This Night', 'B'); await W(700);
    const neon = await p.evaluate(() => { const c1 = document.querySelector('.sr-card--1'); return { title: document.querySelector('[data-sr-title]').textContent, tag: document.querySelector('[data-sr-tag]').textContent, pill: c1.querySelector('.sr-pill').textContent, score: c1.querySelector('.sr-score').textContent, mine: document.querySelector('[data-sr-mine] .sr-pill').textContent + ' ' + document.querySelector('[data-sr-mine] .sr-score').textContent, albumsHidden: document.querySelector('[data-sr-albums]').hidden }; });
    check('네온 버튼 → 그 곡 랭킹, 1위 = P · A 300,000', neon.albumsHidden && /Take This Night/.test(neon.title) && neon.tag === '네온' && neon.pill === 'P · A' && neon.score === '300,000' && neon.mine === 'P · A 300,000', neon);
    await p.screenshot({ path: process.env.SHOT || 'review/score-rhythm-neon.png' });
    await p.evaluate(() => document.querySelector('[data-sr-rp-back]').click()); await W(300);
    const back = await p.evaluate(() => !document.querySelector('[data-sr-albums]').hidden);
    check('◀ 누르면 앨범 목록으로', back);
    await pick('Take This Night', 'A'); await W(300);
    check('비치 · 같은 곡은 기록 없음(타입별 분리)', await p.evaluate(() => document.querySelector('.sr-card--1').classList.contains('is-empty')));
    await p.evaluate(() => document.querySelector('[data-sr-rp-back]').click()); await W(300);
    await pick('Le monde', 'A'); await W(300);
    const beach = await p.evaluate(() => { const c1 = document.querySelector('.sr-card--1'); return { pill: c1.querySelector('.sr-pill').textContent, score: c1.querySelector('.sr-score').textContent }; });
    check('비치 · Le monde = N · B 222,000', beach.pill === 'N · B' && beach.score === '222,000', beach);
    await p.evaluate(() => document.querySelector('[data-sr-game="mole"]').click()); await W(300);
    const mole = await p.evaluate(() => ({ rpHidden: document.querySelector('[data-sr-rp]').hidden, moleOn: document.querySelector('[data-sr-game="mole"]').classList.contains('sr-tab--on') }));
    check('두더지팡 탭으로 돌아가면 기존 화면', mole.rpHidden && mole.moleOn, mole);
    const press = await p.evaluate(async () => { const t = document.querySelector('[data-sr-game="rhythm"]'); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); const on = getComputedStyle(t).transform; t.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); return { pressed: on, released: getComputedStyle(t).transform }; });
    check('탭 누름 효과(누르면 작아지고 떼면 복귀)', press.pressed !== 'none' && press.released === 'none', press);
    const songs = await p.evaluate(() => ({ cfg: MoleGame.Rhythm.rules.config.bSongs.map(s => s.id).join(','), albums: [...document.querySelectorAll('.sr-album-title')].length }));
    check('앨범 목록 = 리듬팡 곡 목록과 연동(곡 수 일치)', songs.albums === songs.cfg.split(',').length, songs);
  } catch (e) { console.log('ERROR', e.stack); results.push(false); }
  finally {
    console.log('page errors:', errors.slice(0, 5));
    const fail = results.filter(r => !r).length; console.log(`\n${results.length - fail}/${results.length} 통과`);
    await browser.close(); process.exit(fail ? 1 : 0);
  }
})();
