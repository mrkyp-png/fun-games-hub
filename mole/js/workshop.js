// 제작소 합성(무기/코스튬) 전체화면 — 바탕화면 "제작소 UI 및 에셋/명세서" 기준(v750).
// 규칙: 같은 종류끼리만(대상 +N + 재료 +0), 비용 7,777 코인 고정, 최대 +5,
// 확률 +0→1 50 / +1→2 45 / +2→3 40 / +3→4 35 / +4→5 30%. 실패해도 비용·재료 소비, 단계 유지.
// 결과는 합성 실행 순간 판정·저장(코인·재료·단계 한 번에) 후 연출만 재생 — 연출 중 앱이 꺼져도 중복·손실 없음.
// 연출: 황금거위(10포즈) 날갯짓·상승·퇴장 → 황금알 낙하·안착 → 균열 → 3번째 알에서 골드 묠니르+녹색 번개 타격
//       → 성공(에셋3)/실패(에셋4) 알 → 결과 공개.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var A = 'assets/workshop/';
  var COST = 7777, MAX = 5;
  var RATE = [50, 45, 40, 35, 30];
  var GLOW = ['', '#ffe24a', '#4aa8ff', '#b35cff', '#ff9a2e', '#ff3b3b']; // 단계별 강화 Glow(별도 VFX 레이어)

  // ⚠️ 개발용 기본 재료 수량 — 아직 재료 획득 경로(상점·보상)가 없어 테스트용으로 50개씩.
  //    획득 경로가 생기면 DEV_MATERIALS = 0 으로.
  var DEV_MATERIALS = 50;
  // ⚠️ 개발용: 재료 10개씩 1회 재지급(사용자 요청 v758) — 저장된 재료 수를 지워 기본값(10)으로. 출시 전 삭제
  try {
    if (!localStorage.getItem('mole.devMatGrant1')) {
      Object.keys(localStorage).filter(function (k) { return k.indexOf('mole.ws.mat.') === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      localStorage.setItem('mole.devMatGrant1', '1');
    }
  } catch (e) { /* 무시 */ }

  // ⚠️ 개발용(사용자 요청 v761): 코인 1,000,000 · 재료 50개씩 · 무기/코스튬 강화 단계 +0 초기화 — 1회. 출시 전 삭제
  try {
    if (!localStorage.getItem('mole.devGrant2')) {
      localStorage.setItem('mole.coins', '1000000');
      Object.keys(localStorage).filter(function (k) { return k.indexOf('mole.ws.mat.') === 0 || k.indexOf('mole.weapon.level.') === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
      if (root.MoleGame && root.MoleGame.CostumeTeams) root.MoleGame.CostumeTeams.teams().forEach(function (t) { root.MoleGame.CostumeTeams.setEnhanceLevel(t.id, 0); });
      localStorage.setItem('mole.devGrant2', '1');
    }
  } catch (e) { /* 무시 */ }

  // ⚠️ 개발용(사용자 요청 v955): 무기·코스튬 강화 단계만 +0 으로 1회 초기화(코인·재료는 그대로). 출시 전 삭제
  try {
    if (!localStorage.getItem('mole.devResetLv3')) {
      Object.keys(localStorage).filter(function (k) { return k.indexOf('mole.weapon.level.') === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      if (root.MoleGame && root.MoleGame.CostumeTeams) root.MoleGame.CostumeTeams.teams().forEach(function (t) { root.MoleGame.CostumeTeams.setEnhanceLevel(t.id, 0); });
      localStorage.setItem('mole.devResetLv3', '1');
    }
  } catch (e) { /* 무시 */ }

  var WEAPONS = [
    { id: 'cannon', ko: '팡팡 캐논', en: 'Pang Pang Cannon', img: A + 'w-cannon.png', done: A + 'w-cannon-front.png' },
    { id: 'goldhammer', ko: '골드 묠니르', en: 'Gold Mjolnir', img: A + 'w-goldhammer.png', done: A + 'w-goldhammer.png' },
    { id: 'alipunch', ko: '알리 판취', en: 'Ali Punch', img: A + 'w-alipunch.png', done: A + 'w-alipunch.png' } // 글러브 두 짝 — v891: 여백 잘라 캐논과 비슷한 크기(사용자 지정)
  ];

  // ---- 저장(단일 기준값) ----
  function weaponLevel(id) { var n = parseInt(localStorage.getItem('mole.weapon.level.' + id), 10); return n >= 0 && n <= MAX ? n : 0; }
  function setWeaponLevel(id, n) { localStorage.setItem('mole.weapon.level.' + id, String(Math.max(0, Math.min(MAX, n)))); }
  function matKey(kind, id) { return 'mole.ws.mat.' + kind + '.' + id; }
  function materials(kind, id) {
    var v = localStorage.getItem(matKey(kind, id));
    var n = v == null ? DEV_MATERIALS : parseInt(v, 10);
    return n > 0 ? n : 0;
  }
  function setMaterials(kind, id, n) { localStorage.setItem(matKey(kind, id), String(Math.max(0, n | 0))); }
  function levelOf(kind, id) { return kind === 'weapon' ? weaponLevel(id) : MG.CostumeTeams.enhanceLevel(id); }
  function setLevel(kind, id, n) { if (kind === 'weapon') setWeaponLevel(id, n); else MG.CostumeTeams.setEnhanceLevel(id, n); }
  // 게임 연동: 무기 스킬 발동 확률 +단계×1%p
  function weaponChanceBonus(id) { return weaponLevel(id) * 0.01; }

  function items(kind) {
    if (kind === 'weapon') return WEAPONS;
    // v784(사용자 지정): 5팀 전부 표시(미보유 = 클라우드 컵스 등도 목록에 — 합성은 보유해야 가능)
    return MG.CostumeTeams.teams().map(function (t) {
      return { id: t.id, ko: t.nameKo, en: t.nameEn, owned: MG.CostumeTeams.owns(t.id), img: 'assets/costume/char-' + t.id + '-detail.png', done: 'assets/costume/char-' + t.id + '-detail.png' };
    });
  }
  function nameOf(it) { return root.FGH.I18N.lang === 'en' ? it.en : it.ko; }

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var tab = 'weapon', idx = { weapon: 0, costume: 0 };
    var running = false, timers = [], selMat = null, pending = null;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function cur() { var list = items(tab); if (!list.length) return null; idx[tab] = (idx[tab] + list.length) % list.length; return list[idx[tab]]; }

    function setItemImg(img, glowEl, src, level) {
      img.src = src;
      glowEl.style.setProperty('--glow', GLOW[level] || 'transparent');
      glowEl.classList.toggle('has-glow', level > 0);
    }

    function render() {
      el.querySelectorAll('[data-ws-tab]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.wsTab === tab); });
      var it = cur();
      var lv = it ? levelOf(tab, it.id) : 0;
      var mats = it ? materials(tab, it.id) : 0;
      var coins = MG.Economy.getCoins();
      $('[data-ws-target-name]').textContent = it ? nameOf(it) : '—';
      $('[data-ws-target-lv]').textContent = '+' + lv;
      setItemImg($('[data-ws-target-img]'), $('[data-ws-target]'), it ? it.img : '', lv);
      // 재료 칸: 재료 선택 팝업에서 고른 뒤에만 올라감(사용자 지정 v758)
      if (!it || selMat !== it.id || !mats) selMat = null;
      $('[data-ws-mat-img]').src = it && (selMat || !mats) ? it.img : '';
      $('[data-ws-mat]').classList.toggle('is-empty', !mats);
      $('[data-ws-mat]').classList.toggle('is-unsel', !!mats && !selMat);
      $('[data-ws-mat-lv]').textContent = ''; // 재료는 +0 표기 안 함(사용자 지정 v758)
      $('[data-ws-mat-n]').textContent = T('mole.ws.have', { n: mats });
      $('[data-ws-rate]').textContent = lv >= MAX ? 'MAX' : RATE[lv] + '%';
      $('[data-ws-cost]').textContent = COST.toLocaleString('en-US');
      $('[data-ws-coins]').textContent = coins.toLocaleString('en-US');
      $('[data-ws-coins]').classList.toggle('is-short', coins < COST);
      var notOwned = !!it && it.owned === false;
      $('[data-ws-target]').classList.toggle('is-notowned', notOwned);
      var ok = !!it && !notOwned && lv < MAX && mats > 0 && !!selMat && coins >= COST && !running;
      $('[data-ws-go]').disabled = !ok;
      $('[data-ws-notice]').textContent = !it ? T('mole.ws.noItem')
        : notOwned ? T('mole.ws.notOwned')
        : lv >= MAX ? T('mole.ws.maxed')
        : !mats ? T('mole.ws.noMat')
        : coins < COST ? T('mole.ws.noCoin')
        : !selMat ? T('mole.ws.pickHint')
        : T(tab === 'weapon' ? 'mole.ws.ruleWeapon' : 'mole.ws.ruleCostume');
      el.querySelectorAll('[data-ws-arrow]').forEach(function (b) { b.hidden = true; }); // v800: 화살표 대신 밀어서 넘기기(사용자 지정)
      var dots = $('[data-ws-dots]'), n = items(tab).length;
      dots.innerHTML = ''; dots.hidden = n < 2;
      for (var di = 0; di < n; di++) { var dd = document.createElement('i'); if (di === idx[tab]) dd.className = 'is-on'; dots.appendChild(dd); }
      $('[data-ws-target]').classList.toggle('is-swipeable', n > 1);
    }

    el.querySelectorAll('[data-ws-tab]').forEach(function (b) {
      b.addEventListener('click', function () { if (running) return; tab = b.dataset.wsTab; selMat = null; render(); });
    });
    // v800(사용자 지정): 합성 대상 원판을 좌우로 밀어서 넘기기
    (function () {
      var zone = $('[data-ws-target]'), x0 = null, y0 = 0;
      function start(x, y) { if (running) return; x0 = x; y0 = y; }
      function end(x, y) {
        if (x0 === null) return; var dx = x - x0, dy = y - y0; x0 = null;
        if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy) || items(tab).length < 2) return;
        idx[tab] += dx < 0 ? 1 : -1; selMat = null;
        zone.classList.remove('is-swipe-l', 'is-swipe-r'); void zone.offsetWidth; zone.classList.add(dx < 0 ? 'is-swipe-l' : 'is-swipe-r');
        render();
      }
      zone.addEventListener('touchstart', function (e) { start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
      zone.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; end(t.clientX, t.clientY); });
      zone.addEventListener('dragstart', function (e) { e.preventDefault(); }); // 그림 끌기 방지(마우스)
      zone.addEventListener('mousedown', function (e) { start(e.clientX, e.clientY); });
      window.addEventListener('mouseup', function (e) { end(e.clientX, e.clientY); });
    })();
    el.querySelectorAll('[data-ws-arrow]').forEach(function (b) {
      b.addEventListener('click', function () { if (running) return; idx[tab] += (b.dataset.wsArrow === 'next' ? 1 : -1); selMat = null; render(); });
    });
    // ---- 재료 선택 팝업: 같은 탭의 보유 재료 목록, 합성 대상과 같은 것만 선택 가능(v758) ----
    var pick = $('[data-ws-pick]');
    $('[data-ws-mat]').addEventListener('click', function () {
      if (running) return;
      var target = cur(); var list = $('[data-ws-pick-list]'); list.innerHTML = '';
      var COLORS = ['blue', 'red', 'green', 'orange', 'purple'], anyNo = false; // v845: 재료 순서대로 카드 색 고정
      items(tab).forEach(function (m, i) {
        var n = materials(tab, m.id), same = !!target && m.id === target.id;
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'ws-pick-item ws-pcard ws-pcard--' + COLORS[i % 5] + (m.id === selMat ? ' is-on' : '');
        b.disabled = !same || !n;
        b.innerHTML = '<span class="ws-pick-img"><img alt=""></span><span class="ws-pick-name"></span><span class="ws-pick-n"></span>' +
          '<img class="ws-pcard-chk" src="assets/roundmap/check.png" alt="">';
        b.querySelector('img').src = m.img;
        b.querySelector('.ws-pick-name').textContent = nameOf(m);
        b.querySelector('.ws-pick-n').textContent = T('mole.ws.have', { n: n });
        if (!same) anyNo = true;
        b.addEventListener('click', function () { selMat = m.id; pick.hidden = true; render(); });
        list.appendChild(b);
      });
      $('[data-ws-pick-note]').hidden = !anyNo; // v846: 카드마다 붙이지 않고 별도 자리에 한 번만
      pick.hidden = false;
    });
    el.querySelectorAll('[data-ws-pick-close]').forEach(function (c) { c.addEventListener('click', function () { pick.hidden = true; }); }); // v845: X + 닫기
    $('[data-ws-close]').addEventListener('click', function () { if (running) return; root.FGH.rollOut(el, opts.onClose); }); // v790: 위로 말리며 사라짐

    // ---- 합성 실행 ----
    $('[data-ws-go]').addEventListener('click', function () {
      if (running) return;
      var it = cur(); if (!it) return;
      var kind = tab, lv = levelOf(kind, it.id), mats = materials(kind, it.id);
      if (lv >= MAX || mats < 1 || MG.Economy.getCoins() < COST) { render(); return; }
      running = true;
      // 판정 + 저장을 한 번에(코인·재료·단계) — 이후는 연출만
      if (!MG.Economy.spendCoins(COST)) { running = false; render(); return; }
      setMaterials(kind, it.id, mats - 1);
      selMat = null;
      var success = Math.random() * 100 < RATE[lv];
      if (success) setLevel(kind, it.id, lv + 1);
      if (opts.onChange) opts.onChange();
      preloadFrames().then(function () { play(it, lv, success); }); // 첫 강화도 연출 프레임이 다 준비된 뒤 시작(v772)
    });

    // 연출(사용자 지정 v758): 거위 날갯짓 → 날아오르며 알(기존 알 이미지)을 작게 낳음 → 알이 커지며 대기 위치
    //   → 알을 탭하면 묠니르가 알 꼭대기를 타격 → 균열 → 성공/실패 알 → 결과.
    function play(it, lv, success) {
      var fx = $('[data-ws-fx]');
      var goose = $('[data-ws-goose]'), egg = $('[data-ws-egg]'), ham = $('[data-ws-ham]');
      el.classList.add('is-fx');
      fx.hidden = false; $('[data-ws-result]').hidden = true; $('[data-ws-egghint]').hidden = true;
      goose.hidden = false; egg.hidden = true; ham.hidden = true;
      goose.style.transform = ''; egg.className = 'ws-egg'; ham.className = 'ws-ham';
      var ped = $('[data-ws-ped]'), solo = $('[data-ws-eggsolo]');
      var ghosts = el.querySelectorAll('[data-ws-ghost]'), rise = $('[data-ws-rise]');
      ghosts.forEach(function (gh) { gh.hidden = true; gh.style.transform = ''; }); rise.className = 'ws-rise';
      ped.hidden = false; solo.hidden = true; solo.className = 'ws-egg-solo';
      $('[data-ws-pedfront]').hidden = false; // 받침대 앞 띠는 처음부터 거위·알 앞(v760)
      var eggSet = success ? 'egg-ok-' : 'egg-ng-';
      // v771: 커진 알 이미지를 미리 받아 디코딩 — 교체 순간 빈 프레임(깜빡임) 방지
      var eggPre = new Image(); eggPre.src = A + eggSet + '1.png'; var eggReady = eggPre.decode ? eggPre.decode().catch(function () {}) : Promise.resolve();
      pending = { it: it, lv: lv, success: success, eggSet: eggSet };
      var t = 0;
      // 1) 황금거위 10포즈 — 1~5 제자리 날갯짓, 6~10 상승하며 퇴장. 6번째에서 알을 낳음
      for (var g = 1; g <= 10; g++) {
        (function (g) {
          later(function () {
            goose.src = A + 'goose-' + g + '.png';
            var up = g <= 5 ? 0 : (g - 5) * (g - 5) * 22;
            goose.style.transform = 'translate(-50%, ' + (-up) + '%)';
            // 날아오르는 효과(사용자 지정 v758): 이륙 먼지 바람 + 황금 깃털 + 잔상 2겹
            if (g >= 6) ghosts.forEach(function (gh) { gh.hidden = false; gh.src = goose.src; gh.style.transform = goose.style.transform; });
            if (g === 6) { rise.className = 'ws-rise'; void rise.offsetWidth; rise.className = 'ws-rise is-on'; }
            if (g === 7) { solo.hidden = false; solo.className = 'ws-egg-solo is-lay'; } // v766: 거위가 충분히 떠오른 뒤(7번째 포즈, 아직 화면에 보일 때) 알 낙하(사용자 지정)
          }, t);
        })(g);
        t += g <= 5 ? 170 : 130;
      }
      later(function () { goose.style.transform = 'translate(-50%, -700%)'; ghosts.forEach(function (gh) { gh.style.transform = goose.style.transform; }); }, t);
      t += 1600;
      // 받침대 위에서 다 커진 알 = 기존 알 1번 이미지(받침대 포함)로 교체
      later(function () {
        egg.src = A + eggSet + '1.png';
        eggReady.then(function () { return egg.decode ? egg.decode().catch(function () {}) : null; }).then(function () {
          requestAnimationFrame(function () { egg.hidden = false; ped.hidden = true; solo.hidden = true; $('[data-ws-pedfront]').hidden = false; ghosts.forEach(function (gh) { gh.hidden = true; }); });
        });
      }, t);
      // 2) 알 대기 — 탭하면 타격
      later(function () { goose.hidden = true; egg.className = 'ws-egg is-wait'; $('[data-ws-egghint]').hidden = false; pending.ready = true; }, t);
    }

    $('[data-ws-egg]').addEventListener('click', function () {
      if (!pending || !pending.ready) return;
      pending.ready = false;
      var pd = pending; preloadFrames().then(function () { strike(pd.it, pd.lv, pd.success, pd.eggSet); }); // 프레임 다 받은 뒤 시작
    });

    function strike(it, lv, success, eggSet) {
      var fx = $('[data-ws-fx]');
      var egg = $('[data-ws-egg]'), ham = $('[data-ws-ham]'), bolt = $('[data-ws-bolt]');
      var res = $('[data-ws-result]');
      $('[data-ws-egghint]').hidden = true;
      egg.className = 'ws-egg';
      var t = 0;
      // 3) 골드 묠니르 + 녹색 번개가 알 꼭대기 타격
      ham.hidden = false; ham.classList.add('is-in'); cycleBolt(bolt, 0);
      t += 520;
      later(function () {
        ham.classList.remove('is-in'); ham.classList.add('is-hit');
        egg.src = A + eggSet + '2.png'; egg.classList.add('is-shiver');
        // 화면 흔들림 없음 — 타격 떨림은 알에만(받침대 고정, 사용자 지정 v759)
        fx.classList.remove('is-flash'); void fx.offsetWidth; fx.classList.add('is-flash');
        try { MG.HitFx && MG.HitFx.uiTap && MG.HitFx.uiTap(1); } catch (e) { /* 무시 */ }
      }, t);
      t += 260;
      later(function () { ham.classList.remove('is-hit'); ham.classList.add('is-out'); egg.src = A + eggSet + '3.png'; }, t);
      t += 300;
      later(function () { egg.classList.remove('is-shiver'); }, t);
      // 4) 성공/실패 알 4~10
      for (var e = 4; e <= 10; e++) { (function (e) { later(function () { egg.src = A + eggSet + e + '.png'; }, t); })(e); t += 230; }
      t += 300;
      // 5) 결과 공개
      later(function () {
        ham.hidden = true; stopBolt(); pending = null; $('[data-ws-pedfront]').hidden = true;
        var nlv = success ? lv + 1 : lv;
        egg.hidden = true;
        res.hidden = false;
        res.className = 'ws-result ' + (success ? 'is-ok' : 'is-ng');
        setItemImg($('[data-ws-res-img]'), $('[data-ws-res-glow]'), success ? it.done : it.img, nlv);
        $('[data-ws-res-title]').textContent = T(success ? 'mole.ws.success' : 'mole.ws.fail');
        $('[data-ws-res-sub]').textContent = nameOf(it) + '  ' + (success ? '+' + lv + ' → +' + nlv : T('mole.ws.keep', { n: lv }));
      }, t);
    }

    var boltTimer = null;
    function cycleBolt(bolt, i) {
      bolt.src = A + 'bolt-' + ((i % 6) + 1) + '.png';
      boltTimer = setTimeout(function () { cycleBolt(bolt, i + 1); }, 90);
    }
    function stopBolt() { clearTimeout(boltTimer); boltTimer = null; }

    $('[data-ws-ok]').addEventListener('click', function () {
      $('[data-ws-result]').hidden = true;
      $('[data-ws-fx]').hidden = true;
      el.classList.remove('is-fx');
      running = false;
      render();
    });

    // v772: 연출 프레임(거위 10·알 성공/실패 각 10·번개 6)은 JS 로만 쓰여 처음엔 아직 안 받아진 상태 —
    // 첫 강화 때 알 깨짐 연출이 빈 그림으로 지나가 바로 결과가 나왔음(사용자 보고). 제작소를 열 때 미리 받아 디코딩.
    var framesReady = null;
    function preloadFrames() {
      if (framesReady) return framesReady;
      var list = [], i;
      for (i = 1; i <= 10; i++) list.push(A + 'goose-' + i + '.png', A + 'egg-ok-' + i + '.png', A + 'egg-ng-' + i + '.png');
      for (i = 1; i <= 6; i++) list.push(A + 'bolt-' + i + '.png');
      list.push(A + 'egg-solo.png', A + 'egg-ped.png', A + 'egg-ped-front.png');
      framesReady = Promise.all(list.map(function (u) {
        var im = new Image(); im.src = u;
        return im.decode ? im.decode().catch(function () {}) : new Promise(function (r) { im.onload = im.onerror = r; });
      }));
      return framesReady;
    }

    function show() {
      preloadFrames();
      clearTimers(); stopBolt();
      running = false; pending = null; selMat = null; pick.hidden = true;
      $('[data-ws-ped]').hidden = true; $('[data-ws-eggsolo]').hidden = true; $('[data-ws-pedfront]').hidden = true;
      el.classList.remove('is-fx', 'is-shake');
      $('[data-ws-fx]').hidden = true;
      render();
    }
    return { show: show };
  }

  var api = { create: create, weaponLevel: weaponLevel, weaponChanceBonus: weaponChanceBonus, materials: materials, setMaterials: setMaterials, COST: COST, RATE: RATE };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Workshop = api; }
})(typeof window !== 'undefined' ? window : null);
