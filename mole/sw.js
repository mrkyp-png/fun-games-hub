// 두더지 게임 서비스워커.
// fetch 전략 = stale-while-revalidate: 캐시본을 즉시 주되 백그라운드로 최신본을 받아 캐시를 갱신한다.
// → 파일이 바뀌면 CACHE 버전을 안 올려도 "다음 실행"에 자동 반영된다 (이전엔 캐시-우선이라
//   sw.js 자체가 안 바뀌면 style.css/이미지 변경이 폰에 영영 안 걸렸음).
// SHELL 목록 자체가 바뀔 때만 CACHE 를 올린다.
const CACHE = 'mole-game-v4';

const SHELL = [
  './',
  './index.html',
  './style.css',
  '../cosmic-theme.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/board-scene.jpg',
  './js/levels.js',
  './js/rng.js',
  './js/combo-score.js',
  './js/grid-partition.js',
  './js/spawn-scheduler.js',
  './js/mole-sprites.js',
  './js/pop-elements.js',
  './js/hole-layer.js',
  './js/hit-fx.js',
  './js/lane-hammer.js',
  './js/lane-controls.js',
  './js/region-reveal.js',
  './js/hud.js',
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
