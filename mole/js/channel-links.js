(function (root) {
  'use strict';
  // 홈 화면 다이얼패드 채널 링크 — regionId(0~14, 시작버튼=15는 항상 제외) → 채널 정보.
  // 여기 LINKS 에 넣으면 "모든 유저 폰"에 그 버튼이 채널 버튼으로 나온다 (배포용).
  // 유저가 앱에서 직접 등록한 건 mole.channelUser.<id> (localStorage, 그 기기만) — chLink() 가 그걸 우선함.
  //
  // 형식: id: { url: 'https://www.youtube.com/@핸들', icon: 'https://unavatar.io/youtube/핸들' }
  //  - icon 생략 가능 (그러면 유튜브 로고로 표시)
  //  - 빈 상태(여기 없음)면 그 버튼은 평범한 숫자패드 버튼, 짧게 두 번 누르면 등록창이 뜬다.
  var LINKS = {
    // (테스트 스캐폴드 @UIMotionEffects 15칸은 v236 에서 비움 — 실제 채널은 여기 추가하거나 앱에서 등록)
  };

  var api = { LINKS: LINKS };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ChannelLinks = api; }
})(typeof window !== 'undefined' ? window : null);
