const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const R=require('../mole/js/clay-rig-runtime.js'),F=require('../mole/js/rhythm-type-mole.js'),map=require('../mole/js/rhythm-dance-beats.js');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('mole/audio/rhythm-entry.mp3')).digest('hex'),map.sha256);
for(let i=0;i<map.beats.length;i++){
  if(i)assert(map.beats[i]>map.beats[i-1]);
  assert(Math.abs(F.beatAt(map.beats[i],map)-i)<.00001,'Authored dance beat lands on measured audio onset');
}
assert.equal(F.dancePose(7.9,8,false),null);
assert.equal(F.dancePose(8,8,false).clip,'DanceFreestyle');
assert.equal(F.dancePose(16,8,false).clip,'DanceFreestyle');
assert.equal(F.dancePose(24,8,false).clip,'DanceFreestyle');
assert.equal(F.dancePose(32,8,false).clip,'DanceFreestyle');
assert.equal(F.dancePose(20,8,true),null);
const bytes=fs.readFileSync('mole/assets/home3d/mole-rhythm-dance-v2.glb');
const model=R.parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)),rig=R.prepare(model);
assert.equal(rig.skins[0].joints.length,48);
const index=name=>model.json.nodes.findIndex(n=>n.name===name);
function value(clip,node,path,time){const track=clip.tracks.find(t=>t.node===index(node)&&t.path===path);return track?R.sample(track,time):model.json.nodes[index(node)][path];}
const expressions=new Set(),eyeStates=new Set(),tonguePositions=[];let furFrames=0,armLowFrames=0;
for(const name of ['DanceFreestyle']){
  const clip=rig.animations.find(c=>c.name===name);assert(clip);assert.equal(clip.duration,16);
  for(let time=0;time<=16;time+=1/48){
    const worlds=R.pose(rig,name,time,false);assert(worlds.every(m=>m.every(Number.isFinite)));
    for(const side of ['.L','.R']){
      const raised=worlds[index('Hand'+side)][13]-worlds[index('UpperArm'+side)][13];
      const fur=value(clip,'Armpit'+side,'scale',time)[0];
      if(raised<=0){assert(fur<.0001,'Fur hidden when hand is below shoulder');armLowFrames++;}
      if(fur>.5){assert(raised>0,'Visible fur only under a raised arm');furFrames++;}
    }
    expressions.add(['Eye.L','Eye.R','Tongue'].map(n=>value(clip,n,n==='Tongue'?'translation':'scale',time).map(v=>v.toFixed(2)).join(',')).join('|'));
    eyeStates.add(['Eye.L','Eye.R'].map(n=>value(clip,n,'scale',time)[0]>.5?1:0).join(','));
    tonguePositions.push(value(clip,'Tongue','translation',time)[2]);
  }
  for(const node of ['Root','Body','Head','UpperArm.L','UpperArm.R','Armpit.L','Armpit.R']){
    for(const path of ['translation','rotation','scale']){
      const a=value(clip,node,path,0),b=value(clip,node,path,16);assert(a.every((v,i)=>Math.abs(v-b[i])<.0001),'Loop endpoints close without a pose jump');
    }
  }
}
assert(furFrames>20&&armLowFrames>20);
assert(eyeStates.has('0,0')&&eyeStates.has('1,1'),'Both eyes change expression together');
assert(!eyeStates.has('1,0')&&!eyeStates.has('0,1'),'No alternating one-eye winks');
assert(Math.max(...tonguePositions)-Math.min(...tonguePositions)>.03,'Tongue expression moves visibly');
assert(expressions.size>=4,'Eyes and mouth change expression');
let lastYaw=null,totalYaw=0,minY=Infinity,maxY=-Infinity;
for(let time=0;time<=16;time+=1/120){
  const root=R.pose(rig,'DanceFreestyle',time,false)[index('Root')],yaw=Math.atan2(root[8],root[10]);
  if(lastYaw!==null)totalYaw+=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));lastYaw=yaw;
  minY=Math.min(minY,root[13]);maxY=Math.max(maxY,root[13]);
}
assert(Math.abs(totalYaw/(2*Math.PI)-4)<.001,'Four actual full-body spins in the continuous phrase');
assert(maxY-minY>.6,'Actual rig jumps visibly above the stage');
for(const beat of [8,16,24]){
  const a=R.pose(rig,'DanceFreestyle',(beat-.01)/2,false)[index('Root')],b=R.pose(rig,'DanceFreestyle',(beat+.01)/2,false)[index('Root')];
  assert(Math.hypot(b[12]-a[12],b[13]-a[13],b[14]-a[14])>.003,'No reset-and-rest pause at former clip boundaries');
}
console.log('PASS: measured music beats, continuous freestyle with spins and jumps, changing expressions, fur only on raised arms');
