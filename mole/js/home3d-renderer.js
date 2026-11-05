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
in vec3 vWorld,vNormal;in vec4 vColor;in vec2 vUV;uniform vec4 uColor;uniform bool uFloor,uSign,uSea;uniform float uTime;uniform sampler2D uTex;uniform vec3 uEye;uniform vec2 uPlayer;out vec4 frag;
void main(){vec3 n=normalize(vNormal),base=uColor.rgb*vColor.rgb;float shadow=1.;
if(uSea){vec2 p=vWorld.xz;float t=uTime;vec2 g=vec2(0.);const vec3 W[6]=vec3[6](vec3(.90,.42,.45),vec3(-.55,.83,.62),vec3(.20,-.98,.85),vec3(-.94,-.33,1.4),vec3(.70,.71,2.1),vec3(-.15,.99,3.0));for(int i=0;i<6;i++){vec2 dir=normalize(W[i].xy);float k=W[i].z,amp=.09/k;float ph=dot(dir,p)*k*1.3+t*sqrt(9.8*k)*.55+float(i)*1.7;g+=dir*cos(ph)*amp*k*1.3;}vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 V=normalize(uEye-vWorld),Ls=normalize(vec3(-.6,1.,.7));float d=min(length(p)-12.,length(p-vec2(0.,3.2))-13.6);vec3 deep=vec3(.06,.30,.52),shallow=vec3(.20,.66,.70),body=mix(shallow,deep,smoothstep(.5,9.,d));vec3 sky=mix(vec3(.70,.84,.94),vec3(.45,.66,.86),clamp(reflect(-V,n).y,0.,1.));float fres=.06+.94*pow(1.-max(0.,dot(n,V)),5.);vec3 c=mix(body,sky,fres);c+=vec3(1.,.97,.9)*pow(max(0.,dot(reflect(-Ls,n),V)),180.)*1.6;float foam=smoothstep(.9,0.,d)*(.6+.4*sin(d*6.-t*1.8+g.x*8.));c=mix(c,vec3(.96,.98,1.),clamp(foam,0.,1.)*.7);float fog=smoothstep(26.,62.,length(uEye-vWorld));frag=vec4(mix(clamp(c,0.,1.),vec3(.73,.82,.88),fog),1.);return;}
if(uSign){if(dot(n,uEye-vWorld)<0.)discard;vec3 c=texture(uTex,vUV).rgb;float k=max(0.,(dot(n,normalize(vec3(-.6,1.,.7)))+.4)/1.4);frag=vec4(c*(.86+.14*k),1.);return;}if(uFloor){float tile=mod(floor(vWorld.x/1.5)+floor(vWorld.z/1.5),2.);base=mix(vec3(.78,.72,.61),vec3(.31,.30,.28),tile);vec2 d=(vWorld.xz-uPlayer)/vec2(.67,.48);shadow=1.-.34*exp(-dot(d,d)*1.8);}float key=max(0.,(dot(n,normalize(vec3(-.6,1.,.7)))+.4)/1.4);float fill=max(0.,dot(n,normalize(vec3(.8,.4,-.5))));vec3 lit=base*(vec3(.39,.40,.43)+key*.62+fill*vec3(.08,.10,.13));vec3 h=normalize(normalize(uEye-vWorld)+normalize(vec3(-.6,1.,.7)));lit+=vec3(.04)*pow(max(0.,dot(n,h)),14.);lit*=shadow;float fog=smoothstep(20.,46.,length(uEye-vWorld));frag=vec4(mix(pow(clamp(lit,0.,1.),vec3(1./2.2)),vec3(.73,.82,.88),fog),uColor.a*vColor.a);}`;

  function create(canvas) {
    let gl, program, U, A, environment = [], actor = [], rig = null, vp = null, signs = null, size = null, seaMesh = null;
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
      U = {}; for (const k of ['VP', 'Model', 'Bones', 'Normal', 'Skin', 'Color', 'Floor', 'Sign', 'Tex', 'Eye', 'Player', 'Sea', 'Time']) U[k] = gl.getUniformLocation(program, 'u' + k);
      A = {}; for (const k of ['Position', 'Normal', 'Color', 'Joints', 'Weights', 'UV']) A[k] = gl.getAttribLocation(program, 'a' + k);
      gl.enable(gl.DEPTH_TEST);
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
      gl.uniform1i(U.Skin, !!bones); if (bones) gl.uniformMatrix4fv(U.Bones, false, bones);
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
        gl.uniform1f(U.Time, performance.now() / 1000 % 10000);
        for (const m of environment) draw(m, m.world, null);
        if (seaMesh) draw(seaMesh, R.identity(), null);
        const worlds = R.pose(rig, pose.clip, pose.t, pose.loop);
        const inst = R.transform({ translation: [view.x, pose.y || 0, view.z], rotation: [0, Math.sin(view.heading / 2), 0, Math.cos(view.heading / 2)], scale: [0.65, 0.65, 0.65] });
        for (const m of actor) draw(m, R.multiply(inst, worlds[m.node]), R.palette(rig, worlds, m.node));
      },
      // 언어 변경 때만 호출(렌더 루프에서 부르지 않음)
      buildSigns(lang, sites, t) { if (signs) signs.build(lang, sites, t); },
      vp: () => vp,
      size: () => size, // {cw,ch} = CSS 픽셀 크기(터치·버튼 위치 계산용)
      lost(cb) { canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cb(); }); }
    };
  }

  const api = { create, camera, project, rayFloor, pickSite, seaHeight, seaGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
