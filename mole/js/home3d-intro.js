/* 홈 시작: 두더지가 가운데 집 구멍 안에서 정면(화면 쪽, +z)을 보고 서 있음.
   걸어서는 못 나오고 점프해야 구멍 밖으로 착지한다. + 점프 높이(순수 로직). */
(function (root) {
  'use strict';
  const L = root.MoleGame && root.MoleGame.Home3DLayout || (typeof require !== 'undefined' ? require('./home3d-layout.js') : null);
  const HOP = 1.9; // 구멍 가운데 → 착지점 거리(HOLE_R 1.35 바깥)

  function create() { return { inHole: true, start: { x: 0, z: 0, heading: 0 } }; }
  // heading 방향으로 뛰어나올 착지점(막혀 있으면 가장 가까운 열린 방향으로)
  function hopOut(heading) {
    for (let k = 0; k < 16; k++) {
      const a = heading + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
      const p = { x: Math.sin(a) * HOP, z: Math.cos(a) * HOP };
      if (L.allowed(p.x, p.z)) return p;
    }
    return { x: 0, z: HOP };
  }
  // 점프: T초 동안 포물선, 최고 H
  const jump = { T: 0.6, H: 1.0, height(t) { return t <= 0 || t >= this.T ? 0 : 4 * this.H * t * (this.T - t) / (this.T * this.T); } };

  const api = { create, hopOut, jump };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DIntro = api;
})(typeof window !== 'undefined' ? window : globalThis);
