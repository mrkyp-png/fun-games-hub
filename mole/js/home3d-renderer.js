/* 3D 홈 렌더러(WebGL2). 초안 round-entry-preview.js 의 그리기 코드를 옮겨 온 것.
   입력·이동은 home3d.js, 조작 UI 는 home3d-ui.js. */
(function (root) {
  'use strict';
  const R = root.StudioRig;

  // ---------- 순수 계산(검사 가능) ----------
  function camera(view, w, h) {
    const dist = w < h ? 7.5 : 6.5, focus = [view.x, 1.35, view.z];
    const eye = [focus[0] + Math.sin(view.yaw) * Math.cos(view.pitch) * dist, focus[1] + Math.sin(view.pitch) * dist,
      focus[2] + Math.cos(view.yaw) * Math.cos(view.pitch) * dist];
    return { eye, focus, vp: R.multiply(R.perspective(Math.PI / 3, w / h, 0.15, 80), R.lookAt(eye, focus)) };
  }
  function project(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return w <= 0 ? null : [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w];
  }
  // 화면 점(NDC) → 바닥(y=0) 위 점
  function rayFloor(inverse, x, y) {
    function at(z) { const p = [x, y, z, 1], r = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r[i] += inverse[j * 4 + i] * p[j]; return r.slice(0, 3).map((v) => v / r[3]); }
    const a = at(-1), b = at(1), dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-7) return null;
    const t = -a[1] / dy;
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

  // 해: 10분(600초)에 하늘을 한 바퀴, 높이 25~45° — 항상 낮(노을·밤 없음)
  const SUN_PERIOD = 600;
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
  // 구름 위치: 천천히 한쪽으로 흘러가고(초당 0.25) 섬 너머로 가면 반대편에서 다시
  const CLOUDS = [[-22, 8, -24, 1.6], [10, 9, -27, 1.3], [26, 7.5, -6, 1.45], [-24, 8.5, 14, 1.2], [8, 9.5, 26, 1.5]]; // 섬 둘레 하늘(수평선 위로 보이게)
  function cloudPos(i, t) {
    const c = CLOUDS[i], span = 64, x = ((c[0] + t * 0.25 + span / 2) % span + span) % span - span / 2;
    return [x, c[1] + Math.sin(t * 0.2 + i) * 0.25, c[2], c[3]];
  }

  // ---------- WebGL ----------
  const VS = `#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aNormal;in vec4 aColor;in vec4 aJoints;in vec4 aWeights;in vec2 aUV;
uniform mat4 uVP,uModel,uBones[44];uniform mat3 uNormal;uniform bool uSkin,uSea;uniform float uTime;
out vec3 vWorld,vNormal;out vec4 vColor;out vec2 vUV;
float seaH(vec2 p,float t){return .06*sin(.55*p.x+1.1*t)+.04*sin(.8*p.y-.9*t+1.3)+.02*sin(.37*(p.x+p.y)+1.7*t);}
void main(){mat4 skin=mat4(1.);if(uSkin)skin=uBones[int(aJoints.x)]*aWeights.x+uBones[int(aJoints.y)]*aWeights.y+uBones[int(aJoints.z)]*aWeights.z+uBones[int(aJoints.w)]*aWeights.w;vec4 p=uModel*skin*vec4(aPosition,1.);vWorld=p.xyz;vNormal=normalize(uNormal*mat3(skin)*aNormal);if(uSea){float e=.2;p.y+=seaH(p.xz,uTime);float hx=seaH(p.xz+vec2(e,0.),uTime)-seaH(p.xz-vec2(e,0.),uTime),hz=seaH(p.xz+vec2(0.,e),uTime)-seaH(p.xz-vec2(0.,e),uTime);vNormal=normalize(vec3(-hx/(2.*e),1.,-hz/(2.*e)));vWorld=p.xyz;}vColor=aColor;vUV=aUV;gl_Position=uVP*p;}`;
  const FS = `#version 300 es
precision highp float;
in vec3 vWorld,vNormal;in vec4 vColor;in vec2 vUV;uniform vec4 uColor;uniform bool uFloor,uSign,uSea,uShadowPass,uSunDisc,uCloud,uActor;uniform float uTime;uniform vec3 uSun;uniform mat4 uShadowVP;uniform sampler2D uShadowS,uShadowM;uniform sampler2D uTex;uniform vec3 uEye;uniform vec2 uPlayer;out vec4 frag;
float vis(sampler2D m,vec3 q){float v=0.;for(int i=-1;i<=1;i+=2)for(int j=-1;j<=1;j+=2){float d=texture(m,q.xy+vec2(i,j)*.0009).r;v+=q.z-.005>d?0.:1.;}return v*.25;}
void main(){if(uShadowPass){frag=vec4(1.);return;}if(uSunDisc){float rr=length(vUV-.5)*2.;if(rr>1.)discard;frag=vec4(mix(vec3(1.,.98,.88),vec3(1.,.92,.66),rr*rr),1.);return;}if(uCloud){vec3 cn=normalize(vNormal);float k=dot(cn,uSun)*.5+.5;vec3 c=mix(vec3(.80,.86,.94),vec3(1.,1.,.99),k)*mix(.9,1.,cn.y*.5+.5);float fog=smoothstep(40.,80.,length(uEye-vWorld));frag=vec4(mix(c,vec3(.73,.82,.88),fog*.6),1.);return;}vec3 n=normalize(vNormal),base=uColor.rgb*vColor.rgb;float shadow=1.;
if(uSea){vec2 p=vWorld.xz;float t=uTime;vec2 g=vec2(0.);const vec3 W[6]=vec3[6](vec3(.90,.42,.45),vec3(-.55,.83,.62),vec3(.20,-.98,.85),vec3(-.94,-.33,1.4),vec3(.70,.71,2.1),vec3(-.15,.99,3.0));for(int i=0;i<6;i++){vec2 dir=normalize(W[i].xy);float k=W[i].z,amp=.09/k;float ph=dot(dir,p)*k*1.3+t*sqrt(9.8*k)*.55+float(i)*1.7;g+=dir*cos(ph)*amp*k*1.3;}vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 V=normalize(uEye-vWorld),Ls=uSun;float d=min(length(p)-12.,length(p-vec2(0.,3.2))-13.6);vec3 deep=vec3(.06,.30,.52),shallow=vec3(.20,.66,.70),body=mix(shallow,deep,smoothstep(.5,9.,d));vec3 sky=mix(vec3(.70,.84,.94),vec3(.45,.66,.86),clamp(reflect(-V,n).y,0.,1.));float fres=.06+.94*pow(1.-max(0.,dot(n,V)),5.);vec3 c=mix(body,sky,fres);c+=vec3(1.,.97,.9)*pow(max(0.,dot(reflect(-Ls,n),V)),180.)*1.6;float foam=smoothstep(.9,0.,d)*(.6+.4*sin(d*6.-t*1.8+g.x*8.));c=mix(c,vec3(.96,.98,1.),clamp(foam,0.,1.)*.7);float fog=smoothstep(26.,62.,length(uEye-vWorld));frag=vec4(mix(clamp(c,0.,1.),vec3(.73,.82,.88),fog),1.);return;}
if(uSign){if(dot(n,uEye-vWorld)<0.)discard;vec3 c=texture(uTex,vUV).rgb;float k=max(0.,(dot(n,uSun)+.4)/1.4);frag=vec4(c*(.86+.14*k),1.);return;}if(uFloor){float tile=mod(floor(vWorld.x/1.5)+floor(vWorld.z/1.5),2.);base=mix(vec3(.78,.72,.61),vec3(.31,.30,.28),tile);}float key=max(0.,(dot(n,uSun)+.4)/1.4);float fill=max(0.,dot(n,normalize(vec3(.8,.4,-.5))));vec3 lit=base*(vec3(.39,.40,.43)+key*.62+fill*vec3(.08,.10,.13));vec3 h=normalize(normalize(uEye-vWorld)+uSun);lit+=vec3(.04)*pow(max(0.,dot(n,h)),14.);vec4 sp=uShadowVP*vec4(vWorld+n*.08,1.);vec3 q=sp.xyz/sp.w*.5+.5;if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.&&q.z<1.)shadow=uActor?vis(uShadowS,q):min(vis(uShadowS,q),vis(uShadowM,q));lit*=mix(.62,1.,shadow);float fog=smoothstep(20.,46.,length(uEye-vWorld));frag=vec4(mix(pow(clamp(lit,0.,1.),vec3(1./2.2)),vec3(.73,.82,.88),fog),uColor.a*vColor.a);}`;

  function create(canvas) {
    let gl, program, U, A, environment = [], actor = [], rig = null, vp = null, signs = null, size = null, seaMesh = null, shadowS = null, shadowM = null, sunQuad = null, clouds = [], staticAt = -9, staticVP = null;
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
      U = {}; for (const k of ['VP', 'Model', 'Bones', 'Normal', 'Skin', 'Color', 'Floor', 'Sign', 'Tex', 'Eye', 'Player', 'Sea', 'Time', 'Sun', 'ShadowVP', 'ShadowS', 'ShadowM', 'ShadowPass', 'SunDisc', 'Cloud', 'Actor']) U[k] = gl.getUniformLocation(program, 'u' + k);
      A = {}; for (const k of ['Position', 'Normal', 'Color', 'Joints', 'Weights', 'UV']) A[k] = gl.getAttribLocation(program, 'a' + k);
      gl.enable(gl.DEPTH_TEST);
      // 해 쪽에서 본 깊이 지도: 섬·건물(1초마다 1024) / 두더지·구름(매 프레임 512) — 저사양 대비
      const depthMap = (n) => {
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, n, n, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
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
    // 위치·법선만 있는 메시(구름 등)
    function rawMesh(positions, normals, indices, extra) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(A.Position); gl.vertexAttribPointer(A.Position, 3, gl.FLOAT, false, 0, 0);
      const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(A.Normal); gl.vertexAttribPointer(A.Normal, 3, gl.FLOAT, false, 0, 0);
      for (const [k, v] of [['Color', [1, 1, 1, 1]], ['Joints', [0, 0, 0, 0]], ['Weights', [0, 0, 0, 0]], ['UV', [0, 0, 0, 0]]]) if (A[k] >= 0) { gl.disableVertexAttribArray(A[k]); gl.vertexAttrib4f(A[k], ...v); }
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
      return { vao, count, indexed, color, floor: material.name === 'Hub checker floor', sea: material.name === 'Home sea' };
    }
    function draw(m, world, bones) {
      gl.bindVertexArray(m.vao);
      gl.uniformMatrix4fv(U.Model, false, world); gl.uniformMatrix3fv(U.Normal, false, R.normals(world));
      gl.uniform1i(U.Skin, !!bones); gl.uniform1i(U.Actor, !!bones); if (bones) gl.uniformMatrix4fv(U.Bones, false, bones);
      gl.uniform1i(U.Floor, m.floor); gl.uniform1i(U.Sea, !!m.sea); gl.uniform4fv(U.Color, m.color);
      const st = m.sign && signs && signs.get(m.sign);
      gl.uniform1i(U.Sign, !!st);
      if (st) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st); gl.uniform1i(U.Tex, 0); }
      if (m.indexed) gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); else gl.drawArrays(gl.TRIANGLES, 0, m.count);
    }
    async function load(url) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
      try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw Error(r.status + ' ' + url); return R.parseGLB(await r.arrayBuffer()); }
      finally { clearTimeout(timer); }
    }
    return {
      async boot(plazaUrl, moleUrl) {
        setup();
        const [plaza, mole] = await Promise.all([load(plazaUrl), load(moleUrl)]);
        // Sign_<action> 판 = 간판 글자 텍스처 자리
        environment = R.instances(plaza).map((i) => Object.assign(mesh(plaza, i.primitive), { world: i.world, sign: i.name.startsWith('Sign_') ? i.name.slice(5) : null }));
        signs = root.MoleGame.Home3DSigns.create(gl);
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
        rig = R.prepare(mole); actor = [];
        mole.json.nodes.forEach((n, node) => { // 일반 홈 = Mole_Clay_Skin 만(Carrier/CarryBomb 렌더 금지)
          if (n.name !== 'Mole_Clay_Skin' || n.mesh === undefined) return;
          for (const p of mole.json.meshes[n.mesh].primitives) actor.push(Object.assign(mesh(mole, p), { node }));
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
        gl.clearColor(0.73, 0.82, 0.88, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program); gl.uniformMatrix4fv(U.VP, false, vp); gl.uniform3fv(U.Eye, cam.eye); gl.uniform2f(U.Player, view.x, view.z);
        const now = performance.now() / 1000, sun = sunDir(now);
        gl.uniform1f(U.Time, now % 10000); gl.uniform3fv(U.Sun, sun);
        const worlds = R.pose(rig, pose.clip, pose.t, pose.loop);
        const inst = R.transform({ translation: [view.x, pose.y || 0, view.z], rotation: [0, Math.sin(view.heading / 2), 0, Math.cos(view.heading / 2)], scale: [0.65, 0.65, 0.65] });
        const drawMole = () => { for (const m of actor) draw(m, R.multiply(inst, worlds[m.node]), R.palette(rig, worlds, m.node)); };
        const drawClouds = () => { clouds.forEach((m, i) => { const c = cloudPos(i, now); gl.uniform1i(U.Cloud, 1); draw(m, R.transform({ translation: [c[0], c[1], c[2]], scale: [c[3], c[3], c[3]] }), null); gl.uniform1i(U.Cloud, 0); }); };
        // 그림자: 해 쪽에서 섬 전체(반지름 16)를 내려다보는 직교 카메라. 섬·건물은 1초마다, 두더지·구름은 매 프레임
        if (now - staticAt > 1 || !staticVP) {
          staticAt = now;
          staticVP = R.multiply(ortho(-17, 17, -17, 17, 1, 80), R.lookAt([sun[0] * 40, sun[1] * 40, sun[2] * 40], [0, 0, 0]));
          shadowPass(shadowS, staticVP, () => { for (const m of environment) if (!m.sign) draw(m, m.world, null); });
        }
        shadowPass(shadowM, staticVP, () => { drawMole(); drawClouds(); });
        gl.viewport(0, 0, w, h); gl.uniformMatrix4fv(U.VP, false, vp); gl.uniformMatrix4fv(U.ShadowVP, false, staticVP);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowS.tex); gl.uniform1i(U.ShadowS, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, shadowM.tex); gl.uniform1i(U.ShadowM, 2);
        gl.activeTexture(gl.TEXTURE0);
        for (const m of environment) draw(m, m.world, null);
        if (seaMesh) draw(seaMesh, R.identity(), null);
        drawMole(); drawClouds();
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
      // 언어 변경 때만 호출(렌더 루프에서 부르지 않음)
      buildSigns(lang, sites, t) { if (signs) signs.build(lang, sites, t); },
      vp: () => vp,
      size: () => size, // {cw,ch} = CSS 픽셀 크기(터치·버튼 위치 계산용)
      lost(cb) { canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cb(); }); }
    };
  }

  const api = { create, camera, project, rayFloor, pickSite, seaHeight, seaGrid, sunDir, SUN_PERIOD, cloudMesh, cloudPos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
