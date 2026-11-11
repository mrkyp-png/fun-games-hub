/* GLB skeletal animation sampler used by the Studio load test. */
(function(root){
'use strict';
const M=typeof module!=='undefined'&&module.exports?require('./clay-rig-math.js'):root.StudioRigMath;
function inverse(m){
 const rows=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>c<4?m[c*4+r]:+(c-4===r)));
 for(let c=0;c<4;c++){
  let p=c;for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[p][c]))p=r;
  if(Math.abs(rows[p][c])<1e-12)throw Error('Singular mesh transform');
  [rows[c],rows[p]]=[rows[p],rows[c]];const q=rows[c][c];for(let j=0;j<8;j++)rows[c][j]/=q;
  for(let r=0;r<4;r++)if(r!==c){const v=rows[r][c];for(let j=0;j<8;j++)rows[r][j]-=v*rows[c][j];}
 }
 return new Float32Array(Array.from({length:16},(_,i)=>rows[i%4][4+Math.floor(i/4)]));
}
function slerp(a,b,t){
 let dot=a.reduce((n,x,i)=>n+x*b[i],0),v=b;
 if(dot<0){dot=-dot;v=b.map(x=>-x)}
 let q;
 if(dot>.9995)q=a.map((x,i)=>x+(v[i]-x)*t);
 else{const theta=Math.acos(Math.min(1,dot)),d=Math.sin(theta);q=a.map((x,i)=>(x*Math.sin((1-t)*theta)+v[i]*Math.sin(t*theta))/d)}
 const n=Math.hypot(...q)||1;return q.map(x=>x/n);
}
function sample(track,time){
 const ts=track.times,v=track.values,w=track.width,n=ts.length;
 let a=0,b=n-1;while(a+1<b){const mid=(a+b)>>1;if(ts[mid]<=time)a=mid;else b=mid}
 if(time<=ts[0])a=b=0;else if(time>=ts[n-1])a=b=n-1;
 const dt=ts[b]-ts[a],t=dt>0?Math.max(0,Math.min(1,(time-ts[a])/dt)):0;
 if(track.interpolation==='CUBICSPLINE'){
  const p=Array.from({length:w},(_,i)=>v[(a*3+1)*w+i]);if(a===b)return p;
  const q=Array.from({length:w},(_,i)=>(2*t**3-3*t*t+1)*p[i]+(t**3-2*t*t+t)*dt*v[(a*3+2)*w+i]+(-2*t**3+3*t*t)*v[(b*3+1)*w+i]+(t**3-t*t)*dt*v[(b*3)*w+i]);
  if(track.path==='rotation'){const n=Math.hypot(...q)||1;return q.map(x=>x/n)}return q;
 }
 const p=Array.from(v.subarray(a*w,(a+1)*w));if(a===b||track.interpolation==='STEP')return p;
 const q=Array.from(v.subarray(b*w,(b+1)*w));return track.path==='rotation'?slerp(p,q,t):p.map((x,i)=>x+(q[i]-x)*t);
}
function prepare(model){
 const g=model.json,parents=new Int32Array(g.nodes.length).fill(-1);
 g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{if(c<0||c>=g.nodes.length||parents[c]!==-1)throw Error('Invalid node parent');parents[c]=i}));
 const animations=(g.animations||[]).map((a,index)=>{
  const tracks=a.channels.map(c=>{const s=a.samplers[c.sampler];if(!['translation','rotation','scale'].includes(c.target.path))throw Error('Morph-weight animation is not supported in this load test');return {node:c.target.node,path:c.target.path,times:M.accessor(model,s.input),values:M.accessor(model,s.output),width:c.target.path==='rotation'?4:3,interpolation:s.interpolation||'LINEAR'}});
  return {name:a.name||'Animation '+index,tracks,duration:Math.max(0,...tracks.map(t=>t.times[t.times.length-1]))};
 });
 const skins=(g.skins||[]).map(s=>({joints:s.joints,inverseBind:s.inverseBindMatrices===undefined?new Float32Array(s.joints.flatMap(()=>Array.from(M.identity()))):M.accessor(model,s.inverseBindMatrices)}));
 return {model,parents,animations,skins};
}
function pose(runtime,animation,time,loop=true,face){
 const g=runtime.model.json,local=g.nodes.map(n=>({...n,translation:[...(n.translation||[0,0,0])],rotation:[...(n.rotation||[0,0,0,1])],scale:[...(n.scale||[1,1,1])]}));
 const clip=runtime.animations.find(a=>a.name===animation);
 if(clip){const t=loop&&clip.duration>0?time%clip.duration:Math.min(time,clip.duration);for(const tr of clip.tracks)local[tr.node][tr.path]=sample(tr,t)}
 if(face)for(const tr of face)local[tr.node][tr.path]=sample(tr,0);
 const worlds=new Array(local.length),visiting=new Set();
 function world(i){if(worlds[i])return worlds[i];if(visiting.has(i))throw Error('Cyclic nodes');visiting.add(i);const parent=runtime.parents[i];worlds[i]=parent<0?M.transform(local[i]):M.multiply(world(parent),M.transform(local[i]));visiting.delete(i);return worlds[i]}
 local.forEach((_,i)=>world(i));return worlds;
}
function palette(runtime,worlds,meshNode){
 const n=runtime.model.json.nodes[meshNode];if(n.skin===undefined)return null;
 const skin=runtime.skins[n.skin],inv=inverse(worlds[meshNode]),out=new Float32Array(skin.joints.length*16);
 skin.joints.forEach((j,i)=>out.set(M.multiply(inv,M.multiply(worlds[j],skin.inverseBind.subarray(i*16,(i+1)*16))),i*16));return out;
}
function skinPoint(p,joints,weights,palette){
 const out=[0,0,0];for(let i=0;i<4;i++)if(weights[i]){const q=M.point(palette.subarray(joints[i]*16,(joints[i]+1)*16),p);q.forEach((v,k)=>out[k]+=v*weights[i])}return out;
}
const api={...M,inverse,slerp,sample,prepare,pose,palette,skinPoint};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudioRig=api;
})(typeof window!=='undefined'?window:globalThis);
