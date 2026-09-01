(function (root) {
  'use strict';
  var I = root.FGH && root.FGH.I18N;
  if (!I) return;
  I.register({
    ko: {
      'mole.title': '두더지 게임',
      'mole.start.tag': '10개 라운드, 각 30초! 두더지를 최대한 많이 잡아 점수를 올려요.',
      'mole.start.btn': '시작',
      'mole.start.best': '최고 기록 {n}점',
      'mole.round': '라운드 {n}',
      'mole.roundDone': '라운드 {n} 완료!',
      'mole.cumulative': '누적 {n}점',
      'mole.count.go': '시작!',
      'mole.result.allClear': '전체 클리어!',
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
      'mole.start.tag': '10 rounds, 30 seconds each! Whack as many moles as you can.',
      'mole.start.btn': 'Start',
      'mole.start.best': 'Best {n}',
      'mole.round': 'Round {n}',
      'mole.roundDone': 'Round {n} clear!',
      'mole.cumulative': 'Total {n}',
      'mole.count.go': 'Go!',
      'mole.result.allClear': 'All rounds clear!',
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
