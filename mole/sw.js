// 두더지 게임 서비스워커. 색칠앱(coloring/sw.js)과 같은 패턴:
// 필수 셸만 원자적으로 캐싱하고, 나머지(스프라이트·이모지 등)는 런타임에 캐시-우선으로 채운다.
// 게임 코드가 바뀌면 CACHE 값을 올린다 (버전 갱신 = 새 SW 설치 = 셸 재캐싱).
const CACHE = 'mole-game-v3';

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
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    } catch (err) {
      // 오프라인 + 캐시에 없음: 네비게이션은 캐시된 셸로, 그 외는 명시적 에러 응답.
      // (여기서 undefined 를 반환하면 브라우저가 "인터넷 연결 없음" 페이지를 띄운다.)
      if (e.request.mode === 'navigate') {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
      return Response.error();
    }
  })());
});
