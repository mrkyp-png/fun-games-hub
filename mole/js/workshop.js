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

  // ⚠️ 개발용 기본 재료 수량 — 아직 재료 획득 경로(상점·보상)가 없어 테스트용으로 3개씩.
  //    획득 경로가 생기면 DEV_MATERIALS = 0 으로.
  var DEV_MATERIALS = 3;

  var WEAPONS = [
    { id: 'cannon', ko: '팡팡 캐논', en: 'Pang Pang Cannon', img: A + 'w-cannon.png', done: A + 'w-cannon-front.png' },
    { id: 'goldhammer', ko: '골드 묠니르', en: 'Gold Mjolnir', img: A + 'w-goldhammer.png', done: A + 'w-goldhammer.png' },
    { id: 'alipunch', ko: '알리 판취', en: 'Ali Punch', img: 'assets/weapons/alipunch-jab.png', done: 'assets/weapons/alipunch-jab.png' }
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
    return MG.CostumeTeams.teams().filter(function (t) { return MG.CostumeTeams.owns(t.id); }).map(function (t) {
      return { id: t.id, ko: t.nameKo, en: t.nameEn, img: 'assets/costume/char-' + t.id + '-detail.png', done: 'assets/costume/char-' + t.id + '-detail.png' };
    });
  }
  function nameOf(it) { return root.FGH.I18N.lang === 'en' ? it.en : it.ko; }

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var tab = 'weapon', idx = { weapon: 0, costume: 0 };
    var running = false, timers = [];
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
      $('[data-ws-mat-img]').src = it ? it.img : '';
      $('[data-ws-mat]').classList.toggle('is-empty', !mats);
      $('[data-ws-mat-lv]').textContent = mats ? '+0' : '';
      $('[data-ws-mat-n]').textContent = T('mole.ws.have', { n: mats });
      $('[data-ws-rate]').textContent = lv >= MAX ? 'MAX' : RATE[lv] + '%';
      $('[data-ws-cost]').textContent = COST.toLocaleString('en-US');
      $('[data-ws-coins]').textContent = coins.toLocaleString('en-US');
      $('[data-ws-coins]').classList.toggle('is-short', coins < COST);
      var ok = !!it && lv < MAX && mats > 0 && coins >= COST && !running;
      $('[data-ws-go]').disabled = !ok;
      $('[data-ws-notice]').textContent = !it ? T('mole.ws.noItem')
        : lv >= MAX ? T('mole.ws.maxed')
        : !mats ? T('mole.ws.noMat')
        : coins < COST ? T('mole.ws.noCoin')
        : T(tab === 'weapon' ? 'mole.ws.ruleWeapon' : 'mole.ws.ruleCostume');
      el.querySelectorAll('[data-ws-arrow]').forEach(function (b) { b.hidden = items(tab).length < 2; });
    }

    el.querySelectorAll('[data-ws-tab]').forEach(function (b) {
      b.addEventListener('click', function () { if (running) return; tab = b.dataset.wsTab; render(); });
    });
    el.querySelectorAll('[data-ws-arrow]').forEach(function (b) {
      b.addEventListener('click', function () { if (running) return; idx[tab] += (b.dataset.wsArrow === 'next' ? 1 : -1); render(); });
    });
    $('[data-ws-close]').addEventListener('click', function () { if (running) return; opts.onClose(); });

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
      var success = Math.random() * 100 < RATE[lv];
      if (success) setLevel(kind, it.id, lv + 1);
      if (opts.onChange) opts.onChange();
      play(it, lv, success);
    });

    function play(it, lv, success) {
      var fx = $('[data-ws-fx]');
      var goose = $('[data-ws-goose]'), egg = $('[data-ws-egg]'), ham = $('[data-ws-ham]'), bolt = $('[data-ws-bolt]');
      var res = $('[data-ws-result]');
      el.classList.add('is-fx');
      fx.hidden = false; res.hidden = true;
      goose.hidden = false; egg.hidden = true; ham.hidden = true;
      goose.style.transform = ''; egg.className = 'ws-egg'; ham.className = 'ws-ham';
      var t = 0;
      // 1) 황금거위 10포즈 — 1~5 제자리 날갯짓, 6~10 상승하며 퇴장
      for (var g = 1; g <= 10; g++) {
        (function (g) {
          later(function () {
            goose.src = A + 'goose-' + g + '.png';
            var up = g <= 5 ? 0 : (g - 5) * (g - 5) * 22;
            goose.style.transform = 'translate(-50%, ' + (-up) + '%)';
          }, t);
        })(g);
        t += g <= 5 ? 170 : 130;
      }
      later(function () { goose.style.transform = 'translate(-50%, -700%)'; }, t);
      t += 350;
      // 2) 황금알 낙하·안착
      var eggSet = success ? 'egg-ok-' : 'egg-ng-';
      later(function () { goose.hidden = true; egg.src = A + eggSet + '1.png'; egg.hidden = false; egg.classList.add('is-drop'); }, t);
      t += 700;
      later(function () { egg.src = A + eggSet + '2.png'; egg.classList.add('is-shiver'); }, t);
      t += 450;
      later(function () { egg.src = A + eggSet + '3.png'; }, t);
      // 3) 3번째 알에서 골드 묠니르 + 녹색 번개 타격
      later(function () { ham.hidden = false; ham.classList.add('is-in'); cycleBolt(bolt, 0); }, t);
      t += 520;
      later(function () {
        ham.classList.remove('is-in'); ham.classList.add('is-hit');
        el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
        fx.classList.remove('is-flash'); void fx.offsetWidth; fx.classList.add('is-flash');
        try { MG.HitFx && MG.HitFx.uiTap && MG.HitFx.uiTap(1); } catch (e) { /* 무시 */ }
      }, t);
      t += 260;
      later(function () { ham.classList.remove('is-hit'); ham.classList.add('is-out'); egg.classList.remove('is-shiver'); }, t);
      // 4) 성공/실패 알 4~10
      for (var e = 4; e <= 10; e++) { (function (e) { later(function () { egg.src = A + eggSet + e + '.png'; }, t); })(e); t += 230; }
      t += 300;
      // 5) 결과 공개
      later(function () {
        ham.hidden = true; stopBolt();
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

    function show() {
      clearTimers(); stopBolt();
      running = false;
      el.classList.remove('is-fx', 'is-shake');
      $('[data-ws-fx]').hidden = true;
      render();
    }
    return { show: show };
  }

  var api = { create: create, weaponLevel: weaponLevel, weaponChanceBonus: weaponChanceBonus, materials: materials, setMaterials: setMaterials, COST: COST, RATE: RATE };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Workshop = api; }
})(typeof window !== 'undefined' ? window : null);
