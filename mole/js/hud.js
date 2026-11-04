(function (root) {
  'use strict';

  var popupMode = false, previous = null, popupTimer = 0, showing = '', pending = [], homes = [];
  function showNextPopup() {
    if (!popupMode || showing || !pending.length) return;
    showing = pending.shift();
    var box = document.querySelector('#mole-status .ms-' + showing);
    if (box) box.classList.add('is-hud-popup');
    popupTimer = setTimeout(function () {
      if (box) box.classList.remove('is-hud-popup');
      showing = ''; popupTimer = 0; showNextPopup();
    }, 800);
  }
  function setPopupMode(value) {
    clearTimeout(popupTimer); popupTimer = 0; showing = ''; pending = []; previous = null;
    popupMode = !!value;
    if (popupMode && !homes.length) {
      var bar = document.querySelector('#game-screen .game-hud');
      if (bar) ['mole-status', 'btn-back-to-hub'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) homes.push({el:el, parent:el.parentNode, next:el.nextSibling});
      });
      homes.forEach(function (home) { bar.appendChild(home.el); });
    } else if (!popupMode) {
      homes.forEach(function (home) { home.parent.insertBefore(home.el, home.next && home.next.parentNode === home.parent ? home.next : null); });
      homes = [];
    }
    ['score', 'combo'].forEach(function (key) {
      var box = document.querySelector('#mole-status .ms-' + key);
      if (box) box.classList.remove('is-hud-popup');
    });
  }
  function updatePopups(state) {
    if (!popupMode) return;
    var values = {score: state.score || 0, combo: state.combo || 0};
    if (previous) ['score', 'combo'].forEach(function (key) {
      if (values[key] !== previous[key] && key !== showing && pending.indexOf(key) < 0) pending.push(key);
    });
    previous = values; showNextPopup();
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
    if (score) score.textContent = (state.score || 0).toLocaleString();

    var hearts = document.getElementById('hud-hearts');
    if (hearts) hearts.textContent = String(state.lives);

    // 시간 = 상단 상태판 TIME 칸 — 남은 시간 m:ss, 시계 바늘은 흐른 비율만큼 한 바퀴, 5초 이하 빨강 깜빡임.
    var time = document.getElementById('hud-time');
    if (time && state.timeTotal > 0) {
      var left = Math.max(0, state.timeRemaining);
      var sec = Math.ceil(left);
      document.getElementById('hud-time-val').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      var hand = time.querySelector('.ms-clock-hand');
      if (hand) hand.style.transform = 'rotate(' + ((1 - left / state.timeTotal) * 360).toFixed(1) + 'deg)';
      time.classList.toggle('is-low', left <= 5);
    }

    var combo = document.getElementById('hud-combo');
    if (combo) combo.textContent = String(state.combo || 0);
    updatePopups(state);
  }

  var api = { update: update, setPopupMode: setPopupMode };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
