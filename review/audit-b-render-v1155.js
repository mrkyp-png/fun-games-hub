const fs=require('fs'),cp=require('child_process'),puppeteer=require('puppeteer-core');
const chart=JSON.parse(fs.readFileSync('mole/audio/rp/meet-me-halfway.json','utf8'));
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const report=[];
 try{
  for(const variant of ['before','after','afterRepeat','beforeRepeat']){
   const old=variant.startsWith('before'),p=await browser.newPage();
   await p.setViewport({width:390,height:884,isMobile:true,hasTouch:true,deviceScaleFactor:2});
   await p.goto('http://localhost:8846/mole/style.css');await p.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><base href="http://localhost:8846/mole/"><div class="rb-screen"><div class="rb-board"></div></div>');
   await p.addStyleTag({path:'mole/style.css'});
   for(const name of ['rhythm','rhythm-b-routes','rhythm-b-flow','rhythm-b-play','rhythm-b']){let code=old?cp.execFileSync('git',['show','3590525:mole/js/'+name+'.js'],{encoding:'utf8'}):fs.readFileSync('mole/js/'+name+'.js','utf8');await p.addScriptTag({content:code});}
   await p.evaluate(async chart=>{
    let seed=123;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    window.epoch=performance.now();window.offset=0;window.clockOverride=null;
    const ctx={get currentTime(){return clockOverride===null?(performance.now()-epoch)/1000+offset:clockOverride;},destination:{},createBufferSource:()=>({connect(){},start(){},stop(){}}),suspend:()=>Promise.resolve(),resume:()=>Promise.resolve()};
    window.view=MoleGame.RhythmB.create({root:document.querySelector('.rb-screen'),rules:MoleGame.Rhythm.rules,loadSong:()=>Promise.resolve({ctx,back:{duration:chart.length},song:chart}),onPause(){},onResult(){}});
    await view.open('HARD',{practice:true});window.songZero=ctx.currentTime-view.dbg().t;epoch=performance.now();offset=songZero+48;
    for(const event of chart.patterns.HARD){if(event.time<48||event.time>53)continue;setTimeout(()=>{clockOverride=songZero+event.time;for(const lane of event.lanes){const hit=document.querySelectorAll('.rb-hit')[lane];hit.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));setTimeout(()=>hit.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true})),70);}clockOverride=null;},(event.time-48-.08)*1000);}
   },chart);
   await new Promise(r=>setTimeout(r,300));
   const client=await p.createCDPSession();await client.send('Performance.enable');const before=(await client.send('Performance.getMetrics')).metrics;
   const data=await p.evaluate(()=>new Promise(resolve=>{
    let creates=0,toggles=0;const create=document.createElement.bind(document),toggle=DOMTokenList.prototype.toggle;
    document.createElement=(...args)=>{creates++;return create(...args);};DOMTokenList.prototype.toggle=function(...args){toggles++;return toggle.apply(this,args);};
    const start=performance.now(),deltas=[];let last=start;
    function sample(t){deltas.push(t-last);last=t;if(t-start<5000)requestAnimationFrame(sample);else{document.createElement=create;DOMTokenList.prototype.toggle=toggle;const sorted=deltas.slice(2).sort((a,b)=>a-b);resolve({frames:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],over50:sorted.filter(x=>x>50).length,average:sorted.reduce((a,b)=>a+b,0)/sorted.length,dom:document.querySelectorAll('*').length,noteDOM:document.querySelectorAll('.rb-note').length,createsDuringPlay:creates,classToggleCalls:toggles,judgements:view.dbg().cnt});}}requestAnimationFrame(sample);
   }));
   const after=(await client.send('Performance.getMetrics')).metrics,delta=k=>(after.find(m=>m.name===k).value-before.find(m=>m.name===k).value)*1000;
   const row={variant,...data,styleMs:delta('RecalcStyleDuration'),layoutMs:delta('LayoutDuration'),taskMs:delta('TaskDuration'),heapBytes:after.find(m=>m.name==='JSHeapUsedSize').value};report.push(row);console.log(JSON.stringify(row));
   await p.evaluate(()=>view.stop());await p.close();
  }
  fs.writeFileSync('review/b-render-audit-v1155.json',JSON.stringify({environment:'Edge headless mobile 390x884 DPR2; same full HARD chart; measured 48.3-53.3s; 70ms held inputs; seeded randomness; synthetic audio clock aligned to actual t0; scheduled80ms early with exact-target press clock to equalize effects; sequential before/after/after/before; not physical phone',report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
