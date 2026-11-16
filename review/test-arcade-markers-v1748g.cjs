const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const renderer=require('../mole/js/home3d-renderer.js');
for(let number=1;number<=8;number++){
  const g=renderer.roundNumberGeometry(number);
  assert(g.indices.length>0&&g.positions.length===g.normals.length);
  assert([...g.positions,...g.normals].every(Number.isFinite));
  for(let i=0;i<g.positions.length;i+=3){assert(Math.hypot(g.positions[i],g.positions[i+2])<.75,'digit stays inside hole');assert(g.positions[i+1]>=0&&g.positions[i+1]<.2,'solid raised stroke');}
  assert(Math.max(...g.indices)<g.positions.length/3);
}
for(const active of [false,true]){const b={unlocked:true,active},values=Array.from({length:50},(_,i)=>renderer.arcadeButtonBrightness(b,i/20));assert(Math.max(...values)-Math.min(...values)>.25);assert(Math.min(...values)>.7);}
assert.equal(renderer.arcadeButtonBrightness({unlocked:false},1),.45);
const source=fs.readFileSync('mole/js/home3d.js','utf8');
const a=source.indexOf('    function refreshArcade(force)');
const b=source.indexOf('\n    /*',a),code=source.slice(a,b);
let selected=false,screen;
const context={rd:{setArcade(){},setScreen:(...lines)=>screen=lines},opts:{rounds:()=>({chapter:2,light:'mid',get:()=>({best:123,cleared:false}),unlocked:()=>true})},
 root:{FGH:{I18N:{lang:'ko'}}},document:{getElementById:()=>selected?{}:null},
 MG:{OrderGame:{load:()=>({unlocked:3,best:{3:456}})}},L:{ARCADE_HOLES:[{n:2}],ARCADE_BUTTONS:['easy','mid','legend','order'].map(light=>({light}))},t:()=> '노말',arcadeKey:'',arcadeState:null,time:0};
vm.createContext(context);vm.runInContext(code+';refreshArcade(true);',context);
assert.equal(screen[0],'노말 2라운드');assert.equal(screen[1],'BEST 123');
selected=true;vm.runInContext('refreshArcade(true)',context);assert.equal(screen[0],'순서대로 잡아라 3라운드');assert.equal(screen[1],'BEST 456');assert(context.arcadeState.buttons[3].active);
selected=false;vm.runInContext('refreshArcade(true)',context);assert.equal(screen[0],'노말 2라운드');
const renderSource=fs.readFileSync('mole/js/home3d-renderer.js','utf8');assert(renderSource.includes('for(const h of arcade.holes)if(h.n>=1&&h.n<=8)draw(roundNumbers[h.n-1]'));
console.log('PASS eight solid numbered meshes fit holes, selectable buttons pulse, locked state preserved, existing display restored, order display uses saved progress, numbers independent of clear state');
