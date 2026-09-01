(function (root) {
  'use strict';
  var I = root.FGH && root.FGH.I18N;
  if (!I) return;
  I.register({
    ko: {
      'hub.title': 'Fun Games',
      'hub.tab.score': '스코어', 'hub.tab.album': '앨범', 'hub.tab.home': '홈', 'hub.tab.shop': '상점',
      'hub.card.snake': '지렁이', 'hub.card.mole': '두더지', 'hub.card.match': '그림맞추기', 'hub.card.coloring': '색칠하기',
      'hub.comingSoon': '준비 중이에요. 곧 만나요!'
    },
    en: {
      'hub.title': 'Fun Games',
      'hub.tab.score': 'Score', 'hub.tab.album': 'Album', 'hub.tab.home': 'Home', 'hub.tab.shop': 'Shop',
      'hub.card.snake': 'Snake', 'hub.card.mole': 'Whack-a-Mole', 'hub.card.match': 'Match', 'hub.card.coloring': 'Coloring',
      'hub.comingSoon': 'Coming soon!'
    }
  });
})(typeof window !== 'undefined' ? window : null);
