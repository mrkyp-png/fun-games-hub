const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const current=fs.readFileSync('mole/js/rhythm.js','utf8'),before=fs.readFileSync('review/beach-rhythm-baseline-v1688.js','utf8'),meta=JSON.parse(fs.readFileSync('mole/assets/rhythm/jump-meta.json')),holeBase=fs.readFileSync('mole/js/rhythm-beach-moles.js','utf8').match(/const holeBase='([^']+)'/)[1],geometry=JSON.parse(fs.readFileSync('mole/'+holeBase+'geometry.json'));
function fn(source,name){let start=source.indexOf('    function '+name+'('),a=source.indexOf('{',start),depth=1,i=a+1;for(;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i)}
function context(source,w,h){const c={L:{},meta,CHARS:['cap','pink','braid','punk'],CONFIG:{apexFrame:3},stage:{clientWidth:w,clientHeight:h},beachVisual:{layout(){}},beachMoles:{holeGeometry:()=>geometry},el:{style:{setProperty(){}}},$:()=>({offsetHeight:45}),Math};vm.createContext(c);vm.runInContext(['layout','headAt','liftAt'].map(name=>fn(source,name)).join('\n'),c);c.layout();return c}
for(const [w,h] of [[360,500],[390,620],[430,720],[844,320]]){
 const a=context(before,w,h),b=context(current,w,h);assert(b.L.holeDrop>0,'Move holes down');assert.equal(a.L.targetY,b.L.targetY,'Target window stays fixed');
 for(let i=0;i<4;i++){assert(Math.abs(a.headAt(i,3).y-b.headAt(i,3).y)<1e-7,'Jump apex and hit circle stay at the target');assert(Math.abs(b.headAt(i,0).y-a.headAt(i,0).y-b.L.holeDrop)<1e-7,'Resting actor follows lowered hole');}
 const height=b.L.laneW*.98*geometry.height/geometry.width,bottom=b.L.moleBottom-b.L.sink+b.L.laneW*.04+height*(1-geometry.frontCenterY);assert(bottom<=h-3+1e-6,'Leave bottom margin');
 console.log(w+'x'+h+': hole down '+b.L.holeDrop.toFixed(2)+'px, target and apex unchanged');
}
assert(current.slice(current.indexOf('    function gameOver(clear)'),current.indexOf('    function showResult')).includes('beachMoles.stop()'),'Hide actors when the result opens');
console.log('PASS: lowered holes, matching resting actors, fixed target and jump apex, result actor cleanup');
