// V 1043 G: B test chart. Shared A song/rules; border reaches the native glow at targetTime.
(function (root) {
 'use strict';
 const MG=root.MoleGame;
 function create(opts) {
  const board=opts.board, rules=opts.rules, hud=opts.root;
  let state=null, context=null, sources=[], melodyGain=null, frame=0, generation=0;
  const progress=document.createElement('div');progress.className='rb-song-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','곡 진행도');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-valuenow','0');
  const perimeter=document.createElementNS('http://www.w3.org/2000/svg','svg');perimeter.setAttribute('viewBox','0 0 952 2078');perimeter.setAttribute('preserveAspectRatio','none');perimeter.setAttribute('aria-hidden','true');
  const perimeterRoutes=[12,24].map((inset,index)=>{const left=inset,right=952-inset,top=inset,bottom=2078-inset,r=68-inset;if(index===1)return 'M476 '+top+' H'+(left+r)+' Q'+left+' '+top+' '+left+' '+(top+r)+' V'+(bottom-r)+' Q'+left+' '+bottom+' '+(left+r)+' '+bottom+' H'+(right-r)+' Q'+right+' '+bottom+' '+right+' '+(bottom-r)+' V'+(top+r)+' Q'+right+' '+top+' '+(right-r)+' '+top+' H476';return 'M476 '+top+' H'+(right-r)+' Q'+right+' '+top+' '+right+' '+(top+r)+' V'+(bottom-r)+' Q'+right+' '+bottom+' '+(right-r)+' '+bottom+' H'+(left+r)+' Q'+left+' '+bottom+' '+left+' '+(bottom-r)+' V'+(top+r)+' Q'+left+' '+top+' '+(left+r)+' '+top+' H476';});
  perimeter.innerHTML=perimeterRoutes.map(d=>'<path class="rb-perimeter-track" d="'+d+'"/><path class="rb-perimeter-fill" pathLength="100" d="'+d+'"/>').join('');progress.appendChild(perimeter);hud.appendChild(progress);
  const earthLayer=document.createElement('div');earthLayer.className='rb-earth-background';earthLayer.setAttribute('aria-hidden','true');
  const earth=document.createElement('video');earth.className='rb-earth-video';earth.muted=true;earth.defaultMuted=true;earth.playsInline=true;earth.preload='metadata';earth.disableRemotePlayback=true;earth.setAttribute('muted','');earth.setAttribute('playsinline','');earth.setAttribute('width','940');earth.setAttribute('height','1672');earth.poster='assets/rhythm-b/earth-poster-v1104.jpg';earthLayer.appendChild(earth);
  const earthCover=document.createElementNS('http://www.w3.org/2000/svg','svg');earthCover.classList.add('rb-earth-interior');earthCover.setAttribute('viewBox','0 0 952 2078');earthCover.setAttribute('preserveAspectRatio','none');earthCover.innerHTML='<path d="'+perimeterRoutes[0]+'" fill="#000"/>';earthLayer.appendChild(earthCover);hud.insertBefore(earthLayer,hud.firstChild);
  let earthLastStep=-1,earthProgress=0,earthPlayPending=false,earthPlayDenied=false;
  function stopEarth(reset=false){earth.pause();earthPlayPending=false;earthPlayDenied=false;if(reset){earthLastStep=-1;earthProgress=0;earth.style.transform='translate(0vw,0vh)';if(earth.readyState>0)earth.currentTime=0;}}
  function updateEarth(t,force=false){
   if(!state||state.ended)return;const step=Math.floor(Math.max(0,t)*4);if(!force&&step===earthLastStep)return;earthLastStep=step;
   earthProgress=Math.max(0,Math.min(1,t/state.duration||0));earth.style.transform='translate('+(earthProgress*10)+'vw,'+(earthProgress*10)+'vh)';
   if(!Number.isFinite(earth.duration)||!earth.duration||earth.readyState<1)return;
   const desired=Math.min(Math.max(0,earth.duration-.034),earthProgress*earth.duration),rate=earth.duration/state.duration;
   try{if(Math.abs(earth.playbackRate-rate)>.0001)earth.playbackRate=rate;if(force||Math.abs(earth.currentTime-desired)>.12)earth.currentTime=desired;}catch(e){earthLayer.dataset.videoError='sync';earth.pause();return;}
   if(t<0||state.paused){earth.pause();return;}
   if(earth.paused&&!earthPlayPending&&!earthPlayDenied){const token=generation;earthPlayPending=true;const promise=earth.play();if(promise)promise.then(()=>{if(token!==generation)return;earthPlayPending=false;if(!state||state.ended||state.paused)earth.pause();}).catch(()=>{if(token!==generation)return;earthPlayPending=false;earthPlayDenied=true;earthLayer.dataset.videoError='play';});else earthPlayPending=false;}
  }
  earth.addEventListener('loadedmetadata',()=>{if(state&&!state.loading&&!state.ended)updateEarth(time(),true);});earth.addEventListener('error',()=>{earthLayer.dataset.videoError='load';});
  const progressLines=Array.from(perimeter.querySelectorAll('.rb-perimeter-fill'));let lastProgress=-1,lastPercent=-1;
  function updateProgress(value){const v=Math.round(Math.max(0,Math.min(1,value))*1000);if(v!==lastProgress){progressLines.forEach(el=>el.style.strokeDashoffset=String(100-v/10));lastProgress=v;}const pct=Math.floor(v/10);if(pct!==lastPercent){progress.setAttribute('aria-valuenow',String(pct));lastPercent=pct;}}
  updateProgress(0);
  const comboPalette=['#00ffff','#0066ff','#8000ff','#ff00aa','#ffcc00'];
  const comboScreenBackground=document.createElement('div');comboScreenBackground.className='rb-combo-screen-background';hud.appendChild(comboScreenBackground);
  const comboScreenTones=comboPalette.map(color=>{const tone=document.createElement('div');tone.className='rb-combo-screen-tone';tone.style.backgroundColor=color;comboScreenBackground.appendChild(tone);return tone;});
  const comboBackground=document.createElement('div');comboBackground.className='rb-combo-background';board.appendChild(comboBackground);
  const comboLayers=comboPalette.map((color,stage)=>{const group=document.createElement('div');group.className='rb-combo-atmosphere';group.style.setProperty('--combo-color',color);group.dataset.theme=stage;group.innerHTML='<span class="rb-combo-region rb-combo-region--upper"></span><span class="rb-combo-region rb-combo-region--lower"></span>';comboBackground.appendChild(group);return group;});
  const comboSweeps=['upper','lower'].map(side=>{const el=document.createElement('div');el.className='rb-combo-sweep rb-combo-sweep--'+side;el.innerHTML='<span></span>';comboBackground.appendChild(el);return el;});
  let comboStage=0,comboSweepAnimations=[],comboPulse=null;
  function updateCombo(combo,immediate=false){const stage=Math.floor(combo/10);if(stage===comboStage&&!immediate)return;comboStage=stage;if(comboPulse){comboPulse.cancel();comboPulse=null;}if(stage&&!immediate&&combo%10===0&&!root.matchMedia('(prefers-reduced-motion: reduce)').matches)comboPulse=animateEffect(comboEl,[{transform:'scale(1)'},{transform:'scale(1.5)',offset:.3},{transform:'scale(1)'}],240);board.dataset.comboStage=String(stage);const color=stage?comboPalette[(stage-1)%5]:'#00cfff';board.style.setProperty('--combo-accent',color);hud.style.setProperty('--combo-accent',color);hud.classList.toggle('rb-combo-energized',stage>=5);
   comboLayers.forEach((el,i)=>{el.style.transitionDuration=immediate?'0ms':'500ms';el.style.opacity=stage&&i===(stage-1)%5?'0.05':'0';comboScreenTones[i].style.transitionDuration=immediate?'0ms':'500ms';comboScreenTones[i].style.opacity=el.style.opacity;});
   comboSweepAnimations.forEach(a=>{effects.delete(a);a.cancel();});comboSweepAnimations=[];
   if(stage&&!immediate){const reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduced){board.querySelectorAll('.rb-zone-divider').forEach(el=>comboSweepAnimations.push(animateEffect(el,[{opacity:.6},{opacity:1,offset:.15},{opacity:.6}],500)));}if(!reduced)comboSweeps.forEach((el,i)=>{el.style.setProperty('--combo-color',color);comboSweepAnimations.push(animateEffect(el.firstElementChild,[{transform:'translateY('+(i?'-100%':'800%')+')',opacity:0,offset:0},{opacity:.65,offset:.12},{transform:'translateY('+(i?'800%':'-100%')+')',opacity:0,offset:1}],500));});}
  }
  const rings=[];
  let hitBuffers=null,hitBufferContext=null;const hitSources=new Set();
  const effects=new Set(),pangAnimations=Array(9).fill(null);
  let startAnimation=null;
  const colors=['#086aff','#ff1529','#ffc400','#05e52e','#a500ff','#ff0099','#ff7900','#00cfff','#a65121'];
  const outlineDefs=document.createElementNS('http://www.w3.org/2000/svg','svg');outlineDefs.setAttribute('width','0');outlineDefs.setAttribute('height','0');outlineDefs.style.position='absolute';outlineDefs.setAttribute('aria-hidden','true');
  outlineDefs.innerHTML='<defs>'+colors.map((color,i)=>'<filter id="rb-character-outline-'+i+'" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="wide"/><feComposite in="wide" in2="SourceAlpha" operator="out" result="edge"/><feFlood flood-color="'+color+'"/><feComposite in2="edge" operator="in" result="line"/><feGaussianBlur in="line" stdDeviation="2" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="line"/><feMergeNode in="SourceGraphic"/></feMerge></filter>').join('')+'</defs>';board.appendChild(outlineDefs);
  const holoLights=colors.map((color,lane)=>{const el=document.createElement('div');el.className='rb-holo-light';el.setAttribute('aria-hidden','true');el.style.cssText='left:'+((28+(lane%3)*300)/952*100)+'%;top:'+((28+Math.floor(lane/3)*300)/2078*100)+'%;width:'+(296/952*100)+'%;height:'+(296/2078*100)+'%;--holo-color:'+color;board.appendChild(el);return el;});
  function darkenLane(lane){holoLights[lane].style.opacity='0';}
  function clearLights(){holoLights.forEach((_,i)=>darkenLane(i));}
  const pangs=colors.map((_,lane)=>{const el=document.createElement('span');el.className='rb-pang';el.textContent='PANG!';el.hidden=true;el.setAttribute('aria-hidden','true');el.style.left=((176+(lane%3)*300)/952*100)+'%';el.style.top=((176+Math.floor(lane/3)*300)/2078*100)+'%';board.appendChild(el);return el;});
  const startCallout=document.createElement('div');startCallout.className='rb-start-callout';startCallout.hidden=true;startCallout.setAttribute('aria-hidden','true');hud.appendChild(startCallout);
  const startShade=document.createElement('div');startShade.className='rb-start-shade';startShade.hidden=true;startShade.setAttribute('aria-hidden','true');hud.appendChild(startShade);
  function animateEffect(el,keyframes,duration,done){const a=el.animate(keyframes,{duration,easing:'ease-out'});effects.add(a);a.onfinish=()=>{effects.delete(a);if(done)done();};a.oncancel=()=>effects.delete(a);return a;}
  function clearEffects(){for(const a of effects)a.cancel();effects.clear();pangs.forEach(el=>el.hidden=true);pangAnimations.fill(null);startAnimation=null;startCallout.hidden=true;startShade.hidden=true;startShade.style.opacity='0';comboPulse=null;}
  function showStart(stage){
   if(state.startPhase===stage)return;state.startPhase=stage;
   if(startAnimation)startAnimation.cancel();
   const scale=[.64,.82,1,1.2][stage];
   startCallout.innerHTML=stage===3?'GO!':'ARE YOU<br>READY!';startCallout.dataset.stage=String(stage);
   startCallout.style.color=['#43dcff','#fff05b','#ff5ba9','#56ff88'][stage];startCallout.hidden=false;
   const still=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const a=animateEffect(startCallout,still?[{opacity:1},{opacity:1}]:[
    {transform:'translate(-50%,-50%) scale('+(scale*.82)+')',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) scale('+scale+')',opacity:1,offset:.15},
    {transform:'translate(-50%,-50%) scale('+(scale*1.12)+')',opacity:.85,offset:.55},
    {transform:'translate(-50%,-50%) scale('+(scale*1.35)+')',opacity:0,offset:1}
   ],stage===3?500:800,()=>{if(startAnimation===a){startCallout.hidden=true;startAnimation=null;}});
   startAnimation=a;
  }
  function successEffect(n,t){
   n.el.hidden=false;placeNote(n,(t-n.spawnTime)/rules.diffs[state.diff].travel);
   n.ring.hidden=true;n.el.classList.add('is-hit-out');
   const wave=spaceWaves[n.lane];if(wave&&!spaceReduced.matches){if(waveAnimations[n.lane])waveAnimations[n.lane].cancel();waveAnimations[n.lane]=animateEffect(wave,[{transform:'scale(.08)',opacity:0,offset:0},{transform:'scale(.3)',opacity:.9,offset:.2},{transform:'scale(1)',opacity:0,offset:1}],420);}
   const reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches,angle=Math.random()*Math.PI*2;
   const flyX=Math.cos(angle)*1500,flyY=Math.sin(angle)*1200,spin=Math.random()<.5?-1:1;
   animateEffect(n.character,reduced?[{opacity:1},{opacity:0}]:[
    {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1,offset:0},
    {transform:'translate(0,0) rotate(0deg) scale(1.2)',opacity:1,offset:.2},
    {transform:'translate('+(flyX*.32)+'%,'+(flyY*.32)+'%) rotate('+(spin*28)+'deg) scale(1)',opacity:1,offset:.65},
    {transform:'translate('+flyX+'%,'+flyY+'%) rotate('+(spin*65)+'deg) scale(.8)',opacity:0,offset:1}
   ],reduced?100:350,()=>n.el.hidden=true);
   if(pangAnimations[n.lane])pangAnimations[n.lane].cancel();
   const pang=pangs[n.lane];pang.hidden=false;
   const a=animateEffect(pang,[{opacity:1,offset:0},{opacity:1,offset:.75},{opacity:0,offset:1}],200,()=>{if(pangAnimations[n.lane]===a){pang.hidden=true;pangAnimations[n.lane]=null;}});
   pangAnimations[n.lane]=a;
  }
  const status=document.createElement('div');status.className='rb-game-status';
  status.innerHTML=['MISS','GOOD','GREAT','PERFECT'].map(g=>'<div class="rb-total rb-total--'+g.toLowerCase()+'"><small>'+g+'</small><b data-rb-total="'+g+'">'+(g==='MISS'?'0 / 10':'0')+'</b></div>').join('');
  status.style.cssText='left:5.35%;top:50.433%;width:89.3%;height:2.599%';board.appendChild(status);
  const error= document.createElement('div');error.className='rb-load-error';error.hidden=true;error.setAttribute('role','alert');error.textContent='게임 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';board.appendChild(error);
  const scoreLabel=hud.querySelector('.rb-status--score small');
  const scoreEl=hud.querySelector('[data-rb-score]'),comboEl=hud.querySelector('[data-rb-combo]'),judgeEl=hud.querySelector('[data-rb-judge]');
  const totalEls=Object.fromEntries(['MISS','GOOD','GREAT','PERFECT'].map(g=>[g,hud.querySelector('[data-rb-total="'+g+'"]')]));
  const foci=Array.from(hud.querySelectorAll('.rb-mini'),mini=>({x:parseFloat(mini.style.getPropertyValue('--depth-x'))/100,y:parseFloat(mini.style.getPropertyValue('--depth-y'))/100}));
  const spaceMinis=Array.from(hud.querySelectorAll('.rb-mini'));
  const spaceSections=spaceMinis.map(m=>Array.from(m.querySelectorAll('.rb-space-section')));
  const spaceWaves=spaceMinis.map(m=>m.querySelector('.rb-space-hit-wave'));
  const spacePhases=Array.from({length:9},(_,i)=>i*.071),spaceApproach=Array(9).fill(0),waveAnimations=Array(9).fill(null);
  const spaceReduced=root.matchMedia('(prefers-reduced-motion: reduce)');let spaceLastTime=null;
  const cueCircuits=Array.from(board.querySelectorAll('.rb-circuit-reflection'));
  function clearCues(){spaceMinis.forEach(e=>e.classList.remove('is-chord-ready'));cueCircuits.forEach(e=>e.classList.remove('is-chord-active'));}
  function updateCues(t){
   const upper=Array(9).fill(false),lower=Array(9).fill(false),perfect=rules.diffs[state.diff].judge.perfectMs/1000;
   for(const n of state.notes){if(n.chordSize<2)continue;const approaching=n.state==='pending'&&t>=n.spawnTime&&t<=n.targetTime+rules.diffs[state.diff].judge.goodMs/1000;
    if(approaching||n.state==='hit'&&!n.el.hidden)lower[n.lane]=true;
    if(approaching&&Math.abs(t-n.targetTime)<=perfect)upper[n.lane]=true;
   }
   spaceMinis.forEach((e,i)=>e.classList.toggle('is-chord-ready',upper[i]));cueCircuits.forEach((e,i)=>e.classList.toggle('is-chord-active',lower[i]));
  }
  function resetSpace(){spaceLastTime=null;spacePhases.forEach((_,i)=>{spacePhases[i]=i*.071;spaceApproach[i]=0;});spaceMinis.forEach(m=>{m.style.removeProperty('--space-beat');m.style.removeProperty('--space-approach');});spaceSections.flat().forEach(el=>{el.style.opacity='0';el.removeAttribute('transform');});waveAnimations.fill(null);}
  function updateSpace(t){
   const dt=spaceLastTime===null?0:Math.max(0,t-spaceLastTime);spaceLastTime=t;spaceApproach.fill(0);
   for(const n of state.notes)if(n.state==='pending'&&t>=n.spawnTime&&t<=n.targetTime+rules.diffs[state.diff].judge.goodMs/1000)spaceApproach[n.lane]=Math.max(spaceApproach[n.lane],Math.max(0,Math.min(1,(t-n.spawnTime)/rules.diffs[state.diff].travel)));
   const first=state.firstBeat,period=60/state.bpm,phase=((t-first)%period+period)%period;
   if(state.beats&&state.beats.length){while(state.beatCursor+1<state.beats.length&&state.beats[state.beatCursor+1]<=t)state.beatCursor++;}
   const beatPhase=state.beats&&state.beats.length?t-state.beats[state.beatCursor]:phase;
   const beat=t>=first?Math.exp(-Math.max(0,beatPhase)/.09):0;
   spaceMinis.forEach((mini,lane)=>{
    mini.style.setProperty('--space-beat',String(spaceReduced.matches?0:beat));mini.style.setProperty('--space-approach',String(spaceApproach[lane]));
    if(spaceReduced.matches){spaceSections[lane].forEach(el=>el.style.opacity='0');return;}
    spacePhases[lane]=(spacePhases[lane]+dt*(.13+.22*spaceApproach[lane])*(1+Math.min(comboStage,5)*.04))%1;
    spaceSections[lane].forEach((el,depth)=>{const p=(spacePhases[lane]+depth/3)%1,scale=.035+.965*Math.pow(p,1.45),fx=Number(el.dataset.focusX),fy=Number(el.dataset.focusY);el.setAttribute('transform','matrix('+scale+' 0 0 '+scale+' '+(fx*(1-scale))+' '+(fy*(1-scale))+')');el.style.opacity=String(Math.sin(Math.PI*p)*(.38+.3*spaceApproach[lane]));});
   });
  }
  function time(){return state&&context?context.currentTime-state.t0:0;}
  function label(text,grade) {
   const el=judgeEl;el.textContent=text;
   const parent=el.parentElement;parent.dataset.grade=grade||'';
   parent.classList.add('is-judging');
   el.getAnimations().forEach(a=>{if(a.animationName==='rb-judge-pop')a.currentTime=0;});
  }
  function updateHud(){
   scoreEl.textContent=String(state.score).padStart(6,'0');if(scoreLabel)scoreLabel.textContent=state.practice?'SCORE · TEST':'SCORE';
   comboEl.textContent=state.combo;updateCombo(state.combo);
   for(const g of ['MISS','GOOD','GREAT','PERFECT'])totalEls[g].textContent=g==='MISS'?state.cnt.MISS+(state.practice?'':' / 10'):state.cnt[g];
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
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=hitBuffers[note.sound]||hitBuffers.kick;gain.gain.value=.12*(note.chordSize===2?.7:1)*(grade==='GOOD'?.75:1);source.connect(gain);gain.connect(context.destination);hitSources.add(source);source.onended=()=>{hitSources.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  function stopAudio(){hitSources.forEach(s=>{try{s.stop();}catch(e){}});hitSources.clear();sources.forEach(s=>{try{s.stop();}catch(e){}});sources=[];melodyGain=null;}
  function clearRings(){rings.forEach(el=>el.remove());rings.length=0;}
  function stop(){generation++;cancelAnimationFrame(frame);stopAudio();stopEarth(true);clearEffects();clearRings();clearLights();clearCues();resetSpace();updateProgress(0);updateCombo(0,true);state=null;error.hidden=true;}
  function finish(clear){
   if(!state||state.ended)return;
   if(clear)updateProgress(1);
   state.ended=true;stopEarth();clearLights();clearCues();cancelAnimationFrame(frame);stopAudio();clearEffects();rings.forEach(el=>el.hidden=true);
   opts.onFinish({score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},diff:state.diff,practice:state.practice},clear);
  }
  function miss(note){
   if(!state||state.ended)return;
   if(!note||note.state!=='pending')return;
   note.state='miss';note.el.hidden=true;darkenLane(note.lane);
   state.cnt.MISS++;state.combo=0;muteMelody(false);label('MISS','MISS');updateHud();
   if(!state.practice&&state.cnt.MISS>=10)finish(false);
  }
  function press(lane){
   if(!state||state.ended||state.paused||time()<0)return;
   const t=time();
   let best=null,delta=Infinity;
   for(const n of state.notes){if(n.state==='pending'&&n.lane===lane&&t>=n.spawnTime){const d=Math.abs(t-n.targetTime);if(d<delta){best=n;delta=d;}}}
   if(!best)return; // Empty input never changes score, combo, or MISS.
   // Like A: an existing future note outside the input window remains pending until its deadline.
   const grade=rules.grade(delta*1000,state.diff);if(!grade)return;
   best.state='hit';hitSound(best,grade);successEffect(best,t);darkenLane(best.lane);state.cnt[grade]++;state.combo++;state.maxCombo=Math.max(state.maxCombo,state.combo);
   state.score+=rules.points(grade,state.combo);muteMelody(true);label(grade,grade);updateHud();
   vibrate(160);
   if(opts.onHit)opts.onHit(lane,grade);
  }
  function placeNote(n,p){
   const focusX=foci[n.lane].x,focusY=foci[n.lane].y;
   const u=Math.pow(Math.max(0,Math.min(1,p)),1.55),scale=.13+.87*u;
   const dx=(focusX-.5)*296*(1-u),dy=(focusY-.5)*296*(1-u);
   if(n.lastU!==u){
    n.el.style.transform='translate('+(dx/300*100)+'%,'+(dy/300*100)+'%) scale('+scale+')';
    n.el.style.opacity=String(.3+.7*u);
    n.character.style.setProperty('--character-light',String(.7+.3*u));
    const light=holoLights[n.lane];light.style.setProperty('--holo-radius',(8+u*92)+'%');light.style.opacity=String(.15+.45*u);
    n.lastU=u;
   }
   n.el.dataset.progress=String(p);
   // Both visuals share this transform; only the ring determines judgement.
   const spriteFrame=Math.floor(Math.max(0,time()-n.spawnTime)*12)%16;
   if(n.spriteFrame!==spriteFrame){n.character.style.backgroundPosition=(spriteFrame/15*100)+'% 0%';n.spriteFrame=spriteFrame;}
  }
  function tick(){
   if(!state||state.ended)return;
   if(state.paused){frame=requestAnimationFrame(tick);return;}
   const t=time();
   startShade.hidden=t>=.4;startShade.style.opacity=String(t<0?[.9,.78,.62][Math.max(0,Math.min(2,Math.floor((t+rules.config.countIn+.15)/((rules.config.countIn+.15)/3))))]:Math.max(0,.62*(1-t/.4)));
   updateProgress(state.duration>0?t/state.duration:0);updateEarth(t);
   if(t<0){const stage=Math.max(0,Math.min(2,Math.floor((t+rules.config.countIn+.15)/((rules.config.countIn+.15)/3))));showStart(stage);const count=String(3-stage);if(state.count!==count){state.count=count;label(count);}}
   else if(state.count!=='GO'){state.count='GO';label('GO!');showStart(3);}
   if(t>=.6)startCallout.hidden=true;
   const D=rules.diffs[state.diff];
   updateSpace(t);
   for(const n of state.notes){
    if(state.ended)break;
    if(n.state!=='pending')continue;
    if(t>n.targetTime+D.judge.goodMs/1000){miss(n);continue;}
    if(t>=n.spawnTime){n.el.hidden=false;placeNote(n,(t-n.spawnTime)/D.travel);}
   }
   if(!state.ended)updateCues(t);
   if(!state.ended&&t>=state.duration)finish(true);
   if(!state.ended)frame=requestAnimationFrame(tick);
  }
  async function start(diff,options){
   stop();const token=generation;error.hidden=true;label('LOADING');startShade.hidden=false;startShade.style.opacity='.9';
   state={diff,practice:!!(options&&options.practice),notes:[],score:0,combo:0,maxCombo:0,cnt:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},paused:false,ended:false,loading:true,t0:Infinity,count:null,startPhase:-1};updateHud();
   try{
    const [data]=await Promise.all([opts.loadSong(),opts.prepareAssets?opts.prepareAssets():Promise.resolve()]);if(token!==generation)return false;
    context=data.ctx;
    let times=data.song&&data.song.charts&&data.song.charts[diff];
    const authored=data.song&&data.song.patterns&&data.song.patterns[diff];
    const authoredNotes=authored?authored.flatMap(e=>e.lanes.map(lane=>({time:e.time,lane,sound:e.sound||'kick',chordSize:e.lanes.length}))):null;
    if(authoredNotes)times=authoredNotes.map(n=>n.time);
    if(!times){const c=rules.config,spb=60/c.song.bpm,D=rules.diffs[diff];times=[];for(let i=0;i<c.chart.beats;i++){if(i%D.rest===D.rest-1)continue;times.push(c.song.firstBeat+(c.chart.startBeat+i)*spb);if(i%2&&Math.random()<D.half)times.push(c.song.firstBeat+(c.chart.startBeat+i+.5)*spb);}}
    const D=rules.diffs[diff],laneGap=D.travel+D.judge.goodMs/1000+.2;
    const chordCounts=new Map();times.forEach(t=>chordCounts.set(t,(chordCounts.get(t)||0)+1));
    const last=Array(9).fill(-Infinity);state.notes=times.map((targetTime,id)=>{
     const free=last.map((t,lane)=>lane).filter(lane=>targetTime-last[lane]>=laneGap);
     if(!free.length)throw new Error('Chart exceeds nine independent lane windows');
     const authoredNote=authoredNotes&&authoredNotes[id];
     const lane=authoredNote?authoredNote.lane:free[Math.floor(Math.random()*free.length)];
     if(!Number.isFinite(targetTime)||!Number.isInteger(lane)||lane<0||lane>8||!free.includes(lane))throw new Error('Invalid authored lane spacing');
     last[lane]=targetTime;
     const el=document.createElement('div');el.className='rb-note';el.setAttribute('aria-hidden','true');el.hidden=true;
     const character=document.createElement('span');character.className='rb-character';character.style.setProperty('--outline-filter','url(#rb-character-outline-'+lane+')');el.appendChild(character);
     const ring=document.createElement('img');ring.className='rb-note-ring';ring.alt='';ring.draggable=false;ring.src='assets/rhythm-b/note-inner-line-'+lane+'.png';el.appendChild(ring);
     el.style.left=((26+(lane%3)*300)/952*100)+'%';el.style.top=((26+Math.floor(lane/3)*300)/2078*100)+'%';
     el.style.setProperty('--note-color',colors[lane]);board.appendChild(el);rings.push(el);
     return {id,lane,targetTime,spawnTime:targetTime-rules.diffs[diff].travel,state:'pending',el,character,ring,sound:authoredNote?authoredNote.sound:'kick',chordSize:authoredNote?authoredNote.chordSize:chordCounts.get(targetTime)};
    });
    state.hitFeedback=!!(data.song&&data.song.hitFeedback);if(state.hitFeedback)prepareHitBuffers();
    state.beats=data.song&&Array.isArray(data.song.beats)?data.song.beats:null;state.beatCursor=0;
    state.bpm=Number(data.song&&data.song.bpm)||rules.config.song.bpm;state.firstBeat=Number.isFinite(data.song&&data.song.firstBeat)?data.song.firstBeat:rules.config.song.firstBeat;
    state.duration=Math.max(data.back.duration,(times[times.length-1]||0)+rules.diffs[diff].judge.goodMs/1000);
    state.t0=context.currentTime+rules.config.countIn+.15;state.loading=false;
    showStart(0);if(!earth.getAttribute('src')){earth.src='assets/rhythm-b/earth-12s-v1104.mp4';earth.load();}updateEarth(time(),true);
    const back=context.createBufferSource();back.buffer=data.back;back.connect(context.destination);back.start(state.t0);sources.push(back);
    if(data.melody){const mel=context.createBufferSource();mel.buffer=data.melody;melodyGain=context.createGain();melodyGain.gain.value=1;mel.connect(melodyGain);melodyGain.connect(context.destination);mel.start(state.t0);sources.push(mel);}
    if(state.paused)await context.suspend();
    frame=requestAnimationFrame(tick);return true;
   }catch(e){if(token!==generation)return false;state.loading=false;state.ended=true;state.error=String(e.message||e);label('ERROR');error.hidden=false;startShade.hidden=true;stopAudio();return false;}
  }
  function pause(on){if(!state||state.ended)return;state.paused=on;if(on)earth.pause();else if(!state.loading)updateEarth(time(),true);effects.forEach(a=>{if(a.playState!=='idle'){if(on)a.pause();else a.play();}});if(context&&!state.loading){if(on)context.suspend();else context.resume();}}
  return {start,stop,pause,press,dbg:()=>state?{t:time(),diff:state.diff,practice:state.practice,loading:state.loading,paused:state.paused,ended:state.ended,error:state.error,earth:{time:earth.currentTime,duration:earth.duration,rate:earth.playbackRate,paused:earth.paused,ready:earth.readyState,progress:earthProgress,error:earthLayer.dataset.videoError||null},score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},notes:state.notes.map(n=>({id:n.id,lane:n.lane,targetTime:n.targetTime,spawnTime:n.spawnTime,state:n.state}))}:null};
 }
 MG.RhythmBPlay={create};
})(window);
