/* One ordered input per tick. Same-frame simultaneous touch groups are discarded. */
(function(root){'use strict';
 function create(accept){let pending=[];return{push(direction,time,pointer){pending.push({direction,time,pointer});},clear(){pending=[];},flush(){const batch=pending;pending=[];batch.sort((a,b)=>a.time-b.time);for(let i=0;i<batch.length;){let j=i+1;while(j<batch.length&&batch[j].time-batch[i].time<=8)j++;const group=batch.slice(i,j);if(new Set(group.map(x=>x.direction)).size===1)accept(group[0].direction);i=j;}}};}
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.NeonSnakeInput=api;
})(typeof window!=='undefined'?window:globalThis);
