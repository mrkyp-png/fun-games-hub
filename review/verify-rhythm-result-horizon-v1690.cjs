const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('mole/js/rhythm.js','utf8');
function fn(name){const begin=source.indexOf('    function '+name+'('),brace=source.indexOf('{',begin);let depth=1,end=brace+1;for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(begin,end);}
const geometry=JSON.parse(fs.readFileSync('mole/assets/rhythm/beach-sand-hole-v1690/geometry.json'));
let seaHorizon;
const layoutContext={L:{},meta:JSON.parse(fs.readFileSync('mole/assets/rhythm/jump-meta.json')),CHARS:['cap','pink','braid','punk'],CONFIG:{apexFrame:3},stage:{clientWidth:390,clientHeight:620,offsetTop:23},beachVisual:{layout:y=>seaHorizon=y},beachMoles:{holeGeometry:()=>geometry},el:{style:{setProperty(){}}},$:()=>({offsetHeight:45}),Math};
vm.createContext(layoutContext);vm.runInContext(['layout','headAt','liftAt'].map(fn).join('\n'),layoutContext);layoutContext.layout();
assert.equal(seaHorizon,23+layoutContext.L.horizonY,'Water receives the actual weapon launch line in screen coordinates');
const nodes=new Map(),node=()=>({hidden:true,textContent:'',dataset:{},classList:{remove(){},toggle(){},add(){}}});
const events=[];let frames=0;
const result={cnt:{PERFECT:1,GREAT:1,GOOD:1,MISS:1},notes:[1,2,3,4],score:120,maxCombo:3,practice:true};
const c={closing:false,resultSerial:0,diff:'NORMAL',sharedRules:{resultRating:()=>({rank:'C',accuracy:75,fullCombo:false,allPerfect:false})},$:key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);},localStorage:{getItem:()=>null},aBestPrefix:()=> 'a.',bBestPrefix:()=> 'b.',MG:{},Math,performance:{now:()=>0},requestAnimationFrame:()=>frames++,setTimeout(){throw Error('Result must appear synchronously');},
 st:result,statusFx:{stop(){}},clearButtonWaves(){},beachVisual:{pause:on=>events.push(['pause',on]),stop:()=>{throw Error('Do not expose old background');}},beachMoles:{stop:()=>events.push(['hideActors'])},lyricTicker:{clear(){}},el:{querySelectorAll:()=>[]},src:{stop(){}},ctx:{currentTime:10},clearComboSweeps(){},clearAGauge(){}};
vm.createContext(c);vm.runInContext(['gameOver','showResult'].map(fn).join('\n'),c);c.gameOver(false);
assert.equal(nodes.get('[data-rp-result]').hidden,false,'Result visible before gameOver returns');assert.deepEqual(events,[['pause',true],['hideActors']]);assert.equal(frames,1,'Existing score count-up retained');
const controller=fs.readFileSync('mole/js/rhythm-beach.js','utf8');assert(!controller.includes('bossHeight'),'Horizon does not depend on hippo');
const ocean=fs.readFileSync('mole/js/rhythm-beach-ocean.js','utf8');assert(ocean.includes('fwidth(ph)'),'Distant waves are filtered before they alias');assert(ocean.includes('float horizonAlpha=smoothstep(0.,5./uSize.y,uv.y)'),'Narrow smooth horizon transition');assert(!fs.readFileSync('mole/index.html','utf8').includes('<div class="rp-a-cloud-boss"><div class="rp-hippo">'),'Cloud hippo removed');
console.log('PASS: actual weapon launch horizon shared by water; same-frame result without old-background exposure; actors hidden; score animation retained; horizon waves remain visible. Browser visuals unverified.');
