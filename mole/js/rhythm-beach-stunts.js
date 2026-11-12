/* Cosmetic success turns and exaggerated jump hair. Gameplay coordinates remain in rhythm.js. */
(function(root){'use strict';
 const MG=root.MoleGame=root.MoleGame||{},R=root.StudioRig,TAU=Math.PI*2,cache=new WeakMap();
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
 function cue(mole,combo,time,duration){
  if(!mole||!Number.isInteger(combo)||combo<=0||combo%10)return false;
  const start=Math.max(time,mole.jumpAt+duration*.5),end=mole.jumpAt+duration;
  if(!Number.isFinite(start)||end-start<1/120)return false;
  mole.beachStunt={jumpAt:mole.jumpAt,start,end,kind:combo%100===0?'both':combo%20===0?'flip':'coin',combo};return true;
 }
 function sample(mole,time){
  const s=mole?.beachStunt;
  if(!s||s.jumpAt!==mole.jumpAt||time<s.start||time>=s.end)return {active:false,yaw:0,pitch:0};
  const p=clamp((time-s.start)/(s.end-s.start));
  return {active:true,progress:p,kind:s.kind,yaw:s.kind==='flip'?0:TAU*ease(s.kind==='both'?p*2:p),pitch:s.kind==='coin'?0:TAU*ease(s.kind==='both'?p*2-1:p)};
 }
 function turn(instance,pivot,state){
  if(!state.active)return instance;
  const p=R.point(instance,pivot),ry=R.transform({rotation:[0,Math.sin(state.yaw/2),0,Math.cos(state.yaw/2)]}),rx=R.transform({rotation:[Math.sin(state.pitch/2),0,0,Math.cos(state.pitch/2)]});
  return R.multiply(R.transform({translation:p}),R.multiply(R.multiply(ry,rx),R.multiply(R.transform({translation:p.map(v=>-v)}),instance)));
 }
 function hairMotion(time,jumpAt,duration,id){
  const dt=time-jumpAt,p=dt/duration;if(dt<0)return {bend:0,stretch:1,sway:0};
  if(id==='forelock'){
   if(p>=1)return {bend:0,stretch:1,sway:0};
   if(p<.5)return {bend:1.35*ease(p*2),stretch:1-.15*ease(p*2),sway:0};
   const q=(p-.5)*2;return {bend:1.35*(1-ease(q*1.8)),stretch:1+.35*Math.sin(Math.PI*q),sway:0};
  }
  if(p<1){const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*p)),.55),drive=-Math.sin(TAU*p)*envelope;
   return {bend:.95*drive,stretch:1+.30*drive,sway:.24*Math.sin(TAU*p*2)*envelope,wigLift:.75*Math.sin(Math.PI*p)**2,wigRoll:.18*Math.sin(TAU*p)*envelope};}
  const q=(dt-duration)/.26;if(q>=1)return {bend:0,stretch:1,sway:0};
  const bounce=Math.sin(TAU*q*2)*Math.exp(-3*q)*(1-q)*(1-q);return {bend:.42*bounce,stretch:1+.20*bounce,sway:.12*bounce};
 }
 function bones(runtime,id){
  let styles=cache.get(runtime);if(!styles){styles=new Map();cache.set(runtime,styles)}if(styles.has(id))return styles.get(id);
  const nodes=runtime.model.json.nodes,list=[];
  function descendants(k,out){out.push(k);for(const c of nodes[k].children||[])descendants(c,out)}
  nodes.forEach((n,k)=>{if(n.extras?.appearanceStyle!==id||!/_Mid$/.test(n.name||''))return;const children=[];descendants(k,children);list.push({root:runtime.parents[k],mid:k,tip:children.find(i=>/_Tip$/.test(nodes[i].name||'')),children});});styles.set(id,list);return list;
 }
 function hair(runtime,worlds,id,motion){
  if(Math.abs(motion.bend)+Math.abs(motion.stretch-1)+Math.abs(motion.sway)+(id==='curly'?(motion.wigLift||0):0)<1e-7)return worlds;
  const head=runtime.model.json.nodes.findIndex(n=>n.name==='Head'),headWorld=worlds[head],invHead=R.inverse(headWorld);
  const bend=R.transform({rotation:[Math.sin(motion.bend/2),0,0,Math.cos(motion.bend/2)]}),sway=R.transform({rotation:[0,0,Math.sin(motion.sway/2),Math.cos(motion.sway/2)]});
  const shape=R.multiply(R.multiply(sway,bend),R.transform({scale:[1,motion.stretch,1]}));
  for(const b of bones(runtime,id)){
   const pivot=R.point(invHead,Array.from(worlds[b.root].slice(12,15))),delta=R.multiply(headWorld,R.multiply(R.transform({translation:pivot}),R.multiply(shape,R.multiply(R.transform({translation:pivot.map(v=>-v)}),invHead))));
   for(const k of b.children)worlds[k]=R.multiply(delta,worlds[k]);
   if(b.tip!==undefined){const tip=worlds[b.tip],pivot=R.point(invHead,Array.from(tip.slice(12,15))),angle=motion.bend*.45;
    const curl=R.transform({rotation:[Math.sin(angle/2),0,0,Math.cos(angle/2)]}),delta=R.multiply(headWorld,R.multiply(R.transform({translation:pivot}),R.multiply(curl,R.multiply(R.transform({translation:pivot.map(v=>-v)}),invHead))));worlds[b.tip]=R.multiply(delta,tip);}
  }
  if(id==='curly'&&motion.wigLift>0){
   const roll=R.transform({translation:[0,motion.wigLift,0],rotation:[0,0,Math.sin(motion.wigRoll/2),Math.cos(motion.wigRoll/2)]}),delta=R.multiply(headWorld,R.multiply(roll,invHead));
   runtime.model.json.nodes.forEach((n,k)=>{if(n.extras?.appearanceStyle===id)worlds[k]=R.multiply(delta,worlds[k]);});
  }return worlds;
 }
 MG.RhythmBeachStunts={cue,sample,turn,hairMotion,hair};
})(window);
