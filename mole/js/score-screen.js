// 스코어 랭킹(SCORE RANKING) 전체화면 — 바탕화면 "스코어 UI 및 에셋/명세서" 기준(v749).
// 양탄자가 위→아래로 펼쳐지며 등장, 뒤로가기 시 아래→위로 말려 올라가며 퇴장.
// 랭킹 정렬 = 1차 최고 도달 라운드(AR1<…<AR8<NP1<…<PR8), 2차 그 라운드 최고 점수.
// 다른 플레이어 순위는 서버(Firebase)가 붙으면 RankingSource.top() 만 채우면 된다 — 지금은 빈 목록(사용자 지정).
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var MODE_CODE = { easy: 'A', mid: 'N', legend: 'P' }; // 라이트 ON/DIM/OFF = 아마추어/일반/프로 — 홈 라운드 표시(A1·N1·P1)와 통일(v780, 사용자 지정)
  var MODE_ORDER = ['easy', 'mid', 'legend'];
  var UNROLL_MS = 550, ROLLUP_MS = 370; // v790: 화면 전체 말림 0.5s 에 맞춤(+150)
  // Content-addressed artwork: new bytes must get a new URL, including in installed-app caches.
  var CARD_ART = {
    1: { src: 'assets/score/card-1-clean-75c39b75eb.svg', width: 310, height: 461 },
    2: { src: 'assets/score/card-2-clean-6cf5c67ce5.svg', width: 305, height: 448 },
    3: { src: 'assets/score/card-3-clean-aa5a6fdc34.svg', width: 301, height: 453 }
  };

  // 랭킹 데이터 출처 — gameId 별로 분리(mole_pang / rhythm_pang). 항목: {playerName, avatar, mode, highestRound, highestScore}
  var RankingSource = {
    top: function (gameId) { return []; } // 서버 연결 전 — 빈 랭킹
  };

  // 내 최고 기록 = 모든 라이트·라운드 중 가장 높은 라운드(모드 순서 포함), 그 라운드의 최고 점수.
  function myBest() {
    var P = MG.Progress, best = null;
    MODE_ORDER.forEach(function (light, mi) {
      for (var ch = 1; ch <= P.MAX_CHAPTER; ch++) {
        var rec = P.get(ch, light);
        if (!(rec.best > 0)) continue;
        var rank = mi * P.MAX_CHAPTER + ch;
        if (!best || rank > best.rank || (rank === best.rank && rec.best > best.score)) {
          best = { rank: rank, mode: light, round: ch, score: rec.best };
        }
      }
    });
    return best;
  }
  function sortRanking(list) {
    return list.slice().sort(function (a, b) {
      var ra = MODE_ORDER.indexOf(a.mode) * 8 + a.highestRound, rb = MODE_ORDER.indexOf(b.mode) * 8 + b.highestRound;
      return (rb - ra) || (b.highestScore - a.highestScore);
    });
  }
  function code(mode, round) { return (MODE_CODE[mode] || 'A') + round; }

  // V1367 C 리듬팡 순위(사용자 지정): 타입(비치 A / 네온 B) × 곡마다 따로. 정렬 = 난이도 높은 것(P>N>A) → 등급 → 점수. 표기 'P · SSS'.
  var DIFF_ORDER = ['EASY', 'NORMAL', 'HARD'], DIFF_CODE = { EASY: 'A', NORMAL: 'N', HARD: 'P' }, DIFF_CLASS = { EASY: 'easy', NORMAL: 'mid', HARD: 'legend' };
  var GRADES = ['F', 'D', 'C', 'B', 'A', 'AA', 'AAA', 'S', 'SS', 'SSS'];
  function rpSongs() { return (MG.Rhythm && MG.Rhythm.rules.config.bSongs) || []; }
  function rpKey(type, id, d) { return (type === 'B' ? 'mole.rp.b.best.' : 'mole.rp.best.') + (id === 'fever2' ? '' : id + '.') + d; }
  function rpCmp(a, b) { return (DIFF_ORDER.indexOf(b.diff) - DIFF_ORDER.indexOf(a.diff)) || (GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade)) || (b.score - a.score); }
  function rpMyBest(type, id) {
    var best = null;
    DIFF_ORDER.forEach(function (d) {
      var score = parseInt(localStorage.getItem(rpKey(type, id, d)), 10) || 0, grade = '';
      if (!score) return;
      try { grade = (JSON.parse(localStorage.getItem(rpKey(type, id, d) + '.result') || 'null') || {}).rank || ''; } catch (e) {}
      var e = { diff: d, grade: grade, score: score };
      if (!best || rpCmp(e, best) < 0) best = e;
    });
    return best;
  }
  function rpPill(e) { return DIFF_CODE[e.diff] + (e.grade ? ' · ' + e.grade : ''); }
  function myAvatar() { return localStorage.getItem('mole.profilePic') || 'assets/moles/mole1.png'; }
  function fmt(n) { return (n || 0).toLocaleString('en-US'); }

  function create(opts) {
    var el = opts.root;
    var top3 = el.querySelector('[data-sr-top3]');
    var rows = el.querySelector('[data-sr-rows]');
    var mine = el.querySelector('[data-sr-mine]');
    var toastEl = el.querySelector('[data-sr-toast]');
    var closing = false, timers = [], rankContext = null;
    // Rising clouds stay behind the carpet; each expands and leaves above the viewport.
    (function () {
      var sky = el.querySelector('[data-sr-sky]');
      if (!sky) return;
      var shape = 'M12 38C8 27 17 19 30 21C29 8 48 5 60 16C73 1 100 6 110 23C129 15 149 23 146 39C157 48 144 62 128 55C116 65 93 63 82 55C68 66 45 63 36 53C21 61 10 51 12 38Z';
      [[24,25,24,-3,-3],[46,30,29,-12,2],[68,26,34,-24,-2],[80,31,38,-31,3]].forEach(function (p) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 160 64'); svg.setAttribute('class', 'sr-cloud');
        svg.style.cssText = '--sc-x:' + p[0] + '%;--sc-size:' + p[1] + 'vw;--sc-time:' + p[2] + 's;--sc-delay:' + p[3] + 's;--sc-drift:' + p[4] + 'vw';
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', shape); svg.appendChild(path); sky.appendChild(svg);
      });
    })();
    // 배경 꽃잎·금빛 반짝이 흩날림(사용자 지정 v765) — 1회 생성, CSS 로 무한 반복
    (function () {
      var fx = el.querySelector('[data-sr-fx]'), html = '';
      for (var i = 0; i < 16; i++) {
        html += '<i class="' + (i % 3 ? 'sr-petal' : 'sr-glint') + '" style="left:' + (Math.random() * 96).toFixed(1) + '%;animation-duration:' +
          (7 + Math.random() * 6).toFixed(1) + 's;animation-delay:' + (-Math.random() * 12).toFixed(1) + 's;--sx:' + (Math.random() * 60 - 30).toFixed(0) + 'px"></i>';
      }
      fx.innerHTML = html;
    })();

    function toast(msg) {
      toastEl.textContent = msg; toastEl.hidden = false;
      toastEl.classList.remove('is-on'); void toastEl.offsetWidth; toastEl.classList.add('is-on');
      clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.hidden = true; }, 1800);
    }

    el.querySelector('[data-back="score"]').addEventListener('click', function () {
      root.FGH.rollOut(el, opts.onClose); // v796: 화면 전체 말림(복제본) + 뒤에 홈 즉시
    });
    // V1367 C(사용자 지정): 리듬팡 탭 = 앨범 목록(앨범마다 비치·네온 버튼) → 누르면 그 곡·타입 랭킹(두더지팡과 같은 화면), ◀ 로 앨범 목록
    var view = { game: 'mole', type: 'B', song: -1 };
    function rhythmOpen() { return localStorage.getItem('mole.rp.entered') === '1'; } // 리듬팡에 들어가 본 적 있으면 해금
    var moleTab = el.querySelector('[data-sr-game="mole"]'), rhythmTab = el.querySelector('[data-sr-game="rhythm"]'), rp = el.querySelector('[data-sr-rp]'), albums = el.querySelector('[data-sr-albums]');
    function albumSrc(id) { return 'assets/rhythm/albums-v1170/' + id + '.webp?v=1376'; } // V1376 C: 폰 캐시 무효화
    rpSongs().forEach(function (song, i) {
      var box = document.createElement('div'); box.className = 'sr-album';
      box.innerHTML = '<img class="sr-album-img" alt=""><b class="sr-album-title"></b><span class="sr-album-btns"><button type="button" class="sr-album-btn sr-album-btn--a" data-type="A"></button><button type="button" class="sr-album-btn sr-album-btn--b" data-type="B"></button></span>';
      box.querySelector('img').src = albumSrc(song.id);
      box.dataset.index = i;
      box.querySelector('.sr-album-title').textContent = song.title;
      box.querySelectorAll('button').forEach(function (b) {
        b.textContent = T(b.dataset.type === 'B' ? 'mole.score.neon' : 'mole.score.beach');
        b.addEventListener('click', function () { view.song = i; view.type = b.dataset.type; paintTabs(); render(); });
      });
      albums.appendChild(box);
    });
    el.querySelector('[data-sr-rp-back]').addEventListener('click', function () { view.song = -1; paintTabs(); });
    (function (b) { // 사용자: 되돌리기 버튼 누름 효과(폰에서 :active 대신 클래스)
      b.addEventListener('pointerdown', function () { b.classList.add('is-press'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-press'); }); });
    })(el.querySelector('[data-sr-rp-back]'));
    function rhythmTop(type, id) {
      var me = rpMyBest(type, id), all = RankingSource.top('rhythm_pang:' + type + ':' + id).slice(); // 항목: {playerName, avatar, diff, grade, score}
      if (me) all.push({ playerName: T('mole.score.me'), avatar: myAvatar(), diff: me.diff, grade: me.grade, score: me.score, isMe: true });
      return { all: all.sort(rpCmp), me: me };
    }
    // V1372 C 사용자: 앨범은 한 화면에 4개(2줄)만 — 3번째 줄이 반쯤 보이지 않게 높이를 2줄에 맞추고, 아래 안내 줄은 그 바로 아래로
    function fitAlbums() {
      var first = albums.querySelector('.sr-album'); if (!first || albums.hidden) return;
      var cs = getComputedStyle(albums), gap = parseFloat(cs.rowGap) || 0;
      albums.style.flex = '0 0 auto';
      albums.style.height = (parseFloat(cs.paddingTop) + first.offsetHeight * 2 + gap + 2) + 'px';
    }
    function paintTabs() {
      if (rhythmOpen() && !rhythmTab.dataset.open) { rhythmTab.dataset.open = '1'; rhythmTab.innerHTML = '<span></span>'; rhythmTab.firstChild.textContent = T('mole.pad.gameRhythm'); }
      var r = view.game === 'rhythm', list = r && view.song < 0;
      moleTab.classList.toggle('sr-tab--on', !r); moleTab.classList.toggle('sr-tab--off', r);
      rhythmTab.classList.toggle('sr-tab--on', r); rhythmTab.classList.toggle('sr-tab--off', !r);
      el.classList.toggle('is-albums', list);
      albums.hidden = !list; rp.hidden = !r || list;
      if (list) requestAnimationFrame(fitAlbums);
      if (list) albums.querySelectorAll('.sr-album').forEach(function (box) { // V1368 C: 잠긴 곡 = 어둡게 + 조건, 버튼 막음(리듬팡 곡 선택과 같은 기준)
        var lock = MG.Rhythm.rules.songLock(Number(box.dataset.index)), note = box.querySelector('.sr-album-lock');
        box.classList.toggle('is-locked', !!lock); box.querySelectorAll('button').forEach(function (b) { b.disabled = !!lock; });
        if (lock && !note) { note = document.createElement('i'); note.className = 'sr-album-lock'; box.appendChild(note); }
        if (note) note.textContent = lock ? T('mole.rp.lock.need', { title: lock.needTitle }) : '';
        if (note) note.hidden = !lock;
      });
      el.querySelector('[data-sr-rule]').textContent = T(r ? 'mole.score.ruleRp' : 'mole.score.rule');
      if (r && !list) {
        var song = rpSongs()[view.song];
        el.querySelector('[data-sr-album]').src = albumSrc(song.id);
        el.querySelector('[data-sr-title]').textContent = song.title;
        el.querySelector('[data-sr-tag]').textContent = T(view.type === 'B' ? 'mole.score.neon' : 'mole.score.beach');
        el.querySelector('[data-sr-tag]').className = 'sr-rp-tag sr-rp-tag--' + view.type.toLowerCase();
      }
    }
    // 사용자 지정: 두더지팡·리듬팡 탭 누름 효과 — 폰에서 :active 가 잘 안 먹어 직접 클래스 토글(리듬팡 창 버튼과 같은 방식)
    [moleTab, rhythmTab].forEach(function (t) {
      t.addEventListener('pointerdown', function () { t.classList.add('is-press'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { t.addEventListener(ev, function () { t.classList.remove('is-press'); }); });
    });
    moleTab.addEventListener('click', function () { if (view.game === 'mole') return; view.game = 'mole'; paintTabs(); render(); });
    rhythmTab.addEventListener('click', function () {
      if (!rhythmOpen()) { toast(T('mole.score.rhythmLocked')); return; }
      view.game = 'rhythm'; view.song = -1; paintTabs(); albums.scrollTop = 0;
    });

    function cardHtml(entry, place) {
      var c = document.createElement('div');
      c.className = 'sr-card sr-card--' + place + (entry ? '' : ' is-empty');
      var art = CARD_ART[place];
      c.innerHTML = '<img class="sr-card-bg" alt="" src="' + art.src + '" width="' + art.width + '" height="' + art.height + '">' +
        '<div class="sr-card-body"><span class="sr-ava"><img alt=""></span><b class="sr-name"></b><span class="sr-pill"></span><strong class="sr-score"></strong></div>';
      c.querySelector('.sr-ava img').src = entry ? (entry.avatar || 'assets/moles/mole1.png') : 'assets/moles/mole1.png';
      c.querySelector('.sr-name').textContent = entry ? entry.playerName : '—';
      c.querySelector('.sr-pill').textContent = entry ? entry.pill : '—';
      if (entry) c.querySelector('.sr-pill').classList.add('sr-pill--' + entry.cls);
      c.querySelector('.sr-score').textContent = entry ? fmt(entry.score) : '—';
      return c;
    }

    // 화면에 그릴 공통 항목 = { playerName, avatar, pill, cls, score, isMe }
    function moleBoard() {
      // v785(사용자 지정): 내 최고 기록도 랭킹에 넣어 순위대로 표시(서버 전엔 나 혼자라 1위)
      var me = myBest();
      var all = RankingSource.top('mole_pang').slice();
      if (me) all.push({ playerName: T('mole.score.me'), avatar: myAvatar(), mode: me.mode, highestRound: me.round, highestScore: me.score, isMe: true });
      var norm = function (e) { return { playerName: e.playerName, avatar: e.avatar, pill: code(e.mode, e.highestRound), cls: e.mode, score: e.highestScore, isMe: e.isMe }; };
      return { sorted: sortRanking(all).map(norm), mine: me ? norm({ mode: me.mode, highestRound: me.round, highestScore: me.score }) : null, mineName: T('mole.pad.gameMole') };
    }
    function rhythmBoard() {
      var t = rhythmTop(view.type, rpSongs()[view.song].id), me = t.me;
      var norm = function (e) { return { playerName: e.playerName, avatar: e.avatar, pill: rpPill(e), cls: DIFF_CLASS[e.diff], score: e.score, isMe: e.isMe }; };
      return { sorted: t.all.map(norm), mine: me ? norm(me) : null, mineName: T('mole.pad.gameRhythm') + ' ' + T(view.type === 'B' ? 'mole.score.neon' : 'mole.score.beach') };
    }
    function render() {
      var board = view.game === 'rhythm' ? rhythmBoard() : moleBoard(), me = board.mine;
      var sorted = board.sorted;
      var myRank = 0; sorted.forEach(function (e, i) { if (e.isMe) myRank = i + 1; });
      var list = sorted.slice(0, 10);
      // TOP 3 — 배치 2위 · 1위 · 3위(가운데 1위가 가장 큼)
      top3.innerHTML = '';
      [2, 1, 3].forEach(function (place) { top3.appendChild(cardHtml(list[place - 1], place)); });
      // 4~10위
      rows.innerHTML = '';
      for (var r = 4; r <= 10; r++) {
        var e = list[r - 1];
        var row = document.createElement('div');
        row.className = 'sr-row' + (e ? '' : ' is-empty');
        // 4위 이하 = 두툼한 흰 카드(사용자 참고 이미지 구성, v778): 순위 · 아바타 · 이름/라운드 뱃지 · 오른쪽 점수 박스
        row.innerHTML = '<b class="sr-rank"></b><span class="sr-ava"><img alt=""></span><span class="sr-who"><span class="sr-name"></span><span class="sr-pill"></span></span>' +
          '<span class="sr-sbox"><i>SCORE</i><strong class="sr-score"></strong></span>';
        var rankLabel = row.querySelector('.sr-rank');
        rankLabel.textContent = String(r);
        rankLabel.style.whiteSpace = 'nowrap';
        var rankBaseline = document.createElement('span');
        rankBaseline.className = 'sr-rank-baseline'; rankBaseline.setAttribute('aria-hidden', 'true');
        rankBaseline.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;font-size:0;line-height:0';
        rankLabel.appendChild(rankBaseline);
        row.querySelector('.sr-ava img').src = e ? (e.avatar || 'assets/moles/mole1.png') : 'assets/moles/mole1.png';
        row.querySelector('.sr-name').textContent = e ? e.playerName : '—';
        row.querySelector('.sr-pill').textContent = e ? e.pill : '—';
        if (e) row.querySelector('.sr-pill').classList.add('sr-pill--' + e.cls);
        row.querySelector('.sr-score').textContent = e ? fmt(e.score) : '—';
        rows.appendChild(row);
      }
      if (!list.length) {
        var note = document.createElement('p');
        note.className = 'sr-empty';
        note.textContent = T('mole.score.empty');
        rows.appendChild(note);
      }
      // 내 순위
      mine.innerHTML = '<span class="sr-mine-lbl"><small></small><b></b></span><span class="sr-ava"><img alt=""></span>' +
        '<span class="sr-name"></span><span class="sr-pill"></span><strong class="sr-score"></strong>';
      mine.querySelector('small').textContent = T('mole.score.mine');
      mine.querySelector('.sr-mine-lbl b').textContent = myRank ? String(myRank) : '—';
      mine.querySelector('.sr-ava img').src = myAvatar();
      mine.querySelector('.sr-name').textContent = board.mineName;
      mine.querySelector('.sr-pill').textContent = me ? me.pill : '—';
      if (me) mine.querySelector('.sr-pill').classList.add('sr-pill--' + me.cls);
      mine.querySelector('.sr-score').textContent = me ? fmt(me.score) : '0';
      fitRows();
    }
    // Align the visible digit strokes, using this device's actual font metrics.
    function alignRankDigits() {
      if (el.hidden || !rows.clientHeight) return;
      if (!rankContext) rankContext = document.createElement('canvas').getContext('2d');
      if (!rankContext) return;
      var labels = Array.prototype.slice.call(rows.querySelectorAll('.sr-rank'));
      labels.forEach(function (label) { label.style.setProperty('--sr-rank-y', '0px'); });
      var corrections = labels.map(function (label) {
        var marker = label.querySelector('.sr-rank-baseline'); if (!marker) return null;
        var style = getComputedStyle(label);
        rankContext.font = style.font || (style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily);
        var metrics = rankContext.measureText(label.textContent);
        if (!Number.isFinite(metrics.actualBoundingBoxAscent) || !Number.isFinite(metrics.actualBoundingBoxDescent)) return null;
        var box = label.parentElement.getBoundingClientRect();
        var inkCenter = marker.getBoundingClientRect().top + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2;
        var delta = box.top + box.height / 2 - inkCenter;
        if (Math.abs(delta) > parseFloat(style.fontSize) * 0.25) return null;
        var scale = root.devicePixelRatio || 1;
        return { label: label, y: Math.round(delta * scale) / scale };
      });
      corrections.forEach(function (c) { if (c) c.label.style.setProperty('--sr-rank-y', c.y + 'px'); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { alignRankDigits(); }, function () {});
    // V1367 C(사용자 지정): 스크롤 목록이 반쯤 잘린 줄로 끝나지 않게 — 보이는 높이를 줄 간격의 배수로 맞춤(나머지는 아래 여백)
    function fitRows() {
      rows.style.flex = ''; rows.style.height = '';
      var first = rows.querySelector('.sr-row'); if (!first || !rows.clientHeight) return;
      var cs = getComputedStyle(rows), gap = parseFloat(cs.rowGap) || 0, padTop = parseFloat(cs.paddingTop) || 0;
      var pitch = first.offsetHeight + gap, n = Math.max(1, Math.floor((rows.clientHeight - padTop - 4 + gap) / pitch));
      rows.style.flex = '0 0 auto'; rows.style.height = (padTop + n * pitch - gap + Math.min(4, gap - 1)) + 'px'; // 다음 줄은 간격 안쪽에서 끝나 안 보임
      alignRankDigits();
    }
    var fitObs = new ResizeObserver(function () { if (!el.hidden) fitRows(); }); // 카드 그림이 늦게 뜨면 위쪽 높이가 바뀜 → 다시 맞춤
    fitObs.observe(el); fitObs.observe(top3); fitObs.observe(rp);
    var titleWrap = el.querySelector('.sr-title-wrap');
    if (titleWrap) fitObs.observe(titleWrap);
    function show() {
      view.game = 'mole';
      paintTabs(); render();
      // 진입 — 양탄자가 위에서 아래로 펼쳐진 뒤 UI 등장
      timers.forEach(clearTimeout); timers = [];
      closing = false;
      el.classList.remove('is-out', 'is-in'); void el.offsetWidth; el.classList.add('is-in');
    }
    return { show: show };
  }
  var api = { create: create, RankingSource: RankingSource, myBest: myBest, sortRanking: sortRanking, rpMyBest: rpMyBest, rpCmp: rpCmp };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScoreScreen = api; }
})(typeof window !== 'undefined' ? window : null);
