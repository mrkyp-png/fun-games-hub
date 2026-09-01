(function (root) {
  'use strict';
  var I = root.FGH && root.FGH.I18N;
  if (!I) return;
  I.register({
    ko: {
      'mole.title': '두더지 게임',
      'mole.start.tag': '1분 동안 두더지를 최대한 많이 잡아 점수를 올려요!',
      'mole.start.btn': '시작',
      'mole.start.best': '최고 기록 {n}점',
      'mole.ready': '준비!',
      'mole.count.go': '시작!',
      'mole.result.time': '시간 종료!',
      'mole.result.lives': '목숨 소진!',
      'mole.result.score': '{n}점',
      'mole.result.newBest': '최고 기록 달성! {n}점',
      'mole.result.best': '최고 기록 {n}점',
      'mole.mode': '두더지만 때려잡자!',
      'mole.hud.sec': '{n}초',
      'mole.hud.combo': 'COMBO {n}',
      'mole.hud.maxCombo': 'MAX COMBO {n}',
      'mole.fx.tap': '톡!', 'mole.fx.bam': '쾅!', 'mole.fx.clang': '깡!'
    },
    en: {
      'mole.title': 'Whack-a-Mole',
      'mole.start.tag': 'Whack as many moles as you can in 60 seconds!',
      'mole.start.btn': 'Start',
      'mole.start.best': 'Best {n}',
      'mole.ready': 'Ready?',
      'mole.count.go': 'Go!',
      'mole.result.time': "Time's up!",
      'mole.result.lives': 'Out of lives!',
      'mole.result.score': '{n} pts',
      'mole.result.newBest': 'New best! {n}',
      'mole.result.best': 'Best {n}',
      'mole.mode': 'Whack those moles!',
      'mole.hud.sec': '{n}s',
      'mole.hud.combo': 'COMBO {n}',
      'mole.hud.maxCombo': 'MAX COMBO {n}',
      'mole.fx.tap': 'Tap!', 'mole.fx.bam': 'Bam!', 'mole.fx.clang': 'Clang!'
    }
  });
})(typeof window !== 'undefined' ? window : null);
