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
    { id: 'cannon', ko: '팡팡 캐논', en: 'Pang Pang Cannon', img: A + 'w-cannon-front-v1435.png', done: A + 'w-cannon-front-v1435.png' }, // V1398 C: 새 무기 그림(검은 테두리 없음). V1405 C 사용자: 캐논은 정면 그림
    { id: 'goldhammer', ko: '골드 묠니르', en: 'Gold Mjolnir', img: A + 'w-goldhammer-v1398.png', done: A + 'w-goldhammer-v1398.png' },
    { id: 'alipunch', ko: '킹 판취', en: 'King Punch', img: A + 'w-alipunch-idle-v1406.png', done: A + 'w-alipunch-idle-v1406.png' } // V1405 C 사용자: 게임 대기 그림(kingfist-idle). V1406 C: 게임과 같게 왼쪽=원본·오른쪽=거울 // 글러브 두 짝 — v891: 여백 잘라 캐논과 비슷한 크기(사용자 지정)
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
  function weaponAttackBonus(id) { return weaponLevel(id) * 0.01; }

  function items(kind) {
    if (kind === 'weapon') return WEAPONS;
    // v784(사용자 지정): 5팀 전부 표시(미보유 = 클라우드 컵스 등도 목록에 — 합성은 보유해야 가능)
    return MG.CostumeTeams.teams().map(function (t) {
      return { id: t.id, ko: t.nameKo, en: t.nameEn, owned: MG.CostumeTeams.owns(t.id), img: 'assets/costume/char-' + t.id + '-v1406.webp', done: 'assets/costume/char-' + t.id + '-v1406.webp' }; // V1406 C 사용자: 확대 그림
    });
  }
  function nameOf(it) { return root.FGH.I18N.lang === 'en' ? it.en : it.ko; }

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var tab = 'weapon', idx = { weapon: 0, costume: 0 };
    var running = false, timers = [], selMat = null, pending = null;
    var enhancement = MG.WorkshopEnhance.create(el);
    var workshopHammer = null, hammerRaf = 0, hammerZapTimer = null, hammerFlightAudio = null, hammerHitAudios = null, lastHammerHitIndex = -1;
    var gooseShockAudio = null, gooseWingsAudio = null;
    var hammerShadow = null, shadowHammerEl = null;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; stopGooseWingsSound(); }

    function preloadGooseSounds() {
      if (!gooseShockAudio) { gooseShockAudio = new Audio('audio/goose-surprise.mp3'); gooseShockAudio.preload = 'auto'; }
      if (!gooseWingsAudio) { gooseWingsAudio = new Audio('audio/goose-wings.mp3'); gooseWingsAudio.preload = 'auto'; }
    }
    function stopGooseWingsSound() {
      if (!gooseWingsAudio) return;
      try { gooseWingsAudio.pause(); gooseWingsAudio.currentTime = 0; } catch (e) { /* sound is optional */ }
    }

    function preloadHammerSounds() {
      if (!hammerFlightAudio) {
        hammerFlightAudio = new Audio('audio/goldhammer-spin.mp3');
        hammerFlightAudio.preload = 'auto';
      }
      if (!hammerHitAudios) {
        hammerHitAudios = [
          'audio/goldhammer-sfx-01.mp3', 'audio/goldhammer-sfx-02.mp3', 'audio/goldhammer-sfx-04.mp3',
          'audio/goldhammer-sfx-06.mp3', 'audio/goldhammer-sfx-10.mp3', 'audio/goldhammer-sfx-12.mp3', 'audio/goldhammer-sfx-15.mp3'
        ].map(function (src) { var audio = new Audio(src); audio.preload = 'auto'; return audio; });
      }
    }
    function playHammerSound(audio, volume) {
      if (!audio || (root.FGH && root.FGH.Settings && !root.FGH.Settings.sfxEnabled())) return;
      try {
        audio.pause(); audio.currentTime = 0; audio.volume = volume;
        var playback = audio.play(); if (playback && playback.catch) playback.catch(function () {});
      } catch (e) { /* sound is optional */ }
    }
    function stopHammerFlightSound() {
      if (!hammerFlightAudio) return;
      try { hammerFlightAudio.pause(); hammerFlightAudio.currentTime = 0; } catch (e) { /* sound is optional */ }
    }
    function playRandomHammerHit() {
      preloadHammerSounds(); stopHammerFlightSound();
      var next = Math.floor(Math.random() * hammerHitAudios.length);
      if (hammerHitAudios.length > 1 && next === lastHammerHitIndex) next = (next + 1 + Math.floor(Math.random() * (hammerHitAudios.length - 1))) % hammerHitAudios.length;
      lastHammerHitIndex = next; playHammerSound(hammerHitAudios[next], 0.55);
    }
    function clearWorkshopHammer() {
      if (hammerRaf) cancelAnimationFrame(hammerRaf);
      hammerRaf = 0;
      stopHammerZapAnimation(false);
      if (workshopHammer) workshopHammer.clear();
      workshopHammer = null;
      if (hammerShadow) hammerShadow.remove();
      hammerShadow = null; shadowHammerEl = null;
    }
    function stopHammerZapAnimation(showBase) {
      if (hammerZapTimer) clearInterval(hammerZapTimer);
      hammerZapTimer = null;
      if (showBase && workshopHammer) {
        var img = workshopHammerImage();
        if (img) img.src = A + 'ham-gold-v1407.webp';
      }
    }
    function workshopHammerImage() {
      var fx = $('[data-ws-fx]');
      return fx.querySelector('.ws-enhance-hammer img');
    }
    function startHammerZapAnimation() {
      stopHammerZapAnimation(false);
      var frame = 0;
      function showFrame() {
        var img = workshopHammerImage();
        if (!img || !img.isConnected) return;
        img.src = A + 'ham-gold-zap' + ((frame++ % 6) + 1) + '-v1409.webp';
      }
      showFrame();
      hammerZapTimer = setInterval(showFrame, 80);
    }
    function createWorkshopHammer(layer, onLanded) {
      clearWorkshopHammer();
      workshopHammer = MG.LaneHammer.create({
        layer: layer,
        sprite: A + 'ham-gold-v1407.webp',
        introSprite: A + 'ham-gold-v1407.webp',
        grip: { x: 49, y: 72 },
        cssClass: 'lane-hammer--gold ws-enhance-hammer',
        // 기존 제작소 폭(화면의 약 40%)에 맞춰 게임용 골드 망치 오프셋도 약 2배 보정.
        gripOff: { x: 0.214, y: -0.144 },
        emptyDy: -0.05,
        homeMarginTop: '-0.15cm',
        homeDegOffset: 0,
        homeXFrac: 0.66,
        homeYFrac: 0.85,
        idle: 'bounce',
        strikeDurationScale: 2,
        strikeFlyDurationScale: 2 / 0.7
      });
      var hammerEl = layer.querySelector('.ws-enhance-hammer');
      shadowHammerEl = hammerEl;
      hammerShadow = document.createElement('div'); hammerShadow.className = 'ws-hammer-shadow'; hammerShadow.setAttribute('aria-hidden', 'true'); layer.appendChild(hammerShadow);
      if (hammerEl) hammerEl.classList.add('is-entering');
      // 거위가 떠난 강화 연출 장면에서만 좌측 하단에서 회전 입장 후 대기 동작을 시작.
      playHammerSound(hammerFlightAudio, 0.45);
      workshopHammer.spinIn(0.08, 0.9, 1260, 4, 0.04, function () {
        hammerEl = layer.querySelector('.ws-enhance-hammer');
        if (hammerEl) hammerEl.classList.remove('is-entering');
        animateWorkshopHammer();
        if (onLanded) onLanded();
      });
    }
    function animateWorkshopHammer() {
      if (hammerRaf || !workshopHammer) return;
      var previous = performance.now();
      function tick(now) {
        if (!workshopHammer) { hammerRaf = 0; return; }
        var dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
        previous = now;
        workshopHammer.update(dt);
        if (hammerShadow && shadowHammerEl) {
          var x = parseFloat(shadowHammerEl.style.left) || 66;
          var y = parseFloat(shadowHammerEl.style.top) || 85;
          var lift = Math.min(1, Math.abs(85 - y) / 12);
          hammerShadow.style.left = x + '%';
          hammerShadow.style.top = (93 + (y - 85) * .55) + '%';
          hammerShadow.style.transform = 'translate(-50%,-50%) scale(' + (1 - lift * .38) + ')';
          hammerShadow.style.opacity = shadowHammerEl.classList.contains('is-fading') ? '0' : String(.32 - lift * .2);
        }
        hammerRaf = requestAnimationFrame(tick);
      }
      hammerRaf = requestAnimationFrame(tick);
    }

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
      var blackEggRescue = !success && Math.random() < 0.1;
      if (blackEggRescue) success = true;
      if (success) setLevel(kind, it.id, lv + 1);
      if (opts.onChange) opts.onChange();
      preloadFrames().then(function () { play(it, lv, success, blackEggRescue); }); // 첫 강화도 연출 프레임이 다 준비된 뒤 시작(v772)
    });

    // New artwork and continuous shell animation; transaction logic above remains unchanged.
    function play(it, lv, success, blackEggRescue) {
      var fx = $('[data-ws-fx]'), goose = $('[data-ws-goose]');
      var ghosts = el.querySelectorAll('[data-ws-ghost]'), rise = $('[data-ws-rise]');
      // 원본 프레임 얼굴 폭을 5번 프레임(153px)에 맞춘 배율.
      var gooseFaceWidths = [0, 200, 153, 160, 154, 153, 137, 133, 133, 131, 182];
      var firstFrameScale = gooseFaceWidths[5] / gooseFaceWidths[1];
      el.classList.add('is-fx'); fx.hidden = false;
      $('[data-ws-result]').hidden = true; $('[data-ws-egghint]').hidden = true;
      $('[data-ws-fx-info]').hidden = true;
      clearWorkshopHammer();
      preloadGooseSounds();
      // 첫 프레임은 1배 원본 크기로 잠깐 보이지 않도록 정확한 이미지와 크기를 먼저 지정한다.
      goose.hidden = true; goose.style.transition = 'none';
      goose.src = A + 'goose-1.png';
      goose.style.transform = 'translate(-50%, 0) scale(' + firstFrameScale + ')';
      goose.hidden = false; void goose.offsetWidth; goose.style.transition = '';
      preloadHammerSounds();
      ghosts.forEach(function (gh) { gh.hidden = true; gh.style.transform = ''; }); rise.className = 'ws-rise';
      pending = { it: it, lv: lv, success: success };
      enhancement.prepare(function () { strike(it, lv, success, blackEggRescue); }, success ? it.done : it.img);
      var t = 0;
      for (var g = 1; g <= 10; g++) {
        (function (g) { later(function () {
          goose.src = A + 'goose-' + g + '.png';
          var up = g <= 5 ? 0 : (g - 5) * (g - 5) * 22;
          var frameScale = gooseFaceWidths[5] / gooseFaceWidths[g];
          goose.style.transform = 'translate(-50%, ' + (-up) + '%) scale(' + frameScale + ')';
          if (g === 2) playHammerSound(gooseWingsAudio, 0.825);
          if (g === 3) playHammerSound(gooseShockAudio, 0.75);
          if (g >= 6) ghosts.forEach(function (gh) { gh.hidden = false; gh.src = goose.src; gh.style.transform = goose.style.transform; });
          if (g === 6) { rise.className = 'ws-rise'; void rise.offsetWidth; rise.className = 'ws-rise is-on'; }
          if (g === 7) enhancement.drop();
        }, t); })(g);
        t += g <= 5 ? 170 : 130;
      }
      later(function () { goose.style.transform = 'translate(-50%, -700%)'; ghosts.forEach(function (gh) { gh.style.transform = goose.style.transform; }); }, t);
      later(function () {
        goose.hidden = true; ghosts.forEach(function (gh) { gh.hidden = true; });
        createWorkshopHammer(fx, function () {
          enhancement.wait(); $('[data-ws-egghint]').hidden = false; $('[data-ws-fx-info]').hidden = false;
        });
      }, t + 1600);
    }

    function strike(it, lv, success, blackEggRescue) {
      var fx = $('[data-ws-fx]');
      $('[data-ws-egghint]').hidden = true;
      $('[data-ws-fx-info]').hidden = true;
      if (!workshopHammer) createWorkshopHammer(fx);
      var fxRect = fx.getBoundingClientRect();
      // 사용자가 표시한 알 윗부분 안쪽 타격점에 맞춰 새 알 프레임의 실제 위치로 계산한다.
      var eggRect = fx.querySelector('.ws-new-egg').getBoundingClientRect();
      // 요청 조정 누적: 오른쪽 0.3cm, 아래쪽 2.5cm (CSS 96px/in 기준).
      var targetX = (eggRect.left + eggRect.width * 0.5 + 11.34 - fxRect.left) / fxRect.width;
      var targetY = (eggRect.top + eggRect.height * 0.16 + 94.5 - fxRect.top) / fxRect.height;
      var hammerEl = fx.querySelector('.ws-enhance-hammer');
      if (hammerEl) hammerEl.classList.add('is-striking');
      startHammerZapAnimation();
      workshopHammer.strike(targetX, targetY, function () {
        playRandomHammerHit();
        stopHammerZapAnimation(true);
        hammerEl = fx.querySelector('.ws-enhance-hammer');
        if (hammerEl) hammerEl.classList.add('is-fading');
        enhancement.impact(success, function () {
          clearWorkshopHammer(); stopHammerFlightSound(); pending = null;
          var nlv = success ? lv + 1 : lv, res = $('[data-ws-result]');
          res.hidden = false; res.className = 'ws-result ' + (success ? 'is-ok' : 'is-ng');
          setItemImg($('[data-ws-res-img]'), $('[data-ws-res-glow]'), success ? it.done : it.img, nlv);
          $('[data-ws-res-title]').textContent = T(success ? 'mole.ws.success' : 'mole.ws.fail');
          $('[data-ws-res-sub]').textContent = nameOf(it) + '  ' + (success ? '+' + lv + ' → +' + nlv : T('mole.ws.keep', { n: lv }));
          enhancement.result(success, nlv);
        }, blackEggRescue);
      });
      playHammerSound(hammerFlightAudio, 0.45);
      animateWorkshopHammer();
    }

    $('[data-ws-ok]').addEventListener('click', function () {
      enhancement.reset(); clearTimers(); clearWorkshopHammer();
      $('[data-ws-result]').hidden = true;
      $('[data-ws-fx]').hidden = true;
      el.classList.remove('is-fx');
      running = false;
      render();
    });

    var framesReady = null;
    function preloadFrames() {
      if (framesReady) return framesReady;
      var list = [];
      for (var i = 1; i <= 10; i++) list.push(A + 'goose-' + i + '.png');
      list.push(A + 'ham-gold-v1407.webp');
      for (var z = 1; z <= 6; z++) list.push(A + 'ham-gold-zap' + z + '-v1409.webp');
      framesReady = Promise.all([MG.WorkshopEnhance.preload()].concat(list.map(function (u) {
        var im = new Image(); im.src = u;
        return im.decode ? im.decode().catch(function () {}) : new Promise(function (r) { im.onload = im.onerror = r; });
      })));
      return framesReady;
    }

    function show() {
      preloadFrames();
      clearTimers(); clearWorkshopHammer(); enhancement.reset();
      running = false; pending = null; selMat = null; pick.hidden = true;
      el.classList.remove('is-fx', 'is-shake');
      $('[data-ws-fx]').hidden = true;
      render();
    }
    return { show: show };
  }

  var api = { create: create, levelOf: levelOf, GLOW: GLOW, weaponLevel: weaponLevel, weaponChanceBonus: weaponChanceBonus, weaponAttackBonus: weaponAttackBonus, materials: materials, setMaterials: setMaterials, COST: COST, RATE: RATE };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Workshop = api; }
})(typeof window !== 'undefined' ? window : null);
