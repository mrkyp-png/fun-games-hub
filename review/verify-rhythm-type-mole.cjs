const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const feature=require('../mole/js/rhythm-type-mole.js'),R=require('../mole/js/clay-rig-runtime.js');
const html=fs.readFileSync('mole/index.html','utf8');
const scriptOrder=Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g),m=>m[1].split('?')[0]);
const entry=scriptOrder.indexOf('js/rhythm-type-mole.js');
assert(entry>scriptOrder.indexOf('js/clay-rig-math.js'),'Mole starts after rig math');
assert(entry>scriptOrder.indexOf('js/clay-rig-runtime.js'),'Mole starts after 3D engine');
assert(entry>scriptOrder.indexOf('js/rhythm-dance-beats.js'),'Analyzed music beats load before dance controller');
assert.equal(scriptOrder.filter(s=>s==='js/rhythm-type-mole.js').length,1,'One actor initializer');
const lightSource=fs.readFileSync('mole/js/rhythm-type-lighting-v1569.js','utf8');
const lampDefinition=lightSource.slice(lightSource.indexOf('  function lampState('),lightSource.indexOf('  function drawBeam('));
const fixture={calibration:{emitterDistance:35,beamCell:[384,384],beams:[[202.22,61.46,352],[181.42,64.67,352],[202.42,40.54,321],[181.31,39.72,324]]},Math};
const lampState=vm.runInNewContext('('+lampDefinition.trim()+')',fixture);
const lamps=[{x:98,y:98,phase:0,speed:.27,beam:0},{x:842,y:98,phase:2.1,speed:.22,beam:2}];
for(const time of [0,2,10,30,60]){
  const states=lamps.map((lamp,i)=>lampState(lamp,time,i));
  const beams=feature.beamUniforms({states,calibration:fixture.calibration});
  beams.forEach((beam,i)=>{
    const s=states[i],anchor=fixture.calibration.beams[s.lamp.beam],origin=feature.beamUV(beam,s.x,s.y),foot=feature.beamUV(beam,s.targetX,s.targetY);
    assert(Math.abs(origin[0]-anchor[0]/384)<.000001&&Math.abs(origin[1]-anchor[1]/384)<.000001,'3D mask lens matches actual 2D sprite apex');
    assert(Math.abs(foot[0]-anchor[0]/384)<.000001&&Math.abs(foot[1]-anchor[2]/384)<.000001,'3D mask footprint matches actual 2D beam foot');
    const outside=feature.beamUV(beam,s.targetX+Math.sin(s.angle)*s.width*2,s.targetY-Math.cos(s.angle)*s.width*2);
    assert(outside[0]>1,'Outside beam does not light the actor');
  });
}
let previous=feature.sequence(0,false);
for(let t=1/120;t<3;t+=1/120){
  const state=feature.sequence(t,false);
  assert(state.scale<=previous.scale&&state.z<previous.z,'Walk moves away while gradually shrinking');
  assert.equal(state.clip,'WalkFwd');assert(Math.abs(state.scale-previous.scale)<.002);
  previous=state;
}
assert.equal(feature.sequence(3,false).scale,.78);
assert(Math.abs(1-.78/.95-.179)<.001,'About 18% smaller on arrival');
let angle=0;
for(let t=3.35;t<5.75;t+=.01){const p=feature.sequence(t,false);assert(p.heading>=angle);angle=p.heading;assert.equal(p.z,0);}
assert(angle>2*Math.PI-.002,'One complete turn');
for(const t of [5.75,8,20]){const s=feature.sequence(t,false);assert.equal(s.phase,'idle');assert.equal(s.heading,0);assert.equal(s.z,0);assert.equal(s.scale,.78);}
assert.equal(feature.sequence(0,true).phase,'idle','Reduced motion starts in final front pose');
const turnStart=3.35,turnEnd=5.75,ringStart=feature.ringOffset(turnStart,false);
for(let time=turnStart;time<turnEnd;time+=.01){
  const turns=feature.sequence(time,false).heading/(2*Math.PI);
  assert(Math.abs(feature.ringOffset(time,false)-ringStart+100*turns)<.00001,'Stage light follows the exact mole rotation phase');
}
assert(Math.abs(feature.ringOffset(turnEnd,false)-ringStart+100)<.00001,'One fast orbit during one mole turn');
assert(Math.abs(feature.ringOffset(turnStart-.00001,false)-ringStart)<.001,'No jump when fast spin starts');
assert(Math.abs(feature.ringOffset(turnEnd+.00001,false)-feature.ringOffset(turnEnd,false))<.001,'No jump when spin ends');
assert(Math.abs(feature.ringOffset(turnEnd+12,false)-feature.ringOffset(turnEnd,false)+100)<.00001,'Return to original twelve-second orbit');
assert.equal(feature.ringOffset(10,true),0);
for(const [w,h] of [[320,740],[360,800],[390,844],[430,932]]){
  const p=feature.placement(w,h),scale=Math.max(w/941,h/1672);
  assert.equal(p.x,w/2);assert(Math.abs(p.y-((h-1672*scale)/2+1460*scale))<.001,'Feet track the original cover-image stage');
  assert(p.y<h&&p.y>h*.8);
}
const binary=fs.readFileSync('mole/assets/home3d/mole-rhythm-dance-v2.glb');
const model=R.parseGLB(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.length)),rig=R.prepare(model);
for(const clip of ['WalkFwd','Idle','Smile'])assert(rig.animations.some(c=>c.name===clip));
const skinNode=model.json.nodes.findIndex(n=>n.name==='Mole_Clay_Skin');
for(const time of [0,.5,1.5,2.99,3.1,3.36,4.55,5.74,8]){
  const s=feature.sequence(time,false),worlds=R.pose(rig,s.clip,s.clipTime,true),bones=R.palette(rig,worlds,skinNode);
  assert(bones.every(Number.isFinite),'Actual GLB animation produces finite skin matrices');
}

