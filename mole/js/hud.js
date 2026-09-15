(function (root) {
  'use strict';

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
    if (hearts) {
      // 5개 이상이면 아이콘 반복 대신 "❤️ N"
      hearts.textContent = state.lives >= 5
        ? '❤️ ' + state.lives
        : '❤️'.repeat(state.lives) + '🖤'.repeat(Math.max(0, 3 - state.lives));
    }

    // 시간 = 홈버튼(⊞) 중앙 숫자로 표기 ("초" 단위 생략).
    var timer = document.getElementById('hud-timer');
    if (timer) timer.textContent = String(Math.max(0, Math.ceil(state.timeRemaining)));

    // 콤보 = 게임화면 하단 중앙(하트가 있는 줄)에 표기. 0이면 표시 안 함.
    var combo = document.getElementById('hud-combo');
    if (combo) {
      combo.textContent = state.combo > 0
        ? I.t(state.isMaxCombo ? 'mole.hud.maxCombo' : 'mole.hud.combo', { n: state.combo })
        : '';
    }
  }

  var api = { update: update };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
