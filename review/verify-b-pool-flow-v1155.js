const fs=require('fs'),cp=require('child_process'),assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
const code=(name,old)=>old?cp.execFileSync('git',['show','3590525:mole/js/'+name+'.js'],{encoding:'utf8'}):fs.readFileSync('mole/js/'+name+'.js','utf8');
(async()=>{const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const flowRuns=[];
 for(const old of [true,false]){
  const p=await browser.newPage();await p.setContent('<div id="test" style="width:952px;height:2078px"></div>');
  await p.addScriptTag({content:code('rhythm',true)});await p.addScriptTag({content:code('rhythm-b-routes',true)});await p.addScriptTag({content:code('rhythm-b-flow',old)});
  flowRuns.push(await p.evaluate(()=>{
   const queue=new Map();let next=1,now=0;window.requestAnimationFrame=fn=>{const id=next++;queue.set(id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);Object.defineProperty(performance,'now',{value:()=>now});Math.random=()=>.5;
   const originalClear=CanvasRenderingContext2D.prototype.clearRect,originalMove=CanvasRenderingContext2D.prototype.moveTo,originalLine=CanvasRenderingContext2D.prototype.lineTo,lines=[],clears=[];let collecting=false;
   CanvasRenderingContext2D.prototype.clearRect=function(...args){if(collecting)clears.push(this.canvas.dataset.cell);return originalClear.apply(this,args);};
   CanvasRenderingContext2D.prototype.moveTo=function(x,y){if(collecting)lines.push(['M',x,y]);return originalMove.call(this,x,y);};
   CanvasRenderingContext2D.prototype.lineTo=function(x,y){if(collecting)lines.push(['L',x,y]);return originalLine.call(this,x,y);};
   const colors=Array(9).fill('#00cfff'),fx=MoleGame.RhythmBFlow.create({board:document.querySelector('#test'),colors});fx.start();collecting=true;fx.press(4,true);
   for(let i=0;i<10;i++){now+=30;const list=Array.from(queue.values());queue.clear();for(const fn of list)fn(now);}
   collecting=false;fx.press(4,false);const ended=fx.dbg().pressed;fx.stop();return {lines,clears,ended,queued:queue.size};
  }));await p.close();
 }
 assert.deepEqual(flowRuns[1].lines,flowRuns[0].lines);assert(flowRuns[1].clears.every(x=>x==='4'));assert.equal(flowRuns[0].clears.length,flowRuns[1].clears.length*9);assert(flowRuns[1].ended.every(x=>!x));assert.equal(flowRuns[1].queued,0);
 console.log('PASS circuit path coordinates unchanged; held-button canvas clears',flowRuns[0].clears.length,'->',flowRuns[1].clears.length,'all inactive canvases untouched');
 const p=await browser.newPage();await p.setContent('<div id="test"><div class="rb-board"></div><b data-rb-score></b><b data-rb-combo></b><div><b data-rb-judge></b></div></div>');
 await p.addScriptTag({content:code('rhythm',true)});await p.addScriptTag({content:code('rhythm-b-play',false)});
 const result=await p.evaluate(async()=>{
  const hud=document.querySelector('#test'),board=hud.querySelector('.rb-board');for(let i=0;i<9;i++){const mini=document.createElement('div');mini.className='rb-mini';mini.style.setProperty('--depth-x','50%');mini.style.setProperty('--depth-y','50%');board.appendChild(mini);}
  let next=1;const queue=new Map();window.requestAnimationFrame=fn=>{const id=next++;queue.set(id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);const flush=()=>{const list=Array.from(queue.values());queue.clear();for(const fn of list)fn(0);};
  const ctx={currentTime:0,destination:{},createBufferSource:()=>({connect(){},start(){},stop(){}}),suspend:()=>Promise.resolve(),resume:()=>Promise.resolve()},events=Array.from({length:70},(_,i)=>({time:2+i*.5,lanes:[i%9,(i+4)%9]}));
  const song={patterns:{HARD:events},charts:{HARD:events.flatMap(e=>e.lanes.map(()=>e.time))}};let finishes=0;
  const game=MoleGame.RhythmBPlay.create({root:hud,board,rules:MoleGame.Rhythm.rules,loadSong:()=>Promise.resolve({ctx,back:{duration:40},song}),onFinish(){finishes++;}}),counts=[];const slots=new Set();
  for(let round=0;round<3;round++){
   ctx.currentTime=0;await game.start('HARD',{practice:true});game.pause(true);if(queue.size!==0)throw Error('paused RAF kept running');game.pause(false);game.pause(false);if(queue.size!==1)throw Error('resume scheduled duplicate RAF');let created=0,peakConnected=0;const create=document.createElement.bind(document);document.createElement=(...args)=>{created++;return create(...args);};
   for(const event of events){ctx.currentTime=3.15+event.time;flush();peakConnected=Math.max(peakConnected,board.querySelectorAll('.rb-note').length);for(const el of board.querySelectorAll('.rb-note'))slots.add(el);for(const lane of event.lanes)game.press(lane);for(const a of document.getAnimations()){a.finish();if(a.onfinish)a.onfinish();}}
   document.createElement=create;ctx.currentTime=43.2;flush();counts.push({nodes:board.querySelectorAll('.rb-note').length,peakConnected,createdDuringPlay:created,perfect:game.dbg().cnt.PERFECT});for(const el of board.querySelectorAll('.rb-note'))slots.add(el);game.stop();
   if(Array.from(board.querySelectorAll('.rb-note')).some(e=>!e.hidden))throw Error('pool left visible after stop');
  }
  ctx.currentTime=0;await game.start('HARD');ctx.currentTime=5.15;flush();game.press(0);const oldEl=board.querySelector('.rb-note[data-note-id="0"]'),oldDone=oldEl.querySelector('.rb-character').getAnimations()[0].onfinish;game.stop();ctx.currentTime=0;await game.start('HARD');ctx.currentTime=4.65;flush();const newEl=board.querySelector('.rb-note[data-note-id="0"]');if(oldEl!==newEl)throw Error('slot not reused');oldDone();if(newEl.hidden||newEl.classList.contains('is-hit-out'))throw Error('stale animation hid/reused the new note');game.stop();
  return {counts,uniqueSlots:slots.size,finishes,queued:queue.size,staleCallbackSafe:true};
 });
 assert(result.counts.every(r=>r.nodes===0&&r.peakConnected<=18&&r.createdDuringPlay===0&&r.perfect===140));assert.equal(result.uniqueSlots,140);assert.equal(result.finishes,3);assert.equal(result.queued,0);console.log('PASS 3 full rounds reuse same140 per-note slots, no gameplay DOM creation, all140 hits/round, only visible nodes connected; stop detaches all slots and cancels RAF',result);await p.close();
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
