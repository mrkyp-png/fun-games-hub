// V 1025 G: 뼈대 정사각형 조정 + 아래 회로판 9개만 구성.
(function (root) {
  'use strict';
  function create(opts) {
    const board = opts.root.querySelector('.rb-board');
    const buttonXs = [[26, 326], [326, 626], [626, 926]];
    const buttonYs = [[1136, 1436], [1436, 1736], [1736, 2036]];
    const pressSurfaces = [];
    const reducedMotion=root.matchMedia('(prefers-reduced-motion: reduce)');
    const movingSurfaces=[],releaseFrames=[];
    const pressWaveFrames=Array.from({length:9},()=>[{'--rb-press-wave-scale':'.08',opacity:.7,offset:0},{'--rb-press-wave-scale':'.28',opacity:.7,offset:.18},{'--rb-press-wave-scale':'1',opacity:.56,offset:.7},{'--rb-press-wave-scale':'1',opacity:.56,offset:.9},{'--rb-press-wave-scale':'1.35',opacity:0,offset:1}]);
    const pressWaveTiming={duration:480,easing:'ease-out'},releaseTiming={duration:160,easing:'ease-out'};
    const pulseAnimations = Array(9).fill(null);
    const spawnWaves=[],spawnCircles=[];
    const pressPulses=[],pulseLayers=[],pulseClips=[],pulseReach=Array(9).fill(1.35);
    if(root.CSS&&CSS.registerProperty){try{CSS.registerProperty({name:"--rb-press-wave-scale",syntax:"<number>",inherits:false,initialValue:"1"});}catch(e){}}
    function clearSpawnWaves(){spawnWaves.forEach(e=>e.hidden=true);}
    function spawnWave(lane){const e=spawnWaves[lane];if(e){spawnCircles[lane].setAttribute('r','1.8');e.hidden=false;}}
    function advanceSpawnWave(lane,u){const c=spawnCircles[lane];if(c)c.setAttribute('r',String(1.8+43.2*u));}
    function endSpawnWave(lane){if(spawnWaves[lane])spawnWaves[lane].hidden=true;}
    const reboundAnimations = Array.from({length:9},()=>[]);
    let flowSurfaces=[];
    const miniSurfaces = [], shakes = Array(9).fill(null);
    function clearShakes() { shakes.forEach(animation => { if (animation) animation.cancel(); }); shakes.fill(null); }
    function shakeMini(lane) {
      if (reducedMotion.matches) return;
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
    let flowFx = null,rippleFx=null,laserFx=null;
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
      const pulse=hit.querySelector('.rb-circuit-pulse');pressPulses.push(pulse);
      place(hit, buttonCx, buttonCy, 304);
      const circuit = board.querySelectorAll(".rb-circuit--glass")[i];
      circuit.style.setProperty('--button-color', colors[i]);
      const reflection=document.createElement('div');reflection.className='rb-circuit-reflection';reflection.setAttribute('aria-hidden','true');reflection.style.cssText=circuit.style.cssText;reflection.style.setProperty('--button-color',colors[i]);reflection.innerHTML='<span class="rb-circuit-outward"></span>';board.appendChild(reflection);
      const lens=document.createElement('div');lens.className='rb-button-lens';lens.setAttribute('aria-hidden','true');lens.style.cssText=circuit.style.cssText;lens.style.setProperty('--glass-color',colors[i]);lens.style.setProperty('--glass-image','url("assets/rhythm-b/glass-lower-v1109/lower-'+i+'.png")');lens.innerHTML='<span class="rb-glass-dome"><span class="rb-glass-spin"></span></span>';board.appendChild(lens);
      const floor=document.createElement('img');floor.className='rb-button-floor-press';floor.alt='';floor.src='assets/rhythm-b/button-base-v1118/press-'+i+'.svg';place(floor,buttonCx,buttonCy+16,296,320);
      const base=document.createElement('img');base.className='rb-button-base';base.alt='';base.src='assets/rhythm-b/button-base-v1118/base-'+i+'.svg';place(base,buttonCx,buttonCy+16,296,320);
      const cap=document.createElement('img');cap.className='rb-button-cap';cap.alt='';cap.src='assets/rhythm-b/button-face-v1124/face-'+i+'.svg';place(cap,buttonCx,buttonCy,268);
      const core=document.createElement('img');core.className='rb-button-core';core.alt='';core.src='assets/rhythm-b/upper-core-v1124/core-'+i+'.svg';place(core,buttonCx,buttonCy,268);
      hit.addEventListener('focus',()=>core.classList.toggle('is-key-focused',hit.matches(':focus-visible')));hit.addEventListener('blur',()=>core.classList.remove('is-key-focused'));
      const spawnRing=document.createElement('span');spawnRing.className='rb-spawn-ripple';spawnRing.hidden=true;spawnRing.setAttribute('aria-hidden','true');spawnRing.style.setProperty('--button-color',colors[i]);spawnRing.innerHTML='<svg viewBox="0 0 94 94" aria-hidden="true"><circle cx="47" cy="47" r="0" fill="none" stroke="'+colors[i]+'" stroke-width="4"/></svg>';place(spawnRing,buttonCx-.5,buttonCy,94);spawnWaves.push(spawnRing);spawnCircles.push(spawnRing.querySelector('circle'));
      const surfaces = [hit, color, circuit, reflection, lens, cap, floor, core, base]; pressSurfaces.push(...surfaces);
      const moving=[circuit,reflection,lens,cap],from=Array(5).fill('');movingSurfaces.push(moving);
      function down() {
        if (!running || paused) return;
        fitPressPulses();
        reboundAnimations[i].forEach(a=>a.cancel());reboundAnimations[i].length=0;
        cap.src='assets/rhythm-b/button-face-v1120/face-'+i+'.svg';
        surfaces.forEach(el => el.classList.add('is-pressed'));if(flowFx)flowFx.press(i,true);
        if(flowSurfaces[i])flowSurfaces[i].classList.add('is-pressed');
        if(pulseAnimations[i]) pulseAnimations[i].cancel();
        pulseAnimations[i]=pulse.animate(pressWaveFrames[i],pressWaveTiming);
        if (play) {const occupied=play.hasCharacter(i),grade=play.press(i);if(grade!==undefined&&laserFx)laserFx.emit(i,occupied);}
      }
      function up() {
        if(!hit.classList.contains('is-pressed'))return;
        for(let j=0;j<moving.length;j++)from[j]=getComputedStyle(moving[j]).transform;
        cap.src='assets/rhythm-b/button-face-v1124/face-'+i+'.svg';if(flowFx)flowFx.press(i,false);
        surfaces.forEach(el=>el.classList.remove('is-pressed'));if(flowSurfaces[i])flowSurfaces[i].classList.remove('is-pressed');
        if(!reducedMotion.matches){const animations=reboundAnimations[i];animations.length=0;for(let j=0;j<moving.length;j++){releaseFrames[i][j][0].transform=from[j];animations.push(moving[j].animate(releaseFrames[i][j],releaseTiming));}}
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
      tunnel.innerHTML='<circle class="rb-portal-rim" cx="151.48648648648648" cy="152" r="148" fill="none" stroke="currentColor" stroke-width="1"/><circle class="rb-portal-rim-inner" cx="151.48648648648648" cy="152" r="144.40540540540542" fill="none" stroke="currentColor" stroke-width="1.5405405405405406"/>';
      mini.appendChild(tunnel);
      const glassGroup=document.createElementNS(ns,'g');glassGroup.classList.add('rb-glass-grow');
      const coreRatio=304/296,cxCore=151.48648648648648,cyCore=152;
      glassGroup.innerHTML='<circle cx="'+cxCore+'" cy="'+cyCore+'" r="'+(45*coreRatio)+'" fill="#010205" stroke="'+colors[i]+'" data-stroke="4" vector-effect="non-scaling-stroke"/><circle cx="'+cxCore+'" cy="'+cyCore+'" r="'+(41.5*coreRatio)+'" fill="none" stroke="'+colors[i]+'" stroke-opacity=".25" data-stroke="1.5" vector-effect="non-scaling-stroke"/><image href="assets/rhythm-b/glass-lower-v1109/lower-'+i+'.png" x="'+(cxCore-40.402*coreRatio)+'" y="'+(cyCore-43.202*coreRatio)+'" width="'+(80.804*coreRatio)+'" height="'+(86.404*coreRatio)+'" preserveAspectRatio="none"/>';
      tunnel.appendChild(glassGroup);
      miniSurfaces.push(mini);
    }
    // V 1150 G: move the original pulse span out of its clipped button. No second wave.
    const pulseDefs=document.createElementNS(ns,'svg');pulseDefs.setAttribute('width','0');pulseDefs.setAttribute('height','0');pulseDefs.setAttribute('aria-hidden','true');pulseDefs.style.position='absolute';
    const defs=document.createElementNS(ns,'defs');pulseDefs.appendChild(defs);opts.root.appendChild(pulseDefs);
    pressPulses.forEach((pulse,i)=>{const clip=document.createElementNS(ns,'clipPath');clip.id='rb-press-wave-clip-'+i;clip.setAttribute('clipPathUnits','userSpaceOnUse');const path=document.createElementNS(ns,'path');path.setAttribute('clip-rule','evenodd');clip.appendChild(path);defs.appendChild(clip);pulseClips.push(path);const layer=document.createElement('div');layer.className='rb-existing-pulse-layer';layer.setAttribute('aria-hidden','true');layer.style.clipPath='url(#'+clip.id+')';pulse.classList.add('rb-circuit-pulse--extended');pulse.style.setProperty('--button-color',colors[i]);layer.appendChild(pulse);opts.root.appendChild(layer);pulseLayers.push(layer);});
    function fitPressPulses(){
      const rb=opts.root.getBoundingClientRect(),bb=board.getBoundingClientRect(),unit=bb.width/952,lower=bb.top-rb.top+1136*unit;
      const left=12+24*(rb.width-24)/952,right=rb.width-left,bottom=rb.height-12-24*(rb.height-24)/2078;
      const cores=Array.from(board.querySelectorAll('.rb-button-core'),e=>{const b=e.getBoundingClientRect();return {x:b.left-rb.left+b.width*133.5/268,y:b.top-rb.top+b.height/2,r:b.width*48/268};});
      pressPulses.forEach((pulse,i)=>{const cx=cores[i].x,cy=cores[i].y,size=304*.9*unit;
        pulse.style.left=cx+'px';pulse.style.top=cy+'px';pulse.style.width=size+'px';pulse.style.height=size+'px';pulse.style.setProperty('--rb-wave-half-band',(1.5/(size/Math.SQRT2)*100)+'%');
        let d=`M${left} ${lower}H${right}V${bottom}H${left}Z`;
        // Preserve this button's original center flash; shield the other eight glass interiors.
        cores.forEach((c,j)=>{if(j!==i)d+=`M${c.x+c.r} ${c.y}A${c.r} ${c.r} 0 1 0 ${c.x-c.r} ${c.y}A${c.r} ${c.r} 0 1 0 ${c.x+c.r} ${c.y}Z`;});pulseClips[i].setAttribute('d',d);
        const reach=Math.max(...[[left,lower],[right,lower],[left,bottom],[right,bottom]].map(([x,y])=>Math.hypot(x-cx,y-cy)));pulseReach[i]=Math.max(1.35,reach/(size*.7/Math.SQRT2)*1.06);pressWaveFrames[i][3]['--rb-press-wave-scale']=String(1+(pulseReach[i]-1)*2/3);pressWaveFrames[i][4]['--rb-press-wave-scale']=String(pulseReach[i]);
      });
    }
    const pulseResize=new ResizeObserver(fitPressPulses);pulseResize.observe(opts.root);pulseResize.observe(board);fitPressPulses();
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
    place(pauseButton, 876, 1027, 86, 86);
    function releaseAll() { if(flowFx)for(let i=0;i<9;i++)flowFx.press(i,false);board.querySelectorAll('.rb-button-cap').forEach((el,i)=>{el.src='assets/rhythm-b/button-face-v1124/face-'+i+'.svg';});pressSurfaces.forEach(el => el.classList.remove('is-pressed')); clearShakes(); pulseAnimations.forEach(a=>{if(a)a.cancel();}); pulseAnimations.fill(null); reboundAnimations.forEach(list=>{list.forEach(a=>a.cancel());list.length=0;}); }
    flowFx = root.MoleGame.RhythmBFlow.create({ board, colors });
    rippleFx=root.MoleGame.RhythmBRipple.create({root:opts.root,board,colors});
    laserFx=root.MoleGame.RhythmBLaser.create({board,colors,hasCharacter:lane=>miniSurfaces[lane].classList.contains('is-note-active')});
    flowSurfaces=Array.from(board.querySelectorAll('.rb-flow-canvas'));pressSurfaces.push(...flowSurfaces);
    for(let i=0;i<9;i++){movingSurfaces[i].push(flowSurfaces[i]);releaseFrames.push(movingSurfaces[i].map((el,j)=>[{transform:'none',offset:0},{transform:(j<3?'translate(-50%, -50%) ':'')+'scale(1.01)',offset:.65},{transform:j<3?'translate(-50%, -50%) scale(1)':'none',offset:1}]));}
    function fitGlassStroke(){const ratio=board.querySelector('.rb-wire-tunnel').getBoundingClientRect().width/296;board.querySelectorAll('.rb-glass-grow circle').forEach(e=>e.setAttribute('stroke-width',Number(e.dataset.stroke)*ratio));}
    const glassResize=new ResizeObserver(fitGlassStroke);glassResize.observe(board);fitGlassStroke();
    let artReady = null;
    const artImages = [];
    function prepareAssets() {
      if (artReady) return artReady;
      const urls = new Set(Array.from(board.querySelectorAll('img'), img => img.src));
      [...colors.map((_,i)=>'button-face-v1120/face-'+i+'.svg'),'mini-user.png', 'pause-options.png', 'character/hoverboard-v1260/run-strip.png', ...colors.map((_, i) => 'note-inner-line-' + i + '.png'), ...colors.map((_,i)=>'glass-lower-v1109/lower-'+i+'.png')].forEach(name => urls.add('assets/rhythm-b/' + name));
      artReady = Promise.all(Array.from(urls, src => new Promise((resolve, reject) => {
        const img = new Image(); artImages.push(img);
        img.onload = () => img.decode().then(resolve, reject);
        img.onerror = () => reject(new Error('B image failed: ' + src));
        img.src = src;
      }))).catch(error => { artReady = null; artImages.length = 0; throw error; });
      return artReady;
    }
    play = root.MoleGame.RhythmBPlay.create({
      root: opts.root, board, rules: opts.rules, loadSong: opts.loadSong, prepareAssets, onEntryMusic: opts.onEntryMusic,
      onSong: opts.onSong, onTime: opts.onTime, onStop: opts.onStop, onComboColor: opts.onComboColor,
      onHit: shakeMini,
      onNoteSpawn: spawnWave,
      onNoteApproach: advanceSpawnWave,
      onNoteEnd: endSpawnWave,
      onFinish: (stats, clear) => {
        running = false; board.classList.remove('rb-wire-running'); releaseAll();
        flowFx.stop();rippleFx.stop();laserFx.stop();clearSpawnWaves();
        opts.onResult(stats, clear);
      }
    });
    return {
      prepare: prepareAssets,
      open(difficulty, options) {
        rippleFx.stop();laserFx.stop();clearSpawnWaves();running = true; board.classList.add('rb-wire-running'); paused = false; board.classList.remove('is-paused'); releaseAll();
        flowFx.start();rippleFx.prepare();
        return play.start(difficulty || 'EASY', options);
      },
      stop() {
        running = false; board.classList.remove('rb-wire-running'); paused = false; releaseAll(); play.stop();
        flowFx.stop();rippleFx.stop();laserFx.stop();clearSpawnWaves();
      },
      dbg() { return play.dbg(); },
      flowDebug() { return flowFx.dbg(); },
      rippleDebug(){return rippleFx.dbg();},
      laserDebug(){return laserFx.dbg();},
      pause(on) {
        paused = on; play.pause(on); board.classList.toggle('is-paused', on); releaseAll();
        flowFx.pause(on);rippleFx.pause(on);laserFx.pause(on);
      }
    };
  }
  root.MoleGame = root.MoleGame || {}; root.MoleGame.RhythmB = { create };
})(window);
