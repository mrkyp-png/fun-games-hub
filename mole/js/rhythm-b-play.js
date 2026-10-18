// V 1043 G: B test chart. Shared A song/rules; border reaches the native glow at targetTime.
(function (root) {
 'use strict';
 const MG=root.MoleGame;
 function create(opts) {
  const board=opts.board, hud=opts.root;
  // V1166: B-only 10% wider GREAT/GOOD windows; PERFECT and shared A rules stay intact.
  const diffs=Object.fromEntries(Object.entries(opts.rules.diffs).map(([key,value])=>[key,{...value,judge:{...value.judge,greatMs:value.judge.greatMs*121/100,goodMs:value.judge.goodMs*121/100}}]));
  const rules={...opts.rules,diffs,grade(ms,difficulty){const J=diffs[difficulty].judge;return ms<=J.perfectMs?'PERFECT':ms<=J.greatMs?'GREAT':ms<=J.goodMs?'GOOD':null;}};
  const reducedMotion=root.matchMedia('(prefers-reduced-motion: reduce)'),shadeSteps=[.9,.78,.62];
  let boardWidth=board.clientWidth;new ResizeObserver(()=>{boardWidth=board.clientWidth;}).observe(board);
  let state=null, context=null, sources=[], melodyGain=null, frame=0, generation=0;
  const progress=document.createElement('div');progress.className='rb-song-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','곡 진행도');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-valuenow','0');
  const perimeter=document.createElementNS('http://www.w3.org/2000/svg','svg');perimeter.setAttribute('viewBox','0 0 952 2078');perimeter.setAttribute('preserveAspectRatio','none');perimeter.setAttribute('aria-hidden','true');
  const perimeterRoutes=[12,24].map((inset,index)=>{const left=inset,right=952-inset,top=inset,bottom=2078-inset,r=68-inset;if(index===1)return 'M476 '+top+' H'+(left+r)+' Q'+left+' '+top+' '+left+' '+(top+r)+' V'+(bottom-r)+' Q'+left+' '+bottom+' '+(left+r)+' '+bottom+' H'+(right-r)+' Q'+right+' '+bottom+' '+right+' '+(bottom-r)+' V'+(top+r)+' Q'+right+' '+top+' '+(right-r)+' '+top+' H476';return 'M476 '+top+' H'+(right-r)+' Q'+right+' '+top+' '+right+' '+(top+r)+' V'+(bottom-r)+' Q'+right+' '+bottom+' '+(right-r)+' '+bottom+' H'+(left+r)+' Q'+left+' '+bottom+' '+left+' '+(bottom-r)+' V'+(top+r)+' Q'+left+' '+top+' '+(left+r)+' '+top+' H476';});
  perimeter.innerHTML=perimeterRoutes.map(d=>'<path class="rb-perimeter-track" d="'+d+'"/><path class="rb-perimeter-fill" pathLength="100" d="'+d+'"/>').join('');progress.appendChild(perimeter);hud.appendChild(progress);
  const progressLines=Array.from(perimeter.querySelectorAll('.rb-perimeter-fill'));let lastProgress=-1,lastPercent=-1;const progressOffsets=[NaN,NaN];
  // V 1146 G: dash calibration must use the same coordinates as non-scaling strokes.
  let perimeterWidth=0,perimeterHeight=0;
  function fitPerimeter(){const b=perimeter.getBoundingClientRect(),w=b.width,h=b.height;if(!w||!h||(w===perimeterWidth&&h===perimeterHeight))return;perimeterWidth=w;perimeterHeight=h;const sx=w/952,sy=h/2078;perimeter.setAttribute('viewBox','0 0 '+w+' '+h);perimeter.querySelectorAll('path').forEach((el,i)=>{const d=perimeterRoutes[Math.floor(i/2)].replace(/([MHVQ])([^MHVQ]*)/g,(_,cmd,coords)=>cmd+coords.trim().split(/[ ,]+/).map((v,k)=>Number(v)*(cmd==='H'?sx:cmd==='V'?sy:k%2?sy:sx)).join(' '));el.setAttribute('d',d);});}
  new ResizeObserver(fitPerimeter).observe(progress);fitPerimeter();

  function updateProgress(value){
   const ratio=Math.max(0,Math.min(1,value));
   // V 1131 G: traverse the two outlines consecutively across the whole song.
   // Opposing half-filled outlines must not look like a completed frame midway.
   if(ratio!==lastProgress){for(let i=0;i<progressLines.length;i++){const lineRatio=Math.max(0,Math.min(1,ratio*2-i));const offset=100-lineRatio*100;if(progressOffsets[i]!==offset){progressLines[i].style.strokeDashoffset=String(offset);progressOffsets[i]=offset;}}lastProgress=ratio;}
   const pct=Math.floor(ratio*100);if(pct!==lastPercent){progress.setAttribute('aria-valuenow',String(pct));lastPercent=pct;}
  }

  updateProgress(0);
  const comboPalette=['#00ffff','#0066ff','#8000ff','#ff00aa','#ffcc00'];
  const comboScreenBackground=document.createElement('div');comboScreenBackground.className='rb-combo-screen-background';hud.appendChild(comboScreenBackground);
  const comboScreenTones=comboPalette.map(color=>{const tone=document.createElement('div');tone.className='rb-combo-screen-tone';tone.style.backgroundColor=color;comboScreenBackground.appendChild(tone);return tone;});
  const comboBackground=document.createElement('div');comboBackground.className='rb-combo-background';board.appendChild(comboBackground);
  const comboLayers=comboPalette.map((color,stage)=>{const group=document.createElement('div');group.className='rb-combo-atmosphere';group.style.setProperty('--combo-color',color);group.dataset.theme=stage;group.innerHTML='<span class="rb-combo-region rb-combo-region--upper"></span><span class="rb-combo-region rb-combo-region--lower"></span>';comboBackground.appendChild(group);return group;});
  const comboSweeps=['upper','lower'].map(side=>{const el=document.createElement('div');el.className='rb-combo-sweep rb-combo-sweep--'+side;el.innerHTML='<span></span>';comboBackground.appendChild(el);return el;});
  let comboStage=0,comboSweepAnimations=[],comboPulse=null;
  function updateCombo(combo,immediate=false){const stage=Math.floor(combo/10);if(stage===comboStage&&!immediate)return;comboStage=stage;if(comboPulse){comboPulse.cancel();comboPulse=null;}if(stage&&!immediate&&combo%10===0)showPowerWord('combo',String(combo),comboPalette[(stage-1)%5]);board.dataset.comboStage=String(stage);const color=stage?comboPalette[(stage-1)%5]:'#00cfff';if(opts.onComboColor)opts.onComboColor(color);board.style.setProperty('--combo-accent',color);hud.style.setProperty('--combo-accent',color);hud.classList.toggle('rb-combo-energized',stage>=5);
   comboLayers.forEach((el,i)=>{el.style.transitionDuration=immediate?'0ms':'500ms';el.style.opacity=stage&&i===(stage-1)%5?'0.05':'0';comboScreenTones[i].style.transitionDuration=immediate?'0ms':'500ms';comboScreenTones[i].style.opacity=el.style.opacity;});
   comboSweepAnimations.forEach(a=>{effects.delete(a);a.cancel();});comboSweepAnimations=[];
   if(stage&&!immediate){const reduced=reducedMotion.matches;if(!reduced){board.querySelectorAll('.rb-zone-divider').forEach(el=>comboSweepAnimations.push(animateEffect(el,[{opacity:.6},{opacity:1,offset:.15},{opacity:.6}],500)));}if(!reduced)comboSweeps.forEach((el,i)=>{el.style.setProperty('--combo-color',color);comboSweepAnimations.push(animateEffect(el.firstElementChild,[{transform:'translateY('+(i?'-100%':'800%')+')',opacity:0,offset:0},{opacity:.65,offset:.12},{transform:'translateY('+(i?'800%':'-100%')+')',opacity:0,offset:1}],500));});}
  }
  let hitBuffers=null,hitBufferContext=null;const hitSources=new Set();
  const effects=new Set(),pangAnimations=Array(9).fill(null);
  let startAnimation=null;
  const colors=['#086aff','#ff1529','#ffc400','#05e52e','#a500ff','#ff0099','#ff7900','#00cfff','#a65121'];
  // V 1155 G: visual slots are reusable; chart notes and judgement remain independent.
  const notePools=Array.from({length:9},()=>[]),visibleNotes=[];
  function createNoteVisual(lane){
   const el=document.createElement('div');el.className='rb-note';el.setAttribute('aria-hidden','true');el.hidden=true;
   const character=document.createElement('span');character.className='rb-character';character.style.setProperty('--outline-filter','url(#rb-character-outline-'+lane+')');el.appendChild(character);
   const ring=document.createElement('img');ring.className='rb-note-ring';ring.alt='';ring.draggable=false;ring.src='assets/rhythm-b/note-inner-line-'+lane+'.png';el.appendChild(ring);
   el.style.left=((26+(lane%3)*300)/952*100)+'%';el.style.top=((26+Math.floor(lane/3)*300)/2078*100)+'%';el.style.setProperty('--note-color',colors[lane]);
   const slot={el,character,ring,owner:null};notePools[lane].push(slot);return slot;
  }
  function ensureNoteVisual(n){
   if(n.visualSlot)return;
   const pool=notePools[n.lane];let slot=null;for(let i=0;i<pool.length;i++)if(!pool[i].owner){slot=pool[i];break;}
   if(!slot)slot=createNoteVisual(n.lane);
   slot.owner=n;n.visualSlot=slot;n.el=slot.el;n.el.dataset.noteId=String(n.id);n.character=slot.character;n.ring=slot.ring;
   n.el.hidden=true;n.el.classList.remove('is-hit-out');n.ring.hidden=false;n.character.style.transform='';n.character.style.opacity='';n.lastU=NaN;n.spriteFrame=-1;
  }
  function showNoteVisual(n){if(!n.visualActive)visibleNotes.push(n);if(n.el.parentNode!==board){let next=null;for(const other of visibleNotes)if(other.visualActive&&other.id>n.id&&(!next||other.id<next.id))next=other;board.insertBefore(n.el,next?next.el:null);}n.visualActive=true;n.el.hidden=false;}
  function releaseNoteVisual(n){
   const slot=n.visualSlot;n.visualActive=false;if(!slot)return;
   if(slot.owner===n){slot.el.hidden=true;slot.el.remove();slot.owner=null;}n.visualSlot=null;
  }
  const outlineDefs=document.createElementNS('http://www.w3.org/2000/svg','svg');outlineDefs.setAttribute('width','0');outlineDefs.setAttribute('height','0');outlineDefs.style.position='absolute';outlineDefs.setAttribute('aria-hidden','true');
  outlineDefs.innerHTML='<defs>'+colors.map((color,i)=>'<filter id="rb-character-outline-'+i+'" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="wide"/><feComposite in="wide" in2="SourceAlpha" operator="out" result="edge"/><feFlood flood-color="'+color+'" flood-opacity="0.35"/><feComposite in2="edge" operator="in" result="line"/><feGaussianBlur in="line" stdDeviation="2" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="line"/><feMergeNode in="SourceGraphic"/></feMerge></filter>').join('')+'</defs>';board.appendChild(outlineDefs);
  const holoLights=colors.map((color,lane)=>{const el=document.createElement('div');el.className='rb-holo-light';el.setAttribute('aria-hidden','true');el.style.cssText='left:'+((28+(lane%3)*300)/952*100)+'%;top:'+((28+Math.floor(lane/3)*300)/2078*100)+'%;width:'+(296/952*100)+'%;height:'+(296/2078*100)+'%;--holo-color:'+color;board.appendChild(el);return el;});
  function darkenLane(lane){holoLights[lane].style.opacity='0';}
  function clearLights(){holoLights.forEach((_,i)=>darkenLane(i));}
  const pangs=colors.map((_,lane)=>{const el=document.createElement('span');el.className='rb-pang';el.textContent='PANG!';el.hidden=true;el.setAttribute('aria-hidden','true');el.style.left=((176+(lane%3)*300)/952*100)+'%';el.style.top=((176+Math.floor(lane/3)*300)/2078*100)+'%';board.appendChild(el);return el;});
  const startCallout=document.createElement('div');startCallout.className='rb-start-callout';startCallout.hidden=true;startCallout.setAttribute('aria-hidden','true');hud.appendChild(startCallout);
  const startShade=document.createElement('div');startShade.className='rb-start-shade';startShade.hidden=true;startShade.setAttribute('aria-hidden','true');hud.appendChild(startShade);
  function animateEffect(el,keyframes,duration,done){const a=el.animate(keyframes,{duration,easing:'ease-out'});effects.add(a);a.onfinish=()=>{effects.delete(a);if(done)done();};a.oncancel=()=>effects.delete(a);return a;}
  const powerWords={};const powerAnimations={};
  for(const kind of ['combo',...Array.from({length:9},(_,i)=>'perfect-'+i)]){const word=document.createElement('span'),perfect=kind.startsWith('perfect-');word.className='rb-power-word rb-power-word--'+(perfect?'perfect':'combo');word.hidden=true;word.setAttribute('aria-hidden','true');if(perfect){const lane=Number(kind.slice(8));word.dataset.lane=lane;word.style.left=((176+(lane%3)*300)/952*100)+'%';word.style.top=((1196+Math.floor(lane/3)*300)/2078*100)+'%';}board.appendChild(word);powerWords[kind]=word;}
  function showPowerWord(kind,text,color){
   const word=powerWords[kind];if(powerAnimations[kind])powerAnimations[kind].cancel();
   word.textContent=text;word.style.color=color;word.hidden=false;
   word.style.fontSize=(kind==='combo'?boardWidth*.036:boardWidth*.045)+'px';
   const peak=kind==='combo'?Math.min(4.6,boardWidth*.19/Math.max(1,word.offsetWidth)):4.6;
   const position=kind==='combo'?['translate(-100%,-100%)','translate(-100%,calc(-100% - 42px))','translate(-100%,calc(-100% - 64px))']:['translate(-50%,-50%)','translate(-50%,-50%)','translate(-50%,-50%)'];
   const reduced=reducedMotion.matches;
   const frames=reduced?[{opacity:.7},{opacity:0}]:[{transform:position[0]+' scale(.05)',opacity:.7,offset:0},{transform:position[1]+' scale('+(peak*3.5/4.6)+')',opacity:.7,offset:.6},{transform:position[2]+' scale('+peak+')',opacity:0,offset:1}];
   const a=animateEffect(word,frames,1100,()=>{if(powerAnimations[kind]===a){word.hidden=true;powerAnimations[kind]=null;}});powerAnimations[kind]=a;
  }
  function clearEffects(){clearTiming();judgeEl.style.visibility='';Object.values(powerWords).forEach(e=>e.hidden=true);for(const kind of Object.keys(powerAnimations))powerAnimations[kind]=null;for(const a of effects)a.cancel();effects.clear();perfectArcAnimations.flat().forEach(a=>{a.cancel();a.currentTime=0;});pangs.forEach(el=>el.hidden=true);pangAnimations.fill(null);startAnimation=null;startCallout.hidden=true;startShade.hidden=true;startShade.style.opacity='0';comboPulse=null;}
  function showStart(stage){
   if(state.startPhase===stage)return;state.startPhase=stage;
   if(startAnimation)startAnimation.cancel();
   const scale=[.64,.82,1,1.2][stage];
   startCallout.innerHTML=stage===3?'GO!':'ARE YOU<br>READY!';startCallout.dataset.stage=String(stage);
   startCallout.style.color=['#43dcff','#fff05b','#ff5ba9','#56ff88'][stage];startCallout.hidden=false;
   const still=reducedMotion.matches;
   const a=animateEffect(startCallout,still?[{opacity:1},{opacity:1}]:[
    {transform:'translate(-50%,-50%) scale('+(scale*.82)+')',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) scale('+scale+')',opacity:1,offset:.15},
    {transform:'translate(-50%,-50%) scale('+(scale*1.12)+')',opacity:.85,offset:.55},
    {transform:'translate(-50%,-50%) scale('+(scale*1.35)+')',opacity:0,offset:1}
   ],stage===3?500:980,()=>{if(startAnimation===a){startCallout.hidden=true;startAnimation=null;}});
   startAnimation=a;
  }
  const perfectArcs=Array.from({length:9},(_,lane)=>{const el=document.createElement('span');el.className='rb-perfect-arcs';el.setAttribute('aria-hidden','true');el.style.left=((176+(lane%3)*300)/952*100)+'%';el.style.top=((176+Math.floor(lane/3)*300)/2078*100)+'%';el.style.setProperty('--arc-color',colors[lane]);el.innerHTML='<i></i><i></i>';board.appendChild(el);return el;});
  const perfectArcAnimations=perfectArcs.map(el=>Array.from(el.children,(node,index)=>{const a=node.animate([{transform:'rotate('+(index?110:-70)+'deg) scale(.45)',opacity:0},{transform:'rotate('+(index?150:-110)+'deg) scale(1)',opacity:.9,offset:.22},{transform:'rotate('+(index?190:-150)+'deg) scale(1.18)',opacity:0}],{duration:460,easing:'ease-out',fill:'none'});a.pause();a.currentTime=0;return a;}));
  function successEffect(n,t,grade){
   ensureNoteVisual(n);placeNote(n,(t-n.spawnTime)/rules.diffs[state.diff].travel);
   n.ring.hidden=true;n.el.classList.add('is-hit-out');showNoteVisual(n);
   const wave=spaceWaves[n.lane];if(wave&&!spaceReduced.matches){if(waveAnimations[n.lane])waveAnimations[n.lane].cancel();waveAnimations[n.lane]=animateEffect(wave,[{transform:'scale(.08)',opacity:0,offset:0},{transform:'scale(.3)',opacity:.9,offset:.2},{transform:'scale(1)',opacity:0,offset:1}],420);}
   if(grade==='PERFECT'&&!reducedMotion.matches)perfectArcAnimations[n.lane].forEach(a=>{a.currentTime=0;a.play();});
   const reduced=reducedMotion.matches,angle=Math.random()*Math.PI*2;
   const flyX=Math.cos(angle)*1500,flyY=Math.sin(angle)*1200,spin=Math.random()<.5?-1:1;
   animateEffect(n.character,reduced?[{opacity:1},{opacity:0}]:[
    {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1,offset:0},
    {transform:'translate(0,0) rotate(0deg) scale(1.2)',opacity:1,offset:.2},
    {transform:'translate('+(flyX*.32)+'%,'+(flyY*.32)+'%) rotate('+(spin*28)+'deg) scale(1)',opacity:1,offset:.65},
    {transform:'translate('+flyX+'%,'+flyY+'%) rotate('+(spin*65)+'deg) scale(.8)',opacity:0,offset:1}
   ],reduced?100:350,()=>releaseNoteVisual(n));
   if(pangAnimations[n.lane])pangAnimations[n.lane].cancel();
   const pang=pangs[n.lane];pang.hidden=false;
   const a=animateEffect(pang,[{opacity:1,offset:0},{opacity:1,offset:.75},{opacity:0,offset:1}],200,()=>{if(pangAnimations[n.lane]===a){pang.hidden=true;pangAnimations[n.lane]=null;}});
   pangAnimations[n.lane]=a;
  }
  const status=document.createElement('div');status.className='rb-timing-gauge';status.setAttribute('role','img');status.setAttribute('aria-label','Judgement energy: longest PERFECT, shortest MISS');
  status.innerHTML='<svg viewBox="1 0 778 60" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rb-timing-spectrum"><stop stop-color="#247dff"/><stop offset=".3" stop-color="#ad58ff"/><stop offset=".46" stop-color="#29465d"/><stop offset=".54" stop-color="#29465d"/><stop offset=".7" stop-color="#ad58ff"/><stop offset="1" stop-color="#247dff"/></linearGradient></defs><rect x="2" y="8" width="776" height="34" fill="#041020" stroke="#37556f" stroke-width="2"/><rect x="16" y="16" width="748" height="18" fill="url(#rb-timing-spectrum)" opacity=".2"/><path d="M24 8H756M24 42H756" stroke="url(#rb-timing-spectrum)" stroke-width="2" opacity=".6"/></svg><span class="rb-timing-caption rb-timing-caption--center">RHYTHM</span>';
  const gaugeSvg=status.querySelector('svg');
  for(const [grade,strength] of [['GOOD',.44],['GREAT',.72],['PERFECT',1]])for(const side of [-1,1]){const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.dataset.zone=grade;line.dataset.side=side;const x=1+(50+side*46*strength)/100*778;line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('y1','32');line.setAttribute('y2','42');line.setAttribute('stroke','#7993a8');line.setAttribute('stroke-opacity','.55');line.setAttribute('stroke-width','1');line.setAttribute('vector-effect','non-scaling-stroke');gaugeSvg.appendChild(line);}
  board.appendChild(status);
  const timingColors={PERFECT:'#ffea00',GREAT:'#b000ff',GOOD:'#00bfff',MISS:'#ff1744'},timingAnimations=Array(1).fill(null);let timingCursor=0;
  const timingLights=Array.from({length:1},()=>{const el=document.createElement('span');el.className='rb-timing-light';el.hidden=true;status.appendChild(el);return el;});
  function showTiming(grade){const i=0,el=timingLights[i],strength={PERFECT:1,GREAT:.72,GOOD:.44,MISS:.12}[grade];
   if(timingAnimations[i])timingAnimations[i].cancel();el.hidden=false;el.dataset.grade=grade;el.dataset.strength=strength;el.style.left='50%';el.style.setProperty('--timing-color',timingColors[grade]);status.setAttribute('aria-label',grade);
   const still=reducedMotion.matches;const transform=value=>'translate(-50%,-50%) scaleX('+value+')';const a=animateEffect(el,still?[{transform:transform(strength),opacity:1},{transform:transform(strength),opacity:0}]:[{transform:transform(.02),opacity:.75,offset:0},{transform:transform(strength),opacity:1,offset:.12},{transform:transform(strength*.85),opacity:.75,offset:.42},{transform:transform(.02),opacity:0,offset:1}],400,()=>{if(timingAnimations[i]===a){el.hidden=true;timingAnimations[i]=null;}});timingAnimations[i]=a;
  }
  function clearTiming(){timingLights.forEach(e=>e.hidden=true);timingAnimations.fill(null);timingCursor=0;}
  const error= document.createElement('div');error.className='rb-load-error';error.hidden=true;error.setAttribute('role','alert');error.textContent='게임 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';board.appendChild(error);
  const scoreLabel=hud.querySelector('.rb-status--score small');
  const scoreEl=hud.querySelector('[data-rb-score]'),comboEl=hud.querySelector('[data-rb-combo]'),judgeEl=hud.querySelector('[data-rb-judge]');
  const comboLabel=hud.querySelector('.rb-status--combo small');
  function alignTimingLabelEdges(){if(!scoreLabel||!comboLabel)return;const range=document.createRange();range.selectNodeContents(scoreLabel);const left=range.getBoundingClientRect().left;range.selectNodeContents(comboLabel);const right=range.getBoundingClientRect().right,b=board.getBoundingClientRect();if(b.width>0&&right>left){status.style.left=((left-b.left)/b.width*100)+'%';status.style.width=((right-left)/b.width*100)+'%';}}
  if(scoreLabel&&comboLabel){const timingResize=new ResizeObserver(alignTimingLabelEdges);[board,scoreLabel,comboLabel].forEach(e=>timingResize.observe(e));if(document.fonts)document.fonts.ready.then(alignTimingLabelEdges);}

  const foci=Array.from(hud.querySelectorAll('.rb-mini'),mini=>({x:parseFloat(mini.style.getPropertyValue('--depth-x'))/100,y:parseFloat(mini.style.getPropertyValue('--depth-y'))/100}));
  const spaceMinis=Array.from(hud.querySelectorAll('.rb-mini'));
  const glassGroups=Array.from(hud.querySelectorAll('.rb-glass-grow')),glassInners=glassGroups.map(e=>e.querySelectorAll('circle')[1]),glassScales=Array(9).fill(1),glassTarget=(148*296/304)/45;
  function scaleGlass(lane,scale){if(glassGroups[lane]&&glassScales[lane]!==scale){glassGroups[lane].setAttribute('transform','translate(151.48648648648648 152) scale('+scale+') translate(-151.48648648648648 -152)');glassInners[lane].setAttribute('r',String((45-3.5/scale)*304/296));glassScales[lane]=scale;}}
  const spaceTunnels=spaceMinis.map(m=>m.querySelector('.rb-wire-tunnel'));
  const spaceOpacity=Array(9).fill(null);
  const spaceSections=spaceMinis.map(m=>Array.from(m.querySelectorAll('.rb-space-section')));
  const spaceWaves=spaceMinis.map(m=>m.querySelector('.rb-space-hit-wave'));
  const spacePhases=Array.from({length:9},(_,i)=>i*.071),spaceApproach=Array(9).fill(0),waveAnimations=Array(9).fill(null);
  const spaceReduced=reducedMotion;let spaceLastTime=null;
  const cueCircuits=Array.from(board.querySelectorAll('.rb-circuit-reflection'));
  const cueActive=new Uint8Array(9),cueUpper=new Uint8Array(9),shownActive=new Uint8Array(9),shownUpper=new Uint8Array(9);
  function clearCues(){shownActive.fill(0);shownUpper.fill(0);glassScales.forEach((_,i)=>scaleGlass(i,1));spaceMinis.forEach(e=>e.classList.remove('is-chord-ready','is-note-active'));cueCircuits.forEach(e=>{e.classList.remove('is-chord-active','is-simultaneous');});}
  function updateCues(t){
   const active=cueActive,upper=cueUpper;active.fill(0);upper.fill(0);const perfect=rules.diffs[state.diff].judge.perfectMs/1000;
   let kept=0;for(let i=0;i<visibleNotes.length;i++){const n=visibleNotes[i];if(!n.visualActive)continue;visibleNotes[kept++]=n;const approaching=n.state==='pending'&&t>=n.spawnTime&&t<=n.targetTime+rules.diffs[state.diff].judge.goodMs/1000;
    if(approaching||n.state==='hit'&&n.visualActive)active[n.lane]=1;
    if(n.chordSize>=2&&approaching&&Math.abs(t-n.targetTime)<=perfect)upper[n.lane]=1;
   }visibleNotes.length=kept;
   for(let i=0;i<spaceMinis.length;i++){const e=spaceMinis[i];if(shownUpper[i]!==upper[i]){e.classList.toggle('is-chord-ready',!!upper[i]);shownUpper[i]=upper[i];}if(shownActive[i]!==active[i]){e.classList.toggle('is-note-active',!!active[i]);shownActive[i]=active[i];}if(!active[i])scaleGlass(i,1);}
  }
  function resetSpace(){spaceLastTime=null;spacePhases.forEach((_,i)=>{spacePhases[i]=i*.071;spaceApproach[i]=0;});spaceOpacity.fill(null);spaceTunnels.forEach(e=>{if(e)e.style.removeProperty('opacity');});spaceSections.flat().forEach(el=>{el.style.opacity='0';el.removeAttribute('transform');});waveAnimations.fill(null);}
  function updateSpace(t){
   const dt=spaceLastTime===null?0:Math.max(0,t-spaceLastTime);spaceLastTime=t;spaceApproach.fill(0);
   for(const n of state.notes)if(n.state==='pending'&&t>=n.spawnTime&&t<=n.targetTime+rules.diffs[state.diff].judge.goodMs/1000)spaceApproach[n.lane]=Math.max(spaceApproach[n.lane],Math.max(0,Math.min(1,(t-n.spawnTime)/rules.diffs[state.diff].travel)));
   const first=state.firstBeat,period=60/state.bpm,phase=((t-first)%period+period)%period;
   if(state.beats&&state.beats.length){while(state.beatCursor+1<state.beats.length&&state.beats[state.beatCursor+1]<=t)state.beatCursor++;}
   const beatPhase=state.beats&&state.beats.length?t-state.beats[state.beatCursor]:phase;
   const beat=t>=first?Math.exp(-Math.max(0,beatPhase)/.09):0;
   spaceMinis.forEach((mini,lane)=>{
    const opacity=.72+(spaceReduced.matches?0:beat)*.16+spaceApproach[lane]*.12;
    if(spaceTunnels[lane]&&spaceOpacity[lane]!==opacity){spaceTunnels[lane].style.opacity=String(opacity);spaceOpacity[lane]=opacity;}
    if(spaceReduced.matches){spaceSections[lane].forEach(el=>el.style.opacity='0');return;}
    spacePhases[lane]=(spacePhases[lane]+dt*(.13+.22*spaceApproach[lane])*(1+Math.min(comboStage,5)*.04))%1;
    spaceSections[lane].forEach((el,depth)=>{const p=(spacePhases[lane]+depth/3)%1,scale=.035+.965*Math.pow(p,1.45),fx=Number(el.dataset.focusX),fy=Number(el.dataset.focusY);el.setAttribute('transform','matrix('+scale+' 0 0 '+scale+' '+(fx*(1-scale))+' '+(fy*(1-scale))+')');el.style.opacity=String(Math.sin(Math.PI*p)*(.38+.3*spaceApproach[lane]));});
   });
  }
  function time(){return state&&context?context.currentTime-state.t0:0;}
  function label(text,grade) {
   const el=judgeEl;el.textContent=text;el.style.visibility='';
   const parent=el.parentElement;parent.dataset.grade=grade||'';
   parent.classList.toggle('is-judging',Boolean(grade)&&grade!=='PERFECT');
   el.getAnimations().forEach(a=>{if(a.animationName==='rb-judge-pop')a.currentTime=0;});
  }
  let shownScore=-1,shownCombo=-1,shownScoreLabel='';
  function updateHud(){
   if(shownScore!==state.score){scoreEl.textContent=String(state.score).padStart(6,'0');shownScore=state.score;}
   const text=state.practice?'SCORE · TEST':'SCORE';if(scoreLabel&&shownScoreLabel!==text){scoreLabel.textContent=text;shownScoreLabel=text;}
   if(shownCombo!==state.combo){comboEl.textContent=state.combo;shownCombo=state.combo;}updateCombo(state.combo);
  }
  function muteMelody(on){if(state&&state.practice)on=true;if(melodyGain&&context)melodyGain.gain.setTargetAtTime(on?1:0,context.currentTime,on?.01:.03);}
  function vibrate(ms){try{if(root.FGH&&root.FGH.Settings&&root.FGH.Settings.vibrate)root.FGH.Settings.vibrate(ms);else if(root.navigator&&root.navigator.vibrate)root.navigator.vibrate(ms);}catch(e){}}
  function prepareHitBuffers(){
   if(!context.createBuffer)return;
   if(hitBufferContext===context&&hitBuffers)return;hitBufferContext=context;hitBuffers={};
   for(const kind of ['kick','snare','hat']){const sr=context.sampleRate||48000,length=Math.round(sr*(kind==='hat'?.028:.045)),buffer=context.createBuffer(1,length,sr),data=buffer.getChannelData(0);let seed=17,previous=0;
    for(let i=0;i<length;i++){const t=i/sr,envelope=Math.exp(-t/(kind==='kick'?.012:.008));seed=(seed*1664525+1013904223)>>>0;const noise=seed/2147483648-1;data[i]=(kind==='kick'?Math.sin(2*Math.PI*(110*t+1.2*(1-Math.exp(-t*70)))):kind==='snare'?noise*.65+Math.sin(2*Math.PI*190*t)*.25:(noise-previous)*.4)*envelope;previous=noise;}hitBuffers[kind]=buffer;
   }
  }
  function hitSound(note,grade){
   if(!state.hitFeedback||!hitBuffers||!context.createGain)return;
   if(root.FGH&&root.FGH.Settings&&root.FGH.Settings.sfxEnabled&&!root.FGH.Settings.sfxEnabled())return;
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=hitBuffers[note.sound]||hitBuffers.kick;gain.gain.value=.06*(note.chordSize===2?.7:1)*(grade==='GOOD'?.75:1);source.connect(gain);gain.connect(context.destination);hitSources.add(source);source.onended=()=>{hitSources.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  function stopAudio(){hitSources.forEach(s=>{try{s.stop();}catch(e){}});hitSources.clear();sources.forEach(s=>{try{s.stop();}catch(e){}});sources=[];melodyGain=null;}
  function clearRings(){visibleNotes.length=0;for(const pool of notePools)for(const slot of pool){if(slot.owner)releaseNoteVisual(slot.owner);else{slot.el.hidden=true;slot.el.remove();}}}
  function stop(){if(opts.onStop)opts.onStop();generation++;cancelAnimationFrame(frame);frame=0;stopAudio();clearEffects();clearRings();clearLights();clearCues();resetSpace();updateProgress(0);updateCombo(0,true);state=null;error.hidden=true;}
  function finish(clear){
   if(!state||state.ended)return;
   if(clear)updateProgress(1);
   state.ended=true;clearLights();clearCues();cancelAnimationFrame(frame);frame=0;stopAudio();clearEffects();clearRings();
   opts.onFinish({score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},totalNotes:state.notes.length,diff:state.diff,practice:state.practice},clear);
  }
  function miss(note){
   if(!state||state.ended)return;
   if(!note||note.state!=='pending')return;
   note.state='miss';releaseNoteVisual(note);darkenLane(note.lane);if(opts.onNoteEnd)opts.onNoteEnd(note.lane);
   state.cnt.MISS++;state.combo=0;muteMelody(false);label('MISS','MISS');updateHud();
   showTiming('MISS');
  }
  function hasCharacter(lane){if(!state||state.ended||state.loading||time()<0)return false;const t=time(),notes=state.notesByLane[lane];return notes.some(n=>(n.state==='pending'&&t>=n.spawnTime&&t<=n.targetTime+rules.diffs[state.diff].judge.goodMs/1000)||(n.state==='hit'&&n.visualActive));}
  function press(lane){
   if(!state||state.ended||state.paused||time()<0)return;
   const t=time();
   let best=null,delta=Infinity;
   for(const n of state.notesByLane[lane]){if(n.state==='pending'&&t>=n.spawnTime){const d=Math.abs(t-n.targetTime);if(d<delta){best=n;delta=d;}}}
   if(!best)return false; // Empty input never changes score, combo, or MISS.
   // Like A: an existing future note outside the input window remains pending until its deadline.
   const grade=rules.grade(delta*1000,state.diff);if(!grade)return false;
   best.state='hit';hitSound(best,grade);successEffect(best,t,grade);darkenLane(best.lane);state.cnt[grade]++;state.combo++;state.maxCombo=Math.max(state.maxCombo,state.combo);
   state.score+=rules.points(grade,state.combo);muteMelody(true);label(grade,grade);updateHud();
   showTiming(grade,(t-best.targetTime)*1000);
   if(grade==='PERFECT'){const stage=Math.floor(state.combo/10);showPowerWord('perfect-'+lane,'PERFECT',stage?comboPalette[(stage-1)%comboPalette.length]:'#00cfff');}
   vibrate(160);
   if(opts.onNoteEnd)opts.onNoteEnd(lane);
   if(opts.onHit)opts.onHit(lane,grade);
   return grade;
  }
  function placeNote(n,p){
   const focusX=foci[n.lane].x,focusY=foci[n.lane].y;
   const u=Math.pow(Math.max(0,Math.min(1,p)),1.55),scale=.13+.87*u;
   const dx=(focusX-.5)*296*(1-u),dy=(focusY-.5)*296*(1-u);
   if(n.lastU!==u){
    n.el.style.transform='translate('+(dx/300*100)+'%,'+(dy/300*100)+'%) scale('+scale+')';
    n.el.style.opacity=String(.3+.7*u);
    n.character.style.setProperty('--character-light',String(.7+.3*u));
    scaleGlass(n.lane,1+(glassTarget-1)*u);
    if(opts.onNoteApproach)opts.onNoteApproach(n.lane,u);
    n.lastU=u;
   }
   n.el.dataset.progress=String(p);
   // Both visuals share this transform; only the ring determines judgement.
   const elapsed=Math.max(0,time()-n.spawnTime),spriteFrame=Math.floor(elapsed*12)%8;
   if(n.spriteFrame!==spriteFrame){n.character.style.backgroundPosition=(spriteFrame/7*100)+'% 0%';n.spriteFrame=spriteFrame;}
  }
  function tick(){
   frame=0;if(!state||state.ended||state.paused)return;
   const t=time();
   if(opts.onTime)opts.onTime(t);
   const countIn=rules.config.countIn,readyElapsed=context.currentTime-state.readyStart,inCount=readyElapsed<countIn;
   if(inCount||t<.4||!startShade.hidden){startShade.hidden=!inCount&&t>=.4;const opacity=String(inCount?shadeSteps[Math.max(0,Math.min(2,Math.floor(readyElapsed/(countIn/3))))]:Math.max(0,.62*(1-t/.4)));if(startShade.style.opacity!==opacity)startShade.style.opacity=opacity;}
   updateProgress(state.duration>0?t/state.duration:0);
   if(inCount){const stage=Math.max(0,Math.min(2,Math.floor(readyElapsed/(countIn/3))));showStart(stage);const count=String(countIn-stage);if(state.count!==count){state.count=count;label(count);}}
   else if(state.count!=='GO'){state.count='GO';label('GO!');showStart(3);}
   
   const D=rules.diffs[state.diff];
   // V 1124: upper portal has no idle motion; only note-active rims.
   for(let id=state.renderCursor;t>=0&&id<state.notes.length;id++){
    const n=state.notes[id];if(state.ended)break;
    if(n.state!=='pending')continue;
    if(t>n.targetTime+D.judge.goodMs/1000){miss(n);continue;}
    if(t>=n.spawnTime){const appearing=!n.visualActive;ensureNoteVisual(n);if(appearing&&opts.onNoteSpawn)opts.onNoteSpawn(n.lane);placeNote(n,(t-n.spawnTime)/D.travel);if(appearing)showNoteVisual(n);}else if(state.renderOrdered)break;
   }
   while(state.renderCursor<state.notes.length&&state.notes[state.renderCursor].state!=='pending')state.renderCursor++;
   if(!state.ended&&t>=0)updateCues(t);
   if(!state.ended&&t>=state.duration)finish(true);
   if(!state.ended)frame=requestAnimationFrame(tick);
  }
  async function start(diff,options){
   stop();const token=generation;error.hidden=true;label('LOADING');startShade.hidden=false;startShade.style.opacity='.9';
   state={diff,practice:!!(options&&options.practice),notes:[],score:0,combo:0,maxCombo:0,cnt:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},paused:false,ended:false,loading:true,t0:Infinity,count:null,startPhase:-1,renderCursor:0,renderOrdered:true};updateHud();
   try{
    const [data]=await Promise.all([opts.loadSong(),opts.prepareAssets?opts.prepareAssets():Promise.resolve()]);if(token!==generation)return false;
    context=data.ctx;
    if(opts.onSong)opts.onSong(data.song);
    let times=data.song&&data.song.charts&&data.song.charts[diff];
    const authored=data.song&&data.song.patterns&&data.song.patterns[diff];
    const authoredNotes=authored?authored.flatMap(e=>e.lanes.map(lane=>({time:e.time,lane,sound:e.sound||'kick',chordSize:e.lanes.length}))):null;
    if(authoredNotes)times=authoredNotes.map(n=>n.time);
    if(!times){const c=rules.config,spb=60/c.song.bpm,D=rules.diffs[diff];times=[];for(let i=0;i<c.chart.beats;i++){if(i%D.rest===D.rest-1)continue;times.push(c.song.firstBeat+(c.chart.startBeat+i)*spb);if(i%2&&Math.random()<D.half)times.push(c.song.firstBeat+(c.chart.startBeat+i+.5)*spb);}}
    // Preserve the authored chart's established spacing; the wider judge window
    // remains shorter than this interval, with at least ~180ms visual separation.
    const D=rules.diffs[diff],laneGap=Math.max(D.travel+D.judge.goodMs/1000,D.travel+opts.rules.diffs[diff].judge.goodMs*11/10000+.2);
    const chordCounts=new Map();times.forEach(t=>chordCounts.set(t,(chordCounts.get(t)||0)+1));
    const last=Array(9).fill(-Infinity);state.notes=times.map((targetTime,id)=>{
     const free=last.map((t,lane)=>lane).filter(lane=>targetTime-last[lane]>=laneGap);
     if(!free.length)throw new Error('Chart exceeds nine independent lane windows');
     const authoredNote=authoredNotes&&authoredNotes[id];
     const lane=authoredNote?authoredNote.lane:free[Math.floor(Math.random()*free.length)];
     if(!Number.isFinite(targetTime)||!Number.isInteger(lane)||lane<0||lane>8||!free.includes(lane))throw new Error('Invalid authored lane spacing');
     last[lane]=targetTime;
     return {id,lane,targetTime,spawnTime:targetTime-rules.diffs[diff].travel,state:'pending',el:null,character:null,ring:null,visualSlot:null,visualActive:false,sound:authoredNote?authoredNote.sound:'kick',chordSize:authoredNote?authoredNote.chordSize:chordCounts.get(targetTime)};
    });
    state.notesByLane=Array.from({length:9},()=>[]);for(const n of state.notes)state.notesByLane[n.lane].push(n);
    for(let i=1;i<state.notes.length;i++)if(state.notes[i].spawnTime<state.notes[i-1].spawnTime){state.renderOrdered=false;break;}
    // Keep per-note ownership stable within the round; reuse slots only on later rounds.
    for(const n of state.notes)ensureNoteVisual(n);
    // Drop unneeded spare slots when switching to a smaller/different chart.
    for(const pool of notePools){let kept=0;for(const slot of pool)if(slot.owner)pool[kept++]=slot;pool.length=kept;}
    state.hitFeedback=!!(data.song&&data.song.hitFeedback);if(state.hitFeedback)prepareHitBuffers();
    state.beats=data.song&&Array.isArray(data.song.beats)?data.song.beats:null;state.beatCursor=0;
    state.bpm=Number(data.song&&data.song.bpm)||rules.config.song.bpm;state.firstBeat=Number.isFinite(data.song&&data.song.firstBeat)?data.song.firstBeat:rules.config.song.firstBeat;
    state.duration=Math.max(data.back.duration,(times[times.length-1]||0)+rules.diffs[diff].judge.goodMs/1000);
    state.readyStart=context.currentTime;state.t0=state.readyStart+rules.config.countIn;state.loading=false;
    const gameMusicGain=context.createGain();gameMusicGain.gain.setValueAtTime(0,state.t0);gameMusicGain.gain.linearRampToValueAtTime(1,state.t0+1.4);gameMusicGain.connect(context.destination);
    showStart(0);
    const back=context.createBufferSource();back.buffer=data.back;back.connect(gameMusicGain);back.start(state.t0);sources.push(back);
    if(data.melody){const mel=context.createBufferSource();mel.buffer=data.melody;melodyGain=context.createGain();melodyGain.gain.value=1;mel.connect(melodyGain);melodyGain.connect(gameMusicGain);mel.start(state.t0);sources.push(mel);}
    if(state.paused)await context.suspend();
    if(!state.paused&&!frame)frame=requestAnimationFrame(tick);return true;
   }catch(e){if(token!==generation)return false;state.loading=false;state.ended=true;state.error=String(e.message||e);label('ERROR');error.hidden=false;startShade.hidden=true;stopAudio();return false;}
  }
  function pause(on){if(!state||state.ended)return;state.paused=on;if(on){cancelAnimationFrame(frame);frame=0;}effects.forEach(a=>{if(a.playState!=='idle'){if(on)a.pause();else a.play();}});perfectArcAnimations.flat().forEach(a=>{if(on&&a.playState==='running'){a._rhythmPaused=true;a.pause();}else if(!on&&a._rhythmPaused){a._rhythmPaused=false;a.play();}});if(context&&!state.loading){if(on)context.suspend();else context.resume();}if(!on&&!state.loading&&!frame)frame=requestAnimationFrame(tick);}
  return {start,stop,pause,press,hasCharacter,dbg:()=>state?{t:time(),diff:state.diff,practice:state.practice,loading:state.loading,paused:state.paused,ended:state.ended,error:state.error,score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},notes:state.notes.map(n=>({id:n.id,lane:n.lane,targetTime:n.targetTime,spawnTime:n.spawnTime,state:n.state}))}:null};
 }
 MG.RhythmBPlay={create};
})(window);
