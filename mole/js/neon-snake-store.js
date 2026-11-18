(function(root){'use strict';const MG=root.MoleGame,C=MG.NeonSnakeCore,KEY='mole.neonSnake.records.v1',PENDING='mole.neonSnake.settlement.v1';
 function defaults(){return {version:1,tutorial:false,arenas:C.ARENAS.map((a,i)=>({best:0,scoreReached:false,cleared:false,unlocked:i===0}))};}
 function load(){const base=defaults(),raw=root.localStorage.getItem(KEY);if(!raw)return base;let saved;try{saved=JSON.parse(raw);}catch(e){throw Error('Snake save is unreadable');}if(saved.version!==1||!Array.isArray(saved.arenas))throw Error('Unsupported snake save');base.tutorial=!!saved.tutorial;base.arenas=base.arenas.map((a,i)=>{const s=saved.arenas[i]||{};const best=Number.isSafeInteger(s.best)&&s.best>=0?s.best:0;return {best,scoreReached:!!s.scoreReached||(C.ARENAS[i].target!=null&&best>=C.ARENAS[i].target),cleared:!!s.cleared,unlocked:i===0||!!s.unlocked};});for(let i=0;i<7;i++)if(base.arenas[i].unlocked&&base.arenas[i].scoreReached&&base.arenas[i].cleared)base.arenas[i+1].unlocked=true;return base;}
 function tutorial(){const s=load();s.tutorial=true;root.localStorage.setItem(KEY,JSON.stringify(s));}
 function commit(result){const s=load(),a=C.ARENAS[result.arenaId];if(!a||!s.arenas[result.arenaId].unlocked||!Number.isSafeInteger(result.score)||result.score<0||!['gameOver','stageClear','perfectClear'].includes(result.result))throw Error('Invalid snake settlement');if(result.coins!==Math.floor(result.score/10)*({gameOver:1,stageClear:2,perfectClear:5}[result.result]))throw Error('Invalid snake reward');
  const record=s.arenas[a.id],oldBest=record.best,before=s.arenas.map(x=>x.unlocked);record.best=Math.max(record.best,result.score);record.scoreReached=record.scoreReached||(a.target!=null&&record.best>=a.target);record.cleared=record.cleared||result.result==='stageClear'||result.result==='perfectClear';
  for(let i=0;i<7;i++)if(s.arenas[i].unlocked&&s.arenas[i].scoreReached&&s.arenas[i].cleared)s.arenas[i+1].unlocked=true;
  if(!MG.Economy.awardCoinsOnce(result.playId,result.coins))throw Error('Coin award could not be saved');root.localStorage.setItem(KEY,JSON.stringify(s));root.localStorage.removeItem(PENDING);
  return {coins:result.coins,best:record.best,newRecord:result.score>oldBest,unlocked:s.arenas.findIndex((x,i)=>x.unlocked&&!before[i]),records:s};
 }
 function recover(){const raw=root.localStorage.getItem(PENDING);if(raw)return commit(JSON.parse(raw));return null;}
 function settle(state){if(state.finalResult==='forfeit')return {coins:0,best:load().arenas[state.arenaId].best,newRecord:false,unlocked:-1,records:load()};
  recover();const result={playId:state.playId,arenaId:state.arenaId,score:state.score,result:state.finalResult,coins:C.coins(state)};
  root.localStorage.setItem(PENDING,JSON.stringify(result));const settled=commit(result);state.settlementComplete=true;return settled;
 }
 function start(id){recover();if(!load().arenas[id]?.unlocked)throw Error('Arena is locked');const playId='neon-snake:'+(root.crypto?.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));return C.createState(id,playId);}
 MG.NeonSnakeStore={load,tutorial,recover,settle,start,KEY,PENDING};
})(window);
