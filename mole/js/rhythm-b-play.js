// V 1043 G: B test chart. Shared A song/rules; border reaches the native glow at targetTime.
(function (root) {
 'use strict';
 const MG=root.MoleGame;
 function create(opts) {
  const board=opts.board, rules=opts.rules, hud=opts.root;
  let state=null, context=null, sources=[], melodyGain=null, frame=0, generation=0;
  const rings=[];
  const effects=new Set(),pangAnimations=Array(9).fill(null);
  let startAnimation=null;
  const colors=['#086aff','#ff1529','#ffc400','#05e52e','#a500ff','#ff0099','#ff7900','#00cfff','#a65121'];
  const outlineDefs=document.createElementNS('http://www.w3.org/2000/svg','svg');outlineDefs.setAttribute('width','0');outlineDefs.setAttribute('height','0');outlineDefs.style.position='absolute';outlineDefs.setAttribute('aria-hidden','true');
  outlineDefs.innerHTML='<defs>'+colors.map((color,i)=>'<filter id="rb-character-outline-'+i+'" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="wide"/><feComposite in="wide" in2="SourceAlpha" operator="out" result="edge"/><feFlood flood-color="'+color+'"/><feComposite in2="edge" operator="in" result="line"/><feGaussianBlur in="line" stdDeviation="2" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="line"/></feMerge></filter>').join('')+'</defs>';board.appendChild(outlineDefs);
  const holoLights=colors.map((color,lane)=>{const el=document.createElement('div');el.className='rb-holo-light';el.setAttribute('aria-hidden','true');el.style.cssText='left:'+((24+(lane%3)*300)/952*100)+'%;top:'+((24+Math.floor(lane/3)*300)/2078*100)+'%;width:'+(304/952*100)+'%;height:'+(304/2078*100)+'%;--holo-color:'+color;board.appendChild(el);return el;});
  function darkenLane(lane){holoLights[lane].style.opacity='0';}
  function clearLights(){holoLights.forEach((_,i)=>darkenLane(i));}
  const pangs=colors.map((_,lane)=>{const el=document.createElement('span');el.className='rb-pang';el.textContent='PANG!';el.hidden=true;el.setAttribute('aria-hidden','true');el.style.left=((176+(lane%3)*300)/952*100)+'%';el.style.top=((176+Math.floor(lane/3)*300)/2078*100)+'%';board.appendChild(el);return el;});
  const startCallout=document.createElement('div');startCallout.className='rb-start-callout';startCallout.hidden=true;startCallout.setAttribute('aria-hidden','true');board.appendChild(startCallout);
  function animateEffect(el,keyframes,duration,done){const a=el.animate(keyframes,{duration,easing:'ease-out'});effects.add(a);a.onfinish=()=>{effects.delete(a);if(done)done();};a.oncancel=()=>effects.delete(a);return a;}
  function clearEffects(){for(const a of effects)a.cancel();effects.clear();pangs.forEach(el=>el.hidden=true);pangAnimations.fill(null);startAnimation=null;startCallout.hidden=true;}
  function showStart(stage){
   if(state.startPhase===stage)return;state.startPhase=stage;
   if(startAnimation)startAnimation.cancel();
   const scale=[.72,.9,1.08,1.16][stage];
   startCallout.textContent=stage===3?'GO!':'ARE YOU READY?';startCallout.dataset.stage=String(stage);
   startCallout.style.color=['#43dcff','#fff05b','#ff5ba9','#56ff88'][stage];startCallout.hidden=false;
   const still=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const a=animateEffect(startCallout,still?[{opacity:1},{opacity:1}]:[
    {transform:'translate(-50%,-50%) scale('+(scale*.88)+')',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) scale('+scale+')',opacity:1,offset:.15},
    {transform:'translate(-50%,-50%) scale('+scale+')',opacity:1,offset:.75},
    {transform:'translate(-50%,-50%) scale('+scale+')',opacity:0,offset:1}
   ],stage===3?500:800,()=>{if(startAnimation===a){startCallout.hidden=true;startAnimation=null;}});
   startAnimation=a;
  }
  function successEffect(n,t){
   n.el.hidden=false;placeNote(n,(t-n.spawnTime)/rules.diffs[state.diff].travel);
   n.ring.hidden=true;n.el.classList.add('is-hit-out');
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
  status.style.cssText='left:5.35%;top:95.57%;width:89.3%;height:1.925%';board.appendChild(status);
  const error= document.createElement('div');error.className='rb-load-error';error.hidden=true;error.setAttribute('role','alert');error.textContent='게임 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';board.appendChild(error);
  const scoreEl=hud.querySelector('[data-rb-score]'),comboEl=hud.querySelector('[data-rb-combo]'),judgeEl=hud.querySelector('[data-rb-judge]');
  const totalEls=Object.fromEntries(['MISS','GOOD','GREAT','PERFECT'].map(g=>[g,hud.querySelector('[data-rb-total="'+g+'"]')]));
  const foci=Array.from(hud.querySelectorAll('.rb-mini'),mini=>({x:parseFloat(mini.style.getPropertyValue('--depth-x'))/100,y:parseFloat(mini.style.getPropertyValue('--depth-y'))/100}));
  function time(){return state&&context?context.currentTime-state.t0:0;}
  function label(text,grade) {
   const el=judgeEl;el.textContent=text;
   const parent=el.parentElement;parent.dataset.grade=grade||'';
   parent.classList.add('is-judging');
   el.getAnimations().forEach(a=>{if(a.animationName==='rb-judge-pop')a.currentTime=0;});
  }
  function updateHud(){
   scoreEl.textContent=String(state.score).padStart(6,'0');
   comboEl.textContent=state.combo;
   for(const g of ['MISS','GOOD','GREAT','PERFECT'])totalEls[g].textContent=g==='MISS'?state.cnt.MISS+' / 10':state.cnt[g];
  }
  function muteMelody(on){if(melodyGain&&context)melodyGain.gain.setTargetAtTime(on?1:0,context.currentTime,on?.01:.03);}
  function vibrate(ms){try{if(root.FGH&&root.FGH.Settings&&root.FGH.Settings.vibrate)root.FGH.Settings.vibrate(ms);else if(root.navigator&&root.navigator.vibrate)root.navigator.vibrate(ms);}catch(e){}}
  function stopAudio(){sources.forEach(s=>{try{s.stop();}catch(e){}});sources=[];melodyGain=null;}
  function clearRings(){rings.forEach(el=>el.remove());rings.length=0;}
  function stop(){generation++;cancelAnimationFrame(frame);stopAudio();clearEffects();clearRings();clearLights();state=null;error.hidden=true;}
  function finish(clear){
   if(!state||state.ended)return;
   state.ended=true;clearLights();cancelAnimationFrame(frame);stopAudio();clearEffects();rings.forEach(el=>el.hidden=true);
   opts.onFinish({score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},diff:state.diff},clear);
  }
  function miss(note){
   if(!state||state.ended)return;
   if(!note||note.state!=='pending')return;
   note.state='miss';note.el.hidden=true;darkenLane(note.lane);
   state.cnt.MISS++;state.combo=0;muteMelody(false);label('MISS','MISS');updateHud();
   if(state.cnt.MISS>=10)finish(false);
  }
  function press(lane){
   if(!state||state.ended||state.paused||time()<0)return;
   const t=time();
   let best=null,delta=Infinity;
   for(const n of state.notes){if(n.state==='pending'&&n.lane===lane&&t>=n.spawnTime){const d=Math.abs(t-n.targetTime);if(d<delta){best=n;delta=d;}}}
   if(!best)return; // Empty input never changes score, combo, or MISS.
   // Like A: an existing future note outside the input window remains pending until its deadline.
   const grade=rules.grade(delta*1000,state.diff);if(!grade)return;
   best.state='hit';successEffect(best,t);darkenLane(best.lane);state.cnt[grade]++;state.combo++;state.maxCombo=Math.max(state.maxCombo,state.combo);
   state.score+=rules.points(grade,state.combo);muteMelody(true);label(grade,grade);updateHud();
   vibrate(160);
   if(opts.onHit)opts.onHit(lane,grade);
  }
  function placeNote(n,p){
   const focusX=foci[n.lane].x,focusY=foci[n.lane].y;
   const u=Math.pow(Math.max(0,Math.min(1,p)),1.55),scale=.075+.925*u;
   const dx=(focusX-.5)*304*(1-u),dy=(focusY-.5)*304*(1-u);
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
   if(t<0){const stage=Math.max(0,Math.min(2,Math.floor((t+rules.config.countIn+.15)/((rules.config.countIn+.15)/3))));showStart(stage);const count=String(3-stage);if(state.count!==count){state.count=count;label(count);}}
   else if(state.count!=='GO'){state.count='GO';label('GO!');showStart(3);}
   if(t>=.6)startCallout.hidden=true;
   const D=rules.diffs[state.diff];
   for(const n of state.notes){
    if(state.ended)break;
    if(n.state!=='pending')continue;
    if(t>n.targetTime+D.judge.goodMs/1000){miss(n);continue;}
    if(t>=n.spawnTime){n.el.hidden=false;placeNote(n,(t-n.spawnTime)/D.travel);}
   }
   if(!state.ended&&t>=state.duration)finish(true);
   if(!state.ended)frame=requestAnimationFrame(tick);
  }
  async function start(diff){
   stop();const token=generation;error.hidden=true;label('LOADING');
   state={diff,notes:[],score:0,combo:0,maxCombo:0,cnt:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},paused:false,ended:false,loading:true,t0:Infinity,count:null,startPhase:-1};updateHud();
   try{
    const [data]=await Promise.all([opts.loadSong(),opts.prepareAssets?opts.prepareAssets():Promise.resolve()]);if(token!==generation)return false;
    context=data.ctx;
    let times=data.song&&data.song.charts&&data.song.charts[diff];
    if(!times){const c=rules.config,spb=60/c.song.bpm,D=rules.diffs[diff];times=[];for(let i=0;i<c.chart.beats;i++){if(i%D.rest===D.rest-1)continue;times.push(c.song.firstBeat+(c.chart.startBeat+i)*spb);if(i%2&&Math.random()<D.half)times.push(c.song.firstBeat+(c.chart.startBeat+i+.5)*spb);}}
    const D=rules.diffs[diff],laneGap=D.travel+D.judge.goodMs/1000+.2;
    const last=Array(9).fill(-Infinity);state.notes=times.map((targetTime,id)=>{
     const free=last.map((t,lane)=>lane).filter(lane=>targetTime-last[lane]>=laneGap);
     if(!free.length)throw new Error('Chart exceeds nine independent lane windows');
     const lane=free[Math.floor(Math.random()*free.length)];last[lane]=targetTime;
     const el=document.createElement('div');el.className='rb-note';el.setAttribute('aria-hidden','true');el.hidden=true;
     const character=document.createElement('span');character.className='rb-character';character.style.setProperty('--outline-filter','url(#rb-character-outline-'+lane+')');el.appendChild(character);
     const ring=document.createElement('img');ring.className='rb-note-ring';ring.alt='';ring.draggable=false;ring.src='assets/rhythm-b/note-inner-line-'+lane+'.png';el.appendChild(ring);
     el.style.left=((26+(lane%3)*300)/952*100)+'%';el.style.top=((26+Math.floor(lane/3)*300)/2078*100)+'%';
     el.style.setProperty('--note-color',colors[lane]);board.appendChild(el);rings.push(el);
     return {id,lane,targetTime,spawnTime:targetTime-rules.diffs[diff].travel,state:'pending',el,character,ring};
    });
    state.duration=Math.max(data.back.duration,(times[times.length-1]||0)+rules.diffs[diff].judge.goodMs/1000);
    state.t0=context.currentTime+rules.config.countIn+.15;state.loading=false;
    showStart(0);
    const back=context.createBufferSource();back.buffer=data.back;back.connect(context.destination);back.start(state.t0);sources.push(back);
    if(data.melody){const mel=context.createBufferSource();mel.buffer=data.melody;melodyGain=context.createGain();melodyGain.gain.value=1;mel.connect(melodyGain);melodyGain.connect(context.destination);mel.start(state.t0);sources.push(mel);}
    if(state.paused)await context.suspend();
    frame=requestAnimationFrame(tick);return true;
   }catch(e){if(token!==generation)return false;state.loading=false;state.ended=true;state.error=String(e.message||e);label('ERROR');error.hidden=false;stopAudio();return false;}
  }
  function pause(on){if(!state||state.ended)return;state.paused=on;effects.forEach(a=>on?a.pause():a.play());if(context&&!state.loading){if(on)context.suspend();else context.resume();}}
  return {start,stop,pause,press,dbg:()=>state?{t:time(),diff:state.diff,loading:state.loading,paused:state.paused,ended:state.ended,error:state.error,score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},notes:state.notes.map(n=>({id:n.id,lane:n.lane,targetTime:n.targetTime,spawnTime:n.spawnTime,state:n.state}))}:null};
 }
 MG.RhythmBPlay={create};
})(window);
