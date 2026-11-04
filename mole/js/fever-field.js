/* Two stationary touch boards. Each keeps the existing fever limit of eight. */
(function(root){
  'use strict';
  const MG=root.MoleGame;
  function create({config,rng,gridSize=4,weapon='hammer'}) {
    const count=gridSize*gridSize;
    const upper=MG.GridPartition.partition({gridSize,checkerboard:true});
    const reserved=weapon==='hammer'?[]:weapon==='alipunch'?[count-gridSize,count-1]:[count-1];
    const lower=upper.spawnPoints.filter(sp=>!reserved.includes(sp.regionId)).map(sp=>({...sp,id:sp.id+count,regionId:sp.regionId+count}));
    const settings={...config,multiHit:false,fourHit:false,animalMultiHit:false,reverseTarget:false,dualTarget:false,
      maxConcurrentMoles:8,maxConcurrentAnimals:0,maxConcurrentBombs:0,maxConcurrentItems:0,
      bombChance:0,strongBombChance:0,obstacles:false,shieldItems:false,cannonBurst:false};
    const schedulers=[upper.spawnPoints,lower].map(spawnPoints=>MG.SpawnScheduler.create({
      regions:spawnPoints.map(sp=>({id:sp.regionId})),spawnPoints,config:settings,rng
    }));
    // Scheduler-local IDs overlap. Prefix only the lower render IDs; region IDs are globally unique.
    const lowerPop=p=>({...p,id:'lower-'+p.id});
    const lowerResult=r=>r&&({...r,...(r.popId!=null?{popId:'lower-'+r.popId}:{})});
    const scheduler={
      tick(dt){const a=schedulers[0].tick(dt),b=schedulers[1].tick(dt);return {spawned:a.spawned.concat(b.spawned.map(lowerPop)),expired:a.expired.concat(b.expired.map(lowerPop))}},
      getActivePops(){return schedulers[0].getActivePops().concat(schedulers[1].getActivePops().map(lowerPop))},
      resolveRegion(id,opts){const results=schedulers[id>=count?1:0].resolveRegion(id,opts);return id>=count?results.map(lowerResult):results},
      resolveHit(id,opts){const lower=String(id).startsWith('lower-');const result=schedulers[lower?1:0].resolveHit(lower?Number(String(id).slice(6)):id,opts);return lower?lowerResult(result):result},
      forceRetreatAll(){schedulers.forEach(s=>s.forceRetreatAll())},
      lockMoleRegions(ids){schedulers.forEach(s=>s.lockMoleRegions(ids))},
      unlockMoleRegions(ids){schedulers.forEach(s=>s.unlockMoleRegions(ids))}
    };
    return {scheduler,config:settings,spawnPoints:upper.spawnPoints.concat(lower),upper:upper.spawnPoints,lower,count};
  }
  MG.FeverField={create};
})(window);
