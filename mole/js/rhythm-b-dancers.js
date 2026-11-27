/* V1824 C 네온 새 방식(시험판, 주소에 ?neon2=1 일 때만): 위 판 9자리에 3D 두더지가 박자 0.5초 전 어둡게 나타나고,
   박자에 앞쪽 스포트가 비추며, 맞히면 춤추며 사라지고 놓치면 비틀거리며 사라짐. 판정·채보는 기존 그대로. */
(function (root) {
 'use strict';
 const MG = root.MoleGame = root.MoleGame || {};
 const LEAD = .5, MISS_OUT = .3, SIZE = .78 * .9 /* V1827 C 사용자: 두더지 조금 작게(발 위치는 그대로) */, STYLE = 'spiky', COSTUME = 'hold-time', HAIR = [.80, .02, .02, 1];
 // 춤 조각: [클립, 시작 시각] — 0.45초 동안 2배 빠르게(0.9초 분량)
 const MOVES = [['DanceFreestyle', 1.0], ['DanceFreestyle', 6.0], ['DanceArmWave', 1.0], ['DanceHop', .5], ['DanceTwist', .5], ['DanceRobot', .5]]; // 시작 = 춤 박자 정수(클립 0.5초 = 1박)
 function create(board) {
  const canvas = document.createElement('canvas'); canvas.className = 'rb-dancers'; canvas.setAttribute('aria-hidden', 'true'); board.appendChild(canvas);
  const spots = Array.from({ length: 9 }, (_, lane) => { const el = document.createElement('i'); el.className = 'rb-dance-spot'; el.setAttribute('aria-hidden', 'true');
   el.style.left = ((26 + (lane % 3) * 300 + 150) / 952 * 100) + '%'; el.style.top = ((26 + Math.floor(lane / 3) * 300 + 150) / 2078 * 100) + '%'; board.appendChild(el); return el; });
  // V1827 C 사용자 에셋 ①②③: 무대 바닥 자국(위 9칸)·아래 칸 옅은 선, 위쪽 무대 조명 기구, 콤보 단계별 무대(10 빛줄기·30 연기·50 쓸기)
  const LIGHTS = 'assets/rhythm/type-lights-v1791/';
  const floors = Array.from({ length: 9 }, (_, lane) => { const el = document.createElement('i'); el.className = 'rb-stage-floor'; el.setAttribute('aria-hidden', 'true');
   el.style.left = ((26 + (lane % 3) * 300 + 150) / 952 * 100) + '%'; el.style.top = ((26 + Math.floor(lane / 3) * 300 + 262) / 2078 * 100) + '%'; el.style.backgroundImage = 'url("assets/rhythm-b/circuit-rim-' + lane + '.svg")'; /* V1827 C 사용자: 발판 = 아래 기판 버튼 그림을 눕힌 것 */ board.appendChild(el); return el; });
  const grid = document.createElement('div'); grid.className = 'rb-stage-grid'; grid.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 9; i++) grid.appendChild(document.createElement('i')); board.appendChild(grid);
  const haze = document.createElement('div'); haze.className = 'rb-stage-haze'; haze.setAttribute('aria-hidden', 'true'); board.appendChild(haze);
  const FIX = [[.10, '#4fd8ff', -14], [.30, '#ff5cc8', 8], [.50, '#b48cff', -6], [.70, '#ff5cc8', 12], [.90, '#4fd8ff', -10]];
  const fixtures = FIX.map(([x, color, aim], i) => {
   const beam = document.createElement('i'); beam.className = 'rb-stage-beam'; beam.setAttribute('aria-hidden', 'true'); beam.style.left = (x * 100) + '%'; beam.style.setProperty('--beam-color', color); beam.style.setProperty('--beam-aim', aim + 'deg'); beam.style.setProperty('--beam-delay', (-i * .7) + 's'); board.appendChild(beam);
   const fix = document.createElement('i'); fix.className = 'rb-stage-fixture'; fix.setAttribute('aria-hidden', 'true'); fix.style.left = (x * 100) + '%'; fix.style.setProperty('--beam-aim', aim + 'deg'); fix.style.setProperty('--beam-delay', (-i * .7) + 's'); fix.style.setProperty('--lights', 'url("' + LIGHTS + 'mount.webp?v=1791-C")'); fix.style.setProperty('--heads', 'url("' + LIGHTS + 'heads-six-poses.webp?v=1791-C")'); board.appendChild(fix);
   beam.style.setProperty('--beams', 'url("' + LIGHTS + 'beams-four.webp?v=1791-C")'); return { beam, fix, x, aim, angle: null, op: null };
  });
  // V1827 C 사용자: 조명은 나타난 두더지를 비췄다가 두더지가 사라지면 꺼짐 — 두더지마다 가까운 빈 조명이 고개를 돌려 비춤
  function aimFixtures(t, targets) {
   const bw = board.clientWidth, bh = board.clientHeight; if (!bw) return; const used = new Set(), want = new Map();
   targets.sort((a, b) => b.level - a.level);
   for (const tg of targets) { const cx = (26 + (tg.lane % 3) * 300 + 150) / 952 * bw; let best = -1, bd = 1e9; fixtures.forEach((f, i) => { if (used.has(i)) return; const d = Math.abs(f.x * bw - cx); if (d < bd) { bd = d; best = i; } }); if (best < 0) break; used.add(best); const py = (26 + Math.floor(tg.lane / 3) * 300 + 262) / 2078 * bh, ay = -.0044 * bh, dx = cx - fixtures[best].x * bw, dy = py - ay; want.set(best, { angle: -Math.atan2(dx, dy) * 180 / Math.PI, op: tg.level, len: Math.hypot(dx, dy) / .757, color: LANE_COLORS[tg.lane] }); } /* V1827 C 사용자: 조명 렌즈 = 빛 꼭짓점, 빛 끝 = 두더지 발판(바닥 자국) */
   fixtures.forEach((f, i) => { const w = want.get(i), angle = w ? w.angle : (f.lastAngle ?? f.aim), op = w ? w.op : 0; if (w) f.lastAngle = w.angle; /* V1830 C 사용자 FPS: 쉬는 조명은 멈춤 */
    const a = angle.toFixed(1) + 'deg', o = op.toFixed(2); if (f.angle !== a) { f.angle = a; f.beam.style.rotate = a; f.fix.style.rotate = a; } if (f.op !== o) { f.op = o; f.beam.style.opacity = o; const vis = op > .005 ? 'visible' : 'hidden'; if (f.vis !== vis) { f.vis = vis; f.beam.style.visibility = vis; } } /* 꺼진 빛줄기는 그리지 않음 */ if (w) { const L = Math.round(w.len) + 'px'; if (f.len !== L) { f.len = L; f.beam.style.height = L; } if (f.color !== w.color) { f.color = w.color; f.beam.style.setProperty('--beam-color', w.color); } } }); /* 조명 색 = 비추는 칸 버튼 색 */
  }
  let shownStage = -1, gridKey = '';
  function stageFor(combo) { return combo >= 50 ? 3 : combo >= 30 ? 2 : combo >= 10 ? 1 : 0; }
  function layoutGrid() {
   const br = board.getBoundingClientRect(), hits = board.querySelectorAll('.rb-hit'); if (!br.width || hits.length < 9) return;
   const key = br.width + 'x' + br.height; if (key === gridKey) return; gridKey = key;
   hits.forEach((h, i) => { const r = h.getBoundingClientRect(), c = grid.children[i]; c.style.left = ((r.left - br.left) / br.width * 100) + '%'; c.style.top = ((r.top - br.top) / br.height * 100) + '%'; c.style.width = (r.width / br.width * 100) + '%'; c.style.height = (r.height / br.height * 100) + '%'; });
  }  let gl = null, glc = null, ctx2 = null, ready = false, R = null, AP = null, rig = null, parts = [], U = {}, A = {}, failed = false, lastMove = -1;
  const live = new Map(); // note id -> {n, lane, move, hitAt, grade, missAt}
  async function init() {
   R = root.StudioRig; AP = MG.MoleAppearances; const TM = MG.RhythmTypeMole;
   if (!R || !AP || !TM) throw Error('3D runtime missing');
   glc = document.createElement('canvas'); gl = glc.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true }); if (!gl) throw Error('WebGL2 unavailable'); ctx2 = canvas.getContext('2d');
   const buf = await (await fetch('assets/characters-v1692/mole-rhythm-dance-v2.glb')).arrayBuffer();
   const model = await AP.prepare(R.parseGLB(buf), [STYLE]), worn = await AP.wornCostume(COSTUME);
   rig = R.prepare(model); TM.addDanceVariations(rig, R);
   const J = rig.skins[0].joints.length;
   const vs = `#version 300 es
precision highp float;in vec3 aPosition,aNormal;in vec4 aColor,aJoints,aWeights;uniform mat4 uModel,uVP,uBones[${J}];uniform mat3 uNormal;uniform bool uSkin;out vec3 vNormal;out vec4 vColor;
void main(){mat4 s=mat4(1.);if(uSkin)s=aWeights.x*uBones[int(aJoints.x)]+aWeights.y*uBones[int(aJoints.y)]+aWeights.z*uBones[int(aJoints.z)]+aWeights.w*uBones[int(aJoints.w)];vec4 p=uModel*s*vec4(aPosition,1.);vNormal=normalize(uNormal*mat3(s)*aNormal);vColor=aColor;gl_Position=uVP*p;}`;
   const fs = `#version 300 es
precision highp float;in vec3 vNormal;in vec4 vColor;uniform vec4 uColor;uniform float uLight,uAlpha;uniform vec3 uTint;out vec4 frag;
void main(){vec3 n=normalize(vNormal);float key=max(0.,dot(n,normalize(vec3(0.,.35,1.))));float rim=max(0.,dot(n,normalize(vec3(.6,.4,-.7))));
vec3 c=uColor.rgb*vColor.rgb*(.30+key*.80)*uLight+uTint*rim*.6;c=pow(clamp(c,0.,1.),vec3(1./2.2));frag=vec4(c*uAlpha,uAlpha);}`;
   const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(x)); return x; };
   const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
   for (const n of ['Model', 'VP', 'Normal', 'Skin', 'Color', 'Light', 'Alpha', 'Tint']) U[n] = gl.getUniformLocation(pr, 'u' + n); U.Bones = gl.getUniformLocation(pr, 'uBones[0]');
   for (const n of ['Position', 'Normal', 'Color', 'Joints', 'Weights']) A[n] = gl.getAttribLocation(pr, 'a' + n);
   const skinNode = model.json.nodes.findIndex(n => n.name === 'Mole_Clay_Skin');
   const jn = model.json.skins[model.json.nodes[skinNode].skin].joints.map(n => model.json.nodes[n].name), bodyJ = jn.indexOf('Body'), clothMap = jn.map((nm, i) => /^(UpperArm|Forearm|Hand|Finger|Thumb|Armpit)/.test(nm) ? bodyJ : i);
   function add(source, p, node, style, map, color) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    for (const [name, key, w] of [['Position', 'POSITION', 3], ['Normal', 'NORMAL', 3], ['Color', 'COLOR_0', 4], ['Joints', 'JOINTS_0', 4], ['Weights', 'WEIGHTS_0', 4]]) {
     const a = p.attributes[key]; if (a === undefined || A[name] < 0) continue;
     let d = name === 'Color' && style ? (AP.vertexColors(source, p, style) || R.accessor(source, a)) : R.accessor(source, a); if (name === 'Joints' && map) d = Float32Array.from(d, v => map[v] ?? v);
     const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d instanceof Float32Array ? d : new Float32Array(d), gl.STATIC_DRAW); gl.enableVertexAttribArray(A[name]); gl.vertexAttribPointer(A[name], source.json.accessors[a].type === 'VEC3' ? 3 : w, gl.FLOAT, false, 0, 0);
    }
    const idx = R.accessor(source, p.indices), ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    const mat = source.json.materials?.[p.material]; parts.push({ vao, node, count: idx.length, color: color || (style && mat ? AP.materialColor(mat, style) : mat?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]) });
   }
   if (A.Color >= 0) gl.vertexAttrib4f(A.Color, 1, 1, 1, 1);
   model.json.nodes.forEach((n, i) => { if (n.mesh === undefined) return; const h = AP.hairStyle(n); if (n.name !== 'Mole_Clay_Skin' && h !== STYLE) return; for (const p of model.json.meshes[n.mesh].primitives) add(model, p, i, STYLE, null, h === STYLE ? HAIR : null); });
   if (worn) for (const { primitive } of R.instances(worn)) add(worn, primitive, skinNode, null, clothMap);
   gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
   partNodes = [...new Set(parts.map(p => p.node))]; ready = true;
  }
  // V1826 C 사용자: HARD FPS — 춤·대기 자세(뼈 48개)를 1/60초 간격으로 미리 계산해 두고 꺼내 씀(3D 화질 그대로, 매 프레임 계산 없음)
  let partNodes = []; const poseCache = new Map();
  function cachedPose(clip, time) {
   let f = Math.round(time * 60); if (clip === 'Idle') f %= 120; const key = clip + '|' + f; let e = poseCache.get(key); if (e) return e;
   const ws = AP.pose(rig, clip, f / 60, true, null, f / 60, STYLE); e = new Map(); for (const node of partNodes) e.set(node, { world: ws[node], pal: R.palette(rig, ws, node) }); poseCache.set(key, e); return e;
  }
  const loading = init().catch(e => { failed = true; console.warn('Neon dancers unavailable', e); });
  const LANE_COLORS = ['#086aff', '#ff1529', '#ffc400', '#05e52e', '#a500ff', '#ff0099', '#ff7900', '#00cfff', '#a65121']; // V1828 C 사용자: 아래 버튼 색과 같게
  function pickMove(n) { if (n.danceMove != null) return n.danceMove; let m = Math.floor(Math.random() * MOVES.length); if (m === lastMove) m = (m + 1) % MOVES.length; lastMove = m; return m; }
  function track(n) { if (!live.has(n.id)) live.set(n.id, { n, lane: n.lane, move: -1 }); return live.get(n.id); }
  // 같은 박자 동시 노트는 같은 춤(단체 춤)
  const chordMoves = new Map();
  function hit(n, grade, t) { const d = track(n); d.hitAt = t; d.grade = grade; const key = n.targetTime.toFixed(3); if (!chordMoves.has(key)) chordMoves.set(key, pickMove(n)); d.move = chordMoves.get(key); }
  function miss(n, t) { const d = track(n); d.missAt = t; }
  function clear() { shownStage = -1; board.dataset.danceStage = '0'; live.clear(); chordMoves.clear(); spots.forEach(s => { s.style.opacity = '0'; }); if (ctx2) ctx2.clearRect(0, 0, canvas.width, canvas.height); }
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  // 매 프레임: 다가오는 노트(박자 0.5초 전부터)·춤추는 노트를 그림
  // V1824 C 사용자: 춤 빠르기를 곡 박자에 맞춤 — 맞힌 뒤 1박 동안 춤 2박 분량을 재생(튕기는 순간이 박자에 떨어짐)
  function render(t, notes, renderCursor, bpm, combo) {
   { const st = stageFor(combo || 0); if (st !== shownStage) { shownStage = st; board.dataset.danceStage = String(st); } layoutGrid(); }
   const beat = 60 / (bpm || 120), danceLen = Math.max(.32, Math.min(.55, beat)), rate = 1 / beat;
   for (let id = renderCursor; id < notes.length; id++) { const n = notes[id]; if (n.targetTime - LEAD > t) break; if (n.state === 'pending') track(n); }
   const spotLevel = new Float32Array(9);
   const list = [], targets = [];
   for (const [id, d] of live) {
    const n = d.n; let alpha, light, clip = 'Idle', time = 0, scale = 1, tilt = 0;
    if (d.hitAt != null) { const k = (t - d.hitAt) / danceLen; if (k >= 1) { live.delete(id); continue; } const mv = MOVES[d.move]; clip = mv[0]; time = mv[1] + (t - d.hitAt) * rate; alpha = 1 - ease((k - .2) / .8); light = 1.15; scale = 1 + .08 * Math.sin(Math.min(1, k * 2) * Math.PI); spotLevel[d.lane] = Math.max(spotLevel[d.lane], 1 - k); }
    else if (d.missAt != null || n.state === 'miss') { if (d.missAt == null) d.missAt = t; const k = (t - d.missAt) / MISS_OUT; if (k >= 1) { live.delete(id); continue; } alpha = .8 * (1 - k); light = .45; tilt = .35 * ease(k) * (n.lane % 2 ? 1 : -1); time = t; }
    else if (n.state === 'pending') { const u = ease((t - (n.targetTime - LEAD)) / LEAD); alpha = .35 + .65 * u; light = .35 + .8 * Math.max(0, 1 - Math.abs(t - n.targetTime) / .12) * .9 + .25 * u; time = t; spotLevel[d.lane] = Math.max(spotLevel[d.lane], .18 + .5 * u + (Math.abs(t - n.targetTime) < .1 ? .4 : 0)); }
    else { live.delete(id); continue; }
    list.push({ lane: d.lane, alpha, light, clip, time, scale, tilt, lit: d.hitAt != null ? 1 - (t - d.hitAt) / danceLen : d.missAt != null ? 0 : Math.max(0, Math.min(1, .3 + .7 * Math.max(0, (t - (n.targetTime - LEAD)) / LEAD))) });
    targets.push({ lane: d.lane, level: d.hitAt != null ? .55 * alpha : d.missAt != null ? .15 * alpha : (.18 + .32 * Math.max(0, (t - (n.targetTime - LEAD)) / LEAD) + (Math.abs(t - n.targetTime) < .1 ? .2 : 0)) });
   }
   for (let i = 0; i < 9; i++) { const v = Math.min(1, spotLevel[i]); const s = spots[i]; const o = v.toFixed(2); if (s.style.opacity !== o) { s.style.opacity = o; s.style.setProperty('--spot-color', LANE_COLORS[i]); floors[i].style.setProperty('--lit', o); } }
   aimFixtures(t, targets);
   if (!ready || failed) return;
   const bw = board.clientWidth, bh = board.clientHeight, dpr = Math.min(root.devicePixelRatio || 1, 2), ch = bh * 936 / 2078; /* V1831 C 사용자: 흐림 → 휴대폰 선명도(최대 2배) */
   const w = Math.round(bw * dpr), h = Math.round(ch * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
   ctx2.clearRect(0, 0, w, h); if (!list.length) return;
   const cell = 300 / 952 * w; ensureSprites(cell);
   for (const m of list) {
    const sp = sprite(m.clip, m.time); if (!sp) continue;
    const cx = (26 + (m.lane % 3) * 300 + 150) / 952 * w, cy = (26 + Math.floor(m.lane / 3) * 300 + 150) / 952 * w, feet = FEET * cell, ox = -spriteW / 2, oy = -TOP * cell - feet;
    ctx2.save(); ctx2.translate(cx, cy + feet); if (m.tilt) ctx2.rotate(-m.tilt); if (m.scale !== 1) ctx2.scale(m.scale, m.scale);
    ctx2.globalAlpha = Math.max(0, Math.min(1, m.alpha * Math.min(1, m.light))); ctx2.drawImage(sp, ox, oy);
    // V1831 C 사용자: 조명이 비추면 두더지가 그 칸 색 빛으로 물듦(두더지 모양 안에만 색을 칠해 덧씌움)
    const glow = m.lit * m.alpha; if (glow > .02) { tintCtx.globalCompositeOperation = 'copy'; tintCtx.globalAlpha = 1; tintCtx.drawImage(sp, 0, 0); tintCtx.globalCompositeOperation = 'source-atop'; tintCtx.fillStyle = LANE_COLORS[m.lane]; tintCtx.fillRect(0, 0, spriteW, spriteH); ctx2.globalCompositeOperation = 'lighter'; ctx2.globalAlpha = Math.min(1, glow * .28); ctx2.drawImage(tintC, ox, oy); }
    if (m.light > 1) { ctx2.globalCompositeOperation = 'lighter'; ctx2.globalAlpha = Math.min(1, m.alpha * (m.light - 1) * .6); ctx2.drawImage(sp, ox, oy); }
    ctx2.restore();
   }
  }
  // V1830 C 사용자 FPS: 두더지를 매 화면 3D 로 새로 그리지 않음 — 휴대폰에서 같은 3D 로 장면마다 한 번만 그려 두고(초당 20장 분량) 붙여 씀
  // V1831 C: 휴대폰 선명도로 그리되 두더지 둘레 빈 공간은 잘라냄(가로 0.9칸 × 세로 0.95칸) — 메모리 절약
  const FPS_S = 20, FEET = .344, TOP = .5, CW = .9, CH = .95; let spriteW = 0, spriteH = 0, spriteCell = 0; const sprites = new Map(); let warmJobs = null;
  const tintC = document.createElement('canvas'), tintCtx = tintC.getContext('2d');
  function ensureSprites(cell) {
   const W = Math.round(cell * CW), H = Math.round(cell * CH); if (W === spriteW && H === spriteH) return; spriteW = W; spriteH = H; spriteCell = cell; sprites.clear(); glc.width = W; glc.height = H; tintC.width = W; tintC.height = H;
   warmJobs = []; for (let f = 0; f < 2 * FPS_S; f++) warmJobs.push(['Idle', f]); for (const [clip, start] of MOVES) { const f0 = Math.round(start * FPS_S); for (let f = f0; f <= f0 + Math.ceil(1.15 * FPS_S); f++) warmJobs.push([clip, f]); }
   (function step() { if (!warmJobs || !warmJobs.length) return; const deadline = performance.now() + 6; while (warmJobs.length && performance.now() < deadline) { const [c, fr] = warmJobs.shift(); makeSprite(c, fr); } if (warmJobs.length) setTimeout(step, 16); })();
  }  function frameOf(clip, time) { let fr = Math.round(time * FPS_S); if (clip === 'Idle') fr = ((fr % (2 * FPS_S)) + 2 * FPS_S) % (2 * FPS_S); return fr; }
  function sprite(clip, time) { const fr = frameOf(clip, time); return sprites.get(clip + '|' + fr) || makeSprite(clip, fr); }
  function makeSprite(clip, fr) {
   const key = clip + '|' + fr; let c = sprites.get(key); if (c) return c; const W = spriteW, H = spriteH; if (!W) return null;
   gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
   const P = R.identity(), ppu = spriteCell / 3.2; P[0] = 2 * ppu / W; P[5] = 2 * ppu / H; P[10] = -2 / 50; P[12] = 0; P[13] = 2 * (H - TOP * spriteCell) / H - 1; /* 몸 가운데 = 위에서 0.5칸 */
   gl.uniformMatrix4fv(U.VP, false, R.multiply(P, R.lookAt([0, 1.2, 8], [0, 1.1, 0])));
   const pose = cachedPose(clip, fr / FPS_S), inst = R.transform({ scale: [SIZE, SIZE, SIZE] });
   gl.uniform1f(U.Light, 1); gl.uniform1f(U.Alpha, 1); gl.uniform3fv(U.Tint, [0, 0, 0]); let lastNode = -1;
   for (const pt of parts) { gl.bindVertexArray(pt.vao); if (pt.node !== lastNode) { lastNode = pt.node; const e = pose.get(pt.node), mm = R.multiply(inst, e.world); gl.uniformMatrix4fv(U.Model, false, mm); gl.uniformMatrix3fv(U.Normal, false, R.normals(mm)); gl.uniform1i(U.Skin, !!e.pal); if (e.pal) gl.uniformMatrix4fv(U.Bones, false, e.pal); } gl.uniform4fv(U.Color, pt.color); gl.drawElements(gl.TRIANGLES, pt.count, gl.UNSIGNED_INT, 0); }
   c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(glc, 0, 0); sprites.set(key, c); return c;
  }  return { render, hit, miss, clear, loading, ready: () => ready };
 }
 MG.RhythmBDancers = { create };
})(window);
