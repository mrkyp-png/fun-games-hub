/* Deterministic continuous collision helpers. No renderer or existing game mutation. */
(function(root){'use strict';
 const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),length=a=>Math.hypot(...a),unit=a=>{const n=length(a);if(!n)throw Error('Zero direction');return mul(a,1/n);},lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
 function sphere(a,b,c,r){const v=sub(b,a),o=sub(a,c),q=dot(o,o)-r*r;if(q<=0)return 0;const d=dot(v,v);if(d<1e-15)return null;const h=dot(o,v),disc=h*h-d*q;if(disc<0)return null;const t=(-h-Math.sqrt(disc))/d;return t>=0&&t<=1?t:null;}
 function movingSpheres(a,b,r,c,d,s){return sphere(sub(a,c),sub(b,d),[0,0,0],r+s);}
 function ellipsoid(a,b,center,half,r=0){return sphere(sub(a,center).map((v,i)=>v/(half[i]+r)),sub(b,center).map((v,i)=>v/(half[i]+r)),[0,0,0],1);}
 function holeRim(a,b,h,r=0){const q=h.radius;if(!q)return null;const broad=bounds(add(h.pos,[0,q*.12,0]),[q*1.05,q*.13,q*1.05]);if(box(a,b,broad.min,broad.max,r)===null)return null;let nearest=null;for(let i=0;i<16;i++){const angle=i*Math.PI/8,c=add(h.pos,[Math.cos(angle)*q*.84,q*.12,Math.sin(angle)*q*.84]),t=ellipsoid(a,b,c,[q*.2,q*.12,q*.2],r);if(t!==null&&(nearest===null||t<nearest))nearest=t;}return nearest;}
 function box(a,b,min,max,r=0){const v=sub(b,a);let entry=0,exit=1;for(let i=0;i<3;i++){const lo=min[i]-r,hi=max[i]+r;if(Math.abs(v[i])<1e-12){if(a[i]<lo||a[i]>hi)return null;continue;}let x=(lo-a[i])/v[i],y=(hi-a[i])/v[i];if(x>y)[x,y]=[y,x];entry=Math.max(entry,x);exit=Math.min(exit,y);if(entry>exit)return null;}return entry;}
 function first(hits){return hits.filter(x=>x.t!==null&&Number.isFinite(x.t)).sort((a,b)=>Math.abs(a.t-b.t)<1e-5?(b.priority||0)-(a.priority||0):a.t-b.t)[0]||null;}
 function bounds(center,half){return{min:sub(center,half),max:add(center,half)};}
 function directionFromFlight(origin,target,seconds){if(!(seconds>0&&Number.isFinite(seconds)))throw Error('Projectile flight policy must be supplied from the confirmed source');return mul(sub(target,origin),1/seconds);}
 const api={add,sub,mul,dot,length,unit,lerp,sphere,movingSpheres,ellipsoid,holeRim,box,first,bounds,directionFromFlight};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.PangCannonPhysics=api;
})(typeof window!=='undefined'?window:globalThis);
