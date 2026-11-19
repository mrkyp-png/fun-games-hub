/* Rhythm Beach's authored screen sizes and launch profile, in a shared 3D camera. */
(function(root){'use strict';const node=typeof module!=='undefined'&&module.exports,C=node?require('./pang-cannon-config'):root.MoleGame.PangCannonConfig,M=node?require('./pang-cannon-view-math'):root.MoleGame.PangCannonViewMath;
 const camera=M.camera(C.scene.aspect),clamp=x=>Math.max(0,Math.min(1,x));
 function atDepth(u,v,z){const ray=M.ray(camera,u,v),d=ray.to.map((x,i)=>x-ray.from[i]),t=(z-ray.from[2])/d[2];return ray.from.map((x,i)=>x+d[i]*t);}
 function route(lane,turns,random=Math.random){const x=(lane+.5)/4,knots=[[0,x]];if(turns)knots.push([.35,(Math.floor(random()*4)+.5)/4]);if(turns>1)knots.push([.65,(Math.floor(random()*4)+.5)/4]);knots.push([1,.5]);return knots;}
 function point(p,age){if(age<p.launchSeconds){const t=clamp(age/p.launchSeconds),x=p.route[0][1],source=.5+(x-.5)*.45;const horizon=M.project(camera.vp,[0,-.18,360])[1];return{u:source+(x-source)*t,v:horizon+(C.scene.weaponApexV-horizon)*(1-(1-t)*(1-t)),z:360+(85-360)*t};}const t=clamp((age-p.launchSeconds)/p.flightSeconds);let u=.5;for(let i=1;i<p.route.length;i++){const a=p.route[i-1],b=p.route[i];if(t<=b[0]){u=a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);break;}}return{u,v:C.scene.weaponApexV+(C.scene.impactV-C.scene.weaponApexV)*t,z:85+(1.8-85)*t};}
 function position(p,age){const q=point(p,age);return atDepth(q.u,q.v,q.z);}
 function widthFraction(p){const spin=p.kind==='boomerang'||p.kind==='disc',launch=.22+.78*clamp(p.age/p.launchSeconds);return .25*.22*2.4*(spin?1.2:1)*launch;}
 function radius(p,view=camera){const q=M.project(view.vp,p.pos),right=M.project(view.vp,[p.pos[0]+1,p.pos[1],p.pos[2]]),unit=Math.abs(right[0]-q[0]);return widthFraction(p)/(2*Math.max(unit,1e-9));}
 const api={route,point,position,widthFraction,radius};if(node)module.exports=api;else root.MoleGame.PangCannonFlight=api;
})(typeof window!=='undefined'?window:globalThis);
