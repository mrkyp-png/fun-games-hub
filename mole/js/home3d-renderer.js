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

  // ---------- WebGL ----------
  const VS = `#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aNormal;in vec4 aColor;in vec4 aJoints;in vec4 aWeights;in vec2 aUV;
uniform mat4 uVP,uModel,uBones[44];uniform mat3 uNormal;uniform bool uSkin;
out vec3 vWorld,vNormal;out vec4 vColor;out vec2 vUV;
void main(){mat4 skin=mat4(1.);if(uSkin)skin=uBones[int(aJoints.x)]*aWeights.x+uBones[int(aJoints.y)]*aWeights.y+uBones[int(aJoints.z)]*aWeights.z+uBones[int(aJoints.w)]*aWeights.w;vec4 p=uModel*skin*vec4(aPosition,1.);vWorld=p.xyz;vNormal=normalize(uNormal*mat3(skin)*aNormal);vColor=aColor;vUV=aUV;gl_Position=uVP*p;}`;
  const FS = `#version 300 es
precision highp float;
in vec3 vWorld,vNormal;in vec4 vColor;in vec2 vUV;uniform vec4 uColor;uniform bool uFloor,uSign;uniform sampler2D uTex;uniform vec3 uEye;uniform vec2 uPlayer;out vec4 frag;
void main(){vec3 n=normalize(vNormal),base=uColor.rgb*vColor.rgb;float shadow=1.;
if(uSign){if(dot(n,uEye-vWorld)<0.)discard;vec3 c=texture(uTex,vUV).rgb;float k=max(0.,(dot(n,normalize(vec3(-.6,1.,.7)))+.4)/1.4);frag=vec4(c*(.86+.14*k),1.);return;}if(uFloor){float tile=mod(floor(vWorld.x/1.5)+floor(vWorld.z/1.5),2.);base=mix(vec3(.78,.72,.61),vec3(.31,.30,.28),tile);vec2 d=(vWorld.xz-uPlayer)/vec2(.67,.48);shadow=1.-.34*exp(-dot(d,d)*1.8);}float key=max(0.,(dot(n,normalize(vec3(-.6,1.,.7)))+.4)/1.4);float fill=max(0.,dot(n,normalize(vec3(.8,.4,-.5))));vec3 lit=base*(vec3(.39,.40,.43)+key*.62+fill*vec3(.08,.10,.13));vec3 h=normalize(normalize(uEye-vWorld)+normalize(vec3(-.6,1.,.7)));lit+=vec3(.04)*pow(max(0.,dot(n,h)),14.);lit*=shadow;float fog=smoothstep(20.,46.,length(uEye-vWorld));frag=vec4(mix(pow(clamp(lit,0.,1.),vec3(1./2.2)),vec3(.73,.82,.88),fog),uColor.a*vColor.a);}`;

  function create(canvas) {
    let gl, program, U, A, environment = [], actor = [], rig = null, vp = null, signs = null;
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
      U = {}; for (const k of ['VP', 'Model', 'Bones', 'Normal', 'Skin', 'Color', 'Floor', 'Sign', 'Tex', 'Eye', 'Player']) U[k] = gl.getUniformLocation(program, 'u' + k);
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
      return { vao, count, indexed, color, floor: material.name === 'Hub checker floor' };
    }
    function draw(m, world, bones) {
      gl.bindVertexArray(m.vao);
      gl.uniformMatrix4fv(U.Model, false, world); gl.uniformMatrix3fv(U.Normal, false, R.normals(world));
      gl.uniform1i(U.Skin, !!bones); if (bones) gl.uniformMatrix4fv(U.Bones, false, bones);
      gl.uniform1i(U.Floor, m.floor); gl.uniform4fv(U.Color, m.color);
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
        rig = R.prepare(mole); actor = [];
        mole.json.nodes.forEach((n, node) => { // 일반 홈 = Mole_Clay_Skin 만(Carrier/CarryBomb 렌더 금지)
          if (n.name !== 'Mole_Clay_Skin' || n.mesh === undefined) return;
          for (const p of mole.json.meshes[n.mesh].primitives) actor.push(Object.assign(mesh(mole, p), { node }));
        });
        if (!actor.length) throw Error('Mole skin missing');
      },
      // 한 프레임 그리기. view={x,z,heading,yaw,pitch}, pose={clip, t, loop, y}(y=두더지 높이)
      render(view, pose) {
        const b = canvas.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 1.5);
        const w = Math.max(1, Math.round(b.width * dpr)), h = Math.max(1, Math.round(b.height * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        const cam = camera(view, w, h); vp = cam.vp;
        gl.clearColor(0.73, 0.82, 0.88, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program); gl.uniformMatrix4fv(U.VP, false, vp); gl.uniform3fv(U.Eye, cam.eye); gl.uniform2f(U.Player, view.x, view.z);
        for (const m of environment) draw(m, m.world, null);
        const worlds = R.pose(rig, pose.clip, pose.t, pose.loop);
        const inst = R.transform({ translation: [view.x, pose.y || 0, view.z], rotation: [0, Math.sin(view.heading / 2), 0, Math.cos(view.heading / 2)], scale: [0.65, 0.65, 0.65] });
        for (const m of actor) draw(m, R.multiply(inst, worlds[m.node]), R.palette(rig, worlds, m.node));
      },
      // 언어 변경 때만 호출(렌더 루프에서 부르지 않음)
      buildSigns(lang, sites, t) { if (signs) signs.build(lang, sites, t); },
      vp: () => vp,
      lost(cb) { canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cb(); }); }
    };
  }

  const api = { create, camera, project, rayFloor, pickSite };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
