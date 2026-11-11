/* 3D 홈 렌더러(WebGL2). 초안 round-entry-preview.js 의 그리기 코드를 옮겨 온 것.
   입력·이동은 home3d.js, 조작 UI 는 home3d-ui.js. */
(function (root) {
  'use strict';
  const R = root.StudioRig;

  // ---------- 순수 계산(검사 가능) ----------
  function camera(view, w, h) {
    const dist = (view.dist || 7.5) * (w < h ? 1 : 6.5 / 7.5), focus = [view.cx ?? view.x, view.fy || 1.35, view.cz ?? view.z]; /* cx·cz = 카메라만(두더지 위치와 따로) */ // dist·fy = 게임기 화면용(없으면 기본)
    const eye = [focus[0] + Math.sin(view.yaw) * Math.cos(view.pitch) * dist, focus[1] + Math.sin(view.pitch) * dist,
      focus[2] + Math.cos(view.yaw) * Math.cos(view.pitch) * dist];
    return { eye, focus, vp: R.multiply(R.perspective(Math.PI / 3, w / h, 0.15, view.far || 80), R.lookAt(eye, focus)) };
  }
  function project(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return w <= 0 ? null : [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w];
  }
  // 화면 점(NDC) → 바닥(y=0) 위 점
  function rayFloor(inverse, x, y) { return rayPlane(inverse, x, y, 0); }
  // 화면 점(NDC) → 높이 h 수평면 위 점(게임기 구멍판 터치용)
  function rayPlane(inverse, x, y, h) {
    function at(z) { const p = [x, y, z, 1], r = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r[i] += inverse[j * 4 + i] * p[j]; return r.slice(0, 3).map((v) => v / r[3]); }
    const a = at(-1), b = at(1), dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-7) return null;
    const t = (h - a[1]) / dy;
    return t < 0 || t > 1 ? null : { x: a[0] + t * (b[0] - a[0]), z: a[2] + t * (b[2] - a[2]) };
  }
  // 화면 픽셀 → 가장 가까운 건물/사물(건물 56px, 사물 40px 이내)
  function pickSite(vp, sites, px, py, w, h) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const p = project(vp, [s.x, s.kind === 'building' ? 1.5 : 0.6, s.z]);
      if (!p) continue;
      const d = Math.hypot((p[0] + 1) / 2 * w - px, (1 - p[1]) / 2 * h - py);
      if (d < (s.kind === 'building' ? 56 : 40) && d < bd) { best = s; bd = d; }
    }
    return best;
  }

  // 바다 물결 높이(셰이더 SEA_H 와 같은 식) — 잔잔하게, 진폭 ≤ 0.075
  /* 바다 배 변환: 물결 높이에 맞춰 출렁이고 앞뒤·좌우로 천천히 기우뚱(home3d-layout BOAT) */
  function boatMatrix(t) {
    const B = root.MoleGame.Home3DLayout.BOAT, y = -0.62 + seaHeight(B.x, B.z, t) - B.DRAFT, /* V1657 C: 노 저을 때 좌우로 한 번 더 기울기(kick) */ /* V1636 C: 수면(-0.62) 빠뜨려 배가 떠 있던 것 → 배 밑 DRAFT 만큼 물에 잠김 */ roll = 0.07 * Math.sin(t * 0.9) + (B.kick || 0), pitch = 0.045 * Math.sin(t * 0.7 + 1);
    const qx = [Math.sin(roll / 2), 0, 0, Math.cos(roll / 2)], qz = [0, 0, Math.sin(pitch / 2), Math.cos(pitch / 2)];
    const q = [qx[3] * qz[0] + qx[0] * qz[3] + qx[1] * qz[2] - qx[2] * qz[1], qx[3] * qz[1] - qx[0] * qz[2] + qx[1] * qz[3] + qx[2] * qz[0], qx[3] * qz[2] + qx[0] * qz[1] - qx[1] * qz[0] + qx[2] * qz[3], qx[3] * qz[3] - qx[0] * qz[0] - qx[1] * qz[1] - qx[2] * qz[2]];
    const yw = B.yaw || 0, qy = [0, Math.sin(yw / 2), 0, Math.cos(yw / 2)], qq = [qy[3] * q[0] + qy[1] * q[2], qy[3] * q[1] + qy[1] * q[3], qy[3] * q[2] - qy[1] * q[0], qy[3] * q[3] - qy[1] * q[1]]; /* 배 방향(섬 둘레 접선) */
    return R.transform({ translation: [B.x, y, B.z], rotation: qq, scale: [B.S, B.S, B.S] });
  }
  function seaHeight(x, z, t) {
    return 0.06 * Math.sin(0.55 * x + 1.1 * t) + 0.04 * Math.sin(0.8 * z - 0.9 * t + 1.3) + 0.02 * Math.sin(0.37 * (x + z) + 1.7 * t);
  }
  // 바다 판: n×n 칸 격자(한 번에 그리는 판 1장), 반지름 R
  function seaGrid(n, R) {
    const positions = [], indices = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) positions.push(-R + 2 * R * i / n, -0.62, -R + 2 * R * j / n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
    return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  }

  // 해: 1시간(3600초)에 하늘을 한 바퀴, 높이 25~45° — 항상 낮(노을·밤 없음)
  const SUN_PERIOD = 3600; // 1시간에 한 바퀴(사용자: 아주 천천히)
  function sunDir(t) {
    const a = (t % SUN_PERIOD) / SUN_PERIOD * 2 * Math.PI, el = (35 + 10 * Math.sin(a * 2)) * Math.PI / 180; // 25~45°: 그림자가 길게 보이게
    return [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
  }
  function ortho(l, rt, b, t, n, fa) {
    return new Float32Array([2 / (rt - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (fa - n), 0, -(rt + l) / (rt - l), -(t + b) / (t - b), -(fa + n) / (fa - n), 1]);
  }
  // 구름: 공 여러 개를 뭉친 입체 덩어리(정점 위치·법선). 서로 다른 모양 5개
  function cloudMesh(seed) {
    const pos = [], nor = [], idx = [];
    let rnd = seed * 9301 + 49297;
    const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
    const puffs = 5 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const cx = (p - (puffs - 1) / 2) * 1.5 + (rand() - 0.5) * 0.6, cy = (rand() - 0.2) * 0.7, cz = (rand() - 0.5) * 1.4;
      const rad = 1.2 + rand() * 0.9 - Math.abs(p - (puffs - 1) / 2) * 0.18, base = pos.length / 3, SEG = 12, RING = 8;
      for (let i = 0; i <= RING; i++) for (let j = 0; j <= SEG; j++) {
        const th = Math.PI * i / RING, ph = 2 * Math.PI * j / SEG, nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        pos.push(cx + nx * rad, cy + ny * rad * (ny < 0 ? 0.55 : 0.85), cz + nz * rad); nor.push(nx, ny, nz);
      }
      for (let i = 0; i < RING; i++) for (let j = 0; j < SEG; j++) { const a = base + i * (SEG + 1) + j, b = a + SEG + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    return { positions: new Float32Array(pos), normals: new Float32Array(nor), indices: new Uint32Array(idx) };
  }
  // 구름 위치: 아주 천천히 한쪽으로 흘러가고(초당 0.06) 섬 너머로 가면 반대편에서 다시
  const CLOUDS = [[-22, 12, -46, 2.2], [10, 13, -50, 1.9], [26, 11.5, 44, 2.1], [-24, 12.5, 48, 1.9], [8, 13, -58, 2.3]]; /* V1679 C 사용자: 구름이 카메라를 가려 화면이 하얗게 — 섬(16)·배(25.6)·카메라 길 밖(z 40 이상)·높이 11~13 으로(가로로 흘러도 섬 위를 안 지남) */ // 섬 둘레 하늘(수평선 위로 보이게)
  function cloudPos(i, t) {
    const c = CLOUDS[i], span = 64, x = ((c[0] + t * 0.06 + span / 2) % span + span) % span - span / 2;
    return [x, c[1] + Math.sin(t * 0.2 + i) * 0.25, c[2], c[3]];
  }

  // 색 있는 도형 묶음(위치·법선·색·인덱스). 놀이기구 임시 형태용
  function Geo() { this.p = []; this.n = []; this.c = []; this.i = []; }
  Geo.prototype.add = function (pts, nors, col, idx) { const b = this.p.length / 3; this.p.push(...pts); this.n.push(...nors); for (let k = 0; k < pts.length / 3; k++) this.c.push(...col); this.i.push(...idx.map((v) => v + b)); return this; };
  Geo.prototype.cyl = function (cx, cy, cz, rad, h, col, seg, axis, sy) { // axis 'y'(기본) 또는 'x', sy=단면 세로 비율
    seg = seg || 24; sy = sy || 1; const P = [], N = [], I = [];
    const put = (u, v, w, nu, nv, nw) => { if (axis === 'x') { P.push(cx + w, cy + v, cz + u); N.push(nw, nv, nu); } else { P.push(cx + u, cy + w, cz + v); N.push(nu, nw, nv); } };
    for (let k = 0; k <= seg; k++) { const a = 2 * Math.PI * k / seg, u = Math.cos(a) * rad, v = Math.sin(a) * rad * sy; put(u, v, -h / 2, Math.cos(a), Math.sin(a), 0); put(u, v, h / 2, Math.cos(a), Math.sin(a), 0); }
    for (let k = 0; k < seg; k++) I.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    for (const sgn of [-1, 1]) { const c0 = P.length / 3; put(0, 0, sgn * h / 2, 0, 0, sgn); for (let k = 0; k <= seg; k++) { const a = 2 * Math.PI * k / seg; put(Math.cos(a) * rad, Math.sin(a) * rad * sy, sgn * h / 2, 0, 0, sgn); } for (let k = 0; k < seg; k++) I.push(c0, c0 + 1 + k, c0 + 2 + k); }
    return this.add(P, N, col, I);
  };
  Geo.prototype.box = function (cx, cy, cz, w, h, d, col, rz) { // rz: z축 기울기
    const P = [], N = [], I = [], cr = Math.cos(rz || 0), sr = Math.sin(rz || 0), rot = (x, y) => [x * cr - y * sr, x * sr + y * cr];
    const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [nx, ny, nz] of F) {
      const b = P.length / 3, ax = nx ? [0, 1, 0] : [1, 0, 0], ay = nz ? [0, 1, 0] : [0, 0, 1];
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = (nx + ax[0] * u + ay[0] * v) * w / 2, ly = (ny + ax[1] * u + ay[1] * v) * h / 2, lz = (nz + ax[2] * u + ay[2] * v) * d / 2, [qx, qy] = rot(lx, ly), [mx, my] = rot(nx, ny);
        P.push(cx + qx, cy + qy, cz + lz); N.push(mx, my, nz);
      }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2); // 양면(감기 방향 무관)
    }
    return this.add(P, N, col, I);
  };
  // 회전체: profile = [[반지름, 높이], …] 아래→위
  Geo.prototype.lathe = function (profile, col, seg) {
    seg = seg || 32; const P = [], N = [], I = [], n = profile.length;
    for (let i = 0; i < n; i++) {
      const [rr, y] = profile[i], a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)], dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
      for (let k = 0; k <= seg; k++) { const t = 2 * Math.PI * k / seg, c = Math.cos(t), sn = Math.sin(t); P.push(rr * c, y, rr * sn); N.push(dy / l * c, -dr / l, dy / l * sn); }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = i * (seg + 1) + k, b = a + seg + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
    return this.add(P, N, col, I);
  };
  // 파이널 보스 말(사용자 승인 시안: 크림 몸통·연분홍 띠·금 왕관). 높이 약 1.2, 원점 = 바닥 가운데. 반투명(알파 0.55)
  function bossPiece() {
    const A = 0.55, cream = [0.95, 0.9, 0.82, A], rose = [0.8, 0.48, 0.5, A], gold = [0.86, 0.67, 0.3, A], g = new Geo();
    g.lathe([[0, 0], [0.5, 0], [0.53, 0.05], [0.5, 0.12], [0.42, 0.14], [0.42, 0.2], [0.34, 0.23], [0.28, 0.28], [0.21, 0.5], [0.17, 0.72], [0.3, 0.74], [0.31, 0.79], [0.17, 0.81], [0, 0.81]], cream);
    g.lathe([[0.19, 0.64], [0.215, 0.66], [0.215, 0.7], [0.19, 0.72]], rose);
    g.ball(0, 0.94, 0, 0.17, cream);
    g.lathe([[0, 1.04], [0.15, 1.04], [0.17, 1.08], [0.17, 1.14], [0.13, 1.14], [0, 1.1]], gold);
    for (let k = 0; k < 5; k++) { const t = 2 * Math.PI * k / 5; g.ball(Math.cos(t) * 0.15, 1.19, Math.sin(t) * 0.15, 0.045, gold); }
    return g;
  }
  Geo.prototype.ball = function (cx, cy, cz, rad, col) {
    const P = [], N = [], I = [], S = 14, Rg = 8;
    for (let i = 0; i <= Rg; i++) for (let j = 0; j <= S; j++) { const th = Math.PI * i / Rg, ph = 2 * Math.PI * j / S, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); P.push(cx + x * rad, cy + y * rad, cz + z * rad); N.push(x, y, z); }
    for (let i = 0; i < Rg; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + S + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
    return this.add(P, N, col, I);
  };
  const C = { coral: [0.95, 0.52, 0.45, 1], yellow: [0.99, 0.84, 0.40, 1], sky: [0.50, 0.74, 0.92, 1], mint: [0.55, 0.84, 0.72, 1], cream: [0.97, 0.91, 0.80, 1] };
  // 부품: static(고정) / moving(움직이는 부분, 원점 = 회전 중심)
  function rideParts(id) {
    if (id === 'disco') {
      const base = new Geo().cyl(0, 0.25, 0, 2.05, 0.5, C.coral).cyl(0, 0.53, 0, 1.15, 0.08, C.cream);
      const mov = new Geo().cyl(0, 0, 0, 1.85, 0.26, C.yellow).cyl(0, 0.17, 0, 1.55, 0.06, C.cream).cyl(0, 0.75, 0, 0.18, 1.3, C.cream).ball(0, 1.5, 0, 0.32, C.coral);
      for (let k = 0; k < 10; k++) { const a = 2 * Math.PI * k / 10; mov.box(Math.cos(a) * 1.55, 0.36, Math.sin(a) * 1.55, 0.5, 0.42, 0.5, k % 2 ? C.sky : C.mint); }
      return { base, mov, pivot: [0, 0.78, 0] };
    }
    // 바이킹: A자 지지대 2개 + 꼭대기 축, 배(길이 x축)가 축에 매달려 좌우로 흔들림
    const base = new Geo();
    const cream = [1, .9, .72, 1], gold = [.87, .62, .23, 1], violet = [.59, .29, .77, 1], blue = [.22, .44, .76, 1];
    for (const z of [-1.15, 1.15]) for (const sx of [-1, 1]) base.box(sx * 1.05, 2.1, z, 0.22, 4.5, 0.22, cream, -sx * 0.45);
    base.cyl(0, 4.15, 0, 0.16, 2.6, gold, 12, 'x').box(0, 0.08, 0, 4.8, 0.16, 3.0, blue);
    // 배: 원점 = 축(위 4.15), 배는 축 아래 3.0
    const mov = new Geo().cyl(0, -3.0, 0, 0.95, 3.8, violet, 24, 'x', 0.62).box(0, -2.55, 0, 3.6, 0.12, 1.5, cream).ball(2.05, -2.5, 0, 0.36, gold).ball(-2.05, -2.5, 0, 0.32, gold);
    for (const z of [-0.55, 0.55]) mov.box(0, -1.5, z, 0.14, 3.0, 0.14, cream);
    return { base, mov, pivot: [0, 4.15, 0] };
  }
  // 움직임(아주 천천히가 아닌 놀이기구다운 속도): 디스코 = 빙글 돌며 들썩, 바이킹 = 좌우로 크게
  /* V1660 C: 디스코 팡팡 상판 자리(회전·기울기·튀기) — 받침 기둥 위 */
  function discoTopMatrix() { const D = root.MoleGame.Home3DLayout.DISCO, s = D.topS, h = D.tilt || 0, a = D.tiltDir || 0, y = D.yaw || 0;
    const ax = [Math.cos(a), 0, Math.sin(a)], qt = [ax[0] * Math.sin(h / 2), 0, ax[2] * Math.sin(h / 2), Math.cos(h / 2)], qy = [0, Math.sin(y / 2), 0, Math.cos(y / 2)];
    const q = [qt[3] * qy[0] + qt[0] * qy[3] + qt[1] * qy[2] - qt[2] * qy[1], qt[3] * qy[1] - qt[0] * qy[2] + qt[1] * qy[3] + qt[2] * qy[0], qt[3] * qy[2] + qt[0] * qy[1] - qt[1] * qy[0] + qt[2] * qy[3], qt[3] * qy[3] - qt[0] * qy[0] - qt[1] * qy[1] - qt[2] * qy[2]];
    return R.transform({ translation: [D.x, D.topY + (D.lift || 0), D.z], rotation: q, scale: [s, s, s] }); }
  function rideMotion(id, t) {
    if (id === 'disco') return { yaw: t * 0.9, lift: 0.14 * Math.abs(Math.sin(t * 2.4)), tilt: 0.06 * Math.sin(t * 1.3) };
    return { swing: 0.8 * Math.sin(t * 0.9) };
  }

  // ---------- WebGL ----------
  const VS = `#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aNormal;in vec4 aColor;in vec4 aJoints;in vec4 aWeights;in vec2 aUV;
uniform mat4 uVP,uModel,uBones[48];uniform mat3 uNormal;uniform bool uSkin,uSea;uniform float uTime;
out vec3 vWorld,vNormal;out vec4 vColor;out vec2 vUV;
float seaH(vec2 p,float t){return .06*sin(.55*p.x+1.1*t)+.04*sin(.8*p.y-.9*t+1.3)+.02*sin(.37*(p.x+p.y)+1.7*t);}
void main(){mat4 skin=mat4(1.);if(uSkin)skin=uBones[int(aJoints.x)]*aWeights.x+uBones[int(aJoints.y)]*aWeights.y+uBones[int(aJoints.z)]*aWeights.z+uBones[int(aJoints.w)]*aWeights.w;vec4 p=uModel*skin*vec4(aPosition,1.);vWorld=p.xyz;vNormal=normalize(uNormal*mat3(skin)*aNormal);if(uSea){float e=.2;p.y+=seaH(p.xz,uTime);float hx=seaH(p.xz+vec2(e,0.),uTime)-seaH(p.xz-vec2(e,0.),uTime),hz=seaH(p.xz+vec2(0.,e),uTime)-seaH(p.xz-vec2(0.,e),uTime);vNormal=normalize(vec3(-hx/(2.*e),1.,-hz/(2.*e)));vWorld=p.xyz;}vColor=aColor;vUV=aUV;gl_Position=uVP*p;}`;
  const FS = `#version 300 es
precision highp float;
in vec3 vWorld,vNormal;in vec4 vColor;in vec2 vUV;uniform vec4 uColor;uniform bool uFloor,uSign,uSea,uShadowPass,uSunDisc,uCloud,uActor,uGlow,uTexBase;uniform float uTime;uniform vec3 uSun;uniform mat4 uShadowVP,uShadowVPM;uniform highp sampler2DShadow uShadowS,uShadowM;uniform vec4 uClouds[5];uniform sampler2D uTex;uniform vec3 uEye;uniform vec2 uPlayer;uniform float uFogK;out vec4 frag;
float vis(highp sampler2DShadow m,vec3 q,float px){float v=0.;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)v+=texture(m,vec3(q.xy+vec2(i,j)*px,q.z-.004));return v/9.;}
vec3 lproj(mat4 M,vec3 p){vec4 sp=M*vec4(p,1.);return sp.xyz/sp.w*.5+.5;}
bool inside(vec3 q){return q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.&&q.z<1.;}
float cloudVis(vec3 p){float v=1.;for(int i=0;i<5;i++){vec4 c=uClouds[i];float t=(c.y-p.y)/max(uSun.y,.2);vec2 q=p.xz+uSun.xz*t;float d=length((q-c.xz)/vec2(4.8,3.2))/c.w;v*=mix(.72,1.,smoothstep(.55,1.05,d));}return v;}
void main(){if(uShadowPass){frag=vec4(1.);return;}if(uGlow){frag=vec4(vColor.rgb,vColor.a);return;}if(uSunDisc){float rr=length(vUV-.5)*2.;if(rr>1.)discard;frag=vec4(mix(vec3(1.,.98,.88),vec3(1.,.92,.66),rr*rr),1.);return;}if(uCloud){vec3 cn=normalize(vNormal);float k=dot(cn,uSun)*.5+.5;vec3 c=mix(vec3(.82,.89,.98),vec3(1.,.99,.96),k)*mix(.9,1.,cn.y*.5+.5);float fog=smoothstep(40.,80.,length(uEye-vWorld)/uFogK);frag=vec4(mix(c,vec3(.45,.72,.94),fog*.6),1.);return;}vec3 n=normalize(vNormal),base=uTexBase?pow(texture(uTex,vUV).rgb,vec3(1.35)):uColor.rgb*vColor.rgb;float shadow=1.;
if(uSea){vec2 p=vWorld.xz;float t=uTime;vec2 g=vec2(0.);const vec3 W[6]=vec3[6](vec3(.90,.42,.45),vec3(-.55,.83,.62),vec3(.20,-.98,.85),vec3(-.94,-.33,1.4),vec3(.70,.71,2.1),vec3(-.15,.99,3.0));for(int i=0;i<6;i++){vec2 dir=normalize(W[i].xy);float k=W[i].z,amp=.09/k;float ph=dot(dir,p)*k*1.3+t*sqrt(9.8*k)*.55+float(i)*1.7;g+=dir*cos(ph)*amp*k*1.3;}vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 V=normalize(uEye-vWorld),Ls=uSun;float d=min(length(p)-12.,length(p-vec2(0.,3.2))-13.6);vec3 deep=vec3(.05,.34,.64),shallow=vec3(.18,.69,.78),body=mix(shallow,deep,smoothstep(.5,9.,d));vec3 sky=mix(vec3(.65,.83,.98),vec3(.36,.66,.94),clamp(reflect(-V,n).y,0.,1.));float fres=.06+.94*pow(1.-max(0.,dot(n,V)),5.);vec3 c=mix(body,sky,fres);c+=vec3(1.,.97,.9)*pow(max(0.,dot(reflect(-Ls,n),V)),180.)*1.6;float foam=smoothstep(.9,0.,d)*(.6+.4*sin(d*6.-t*1.8+g.x*8.));c=mix(c,vec3(.96,.98,1.),clamp(foam,0.,1.)*.7);float fog=smoothstep(26.,62.,length(uEye-vWorld)/uFogK);frag=vec4(mix(clamp(c,0.,1.),vec3(.45,.72,.94),fog),1.);return;}
if(uSign){if(dot(n,uEye-vWorld)<0.)discard;vec3 c=texture(uTex,vUV).rgb;float k=max(0.,(dot(n,uSun)+.4)/1.4);frag=vec4(c*(.86+.14*k),1.);return;}if(uFloor){float tile=mod(floor(vWorld.x/1.5)+floor(vWorld.z/1.5),2.);base=mix(vec3(.99,.83,.56),vec3(.17,.23,.36),tile);}float key=max(0.,(dot(n,uSun)+.4)/1.4);float fill=max(0.,dot(n,normalize(vec3(.8,.4,-.5))));vec3 lit=base*(vec3(.39,.40,.43)+key*.62+fill*vec3(.08,.10,.13));vec3 h=normalize(normalize(uEye-vWorld)+uSun);lit+=vec3(.04)*pow(max(0.,dot(n,h)),14.);vec3 pw=vWorld+n*.06;vec3 q=lproj(uShadowVP,pw);if(inside(q))shadow=vis(uShadowS,q,1./1024.);if(!uActor){vec3 qm=lproj(uShadowVPM,pw);if(inside(qm))shadow=min(shadow,vis(uShadowM,qm,1./512.));}lit*=mix(.62,1.,shadow)*cloudVis(vWorld);vec3 displayColor=pow(clamp(lit,0.,1.),vec3(1./2.2));
if(!uActor&&!uFloor&&!uTexBase){
  // Score palette: clearer accent colors and warm cream in the highlights.
  float luminance=dot(displayColor,vec3(.2126,.7152,.0722));
  float warmth=smoothstep(.32,.82,luminance);
  vec3 accents=mix(vec3(luminance),displayColor,1.27);
  displayColor=clamp(accents+vec3(.10,.067,.018)*warmth,0.,1.);
}
float fog=smoothstep(20.,46.,length(uEye-vWorld)/uFogK);frag=vec4(mix(displayColor,vec3(.45,.72,.94),fog),uColor.a*vColor.a);}`;

  function create(canvas) {
    let boardPanels = [], boardTex = {}, props = [], boat = [], smoke = [], smokeBall = null, arcade = null, boss = null, modeBtn = [], glowDisc = [], glowHalo = [], screenTex = null, screenCanvas = null; // 두더지팡 게임기: 구멍 빛·구멍 두더지·화면 글자
    let gl, program, U, A, environment = [], actor = [], rig = null, smileFace = null, vp = null, signs = null, size = null, seaMesh = null, shadowS = null, shadowM = null, sunQuad = null, clouds = [], rides = [], staticAt = -9, staticVP = null;
    const resetSize = () => { size = null; };
    if (root.ResizeObserver) new ResizeObserver(resetSize).observe(canvas); else root.addEventListener('resize', resetSize);
    function shader(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    }
    function setup() {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'low-power' });
      if (!gl) throw Error('WebGL2 unavailable');
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      U = {}; for (const k of ['VP', 'Model', 'Bones', 'Normal', 'Skin', 'Color', 'Floor', 'Sign', 'Tex', 'Eye', 'Player', 'Sea', 'Time', 'Sun', 'ShadowVP', 'ShadowS', 'ShadowM', 'ShadowPass', 'SunDisc', 'Cloud', 'Actor', 'ShadowVPM', 'Clouds', 'FogK', 'Glow', 'TexBase']) U[k] = gl.getUniformLocation(program, 'u' + k);
      A = {}; for (const k of ['Position', 'Normal', 'Color', 'Joints', 'Weights', 'UV']) A[k] = gl.getAttribLocation(program, 'a' + k);
      gl.enable(gl.DEPTH_TEST);
      // 해 쪽에서 본 깊이 지도: 섬·건물(1초마다 1024) / 두더지·구름(매 프레임 512) — 저사양 대비
      const depthMap = (n) => {
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, n, n, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE], [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
        gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { tex, fb, n };
      };
      shadowS = depthMap(1024); shadowM = depthMap(512);
    }
    function shadowPass(map, lvp, draws) {
      // 그리는 중인 깊이 지도를 동시에 읽으면(피드백) 브라우저가 그리기를 무시 → 먼저 연결 해제
      for (const u of [1, 2]) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, null); } gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, map.fb); gl.viewport(0, 0, map.n, map.n); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.VP, false, lvp); gl.uniform1i(U.ShadowPass, 1); draws(); gl.uniform1i(U.ShadowPass, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // 놀이기구 움직이는 부분의 월드 행렬(그리기·탄 두더지 자리 공용)
    function rideMatrix(rd, t) {
      const mo = rideMotion(rd.id, t), q = rd.id === 'disco' ? [Math.sin(mo.tilt / 2), Math.sin(mo.yaw / 2) * Math.cos(mo.tilt / 2), 0, Math.cos(mo.yaw / 2) * Math.cos(mo.tilt / 2)] : [0, 0, Math.sin(mo.swing / 2), Math.cos(mo.swing / 2)];
      return R.multiply(rd.world, R.transform({ translation: [rd.pivot[0], rd.pivot[1] + (mo.lift || 0), rd.pivot[2]], rotation: q }));
    }
    // 위치·법선만 있는 메시(구름 등)
    function rawMesh(positions, normals, indices, extra, colors) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(A.Position); gl.vertexAttribPointer(A.Position, 3, gl.FLOAT, false, 0, 0);
      const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(A.Normal); gl.vertexAttribPointer(A.Normal, 3, gl.FLOAT, false, 0, 0);
      if (colors) { const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW); gl.enableVertexAttribArray(A.Color); gl.vertexAttribPointer(A.Color, 4, gl.FLOAT, false, 0, 0); }
      for (const [k, v] of [['Color', [1, 1, 1, 1]], ['Joints', [0, 0, 0, 0]], ['Weights', [0, 0, 0, 0]], ['UV', [0, 0, 0, 0]]]) if (A[k] >= 0 && !(k === 'Color' && colors)) { gl.disableVertexAttribArray(A[k]); gl.vertexAttrib4f(A[k], ...v); }
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      return Object.assign({ vao, count: indices.length, indexed: true, color: [1, 1, 1, 1], floor: false, sign: null, sea: false }, extra);
    }
    function mesh(model, p) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      for (const [key, attribute, width] of [['Position', 'POSITION', 3], ['Normal', 'NORMAL', 3], ['Color', 'COLOR_0', 4], ['Joints', 'JOINTS_0', 4], ['Weights', 'WEIGHTS_0', 4], ['UV', 'TEXCOORD_0', 2]]) {
        const index = p.attributes[attribute], loc = A[key];
        if (loc < 0) continue;
        if (index === undefined) { gl.disableVertexAttribArray(loc); gl.vertexAttrib4f(loc, ...(key === 'Color' ? [1, 1, 1, 1] : key === 'Normal' ? [0, 1, 0, 0] : [0, 0, 0, 0])); continue; }
        // COLOR_0 VEC3(RGB)/VEC4(RGBA) 실제 폭 구분 — 3요소를 4개씩 읽으면 검은 줄 오류
        const data = R.accessor(model, index), size = model.json.accessors[index].type === 'VEC3' ? 3 : width, b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      let count = model.json.accessors[p.attributes.POSITION].count; const indexed = p.indices !== undefined;
      if (indexed) { const a = R.accessor(model, p.indices), b = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(a), gl.STATIC_DRAW); count = a.length; }
      const material = (model.json.materials && model.json.materials[p.material]) || {};
      const color = (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorFactor) || [1, 1, 1, 1];
      return { vao, count, indexed, color, matName: material.name || '', floor: material.name === 'Hub checker floor', sea: material.name === 'Home sea' };
    }
    function draw(m, world, bones) {
      gl.bindVertexArray(m.vao);
      gl.uniformMatrix4fv(U.Model, false, world); gl.uniformMatrix3fv(U.Normal, false, R.normals(world));
      gl.uniform1i(U.Skin, !!bones); gl.uniform1i(U.Actor, !!bones); if (bones) gl.uniformMatrix4fv(U.Bones, false, bones);
      gl.uniform1i(U.Floor, m.floor); gl.uniform1i(U.Sea, !!m.sea); gl.uniform4fv(U.Color, m.color);
      if (m.texBase) { gl.uniform1i(U.TexBase, 1); gl.uniform1i(U.Sign, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.texBase); gl.uniform1i(U.Tex, 0); if (m.indexed) gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); else gl.drawArrays(gl.TRIANGLES, 0, m.count); gl.uniform1i(U.TexBase, 0); return; } /* 그림 질감 + 보통 조명(Tripo 배) */
      const st = (m.sign && signs && signs.get(m.sign)) || m.tex || (m.screen && screenTex) || null;
      gl.uniform1i(U.Sign, !!st);
      if (st) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st); gl.uniform1i(U.Tex, 0); }
      if (m.indexed) gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); else gl.drawArrays(gl.TRIANGLES, 0, m.count);
    }
    async function glbTexture(model, prim) {
      const g = model.json, mt = g.materials && g.materials[prim.material], ti = mt && mt.pbrMetallicRoughness && mt.pbrMetallicRoughness.baseColorTexture;
      const img = ti && g.images[g.textures[ti.index].source], bv = img && g.bufferViews[img.bufferView];
      if (!bv) throw Error('no texture');
      const bytes = model.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      const bmp = await createImageBitmap(new Blob([bytes], { type: img.mimeType || 'image/png' }));
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      return t;
    }
    async function load(url) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
      try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw Error(r.status + ' ' + url); return R.parseGLB(await r.arrayBuffer()); }
      finally { clearTimeout(timer); }
    }
    return {
      async boot(plazaUrl, moleUrl, boatUrl, propList) {
        setup();
        const [plaza, mole, boatModel] = await Promise.all([load(plazaUrl), load(moleUrl), boatUrl ? load(boatUrl).catch(() => null) : null]);
        /* 고정 소품(Tripo, 그림 질감): [{url, world}] — 디스코 팡팡 상판·받침 */
        for (const pr of propList || []) load(pr.url).then((mdl) => { const ins = R.instances(mdl); for (const i of ins) { const m = Object.assign(mesh(mdl, i.primitive), { world: R.multiply(pr.world, i.world), local: i.world, dyn: pr.dyn, texBase: null }); glbTexture(mdl, i.primitive).then((t) => { m.texBase = t; }).catch(() => { m.plain = true; }); props.push(m); } }).catch(() => {}); /* plain = 그림 없는 모델(재질 색) */
        if (boatModel) { boat = R.instances(boatModel).map((i) => Object.assign(mesh(boatModel, i.primitive), { world: i.world, texBase: null })); for (const b of boat) glbTexture(boatModel, R.instances(boatModel)[0].primitive).then((t) => { b.texBase = t; }).catch(() => {}); }
        // Sign_<action> 판 = 간판 글자 텍스처 자리
        environment = R.instances(plaza).map((i) => Object.assign(mesh(plaza, i.primitive), { world: i.world, sign: i.name.startsWith('Sign_') ? i.name.slice(5) : null, screen: i.name.startsWith('Screen_'), tex: null, texPrim: i.name.startsWith('Tex_') ? i.primitive : null }));
        // Tex_* = GLB 안 그림을 입힌 부품(뿅망치 야구공). 그림이 준비되면 입힘(그 전엔 정점색)
        for (const m of environment) if (m.texPrim) glbTexture(plaza, m.texPrim).then((t) => { m.tex = t; }).catch(() => {});
        signs = root.MoleGame.Home3DSigns.create(gl);
        modeBtn = root.MoleGame.Home3DLayout.ARCADE_BUTTONS.map((b) => {
          const c = [1, 3, 5].map((i) => parseInt(b.color.slice(i, i + 2), 16) / 255).concat([1]), g = new Geo(), h = new Geo();
          h.lathe([[0, 0], [1.32, 0], [1.34, 0.12], [1.26, 0.2], [1.1, 0.2], [0, 0.2]], [0.95, 0.91, 0.82, 1], 28); // 오락실 버튼 받침(크림 테, 고정)
          g.lathe([[0, 0.05], [1, 0.05], [1, 0.36], [0.94, 0.48], [0.74, 0.57], [0.4, 0.62], [0, 0.63]], c, 28); // 둥글게 솟은 색 버튼(사용자: 게임기 버튼 형태)
          const mk = (q) => rawMesh(new Float32Array(q.p), new Float32Array(q.n), new Uint32Array(q.i), {}, new Float32Array(q.c));
          return { cap: mk(g), base: mk(h) };
        });
        { const sb = new Geo().ball(0, 0, 0, 1, [0.93, 0.92, 0.9, 1]); smokeBall = rawMesh(new Float32Array(sb.p), new Float32Array(sb.n), new Uint32Array(sb.i), {}, new Float32Array(sb.c)); }
        { const bp = bossPiece(); boss = rawMesh(new Float32Array(bp.p), new Float32Array(bp.n), new Uint32Array(bp.i), {}, new Float32Array(bp.c)); }
        glowDisc = root.MoleGame.Home3DLayout.ROUND_COLORS.concat(['#f2d27a']).map((hex) => {
          const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), hi = c.map((v) => v + (1 - v) * .85), N = 28, P = [0, 0, 0], Nn = [0, 1, 0], C = [...hi, 1], I = []; // 사용자: 아주 밝게
          for (let k = 0; k <= N; k++) { const a = 2 * Math.PI * k / N; P.push(Math.cos(a), 0, Math.sin(a)); Nn.push(0, 1, 0); C.push(...c.map((v) => Math.min(1, v * 1.35)), 1); if (k < N) I.push(0, k + 1, k + 2); }
          return rawMesh(new Float32Array(P), new Float32Array(Nn), new Uint32Array(I), {}, new Float32Array(C));
        });
        // 구멍 위로 은은하게 퍼지는 빛(사용자: 판에 퍼지지 말고 구멍 위로, 색 = 구멍과 같은 라운드 색). 아래 반지름 1 → 위 1.4, 위로 갈수록 투명
        glowHalo = root.MoleGame.Home3DLayout.ROUND_COLORS.concat(['#f2d27a']).map((hex) => {
          const c = [1, 3, 5].map((i) => Math.min(1, parseInt(hex.slice(i, i + 2), 16) / 255 * 1.25)), N = 36, P = [], Nn = [], C = [], I = [];
          for (let k = 0; k <= N; k++) { const a = 2 * Math.PI * k / N; for (const [rr, y, al] of [[0.96, 0, 0.6], [1.12, 0.35, 0.28], [1.4, 1, 0]]) /* 위로 넓게 퍼지며 은은하게 사라짐(사용자) */ { P.push(Math.cos(a) * rr, y, Math.sin(a) * rr); Nn.push(0, 1, 0); C.push(...c, al); } if (k < N) { const b = k * 3; I.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); } }
          return rawMesh(new Float32Array(P), new Float32Array(Nn), new Uint32Array(I), {}, new Float32Array(C));
        });
        environment = environment.filter((m) => !m.sea); // GLB 의 평평한 바다 판 대신 움직이는 격자
        { const sg = seaGrid(48, 60), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
          const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, sg.positions, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(A.Position); gl.vertexAttribPointer(A.Position, 3, gl.FLOAT, false, 0, 0);
          for (const [k, v] of [['Normal', [0, 1, 0, 0]], ['Color', [1, 1, 1, 1]], ['Joints', [0, 0, 0, 0]], ['Weights', [0, 0, 0, 0]], ['UV', [0, 0, 0, 0]]]) if (A[k] >= 0) { gl.disableVertexAttribArray(A[k]); gl.vertexAttrib4f(A[k], ...v); }
          const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sg.indices, gl.STATIC_DRAW);
          seaMesh = { vao, count: sg.indices.length, indexed: true, color: [1, 1, 1, 1], floor: false, sign: null, sea: true }; }
        {
          const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
          const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(18), gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(A.Position); gl.vertexAttribPointer(A.Position, 3, gl.FLOAT, false, 0, 0);
          const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
          gl.enableVertexAttribArray(A.UV); gl.vertexAttribPointer(A.UV, 2, gl.FLOAT, false, 0, 0);
          for (const [k, v] of [['Normal', [0, 1, 0, 0]], ['Color', [1, 1, 1, 1]], ['Joints', [0, 0, 0, 0]], ['Weights', [0, 0, 0, 0]]]) if (A[k] >= 0) { gl.disableVertexAttribArray(A[k]); gl.vertexAttrib4f(A[k], ...v); }
          sunQuad = { vao, pb, count: 6, indexed: false, color: [1, 1, 1, 1], floor: false, sign: null, sea: false };
        }
        clouds = CLOUDS.map((_, i) => { const c = cloudMesh(i + 1); return rawMesh(c.positions, c.normals, c.indices, { cloud: true }); });
        const mk = (g) => rawMesh(new Float32Array(g.p), new Float32Array(g.n), new Uint32Array(g.i), {}, new Float32Array(g.c));
        rides = root.MoleGame.Home3DLayout.RIDES.map((rd) => { const pr = rideParts(rd.id), yaw = Math.atan2(-rd.x, -rd.z); return { id: rd.id, base: mk(pr.base), mov: mk(pr.mov), pivot: pr.pivot, world: R.transform({ translation: [rd.x, 0, rd.z], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] }) }; });
        rig = R.prepare(mole); actor = [];
        const smile = rig.animations.find((clip) => clip.name === 'Smile');
        smileFace = smile?.tracks.filter((track) => {
          const name = rig.model.json.nodes[track.node].name;
          return name === 'Jaw' || /^(Brow|MouthCorner|HappyEye)\.[LR]$/.test(name)
            || (track.path === 'scale' && /^(Eye|PainEye)\.[LR]$/.test(name));
        });
        mole.json.nodes.forEach((n, node) => { // 일반 홈 = Mole_Clay_Skin 만(Carrier/CarryBomb 렌더 금지)
          if (n.name !== 'Mole_Clay_Skin' || n.mesh === undefined) return;
          for (const p of mole.json.meshes[n.mesh].primitives) { const m = Object.assign(mesh(mole, p), { node }); actor.push(m); glbTexture(mole, p).then((t) => { m.texBase = t; }).catch(() => {}); } /* V1655 C: 신규 두더지 = 그림(텍스처) 색 */
        });
        if (!actor.length) throw Error('Mole skin missing');
      },
      // 한 프레임 그리기. view={x,z,heading,yaw,pitch}, pose={clip, t, loop, y}(y=두더지 높이)
      render(view, pose) {
        // 화면 크기는 바뀔 때만 읽음(매 프레임 배치 계산 방지), 해상도는 1.25배까지(저사양 폰)
        if (!size) { const b = canvas.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 1.25); size = { cw: b.width, ch: b.height, w: Math.max(1, Math.round(b.width * dpr)), h: Math.max(1, Math.round(b.height * dpr)) }; }
        const w = size.w, h = size.h;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        const cam = camera(view, w, h); vp = cam.vp;
        gl.clearColor(0.45, 0.72, 0.94, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program); gl.uniformMatrix4fv(U.VP, false, vp); gl.uniform3fv(U.Eye, cam.eye); gl.uniform2f(U.Player, view.x, view.z);
        const now = performance.now() / 1000, sun = sunDir(now);
        gl.uniform1f(U.FogK, Math.max(1, (view.far || 80) / 80)); /* 높이 날면 안개 거리도 멀리(V1635 C) */
        gl.uniform1f(U.Time, now % 10000); gl.uniform3fv(U.Sun, sun);
        const worlds = R.pose(rig, pose.clip, pose.t, pose.loop, smileFace);
        const inst = R.transform({ translation: [view.x, pose.y || 0, view.z], rotation: [0, Math.sin(view.heading / 2), 0, Math.cos(view.heading / 2)], scale: [0.65 * (pose.s ?? 1), 0.65 * (pose.s ?? 1), 0.65 * (pose.s ?? 1)] }); // pose.s = 크기(동전 구멍으로 빨려 듦)
        const drawMole = () => { if (pose.s === 0) return; if (pose.fade) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); for (const m of actor) { m.color0 = m.color0 || m.color; m.color = [m.color0[0], m.color0[1], m.color0[2], m.color0[3] * (1 - pose.fade * 0.85)]; } } for (const m of actor) draw(m, R.multiply(inst, worlds[m.node]), R.palette(rig, worlds, m.node)); if (pose.fade) { for (const m of actor) m.color = m.color0; gl.disable(gl.BLEND); } };
        const drawClouds = () => { clouds.forEach((m, i) => { const c = cloudPos(i, now); gl.uniform1i(U.Cloud, 1); draw(m, R.transform({ translation: [c[0], c[1], c[2]], scale: [c[3], c[3], c[3]] }), null); gl.uniform1i(U.Cloud, 0); }); };
        // 그림자: 해 쪽에서 섬 전체(반지름 16)를 내려다보는 직교 카메라. 섬·건물은 1초마다, 두더지·구름은 매 프레임
        if (now - staticAt > 1 || !staticVP) {
          staticAt = now;
          staticVP = R.multiply(ortho(-21, 21, -21, 21, 1, 80), R.lookAt([sun[0] * 40, sun[1] * 40, sun[2] * 40], [0, 0, 0]));
          shadowPass(shadowS, staticVP, () => { for (const m of environment) if (!m.sign && !m.texPrim && !m.screen) draw(m, m.world, null); for (const rd of rides) draw(rd.base, rd.world, null); for (const pm of props) if ((pm.texBase || pm.plain) && pm.dyn !== 'discoTop') draw(pm, pm.world, null); }); /* V1665 C 사용자: 소품 그림자(움직이는 디스코 상판은 아래 두더지 그림자에서) */
        }
        const mc = [view.x, (pose.y || 0) + 0.8, view.z];
        const moleVP = R.multiply(ortho(-3.4, 3.4, -3.4, 3.4, 1, 60), R.lookAt([mc[0] + sun[0] * 30, mc[1] + sun[1] * 30, mc[2] + sun[2] * 30], mc));
        { const D = root.MoleGame.Home3DLayout.DISCO, nearD = Math.hypot(mc[0] - D.x, mc[2] - D.z) < 5;
          shadowPass(shadowM, moleVP, () => { drawMole(); if (nearD) for (const pm of props) if (pm.dyn === 'discoTop' && (pm.texBase || pm.plain)) draw(pm, R.multiply(discoTopMatrix(), pm.local), null); }); } /* 디스코 상판 그림자 = 매 프레임(돌고 튐) */
        gl.viewport(0, 0, w, h); gl.uniformMatrix4fv(U.VP, false, vp); gl.uniformMatrix4fv(U.ShadowVP, false, staticVP); gl.uniformMatrix4fv(U.ShadowVPM, false, moleVP);
        gl.uniform4fv(U.Clouds, new Float32Array(CLOUDS.map((_, i) => cloudPos(i, now)).flat()));
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowS.tex); gl.uniform1i(U.ShadowS, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, shadowM.tex); gl.uniform1i(U.ShadowM, 2);
        gl.activeTexture(gl.TEXTURE0);
        for (const m of environment) draw(m, m.world, null);
        if (seaMesh) { /* V1635 C: 바다가 카메라를 따라감(끝없는 바다), 높이 오를수록 넓게 — 격자 칸(2.5) 단위로 옮겨 물결 안 흔들림 */
          const sk = Math.max(1, Math.pow(2, Math.ceil(Math.log2(1 + (cam.eye[1] - 1.35) / 25)))), cell = 2.5 * sk;
          draw(seaMesh, R.transform({ translation: [Math.round(cam.focus[0] / cell) * cell, 0, Math.round(cam.focus[2] / cell) * cell], scale: [sk, 1, sk] }), null); }
        { /* V1666 C 사용자: 디스코 팡팡 불빛 — 돌 때 위 금색 공, 튈 때 아래 노란 전구가 색색으로 빛남 */
          const D = root.MoleGame.Home3DLayout.DISCO, gs = Math.min(1, D.glowSpin || 0), gb = Math.min(1, D.glowBounce || 0), RB = [[1, .35, .5], [1, .7, .2], [1, .95, .3], [.4, 1, .5], [.35, .8, 1], [.75, .5, 1]];
          for (const pm of props) { if (!(pm.texBase || pm.plain)) continue; const W = pm.dyn === 'discoTop' ? R.multiply(discoTopMatrix(), pm.local) : pm.world;
            const st = /^(stud|bulb)([0-9]+)/.exec(pm.matName || ''), g = st ? (st[1] === 'stud' ? gs : gb) : 0;
            if (g > 0.02) { const n = +st[2], c = RB[(n + Math.floor(now * 6)) % RB.length], b = pm.color0 || (pm.color0 = pm.color.slice());
              gl.vertexAttrib4f(A.Color, b[0] + (c[0] - b[0]) * g, b[1] + (c[1] - b[1]) * g, b[2] + (c[2] - b[2]) * g, 1); gl.uniform1i(U.Glow, 1); draw(pm, W, null); gl.uniform1i(U.Glow, 0); gl.vertexAttrib4f(A.Color, 1, 1, 1, 1); }
            else draw(pm, W, null); } }
        for (const bp of boardPanels) if (boardTex[bp.kind]) { bp.mesh.tex = boardTex[bp.kind]; draw(bp.mesh, bp.world, null); } /* 게시판 칸(V1650 C) */
        if (boat.length) { const bm = boatMatrix(now); for (const b of boat) if (b.texBase) draw(b, R.multiply(bm, b.world), null); } /* 바다 배 */
        if (arcade) {
          gl.uniform1i(U.Glow, 1);
          for (const h of arcade.holes) if (h.glow >= 0 && glowDisc[h.glow]) draw(glowDisc[h.glow], R.transform({ translation: [h.x, h.y - 0.05, h.z], scale: [h.r * 0.97, 1, h.r * 0.97] }), null);
          { const cu = arcade.mole; if (cu && cu.n && glowDisc[8] && Math.sin(now * 7) > 0) draw(glowDisc[8], R.transform({ translation: [cu.x, cu.y - 0.05, cu.z], scale: [cu.r * 0.97, 1, cu.r * 0.97] }), null); }
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE); // 색 그대로 반투명
          const pulse = 1 + 0.08 * Math.sin(now * 3);
          for (const h of arcade.holes) if (h.glow >= 0 && glowHalo[h.glow]) draw(glowHalo[h.glow], R.transform({ translation: [h.x, h.y - 0.02, h.z], scale: [h.r, 0.9 * pulse, h.r] }), null);
          const cu = arcade.mole; /* 지금 라운드 구멍 = 깜빡깜빡(사용자: 안 깬 구멍과 구별) */
          const blinkOn = cu && cu.n && glowHalo[8] && Math.sin(now * 7) > 0; /* 밝은 금빛(라운드 색이 짙으면 안 보여서) */
          if (blinkOn) draw(glowHalo[8], R.transform({ translation: [cu.x, cu.y - 0.02, cu.z], scale: [cu.r, 1.1, cu.r] }), null);
          gl.depthMask(true); gl.disable(gl.BLEND);
          for (const fl of arcade.flash || []) { const h = arcade.holes.find((x) => x.n === fl), gi = fl === 0 ? 8 : fl - 1; if (h && glowDisc[gi]) draw(glowDisc[gi], R.transform({ translation: [h.x, h.y - 0.03, h.z], scale: [h.r * 0.97, 1, h.r * 0.97] }), null); }
          gl.uniform1i(U.Glow, 0);
          (arcade.buttons || []).forEach((b, k) => {
            const mb = modeBtn[k]; if (!mb) return; const m = mb.cap;
            const keep = m.color, dim = b.unlocked ? (b.active ? 1.12 : 0.92) : 0.45;
            m.color = [dim, dim, dim, 1];
            draw(mb.base, R.transform({ translation: [b.x, b.y, b.z], scale: [b.r, b.r, b.r] }), null); // 받침은 그대로
            draw(m, R.transform({ translation: [b.x, b.y - 0.22 * b.r * (b.pressed || 0), b.z], scale: [b.r, b.r, b.r] }), null); // 색 버튼만 쑥 들어감
            m.color = keep;
          });
          const mh = arcade.moleOn ? arcade.mole : null;
          if (mh) { // 지금 라운드 구멍: 두더지가 고개를 내밂(정면 = 섬 가운데 쪽 +z), 살짝 들썩
            const mp = mh.pose || { clip: 'RimIdle', t: now, loop: true }, w2 = R.pose(rig, mp.clip, mp.t, mp.loop, smileFace), sc = 0.31; // 게임과 같은 구멍 동작. 손 간격 2.16 × 0.31 ≈ 구멍 지름
            const jumpUp = mp.clip === 'Appear' ? 1.1 * Math.sin(Math.PI * Math.min(1, mp.t / 0.8)) : 0; // 게임: 튀어오를 때 1.1 위로
            const i2 = R.transform({ translation: [mh.x, mh.y - 1.2 * sc + jumpUp * sc, mh.z], scale: [sc, sc, sc] }); // 사용자: 대기 = 두 손이 구멍 턱에 얹힘(RimIdle 손 높이 1.2)
            for (const m of actor) draw(m, R.multiply(i2, w2[m.node]), R.palette(rig, w2, m.node));
          }
        }
        drawMole(); drawClouds();
        for (const rd of rides) {
          draw(rd.base, rd.world, null);
          draw(rd.mov, rideMatrix(rd, now), null);
        }
        if (smokeBall && smoke.length) { // 동전 구멍으로 빨려 드는 연기
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
          for (const p of smoke) { smokeBall.color = [1, 1, 1, p.a]; draw(smokeBall, R.transform({ translation: [p.x, p.y, p.z], scale: [p.r, p.r, p.r] }), null); }
          smokeBall.color = [1, 1, 1, 1]; gl.depthMask(true); gl.disable(gl.BLEND);
        }
        const fin = arcade && arcade.holes.find((h) => h.n === 0);
        if (boss && fin) {
          const yaw = now * 0.8, sc = 0.62; // 높이만 0.65배(사용자: 보스 말 낮춰 뒤 구멍 보이게)
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
          draw(boss, R.transform({ translation: [fin.x, fin.y - 0.12, fin.z], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], scale: [sc, sc * 0.65, sc] }), null);
          gl.depthMask(true); gl.disable(gl.BLEND);
        }
        // 하늘의 해: 카메라를 향한 사각형(원 밖은 버림), 카메라에서 해 방향 60 거리
        if (sunQuad) {
          const c = [cam.eye[0] + sun[0] * 60, cam.eye[1] + sun[1] * 60, cam.eye[2] + sun[2] * 60];
          const fx = cam.focus[0] - cam.eye[0], fz = cam.focus[2] - cam.eye[2], fl = Math.hypot(fx, fz) || 1, S = 3.2;
          const ux = [fz / fl * S, 0, -fx / fl * S], up = [0, S, 0];
          const P = (a, b) => [c[0] + ux[0] * a + up[0] * b, c[1] + ux[1] * a + up[1] * b, c[2] + ux[2] * a + up[2] * b];
          gl.bindBuffer(gl.ARRAY_BUFFER, sunQuad.pb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([P(-1, -1), P(1, -1), P(1, 1), P(-1, -1), P(1, 1), P(-1, 1)].flat()));
          gl.uniform1i(U.SunDisc, 1); gl.disable(gl.CULL_FACE); draw(sunQuad, R.identity(), null); gl.uniform1i(U.SunDisc, 0);
        }
      },
      // 두더지팡 게임기 상태: holes=[{x,y,z,r,glow(라운드 색 번호, -1=빛 없음)}], mole={x,y,z}|null, buttons=[{x,y,z,r,unlocked,active,pressed}], flash=[구멍 번호…]
      setArcade(a) { arcade = a; },
      setSmoke(list) { smoke = list || []; },
      // 게임기 화면 글자(두 줄). 바뀔 때만 호출
      /* V1650 C: 게시판 칸 6개(앞뒤) — panels = [{ kind, world, w, h }], 칸 그림은 drawBoard 로 */
      setBoard(panels) {
        if (!gl) return;
        boardPanels = panels.map((p) => { const hw = p.w / 2, hh = p.h / 2, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
          const buf = (data, loc, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
          buf([-hw, hh, 0, hw, hh, 0, hw, -hh, 0, -hw, -hh, 0], A.Position, 3); buf([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], A.Normal, 3); buf([0, 0, 1, 0, 1, 1, 0, 1], A.UV, 2);
          for (const [k, v] of [['Color', [1, 1, 1, 1]], ['Joints', [0, 0, 0, 0]], ['Weights', [0, 0, 0, 0]]]) if (A[k] >= 0) { gl.disableVertexAttribArray(A[k]); gl.vertexAttrib4f(A[k], ...v); }
          const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array([0, 3, 1, 1, 3, 2]), gl.STATIC_DRAW);
          return { kind: p.kind, world: p.world, mesh: { vao, count: 6, indexed: true, color: [1, 1, 1, 1], floor: false, sign: null, sea: false, tex: null } }; });
      },
      drawBoard(data, page, ko) {
        if (!gl || !root.MoleGame.Home3DBoard) return;
        const B = root.MoleGame.Home3DBoard;
        for (const kind of B.KINDS) { const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * root.MoleGame.Home3DLayout.BOARD.PANEL_H / root.MoleGame.Home3DLayout.BOARD.PANEL_W); /* 칸 비율 그대로(글자 안 찌그러짐) */
          B.drawPanel(c.getContext('2d'), c.width, c.height, kind, Object.assign({}, data[kind], { at: page, bare: true, lang: ko ? 'ko' : (root.FGH.I18N.lang || 'en') }));
          const t = boardTex[kind] || (boardTex[kind] = gl.createTexture()); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      },
      setScreen(line1, line2) {
        if (!gl) return;
        if (!screenCanvas) screenCanvas = document.createElement('canvas');
        const c = screenCanvas, W = 512, H = 368; c.width = W; c.height = H; const g = c.getContext('2d');
        g.fillStyle = '#2b2f45'; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#4a5275'; g.lineWidth = 10; g.strokeRect(10, 10, W - 20, H - 20);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const fit = (txt, size, wt) => { g.font = wt + ' ' + size + 'px system-ui,sans-serif'; while (g.measureText(txt).width > W - 60 && size > 20) { size -= 3; g.font = wt + ' ' + size + 'px system-ui,sans-serif'; } };
        const TX = root.MoleGame.Home3DText, lang = (root.FGH && root.FGH.I18N && root.FGH.I18N.lang) || 'ko';
        if (TX) { TX.neon(g, line1, W / 2, H * 0.36, 70, lang, W - 70, 0); TX.candy(g, line2, W / 2, H * 0.72, 56, lang, W - 80, '#fff3a0', '#ffb21f'); } /* V1653 C 사용자: 제목 = 네온(단어마다 색), 점수 = 노란 사탕 */
        else { fit(line1, 76, '800'); g.fillStyle = '#ffe9a8'; g.fillText(line1, W / 2, H * 0.36);
        fit(line2, 58, '700'); g.fillStyle = '#9fe0ff'; g.fillText(line2, W / 2, H * 0.7); }
        if (!screenTex) screenTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, screenTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      },
      // 언어 변경 때만 호출(렌더 루프에서 부르지 않음)
      buildSigns(lang, sites, t) { if (signs) signs.build(lang, sites, t); },
      // 탄 두더지 자리: 디스코 = 원판 가장자리(바깥을 봄), 바이킹 = 배 갑판(옆을 봄)
      seat(id) {
        if (id === 'disco') { const M = discoTopMatrix(), p = R.point(M, [0.14, 0.07, 0]), c = R.point(M, [-0.2, 0.07, 0]); /* V1665 C 사용자: 꼬리·몸이 그릇 밖으로 안 나오게 안쪽(0.3 → 0.14) */ return { x: p[0], y: p[1], z: p[2], heading: Math.atan2(c[0] - p[0], c[2] - p[2]) }; } /* V1660 C: 상판 안쪽 가장자리, 가운데를 봄 */
        const rd = rides.find((x) => x.id === id); if (!rd) return null;
        const M = rideMatrix(rd, performance.now() / 1000), loc = id === 'disco' ? [1.35, 0.2, 0] : [0.9, -2.5, 0], dir = id === 'disco' ? [1, 0, 0] : [0, 0, 1];
        const p = R.point(M, loc), q = R.point(M, [loc[0] + dir[0], loc[1] + dir[1], loc[2] + dir[2]]);
        return { x: p[0], y: p[1], z: p[2], heading: Math.atan2(q[0] - p[0], q[2] - p[2]) };
      },
      vp: () => vp,
      size: () => size, // {cw,ch} = CSS 픽셀 크기(터치·버튼 위치 계산용)
      lost(cb) { canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cb(); }); }
    };
  }

  const api = { create, boatMatrix, camera, project, rayFloor, rayPlane, pickSite, seaHeight, seaGrid, sunDir, SUN_PERIOD, cloudMesh, cloudPos, rideParts, rideMotion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
