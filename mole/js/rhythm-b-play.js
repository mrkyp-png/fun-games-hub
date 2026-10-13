// V 1043 G: B test chart. Shared A song/rules; border reaches the native glow at targetTime.
(function (root) {
 'use strict';
 const MG=root.MoleGame;
 function create(opts) {
  const board=opts.board, rules=opts.rules, hud=opts.root;
  let state=null, context=null, sources=[], melodyGain=null, frame=0, generation=0;
  const rings=[];
  const colors=['#086aff','#ff1529','#ffc400','#05e52e','#a500ff','#ff0099','#ff7900','#00cfff','#a65121'];
  const status=document.createElement('div');status.className='rb-game-status';
  status.innerHTML=['MISS','GOOD','GREAT','PERFECT'].map(g=>'<div class="rb-total rb-total--'+g.toLowerCase()+'"><small>'+g+'</small><b data-rb-total="'+g+'">'+(g==='MISS'?'0 / 10':'0')+'</b></div>').join('');
  status.style.cssText='left:5.35%;top:95.57%;width:89.3%;height:1.925%';board.appendChild(status);
  const error= document.createElement('div');error.className='rb-load-error';error.hidden=true;error.setAttribute('role','alert');error.textContent='음악을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';board.appendChild(error);
  function time(){return state&&context?context.currentTime-state.t0:0;}
  function label(text,grade) {
   const el=hud.querySelector('[data-rb-judge]');el.textContent=text;
   const parent=el.parentElement;parent.dataset.grade=grade||'';
   parent.classList.add('is-judging');
   el.getAnimations().forEach(a=>{if(a.animationName==='rb-judge-pop')a.currentTime=0;});
  }
  function updateHud(){
   hud.querySelector('[data-rb-score]').textContent=String(state.score).padStart(6,'0');
   hud.querySelector('[data-rb-combo]').textContent=state.combo;
   for(const g of ['MISS','GOOD','GREAT','PERFECT'])hud.querySelector('[data-rb-total="'+g+'"]').textContent=g==='MISS'?state.cnt.MISS+' / 10':state.cnt[g];
  }
  function muteMelody(on){if(melodyGain&&context)melodyGain.gain.setTargetAtTime(on?1:0,context.currentTime,on?.01:.03);}
  function vibrate(ms){try{if(root.FGH&&root.FGH.Settings&&root.FGH.Settings.vibrate)root.FGH.Settings.vibrate(ms);else if(root.navigator&&root.navigator.vibrate)root.navigator.vibrate(ms);}catch(e){}}
  function stopAudio(){sources.forEach(s=>{try{s.stop();}catch(e){}});sources=[];melodyGain=null;}
  function clearRings(){rings.forEach(el=>el.remove());rings.length=0;}
  function stop(){generation++;cancelAnimationFrame(frame);stopAudio();clearRings();state=null;error.hidden=true;}
  function finish(clear){
   if(!state||state.ended)return;
   state.ended=true;cancelAnimationFrame(frame);stopAudio();rings.forEach(el=>el.hidden=true);
   opts.onFinish({score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},diff:state.diff},clear);
  }
  function miss(note){
   if(!state||state.ended)return;
   if(note){note.state='miss';note.el.hidden=true;}
   state.cnt.MISS++;state.combo=0;muteMelody(false);label('MISS','MISS');updateHud();
   if(state.cnt.MISS>=10)finish(false);
  }
  function press(lane){
   if(!state||state.ended||state.paused||time()<0)return;
   const t=time();
   let best=null,delta=Infinity;
   for(const n of state.notes){if(n.state==='pending'&&n.lane===lane&&t>=n.spawnTime){const d=Math.abs(t-n.targetTime);if(d<delta){best=n;delta=d;}}}
   if(!best){miss(null);return;}
   // Like A: an existing future note outside the input window remains pending until its deadline.
   const grade=rules.grade(delta*1000,state.diff);if(!grade)return;
   best.state='hit';best.el.hidden=true;state.cnt[grade]++;state.combo++;state.maxCombo=Math.max(state.maxCombo,state.combo);
   state.score+=rules.points(grade,state.combo);muteMelody(true);label(grade,grade);updateHud();
   vibrate(160);
  }
  function placeNote(n,p){
   const col=n.lane%3,row=Math.floor(n.lane/3),mini=hud.querySelectorAll('.rb-mini')[n.lane];
   const focusX=parseFloat(mini.style.getPropertyValue('--depth-x'))/100;
   const focusY=parseFloat(mini.style.getPropertyValue('--depth-y'))/100;
   const u=Math.pow(Math.max(0,Math.min(1,p)),1.55),scale=.075+.925*u;
   const dx=(focusX-.5)*304*(1-u),dy=(focusY-.5)*304*(1-u);
   n.el.style.transform='translate('+(dx/300*100)+'%,'+(dy/300*100)+'%) scale('+scale+')';
   n.el.style.opacity=String(.3+.7*u);
   n.el.dataset.progress=String(p);
   // Both visuals share this transform; only the ring determines judgement.
   const spriteFrame=Math.floor(Math.max(0,time()-n.spawnTime)*12)%16;
   n.character.style.backgroundPosition=(spriteFrame/15*100)+'% 0%';
   n.character.style.setProperty('--character-light',String(.7+.3*u));
  }
  function tick(){
   if(!state||state.ended)return;
   if(state.paused){frame=requestAnimationFrame(tick);return;}
   const t=time();
   if(t<0){const count=String(Math.max(1,Math.ceil(-t)));if(state.count!==count){state.count=count;label(count);}}
   else if(state.count!=='GO'){state.count='GO';label('START');}
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
   state={diff,notes:[],score:0,combo:0,maxCombo:0,cnt:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},paused:false,ended:false,loading:true,t0:Infinity,count:null};updateHud();
   try{
    const data=await opts.loadSong();if(token!==generation)return false;
    context=data.ctx;
    let times=data.song&&data.song.charts&&data.song.charts[diff];
    if(!times){const c=rules.config,spb=60/c.song.bpm,D=rules.diffs[diff];times=[];for(let i=0;i<c.chart.beats;i++){if(i%D.rest===D.rest-1)continue;times.push(c.song.firstBeat+(c.chart.startBeat+i)*spb);if(i%2&&Math.random()<D.half)times.push(c.song.firstBeat+(c.chart.startBeat+i+.5)*spb);}}
    const D=rules.diffs[diff],laneGap=D.travel+D.judge.goodMs/1000+.2;
    const last=Array(9).fill(-Infinity);state.notes=times.map((targetTime,id)=>{
     const free=last.map((t,lane)=>lane).filter(lane=>targetTime-last[lane]>=laneGap);
     if(!free.length)throw new Error('Chart exceeds nine independent lane windows');
     const lane=free[Math.floor(Math.random()*free.length)];last[lane]=targetTime;
     const el=document.createElement('div');el.className='rb-note';el.setAttribute('aria-hidden','true');el.hidden=true;
     const character=document.createElement('span');character.className='rb-character';el.appendChild(character);
     const ring=document.createElement('img');ring.className='rb-note-ring';ring.alt='';ring.draggable=false;ring.src='assets/rhythm-b/note-inner-line-'+lane+'.png';el.appendChild(ring);
     el.style.left=((26+(lane%3)*300)/952*100)+'%';el.style.top=((26+Math.floor(lane/3)*300)/2078*100)+'%';
     el.style.setProperty('--note-color',colors[lane]);board.appendChild(el);rings.push(el);
     return {id,lane,targetTime,spawnTime:targetTime-rules.diffs[diff].travel,state:'pending',el,character};
    });
    state.duration=Math.max(data.back.duration,(times[times.length-1]||0)+rules.diffs[diff].judge.goodMs/1000);
    state.t0=context.currentTime+rules.config.countIn+.15;state.loading=false;
    const back=context.createBufferSource();back.buffer=data.back;back.connect(context.destination);back.start(state.t0);sources.push(back);
    if(data.melody){const mel=context.createBufferSource();mel.buffer=data.melody;melodyGain=context.createGain();melodyGain.gain.value=1;mel.connect(melodyGain);melodyGain.connect(context.destination);mel.start(state.t0);sources.push(mel);}
    if(state.paused)await context.suspend();
    frame=requestAnimationFrame(tick);return true;
   }catch(e){if(token!==generation)return false;state.loading=false;state.ended=true;state.error=String(e.message||e);label('ERROR');error.hidden=false;stopAudio();return false;}
  }
  function pause(on){if(!state||state.ended)return;state.paused=on;if(context&&!state.loading){if(on)context.suspend();else context.resume();}}
  return {start,stop,pause,press,dbg:()=>state?{t:time(),diff:state.diff,loading:state.loading,paused:state.paused,ended:state.ended,error:state.error,score:state.score,combo:state.combo,maxCombo:state.maxCombo,cnt:{...state.cnt},notes:state.notes.map(n=>({id:n.id,lane:n.lane,targetTime:n.targetTime,spawnTime:n.spawnTime,state:n.state}))}:null};
 }
 MG.RhythmBPlay={create};
})(window);
