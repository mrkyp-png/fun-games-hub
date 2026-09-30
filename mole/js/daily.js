// 일일출석(DAILY REWARD) — 바탕화면 "일일출석 UI 및 에셋/MOLE_PANG_일일출석_최종_명세서" 기준(v748).
// 7일 사이클, 하루 1회 기본 보상, 광고 ×2(광고 완료 확인 후 1회), Day 7 = 선물상자 랜덤(일반 80 / 스킬 20).
// 빠진 날은 건너뛰고 다음 접속일에 다음 Day 를 받는다(사용자 지정 — 1일차로 초기화하지 않음).
// 안전 규칙: 보상 지급 성공 → 그다음 출석 완료 저장. 처리 중(busy)엔 모든 입력 잠금.
// Day 7 랜덤 결과는 연출 전에 먼저 정해 pending7 로 저장 — 연출 중 앱이 꺼져도 결과가 바뀌지 않는다.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var KEY = 'mole.dailyV2';

  // ---- 보상 설정(데이터) — 수량·확률은 여기만 바꾸면 된다(명세 §3, §4, §20) ----
  var CONFIG = {
    cycle: 7,
    rewards: [
      { type: 'coin', n: 500, icon: 'item-coin-s.png' },
      { type: 'heart', n: 3, icon: 'item-heart.png' },
      { type: 'ticket', n: 5, icon: 'item-ticket.png' },
      { type: 'coin', n: 1000, icon: 'item-coin-m.png' },
      { type: 'skill', n: 1, icon: 'item-skill.png' },
      { type: 'coin', n: 1500, icon: 'item-coin-l.png' },
      { type: 'random', icon: 'item-gift.png' }
    ],
    day7: {
      normalWeight: 80, skillWeight: 20,
      // 일반 그룹 — 임시값(사용자 지정: 균등). weight 만 바꾸면 비율 조정.
      normalPool: [
        { type: 'coin', n: 1000, weight: 1 },
        { type: 'heart', n: 3, weight: 1 },
        { type: 'ticket', n: 5, weight: 1 }
      ]
    }
  };
  var ICON_BY_TYPE = { coin: 'item-coin-m.png', heart: 'item-heart.png', ticket: 'item-ticket.png', skill: 'item-skill.png' };
  var ASSET = 'assets/daily/';

  function dstr(ms) { var d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function today() { return dstr(Date.now()); }

  function read() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    if (s && s.day) return s;
    // 옛 출석 기록(mole.daily = {streak, lastClaim}) 이어받기 — 받은 날 다음 Day 부터.
    var old = null;
    try { old = JSON.parse(localStorage.getItem('mole.daily')); } catch (e) { old = null; }
    var day = (old && old.streak) ? (old.streak % 7) + 1 : 1;
    return { day: day, lastClaim: (old && old.lastClaim) || '', lastReward: null, adDoubled: '', pending7: null };
  }
  function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function pickWeighted(list) {
    var total = list.reduce(function (a, x) { return a + (x.weight || 1); }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) { r -= (list[i].weight || 1); if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  function randomSkillId() {
    // 스킬 등급 체계가 아직 없어 전체 스킬 균등(임시, 사용자 지정) — 등급이 생기면 여기서 등급 확률 적용.
    var all = MG.Skills.activeSkills().concat(MG.Skills.passiveSkills());
    return all[Math.floor(Math.random() * all.length)].id;
  }
  // 설정의 보상 한 칸 → 실제 지급할 결과 {type, n, skillId?}
  function resolve(rw) {
    if (rw.type === 'skill') return { type: 'skill', n: rw.n, skillId: randomSkillId() };
    if (rw.type === 'random') {
      var d7 = CONFIG.day7;
      if (Math.random() * (d7.normalWeight + d7.skillWeight) < d7.normalWeight) {
        var p = pickWeighted(d7.normalPool);
        return { type: p.type, n: p.n };
      }
      return { type: 'skill', n: 1, skillId: randomSkillId() };
    }
    return { type: rw.type, n: rw.n };
  }

  // 실제 인벤토리에 지급하고, 늘어났는지 확인(명세 §19, §28). 실패하면 예외.
  function grant(res) {
    var E = MG.Economy, before, after;
    if (res.type === 'coin') { before = E.getCoins(); E.addCoins(res.n); after = E.getCoins(); }
    else if (res.type === 'heart') { before = E.getHearts(); E.addHearts(res.n); after = E.getHearts(); }
    else if (res.type === 'ticket') { before = E.getTickets(); E.addTickets(res.n); after = E.getTickets(); }
    else if (res.type === 'skill') { before = MG.Skills.getQuantity(res.skillId); MG.Skills.addQuantity(res.skillId, res.n); after = MG.Skills.getQuantity(res.skillId); }
    // 티켓은 보유 상한(TICKET_MAX)이 있어, 상한에 닿아 있으면 늘지 않는 게 정상 — 줄지만 않으면 지급 성공으로 본다.
    if (res.type === 'ticket' ? !(after >= before) : !(after > before)) throw new Error('grant failed');
  }

  function rewardName(res) {
    if (res.type === 'skill') {
      var sk = MG.Skills.skillById(res.skillId);
      if (sk) return root.FGH.I18N.lang === 'en' ? sk.nameEn : sk.nameKo;
    }
    return T('mole.daily.r.' + res.type);
  }
  function rewardIcon(res) {
    if (res.type === 'skill') { var sk = MG.Skills.skillById(res.skillId); if (sk) return sk.icon; }
    return ASSET + ICON_BY_TYPE[res.type];
  }

  function create(opts) {
    var el = opts.root;
    var grid = el.querySelector('[data-daily-grid]');
    var claimBtn = el.querySelector('[data-daily-claim]');
    var adBtn = el.querySelector('[data-daily-2x]');
    var gift = el.querySelector('[data-daily-gift]');
    var toastEl = el.querySelector('[data-daily-toast]');
    var busy = false;
    var timers = [];
    el.querySelector('[data-back="daily"]').addEventListener('click', function () {
      if (busy) return; // 지급·연출 중엔 나가지 않음(중복 지급/상태 꼬임 방지, §18)
      // v790(사용자 지정): 화면 전체가 위로 말려 올라가며 사라짐
      root.FGH.rollOut(el, opts.onClose);
    });

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function claimableToday() { return read().lastClaim !== today(); }

    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.hidden = false;
      toastEl.classList.remove('is-on'); void toastEl.offsetWidth; toastEl.classList.add('is-on');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { toastEl.hidden = true; }, 1800);
    }

    // 7장 카드 — 상태: claimed / available / next(내일 받을 Day) / locked
    function stateOf(i, st, claimable) {
      if (i < st.day) return 'claimed';
      if (i === st.day) return claimable ? 'available' : 'next';
      return 'locked';
    }
    function show() {
      var st = read();
      var claimable = st.lastClaim !== today();
      // 이미 받은 날이면 오늘 받은 Day 는 방금 넘어간 day-1 — 7일차를 받은 날엔 사이클이 1로 돌아가 있으니 전부 완료로 보여준다.
      var cycleDone = !claimable && st.day === 1 && st.lastReward;
      grid.innerHTML = '';
      for (var i = 1; i <= CONFIG.cycle; i++) {
        var rw = CONFIG.rewards[i - 1];
        var s = cycleDone ? 'claimed' : stateOf(i, st, claimable);
        var card = document.createElement('div');
        card.className = 'dr-card dr-card--' + s + (i === 7 ? ' dr-card--d7' : '');
        card.dataset.day = String(i);
        card.dataset.stamp = T('mole.daily.stamp'); // 받은 날 도장 글자(v766)
        card.innerHTML =
          '<span class="dr-day"></span>' +
          '<img class="dr-ico" alt="" src="' + ASSET + rw.icon + '">' +
          '<b class="dr-qty"></b>' +
          '<span class="dr-status"></span>';
        card.querySelector('.dr-day').textContent = T('mole.daily.day', { n: i });
        card.querySelector('.dr-qty').textContent = rw.type === 'random' ? T('mole.daily.random') : '× ' + rw.n.toLocaleString();
        card.querySelector('.dr-status').textContent =
          s === 'claimed' ? '✓ ' + T('mole.daily.claimedTag')
          : s === 'available' ? T('mole.daily.get')
          : s === 'next' ? T('mole.daily.tomorrow') : T('mole.daily.locked');
        if (s === 'available') card.addEventListener('click', claim);
        grid.appendChild(card);
      }
      claimBtn.disabled = busy || !claimable;
      claimBtn.querySelector('span').textContent = claimable ? T('mole.daily.claimBtn') : T('mole.daily.claimedBtn');
      var adReady = !claimable && st.lastReward && st.adDoubled !== today();
      adBtn.disabled = busy || !adReady;
      adBtn.classList.toggle('is-done', !claimable && st.adDoubled === today());
      adBtn.querySelector('span').innerHTML = '';
      if (!claimable && st.adDoubled === today()) {
        adBtn.querySelector('span').textContent = T('mole.daily.adDone');
      } else {
        var a = document.createElement('small'); a.textContent = T('mole.daily.adBtn1');
        var b = document.createElement('b'); b.textContent = T('mole.daily.adBtn2');
        adBtn.querySelector('span').append(a, b);
      }
    }

    function commit(st, res) {
      st.lastReward = res;
      st.lastClaim = today();
      st.adDoubled = '';
      st.pending7 = null;
      st.day = (st.day % CONFIG.cycle) + 1;
      write(st);
    }

    function claim() {
      if (busy || !claimableToday()) return;
      busy = true;
      var st = read();
      var rw = CONFIG.rewards[st.day - 1];
      show(); // 버튼 잠금 반영
      if (rw.type === 'random') {
        // 결과를 먼저 확정·저장 — 연출 중 앱이 꺼져도 다음에 같은 결과(§34)
        if (!st.pending7) { st.pending7 = resolve(rw); write(st); }
        playGift(st.pending7, function () {
          try { grant(st.pending7); } catch (e) { busy = false; show(); toast(T('mole.daily.err')); return false; }
          var res = st.pending7;
          commit(st, res);
          if (opts.onChange) opts.onChange();
          return true;
        });
        return;
      }
      var res = resolve(rw);
      try { grant(res); } catch (e) { busy = false; show(); toast(T('mole.daily.err')); return; }
      commit(st, res);
      busy = false;
      show();
      toast(T('mole.daily.got', { name: rewardName(res), n: res.n.toLocaleString() }));
      var card = grid.querySelector('[data-day="' + (st.day === 1 ? 7 : st.day - 1) + '"]');
      if (card) { card.classList.add('dr-card--pop'); flyIcons(card, rewardIcon(res)); }
      if (opts.onChange) opts.onChange();
    }
    claimBtn.addEventListener('click', claim);

    adBtn.addEventListener('click', function () {
      var st = read();
      if (busy || st.lastClaim !== today() || !st.lastReward || st.adDoubled === today()) return;
      busy = true;
      show();
      var settled = false;
      MG.Ads.rewarded().then(function (ok) {
        if (settled) return; // 완료 콜백 중복 방지(§35)
        settled = true;
        var cur = read();
        if (ok && cur.adDoubled !== today()) {
          try {
            grant(cur.lastReward);
            cur.adDoubled = today();
            write(cur);
            toast(T('mole.daily.got', { name: rewardName(cur.lastReward), n: cur.lastReward.n.toLocaleString() }));
            if (opts.onChange) opts.onChange();
          } catch (e) { toast(T('mole.daily.err')); }
        }
        busy = false;
        show();
      });
    });

    // Day 7 선물상자 연출(§17): 닫힌 상자 흔들림 → 반짝 → 뚜껑 열림 → 빛 → 아이템 등장 → 결과 → 지급 확정.
    function playGift(res, onReveal) {
      var box = gift.querySelector('.dr-gift-box');
      var rays = gift.querySelector('.dr-gift-rays');
      var item = gift.querySelector('.dr-gift-item');
      var txt = gift.querySelector('.dr-gift-txt');
      var ok = gift.querySelector('.dr-gift-ok');
      gift.hidden = false;
      gift.className = 'dr-gift';
      box.src = ASSET + 'gift-closed.png';
      item.src = rewardIcon(res);
      txt.textContent = '';
      ok.hidden = true;
      void gift.offsetWidth;
      gift.classList.add('is-shake');
      later(function () { gift.classList.remove('is-shake'); box.src = ASSET + 'gift-opening.png'; gift.classList.add('is-spark'); }, 1100);
      later(function () { box.src = ASSET + 'gift-open.png'; gift.classList.add('is-open'); }, 1450);
      later(function () {
        var granted = onReveal();
        if (!granted) { gift.hidden = true; return; }
        gift.classList.add('is-item');
        txt.textContent = T('mole.daily.got', { name: rewardName(res), n: res.n.toLocaleString() });
        later(function () { ok.hidden = false; }, 500);
      }, 1900);
      ok.onclick = function () {
        gift.hidden = true;
        busy = false;
        show();
      };
    }

    function cleanup() {
      timers.forEach(clearTimeout); timers = [];
      if (!gift.hidden && busy) {
        // 연출 도중 화면을 벗어나는 경우는 막혀 있지만, 혹시 남으면 정리 — 상태는 저장된 값 기준으로 다시 그린다.
        gift.hidden = true; busy = false;
      }
    }

    // ① 화면 열 때 카드가 1일차부터 차례로 뒤집히며 등장(사용자 지정 v766) — 외부에서 여는 경우만
    var enterT = null;
    function open() {
      show();
      grid.classList.remove('is-enter'); void grid.offsetWidth; grid.classList.add('is-enter');
      clearTimeout(enterT); enterT = setTimeout(function () { grid.classList.remove('is-enter'); }, 1700);
    }
    // ② 받기 순간 보상 아이콘이 카드에서 여러 개 튀어나와 위(간판 쪽)로 날아가 사라짐
    function flyIcons(card, src) {
      var host = el.querySelector('.dr-stage'); if (!card || !host) return;
      var hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect();
      for (var i = 0; i < 8; i++) {
        var im = document.createElement('img');
        im.className = 'dr-fly'; im.src = src; im.alt = '';
        im.style.left = (cr.left - hr.left + cr.width / 2) + 'px';
        im.style.top = (cr.top - hr.top + cr.height / 2) + 'px';
        im.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px');
        im.style.setProperty('--ty', (-(cr.top - hr.top) + 40).toFixed(0) + 'px');
        im.style.animationDelay = (i * 0.06).toFixed(2) + 's';
        host.appendChild(im);
        (function (im) { setTimeout(function () { im.remove(); }, 1500); })(im);
      }
    }
    return { show: open, claimableToday: claimableToday, cleanup: cleanup };
  }
  var api = { create: create, CONFIG: CONFIG };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Daily = api; }
})(typeof window !== 'undefined' ? window : null);
