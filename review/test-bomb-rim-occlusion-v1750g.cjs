const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('mole/js/clay-round1-local.js','utf8');
const fragment=source.split(' const fs=`')[1].split('`;')[0];
const expression=fragment.match(/bool overRim=([^;]+);/)[1];
function overRim(withdrawing,y,weight=1){return vm.runInNewContext(expression,{uEntering:false,uWithdrawing:withdrawing,vOverRim:weight,vPosition:{y},uCarrying:true,uJump:false});}
// A carried arm is intentionally in front during idle, but must disappear behind
// the opaque lip during exit even while it is above the old .55 cutoff.
for(const y of [.6,.8,1,1.2]){assert.equal(overRim(false,y),true);assert.equal(overRim(true,y),false,'retreating bomb cannot bypass the hole/rim mask at height '+y);}
assert.equal(overRim(false,.4),false);assert.equal(overRim(true,.4),false);
const binding=source.match(/gl\.uniform1i\(loc\.uWithdrawing,([^;]+)\);/)[1];
const withdrawing=m=>vm.runInNewContext(binding,{m,isBombCarrier:m=>m.bomb||m.kind==='bomb'});
for(const kind of ['mole','animal','bomb'])assert(withdrawing({kind,bomb:true,dying:true}));
assert(!withdrawing({kind:'mole',bomb:true,dying:false}),'idle carrier keeps its foreground treatment');
assert(!withdrawing({kind:'mole',bomb:false,dying:true}),'ordinary mole treatment unchanged');
assert(fragment.includes('if(!uForegroundProp&&!overRim&&all(greaterThanEqual(rimUV'));
assert(source.includes('bindActor();gl.uniform1i(loc.uForegroundProp,!m.dying&&!motion.appearing)'),'retreating bomb prop also uses occlusion');
console.log('PASS actual shader expression disables carrier foreground bypass on retreat; body/arms/bomb are masked by hole lip; idle and ordinary moles retain original treatment');
