// 라운드 선택 광산 맵(v763) — 바탕화면 "MOLE PANG 라운드 선택 화면 최종 구현 명세서" 기준.
// 두더지가 S자 땅굴을 따라 내려가는 세로 맵. 난이도(Amateur/Normal/Pro = 라이트 ON/DIM/OFF)별로
// 배경·헬멧 색·정보판 내용만 바뀌고 구도는 같다. 현재 라운드 = localStorage 'mole.chapter'(홈과 공유),
// 난이도 = 'mole.difficulty'. 실제 저장·검증은 game.js 가 넘겨준 콜백(select/setLight)이 한다.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var A = 'assets/roundmap/';
  var LIGHTS = ['easy', 'mid', 'legend'];
  // 배경별 굴 중심(941×1672 기준 px) — 배경마다 그림이 조금씩 달라 굴 위치를 따로 잰 값.
  var HOLES = {
    easy:   [[310, 235], [434, 398], [312, 549], [469, 703], [598, 840], [420, 976], [594, 1116], [456, 1258]],
    mid:    [[334, 251], [453, 413], [333, 562], [466, 711], [595, 855], [443, 1008], [590, 1152], [467, 1298]],
    legend: [[326, 252], [452, 415], [328, 563], [470, 713], [606, 848], [436, 982], [600, 1115], [464, 1255]]
  };
  var BW = 941, BH = 1672;
  // 배경 효과 위치(941×1672 px): 랜턴 불빛 / 광물 반짝임 — 배경 그림의 랜턴·광물 자리
  // 배경 효과 위치(941×1672 px). glow=랜턴 불빛, spark=금·보석이 있는 곳에서만 반짝(사용자 지정 v767),
  // bubble=물(폭포 아래 웅덩이)이 있는 곳에서만 물방울이 올라옴(Normal, 사용자 지정 v767).
  var FX = {
    easy:   { glow: [[125, 318], [832, 560], [138, 930]], spark: [[75, 509], [83, 542], [267, 859], [767, 1026], [800, 1000], [175, 1118], [183, 1151], [284, 1234], [759, 1243], [25, 1068]], bubble: [] },
    mid:    { glow: [[130, 350], [840, 680], [260, 920], [860, 90]], spark: [[300, 125], [208, 128], [475, 40], [800, 120], [750, 325], [175, 450], [247, 450], [67, 600], [158, 617], [225, 734], [759, 776], [167, 1034], [183, 1151]],
              bubble: [[700, 790], [800, 1090], [745, 1300], [300, 1290], [300, 1560], [440, 1600], [590, 1610]] },
    legend: { glow: [[108, 330], [92, 600], [840, 650], [125, 970], [880, 1100]], spark: [[167, 425], [140, 440], [208, 1151], [158, 1168], [859, 1243]], bubble: [] }
  };

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var view = null; // 지금 보고 있는 난이도

    el.querySelector('[data-back="roundmap"]').addEventListener('click', function () { root.FGH.rollOut(el, opts.onClose); }); // v790: 위로 말리며 사라짐
    el.querySelectorAll('[data-rm-light]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-rm-light');
        if (!MG.Progress.isLightUnlocked(l)) { flash(b); return; }
        view = l; opts.setLight(l); render();
      });
    });

    function flash(b) { b.classList.remove('is-deny'); void b.offsetWidth; b.classList.add('is-deny'); }

    // 굴 8개 + 하단 아이콘 8개 뼈대 1회 생성
    var tunnel = $('[data-rm-rounds]'), icons = $('[data-rm-icons]');
    for (var n = 1; n <= 8; n++) {
      (function (n) {
        var r = document.createElement('button');
        r.type = 'button'; r.className = 'rm-round'; r.setAttribute('data-n', n);
        r.style.setProperty('--d', n);
        r.innerHTML = '<span class="rm-depth"></span><span class="rm-dark"></span><img class="rm-mole" alt=""><img class="rm-arrow" src="' + A + 'arrow.png" alt="">' +
          '<img class="rm-crown" src="' + A + 'crown.png" alt=""><img class="rm-lock" src="' + A + 'lock.png" alt="">' +
          '<span class="rm-panel"><b></b></span><img class="rm-check" src="' + A + 'check.png" alt="">';
        r.addEventListener('click', function () { pick(n, r); });
        tunnel.appendChild(r);
        var ic = document.createElement('button');
        ic.type = 'button'; ic.className = 'rm-icon'; ic.setAttribute('data-n', n);
        ic.innerHTML = '<img class="rm-icon-img" alt=""><b>' + n + '</b><img class="rm-icon-check" src="' + A + 'check.png" alt="">';
        ic.addEventListener('click', function () { pick(n, ic); });
        icons.appendChild(ic);
      })(n);
    }

    function pick(n, btn) {
      if (!MG.Progress.isUnlocked(n, view)) { flash(btn); return; }
      opts.select(n);
      render();
    }

    function renderFx() {
      var fx = $('[data-rm-fx]'); if (fx.getAttribute('data-for') === view) return;
      fx.setAttribute('data-for', view); fx.innerHTML = '';
      var f = FX[view], html = '';
      f.glow.forEach(function (p) { html += '<span class="rm-glow" style="left:' + (p[0] / BW * 100) + '%;top:' + (p[1] / BH * 100) + '%"></span>'; });
      f.spark.forEach(function (p) { for (var k = 0; k < 5; k++) { var ox = k ? (Math.random() * 60 - 30) : 0, oy = k ? (Math.random() * 50 - 25) : 0; html += '<span class="rm-spark" style="left:' + ((p[0] + ox) / BW * 100) + '%;top:' + ((p[1] + oy) / BH * 100) + '%;animation-delay:' + (-Math.random() * 3).toFixed(2) + 's;animation-duration:' + (2.2 + Math.random() * 1.6).toFixed(2) + 's;scale:' + (0.6 + Math.random() * 0.6).toFixed(2) + '"></span>'; } }); // v801: 보석 반짝임 5배(사용자 지정)
      // Amateur(지상 광산): 나비 3마리 + 잠자리 2마리가 하늘·풀밭 위를 날아다님(사용자 지정 v763)
      if (view === 'easy') {
        html += '<span class="hg-bfly hg-bfly--p rm-bfly rm-bfly--1"></span><span class="hg-bfly hg-bfly--y rm-bfly rm-bfly--2"></span><span class="hg-bfly hg-bfly--b rm-bfly rm-bfly--3"></span>';
        html += '<span class="rm-dfly rm-dfly--1"><b></b></span><span class="rm-dfly rm-dfly--2"><b></b></span>';
      }
      f.bubble.forEach(function (p, k) {
        for (var b = 0; b < 3; b++) {
          html += '<em class="rm-bub" style="left:' + ((p[0] + (Math.random() * 40 - 20)) / BW * 100).toFixed(2) + '%;top:' + (p[1] / BH * 100).toFixed(2) + '%;animation-delay:' + (-Math.random() * 2.6).toFixed(2) + 's;animation-duration:' + (2 + Math.random() * 1.4).toFixed(2) + 's"></em>';
        }
      });
      for (var i = 0; i < (view === 'mid' ? 0 : 18); i++) {
        html += '<i style="left:' + (5 + Math.random() * 90).toFixed(1) + '%;top:' + (15 + Math.random() * 70).toFixed(1) + '%;animation-delay:' + (-Math.random() * 9).toFixed(2) + 's"></i>';
      }
      fx.innerHTML = html;
      if (view === 'easy') setTimeout(flyDragonflies, 50);
    }

    // 잠자리(Amateur): 위쪽 하늘(배경 y 0~120px) 안에서만 무작위 지점으로 '호버링 → 휙' 이동(사용자 지정)
    var dflyTimer = null;
    function flyDragonflies() {
      clearTimeout(dflyTimer);
      if (el.hidden || view !== 'easy') return;
      el.querySelectorAll('.rm-dfly').forEach(function (d) {
        if (Math.random() < 0.45) return; // 일부는 제자리 호버링
        var x = 3 + Math.random() * 86, y = 0.5 + Math.random() * 7; // cqw — 하늘 띠 안(굴·풀밭 아래로 안 내려옴)
        var ang = (Math.random() < 0.5 ? 90 : -90) + (Math.random() * 30 - 15);
        d.style.setProperty('--t', (0.35 + Math.random() * 0.5).toFixed(2) + 's');
        d.style.transform = 'translate(' + x.toFixed(1) + 'cqw,' + y.toFixed(1) + 'cqw) rotate(' + ang.toFixed(0) + 'deg)';
      });
      dflyTimer = setTimeout(flyDragonflies, 900 + Math.random() * 1400);
    }

    function render() {
      // v842(사용자 지정): 현재 위치 두더지는 지금 선택된 난이도 지도에만 — 다른 난이도 탭에선 현재 표시 없음
      var cur = view === opts.currentLight() ? opts.currentChapter() : -1;
      renderFx();
      el.setAttribute('data-light', view);
      $('[data-rm-bg]').src = A + 'bg-' + view + '.jpg';
      var holes = HOLES[view];
      el.querySelectorAll('.rm-round').forEach(function (r) {
        var n = +r.getAttribute('data-n');
        var h = holes[n - 1];
        r.style.left = (h[0] / BW * 100) + '%';
        r.style.top = (h[1] / BH * 100) + '%';
        var cleared = MG.Progress.get(n, view).cleared, open = MG.Progress.isUnlocked(n, view);
        var st = n === cur ? 'current' : !open ? 'locked' : cleared ? 'clear' : 'open';
        r.setAttribute('data-state', st);
        r.querySelector('.rm-mole').src = A + 'mole-cur-' + view + '.png';
        r.querySelector('.rm-panel b').textContent = T('mole.rm.round', { n: n });
        r.querySelector('.rm-check').hidden = !cleared;
      });
      el.querySelectorAll('.rm-icon').forEach(function (ic) {
        var n = +ic.getAttribute('data-n');
        var cleared = MG.Progress.get(n, view).cleared, open = MG.Progress.isUnlocked(n, view);
        var st = n === cur ? 'current' : !open ? 'locked' : cleared ? 'clear' : 'open';
        ic.setAttribute('data-state', st);
        ic.querySelector('.rm-icon-img').src = st === 'locked' ? A + 'icon-lock.png' : st === 'current' ? A + 'icon-cur-' + view + '.png' : A + 'icon-hole-' + view + '.png'; // v842(사용자 지정): 두더지는 현재 위치 한 마리만 — 나머지 열린 라운드는 빈 굴
      });
      // 정보판 — 라이트 이름 + 실제 게임 규칙값(game.js SCORE_MULT/COMBO_LIFE_BONUS 에서 받음)
      var rule = opts.rules(view);
      $('[data-rm-light-name]').textContent = T('mole.rm.light.' + view);
      $('[data-rm-base]').textContent = '×' + rule.base.toFixed(1);
      $('[data-rm-fever]').textContent = '×' + rule.fever.toFixed(1);
      $('[data-rm-heart]').textContent = T('mole.rm.heart', { n: rule.heart });
      el.querySelectorAll('[data-rm-light]').forEach(function (b) {
        var l = b.getAttribute('data-rm-light');
        b.classList.toggle('is-on', l === view);
        b.classList.toggle('is-locked', !MG.Progress.isLightUnlocked(l));
      });
    }

    function show() { view = opts.currentLight(); render(); setTimeout(flyDragonflies, 50); }
    return { show: show };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RoundMap = api; }
})(typeof window !== 'undefined' ? window : null);
