// 라운드 선택 광산 맵(v763) — 바탕화면 "MOLE PANG 라운드 선택 화면 최종 구현 명세서" 기준.
// 아래 오른쪽 1번에서 좌우 계단을 따라 위쪽 8번으로 올라가는 세로 맵. 난이도별로
// 배경·헬멧 색·정보판 내용만 바뀌고 구도는 같다. 현재 라운드 = localStorage 'mole.chapter'(홈과 공유),
// 난이도 = 'mole.difficulty'. 실제 저장·검증은 game.js 가 넘겨준 콜백(select/setLight)이 한다.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var A = 'assets/roundmap/';
  var LIGHTS = ['easy', 'mid', 'legend'];
  var TICKER_ITEMS = {
    easy: [{ key: 'mole.rm.ground.easybase', icon: 'score' }, { key: 'mole.rm.ground.easy', icon: 'fever' }],
    mid: [{ key: 'mole.rm.ground.mid', icon: 'score' }, { key: 'mole.rm.ground.mid2', icon: 'fever' }, { key: 'mole.rm.ground.mid3', icon: 'combo' }],
    legend: [{ key: 'mole.rm.ground.legend', icon: 'score' }, { key: 'mole.rm.ground.legend2', icon: 'fever' }, { key: 'mole.rm.ground.legend3', icon: 'combo' }]
  };
  var TICKER_ICON_SRC = {
    score: 'assets/quest/ic-trophy.png',
    fever: A + 'ic-fire.png',
    combo: A + 'ic-heart.png'
  };
  // 고정 지형의 실제 구멍 중심(941×1672). 모드별 외형만 다르고 진행 로직은 같다.
  // 뒤 동굴의 이동과 무관하게 구멍, 두더지, 잠금 및 터치 기준점은 함께 고정된다.
  var ROUTE = [[674.5, 1448.5], [337.5, 1278.2], [678, 1108.8], [370.5, 930.8],
    [663.5, 776.5], [339.5, 608.1], [639.5, 467.5], [334.5, 325.9]];
  var HOLES = {
    easy: ROUTE,
    mid: [[696.5,1322],[359.5,1157],[634.5,995],[347,835.5],[610.5,691],[327,550.5],[563.5,430.5],[291.5,254]],
    legend: [[682,1317.5],[356.5,1112],[679,960.5],[351,789.5],[654,654],[339,502],[614,388.5],[297.5,217]]
  };
  var BW = 941, BH = 1672;
  // 배경 효과 위치(941×1672 px): 랜턴 불빛 / 광물 반짝임 — 배경 그림의 랜턴·광물 자리
  // 배경 효과 위치(941×1672 px). glow=랜턴 불빛, spark=금·보석이 있는 곳에서만 반짝(사용자 지정 v767),
  // bubble=물(폭포 아래 웅덩이)이 있는 곳에서만 물방울이 올라옴(Normal, 사용자 지정 v767).
  var FX = {
    easy:   { glow: [[114, 306, 130], [876, 435, 120]], spark: [[86, 1020], [170, 1108]], bubble: [] },
    mid:    { glow: [[130, 350], [840, 680], [260, 920], [860, 90]], spark: [[300, 125], [208, 128], [475, 40], [800, 120], [750, 325], [175, 450], [247, 450], [67, 600], [158, 617], [225, 734], [759, 776], [167, 1034], [183, 1151]],
              bubble: [[700, 790], [800, 1090], [745, 1300], [300, 1290], [300, 1560], [440, 1600], [590, 1610]] },
    legend: { glow: [[108, 330], [92, 600], [840, 650], [125, 970], [880, 1100]], spark: [[167, 425], [140, 440], [208, 1151], [158, 1168], [859, 1243]], bubble: [] }
  };
  var CAVE_FX = {
    // Small color-matched gem halos cover the fixed foreground; rear halos move with the cave plate.
    // V1320 C: 아마추어 보석·랜턴 빛은 그림에서 뽑은 층(assets/roundmap/glow-v1320)으로 대체 — 좌표 점 끔
    easy: { glow:[], spark:[], bubble:[], gem:[], rearGem:[], lantern:[], rearLantern:[] },
    // V1321 C: 노말도 그림에서 뽑은 빛 층으로 대체 — 좌표 점 끔
    mid: { glow:[], spark:[], bubble:[], gem:[], rearGem:[], lantern:[], rearLantern:[] },
    // V1324 C: 프로도 그림에서 뽑은 빛 층으로 대체 — 좌표 점 끔
    legend: { glow:[], spark:[], bubble:[], gem:[], rearGem:[], lantern:[], rearLantern:[] }
  };
  var GEM_TONES = {
    cyan:   ['rgba(235,250,255,.82)','rgba(61,182,255,.36)','rgba(35,148,255,.44)'],
    violet: ['rgba(250,235,255,.80)','rgba(166,94,255,.34)','rgba(133,66,255,.42)'],
    red:    ['rgba(255,236,224,.84)','rgba(255,72,93,.40)','rgba(255,42,61,.48)'],
    amber:  ['rgba(255,248,215,.82)','rgba(255,168,63,.34)','rgba(255,127,35,.42)']
  };
  var LANTERN_CORE = 'rgba(255,244,198,.56)', LANTERN_HALO = 'rgba(255,181,78,.20)', LANTERN_SPILL = 'rgba(255,145,48,.17)';

  function gemMarkup(gems) {
    return (gems || []).map(function (p, i) {
      var tone = GEM_TONES[p[2]] || GEM_TONES.cyan;
      var depth = Math.max(0, Math.min(1, p[1] / BH));
      var size = (2.8 + 3.5 * Math.pow(depth, 1.35)).toFixed(2);
      return '<span class="rm-gem-glow" style="left:' + (p[0] / BW * 100).toFixed(3) + '%;top:' + (p[1] / BH * 100).toFixed(3) + '%;--gem-size:' + size + 'cqw;--gem-depth:' + depth.toFixed(3) + ';--gem-core:' + tone[0] + ';--gem-halo:' + tone[1] + ';--gem-glow:' + tone[2] + ';animation-duration:' + (3.4 - depth * .8).toFixed(2) + 's;animation-delay:-' + ((i * .47) % 3.2).toFixed(2) + 's"></span>';
    }).join('');
  }
  function lanternMarkup(points) {
    return (points || []).map(function (p, i) {
      var depth = Math.max(0, Math.min(1, p[1] / BH));
      var size = (3.0 + 3.1 * Math.pow(depth, 1.2)).toFixed(2);
      var minAlpha = (.24 + .14 * depth).toFixed(3), maxAlpha = (.36 + .22 * depth).toFixed(3);
      return '<span class="rm-lantern-glow" style="left:' + (p[0] / BW * 100).toFixed(3) + '%;top:' + (p[1] / BH * 100).toFixed(3) + '%;--lantern-size:' + size + 'cqw;--lantern-depth:' + depth.toFixed(3) + ';--lantern-min:' + minAlpha + ';--lantern-max:' + maxAlpha + ';--lantern-core:' + LANTERN_CORE + ';--lantern-halo:' + LANTERN_HALO + ';--lantern-spill:' + LANTERN_SPILL + ';animation-delay:-' + ((i * .53) % 2.8).toFixed(2) + 's"></span>';
    }).join('');
  }

  // V1325 C 화면 전환 = Motion Prompt #018 "Shape transition"(MIT, (c) 2026 Shohei Ohtaki, showheyohtaki.github.io/motion-prompt/#018).
  // 원본 그대로: 가로 띠 4개(끝 80px 기울기, 539px 폭 기준 비율), 덮기 0.62초 → 다 덮이고 준비되면 onCovered(화면 교체) → 0.12초 뒤 걷기 0.63초,
  // 띠마다 14% 지연·구간 58% 동안 cubic ease-in-out. 색만 노랑·초록·빨강·보라(사용자 지정). dir 1 = 좌→우, -1 = 거울. 준비 대기는 최대 1.6초.
  var BAND_COLORS = ['#ffd84a', '#70f58b', '#ff4a3a', '#a66bff'];
  function shapeTransition(dir, onCovered, isReady, onDone, holdOpen) {
    var cv = document.createElement('canvas');
    cv.className = 'rm-shape-transition';
    document.body.appendChild(cv);
    var g = cv.getContext('2d'), dpr = root.devicePixelRatio || 1;
    var w = root.innerWidth, h = root.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var swappedAt = 0, firstSwap = 0, t0 = performance.now();
    function clamp(x) { return Math.max(0, Math.min(1, x)); }
    function eIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    (function frame(now) {
      var u = (now - t0) / 1000, p1 = clamp(u / 0.62), p2 = 0;
      if (p1 >= 1 && !swappedAt && (!isReady || isReady() || u > 1.6)) { swappedAt = firstSwap = now; onCovered(); }
      if (swappedAt && holdOpen && holdOpen() && now - firstSwap < 1200) swappedAt = now; // 교체된 화면이 아직 준비 중이면 덮은 채 대기(최대 1.2초)
      if (swappedAt) p2 = clamp(((now - swappedAt) / 1000 - 0.12) / 0.63);
      var sk = w * 80 / 539, span = w + sk + 20, bh = h / 4 + 1;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (dir < 0) { g.translate(w, 0); g.scale(-1, 1); }
      for (var i = 0; i < 4; i++) {
        var d = i * 0.14, e1 = eIO(clamp((p1 - d) / 0.58)), e2 = eIO(clamp((p2 - d) / 0.58));
        if (e1 <= 0 || e2 >= 1) continue;
        var y = i * h / 4, xa = -sk - 10 + e2 * span, xb = -sk - 10 + e1 * span;
        g.fillStyle = BAND_COLORS[i];
        g.beginPath(); g.moveTo(xa + sk, y); g.lineTo(xb + sk, y); g.lineTo(xb, y + bh); g.lineTo(xa, y + bh); g.closePath(); g.fill();
      }
      if (p2 >= 1) { cv.remove(); if (onDone) onDone(); return; }
      root.requestAnimationFrame(frame);
    })(t0);
  }

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var view = null; // 지금 보고 있는 난이도
    function updateTicker() {
      var ticker = $('[data-rm-ticker]');
      if (!ticker) return;
      var items = TICKER_ITEMS[view] || [];
      var text = items.map(function (item) { return T(item.key); }).join('　·　');
      var label = $('[data-rm-ticker-label]'), track = $('[data-rm-ticker-track]');
      if (!track || ticker.dataset.text === text) return; // V1323 C: 같은 글이면 그대로 — 매 render 재시작(티커 튐) 방지
      ticker.dataset.text = text;
      if (label) label.textContent = text;
      var copies = track.querySelectorAll('[data-rm-ticker-copy]');
      copies.forEach(function (copy) {
        copy.textContent = '';
        items.forEach(function (item, index) {
          if (index) {
            var separator = document.createElement('span');
            separator.className = 'rm-top-ticker-separator';
            separator.textContent = '·';
            copy.appendChild(separator);
          }
          var entry = document.createElement('span');
          entry.className = 'rm-top-ticker-item';
          var icon = document.createElement('span');
          icon.className = 'rm-top-ticker-icon rm-top-ticker-icon--' + item.icon;
          var iconImage = document.createElement('img');
          iconImage.src = TICKER_ICON_SRC[item.icon];
          iconImage.alt = '';
          iconImage.setAttribute('aria-hidden', 'true');
          icon.appendChild(iconImage);
          var phrase = document.createElement('span');
          phrase.textContent = T(item.key);
          entry.appendChild(icon);
          entry.appendChild(phrase);
          copy.appendChild(entry);
        });
      });
      var fontSize = parseFloat(root.getComputedStyle(ticker).fontSize) || 14;
      var distance = Math.max(copies[0] ? copies[0].scrollWidth : 0, Array.from(text).length * fontSize * .68) + fontSize * 2;
      track.style.setProperty('--rm-ticker-duration', Math.max(15, Math.min(40, distance / 24)).toFixed(1) + 's');
      track.style.animation = 'none';
      void track.offsetWidth;
      track.style.animation = '';
    }
    var fluids = MG.RoundMapFluids ? {
      rear: MG.RoundMapFluids.create($('[data-rm-rear-fluid]'), { root: el }),
      front: MG.RoundMapFluids.create($('[data-rm-front-fluid]'), { root: el })
    } : null;

    el.querySelector('[data-back="roundmap"]').addEventListener('click', function () { if (transitioning) return; transitioning = true; shapeTransition(-1, opts.onClose, null, function () { transitioning = false; }); }); // V1325 C 홈으로 = 띠 전환(거울). // v790: 위로 말리며 사라짐
    var startButton = $('[data-rm-start]');
    // 홈 초록 시작 버튼과 같은 동작(V1318 C, 사용자 지정): 탭=시작 / 꾹(0.6초)=종료 대기 / 다시 탭=종료창
    var startLabel = $('[data-rm-start-label]'), holdT = null, longFired = false, armed = false, revertT = null;
    function setArmed(on) {
      armed = on;
      clearTimeout(revertT);
      startButton.classList.toggle('rm-start--armed', on);
      startLabel.textContent = T(on ? 'mole.start.armLabel' : 'mole.start.btn');
      if (on) revertT = setTimeout(function () { setArmed(false); }, 3200);
    }
    setArmed(false);
    if (root.FGH.I18N.onChange) root.FGH.I18N.onChange(function () { setArmed(armed); });
    startButton.addEventListener('pointerdown', function () {
      longFired = false;
      holdT = setTimeout(function () {
        longFired = true;
        setArmed(true);
        if (root.FGH.Settings.vibrate) root.FGH.Settings.vibrate();
      }, 600);
    });
    startButton.addEventListener('pointercancel', function () { clearTimeout(holdT); });
    startButton.addEventListener('pointerleave', function () { clearTimeout(holdT); });
    startButton.addEventListener('click', function () {
      clearTimeout(holdT);
      if (longFired) { longFired = false; return; } // 방금 꾹 눌러 무장 → 이 탭은 무시
      if (armed) { setArmed(false); opts.onQuit(); }
      else opts.onStart();
    });
    startButton.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    startButton.addEventListener('dragstart', function (event) { event.preventDefault(); });
    el.querySelectorAll('[data-rm-light]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-rm-light');
        if (!MG.Progress.isLightUnlocked(l)) { flash(b); return; }
        if (l !== view) modeTransition(l, function () { render(); }); // V1322 C 그림 준비 후 한 번에 전환. v844(사용자 지정): 탭은 그 난이도 지도 보기만 — 내 위치(홈 라운드)는 라운드를 눌러야 바뀜
      });
    });

    function flash(b) { b.classList.remove('is-deny'); void b.offsetWidth; b.classList.add('is-deny'); }

    // V1263: select in the eight burrows; no duplicate lower icon strip.
    var tunnel = $('[data-rm-rounds]');
    for (var n = 1; n <= 8; n++) {
      (function (n) {
        var r = document.createElement('button');
        r.type = 'button'; r.className = 'rm-round'; r.setAttribute('data-n', n);
        r.setAttribute('aria-label', T('mole.rm.round', { n: n }));
        r.style.setProperty('--d', n);
        r.innerHTML = '<span class="rm-depth"></span><span class="rm-dark"></span><img class="rm-mole" alt=""><img class="rm-arrow" src="' + A + 'arrow.png" alt="">' +
          '<img class="rm-crown" src="' + A + 'crown.png" alt=""><img class="rm-lock" src="' + A + 'lock.png" alt="">' +
          '<span class="rm-panel"><b></b></span><img class="rm-check" src="' + A + 'check.png" alt="">';
        r.addEventListener('click', function () { pick(n, r); });
        tunnel.appendChild(r);
      })(n);
    }

    function pick(n, btn) {
      if (!MG.Progress.isUnlocked(n, view)) { flash(btn); return; }
      if (view !== opts.currentLight()) opts.setLight(view); // 다른 난이도 지도에서 라운드를 고르면 그 난이도로 이동
      opts.select(n);
      render();
    }

    function renderFx() {
      var fx = $('[data-rm-fx]'); if (fx.getAttribute('data-for') === view) return;
      fx.setAttribute('data-for', view); fx.innerHTML = '';
      var layered = el.classList.contains('rm-window-map');
      var f = layered ? (CAVE_FX[view] || FX.easy) : FX[view], html = '';
      if (layered) {
        el.querySelectorAll('[data-rm-gem-layer]').forEach(function (layer) {
          var rear = CAVE_FX[layer.getAttribute('data-rm-gem-layer')];
          if (!layer.dataset.baseHtml) layer.dataset.baseHtml = layer.innerHTML;
          layer.innerHTML = layer.dataset.baseHtml + gemMarkup(rear && rear.rearGem) + lanternMarkup(rear && rear.rearLantern);
        });
        html += gemMarkup(f.gem) + lanternMarkup(f.lantern);
      }
      f.glow.forEach(function (p) { html += '<span class="rm-glow" style="left:' + (p[0] / BW * 100) + '%;top:' + (p[1] / BH * 100) + '%;' + (p[2] ? '--rm-glow-size:' + (p[2] / BW * 100) + 'cqw;' : '') + '"></span>'; });
      f.spark.forEach(function (p) { for (var k = 0; k < (layered ? 1 : 5); k++) { var ox = k ? (Math.random() * 60 - 30) : 0, oy = k ? (Math.random() * 50 - 25) : 0; html += '<span class="rm-spark" style="left:' + ((p[0] + ox) / BW * 100) + '%;top:' + ((p[1] + oy) / BH * 100) + '%;animation-delay:' + (-Math.random() * 3).toFixed(2) + 's;animation-duration:' + (2.2 + Math.random() * 1.6).toFixed(2) + 's;scale:' + (0.6 + Math.random() * 0.6).toFixed(2) + '"></span>'; } }); // Amateur: exact crystal anchors; retain legacy five-spark clusters on other maps.
      // Amateur(지상 광산): 나비 3마리 + 잠자리 2마리가 하늘·풀밭 위를 날아다님(사용자 지정 v763)
      if (view === 'easy' && !el.classList.contains('rm-window-map')) {
        html += '<span class="hg-bfly hg-bfly--p rm-bfly rm-bfly--1"></span><span class="hg-bfly hg-bfly--y rm-bfly rm-bfly--2"></span><span class="hg-bfly hg-bfly--b rm-bfly rm-bfly--3"></span>';
        html += '<span class="rm-dfly rm-dfly--1"><b></b></span><span class="rm-dfly rm-dfly--2"><b></b></span>';
      }
      f.bubble.forEach(function (p, k) {
        for (var b = 0; b < 3; b++) {
          html += '<em class="rm-bub" style="left:' + ((p[0] + (Math.random() * 40 - 20)) / BW * 100).toFixed(2) + '%;top:' + (p[1] / BH * 100).toFixed(2) + '%;animation-delay:' + (-Math.random() * 2.6).toFixed(2) + 's;animation-duration:' + (2 + Math.random() * 1.4).toFixed(2) + 's"></em>';
        }
      });
      for (var i = 0; i < (!layered && view === 'legend' ? 18 : 0); i++) {
        html += '<i style="left:' + (5 + Math.random() * 90).toFixed(1) + '%;top:' + (15 + Math.random() * 70).toFixed(1) + '%;animation-delay:' + (-Math.random() * 9).toFixed(2) + 's"></i>';
      }
      fx.innerHTML = html;
      if (view === 'easy') setTimeout(flyDragonflies, 50);
    }

    // 잠자리(Amateur): 위쪽 하늘(배경 y 0~120px) 안에서만 무작위 지점으로 '호버링 → 휙' 이동(사용자 지정)
    var dflyTimer = null;
    function flyDragonflies() {
      clearTimeout(dflyTimer);
      if (el.hidden || view !== 'easy' || el.classList.contains('rm-window-map')) return;
      el.querySelectorAll('.rm-dfly').forEach(function (d) {
        if (Math.random() < 0.45) return; // 일부는 제자리 호버링
        var x = 3 + Math.random() * 86, y = 0.5 + Math.random() * 7; // cqw — 하늘 띠 안(굴·풀밭 아래로 안 내려옴)
        var ang = (Math.random() < 0.5 ? 90 : -90) + (Math.random() * 30 - 15);
        d.style.setProperty('--t', (0.35 + Math.random() * 0.5).toFixed(2) + 's');
        d.style.transform = 'translate(' + x.toFixed(1) + 'cqw,' + y.toFixed(1) + 'cqw) rotate(' + ang.toFixed(0) + 'deg)';
      });
      dflyTimer = setTimeout(flyDragonflies, 900 + Math.random() * 1400);
    }

    // Touch-drag from any screen area, including the opaque cap and black lower panel.
    // Mode maps form a left-to-right pager: Amateur, Normal, Pro.
    var panByLight = { easy: 0, mid: 0, legend: 0 };
    var panGesture = null, panSuppressClickUntil = 0, panRaf = 0;
    var pageOrder = ['easy', 'mid', 'legend'];
    function panLimit() { return Math.max(36, el.clientWidth * .2); }
    function clampPan(value) { var limit = panLimit(); return Math.max(-limit, Math.min(limit, value)); }
    function applyPan(light) {
      el.style.setProperty('--rm-pan-x', (panByLight[light || view] || 0).toFixed(1) + 'px');
    }
    function stopPanMomentum() {
      if (panRaf) { root.cancelAnimationFrame(panRaf); panRaf = 0; }
    }
    function startPanMomentum(light, velocity) {
      stopPanMomentum();
      if (Math.abs(velocity) < .08) return;
      var lastTime = 0;
      function tick(time) {
        if (!lastTime) lastTime = time;
        var dt = Math.min(32, time - lastTime); lastTime = time;
        var before = panByLight[light] || 0;
        var after = clampPan(before + velocity * dt);
        panByLight[light] = after; applyPan(light);
        velocity *= Math.pow(.91, dt / 16);
        if (Math.abs(velocity) < .025 || after === before) { panRaf = 0; return; }
        panRaf = root.requestAnimationFrame(tick);
      }
      panRaf = root.requestAnimationFrame(tick);
    }
    // V1322 C 화면 전환을 한 번에(사용자 지정): 대상 모드의 그림(앞·뒤·덮개·빛 층·용암/폭포)을 미리 decode 한 뒤 콜백.
    // 연속 전환은 마지막 것만 반영, 느린 폰은 최대 0.8초만 기다림.
    var readyTicket = 0;
    function whenModeReady(light, cb) {
      var ticket = ++readyTicket, done = false, imgs = [];
      var sel = '.rm-mode-' + light + (light === 'easy' ? ',.rm-route-art,.rm-front-art' : '');
      el.querySelectorAll(sel).forEach(function (n) {
        if (n.tagName === 'IMG') imgs.push(n); else n.querySelectorAll('img').forEach(function (i) { imgs.push(i); });
      });
      var scenes = MG.RoundMapFluidScenes || {};
      (light === 'mid' ? [scenes['normal-rear']] : light === 'legend' ? [scenes['pro-rear'], scenes['pro-front']] : []).forEach(function (sc) {
        if (sc) [sc.atlas, sc.mask].forEach(function (src) { var i = new Image(); i.src = src; imgs.push(i); });
      });
      function finish() { if (done) return; done = true; if (ticket === readyTicket) cb(); }
      Promise.all(imgs.map(function (i) { return i.decode ? i.decode().catch(function () {}) : null; })).then(finish);
      root.setTimeout(finish, 800);
    }
    // V1323 C 라운드맵 재화 박스(코인·하트·티켓) — 하트는 시간 충전이라 보이는 동안 1초마다 갱신
    function updateWallet() {
      var E = MG.Economy; if (!E) return;
      var v = { coins: E.getCoins(), hearts: E.getHearts(), tickets: E.getTickets() };
      // 1000 이상은 1000당 K(사용자 지정) — 박스 밖으로 안 넘치게
      el.querySelectorAll('[data-rm-wallet]').forEach(function (b) { var n = v[b.getAttribute('data-rm-wallet')]; b.textContent = n >= 1000 ? Math.floor(n / 1000) + 'K' : String(n); });
    }
    root.setInterval(function () { if (!el.hidden) updateWallet(); }, 1000);
    // V1325 C 모드 전환 = Motion Prompt #018 "Shape transition"(MIT, (c) 2026 Shohei Ohtaki, showheyohtaki.github.io/motion-prompt/#018).
    // 원본 그대로: 가로 띠 4개(끝 80px 기울기, 539px 폭 기준 비율), 덮기 0.62초 → 다 덮이면 다음 화면으로 교체 → 0.12초 뒤 걷기 0.63초,
    // 띠마다 14% 지연·구간 58% 동안 cubic ease-in-out. 색만 노랑·초록·빨강·보라(사용자 지정). 앞 모드로 가면 좌→우, 뒤로 가면 거울.
    var transitioning = false;
    function modeTransition(next, swap) {
      if (transitioning) return;
      transitioning = true;
      var ready = false;
      whenModeReady(next, function () { ready = true; });
      shapeTransition(pageOrder.indexOf(next) >= pageOrder.indexOf(view) ? 1 : -1,
        function () { view = next; swap(); }, function () { return ready; }, function () { transitioning = false; });
    }
    if (el.classList.contains('rm-window-map')) {
      el.addEventListener('pointerdown', function (event) {
        if (!view || (event.button !== undefined && event.button !== 0)) return;
        panGesture = { id:event.pointerId, light:view, x:event.clientX, y:event.clientY,
          lastX:event.clientX, lastTime:event.timeStamp, start:panByLight[view] || 0, velocity:0, dragDx:0, dragging:false };
      }, true);
      el.addEventListener('pointermove', function (event) {
        var g = panGesture;
        if (!g || event.pointerId !== g.id) return;
        var dx = event.clientX - g.x, dy = event.clientY - g.y;
        if (!g.dragging) {
          if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
          if (Math.abs(dx) <= Math.abs(dy) * 1.15) { panGesture = null; return; }
          g.dragging = true; el.classList.add('is-panning'); stopPanMomentum();
          try { el.setPointerCapture(event.pointerId); } catch (_) {}
        }
        event.preventDefault();
        g.dragDx = dx;
        var now = event.timeStamp, elapsed = Math.max(1, now - g.lastTime);
        g.velocity = (event.clientX - g.lastX) / elapsed;
        g.lastX = event.clientX; g.lastTime = now;
        panByLight[g.light] = clampPan(g.start + dx); applyPan(g.light);
      });
      function endPan(event, cancelled) {
        var g = panGesture;
        if (!g || (event && event.pointerId !== g.id)) return;
        panGesture = null;
        if (g.dragging) {
          el.classList.remove('is-panning');
          panSuppressClickUntil = Date.now() + 350;
          var dx = g.dragDx || 0;
          if (!cancelled && Math.abs(dx) >= 14) {
            var from = pageOrder.indexOf(g.light), to = from + (dx < 0 ? 1 : -1);
            var next = pageOrder[to];
            // Browsing the three map designs must not depend on progression. Actual round
            // selection and difficulty changes remain guarded by their existing lock checks.
            if (next) {
              panByLight[g.light] = g.start;
              applyPan(g.light);
              modeTransition(next, function () { render(); });
            } else {
              panByLight[g.light] = g.start;
              applyPan(g.light);
              if (next) flash(el.querySelector('[data-rm-light="' + next + '"]'));
            }
          } else {
            panByLight[g.light] = g.start;
            applyPan(g.light);
            if (!cancelled) startPanMomentum(g.light, g.velocity);
          }
        }
      }
      el.addEventListener('pointerup', function (event) { endPan(event, false); });
      el.addEventListener('pointercancel', function (event) { endPan(event, true); });
      el.addEventListener('lostpointercapture', function (event) { endPan(event, true); });
      el.addEventListener('click', function (event) {
        if (Date.now() < panSuppressClickUntil) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
      }, true);
    }

    function render() {
      // v842(사용자 지정): 현재 위치 두더지는 지금 선택된 난이도 지도에만 — 다른 난이도 탭에선 현재 표시 없음
      var cur = view === opts.currentLight() ? opts.currentChapter() : -1;
      renderFx();
      el.setAttribute('data-light', view);
      updateTicker();
      updateWallet();
      applyPan(view);
      $('[data-rm-bg]').src = A + ({ easy: 'window-v1263/scene.webp', mid: 'selected-v1281/normal-rear.webp', legend: 'selected-v1281/pro-rear.webp' }[view]);
      if (fluids && MG.RoundMapFluidScenes) {
        var scenes = MG.RoundMapFluidScenes;
        fluids.rear.setScene(view === 'mid' ? scenes['normal-rear'] : view === 'legend' ? scenes['pro-rear'] : null);
        fluids.front.setScene(view === 'legend' ? scenes['pro-front'] : null);
      }
      var holes = HOLES[view];
      el.querySelectorAll('.rm-round').forEach(function (r) {
        var n = +r.getAttribute('data-n');
        var h = holes[n - 1];
        r.style.left = (h[0] / BW * 100) + '%';
        r.style.top = (h[1] / BH * 100) + '%';
        var cleared = MG.Progress.get(n, view).cleared, open = MG.Progress.isUnlocked(n, view);
        var st = n === cur ? 'current' : !open ? 'locked' : cleared ? 'clear' : 'open';
        r.setAttribute('data-state', st);
        r.setAttribute('aria-pressed', st === 'current' ? 'true' : 'false');
        r.setAttribute('aria-disabled', open ? 'false' : 'true');
        r.querySelector('.rm-mole').src = A + 'mole-cur-' + view + '.png';
        r.querySelector('.rm-panel b').textContent = T('mole.rm.round', { n: n });
        r.querySelector('.rm-check').hidden = !cleared;
      });
      // Bonus details scroll in the opaque top strip; keep the foreground floor clear.
      el.querySelectorAll('[data-rm-light]').forEach(function (b) {
        var l = b.getAttribute('data-rm-light');
        b.classList.toggle('is-on', l === view);
        b.classList.toggle('is-locked', !MG.Progress.isLightUnlocked(l));
        b.setAttribute('aria-pressed', l === view ? 'true' : 'false');
        b.setAttribute('aria-disabled', MG.Progress.isLightUnlocked(l) ? 'false' : 'true');
      });
    }

    function show() {
      view = opts.currentLight(); render(); setTimeout(flyDragonflies, 50);
      el.classList.add('rm-preparing');
      whenModeReady(view, function () { el.classList.remove('rm-preparing'); });
      root.setTimeout(function () { el.classList.remove('rm-preparing'); }, 900); // 그 사이 탭 전환으로 콜백이 취소돼도 반드시 표시
    }
    return { show: show, pauseEffects: function (paused) {
      if (fluids) { fluids.rear.pause(paused); fluids.front.pause(paused); }
    } };
  }

  var api = { create: create, shapeTransition: shapeTransition };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RoundMap = api; }
})(typeof window !== 'undefined' ? window : null);

