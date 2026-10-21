// V1368 C 곡 해금 테스트: 앞 2곡 무료, 3번째부터 바로 앞 곡 A등급 이상(비치·네온·난이도 무관). 리듬팡 곡 선택 + 스코어 앨범 목록 둘 다.
//   node scripts/serve.js (PORT=8846) →  node scripts/rhythm/verify-song-unlock.js
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
    await p.evaluate(() => { Object.keys(localStorage).filter(k => /^mole\.rp\.(b\.)?best\./.test(k)).forEach(k => localStorage.removeItem(k)); const x = document.querySelector('.intro-skip'); if (x) x.click(); }); await W(2500);

    const ids = await p.evaluate(() => MoleGame.Rhythm.rules.config.bSongs.map(s => s.id));
    check('지금은 해금 꺼짐: 모든 곡 열림', (await p.evaluate(() => MoleGame.Rhythm.rules.config.bSongs.every((s, i) => !MoleGame.Rhythm.rules.songLock(i)))));
    await p.evaluate(() => { MoleGame.Rhythm.rules.config.songLock = true; }); // 아래는 켰을 때 규칙 검증
    const locks = () => p.evaluate(() => MoleGame.Rhythm.rules.config.bSongs.map((s, i) => !!MoleGame.Rhythm.rules.songLock(i)));
    check('기록 없음: 앞 2곡만 열림', JSON.stringify(await locks()) === JSON.stringify(ids.map((_, i) => i >= 2)), await locks());
    // 2번째 곡 네온 EASY 에서 B → 아직 잠김, A → 3번째 열림
    await p.evaluate(id => { localStorage.setItem('mole.rp.b.best.' + id + '.EASY', '1000'); localStorage.setItem('mole.rp.b.best.' + id + '.EASY.result', '{"rank":"B"}'); }, ids[1]);
    check('앞 곡 B등급이면 그대로 잠김', (await locks())[2] === true);
    await p.evaluate(id => { localStorage.setItem('mole.rp.best.' + id + '.HARD', '2000'); localStorage.setItem('mole.rp.best.' + id + '.HARD.result', '{"rank":"A"}'); }, ids[1]);
    const l2 = await locks();
    check('앞 곡 A등급(비치 HARD) → 3번째 열림, 4번째는 잠김', l2[2] === false && l2[3] === true, l2);

    // 리듬팡 곡 선택 화면
    { const c = await p.evaluate(() => { const r = document.querySelector('.h2w-rhythm').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await p.mouse.click(c.x, c.y); } await W(2500);
    await p.evaluate(() => document.querySelector('[data-rp-type="B"]').click()); await W(900);
    const cards = await p.evaluate(() => [...document.querySelectorAll('.rb-song-choice')].map(c => ({ locked: c.classList.contains('is-locked'), playOff: c.querySelector('.rb-song-play').disabled, txt: c.querySelector('strong').textContent })));
    check('곡 선택: 4번째부터 잠김·버튼 막힘·조건 문구', cards.every((c, i) => c.locked === (i >= 3) && c.playOff === (i >= 3)) && /A등급/.test(cards[3].txt), cards.map(c => c.locked + ':' + c.txt));
    await p.evaluate(() => { const l = document.querySelector('[data-rp-song-list]'); l.scrollTop = l.scrollHeight; }); await W(500);
    await p.screenshot({ path: process.env.SHOT || 'review/song-unlock-list.png' });
    await p.evaluate(() => document.querySelector('[data-rp-songs-home]').click()); await W(2000);

    // 스코어 앨범 목록
    const sc = await p.evaluate(() => { const b = [...document.querySelectorAll('#lane-button-bar .lane-button')].find(x => /스코어/.test(x.textContent)); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(sc.x, sc.y); await W(2000);
    await p.evaluate(() => document.querySelector('[data-sr-game="rhythm"]').click()); await W(600);
    const albums = await p.evaluate(() => [...document.querySelectorAll('.sr-album')].map(b => ({ locked: b.classList.contains('is-locked'), btnOff: b.querySelector('button').disabled, note: (b.querySelector('.sr-album-lock') || {}).textContent || '' })));
    check('스코어 앨범: 같은 기준으로 잠김·버튼 막힘', albums.every((a, i) => a.locked === (i >= 3) && a.btnOff === (i >= 3)) && /A등급/.test(albums[3].note), albums.map(a => a.locked));
    await p.screenshot({ path: process.env.SHOT2 || 'review/song-unlock-score.png' });
  } catch (e) { console.log('ERROR', e.stack); results.push(false); }
  finally {
    console.log('page errors:', errors.slice(0, 5));
    const fail = results.filter(r => !r).length; console.log(`\n${results.length - fail}/${results.length} 통과`);
    await browser.close(); process.exit(fail ? 1 : 0);
  }
})();
