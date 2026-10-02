// 퀘스트(DAILY / WEEKLY) + 업적(ACHIEVEMENT: ROUND·SCORE·COMBO·MOLE) — 바탕화면 "퀘스트 UI 및 에셋" 시안 기준(v894).
// 일일 = 매일 자정 초기화, 주간 = 월요일 초기화(사용자 지정). 기록은 게임이 끝날 때 game.js 가 recordGame() 으로 넘김.
// 안전 규칙: 보상 지급 → 그다음 받음 표시 저장(일일출석과 같은 순서).
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var EN = function () { return root.FGH && root.FGH.I18N && root.FGH.I18N.lang === 'en'; };
  var KEY = 'mole.questV1';
  var A = 'assets/quest/';

  // ---- 데이터(수량·보상은 여기만 바꾸면 됨) ----
  var DAILY = [
    { id: 'play', icon: 'ic-pad', ko: ['두더지팡 플레이', '두더지팡을 3회 플레이하세요.'], en: ['Play MolePang', 'Play MolePang 3 times.'], goal: 3, stat: 'plays', reward: ['coin', 500] },
    { id: 'score', icon: 'ic-trophy', ko: ['30,000점 달성', '한 번의 플레이에서 30,000점을 달성하세요.'], en: ['Score 30,000', 'Score 30,000 in a single play.'], goal: 30000, stat: 'bestScore', reward: ['coin', 700] },
    { id: 'combo', icon: 'ic-fire', ko: ['100 COMBO 달성', '한 번의 플레이에서 100 COMBO를 달성하세요.'], en: ['Reach 100 COMBO', 'Reach 100 COMBO in a single play.'], goal: 100, stat: 'bestCombo', reward: ['heart', 2] }
  ];
  var WEEKLY = [
    { id: 'play', icon: 'ic-pad', ko: ['두더지팡 플레이', '두더지팡을 15회 플레이하세요.'], en: ['Play MolePang', 'Play MolePang 15 times.'], goal: 15, stat: 'plays', reward: ['coin', 1500] },
    { id: 'score', icon: 'ic-trophy', ko: ['30,000점 달성', '30,000점 이상을 달성한 플레이를 5회 하세요.'], en: ['Score 30,000', 'Score 30,000+ in 5 plays.'], goal: 5, stat: 'score30k', reward: ['ticket', 5] },
    { id: 'combo', icon: 'ic-fire', ko: ['100 COMBO 달성', '100 COMBO 이상을 달성한 플레이를 5회 하세요.'], en: ['Reach 100 COMBO', 'Reach 100+ COMBO in 5 plays.'], goal: 5, stat: 'combo100', reward: ['coin', 2000] }
  ];
  var ALL_REWARD = { daily: ['coin', 1000], weekly: ['ticket', 10] };
  var ACH_COINS = [300, 500, 700, 1000, 1500, 2000, 3000];
  var SHIELDS = ['gold', 'silver', 'bronze', 'bronze', 'silver', 'grey', 'grey', 'gold'];
  var ACH = {
    round: [1, 2, 3, 4, 5, 6, 7, 8],
    score: [30000, 50000, 100000, 150000, 200000, 300000, 500000, 1000000],   // 사용자 지정: 3만부터
    combo: [100, 200, 300, 400, 500, 600, 700, 800],                          // 사용자 지정: 100부터 100단위
    mole: [100, 500, 1000, 3000, 5000, 10000, 30000, 100000],
    rhythm: [0, 1, 2, 3, 4, 5, 6, 7] // v895(사용자 지정: 리듬팡은 업적만) — 아래 RHYTHM_ACH 순서
  };
  // 리듬팡 업적 8개: 판수·클리어·풀콤보·PERFECT 누적
  var RHYTHM_ACH = [
    { ko: ['리듬팡 첫 플레이', '리듬팡을 1회 플레이하세요.'], en: ['First RhythmPang', 'Play RhythmPang once.'], v: function (r) { return r.plays; }, goal: 1 },
    { ko: ['EASY 클리어', 'EASY 난이도를 클리어하세요.'], en: ['Clear EASY', 'Clear EASY difficulty.'], v: function (r) { return r.clear.EASY ? 1 : 0; }, goal: 1 },
    { ko: ['NORMAL 클리어', 'NORMAL 난이도를 클리어하세요.'], en: ['Clear NORMAL', 'Clear NORMAL difficulty.'], v: function (r) { return r.clear.NORMAL ? 1 : 0; }, goal: 1 },
    { ko: ['PERFECT 500개', 'PERFECT 판정을 누적 500개 받으세요.'], en: ['500 PERFECTs', 'Get 500 PERFECTs in total.'], v: function (r) { return r.perfect; }, goal: 500 },
    { ko: ['HARD 클리어', 'HARD 난이도를 클리어하세요.'], en: ['Clear HARD', 'Clear HARD difficulty.'], v: function (r) { return r.clear.HARD ? 1 : 0; }, goal: 1 },
    { ko: ['EASY 풀콤보', 'EASY를 MISS 없이 클리어하세요.'], en: ['EASY Full Combo', 'Clear EASY with no MISS.'], v: function (r) { return r.fc.EASY ? 1 : 0; }, goal: 1 },
    { ko: ['NORMAL 풀콤보', 'NORMAL을 MISS 없이 클리어하세요.'], en: ['NORMAL Full Combo', 'Clear NORMAL with no MISS.'], v: function (r) { return r.fc.NORMAL ? 1 : 0; }, goal: 1 },
    { ko: ['HARD 풀콤보', 'HARD를 MISS 없이 클리어하세요.'], en: ['HARD Full Combo', 'Clear HARD with no MISS.'], v: function (r) { return r.fc.HARD ? 1 : 0; }, goal: 1 }
  ];
  // v897(사용자 지정): ROUND 업적은 난이도(아마추어/노말/프로)별로 따로 — 보상 노말 1.5배·프로 2배
  var LV = ['easy', 'mid', 'legend'], LV_MULT = { easy: 1, mid: 1.5, legend: 2 };
  function achReward(i, lv) { var m = LV_MULT[lv || 'easy'] || 1; return i < 7 ? ['coin', Math.round(ACH_COINS[i] * m)] : ['ticket', Math.round(10 * m)]; }

  // ---- 저장 ----
  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function weekKey(d) { d = new Date(d || new Date()); var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return dayKey(d); } // 월요일 시작
  function read() {
    var s = null; try { s = JSON.parse(ls().getItem(KEY)); } catch (e) { s = null; }
    s = s || {};
    s.d = s.d || {}; s.w = s.w || {}; s.a = s.a || { bestScore: 0, bestCombo: 0, kills: 0, claimed: {} };
    s.a.claimed = s.a.claimed || {};
    s.r = s.r || { plays: 0, perfect: 0, clear: {}, fc: {} };
    if (s.d.key !== dayKey()) s.d = { key: dayKey(), plays: 0, bestScore: 0, bestCombo: 0, claimed: {} };
    if (s.w.key !== weekKey()) s.w = { key: weekKey(), plays: 0, score30k: 0, combo100: 0, claimed: {} };
    return s;
  }
  function save(s) { try { ls().setItem(KEY, JSON.stringify(s)); } catch (e) { /* 무시 */ } }

  function recordGame(r) {
    var s = read(), score = r.score | 0, combo = r.maxCombo | 0;
    s.d.plays++; s.d.bestScore = Math.max(s.d.bestScore, score); s.d.bestCombo = Math.max(s.d.bestCombo, combo);
    s.w.plays++; if (score >= 30000) s.w.score30k++; if (combo >= 100) s.w.combo100++;
    s.a.bestScore = Math.max(s.a.bestScore, score); s.a.bestCombo = Math.max(s.a.bestCombo, combo); s.a.kills += (r.kills | 0);
    save(s);
  }
  function recordRhythm(r) {
    var s = read(); s.r.plays++; s.r.perfect += (r.perfect | 0);
    if (r.clear) { s.r.clear[r.diff] = true; if ((r.miss | 0) === 0) s.r.fc[r.diff] = true; }
    save(s);
  }
  function give(rw) {
    if (rw[0] === 'coin') MG.Economy.addCoins(rw[1]);
    else if (rw[0] === 'heart') MG.Economy.addHearts(rw[1]);
    else if (rw[0] === 'ticket') MG.Economy.addTickets(rw[1]);
  }
  function maxRoundReached(lv) {
    var n = 0, P = MG.Progress;
    if (!P.isLightUnlocked(lv)) return 0;
    for (var c = 1; c <= P.MAX_CHAPTER; c++) if (P.isUnlocked(c, lv)) n = c;
    return n;
  }
  function round8Cleared(lv) { var P = MG.Progress; return P.get(P.MAX_CHAPTER, lv).cleared; }
  function achValue(tab, s) {
    if (tab === 'score') return s.a.bestScore; if (tab === 'combo') return s.a.bestCombo; if (tab === 'mole') return s.a.kills;
    return maxRoundReached(achLv);
  }
  function achDone(tab, i, s) {
    if (tab === 'rhythm') { var R = RHYTHM_ACH[i]; return R.v(s.r) >= R.goal; }
    if (tab === 'round' && i === 7) return round8Cleared(achLv);
    return achValue(tab, s) >= ACH[tab][i];
  }
  // 받을 수 있는 보상 개수(홈 배지 등에 쓸 수 있게)
  var achLv = 'easy'; // ROUND 탭에서 보고 있는 난이도
  function cKey(tab, i) { return tab === 'round' && achLv !== 'easy' ? 'round-' + achLv + i : tab + i; } // 아마추어는 기존 키 유지
  function claimable() {
    var s = read(), n = 0;
    [['d', DAILY], ['w', WEEKLY]].forEach(function (p) { p[1].forEach(function (q) { if (!s[p[0]].claimed[q.id] && (s[p[0]][q.stat] | 0) >= q.goal) n++; }); });
    var keep = achLv;
    Object.keys(ACH).forEach(function (tab) { (tab === 'round' ? LV : ['easy']).forEach(function (lv) { achLv = lv; ACH[tab].forEach(function (v, i) { if (!s.a.claimed[cKey(tab, i)] && achDone(tab, i, s)) n++; }); }); });
    achLv = keep;
    return n;
  }

  function fmt(n) { return (n | 0).toLocaleString('en-US'); }
  function rwIcon(rw) { return A + (rw[0] === 'coin' ? 'ic-coin' : rw[0] === 'heart' ? 'ic-heart' : 'ic-ticket') + '.png'; }

  function create(opts) {
    var el = opts.root, mode = 'daily', achTab = 'round';
    var $ = function (q) { return el.querySelector(q); };
    el.innerHTML =
      '<div class="qs-stage">' +
        '<div class="qs-head"><img class="qs-head-img" alt="">' +
          '<svg class="qs-title" viewBox="0 0 500 110" aria-hidden="true"><defs><linearGradient id="qsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff58a"/><stop offset="0.45" stop-color="#ffcf1f"/><stop offset="1" stop-color="#ff8a00"/></linearGradient></defs>' +
            '<text class="qs-t-sh" x="0" y="86" transform="translate(0 6)"></text><text class="qs-t-st" x="0" y="86"></text><text class="qs-t-fill" x="0" y="86" fill="url(#qsg)"></text></svg>' +
          '<button type="button" class="qs-x" data-qs-close aria-label="close"><img src="assets/workshop/pick/x.png" alt=""></button>' +
          '<div class="qs-tabs" data-qs-tabs></div>' +
        '</div>' +
        '<div class="qs-list" data-qs-list></div>' +
        '<button type="button" class="qs-achbtn" data-qs-ach><img src="' + A + 'ach-btn.png" alt=""><span></span></button>' +
      '</div>';
    $('[data-qs-close]').addEventListener('click', function () { if (mode === 'ach') { mode = 'daily'; render(); return; } if (root.FGH && root.FGH.rollOut) root.FGH.rollOut(el, opts.onClose); else opts.onClose(); }); // v898: 나갈 때 글리치
    $('[data-qs-ach]').addEventListener('click', function () { mode = mode === 'ach' ? 'daily' : 'ach'; render(); });

    function setTitle(txt) { el.querySelectorAll('.qs-title text').forEach(function (t) { t.textContent = txt; t.setAttribute('x', '250'); t.setAttribute('text-anchor', 'middle'); }); }
    function btnHtml(state) {
      if (state === 'done') return '<img class="qs-check" src="' + A + 'ic-check.png" alt="">';
      if (state === 'claim') return '<button type="button" class="qs-btn qs-btn--claim" data-qs-claim>' + (EN() ? 'Claim' : '받기') + '</button>';
      return '<button type="button" class="qs-btn qs-btn--go" data-qs-go>' + (EN() ? 'Go' : '바로가기') + '</button>';
    }
    function card(o) {
      return '<div class="qs-card qs-card--' + o.tone + (o.state === 'done' ? ' is-done' : '') + '">' +
        '<div class="qs-ico">' + o.icon + '</div>' +
        '<div class="qs-mid"><b class="qs-name">' + o.name + '</b><span class="qs-desc">' + o.desc + '</span>' +
          '<div class="qs-barrow"><span class="qs-cnt">' + o.cnt + '</span><i class="qs-bar"><i style="width:' + Math.min(100, o.pct) + '%"></i></i></div></div>' +
        '<div class="qs-rw"><div class="qs-rwline"><img src="' + rwIcon(o.rw) + '" alt=""><b>× ' + fmt(o.rw[1]) + '</b></div>' + btnHtml(o.state) + '</div>' +
      '</div>';
    }

    function render() {
      var s = read(), en = EN(), list = $('[data-qs-list]'), tabs = $('[data-qs-tabs]');
      el.setAttribute('data-mode', mode); el.setAttribute('data-lang', en ? 'en' : 'ko');
      $('.qs-head-img').src = A + (mode === 'ach' ? 'head-ach.png' : mode === 'weekly' ? 'head-weekly.png' : 'head-daily.png');
      setTitle(mode === 'ach' ? (en ? 'ACHIEVEMENT' : '업적') : (en ? 'QUEST' : '퀘스트')); // v896: 한글 모드는 한글
      $('[data-qs-ach] span').textContent = mode === 'ach' ? (en ? 'QUEST' : '퀘스트') : (en ? 'ACHIEVEMENT' : '업적');
      var html = '';
      if (mode !== 'ach') {
        tabs.innerHTML = '<button type="button" data-qs-mode="daily" class="' + (mode === 'daily' ? 'is-on' : '') + '">DAILY</button>' +
          '<button type="button" data-qs-mode="weekly" class="' + (mode === 'weekly' ? 'is-on' : '') + '">WEEKLY</button>';
        var key = mode === 'daily' ? 'd' : 'w', Q = mode === 'daily' ? DAILY : WEEKLY, st = s[key], tone = mode === 'daily' ? 'blue' : 'purple';
        var doneN = Q.filter(function (q) { return (st[q.stat] | 0) >= q.goal; }).length;
        html += '<div class="qs-card qs-card--sum qs-card--' + tone + '"><div class="qs-ico"><img src="' + A + 'ic-cal.png" alt=""></div>' +
          '<div class="qs-mid"><b class="qs-name">' + (mode === 'daily' ? (en ? "Today's Quests" : '오늘의 퀘스트') : (en ? "This Week's Quests" : '이번 주 퀘스트')) + '</b>' +
          '<span class="qs-desc">' + (en ? 'Complete 3 quests to get rewards!' : '3개의 퀘스트를 완료하고 보상을 받아요!') + '</span>' +
          '<div class="qs-barrow"><i class="qs-bar"><i style="width:' + (doneN / 3 * 100) + '%"></i></i></div></div><b class="qs-sumcnt">' + doneN + ' / 3</b></div>';
        Q.forEach(function (q) {
          var v = st[q.stat] | 0, ok = v >= q.goal, state = st.claimed[q.id] ? 'done' : ok ? 'claim' : 'go';
          html += card({ tone: q.stat === 'bestScore' || q.stat === 'bestCombo' ? (ok ? 'green' : tone) : tone, icon: '<img src="' + A + q.icon + '.png" alt="">', name: (en ? q.en : q.ko)[0], desc: (en ? q.en : q.ko)[1],
            cnt: fmt(Math.min(v, q.goal)) + ' / ' + fmt(q.goal), pct: v / q.goal * 100, rw: q.reward, state: state }).replace('<div class="qs-card ', '<div data-qs-q="' + q.id + '" class="qs-card ');
        });
        var all = doneN === 3, allSt = st.claimed.all ? 'done' : all ? 'claim' : 'lock', rw = ALL_REWARD[mode];
        html += '<div class="qs-all qs-all--' + mode + '"><img class="qs-all-gift" src="' + A + (mode === 'daily' ? 'gift-red' : 'gift-purple') + '.png" alt="">' +
          '<div class="qs-all-txt"><b>' + (mode === 'daily' ? 'DAILY' : 'WEEKLY') + ' ALL CLEAR</b><span>' + (mode === 'daily' ? (en ? 'Finish all daily quests for a bonus!' : '모든 일일 퀘스트를 완료하고 추가 보상을 받아요!') : (en ? 'Finish all weekly quests for a bonus!' : '모든 주간 퀘스트를 완료하고 추가 보상을 받아요!')) + '</span></div>' +
          '<div class="qs-all-rw"><div class="qs-rwline"><img src="' + (rw[0] === 'ticket' ? A + 'ticket-gold.png' : rwIcon(rw)) + '" alt=""><b>× ' + fmt(rw[1]) + '</b></div>' +
          (allSt === 'done' ? '<img class="qs-check" src="' + A + 'ic-check.png" alt="">' : allSt === 'claim' ? '<button type="button" class="qs-btn qs-btn--claim" data-qs-all>' + (en ? 'Claim' : '받기') + '</button>' : '<span class="qs-btn qs-btn--lock">' + (en ? 'Locked' : '미완료') + '</span>') + '</div></div>';
      } else {
        tabs.innerHTML = ['round', 'score', 'combo', 'mole', 'rhythm'].map(function (t) { return '<button type="button" data-qs-ach-tab="' + t + '" class="' + (achTab === t ? 'is-on' : '') + '">' + t.toUpperCase() + '</button>'; }).join('');
        if (achTab === 'round') html += '<div class="qs-lv">' + LV.map(function (lv) {
          var nm = { easy: en ? 'Amateur' : '아마추어', mid: en ? 'Normal' : '노말', legend: en ? 'Pro' : '프로' }[lv];
          var locked = !MG.Progress.isLightUnlocked(lv);
          return '<button type="button" data-qs-lv="' + lv + '" class="qs-lv-' + lv + (achLv === lv ? ' is-on' : '') + (locked ? ' is-lock' : '') + '">' + (locked ? '🔒 ' : '') + nm + '</button>'; }).join('') + '</div>';
        var val = achValue(achTab, s);
        ACH[achTab].forEach(function (goal, i) {
          var ok = achDone(achTab, i, s), state = s.a.claimed[cKey(achTab, i)] ? 'done' : ok ? 'claim' : 'lock';
          var name, desc, cnt, pct;
          if (achTab === 'rhythm') {
            var RA = RHYTHM_ACH[i], rv = RA.v(s.r);
            name = (en ? RA.en : RA.ko)[0]; desc = (en ? RA.en : RA.ko)[1]; cnt = fmt(Math.min(rv, RA.goal)) + ' / ' + fmt(RA.goal); pct = rv / RA.goal * 100;
          } else if (achTab === 'round') {
            name = i === 7 ? (en ? 'Clear ROUND 8' : 'ROUND 8 클리어') : (en ? 'Reach ROUND ' + goal : 'ROUND ' + goal + ' 도달');
            desc = i === 7 ? (en ? 'Clear ROUND 8.' : 'ROUND 8을 클리어하세요.') : (en ? 'Reach ROUND ' + goal + '.' : 'ROUND ' + goal + '에 도달하세요.');
            cnt = (ok ? 1 : 0) + ' / 1'; pct = ok ? 100 : 0;
          } else {
            var lbl = achTab === 'score' ? (en ? ' pts' : '점') : achTab === 'combo' ? ' COMBO' : (en ? ' moles' : '마리');
            name = fmt(goal) + lbl + (achTab === 'mole' ? (en ? ' defeated' : ' 처치') : (en ? '' : ' 달성'));
            desc = achTab === 'score' ? (en ? 'Score ' + fmt(goal) + ' in one play.' : '한 번의 플레이에서 ' + fmt(goal) + '점을 달성하세요.') :
              achTab === 'combo' ? (en ? 'Reach ' + goal + ' COMBO in one play.' : '한 번의 플레이에서 ' + goal + ' COMBO를 달성하세요.') :
              (en ? 'Defeat ' + fmt(goal) + ' moles in total.' : '두더지를 누적 ' + fmt(goal) + '마리 처치하세요.');
            cnt = fmt(Math.min(val, goal)) + ' / ' + fmt(goal); pct = val / goal * 100;
          }
          html += card({ tone: 'green', icon: '<span class="qs-shield" style="background-image:url(' + A + 'sh-' + SHIELDS[i] + '.png)">' + (i + 1) + '</span>',
            name: name, desc: desc, cnt: cnt, pct: pct, rw: achReward(i, achTab === 'round' ? achLv : 'easy'), state: state === 'lock' ? 'lock' : state })
            .replace('<div class="qs-card ', '<div data-qs-a="' + i + '" class="qs-card ').replace(/<button type="button" class="qs-btn qs-btn--go" data-qs-go>[^<]*<\/button>/, state === 'lock' ? '' : '$&');
        });
      }
      list.innerHTML = html;
      list.querySelectorAll('[data-qs-go]').forEach(function (b) { b.addEventListener('click', function () { opts.onPlay(); }); });
      list.querySelectorAll('[data-qs-claim]').forEach(function (b) {
        b.addEventListener('click', function () {
          var c = b.closest('.qs-card'), s2 = read();
          if (c.hasAttribute('data-qs-q')) {
            var key = mode === 'daily' ? 'd' : 'w', Q = mode === 'daily' ? DAILY : WEEKLY, q = Q.filter(function (x) { return x.id === c.getAttribute('data-qs-q'); })[0];
            if (!q || s2[key].claimed[q.id] || (s2[key][q.stat] | 0) < q.goal) return;
            give(q.reward); s2[key].claimed[q.id] = true;
          } else {
            var i = +c.getAttribute('data-qs-a'); if (s2.a.claimed[cKey(achTab, i)] || !achDone(achTab, i, s2)) return;
            give(achReward(i, achTab === 'round' ? achLv : 'easy')); s2.a.claimed[cKey(achTab, i)] = true;
          }
          save(s2); pop(b); render(); if (opts.onChange) opts.onChange();
        });
      });
      var allBtn = list.querySelector('[data-qs-all]');
      if (allBtn) allBtn.addEventListener('click', function () {
        var s2 = read(), key = mode === 'daily' ? 'd' : 'w'; if (s2[key].claimed.all) return;
        give(ALL_REWARD[mode]); s2[key].claimed.all = true; save(s2); pop(allBtn); render(); if (opts.onChange) opts.onChange();
      });
      tabs.querySelectorAll('[data-qs-mode]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-qs-mode'); render(); }); });
      list.querySelectorAll('[data-qs-lv]').forEach(function (b) { b.addEventListener('click', function () { achLv = b.getAttribute('data-qs-lv'); render(); }); });
      tabs.querySelectorAll('[data-qs-ach-tab]').forEach(function (b) { b.addEventListener('click', function () { achTab = b.getAttribute('data-qs-ach-tab'); render(); }); });
      el.querySelectorAll('.qs-btn, .qs-x, .qs-achbtn, .qs-tabs button').forEach(function (b) {
        b.addEventListener('pointerdown', function () { b.classList.add('is-press'); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-press'); }); });
      });
    }
    function pop(b) { try { MG.HitFx && MG.HitFx.uiTap && MG.HitFx.uiTap(1); } catch (e) { /* 무시 */ } }
    function show() { mode = 'daily'; achTab = 'round'; achLv = 'easy'; render(); }
    return { show: show, render: render };
  }
  var api = { create: create, recordGame: recordGame, recordRhythm: recordRhythm, claimable: claimable, DAILY: DAILY, WEEKLY: WEEKLY, ACH: ACH };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Quest = api; }
})(typeof window !== 'undefined' ? window : null);
