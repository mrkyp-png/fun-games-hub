const assert=require('node:assert/strict'),fs=require('node:fs'),L=require('../mole/js/home3d-layout.js');
for(const kind of ['whale','megalodon'])for(const [width,height] of [[320,740],[390,844],[430,932],[844,390]]){
  const scene={cx:width/2,cy:height/2,radius:kind==='whale'?120:175,width,height,length:168};
  const first=L.deepSwimPose(kind,0,scene);
  assert(first.speed<4,'Entrance starts at a slow swimming speed, not a 30s cross-screen rush');
  let slowest=Infinity,fastest=0;
  for(let t=0;t<599.9;t+=.25){
    const a=L.deepSwimPose(kind,t,scene),b=L.deepSwimPose(kind,t+.01,scene),dx=b.x-a.x,dy=b.y-a.y,v=Math.hypot(dx,dy)/.01;
    assert((dx*Math.cos(a.rot)+dy*Math.sin(a.rot))/Math.hypot(dx,dy)>.999,'Head points forward along the real path');
    slowest=Math.min(slowest,v);fastest=Math.max(fastest,v);
  }
  assert(fastest/slowest<1.08,'No entrance acceleration burst or orbital join jump');
  const join=L.deepSwimPose(kind,first.entrySeconds,scene),end=L.deepSwimPose(kind,600,scene);
  assert(Math.hypot(end.x-join.x,end.y-join.y)<.001,'Finish one full orbit in the original ten-minute appearance');
}
assert(fs.readFileSync('mole/home3d.css','utf8').includes('animation:none!important;width:168px;transform-origin:50% 50%'),'PNG rotates around its center');
console.log('PASS: whale/megalodon head-first movement, slow uniform entry, smooth joins and centered rotation');
