(function (root) {
  'use strict';

  function setAll(cls, text) {
    var els = document.querySelectorAll('#hud-ticker .' + cls);
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  function update(state) {
    var I = window.FGH.I18N;
    setAll('tk-mode', I.t('mole.mode'));
    setAll('tk-lv', I.t('mole.round', { n: state.round }));
    setAll('tk-t', I.t('mole.hud.sec', { n: Math.max(0, Math.ceil(state.timeRemaining)) }));
    setAll('tk-c', state.combo > 0
      ? I.t(state.isMaxCombo ? 'mole.hud.maxCombo' : 'mole.hud.combo', { n: state.combo })
      : I.t('mole.hud.combo', { n: 0 }));

    var score = document.getElementById('hud-score');
    if (score) score.textContent = (state.score || 0).toLocaleString();

    var hearts = document.getElementById('hud-hearts');
    if (hearts) {
      hearts.textContent = '❤️'.repeat(state.lives) +
        '🖤'.repeat(Math.max(0, 3 - state.lives));
    }
  }

  var api = { update: update };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
