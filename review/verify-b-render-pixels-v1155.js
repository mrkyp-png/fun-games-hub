const fs=require('fs'),cp=require('child_process'),puppeteer=require('puppeteer-core');
const chart=JSON.parse(fs.readFileSync('mole/audio/rp/meet-me-halfway.json','utf8'));
(async()=>{const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 for(const old of [true,false]){
  const p=await b.newPage();await p.setViewport({width:390,height:884,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await p.goto('http://localhost:8846/mole/style.css');await p.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><base href="http://localhost:8846/mole/"><div class="rb-screen"><div class="rb-board"></div></div>');await p.addStyleTag({path:'mole/style.css'});
  for(const name of ['rhythm','rhythm-b-routes','rhythm-b-flow','rhythm-b-play','rhythm-b'])await p.addScriptTag({content:old?cp.execFileSync('git',['show','3590525:mole/js/'+name+'.js'],{encoding:'utf8'}):fs.readFileSync('mole/js/'+name+'.js','utf8')});
  await p.evaluate(async chart=>{
   Math.random=()=>.5;window.fxNow=0;Object.defineProperty(performance,'now',{value:()=>fxNow});const queued=new Map();let next=1;window.requestAnimationFrame=fn=>{const id=next++;queued.set(id,fn);return id;};window.cancelAnimationFrame=id=>queued.delete(id);
   window.clock={currentTime:0,destination:{},createBufferSource:()=>({connect(){},start(){},stop(){}}),suspend:()=>Promise.resolve(),resume:()=>Promise.resolve()};
   window.view=MoleGame.RhythmB.create({root:document.querySelector('.rb-screen'),rules:MoleGame.Rhythm.rules,loadSong:()=>Promise.resolve({ctx:clock,back:{duration:chart.length},song:chart}),onPause(){},onResult(){}});await view.open('HARD',{practice:true});
   window.renderStep=(time,animationTime)=>{clock.currentTime=3.15+time;fxNow=time*1000;const list=Array.from(queued.values());queued.clear();for(const fn of list)fn(fxNow);for(const a of document.getAnimations()){a.pause();a.currentTime=animationTime;}};
  },chart);
  await new Promise(r=>setTimeout(r,80));const first=await p.evaluate(()=>view.dbg().notes[0]);
  for(const [tag,t]of [['spawn',first.spawnTime+.05],['approach',first.targetTime-.2]]){await p.evaluate(t=>renderStep(t,0),t);await p.screenshot({path:'review/render-v1155-'+(old?'before':'after')+'-'+tag+'.png'});}
  await p.evaluate(n=>{renderStep(n.targetTime,0);document.querySelectorAll('.rb-hit')[n.lane].dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));renderStep(n.targetTime+.1,100);},first);await p.screenshot({path:'review/render-v1155-'+(old?'before':'after')+'-hit.png'});
  await p.evaluate(events=>{for(let i=1;i<10;i++){for(const a of document.getAnimations()){a.finish();if(a.onfinish)a.onfinish();}renderStep(events[i].time,0);for(const lane of events[i].lanes){const h=document.querySelectorAll('.rb-hit')[lane];h.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));h.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));}renderStep(events[i].time+.05,100);}if(view.dbg().combo!==10)throw Error('combo10 not reached');},chart.patterns.HARD);await p.screenshot({path:'review/render-v1155-'+(old?'before':'after')+'-combo.png'});
  await p.evaluate(()=>view.stop());await p.screenshot({path:'review/render-v1155-'+(old?'before':'after')+'-stop.png'});await p.close();
 }
 console.log('CAPTURED before/after identical clocks and animation phases: spawn/approach/hit/combo/stop');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
