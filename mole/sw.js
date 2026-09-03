// 두더지 게임 서비스워커.
// fetch 전략 = stale-while-revalidate: 캐시본을 즉시 주되 백그라운드로 최신본을 받아 캐시를 갱신한다.
// → 파일이 바뀌면 CACHE 버전을 안 올려도 "다음 실행"에 자동 반영된다 (이전엔 캐시-우선이라
//   sw.js 자체가 안 바뀌면 style.css/이미지 변경이 폰에 영영 안 걸렸음).
// SHELL 목록 자체가 바뀔 때만 CACHE 를 올린다.
const CACHE = 'mole-game-v43';

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

  // 백그라운드로 항상 네트워크에서 받아 캐시를 갱신 (다음 로드에 최신본 반영).
  const network = fetch(e.request).then((res) => {
    if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => null);
  e.waitUntil(network);

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;            // 캐시 있으면 즉시 (갱신은 위에서 백그라운드로)
    const res = await network;
    if (res) return res;
    // 오프라인 + 캐시에 없음. undefined 를 반환하면 브라우저가 "인터넷 연결 없음" 페이지를 띄우므로 금지.
    if (e.request.mode === 'navigate') {
      return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
    }
    return Response.error();
  })());
});
