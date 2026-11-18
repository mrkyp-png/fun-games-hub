const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root={MoleGame:{},StudioRig:{}};const context={window:root,console,setTimeout(){}};vm.createContext(context);
vm.runInContext(fs.readFileSync('mole/js/clay-round1-local.js','utf8'),context);
const C=root.MoleGame.ClayRoundOne;
for(const killed of [false,true])for(const dyingFrom of [0,1,2.5])for(const type of ['mole','animal','bomb']){
 const m={kind:type,bomb:true,dying:true,killed,dyingFrom,shownDepth:dyingFrom,_clayExitAt:0};
 let lastDepth=dyingFrom,lastWithdraw=0;
 for(let step=0;step<=100;step++){
  const fraction=step/100;m.shownDepth=dyingFrom+(4-dyingFrom)*fraction;
  const depth=C.sinkDepth(m),withdraw=C.withdrawProgress(m,fraction*.576);
  assert(depth>=lastDepth-1e-6&&withdraw>=lastWithdraw-1e-6,'continuous forward exit');
  if(fraction<=.22)assert.equal(depth,dyingFrom,'no downward movement before backing into hole');
  if(depth>dyingFrom)assert.equal(withdraw,1,'fully behind the rim before sinking');
  lastDepth=depth;lastWithdraw=withdraw;
 }
 assert.equal(lastDepth,4);assert.equal(lastWithdraw,1);
}
assert.equal(C.withdrawProgress({kind:'mole',bomb:true,dying:false,shownDepth:0},1),0);
assert.equal(C.sinkDepth({kind:'mole',dying:true,killed:true,shownDepth:1}),1,'ordinary hit exit unchanged');
for(const killed of [false,true]){
 const m={kind:'mole',bomb:true,dying:true,killed,dyingFrom:0,shownDepth:0,_clayExitAt:0};
 let lastZ=0;
 for(let step=0;step<=22;step++){
  m.shownDepth=4*step/100;
  const translation=C.retreatTranslation(m);
  assert.equal(Math.abs(translation[1]),0,'rendered body keeps its height during backward motion');
  assert(translation[2]<=lastZ);lastZ=translation[2];
 }
 assert(Math.abs(lastZ+.5)<1e-6,'original backward distance reached before descent');
 m.shownDepth=2.4;const sinking=C.retreatTranslation(m);assert(sinking[1]<0);assert(Math.abs(sinking[2]+.5)<1e-6,'vertical descent keeps the original backward position');
}
console.log('PASS bomb backs into hole before descending, same path for hit/timeout and all carrier types, monotonic exit at all starting depths, ordinary hit exit unchanged');
