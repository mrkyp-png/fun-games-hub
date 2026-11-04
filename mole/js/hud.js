(function (root) {
  'use strict';

  var rails = null, fitFrame = 0;
  function scheduleFit() {
    if (!rails || fitFrame) return;
    fitFrame = root.requestAnimationFrame(function () {
      fitFrame = 0;
      if (!rails) return;
      var horizontal = root.matchMedia && root.matchMedia('(orientation:landscape)').matches;
      var depth = horizontal ? rails.leading.clientWidth : rails.leading.clientHeight;
      document.getElementById('game-screen').classList.toggle('hud-compact', depth > 0 && depth < 36);
      var values = rails.fittable;
      values.forEach(function (el) { el.style.fontSize = ''; el.style.transform = ''; });
      values.forEach(function (el) {
        var available = el.clientWidth, natural = el.scrollWidth;
        if (available <= 0 || natural <= available) return;
        var original = parseFloat(root.getComputedStyle(el).fontSize) || 16;
        var size = Math.max(8, original * available / natural);
        el.style.fontSize = size + 'px';
        var width = natural * size / original;
        if (width > available) el.style.transform = 'scaleX(' + (available / width).toFixed(4) + ')';
      });
    });
  }
  function setText(el, value) {
    if (el && el.textContent !== value) { el.textContent = value; scheduleFit(); }
  }
  function setPopupMode(value) {
    var screen = document.getElementById('game-screen');
    if (!value) {
      if (!rails) return;
      if (fitFrame) root.cancelAnimationFrame(fitFrame);
      fitFrame = 0;
      if (rails.observer) rails.observer.disconnect();
      rails.homes.slice().reverse().forEach(function (home) {
        home.parent.insertBefore(home.el, home.next && home.next.parentNode === home.parent ? home.next : null);
      });
      rails.copies.forEach(function (copy) {
        while (copy.firstChild) copy.parentNode.insertBefore(copy.firstChild, copy);
        copy.remove();
      });
      rails.fittable.forEach(function (el) { el.style.fontSize = ''; el.style.transform = ''; });
      rails.leading.remove(); rails.trailing.remove(); rails = null;
      screen.classList.remove('game-status-rails');
      screen.classList.remove('hud-compact');
      return;
    }
    if (rails) { scheduleFit(); return; }
    var score = document.querySelector('#mole-status .ms-score');
    var combo = document.querySelector('#mole-status .ms-combo');
    var time = document.getElementById('hud-time');
    var heart = document.querySelector('#mole-status .ms-heart');
    var home = document.getElementById('btn-back-to-hub');
    var elements = [score, combo, time, heart, home];
    if (!screen || elements.some(function (el) { return !el; })) return;
    var homes = elements.map(function (el) { return {el:el, parent:el.parentNode, next:el.nextSibling}; });
    var leading = document.createElement('div'), trailing = document.createElement('div');
    leading.id = 'hud-leading'; leading.className = 'hud-rail hud-rail--leading';
    trailing.id = 'hud-trailing'; trailing.className = 'hud-rail hud-rail--trailing';
    var round = document.createElement('div'); round.className = 'ms-box ms-round';
    var label = document.createElement('span'); label.className = 'ms-label'; label.textContent = 'ROUND';
    var number = document.createElement('b'); number.id = 'hud-round-val'; number.className = 'ms-val'; number.textContent = '01';
    round.appendChild(label); round.appendChild(number);
    var copies = [], values = [], fittable = [];
    [time, heart, score, round, combo].forEach(function (box) {
      box.classList.remove('is-hud-popup');
      var copy = document.createElement('span'); copy.className = 'hud-copy';
      ['.ms-label', '.ms-val'].forEach(function (selector) {
        var el = box.querySelector(selector);
        if (el) { copy.appendChild(el); fittable.push(el); if (selector === '.ms-val') values.push(el); }
      });
      box.appendChild(copy); copies.push(copy);
    });
    [home, round, time, heart].forEach(function (el) { leading.appendChild(el); });
    [score, combo].forEach(function (el) { trailing.appendChild(el); });
    screen.appendChild(leading); screen.appendChild(trailing);
    rails = {leading:leading, trailing:trailing, homes:homes, copies:copies, values:values, fittable:fittable, comboBucket:0, comboSwapped:false};
    trailing.dataset.comboSwapped='false';
    screen.classList.add('game-status-rails');
    if (root.ResizeObserver) {
      rails.observer = new root.ResizeObserver(scheduleFit);
      rails.observer.observe(leading); rails.observer.observe(trailing);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFit);
    scheduleFit();
  }

  function syncComboColors(combo) {
    if (!rails) return;
    var bucket = Math.floor(combo / 10);
    var crossed = Math.max(0, bucket - rails.comboBucket);
    if (crossed % 2) rails.comboSwapped = !rails.comboSwapped;
    rails.comboBucket = bucket;
    rails.trailing.dataset.comboSwapped = String(rails.comboSwapped);
  }
  function resetComboColors() {
    if (!rails) return;
    rails.comboBucket = 0; rails.comboSwapped = false;
    rails.trailing.dataset.comboSwapped = 'false';
  }

  function setAll(cls, text) {
    var els = document.querySelectorAll('#hud-ticker .' + cls);
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  function update(state) {
    var I = window.FGH.I18N;
    setAll('tk-mode', state.modeLabel || I.t('mole.mode')); // 현재 챕터 이름 (game.js), 없으면 "두더지팡"
    // 티커의 챕터 이름 뒤에 이어지는 게임 팁. 챕터별 안내문구(chapterDesc, 챕터2~10)가 있으면
    // 기존 고정 팁(저글/콤보) 대신 그 설명 하나만 표시(사용자 지정: "기존 티커 내용은 삭제후 적용").
    if (state.chapterDesc) {
      setAll('tk-tip1', state.chapterDesc);
      setAll('tk-tip2', '');
    } else {
      setAll('tk-tip1', I.t('mole.tip.juggle'));
      setAll('tk-tip2', I.t('mole.tip.maxCombo'));
    }

    var score = document.getElementById('hud-score');
    setText(score, (state.score || 0).toLocaleString());

    var hearts = document.getElementById('hud-hearts');
    setText(hearts, String(state.lives));

    // 시간 = 상단 상태판 TIME 칸 — 남은 시간 m:ss, 시계 바늘은 흐른 비율만큼 한 바퀴, 5초 이하 빨강 깜빡임.
    var time = document.getElementById('hud-time');
    if (time && state.timeTotal > 0) {
      var left = Math.max(0, state.timeRemaining);
      var sec = Math.ceil(left);
      setText(document.getElementById('hud-time-val'), Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'));
      var hand = time.querySelector('.ms-clock-hand');
      if (hand) hand.style.transform = 'rotate(' + ((1 - left / state.timeTotal) * 360).toFixed(1) + 'deg)';
      time.classList.toggle('is-low', left <= 5);
    }

    var combo = document.getElementById('hud-combo');
    var comboValue = Math.max(0, Math.trunc(Number(state.combo) || 0));
    setText(combo, String(comboValue));
    syncComboColors(comboValue);
    setText(document.getElementById('hud-round-val'), String(Math.max(1, Math.trunc(Number(state.round) || 1))).padStart(2, '0'));
  }

  var api = { update: update, setPopupMode: setPopupMode, resetComboColors: resetComboColors };
  if (root && root.addEventListener) root.addEventListener('resize', scheduleFit);
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