// Exercise the real hidden-panel controller without opening an app or browser.
const observers=[],events={},raf=new Map();let serial=0,fetches=0,uploads=0;
const gl=new Proxy({COMPILE_STATUS:1,LINK_STATUS:2,getShaderParameter:()=>true,getProgramParameter:()=>true,
  getAttribLocation:()=>0,getUniformLocation:()=>0,texImage2D(){uploads++;}}, {get:(object,key)=>key in object?object[key]:()=>({})});
const canvas={hidden:true,setAttribute(){},addEventListener(name,fn){events[name]=fn;},getContext:()=>gl};
const ring={style:{removeProperty(name){delete this[name];}}};
const panel={hidden:true,querySelector:()=>ring,appendChild(){},getBoundingClientRect:()=>({width:390,height:844})};
const screen={hidden:true,querySelector:()=>panel};
const audio={paused:false,currentTime:0};
const doc={hidden:false,currentScript:{src:'https://example.test/mole/js/rhythm-type-mole.js'},getElementById:id=>id==='rhythm-entry-bgm'?audio:screen,
  createElement:()=>canvas,addEventListener(name,fn){events[name]=fn;}};
const win={document:doc,StudioRig:R,MoleGame:{RhythmDanceBeats:require('../mole/js/rhythm-dance-beats.js')},devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}};
const atlas={width:768,height:768};
win.MG={rhythmTypeLighting:{lightFrame:()=>({states:lamps.map((lamp,i)=>lampState(lamp,2,i)),calibration:fixture.calibration,atlas})}};
const context={window:win,document:doc,URL,console,Float32Array,Uint32Array,Math,Promise,
  MutationObserver:class {constructor(fn){observers.push(fn);}observe(){}},
  requestAnimationFrame:fn=>{const id=++serial;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
  fetch:async url=>{fetches++;const b=String(url).includes('hair-mohawk')?fs.readFileSync('mole/assets/characters-v1689/hair-mohawk.glb'):binary;return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};}};
vm.runInNewContext(fs.readFileSync('mole/js/mole-appearances.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('mole/js/rhythm-type-mole.js','utf8'),context);
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
(async()=>{
  assert.equal(fetches,0,'Hidden selection does not load or animate');
  screen.hidden=panel.hidden=false;observers[0]();await flush();
  assert(win.MoleGame.RhythmTypeMole.state().ready);assert.equal(fetches,2);assert.equal(raf.size,1);
  assert.equal(ring.style.animation,'none');assert.equal(Number(ring.style.strokeDashoffset),0,'Original floor path controlled by actor timeline');
  assert.equal(uploads,1,'Beam atlas uploaded once, not every frame');
  panel.hidden=true;observers[0]();assert.equal(raf.size,0);assert(canvas.hidden,'Song/game selection stops the actor');
  panel.hidden=false;observers[0]();await flush();assert.equal(fetches,2,'Reuse model and GPU resources on return');assert.equal(raf.size,1);
  assert.equal(uploads,1,'Selection return reuses the spotlight atlas');
  doc.hidden=true;events.visibilitychange();assert.equal(raf.size,0,'Background tab pauses actor');
  doc.hidden=false;events.visibilitychange();assert.equal(raf.size,1);
  for(let frame=0;frame<90;frame++){
    audio.currentTime=frame*.1;
    const [id,callback]=raf.entries().next().value;raf.delete(id);callback(1000+frame*100);
  }
  assert.equal(win.MoleGame.RhythmTypeMole.state().phase,'dance','Real controller enters music-clock dance after arrival and spin');
  screen.hidden=true;observers[0]();assert.equal(raf.size,0,'Leaving rhythm cancels animation loop');
  console.log('PASS: 2D/3D beam mask alignment, cached atlas, shrink/full turn, GLB poses and panel lifecycle');
})().catch(error=>{console.error(error);process.exitCode=1;});
