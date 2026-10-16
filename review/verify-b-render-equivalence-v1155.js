const fs=require('fs'),cp=require('child_process'),assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
const read=(name,old)=>old?cp.execFileSync('git',['show','3590525:mole/js/'+name+'.js'],{encoding:'utf8'}):fs.readFileSync('mole/js/'+name+'.js','utf8');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const runs=[];
  for(const old of [true,false]){
   const page=await browser.newPage();await page.setViewport({width:390,height:884});
   await page.setContent('<div id="test"><div class="rb-board"></div><b data-rb-score></b><b data-rb-combo></b><div><b data-rb-judge></b></div></div>');
   await page.addScriptTag({content:read('rhythm',true)});await page.addScriptTag({content:read('rhythm-b-play',old)});
   const result=await page.evaluate(async()=>{
    const hud=document.querySelector('#test'),board=hud.querySelector('.rb-board');
    for(let i=0;i<9;i++){const e=document.createElement('div');e.className='rb-mini';e.style.setProperty('--depth-x','50%');e.style.setProperty('--depth-y','50%');e.innerHTML='<svg class="rb-wire-tunnel"><g class="rb-glass-grow"><circle/><circle/></g></svg>';board.appendChild(e);}
    // Explicit clocks and RAF order avoid host automation latency in boundary comparisons.
    let next=1;const queued=new Map();window.requestAnimationFrame=fn=>{const id=next++;queued.set(id,fn);return id;};window.cancelAnimationFrame=id=>queued.delete(id);
    const flush=()=>{const work=Array.from(queued.values());queued.clear();for(const fn of work)fn(0);};
    const ctx={currentTime:0,destination:{},createBufferSource:()=>({connect(){},start(){},stop(){}}),suspend:()=>Promise.resolve(),resume:()=>Promise.resolve()};
    const events=[{time:2,lanes:[0,1]},{time:4.4,lanes:[0,2]},{time:6.8,lanes:[3]},{time:9.2,lanes:[4,5]},{time:11.6,lanes:[6,7,8]}];
    const song={patterns:{},charts:{}};for(const d of ['EASY','NORMAL','HARD']){song.patterns[d]=events;song.charts[d]=events.flatMap(e=>e.lanes.map(()=>e.time));}
    const trace=[],spawn=[],reveals=[];let finished;const finishEffects=()=>{for(const a of document.getAnimations()){a.finish();if(a.onfinish)a.onfinish();}};
    const hidden=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
    Object.defineProperty(HTMLElement.prototype,'hidden',{...hidden,set(value){if(value===false&&hidden.get.call(this)&&this.classList.contains('rb-note'))reveals.push(!!this.style.transform&&this.style.opacity!=='');hidden.set.call(this,value);}});
    const game=MoleGame.RhythmBPlay.create({root:hud,board,rules:MoleGame.Rhythm.rules,loadSong:()=>Promise.resolve({ctx,back:{duration:14},song}),onNoteSpawn:l=>spawn.push([l,ctx.currentTime]),onFinish:(stats,clear)=>finished={stats,clear}});
    const snap=tag=>{
     const state=game.dbg();trace.push({tag,state,judge:hud.querySelector('[data-rb-judge]').textContent,has:Array.from({length:9},(_,i)=>game.hasCharacter(i)),visible:Array.from(board.querySelectorAll('.rb-note')).filter(e=>!e.hidden).map(e=>({left:e.style.left,top:e.style.top,transform:e.style.transform,opacity:e.style.opacity,progress:e.dataset.progress,sprite:e.querySelector('.rb-character').style.backgroundPosition,light:e.querySelector('.rb-character').style.getPropertyValue('--character-light'),hit:e.classList.contains('is-hit-out')})),cues:Array.from(board.querySelectorAll('.rb-mini'),e=>({active:e.classList.contains('is-note-active'),chord:e.classList.contains('is-chord-ready'),glass:e.querySelector('.rb-glass-grow').getAttribute('transform'),r:e.querySelectorAll('circle')[1].getAttribute('r')}))});
    };
    for(const diff of ['EASY','NORMAL','HARD']){
     ctx.currentTime=0;await game.start(diff,{practice:true});finished=null;
     const step=(t,tag)=>{ctx.currentTime=3.15+t;flush();snap(diff+':'+tag);};
     step(-2,'count');step(0,'go');step(.6,'endGo');
     step(2-MoleGame.Rhythm.rules.diffs[diff].travel,'firstSpawn');step(1.99,'approach');
     ctx.currentTime=5.15;trace.push({tag:diff+':P',grade:game.press(0)});snap(diff+':hit0');
     ctx.currentTime=5.15+(MoleGame.Rhythm.rules.diffs[diff].judge.perfectMs+.5)/1000;trace.push({tag:diff+':GREAT',grade:game.press(1)});snap(diff+':hit1');
     // Finish visual animations exactly; old/new must release the same hit visuals.
     finishEffects();await new Promise(r=>setTimeout(r,0));step(2.6,'flyFinished');
     step(4.4+(MoleGame.Rhythm.rules.diffs[diff].judge.greatMs+.5)/1000,'goodWindow');trace.push({tag:diff+':GOOD',grade:game.press(0)});snap(diff+':good');
     finishEffects();await new Promise(r=>setTimeout(r,0));step(5,'autoMiss');
     game.pause(true);trace.push({tag:diff+':pausedPress',grade:game.press(3)});game.pause(false);
     step(6.8,'perfect3');trace.push({tag:diff+':P3',grade:game.press(3)});
     finishEffects();await new Promise(r=>setTimeout(r,0));
     step(9.2,'chord2');game.press(4);game.press(5);
     finishEffects();await new Promise(r=>setTimeout(r,0));
     step(11.6,'chord3');for(const l of [6,7,8])game.press(l);
     finishEffects();await new Promise(r=>setTimeout(r,0));
     step(14.1,'finish');trace.push({tag:diff+':result',finished});game.stop();
    }
    song.patterns.HARD=[{time:3,lanes:[0]},{time:2.7,lanes:[1]},{time:5,lanes:[2]}];song.charts.HARD=[3,2.7,5];ctx.currentTime=0;await game.start('HARD');for(const t of [1.45,1.75,2.7,3,5,14.1]){ctx.currentTime=3.15+t;flush();snap('unordered:'+t);if(t===2.7)game.press(1);if(t===3)game.press(0);}finishEffects();game.stop();
    return {trace,spawn,reveals,domNotes:board.querySelectorAll('.rb-note').length};
   });
   runs.push(result);await page.close();
  }
  assert.deepEqual(runs[1].trace,runs[0].trace);assert.deepEqual(runs[1].spawn,runs[0].spawn);assert(runs[1].reveals.every(Boolean));
  console.log('PASS old/new identical judgement, score, note state, spawn clock, active/hit visibility, transform, opacity, sprite, glass and cues across all 3 difficulties');
  console.log('INFO original first-reveal missing initialization',runs[0].reveals.filter(v=>!v).length,'optimized',runs[1].reveals.filter(v=>!v).length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
