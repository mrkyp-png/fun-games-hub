(function (root) {
  'use strict';
  // 홈 화면 다이얼패드 채널 링크 — regionId(0~14, 시작버튼=15는 항상 제외) → 채널 정보.
  // 여기 배열만 고치면 등록/교체/삭제 끝. lane-controls.js 의 길게누르기(onLongPress)가
  // 이 목록에서 찾아서 game.js 가 광고 후 새 탭으로 연다.
  var LINKS = {
    // 0: { url: 'https://www.youtube.com/@example', label: '예시채널' },
  };

  var api = { LINKS: LINKS };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ChannelLinks = api; }
})(typeof window !== 'undefined' ? window : null);
