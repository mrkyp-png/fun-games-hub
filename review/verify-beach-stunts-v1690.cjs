const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),R=require('../mole/js/clay-rig-runtime.js');
const read=p=>fs.readFileSync(path.join(__dirname,'../mole',p));
const win={StudioRig:R,MoleGame:{}},context={window:win,console,fetch:async p=>{const b=read(p);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}}};
for(const p of ['js/mole-appearances.js','js/rhythm-beach-stunts.js'])vm.runInNewContext(read(p).toString(),context);
const FX=win.MoleGame.RhythmBeachStunts,AP=win.MoleGame.MoleAppearances;
for(const combo of [0,1,9,11,19,99])assert(!FX.cue({jumpAt:0},combo,.19,.42));
for(const [combo,kind] of [[10,'coin'],[20,'flip'],[30,'coin'],[90,'coin'],[100,'both'],[110,'coin'],[200,'both']]){
 const m={jumpAt:0};assert(FX.cue(m,combo,.19,.42));assert.equal(m.beachStunt.kind,kind);assert(!FX.sample(m,.20).active,'Wait until descent');
 assert(FX.sample(m,.30).active);assert(!FX.sample(m,.42).active,'Finish before landing');
 const pivot=[0,1.25,0],base=R.transform({translation:[12,25,0],scale:[3,3,3]}),expected=R.point(base,pivot);
 for(let t=.21;t<.42;t+=.005){const state=FX.sample(m,t),mat=FX.turn(base,pivot,state),point=R.point(mat,pivot);assert(point.every((v,i)=>Math.abs(v-expected[i])<.0001),'Rotation pivot does not drift');assert(Array.from(mat).every(Number.isFinite));}
 const end=FX.sample(m,.42);assert.equal(end.yaw,0);assert.equal(end.pitch,0);m.jumpAt=.30;assert(!FX.sample(m,.32).active,'A new jump cancels an old turn');
}
const both={jumpAt:0};FX.cue(both,100,.19,.42);const halfway=FX.sample(both,.315);assert(Math.abs(halfway.yaw-2*Math.PI)<1e-7);assert(Math.abs(halfway.pitch)<1e-7);
const rise=FX.hairMotion(.105,0,.42),fall=FX.hairMotion(.315,0,.42);assert(rise.bend<-.7&&fall.bend>.7,'Exaggerated bend changes direction');assert(rise.stretch<.78&&fall.stretch>1.22,'Visible compression/extension');assert(FX.hairMotion(.50,0,.42).bend!==0,'Brief landing bounce');
(async()=>{
 const b=read('assets/home3d/mole-clay-v47-smile.glb'),model=await AP.prepare(R.parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.length))),rig=R.prepare(model),nodes=model.json.nodes,clip=rig.animations.find(a=>a.name==='Jump');
 for(const id of AP.styles){
  let motionDistance=0;
  for(const p of [0,.1,.25,.5,.75,.9,1,1.3,1.7]){
   const time=p*.42,worlds=AP.pose(rig,'Jump',Math.min(p,1)*clip.duration,false,AP.face(rig),time,id),baseline=worlds.map(m=>new Float32Array(m));FX.hair(rig,worlds,id,FX.hairMotion(time,0,.42,id));
   nodes.forEach((n,k)=>{assert(Array.from(worlds[k]).every(Number.isFinite));if(n.extras?.appearanceStyle!==id)return;
    if(/_Root$/.test(n.name)){const distance=Math.hypot(...Array.from(worlds[k].slice(12,15),(v,i)=>v-baseline[k][12+i]));if(id==='curly'&&p===.5)assert(distance>.70,'Curly wig visibly lifts off');else if(id!=='curly'||p===0||p>=1)assert(distance<1e-5,'Scalp roots attached except intentional curly wig');}
    if(/_(Mid|Tip)$/.test(n.name))motionDistance+=Math.hypot(...Array.from(worlds[k].slice(12,15),(v,i)=>v-baseline[k][12+i]));
   });
   for(let k=0;k<nodes.length;k++)if(nodes[k].skin!==undefined)assert(Array.from(R.palette(rig,worlds,k)).every(Number.isFinite));
   if(p===0||p>=1.7)for(let k=0;k<worlds.length;k++)assert(worlds[k].every((v,i)=>v===baseline[k][i]),'Resting pose fully restored');
  }assert(motionDistance>.25,id+' has visible actual joint movement');
  if(id==='forelock'){
   for(const phase of [.25,.75,1]){const w=AP.pose(rig,'Idle',0,true,AP.face(rig),0,id),head=nodes.findIndex(n=>n.name==='Head'),tip=nodes.findIndex(n=>n.name==='Forelock_Tip'),inv=R.inverse(w[head]),before=R.point(inv,Array.from(w[tip].slice(12,15)));FX.hair(rig,w,id,FX.hairMotion(phase*.42,0,.42,id));const after=R.point(inv,Array.from(w[tip].slice(12,15)));
    if(phase===.25){assert(after[1]<before[1]-.15);assert(after[2]>before[2]+.08,'Rising forelock bends down in front of face');}
    if(phase===.75)assert(after[1]>before[1]+.07,'Descending forelock straightens up');
    if(phase===1)assert(after.every((v,k)=>Math.abs(v-before[k])<1e-6),'Forelock fully restored at landing');
   }
  }
 }
 const source=read('js/rhythm.js').toString(),hit=source.slice(source.indexOf('    function hit('),source.indexOf('    function miss('));assert(hit.includes('MG.RhythmBeachStunts.cue(st.moles[lane],st.combo,n.hitAt,'));
 const html=read('index.html').toString();assert(html.indexOf('src="js/rhythm-beach-stunts.js')<html.indexOf('src="js/rhythm-beach-moles.js'));
 console.log('PASS: 10/20 alternation, 100 combined turn, descent-only, no pivot drift, landing/new-jump reset; all four real hair rigs strongly react; curly wig lifts and reseats; other roots remain attached; finite skin palettes. Browser visuals not verified.');
})().catch(e=>{console.error(e);process.exitCode=1});
