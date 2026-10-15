// V 1025 G: 뼈대 정사각형 조정 + 아래 회로판 9개만 구성.
(function (root) {
  'use strict';
  function create(opts) {
    const board = opts.root.querySelector('.rb-board');
    const buttonXs = [[26, 326], [326, 626], [626, 926]];
    const buttonYs = [[1136, 1436], [1436, 1736], [1736, 2036]];
    const pressSurfaces = [];
    const pulseAnimations = Array(9).fill(null);
    const reboundAnimations = Array.from({length:9},()=>[]);
    let flowSurfaces=[];
    const miniSurfaces = [], shakes = Array(9).fill(null);
    function clearShakes() { shakes.forEach(animation => { if (animation) animation.cancel(); }); shakes.fill(null); }
    function shakeMini(lane) {
      if (root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (shakes[lane]) shakes[lane].cancel();
      const animation = miniSurfaces[lane].animate([
        { transform: 'translate3d(0,0,0)', offset: 0 },
        { transform: 'translate3d(-10px,3px,0)', offset: .2 },
        { transform: 'translate3d(8px,-2.5px,0)', offset: .45 },
        { transform: 'translate3d(-4px,1.2px,0)', offset: .7 },
        { transform: 'translate3d(0,0,0)', offset: 1 }
      ], { duration: 280, easing: 'ease-out' });
      shakes[lane] = animation;
      animation.onfinish = () => { if (shakes[lane] === animation) shakes[lane] = null; };
    }
    let flowFx = null;
    opts.root.addEventListener("contextmenu", e => e.preventDefault());
    opts.root.addEventListener("dragstart", e => e.preventDefault());
    let running = false, paused = false, play = null;
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 18; i++) {
      const index = i % 9, lower = i >= 9;
      const img = document.createElement('img');
      img.className = 'rb-circuit'; img.alt = '';
      if (!lower) { img.classList.add('rb-circuit--hologram'); img.style.filter = 'url(#rb-circuit-tint-' + index + ')'; }
      if (lower) { img.classList.add('rb-circuit--glass'); img.style.setProperty('--circuit-tint','url(#rb-circuit-tint-' + index + ')'); }
      img.src = lower ? 'assets/rhythm-b/circuit-rim.svg' : 'assets/rhythm-b/circuit-thin.svg';
      // V 1038 G: high-opacity straight body edges, excluding all four protrusions.
      // Source body [64,63,1228,1179] maps to an exact 244x244 square.
      const body = lower ? 268 : 244;
      const scaleX = body / 1164, scaleY = body / 1116;
      img.style.width = (1281 * scaleX / 952 * 100) + '%';
      img.style.height = (1228 * scaleY / 2078 * 100) + '%';
      const xBounds = buttonXs[index % 3], yBounds = buttonYs[Math.floor(index / 3)];
      const cx = lower ? (xBounds[0] + xBounds[1]) / 2 : 176 + (index % 3) * 300;
      const cy = lower ? (yBounds[0] + yBounds[1]) / 2 : 176 + Math.floor(index / 3) * 300;
      img.style.left = ((cx - (646 - 1281 / 2) * scaleX) / 952 * 100) + '%';
      img.style.top = ((cy - (621 - 1228 / 2) * scaleY) / 2078 * 100) + '%';
      board.appendChild(img);

    }
    const frame = document.createElement('img');
    frame.className = 'rb-skeleton'; frame.alt = '정사각형으로 조정한 원본 뼈대';
    frame.src = 'assets/rhythm-b/skeleton-uniform.png'; board.appendChild(frame);
    // V 1027 G: 확정된 뼈대/회로판 위에만 추가. 소형판 원본 파일은 분리하지 않는다.
    const colors = ['#086aff', '#ff1529', '#ffc400', '#05e52e', '#a500ff', '#ff0099', '#ff7900', '#00cfff', '#a65121'];
    const tintDefs = document.createElementNS(ns, 'svg');
    tintDefs.setAttribute('width', '0'); tintDefs.setAttribute('height', '0'); tintDefs.setAttribute('aria-hidden', 'true'); tintDefs.style.position = 'absolute';
    tintDefs.innerHTML = '<defs>' + colors.map((color, i) => {
      const rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16) / 255);
      return '<filter id="rb-circuit-tint-' + i + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' + rgb[0] + ' 0 0 0 0  0 ' + rgb[1] + ' 0 0 0  0 0 ' + rgb[2] + ' 0 0  0 0 0 1 0"/></filter>';
    }).join('') + '</defs>'; board.appendChild(tintDefs);
    function place(el, cx, cy, width, height = width) {
      el.style.left = ((cx - width / 2) / 952 * 100) + '%';
      el.style.top = ((cy - height / 2) / 2078 * 100) + '%';
      el.style.width = (width / 952 * 100) + '%';
      el.style.height = (height / 2078 * 100) + '%';
      board.appendChild(el);
    }
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3), cx = 176 + col * 300;
      const color = document.createElement('div'); color.className = 'rb-color';
      color.classList.add('rb-color--glass');
      color.style.backgroundColor = colors[i];
      // V 1028 G: 넓은 메탈 면의 실제 안쪽 경계까지 채움. 모든 하단 요소가 같은 중심 사용.
      const xb = buttonXs[col], yb = buttonYs[row];
      const buttonCx = (xb[0] + xb[1]) / 2, buttonCy = (yb[0] + yb[1]) / 2;
      const buttonWidth = xb[1] - xb[0], buttonHeight = yb[1] - yb[0];
      // 캡처의 빨간 칸 경계처럼 300px 칸 전체를 메탈 아래까지 덮는다.
      place(color, buttonCx, buttonCy, 304, 304);
      // 원본 뼈대 안쪽 실선 픽셀만 색 입힘. 별도 외곽선 생성 없음.
      const glow = document.createElement('img'); glow.className = 'rb-button-glow'; glow.alt = '';
      glow.src = 'assets/rhythm-b/uniform-inner-line-' + i + '.png';
      glow.style.setProperty('--button-color', colors[i]);
      place(glow, buttonCx, buttonCy, buttonWidth, buttonHeight);
      const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'rb-hit';
      hit.classList.add('rb-hit--glass');
      hit.style.setProperty('--glass-edge', colors[i] + 'b3');
      hit.style.setProperty('--glass-body', colors[i] + '26');
      hit.style.setProperty('--glass-soft', colors[i] + '12');
      hit.style.setProperty('--button-color', colors[i]);
      hit.setAttribute('aria-label', (i + 1) + '번 리듬 버튼');
      hit.innerHTML = '<span class="rb-press-face" aria-hidden="true"></span><span class="rb-circuit-pulse" aria-hidden="true"></span>';
      const pulse=hit.querySelector('.rb-circuit-pulse');
      place(hit, buttonCx, buttonCy, 304);
      const circuit = board.querySelectorAll(".rb-circuit--glass")[i];
      circuit.style.setProperty('--button-color', colors[i]);
      const reflection=document.createElement('div');reflection.className='rb-circuit-reflection';reflection.setAttribute('aria-hidden','true');reflection.style.cssText=circuit.style.cssText;reflection.style.setProperty('--button-color',colors[i]);reflection.innerHTML='<span class="rb-circuit-outward"></span>';board.appendChild(reflection);
      const lens=document.createElement('div');lens.className='rb-button-lens';lens.setAttribute('aria-hidden','true');lens.style.cssText=circuit.style.cssText;lens.style.setProperty('--glass-color',colors[i]);lens.style.setProperty('--glass-image','url("assets/rhythm-b/glass-lower-v1109/lower-'+i+'.png")');lens.innerHTML='<span class="rb-glass-dome"><span class="rb-glass-spin"></span></span>';board.appendChild(lens);
      const surfaces = [hit, color, circuit, reflection, lens]; pressSurfaces.push(...surfaces);
      function down() {
        if (!running || paused) return;
        reboundAnimations[i].forEach(a=>a.cancel());reboundAnimations[i]=[];
        surfaces.forEach(el => el.classList.add('is-pressed'));
        if(flowSurfaces[i])flowSurfaces[i].classList.add('is-pressed');
        if(pulseAnimations[i]) pulseAnimations[i].cancel();
        pulseAnimations[i]=pulse.animate([{transform:'scale(.08)',opacity:.7,offset:0},{transform:'scale(.28)',opacity:.7,offset:.18},{transform:'scale(1)',opacity:.455,offset:.7},{transform:'scale(1.35)',opacity:0,offset:1}],{duration:480,easing:'ease-out'});
        if (play) play.press(i);
      }
      function up() {
        if(!hit.classList.contains('is-pressed'))return;
        const moving=[circuit,reflection,lens,flowSurfaces[i]].filter(Boolean),from=moving.map(el=>getComputedStyle(el).transform);
        surfaces.forEach(el=>el.classList.remove('is-pressed'));if(flowSurfaces[i])flowSurfaces[i].classList.remove('is-pressed');
        if(!root.matchMedia('(prefers-reduced-motion: reduce)').matches){reboundAnimations[i]=moving.map((el,j)=>el.animate([{transform:from[j],offset:0},{transform:(el!==flowSurfaces[i]?'translate(-50%, -50%) ':'')+'scale(1.01)',offset:.65},{transform:el!==flowSurfaces[i]?'translate(-50%, -50%) scale(1)':'none',offset:1}],{duration:160,easing:'ease-out'}));}
      }
      hit.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        down(); hit.setPointerCapture(e.pointerId);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(type => hit.addEventListener(type, up));
      hit.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) down(); } });
      hit.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); up(); } });
      const mini = document.createElement('div'); mini.className = 'rb-mini';
      mini.style.setProperty('--holo-color', colors[i]);
      mini.setAttribute('aria-label', (i + 1) + '번 게임보드');
      // V 1029 G: 사용자가 테두리를 제거한 원본 그대로. 9분할/모서리 변형 없음.
      const sourceXs = [[110, 499], [579, 959], [1041, 1428]];
      // V 1039 G: all rows use a 302px source height; no first-row-only compression.
      const sourceYs = [[36, 338], [358, 660], [687, 989]];
      const sx = sourceXs[col][0], sy = sourceYs[row][0];
      const sw = sourceXs[col][1] - sx, sh = sourceYs[row][1] - sy;
      const focusX = [303, 767, 1234][col], focusY = [215, 539, 866][row];
      mini.style.setProperty('--depth-x', ((focusX - sx) / sw * 100) + '%');
      mini.style.setProperty('--depth-y', ((focusY - sy) / sh * 100) + '%');
      mini.style.backgroundSize = (1536 / sw * 100) + '% ' + (1024 / sh * 100) + '%';
      mini.style.backgroundPosition = (sx / (1536 - sw) * 100) + '% ' + (sy / (1024 - sh) * 100) + '%';
      // V 1030 G: 아래 버튼과 동일한 304 정사각형 한 장만 메탈 아래까지 채운다.
      // 안쪽 실선 기준 축소판/중복 이미지를 추가하지 않는다. 뼈대는 앞 레이어 유지.
      place(mini, 176 + col * 300, 176 + row * 300, 296);
      // V 1078 G: 9개 동일한 중심의 원형 포털.
      const fx=152,fy=152,radius=148;
      mini.style.setProperty('--depth-x','50%');mini.style.setProperty('--depth-y','50%');
      const points=Array.from({length:8},(_,k)=>{const angle=k*Math.PI/4;return [fx+radius*Math.cos(angle),fy+radius*Math.sin(angle)];});
      const tunnel=document.createElementNS(ns,'svg');tunnel.classList.add('rb-wire-tunnel');tunnel.setAttribute('viewBox','0 0 304 304');tunnel.setAttribute('aria-hidden','true');
      const rays=points.map(([x,y])=>'M'+x+','+y+' L'+fx+','+fy).join(' ');
      tunnel.innerHTML='<path d="'+rays+'" fill="none" stroke="currentColor" stroke-width=".9" opacity=".28"/>'+[1,.72,.48,.29,.15].map((scale,depth)=>'<circle class="'+(depth===0?'rb-portal-rim':'')+'" cx="152" cy="152" r="'+(radius*scale)+'" fill="none" stroke="currentColor" stroke-width="1" opacity="'+(.55-depth*.09)+'"/>').join('');
      function circle(className,r){const el=document.createElementNS(ns,'circle');el.classList.add(className);el.setAttribute('cx',fx);el.setAttribute('cy',fy);el.setAttribute('r',r);return el;}
      const loop=circle('rb-wire-light',radius*.72);loop.setAttribute('pathLength','100');loop.style.setProperty('--wire-delay',(-i*.73)+'s');tunnel.appendChild(loop);
      const inward=document.createElementNS(ns,'path');inward.classList.add('rb-wire-light','rb-wire-light--inward');const start=points[(i*3)%8];inward.setAttribute('d','M'+start[0]+','+start[1]+' L'+fx+','+fy);inward.setAttribute('pathLength','100');inward.style.setProperty('--wire-delay',(-i*.91)+'s');tunnel.appendChild(inward);
      for(let depth=0;depth<3;depth++){const section=circle('rb-space-section',radius);section.dataset.focusX=fx;section.dataset.focusY=fy;tunnel.appendChild(section);}
      const wave=circle('rb-space-hit-wave',radius);wave.style.transformOrigin=fx+'px '+fy+'px';tunnel.appendChild(wave);
      mini.appendChild(tunnel);
      miniSurfaces.push(mini);
    }
    const upperGlow = document.createElement('img'); upperGlow.className = 'rb-upper-glow'; upperGlow.alt = ''; upperGlow.src = 'assets/rhythm-b/upper-uniform-glow.png'; board.appendChild(upperGlow);
    for(const y of [936,1118]){const line=document.createElement('div');line.className='rb-zone-divider';line.setAttribute('aria-hidden','true');line.style.top=(y/2078*100)+'%';board.appendChild(line);}
    const score = document.createElement('div'); score.className = 'rb-status rb-status--score';
    score.innerHTML = '<small>SCORE</small><b data-rb-score>000000</b>'; place(score, 176, 991, 248, 90);
    const judge = document.createElement('div'); judge.className = 'rb-status rb-status--judge';
    judge.innerHTML = '<small>JUDGEMENT</small><b data-rb-judge>READY</b>'; place(judge, 476, 991, 248, 90);
    const combo = document.createElement('div'); combo.className = 'rb-status rb-status--combo';
    combo.innerHTML = '<small>COMBO</small><b data-rb-combo>0</b>'; place(combo, 744, 991, 144, 90);
    const pauseButton = document.createElement('button'); pauseButton.type = 'button';
    pauseButton.className = 'rb-pause-button rb-pause-button--a'; pauseButton.setAttribute('aria-label', '일시정지');
    pauseButton.innerHTML = '<span class="rb-pause-face" aria-hidden="true">II</span>';
    pauseButton.addEventListener('click', () => opts.onPause());
    place(pauseButton, 876, 991, 86, 86);
    function releaseAll() { pressSurfaces.forEach(el => el.classList.remove('is-pressed')); clearShakes(); pulseAnimations.forEach(a=>{if(a)a.cancel();}); pulseAnimations.fill(null); reboundAnimations.forEach(list=>{list.forEach(a=>a.cancel());list.length=0;}); }
    flowFx = root.MoleGame.RhythmBFlow.create({ board, colors });
    flowSurfaces=Array.from(board.querySelectorAll('.rb-flow-canvas'));pressSurfaces.push(...flowSurfaces);
    let artReady = null;
    const artImages = [];
    function prepareAssets() {
      if (artReady) return artReady;
      const urls = new Set(Array.from(board.querySelectorAll('img'), img => img.src));
      ['mini-user.png', 'pause-options.png', 'character/run-strip.png', ...colors.map((_, i) => 'note-inner-line-' + i + '.png'), ...colors.map((_,i)=>'glass-lower-v1109/lower-'+i+'.png')].forEach(name => urls.add('assets/rhythm-b/' + name));
      artReady = Promise.all(Array.from(urls, src => new Promise((resolve, reject) => {
        const img = new Image(); artImages.push(img);
        img.onload = () => img.decode().then(resolve, reject);
        img.onerror = () => reject(new Error('B image failed: ' + src));
        img.src = src;
      }))).catch(error => { artReady = null; artImages.length = 0; throw error; });
      return artReady;
    }
    play = root.MoleGame.RhythmBPlay.create({
      root: opts.root, board, rules: opts.rules, loadSong: opts.loadSong, prepareAssets,
      onHit: shakeMini,
      onFinish: (stats, clear) => {
        running = false; board.classList.remove('rb-wire-running'); releaseAll();
        flowFx.stop();
        opts.onResult(stats, clear);
      }
    });
    return {
      open(difficulty, options) {
        running = true; board.classList.add('rb-wire-running'); paused = false; board.classList.remove('is-paused'); releaseAll();
        flowFx.start();
        return play.start(difficulty || 'EASY', options);
      },
      stop() {
        running = false; board.classList.remove('rb-wire-running'); paused = false; releaseAll(); play.stop();
        flowFx.stop();
      },
      dbg() { return play.dbg(); },
      flowDebug() { return flowFx.dbg(); },
      pause(on) {
        paused = on; play.pause(on); board.classList.toggle('is-paused', on); releaseAll();
        flowFx.pause(on);
      }
    };
  }
  root.MoleGame = root.MoleGame || {}; root.MoleGame.RhythmB = { create };
})(window);
