/* NEON SNAKE v1.1: deterministic grid rules; no DOM, renderer or economy. */
(function(root){'use strict';
 const ARENAS=Object.freeze(Array.from({length:8},(_,id)=>Object.freeze({id,size:id+5,total:(id+5)**2,stepMs:500-id*30,clearLength:Math.ceil((id+5)**2*.8),target:[100,150,200,300,400,500,700,null][id]})));
 const DIR=Object.freeze({up:{x:0,y:-1},right:{x:1,y:0},down:{x:0,y:1},left:{x:-1,y:0}}),opposite={up:'down',down:'up',left:'right',right:'left'};
 const same=(a,b)=>a.x===b.x&&a.y===b.y,copy=p=>({x:p.x,y:p.y}),valid=(p,n)=>p.x>=0&&p.y>=0&&p.x<n&&p.y<n;
 function createState(id=0,playId='snake-'+Date.now()){const a=ARENAS[id];if(!a)throw Error('Unknown arena');const x=Math.floor(a.size/2),y=Math.floor(a.size/2);return {playId,arenaId:id,state:'countdown',body:[{x,y},{x:x-1,y},{x:x-2,y}],facing:['right','right','right'],direction:'right',queued:null,startReserved:false,initialCountdown:true,score:0,food:null,pendingGrowth:0,normalCount:0,reached80:false,choiceShown:false,perfectChallenge:false,finalResult:null,settlementComplete:false,tick:0,eventSerial:0,events:[]};}
 function event(s,type,data={}){s.events.push({type,serial:++s.eventSerial,...data});if(s.events.length>32)s.events.shift();}
 function nextPoint(s,d=s.direction){const v=DIR[d];return{x:s.body[0].x+v.x,y:s.body[0].y+v.y};}
 function startSafe(s,d){const p=nextPoint(s,d);return valid(p,ARENAS[s.arenaId].size)&&!s.body.slice(0,-1).some(q=>same(p,q));}
 function reserve(s,d){if(!DIR[d]||d===opposite[s.direction])return false;
  const starting=s.state==='countdown'&&s.initialCountdown;if(s.state!=='playing'&&!starting)return false;
  if(s.queued||starting&&s.startReserved||starting&&!startSafe(s,d))return false;
  s.queued=d;if(starting)s.startReserved=true;event(s,'direction',{direction:d});return true;
 }
 function emptyCells(s){const a=ARENAS[s.arenaId],occupied=new Set(s.body.map(p=>p.y*a.size+p.x)),out=[];for(let y=0;y<a.size;y++)for(let x=0;x<a.size;x++)if(!occupied.has(y*a.size+x))out.push({x,y});return out;}
 function spawnFood(s,random=Math.random,first=false){const a=ARENAS[s.arenaId];if(s.food||s.finalResult||s.body.length+s.pendingGrowth>=a.total)return s.food;
  const cells=emptyCells(s);if(!cells.length)return null;let at;
  if(first){const d=s.queued||s.direction,v=DIR[d];let p=nextPoint(s,d);while(valid(p,a.size)){if(!s.body.some(q=>same(p,q))){at=p;break;}p={x:p.x+v.x,y:p.y+v.y};}}
  if(!at){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random source');at=cells[Math.floor(r*cells.length)];}
  s.food={...at,kind:s.normalCount>=5?'golden':'normal',bornTick:s.tick};event(s,'foodSpawn');return s.food;
 }
 function go(s,random=Math.random){if(s.state!=='countdown'||s.finalResult)return false;const first=s.initialCountdown;if(first){if(s.queued){s.direction=s.queued;s.facing[0]=s.direction;}s.queued=null;s.initialCountdown=false;}s.state='playing';spawnFood(s,random,first);event(s,'go');return true;}
 function finish(s,result){if(s.finalResult||!['gameOver','stageClear','perfectClear','forfeit'].includes(result))return false;s.finalResult=result;s.queued=null;s.state=result==='gameOver'?'collisionAnimation':result;s.food=result==='perfectClear'?null:s.food;event(s,'finished',{result});return true;}
 function tick(s,random=Math.random){if(s.state!=='playing'||s.finalResult)return false;
  if(s.queued)s.direction=s.queued;s.queued=null;
  const a=ARENAS[s.arenaId],next=nextPoint(s),food=s.food&&same(s.food,next)?s.food:null,gain=food?(food.kind==='golden'?3:1):0,growing=s.body.length<a.total&&(s.pendingGrowth+gain>0),colliders=growing?s.body:s.body.slice(0,-1);
  if(!valid(next,a.size)||colliders.some(p=>same(p,next))){finish(s,'gameOver');return false;}
  const before=s.body.map(copy);s.body.unshift(next);if(!growing)s.body.pop();
  s.facing=s.body.map((p,i)=>{const oldIndex=Math.min(i,before.length-1),old=before[oldIndex];const dx=p.x-old.x,dy=p.y-old.y;return dx>0?'right':dx<0?'left':dy>0?'down':dy<0?'up':s.facing[oldIndex]||s.direction;});
  if(food){s.score+=food.kind==='golden'?50:10;s.normalCount=food.kind==='golden'?0:s.normalCount+1;s.food=null;event(s,'eat',{kind:food.kind,points:food.kind==='golden'?50:10,x:next.x,y:next.y});}
  s.pendingGrowth=Math.max(0,Math.min(a.total-s.body.length,s.pendingGrowth+gain-(growing?1:0)));s.tick++;
  if(s.body.length===a.total){s.pendingGrowth=0;finish(s,'perfectClear');return true;}
  if(s.body.length>=a.clearLength&&!s.choiceShown){s.reached80=true;s.choiceShown=true;s.state='80percentChoice';event(s,'choice80');}
  if(s.state==='playing')spawnFood(s,random);event(s,'tick');return true;
 }
 function choose(s,perfect){if(s.state!=='80percentChoice'||s.finalResult)return false;if(!perfect)return finish(s,'stageClear');s.perfectChallenge=true;s.state='countdown';s.queued=null;return true;}
 function pause(s){if(!['playing','countdown','80percentChoice','clearConfirm'].includes(s.state)||s.finalResult)return false;s.resumeState=s.state==='80percentChoice'?'80percentChoice':'playing';if(!s.initialCountdown)s.queued=null;s.state='paused';return true;}
 function resume(s){if(s.state!=='paused')return false;s.state=s.resumeState==='80percentChoice'?'80percentChoice':'countdown';return true;}
 function canClear(s){return s.reached80&&s.perfectChallenge&&!s.finalResult;}
 function confirmClear(s){if(s.state!=='paused'||!canClear(s))return false;s.state='clearConfirm';return true;}
 function clearDecision(s,yes){if(s.state!=='clearConfirm')return false;if(yes)return finish(s,'stageClear');s.state='paused';return true;}
 function coins(s){if(!s.finalResult)return 0;return Math.floor(s.score/10)*({gameOver:1,stageClear:2,perfectClear:5,forfeit:0}[s.finalResult]);}
 const api={ARENAS,DIR,opposite,createState,reserve,startSafe,emptyCells,spawnFood,go,tick,choose,pause,resume,canClear,confirmClear,clearDecision,finish,coins};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MoleGame=root.MoleGame||{};root.MoleGame.NeonSnakeCore=api;
})(typeof window!=='undefined'?window:globalThis);
