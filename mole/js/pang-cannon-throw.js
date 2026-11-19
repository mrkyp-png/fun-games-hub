/* Game-local overhand throw: original left arm rests; only the right arm winds up. */
(function(root){'use strict';const node=typeof module!=='undefined'&&module.exports,R=node?require('./clay-rig-runtime'):root.StudioRig;
 const clip='CannonRightThrow',release=.6,duration=.95;
 function install(runtime){if(runtime.animations.some(a=>a.name===clip))return;const g=runtime.model.json,idle=runtime.animations.find(a=>a.name==='Idle'),carry=runtime.animations.find(a=>a.name==='CarryIdle'),raised=runtime.animations.find(a=>a.name==='ArmsUp'),arm=g.nodes.findIndex(n=>n.name==='UpperArm.R');if(!idle||!carry||!raised||arm<0)throw Error('Original right-arm animation missing');const right=new Set();function visit(i){right.add(i);for(const c of g.nodes[i].children||[])visit(c);}visit(arm);
  const times=Float32Array.from([0,.12,.34,.50,release,.74,duration]),tracks=[];
  function value(anim,node,path,time,fallback){const tr=anim.tracks.find(t=>t.node===node&&t.path===path);return tr?R.sample(tr,time):fallback;}
  for(const tr of idle.tracks){const rest=R.sample(tr,0),values=[];for(let i=0;i<times.length;i++){let v=rest;if(right.has(tr.node)&&tr.path!=='scale'&&!(tr.node===arm&&tr.path==='translation')){const hold=value(carry,tr.node,tr.path,0,rest),up=value(raised,tr.node,tr.path,raised.duration*.30,rest);if(i===1||i===5)v=hold;else if(i===2||i===3)v=up;else if(i===4)v=tr.path==='rotation'?R.slerp(up,hold,.45):up.map((x,k)=>x+(hold[k]-x)*.45);}values.push(...v);}tracks.push({...tr,times,values:Float32Array.from(values),interpolation:'LINEAR'});}
  runtime.animations.push({name:clip,duration,tracks});
 }
 const api={install,clip,release,duration};if(node)module.exports=api;else root.MoleGame.PangCannonThrow=api;
})(typeof window!=='undefined'?window:globalThis);
