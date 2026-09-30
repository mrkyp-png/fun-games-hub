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
  function myAvatar() { return localStorage.getItem('mole.profilePic') || 'assets/moles/mole1.png'; }
  function fmt(n) { return (n || 0).toLocaleString('en-US'); }

  function create(opts) {
    var el = opts.root;
    var top3 = el.querySelector('[data-sr-top3]');
    var rows = el.querySelector('[data-sr-rows]');
    var mine = el.querySelector('[data-sr-mine]');
    var toastEl = el.querySelector('[data-sr-toast]');
    var closing = false, timers = [];
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
    el.querySelector('[data-sr-game="rhythm"]').addEventListener('click', function () {
      toast(T('mole.score.rhythmSoon')); // 개발 중 — 진입 불가(§13)
    });

    function cardHtml(entry, place) {
      var c = document.createElement('div');
      c.className = 'sr-card sr-card--' + place + (entry ? '' : ' is-empty');
      c.innerHTML = '<img class="sr-card-bg" alt="" src="assets/score/card-' + place + '.png">' +
        '<div class="sr-card-body"><span class="sr-ava"><img alt=""></span><b class="sr-name"></b><span class="sr-pill"></span><strong class="sr-score"></strong></div>';
      c.querySelector('.sr-ava img').src = entry ? (entry.avatar || 'assets/moles/mole1.png') : 'assets/moles/mole1.png';
      c.querySelector('.sr-name').textContent = entry ? entry.playerName : '—';
      c.querySelector('.sr-pill').textContent = entry ? code(entry.mode, entry.highestRound) : '—';
      if (entry) c.querySelector('.sr-pill').classList.add('sr-pill--' + entry.mode);
      c.querySelector('.sr-score').textContent = entry ? fmt(entry.highestScore) : '—';
      return c;
    }

    function show() {
      // v785(사용자 지정): 내 최고 기록도 랭킹에 넣어 순위대로 표시(서버 전엔 나 혼자라 1위)
      var me = myBest();
      var all = RankingSource.top('mole_pang').slice();
      if (me) all.push({ playerName: T('mole.score.me'), avatar: myAvatar(), mode: me.mode, highestRound: me.round, highestScore: me.score, isMe: true });
      var sorted = sortRanking(all);
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
        row.querySelector('.sr-rank').textContent = String(r);
        row.querySelector('.sr-ava img').src = e ? (e.avatar || 'assets/moles/mole1.png') : 'assets/moles/mole1.png';
        row.querySelector('.sr-name').textContent = e ? e.playerName : '—';
        row.querySelector('.sr-pill').textContent = e ? code(e.mode, e.highestRound) : '—';
        if (e) row.querySelector('.sr-pill').classList.add('sr-pill--' + e.mode);
        row.querySelector('.sr-score').textContent = e ? fmt(e.highestScore) : '—';
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
      mine.querySelector('.sr-name').textContent = T('mole.pad.gameMole');
      mine.querySelector('.sr-pill').textContent = me ? code(me.mode, me.round) : '—';
      if (me) mine.querySelector('.sr-pill').classList.add('sr-pill--' + me.mode);
      mine.querySelector('.sr-score').textContent = me ? fmt(me.score) : '0';
      // 진입 — 양탄자가 위에서 아래로 펼쳐진 뒤 UI 등장
      timers.forEach(clearTimeout); timers = [];
      closing = false;
      el.classList.remove('is-out', 'is-in'); void el.offsetWidth; el.classList.add('is-in');
    }
    return { show: show };
  }
  var api = { create: create, RankingSource: RankingSource, myBest: myBest, sortRanking: sortRanking };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScoreScreen = api; }
})(typeof window !== 'undefined' ? window : null);
