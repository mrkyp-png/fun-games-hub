/* One shared 3D renderer for the main cannon and simultaneous cannon clones. */
(function(root){
'use strict';
let shared=null;
const HOME={x:.87,y:.845,size:.306},CAMERA={yaw:.7,pitch:.3};
// Rest line follows the centers of holes 1→5→9 on the 3×3 board. Set it with world-Y rotation;
// leave the barrel at neutral X pitch so its bore, shot origin, and muzzle effects share that line.
const REST={bodyYaw:-1.6474,pitch:8}; // V1528 C: 포신 8도 고정 — 15구멍 모두 포신 중심선이 목표를 지남(25도는 아래·왼쪽 구멍 불가)
const RECOIL_PX=.07,SIDE_ROW=.05; // 최대 반동 = 캐논 표시 크기의 7%
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const mix=(a,b,k)=>({bodyYaw:a.bodyYaw+delta(b.bodyYaw,a.bodyYaw)*k,pitch:a.pitch+(b.pitch-a.pitch)*k});
function acquire(screen){
 if(!shared){const source=document.createElement('div');source.className='lc-render-source';screen.appendChild(source);const state={source,refs:0,view:null,promise:null};
  state.promise=root.MoleGame.WeaponModels.create(source,'cannon',{external:true}).then(view=>{if(state.dead){if(view)view.dispose();return null;}state.view=view;return view;});shared=state;
 }
 shared.refs++;return shared;
}
function create(el){
 const screen=el.closest('#game-screen');if(!screen||!root.MoleGame.WeaponModels)return null;
 const state=acquire(screen),host=document.createElement('div'),canvas=document.createElement('canvas'),fallback=document.createElement('img');host.className='lc-model-host';canvas.className='lc-model-image';fallback.className='lc-model-fallback';fallback.src='assets/weapon-stills-v1509/cannon-hero.png';fallback.alt='';host.append(canvas,fallback);host.style.cssText='left:'+(HOME.x-HOME.size/2)*100+'%;top:'+(HOME.y-HOME.size/2)*100+'%;width:'+HOME.size*100+'%;height:'+HOME.size*100+'%;';el.appendChild(host);el.classList.add('has-cannon-model');const ctx=canvas.getContext('2d');let disposed=false,lastKey='',lastMuzzle=null,pose={...REST},from={...REST},desired=null,introRaf=0,lastRender=-Infinity;
 let box={x:HOME.x-HOME.size/2,y:HOME.y-HOME.size/2,w:HOME.size,h:HOME.size},layerWidth=1,layerHeight=1;
 function resize(){const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const display=Math.ceil(el.getBoundingClientRect().width*HOME.size);if(layerWidth===w&&layerHeight===h&&state.display===display)return;layerWidth=w;layerHeight=h;const size=HOME.size*w;box={x:HOME.x-HOME.size/2,y:HOME.y-size/h/2,w:HOME.size,h:size/h};host.style.cssText='left:'+box.x*100+'%;top:'+box.y*100+'%;width:'+size+'px;height:'+size+'px;';if(state.display!==display){state.display=display;state.source.style.width=display+'px';state.source.style.height=display+'px';state.view?.resize();}lastKey='';}
 resize();const sizing=new ResizeObserver(resize);sizing.observe(el);
 function toLayer(p){return {x:box.x+p.x*box.w,y:box.y+p.y*box.h,yScale:layerWidth/layerHeight};}
 // V1530 C: 반동은 화면 이동(CSS translate)만 바꾸므로 3D 를 다시 그리지 않는다. 3D 는 몸통 방향·포신 각도가 바뀔 때만 그린다.
 function recoil(kick){
  if(!lastMuzzle)return;
  const back=(lastMuzzle.aim+180)*Math.PI/180,dist=kick*RECOIL_PX*layerWidth*box.w,value=kick?(Math.cos(back)*dist).toFixed(2)+'px '+(Math.sin(back)*dist).toFixed(2)+'px':'';
  if(host.style.translate!==value)host.style.translate=value;
 }
 function paint(next,kick,force){
  const view=state.view;if(disposed||!view)return null;
  const now=performance.now();
  pose=next;const key=pose.bodyYaw.toFixed(4)+':'+pose.pitch.toFixed(3);
  if(key!==lastKey&&(force||!lastMuzzle||now-lastRender>=1000/30-.5)){
   view.setPose({yaw:CAMERA.yaw,cameraPitch:CAMERA.pitch,bodyYaw:pose.bodyYaw,pitch:pose.pitch,kick:0});
   const image=state.source.querySelector('canvas');if(!image||!view.muzzle)return null;
   if(canvas.width!==image.width||canvas.height!==image.height){canvas.width=image.width;canvas.height=image.height;}
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);
   lastMuzzle={...toLayer(view.muzzle),aim:view.projectedAim};lastKey=key;lastRender=now;
  }
  recoil(kick);
  if(!api.ready&&lastMuzzle){api.ready=true;fallback.hidden=true;}return lastMuzzle;
 }
 // V1533 C 사용자: 포신 각도(pitch)는 고정하고 몸통 회전(야오)만으로 포신 중심선이 피타격물 중심을 지나게(구멍을 정면으로 겨눔).
 // 단 캐논과 같은 줄(맨 아래 줄, 캐논 높이 근처) 목표는 캐논 옆면만 보이는 각도(카메라와 직각)로 두고 포신 각도로만 맞춘다.
 const yawCache=new Map();
 function solveYaw(view,x,y){
  const key=x.toFixed(3)+','+y.toFixed(3)+','+layerWidth+'x'+layerHeight;if(yawCache.has(key))return {...yawCache.get(key)};
  const aimErr=(yaw,pitch)=>{view.setPose({yaw:CAMERA.yaw,cameraPitch:CAMERA.pitch,bodyYaw:yaw,pitch,kick:0});if(!view.muzzle)return 0;const m=toLayer(view.muzzle),want=Math.atan2((y-m.y)*layerHeight,(x-m.x)*layerWidth);return delta(want,view.projectedAim*Math.PI/180);};
  const secant=(f,a)=>{let b=a+.05,fa=f(a),fb=f(b);for(let i=0;i<12&&Math.abs(fb)>1e-4&&fb!==fa;i++){const c=b-fb*(b-a)/(fb-fa);a=b;fa=fb;b=c;fb=f(b);}return b;};
  view.setPose({yaw:CAMERA.yaw,cameraPitch:CAMERA.pitch,bodyYaw:REST.bodyYaw,pitch:REST.pitch,kick:0});
  const m0=view.muzzle?toLayer(view.muzzle):{x:box.x+box.w/2,y:box.y+box.h/2},screenDeg=Math.atan2((y-m0.y)*layerHeight,(x-m0.x)*layerWidth)*180/Math.PI;
  let out;
  // 옆면 각도(카메라와 직각, 포신이 화면 왼쪽)가 최대 회전 — 그보다 아래쪽(왼쪽 아래) 목표는 옆면에서 멈추고 포신 각도로만 맞춘다.
  let side=CAMERA.yaw+Math.PI/2,bestD=Infinity,sideAim=180;
  for(const s of [CAMERA.yaw+Math.PI/2,CAMERA.yaw-Math.PI/2]){view.setPose({yaw:CAMERA.yaw,cameraPitch:CAMERA.pitch,bodyYaw:s,pitch:REST.pitch,kick:0});const d=Math.abs(delta(Math.PI,view.projectedAim*Math.PI/180));if(d<bestD){bestD=d;side=s;sideAim=view.projectedAim;}}
  const norm=a=>((a%360)+360)%360,beyondSide=norm(screenDeg)>=90&&norm(screenDeg)<norm(sideAim);
  if(y>=HOME.y-SIDE_ROW||beyondSide){
   out={bodyYaw:side,pitch:Math.max(-40,Math.min(70,secant(p=>aimErr(side,p)*180/Math.PI,REST.pitch)))};
  }else{
   let best=REST.bodyYaw,bestErr=Infinity;for(let i=0;i<24;i++){const yaw=-Math.PI+i*Math.PI/12,e=Math.abs(aimErr(yaw,REST.pitch));if(e<bestErr){bestErr=e;best=yaw;}}
   out={bodyYaw:secant(yaw=>aimErr(yaw,REST.pitch),best),pitch:REST.pitch};
  }
  yawCache.set(key,out);lastKey='';return {...out};
 }
 // V1530 C: 구멍별 첫 조준 계산(3D 약 12회)을 사격 순간이 아니라 등장 연출 중에 한 프레임 한 구멍씩 미리 해 둔다.
 let warmRaf=0;
 function prewarm(points){
  cancelAnimationFrame(warmRaf);const list=(points||[]).slice();
  function next(){if(disposed||!list.length){warmRaf=0;return;}const view=state.view;if(view){const p=list.shift();solveYaw(view,p.x,p.y);}warmRaf=requestAnimationFrame(next);}
  state.promise.then(()=>{if(!disposed)warmRaf=requestAnimationFrame(next);});
 }
 const api={ready:false,prewarm,aimAt(x,y){const view=state.view,pivot=view?.breech?toLayer(view.breech):{x:.870,y:.801};from={...pose};desired=view?solveYaw(view,x,y):{...REST};return Math.atan2((y-pivot.y)*layerHeight,(x-pivot.x)*layerWidth)*180/Math.PI;},render(aim,kick,animation){
  // V1533 C 사용자: 쏜 뒤에는 반동만 — 몸통 방향·포신 각도 모두 그대로 유지.
  if(introRaf)return lastMuzzle;const phase=animation?.phase||(desired?'kick':'home'),k=Math.max(0,Math.min(1,animation?.progress||0)),ease=k*(2-k),aimed=desired||REST,next=phase==='aim'?mix(from,aimed,ease):aimed;return paint(next,kick,animation?.force);
 },intro(travelMs,turnMs,onDone){
  cancelAnimationFrame(introRaf);const start=performance.now(),width=el.clientWidth,side={bodyYaw:CAMERA.yaw+Math.PI/2,pitch:12};
  function step(now){if(disposed)return;const age=now-start,k=Math.min(1,age/travelMs),move=1-Math.pow(1-k,3),turn=Math.max(0,Math.min(1,(age-travelMs)/turnMs));host.style.transform='translateX('+((-0.2+(HOME.x+.2)*move-HOME.x)*width)+'px)';paint(mix(side,REST,turn*turn*(3-2*turn)),0);if(age<travelMs+turnMs)introRaf=requestAnimationFrame(step);else{introRaf=0;host.style.transform='';paint(REST,0,true);if(onDone)onDone();}}
  introRaf=requestAnimationFrame(step);
 },clear(){if(disposed)return;disposed=true;cancelAnimationFrame(introRaf);cancelAnimationFrame(warmRaf);sizing.disconnect();host.remove();el.classList.remove('has-cannon-model');state.refs--;if(!state.refs){state.promise.then(view=>{if(view)view.dispose();state.source.remove();});if(shared===state)shared=null;}}};
 state.promise.then(()=>{if(!disposed&&!introRaf)paint(REST,0);});return api;
}
function releaseGPU(){const state=shared;if(!state)return;shared=null;state.dead=true;if(state.view)state.view.dispose();state.view=null;state.promise.then(view=>{if(view)view.dispose();});state.source.remove();}
root.MoleGame=root.MoleGame||{};root.MoleGame.GameCannonModel={create,releaseGPU};
})(window);
