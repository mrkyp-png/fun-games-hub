/* V1824 C 네온 새 방식(시험판, 주소에 ?neon2=1 일 때만): 위 판 9자리에 3D 두더지가 박자 0.5초 전 어둡게 나타나고,
   박자에 앞쪽 스포트가 비추며, 맞히면 춤추며 사라지고 놓치면 비틀거리며 사라짐. 판정·채보는 기존 그대로. */
(function (root) {
 'use strict';
 const MG = root.MoleGame = root.MoleGame || {};
 const LEAD = .5, MISS_OUT = .3, STYLE = 'spiky', COSTUME = 'hold-time', HAIR = [.80, .02, .02, 1];
 // 춤 조각: [클립, 시작 시각] — 0.45초 동안 2배 빠르게(0.9초 분량)
 const MOVES = [['DanceFreestyle', 1.0], ['DanceFreestyle', 6.0], ['DanceArmWave', 1.0], ['DanceHop', .5], ['DanceTwist', .5], ['DanceRobot', .5]]; // 시작 = 춤 박자 정수(클립 0.5초 = 1박)
 function create(board) {
  const canvas = document.createElement('canvas'); canvas.className = 'rb-dancers'; canvas.setAttribute('aria-hidden', 'true'); board.appendChild(canvas);
  const spots = Array.from({ length: 9 }, (_, lane) => { const el = document.createElement('i'); el.className = 'rb-dance-spot'; el.setAttribute('aria-hidden', 'true');
   el.style.left = ((26 + (lane % 3) * 300 + 150) / 952 * 100) + '%'; el.style.top = ((26 + Math.floor(lane / 3) * 300 + 150) / 2078 * 100) + '%'; board.appendChild(el); return el; });
  let gl = null, ready = false, R = null, AP = null, rig = null, parts = [], U = {}, A = {}, failed = false, lastMove = -1;
  const live = new Map(); // note id -> {n, lane, move, hitAt, grade, missAt}
  async function init() {
   R = root.StudioRig; AP = MG.MoleAppearances; const TM = MG.RhythmTypeMole;
   if (!R || !AP || !TM) throw Error('3D runtime missing');
   gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true }); if (!gl) throw Error('WebGL2 unavailable');
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
   gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); ready = true;
  }
  const loading = init().catch(e => { failed = true; console.warn('Neon dancers unavailable', e); });
  const LANE_COLORS = ['#3d7bff', '#ff3048', '#ffd21a', '#2be35a', '#a43bff', '#ff2d9a', '#ff8a1c', '#21d6ff', '#c2683a'];
  const hex = c => { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  function pickMove(n) { if (n.danceMove != null) return n.danceMove; let m = Math.floor(Math.random() * MOVES.length); if (m === lastMove) m = (m + 1) % MOVES.length; lastMove = m; return m; }
  function track(n) { if (!live.has(n.id)) live.set(n.id, { n, lane: n.lane, move: -1 }); return live.get(n.id); }
  // 같은 박자 동시 노트는 같은 춤(단체 춤)
  const chordMoves = new Map();
  function hit(n, grade, t) { const d = track(n); d.hitAt = t; d.grade = grade; const key = n.targetTime.toFixed(3); if (!chordMoves.has(key)) chordMoves.set(key, pickMove(n)); d.move = chordMoves.get(key); }
  function miss(n, t) { const d = track(n); d.missAt = t; }
  function clear() { live.clear(); chordMoves.clear(); spots.forEach(s => { s.style.opacity = '0'; }); if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); } }
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  // 매 프레임: 다가오는 노트(박자 0.5초 전부터)·춤추는 노트를 그림
  // V1824 C 사용자: 춤 빠르기를 곡 박자에 맞춤 — 맞힌 뒤 1박 동안 춤 2박 분량을 재생(튕기는 순간이 박자에 떨어짐)
  function render(t, notes, renderCursor, bpm) {
   const beat = 60 / (bpm || 120), danceLen = Math.max(.32, Math.min(.55, beat)), rate = 1 / beat;
   for (let id = renderCursor; id < notes.length; id++) { const n = notes[id]; if (n.targetTime - LEAD > t) break; if (n.state === 'pending') track(n); }
   const spotLevel = new Float32Array(9);
   const list = [];
   for (const [id, d] of live) {
    const n = d.n; let alpha, light, clip = 'Idle', time = 0, scale = 1, tilt = 0;
    if (d.hitAt != null) { const k = (t - d.hitAt) / danceLen; if (k >= 1) { live.delete(id); continue; } const mv = MOVES[d.move]; clip = mv[0]; time = mv[1] + (t - d.hitAt) * rate; alpha = 1 - ease((k - .2) / .8); light = 1.15; scale = 1 + .08 * Math.sin(Math.min(1, k * 2) * Math.PI); spotLevel[d.lane] = Math.max(spotLevel[d.lane], 1 - k); }
    else if (d.missAt != null || n.state === 'miss') { if (d.missAt == null) d.missAt = t; const k = (t - d.missAt) / MISS_OUT; if (k >= 1) { live.delete(id); continue; } alpha = .8 * (1 - k); light = .45; tilt = .35 * ease(k) * (n.lane % 2 ? 1 : -1); time = t; }
    else if (n.state === 'pending') { const u = ease((t - (n.targetTime - LEAD)) / LEAD); alpha = .35 + .65 * u; light = .35 + .8 * Math.max(0, 1 - Math.abs(t - n.targetTime) / .12) * .9 + .25 * u; time = t; spotLevel[d.lane] = Math.max(spotLevel[d.lane], .18 + .5 * u + (Math.abs(t - n.targetTime) < .1 ? .4 : 0)); }
    else { live.delete(id); continue; }
    list.push({ lane: d.lane, alpha, light, clip, time, scale, tilt });
   }
   for (let i = 0; i < 9; i++) { const v = Math.min(1, spotLevel[i]); const s = spots[i]; const o = v.toFixed(2); if (s.style.opacity !== o) { s.style.opacity = o; s.style.setProperty('--spot-color', LANE_COLORS[i]); } }
   if (!ready || failed) return;
   const bw = board.clientWidth, bh = board.clientHeight, dpr = Math.min(root.devicePixelRatio || 1, 2), ch = bh * 936 / 2078;
   const w = Math.round(bw * dpr), h = Math.round(ch * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
   gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); if (!list.length) return;
   const cell = 300 / 952 * w, cam = R.lookAt([0, 1.2, 8], [0, 1.1, 0]);
   for (const m of list) {
    const cx = (26 + (m.lane % 3) * 300 + 150) / 952 * w, cy = h - (26 + Math.floor(m.lane / 3) * 300 + 150) / 952 * w;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const P = R.identity(), ppu = cell / 3.2; P[0] = 2 * ppu / w; P[5] = 2 * ppu / h; P[10] = -2 / 50; P[12] = 2 * cx / w - 1; P[13] = 2 * cy / h - 1; /* 카메라 기준점(두더지 몸 가운데 높이)을 칸 가운데에 */
    gl.uniformMatrix4fv(U.VP, false, R.multiply(P, cam));
    const ws = AP.pose(rig, m.clip, m.time, true, null, m.time, STYLE), inst = R.multiply(R.transform({ rotation: [0, 0, Math.sin(m.tilt / 2), Math.cos(m.tilt / 2)] }), R.transform({ scale: [.78 * m.scale, .78 * m.scale, .78 * m.scale] }));
    gl.uniform1f(U.Light, m.light); gl.uniform1f(U.Alpha, m.alpha); gl.uniform3fv(U.Tint, hex(LANE_COLORS[m.lane]));
    for (const pt of parts) { gl.bindVertexArray(pt.vao); const mm = R.multiply(inst, ws[pt.node]), b = R.palette(rig, ws, pt.node); gl.uniformMatrix4fv(U.Model, false, mm); gl.uniformMatrix3fv(U.Normal, false, R.normals(mm)); gl.uniform4fv(U.Color, pt.color); gl.uniform1i(U.Skin, !!b); if (b) gl.uniformMatrix4fv(U.Bones, false, b); gl.drawElements(gl.TRIANGLES, pt.count, gl.UNSIGNED_INT, 0); }
   }
  }
  return { render, hit, miss, clear, loading, ready: () => ready };
 }
 MG.RhythmBDancers = { create };
})(window);
