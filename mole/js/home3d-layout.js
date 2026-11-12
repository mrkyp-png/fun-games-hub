/* 3D 홈 광장 배치 데이터 (설계: Desktop/3D_공용홈_초안/06_홈광장_설계.md §4·§5).
   좌표: 세로 화면 기본 시선 = -z(앞). 원형 섬 중심 = 가운데 집 구멍. */
(function (root) {
  'use strict';
  const ISLAND_R = 16, WALK_R = 15, HOLE_R = 1.35; // HOLE_R: 집 구멍(테두리 포함) — 걸어서 드나들 수 없음
  const SPAWN = { x: 0, z: 0 };
  // body = 막히는 몸체 반지름, enter = 진입 지점에서 진입이 잡히는 반지름
  const B = { kind: 'building', body: 1.8, enter: 0.6 }, P = { kind: 'prop', body: 0.5, enter: 0.55 }; // enter: 몸체 가장자리에서 이 거리 안 = 건물에 닿음
  const SITES = [
    { id: 'mole', action: 'lightMode', labelKey: 'mole.pad.gameMole', x: 0, z: -9, ...B, body: 3.2 },
    { id: 'rhythm', action: 'rhythm', labelKey: 'mole.pad.gameRhythm', x: -8, z: 2.5, ...B, body:2.32, scale:1.6, depthScale:.8, doorDepth:.72, halfWidth:2.08,halfDepth:.88 },
    { id: 'shop', action: 'shop', labelKey: 'mole.more.shop', x: -7, z: -5, ...B, body:2.4, scale:1.6, depthScale:.8, doorDepth:.88, halfWidth:2.08,halfDepth:.88 },
    /* V1650 C 사용자: 스코어 탑·선물상자·퀘스트 판 → 게시판 하나(스코어 탑 자리). 칸을 누르면 그 화면, 닿아서 발바닥 = 스코어 */
    { id: 'board', action: 'score', labelKey: 'mole.pad.lblScore', x: 7, z: -5, ...B, body: 2.0, noSign: true }
  ].map((s) => Object.assign(s, { faceYaw: Math.atan2(-s.x, -s.z) })); // 섬 중심을 바라봄

  // 놀이기구(장식, 들어갈 수 없음 — 나중에 미니게임 입구로 바꿀 수 있게 자리만): 디스코 팡팡·바이킹
  const RIDES = []; /* V1633 C: 코드로 만든 디스코 팡팡도 삭제 → Tripo 디스코 팡팡(DISCO, 배치만) / 바이킹 = 바다 배(BOAT) */
  /* 게시판 모델(Tripo, board.glb) 배율과 칸 3개 자리(모델 좌표: 가로 x, 높이 y, 앞 z = 칸 면). 앞뒤 같은 내용 */
  const BOARD = { S: 4.4, PANEL_W: 0.206, PANEL_H: 0.206, Y: 0.54, FACE: 0.071, X: { score: -0.27, daily: 0, quest: 0.27 } }; /* V1653 C: Blender 심플 게시판(review/build-board.py), 1배 + 앞에 가면 카메라가 칸 정면으로(사용자 1번) */
  const DISCO = { id: 'disco', x: 8, z: 2.5, body: 2.1, baseS: 4.0, topS: 4.6, topY: 2.55, yaw: 0, tilt: 0, tiltDir: 0, lift: 0 }; /* V1660 C: 타면 yaw(회전)·tilt(기울기)·lift(튀기)는 home3d.js 가 바꿈 */ /* 받침 배율·상판 배율·상판 높이(V1660 C: 새 상판·받침 — 받침 기둥 끝 0.65 × 4.0) */
  /* 바다 배: 뒤쪽 해변 앞바다. S = 모델 배율(Tripo 배 길이 0.98 → 약 4.9), DECK = 모델 갑판 높이, 갑판 반폭 U(길이)·W(폭) */
  const BOAT = { x: 0, z: 25.6, S: 5, DECK: 0.185, U: 1.05, W: 0.48, DRAFT: 0.45, theta: 0, yaw: 0, kick: 0 }; /* V1657 C: 노 젓기 — theta(섬 둘레 각도, 시계 방향 = 줄어듦)·yaw·kick(저을 때 기울기)은 home3d.js 가 바꿈 */ /* U·W = 갑판 타원 반지름(배 그림 안, 두더지 몸 여유 뺌, V1636 C) */ /* DRAFT = 물에 잠기는 깊이(갑판까지 0.93 중) */
  /* 해변(모래사장): 섬 스크립트 Beach sand 중심 (0, z 4.3) 반지름 18.1 → 걸을 수 있는 곳 = 반지름 17.5, 뒤쪽(z > 14)만 */
  const BEACH = { cz: 4.3, r: 17.5, zmin: 14, surfaceY: -.3 };
  const FENCE_OUT = 16.2; /* V1636 C 사용자: 울타리(15.65) 걸어서 못 지나감 — 해변은 울타리 바깥만, 해변↔섬은 날아서 */
  function onBeach(x, z) { return z > BEACH.zmin && Math.hypot(x, z) > FENCE_OUT && Math.hypot(x, z - BEACH.cz) < BEACH.r; }
  function groundHeight(x,z) { return onBeach(x,z) ? BEACH.surfaceY : 0; }

  // 건물 앞(섬 중심 쪽) 진입 지점
  function entryPoint(s) {
    const d = Math.hypot(s.x, s.z), k = (s.body + 0.45) / d; // 건물 몸체 바로 앞(몸이 닿는 곳)
    return { x: s.x - s.x * k, z: s.z - s.z * k };
  }
  function doorPoint(s) {
    if (!s.doorDepth) return null;
    const d = Math.hypot(s.x,s.z), depth = s.doorDepth - .7;
    return {x:s.x-s.x/d*depth,z:s.z-s.z/d*depth};
  }
  function doorCoordinates(s,x,z) {
    const d=Math.hypot(s.x,s.z),ux=-s.x/d,uz=-s.z/d,dx=x-s.x,dz=z-s.z;
    return {along:dx*ux+dz*uz,side:dx*-uz+dz*ux};
  }
  function doorCorridor(s,x,z) {
    if(!s.doorDepth) return false;
    const p=doorCoordinates(s,x,z);
    return Math.abs(p.side)<.28 && p.along>=s.doorDepth-.35;
  }
  function crossedDoor(s,x,z) {
    if(!doorCorridor(s,x,z)) return false;
    return doorCoordinates(s,x,z).along<s.doorDepth-.08;
  }
  function doorApproach(s, from) {
    if (!s.doorDepth) return null;
    const current=doorCoordinates(s,from.x,from.z);
    // Already aligned with the doorway: continue inward instead of stepping back to entryPoint.
    if(Math.abs(current.side)<.28 && current.along>=s.doorDepth-.35) return [];
    const end = entryPoint(s), startRadius = Math.max(s.body+.08,Math.hypot((s.halfWidth||0)+.4,(s.halfDepth||0)+.4)+.08,Math.hypot(from.x-s.x,from.z-s.z));
    const a0 = Math.atan2(from.x-s.x,from.z-s.z), a1 = Math.atan2(end.x-s.x,end.z-s.z);
    const delta = Math.atan2(Math.sin(a1-a0),Math.cos(a1-a0));
    for (const turn of [delta,delta+(delta>=0?-2:2)*Math.PI]) {
      const count = Math.max(1,Math.ceil(Math.abs(turn)/.1)), points = [];
      for(let i=1;i<=count;i++) {
        const k=i/count,r=startRadius+(s.body+.45-startRadius)*k,a=a0+turn*k;
        points.push({x:s.x+Math.sin(a)*r,z:s.z+Math.cos(a)*r});
      }
      if(points.every(p=>allowed(p.x,p.z))) return points;
    }
    return null;
  }
  function allowed(x, z) {
    if ((Math.hypot(x, z) > WALK_R && !onBeach(x, z)) || Math.hypot(x, z) < HOLE_R) return false;
    return !SITES.some((s) => {
      if(!s.halfWidth) return Math.hypot(x-s.x,z-s.z)<s.body;
      const p=doorCoordinates(s,x,z);
      return Math.abs(p.side)<s.halfWidth+.4 && Math.abs(p.along)<s.halfDepth+.4 && !doorCorridor(s,x,z);
    }) && !RIDES.some((s) => Math.hypot(x - s.x, z - s.z) < s.body) && Math.hypot(x - DISCO.x, z - DISCO.z) >= DISCO.body;
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
  function nearestRide(x, z) { return RIDES.find((rd) => Math.hypot(x - rd.x, z - rd.z) - rd.body <= 0.6) || (Math.hypot(x - DISCO.x, z - DISCO.z) - DISCO.body <= 0.6 ? DISCO : null); } /* V1660 C: 디스코 팡팡 타기 */

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

  function deepSwimPose(kind,age,scene){
    const {cx,cy,radius,width,height,length}=scene;
    const start={x:kind==='whale'?-length*.6:width+length*.6,y:kind==='whale'?height+40:-40};
    const angle=Math.atan2(start.y-cy,start.x-cx),tangent={x:-Math.sin(angle),y:Math.cos(angle)};
    const end={x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)},distance=Math.hypot(end.x-start.x,end.y-start.y);
    const control1={x:start.x+(end.x-start.x)/3,y:start.y+(end.y-start.y)/3};
    const control2={x:end.x-tangent.x*distance*.25,y:end.y-tangent.y*distance*.25};
    const point=t=>{const s=1-t;return {x:s*s*s*start.x+3*s*s*t*control1.x+3*s*t*t*control2.x+t*t*t*end.x,
      y:s*s*s*start.y+3*s*s*t*control1.y+3*s*t*t*control2.y+t*t*t*end.y};};
    const table=[0];let previous=start;
    for(let i=1;i<=64;i++){const p=point(i/64);table.push(table[i-1]+Math.hypot(p.x-previous.x,p.y-previous.y));previous=p;}
    const entryLength=table[64],speed=(entryLength+2*Math.PI*radius)/600,travel=Math.max(0,Math.min(600,age))*speed;
    if(travel<entryLength){
      let i=1;while(table[i]<travel)i++;
      const t=(i-1+(travel-table[i-1])/Math.max(.00001,table[i]-table[i-1]))/64,s=1-t,p=point(t);
      const dx=3*s*s*(control1.x-start.x)+6*s*t*(control2.x-control1.x)+3*t*t*(end.x-control2.x);
      const dy=3*s*s*(control1.y-start.y)+6*s*t*(control2.y-control1.y)+3*t*t*(end.y-control2.y);
      return {...p,rot:Math.atan2(dy,dx),speed,entrySeconds:entryLength/speed};
    }
    const a=angle+(travel-entryLength)/radius;
    return {x:cx+radius*Math.cos(a),y:cy+radius*Math.sin(a),rot:Math.atan2(Math.cos(a),-Math.sin(a)),speed,entrySeconds:entryLength/speed};
  }
  const api = { ISLAND_R, WALK_R, FENCE_OUT, HOLE_R, SPAWN, SITES, RIDES, BOAT, BOARD, DISCO, BEACH, onBeach, groundHeight, ARCADE_K, ARCADE_HOLES, ARCADE_BUTTONS, ROUND_COLORS, pickHole, rideExit, nearestRide, entryPoint, doorPoint, doorApproach, doorCoordinates, crossedDoor, allowed, slide, nearest, pathVia, deepSwimPose };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.MoleGame = root.MoleGame || {}; root.MoleGame.Home3DLayout = api; }
})(typeof window !== 'undefined' ? window : globalThis);
