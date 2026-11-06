/* 3D 홈 광장 배치 데이터 (설계: Desktop/3D_공용홈_초안/06_홈광장_설계.md §4·§5).
   좌표: 세로 화면 기본 시선 = -z(앞). 원형 섬 중심 = 가운데 집 구멍. */
(function (root) {
  'use strict';
  const ISLAND_R = 12, WALK_R = 11, HOLE_R = 1.35; // HOLE_R: 집 구멍(테두리 포함) — 걸어서 드나들 수 없음
  const SPAWN = { x: 0, z: 0 };
  // body = 막히는 몸체 반지름, enter = 진입 지점에서 진입이 잡히는 반지름
  const B = { kind: 'building', body: 1.8, enter: 0.6 }, P = { kind: 'prop', body: 0.5, enter: 0.55 }; // enter: 몸체 가장자리에서 이 거리 안 = 건물에 닿음
  const SITES = [
    { id: 'mole', action: 'lightMode', labelKey: 'mole.pad.gameMole', x: 0, z: -9, ...B, body: 3.2 },
    { id: 'rhythm', action: 'rhythm', labelKey: 'mole.pad.gameRhythm', x: 0, z: 9, ...B, body: 2.8 }, // 해변 오두막+클럽 폭 5.6
    { id: 'shop', action: 'shop', labelKey: 'mole.more.shop', x: -7, z: -5, ...B },
    { id: 'workshop', action: 'locker', labelKey: 'mole.pad.lblLocker', x: -9, z: 0, ...B },
    { id: 'items', action: 'inventory', labelKey: 'mole.pad.lblInventory', x: -7, z: 5, ...B },
    { id: 'score', action: 'score', labelKey: 'mole.pad.lblScore', x: 7, z: -5, ...B },
    { id: 'mailbox', action: 'mail', labelKey: 'mole.shop.mailbox', x: 3, z: -1.5, ...P },
    { id: 'gift', action: 'daily', labelKey: 'mole.more.daily', x: 3.5, z: 1, ...P },
    { id: 'board', action: 'quest', labelKey: 'mole.more.quest', x: 2.5, z: 3.2, ...P }
  ].map((s) => Object.assign(s, { faceYaw: Math.atan2(-s.x, -s.z) })); // 섬 중심을 바라봄

  // 놀이기구(장식, 들어갈 수 없음 — 나중에 미니게임 입구로 바꿀 수 있게 자리만): 디스코 팡팡·바이킹
  const RIDES = [{ id: 'disco', x: 8, z: 2.5, body: 2.1 }, { id: 'viking', x: 5.6, z: 7.6, body: 2.2 }];

  // 건물 앞(섬 중심 쪽) 진입 지점
  function entryPoint(s) {
    const d = Math.hypot(s.x, s.z), k = (s.body + 0.45) / d; // 건물 몸체 바로 앞(몸이 닿는 곳)
    return { x: s.x - s.x * k, z: s.z - s.z * k };
  }
  function allowed(x, z) {
    if (Math.hypot(x, z) > WALK_R || Math.hypot(x, z) < HOLE_R) return false;
    return !SITES.some((s) => Math.hypot(x - s.x, z - s.z) < s.body) && !RIDES.some((s) => Math.hypot(x - s.x, z - s.z) < s.body);
  }
  function slide(p, dx, dz) {
    let x = p.x, z = p.z;
    if (allowed(x + dx, z)) x += dx;
    if (allowed(x, z + dz)) z += dz;
    return { x, z };
  }
  function nearest(x, z) {
    let best = null, bd = Infinity;
    for (const s of SITES) {
      const d = Math.hypot(x - s.x, z - s.z) - s.body; // 몸체 가장자리까지 거리 — 어느 쪽이든 닿으면
      if (d <= s.enter && d < bd) { best = s; bd = d; }
    }
    return best;
  }

  // 놀이기구 타기: 몸체 가장자리에서 0.6 안이면 닿음 / 내리는 곳 = 섬 중심 쪽 앞
  function rideExit(rd) { const d = Math.hypot(rd.x, rd.z), k = (rd.body + 0.45) / d; return { x: rd.x - rd.x * k, z: rd.z - rd.z * k }; }
  // 두더지팡 게임기 구멍 = 라운드(사용자 2026-11-06). 자리 = review/build-arcade-mole.py 구멍(가로 0.31·세로 0.27 간격, 가운데 줄 -0.18)
  // × 광장 배율 2.84(review/build-home-plaza.py ARCADE_K), 게임기 자리 (0,-9), 정면 = 섬 가운데(+z). 구멍판 윗면 높이 = (1.22 - 0.384) × 2.84
  // 순서: 정면에서 볼 때 앞줄 오른쪽 = 1라운드 → 앞줄 왼쪽으로 → 왼쪽 가운데 → 뒷줄 왼→오 → 오른쪽 가운데 = 8, 가운데 = 파이널(0)
  const ARCADE_K = 2.84, DECK_Y = (1.22 - 0.384) * ARCADE_K, HOLE_RADIUS = 0.12 * ARCADE_K;
  const HOLE_ORDER = [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1]];
  const holeAt = (i, j, n) => ({ n, x: (i - 1) * 0.31 * ARCADE_K, y: DECK_Y, z: -(9 + (-0.18 + (j - 1) * 0.27) * ARCADE_K), r: HOLE_RADIUS });
  const ARCADE_HOLES = HOLE_ORDER.map(([i, j], k) => holeAt(i, j, k + 1)).concat([holeAt(1, 1, 0)]);
  // 라운드별 게임 화면 색(실제 게임 화면 1~8라운드에서 뽑음, 2026-11-06)
  const ROUND_COLORS = ['#303237', '#8a3e40', '#9f6735', '#ab9337', '#428257', '#3d6ca1', '#4a4b82', '#774c94'];
  // 모드 버튼 3개(아마추어·노말·프로). 사용자: 아이보리 판을 앞으로 빼서(앞 끝 -0.96) 생긴 앞쪽 공간(-0.78)에 간격 넓혀 크게(사용자: 작으면 못 누름), 위를 봄
  const MODE_COLORS = { easy: '#d99a3e', mid: '#6f8aa6', legend: '#8e6a8c' };
  const ARCADE_BUTTONS = ['easy', 'mid', 'legend'].map((light, k) => ({ light, x: (-0.32 + k * 0.32) * ARCADE_K, y: DECK_Y + 0.005, z: -(9 - 0.78 * ARCADE_K), r: 0.09 * ARCADE_K, color: MODE_COLORS[light] }));
  function pickHole(x, z) { return ARCADE_HOLES.find((h) => Math.hypot(x - h.x, z - h.z) <= h.r * 1.25) || null; }
  function nearestRide(x, z) { return RIDES.find((rd) => Math.hypot(x - rd.x, z - rd.z) - rd.body <= 0.6) || null; }

  // 자동 걷기: 곧은 길이 가운데 구멍을 지나면 구멍 옆(출발한 쪽)으로 돌아갈 중간 지점 1개
  function pathVia(from, to) {
    const dx = to.x - from.x, dz = to.z - from.z, len2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, -(from.x * dx + from.z * dz) / len2)); // 원점에 가장 가까운 점
    const cx = from.x + dx * k, cz = from.z + dz * k, R = HOLE_R + 0.6;
    if (Math.hypot(cx, cz) >= R || k <= 0 || k >= 1) return [];
    let px = -dz, pz = dx; const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    if (px * cx + pz * cz < 0 || (Math.abs(cx) < 1e-6 && Math.abs(cz) < 1e-6 && px * from.x + pz * from.z < 0)) { px = -px; pz = -pz; }
    return [{ x: px * R, z: pz * R }];
  }

  const api = { ISLAND_R, WALK_R, HOLE_R, SPAWN, SITES, RIDES, ARCADE_HOLES, ARCADE_BUTTONS, ROUND_COLORS, pickHole, rideExit, nearestRide, entryPoint, allowed, slide, nearest, pathVia };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.MoleGame = root.MoleGame || {}; root.MoleGame.Home3DLayout = api; }
})(typeof window !== 'undefined' ? window : globalThis);
