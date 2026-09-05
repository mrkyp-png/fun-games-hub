// 두더지 게임 서비스워커.
// fetch 전략 = 네트워크 우선: 온라인이면 항상 네트워크에서 최신본을 받고, 캐시는 오프라인
// 폴백 전용으로만 갱신한다. (예전엔 stale-while-revalidate라 배포해도 "다음 실행"에야
// 반영돼 사용자 체감 대기가 길었음 — 온라인=항상 최신, 오프라인=마지막 캐시로 변경.)
// SHELL 목록 자체가 바뀔 때만 CACHE 를 올린다.
const CACHE = 'mole-game-v166';

// bgm-boss-battle.mp3(6.8MB)는 SHELL 에 안 넣는다 — BGM 은 기본 꺼짐이라 켜는 사람만 받으면 된다.
// vendor/face_mesh/*(약 10MB, 얼굴인식)도 SHELL 제외 — 사람두더지 메이커 처음 열 때만 필요.
// 둘 다 처음 요청될 때 아래 fetch 핸들러(stale-while-revalidate)가 알아서 캐시한다.
const SHELL = [
  './',
  './index.html',
  './style.css',
  '../cosmic-theme.css',
  '../common/settings.css',
  '../common/settings.js',
  '../common/i18n.js',
  './js/i18n-strings.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/board-scene.jpg',
  './assets/loading.png',
  './assets/avatar-mole.png',
  './assets/avatar-hippo.png',
  './assets/cloud1.png',
  './assets/cloud2.png',
  './assets/hammer.png',
  './assets/weapons/cannon.png',
  './assets/weapons/cannon-low.png',
  './assets/weapons/cannon-steep.png',
  './assets/weapons/cannon-ball.png',
  './assets/weapons/cannon-fx1.png',
  './assets/weapons/cannon-fx4.png',
  './assets/weapons/cannon-fx5.png',
  './assets/hippo/happy1.png',
  './assets/hippo/happy2.png',
  './assets/hippo/happy3.png',
  './assets/hippo/sad1.png',
  './assets/hippo/sad2.png',
  './assets/hippo/sad3.png',
  './assets/moles/mole1.png',
  './assets/moles/mole2.png',
  './assets/moles/mole3.png',
  './assets/moles/mole4.png',
  './assets/moles/mole5.png',
  './assets/moles/mole6.png',
  './assets/moles/mole7.png',
  './assets/moles/mole8.png',
  './assets/moles/peek1.png',
  './assets/moles/peek2.png',
  './assets/moles/helmet.png',
  './assets/moles/hole.png',
  './assets/moles/hole-front.png',
  './assets/moles/shield.png',
  './assets/moles/rabbit.png',
  './assets/moles/rabbit-x.png',
  './assets/moles/tiger.png',
  './assets/moles/tiger-x.png',
  './assets/moles/hippo.png',
  './assets/moles/hippo-x.png',
  './assets/moles/lion.png',
  './assets/moles/lion-x.png',
  './assets/moles/dog.png',
  './assets/moles/dog-x.png',
  './audio/hit1.mp3',
  './audio/hit2.mp3',
  './audio/hit3.mp3',
  './audio/hit4.mp3',
  './js/levels.js',
  './js/progress.js',
  './js/chat-phrases.js',
  './js/rng.js',
  './js/combo-score.js',
  './js/grid-partition.js',
  './js/spawn-scheduler.js',
  './js/mole-sprites.js',
  './js/costume.js',
  './js/costume-art.js',
  './js/mole-composite.js',
  './js/face-detect.js',
  './js/pop-elements.js',
  './js/hole-layer.js',
  './js/hit-fx.js',
  './js/lane-hammer.js',
  './js/lane-cannon.js',
  './js/lane-controls.js',
  './js/region-reveal.js',
  './js/hud.js',
  './js/sky.js',
  './js/screen-nav.js',
  './js/economy.js',
  './js/face-store.js',
  './js/ads.js',
  './js/face-maker.js',
  './js/costume-screen.js',
  './js/face-locker.js',
  './js/more-menu.js',
  './js/shop.js',
  './js/daily.js',
  './js/score-screen.js',
  './js/settings-screen.js',
  './js/inventory-screen.js',
  './js/game.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // 네트워크 우선: 온라인이면 항상 최신본을 바로 받는다(캐시는 오프라인 폴백용으로만 갱신).
  // 예전엔 stale-while-revalidate(캐시본 먼저)라 "항상 한 번 밀려서 반영"됐음 — 사용자가
  // 폰에서 대기가 길다고 느껴 네트워크 우선으로 변경.
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      // 오프라인 + 캐시에 없음. undefined 를 반환하면 브라우저가 "인터넷 연결 없음" 페이지를 띄우므로 금지.
      if (e.request.mode === 'navigate') {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
      return Response.error();
    }
  })());
});
