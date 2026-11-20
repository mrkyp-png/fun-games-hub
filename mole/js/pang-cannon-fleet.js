/* Five independent instances of the plaza's original boat. No shared plaza state. */
(function(root){'use strict';const node=typeof module!=='undefined'&&module.exports,R=node?require('./clay-rig-runtime'):root.StudioRig,M=node?require('./pang-cannon-view-math'):root.MoleGame.PangCannonViewMath,C=node?require('./pang-cannon-config'):root.MoleGame.PangCannonConfig;
 // V1763 C: up to 12 boat slots; round 1 uses 5, round 2 uses 10, then 12 at once with shorter holds (appearances double each round).
 // V1768 C: 24 normal slots + 1 boss slot (index BOSS). The boss only appears after bossAt is set (sink target reached); then all normal boats turn and leave.
 // V1769 C: slots 24..53 are reserved for tactical formations (up to 30 boats), slot 54 = boss.
 const camera=M.camera(C.scene.aspect),TAC0=24,TACN=30,BOSS=54,COUNT=55,BASE=10,MOLE_SCALE=.15,NEAR=125,want=r=>BASE*Math.pow(2,Math.max(0,(r||1)-1)),active=r=>Math.min(TAC0,want(r)),holdScale=r=>Math.min(1,TAC0/want(r));
 function atDepth(u,v,z){const ray=M.ray(camera,u,v),d=ray.to.map((x,i)=>x-ray.from[i]),t=(z-ray.from[2])/d[2];return ray.from.map((x,i)=>x+d[i]*t);}
 function wave(x,z,t){return .06*Math.sin(.55*x+1.1*t)+.04*Math.sin(.8*z-.9*t+1.3)+.02*Math.sin(.37*(x+z)+1.7*t);}
 // V1759 C: each boat sails in from the horizon, holds, turns its bow and sails out, hides briefly, then returns in a nearby lane.
 // V1762 C: time = seconds since the round began (fleetSeconds); boats enter one by one from an empty sea.
 const STAGGER=1.4,TURN=1.6,GAP=.3,ease=x=>x*x*(3-2*x),hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
 // V1763 C: every trip is different — some boats turn back halfway (near up to 265), hold 3-7 s, and re-enter after only GAP seconds.
 function trip(i,n,r){const far=355,near=NEAR+hash(i*31+n)*140,run=2.5+6.5*(far-near)/(far-NEAR),hold=Math.max(1.2,(3+hash(i*13+n)*4)*holdScale(r));return{far,near,enter:run,hold,leave:run*.85,total:run+hold+TURN+run*.85+GAP};}
 const state={bossAt:null,tactic:null},isBoss=i=>i===BOSS,isTactic=i=>i>=TAC0&&i<TAC0+TACN;
 // V1769 C: 12 naval tactics. Plan = boat count n, duration, flagship index (-1 none), volleys [[seconds into the formation, boat]], ram arrival time.
 const R_=n=>Array.from({length:n},(_,j)=>j),TACTICS=Object.freeze({
  line:{name:'일자진',en:'LINE ABREAST',n:10,dur:20,flag:-1,vol:j=>[[8+j*.3],[13.5+j*.3]]},
  flank:{name:'측면 기습',en:'FLANK AMBUSH',n:8,dur:16,flag:-1,vol:j=>[[(j%4)*.8+4.3],[(j%4)*.8+7.7]]},
  snake:{name:'장사진',en:'SNAKE COLUMN',n:12,dur:22,flag:-1,vol:j=>[[j*.7+8]]},
  fish:{name:'어린진',en:'FISH-SCALE WEDGE',n:13,dur:16,flag:0,vol:j=>[[6+j%2*.3],[9.5+j%2*.3]]},
  ram:{name:'충각 돌격',en:'RAMMING CHARGE',n:6,dur:12,flag:-1,ram:7,vol:()=>[]},
  crane:{name:'학익진',en:'CRANE WING',n:26,dur:22,flag:13,vol:j=>j%2?[[13]]:[[10],[16]]},
  battleline:{name:'단종진',en:'LINE OF BATTLE',n:10,dur:18,flag:-1,vol:j=>[[(.55+.13*j)/1.6*14],[(.95+.13*j)/1.6*14]]},
  cheomja:{name:'첨자진',en:'ARROW TO CRANE',n:20,dur:24,flag:10,vol:j=>j%2?[[14]]:[[12.5],[18]]},
  crossT:{name:'T자 횡단',en:'CROSSING THE T',n:10,dur:16,flag:-1,vol:()=>[[6],[9]]},
  breakLine:{name:'전열 돌파',en:'BREAKING THE LINE',n:12,dur:18,flag:-1,vol:j=>[[9+(j%6)*.15]]},
  fireship:{name:'화공선',en:'FIRE SHIPS',n:4,dur:14,flag:-1,ram:9,vol:()=>[]},
  wolfpack:{name:'늑대 떼',en:'WOLF PACK',n:14,dur:16,flag:-1,vol:j=>[[7+j*.25],[11+j*.2]]}});
 const UNLOCK=[['line','flank','snake'],['fish','ram'],['crane','battleline'],['cheomja','crossT'],['breakLine','fireship'],['wolfpack']];
 function tacticPool(r){return UNLOCK.slice(0,Math.max(1,r||1)).flat();}
 function tacticPlan(kind){const P=TACTICS[kind];return{kind,name:P.name,en:P.en,n:P.n,dur:P.dur,flag:P.flag,ram:P.ram||0,volleys:R_(P.n).flatMap(j=>P.vol(j).map(v=>[v[0],j]))};}
 function tacticLife(i,time){const T=state.tactic,j=i-TAC0;if(!T||j>=T.n)return HIDDEN;const s=time-T.at;if(s<0||s>T.dur)return HIDDEN;
  if(T.broken!=null&&time>T.broken){const L=tacticLife2(T,j,T.broken-T.at),k=Math.min(1,(time-T.broken)/3.5);if(k>=1)return HIDDEN;return{...L,side:0,turn:Math.max(L.turn,Math.min(1,k*3)),z:L.z+(355-L.z)*ease(k),dir:-1,move:.9,ready:false};}
  return tacticLife2(T,j,s);}
 const cl=x=>Math.max(0,Math.min(1,x)),craneSpot=(j,n)=>{const a=(j-(n-1)/2)/((n-1)/2)*1.25;return[.5+.46*Math.sin(a),215-80*(1-Math.cos(a))];},wedgeSpot=(j,gap=.075,dz=18)=>{const k=Math.ceil(j/2),sg=j%2?-1:1;return[.5+sg*gap*k,dz*k];};
 function tacticLife2(T,j,s){const flag=j===T.flag,out=T.dur-5,n=T.n,base={far:355,visible:true,move:.5,dir:0,type:0,ready:false,scaleMul:flag?1.3:1,turn:0};let u=.5,z=200;const K=T.kind,side=(u,sd,extra)=>({...base,u,z,side:sd,move:.8,...extra});
  if(K==='crane'){const [tu,tz]=craneSpot(j,n),k=ease(cl(s/7));u=.5+(tu-.5)*k;z=355+(tz-355)*k;}
  else if(K==='cheomja'){const [cu,cz]=craneSpot(j,n),[wu,wo]=wedgeSpot(j,.05,9),wz=150+wo,a=ease(cl(s/7)),m=ease(cl((s-8)/3));u=.5+(wu-.5)*a;z=355+(wz-355)*a;u+=(cu-u)*m;z+=(cz-z)*m;}
  else if(K==='line'){u=.06+j*(.88/(n-1));z=355-205*ease(cl(s/12));}
  else if(K==='snake'){const p=(s-j*.7)/14;if(p<=0)return HIDDEN;const q=cl(p);u=.5+.32*Math.sin(q*Math.PI*2.5);z=355-215*q;return{...base,u,z,dir:1,move:.8};}
  else if(K==='fish'){const [wu,wo]=wedgeSpot(j,.07,17),e=ease(cl(s/5));u=.5+(wu-.5)*e;z=355+(135+wo-355)*e;}
  else if(K==='flank'){const left=j<n/2,t=Math.max(0,s-(j%(n/2))*.8),p=cl(t/12);if(t<=0)return HIDDEN;return side(left?-.2+1.4*p:1.2-1.4*p,left?1:-1,{z:170+(j%(n/2))*15});}
  else if(K==='battleline'){const x=-.25-.13*j+1.6*(s/14);if(x<-.3||x>1.3)return HIDDEN;return side(x,1,{z:190});}
  else if(K==='crossT'){const x=1.25+.13*j-1.7*(s/12);if(x<-.3||x>1.4)return HIDDEN;return side(x,-1,{z:150});}
  else if(K==='breakLine'){const col=j<n/2?-1:1,row=j%(n/2),a=ease(cl(s/8)),b=ease(cl((s-8)/4));u=.5+col*.05+col*.33*b;z=355+(170+row*14-355)*a;}
  else if(K==='ram'||K==='fireship'){const lanes=n,p=cl(s/T.ram);if(p>=1)return HIDDEN;u=.15+.7*(j+.5)/lanes;z=355-(355-28)*p*p;return{...base,u,z,dir:1,move:1,fire:K==='fireship'};}
  else if(K==='wolfpack'){const from=j%3,start=from===0?[-.25,190]:from===1?[1.25,190]:[.5,355],tgt=[.12+((j*.618)%1)*.76,140+((j*.37)%1)*70],e=ease(cl(s/6)),wob=s>6?.04*Math.sin(s*1.3+j):0;u=start[0]+(tgt[0]-start[0])*e+wob;z=start[1]+(tgt[1]-start[1])*e;return{...base,u,z,scaleMul:.7,dir:1,move:.9,...(s>out?{z:z+(355-z)*ease(cl((s-out)/5)),turn:1,dir:-1}:{})};}
  if(s>out){const k=ease(Math.min(1,(s-out)/5));return{...base,u,z:z+(355-z)*k,turn:Math.min(1,k*3),dir:-1,move:.9};}
  return{...base,u,z,dir:s<6?1:0,move:s<6?.9:.25};}
 // V1766 C: the boss boat sails straight in to z=200 in the middle lane and holds there (never turns back).
 // V1768 C: boss enters broadside from the left, then patrols left↔right (broadside duel). side = travel direction (+1 right / -1 left).
 function bossLife(time){const s=Math.max(0,time),E=5,z=185;let u,side;if(s<E){u=-.2+.7*ease(s/E);side=1;}else{const p=(s-E)*.4;u=.5+.6*Math.sin(p);side=Math.cos(p)>=0?1:-1;}return{u,z,far:355,turn:0,visible:true,move:.7,dir:0,side,type:0,ready:s>E*.7&&u>.06&&u<.94};}
 // V1767 C: a sunk slot restarts as a brand-new boat from the horizon (shifts[i] = round time it restarts).
 const shifts=[];
 const HIDDEN={u:.5,z:355,far:355,turn:0,visible:false,move:0,dir:0,type:0,ready:false};
 function life(i,time,r){if(isBoss(i))return state.bossAt==null?HIDDEN:bossLife(time-state.bossAt);if(isTactic(i))return tacticLife(i,time);const away=state.bossAt!=null?state.bossAt:state.tactic&&time>=state.tactic.at?state.tactic.at:null;if(away!=null&&time>away){const L=normalLife(i,away,r);if(!L.visible)return HIDDEN;const k=Math.min(1,(time-away)/2.5);if(k>=1)return HIDDEN;return{...L,turn:Math.max(L.turn,Math.min(1,k*3)),z:L.z+(L.far-L.z)*ease(k),dir:-1,move:.9,ready:false};}return normalLife(i,time,r);}
 function normalLife(i,time,r){let t=shifts[i]!=null?time-shifts[i]:time-i*STAGGER*BASE/active(r);if(i>=active(r)||t<0)return{u:.5,z:355,far:355,turn:0,visible:false,move:0,dir:0,type:0,ready:false};let n=0,T=trip(i,0,r);while(t>=T.total){t-=T.total;T=trip(i,++n,r);}const s=t,ENTER=T.enter,HOLD=T.hold,LEAVE=T.leave,far=T.far,near=T.near,u=.08+((i*.618034)%1)*.84+(hash(i*17+n)-.5)*.06;let z=near,turn=0,visible=true,move=.2,dir=0;if(s<ENTER){z=far+(near-far)*ease(s/ENTER);move=1-.8*(s/ENTER);dir=1;}else if(s<ENTER+HOLD)z=near;else if(s<ENTER+HOLD+TURN){turn=ease((s-ENTER-HOLD)/TURN);move=.8;}else if(s<ENTER+HOLD+TURN+LEAVE){turn=1;z=near+(far-near)*ease((s-ENTER-HOLD-TURN)/LEAVE);move=.6+.4*Math.min(1,(s-ENTER-HOLD-TURN)/2);dir=-1;}else{visible=false;z=far;turn=1;}return{u,z,far,turn,visible,move,dir,type:Math.floor(hash(i*7+n*3+1)*C.boats.length)%C.boats.length,ready:visible&&s>ENTER*.35&&s<ENTER+HOLD-.7};}
 function sample(index,time=0,round=1){const i=((index%COUNT)+COUNT)%COUNT,L=life(i,time,round),B=C.boats[L.type],DECK=B.deck,DRAFT=B.draft,u=L.u,z=L.z,ref=260+(i%2)*14,farP=atDepth(u,M.project(camera.vp,[0,-.18,ref])[1],ref),unit=Math.abs(M.project(camera.vp,[farP[0]+1,-.18,ref])[0]-u),shrink=z>ref?1-.65*ease(Math.min(1,(z-ref)/(355-ref))):1,scale=.15/(B.width*unit)*shrink*(isBoss(i)?C.rules.bossScale:1)*(L.scaleMul||1),plane=M.project(camera.vp,[0,-.18,z]),p=atDepth(u,plane[1],z),phase=time+i*1.73,roll=.045*Math.sin(phase*.9),pitch=.03*Math.sin(phase*.7+1),facing=Math.atan2(1.8-z,p[0]),yaw=L.side?(L.side>0?Math.PI:0):facing+Math.PI*L.turn,moleYaw=Math.atan2(-p[0],1.8-z)-(L.side?yaw:facing),qx=[Math.sin(roll/2),0,0,Math.cos(roll/2)],qy=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],qz=[0,0,Math.sin(pitch/2),Math.cos(pitch/2)];const rotation=R.multiply(R.transform({rotation:qy}),R.multiply(R.transform({rotation:qx}),R.transform({rotation:qz}))),translation=R.transform({translation:[p[0],-.18+wave(p[0],z,time)-DRAFT*scale,z]}),world=R.multiply(translation,R.multiply(rotation,R.transform({scale:[scale,scale,scale]}))),mole=R.multiply(world,R.transform({translation:[0,DECK+.105*MOLE_SCALE,0],rotation:[0,Math.sin(moleYaw/2),0,Math.cos(moleYaw/2)],scale:[MOLE_SCALE,MOLE_SCALE,MOLE_SCALE]}));return{index:i,type:L.type,u,z,x:p[0],scale,yaw,side:L.side||0,visible:L.visible,ready:L.ready,move:L.move,dir:L.dir,waterY:-.18+wave(p[0],z,time),world,mole,deck:R.point(world,[0,DECK,0])};}
 function fallbackOrigin(index,time,round){return R.point(sample(index,time,round).mole,[-.6,2.1,0]);}
 const api={count:COUNT,boss:BOSS,tac0:TAC0,state,active,isBoss,isTactic,tacticPlan,tacticPool,shifts,moleScale:MOLE_SCALE,sample,fallbackOrigin,wave};if(node)module.exports=api;else root.MoleGame.PangCannonFleet=api;
})(typeof window!=='undefined'?window:globalThis);
