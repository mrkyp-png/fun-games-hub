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
    easy: {
      glow:[], spark:[], bubble:[],
      // The fixed foreground has one prominent blue cluster in the treasure cart.
      gem:[[83,1026,'cyan']],
      // Background crystals are anchored to the moving rear-mine artwork.
      rearGem:[[170,180,'cyan'],[170,290,'cyan'],[204,608,'cyan'],[148,872,'cyan'],[171,1047,'cyan'],[885,174,'cyan'],[807,287,'cyan'],[849,518,'cyan'],[844,613,'cyan'],[856,846,'cyan'],[840,1040,'cyan'],[837,1276,'cyan']],
      // Fixed frame lanterns; rear fixtures live in the moving mine layer below.
      lantern:[[115,310],[880,418]],
      rearLantern:[[270,174],[137,425],[72,575],[645,340],[882,330]]
    },
    mid: {
      glow:[], spark:[], bubble:[],
      gem:[[252,132,'cyan'],[150,190,'violet'],[452,292,'cyan'],[178,426,'cyan'],[150,590,'violet'],[610,575,'cyan'],[290,713,'violet'],[135,770,'cyan'],[78,872,'cyan'],[667,858,'violet'],[203,1015,'cyan'],[680,1198,'violet'],[230,1372,'cyan'],[152,1549,'violet'],[91,1578,'cyan']],
      rearGem:[[31,227,'cyan'],[206,70,'violet'],[159,193,'violet'],[553,106,'cyan'],[192,325,'cyan'],[153,448,'violet'],[100,587,'cyan'],[714,435,'cyan'],[445,752,'violet'],[516,651,'cyan'],[919,580,'violet'],[800,660,'cyan'],[54,882,'cyan'],[116,1277,'violet'],[255,1368,'cyan'],[83,1369,'violet'],[606,1605,'cyan'],[876,1371,'violet']],
      lantern:[[220,252],[343,220],[478,565],[646,443],[595,945],[198,845],[294,1181],[430,1166],[785,1340],[658,1271],[620,1490]],
      rearLantern:[[873,608],[787,341],[807,469],[879,326],[636,184],[545,334],[483,75],[785,462],[852,578],[892,571]]
    },
    legend: {
      glow:[], spark:[], bubble:[],
      // Coordinates are centered on the visible pink crystal faces in pro-front-supported.webp.
      // Avoid the previous bare-rock/lantern points and keep one halo per nearby crystal cluster.
      gem:[[205,152,'red'],[395,164,'red'],[542,339,'red'],[558,578,'red'],[57,839,'red'],[585,858,'red'],[255,969,'red'],[389,990,'red'],[635,1174,'red'],[157,1472,'red'],[857,1464,'red'],[834,1587,'red'],[795,1615,'red']],
      // Only keep exposed rear crystals; the former left-side point was on bare rock.
      rearGem:[[34,1200,'red'],[145,1480,'red'],[850,1445,'red'],[856,1618,'red']],
      lantern:[[220,252],[343,220],[478,565],[646,443],[595,945],[198,845],[294,1181],[430,1166],[785,1340],[658,1271],[620,1490]],
      rearLantern:[[804,470],[174,163],[272,144],[362,240],[701,406],[501,310],[562,198],[578,927],[543,1086],[838,1452],[823,1507],[901,1218]]
    }
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
      if (label) label.textContent = text;
      if (!track) return;
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

    el.querySelector('[data-back="roundmap"]').addEventListener('click', function () { root.FGH.rollOut(el, opts.onClose); }); // v790: 위로 말리며 사라짐
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
        view = l; render(); // v844(사용자 지정): 탭은 그 난이도 지도 보기만 — 내 위치(홈 라운드)는 라운드를 눌러야 바뀜
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
    var pageAnimationTimer = 0, pageOrder = ['easy', 'mid', 'legend'];
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
    function animatePage(entrySide) {
      root.clearTimeout(pageAnimationTimer);
      el.classList.remove('rm-page-from-left', 'rm-page-from-right');
      void el.offsetWidth;
      el.classList.add(entrySide === 'right' ? 'rm-page-from-right' : 'rm-page-from-left');
      pageAnimationTimer = root.setTimeout(function () {
        el.classList.remove('rm-page-from-left', 'rm-page-from-right');
      }, 280);
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
              view = next;
              render();
              animatePage(dx < 0 ? 'right' : 'left');
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

    function show() { view = opts.currentLight(); render(); setTimeout(flyDragonflies, 50); }
    return { show: show, pauseEffects: function (paused) {
      if (fluids) { fluids.rear.pause(paused); fluids.front.pause(paused); }
    } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RoundMap = api; }
})(typeof window !== 'undefined' ? window : null);

