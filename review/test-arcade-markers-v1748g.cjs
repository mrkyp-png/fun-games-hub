const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const renderer=require('../mole/js/home3d-renderer.js');
for(let number=1;number<=8;number++){
  const g=renderer.roundNumberGeometry(number);
  assert(g.indices.length>0&&g.positions.length===g.normals.length);
  assert([...g.positions,...g.normals].every(Number.isFinite));
  for(let i=0;i<g.positions.length;i+=3){assert(Math.hypot(g.positions[i],g.positions[i+2])<.75,'digit stays inside hole');assert(g.positions[i+1]>=0&&g.positions[i+1]<.2,'solid raised stroke');}
  assert(Math.max(...g.indices)<g.positions.length/3);
}
for(const active of [false,true]){const b={unlocked:true,active},values=Array.from({length:50},(_,i)=>renderer.arcadeButtonBrightness(b,i/20));if(active){assert(Math.max(...values)-Math.min(...values)>.5);assert(Math.min(...values)>=.92);}else{assert.equal(new Set(values).size,1);assert.equal(values[0],.92,'unselected buttons retain their original brightness');}}
assert.equal(renderer.arcadeButtonBrightness({unlocked:false},1),.45);
const ring=renderer.arcadeSelectionRingGeometry();
for(const part of [ring.core,ring.halo]){
 assert(part.positions.length>0&&part.positions.length===part.normals.length);
 assert([...part.positions,...part.colors].every(Number.isFinite));
 for(let i=0;i<part.positions.length;i+=3){const radius=Math.hypot(part.positions[i],part.positions[i+2]);assert(radius>1.15&&radius<1.58,'ring stays around the physical button rim');}
}
assert([...ring.core.colors].filter((v,i)=>i%4===3).every(v=>v===1),'core ring is always opaque');
assert(ring.halo.colors.some((v,i)=>i%4===3&&v===0),'soft halo fades to transparent');
const source=fs.readFileSync('mole/js/home3d.js','utf8');
const a=source.indexOf('    function refreshArcade(force)');
const b=source.indexOf('\n    /*',a),code=source.slice(a,b);
let selected=false,screen;
const context={rd:{setArcade(){},setScreen:(...lines)=>screen=lines},opts:{rounds:()=>({chapter:selected?3:2,light:selected?'order':'mid',get:()=>({best:selected?456:123,cleared:false}),unlocked:()=>true})},
 root:{FGH:{I18N:{lang:'ko'}}},document:{getElementById:()=>selected?{}:null},
 MG:{OrderGame:{load:()=>({unlocked:3,best:{3:456}})}},L:{ARCADE_HOLES:[{n:2}],ARCADE_BUTTONS:['easy','mid','legend','order'].map(light=>({light}))},t:()=> '노말',arcadeKey:'',arcadeState:null,time:0};
vm.createContext(context);vm.runInContext(code+';refreshArcade(true);',context);
assert.equal(screen[0],'노말 2라운드');assert.equal(screen[1],'BEST 123');
selected=true;vm.runInContext('refreshArcade(true)',context);assert.equal(screen[0],'순서대로 잡아라 3라운드');assert.equal(screen[1],'BEST 456');assert(context.arcadeState.buttons[3].active);
selected=false;vm.runInContext('refreshArcade(true)',context);assert.equal(screen[0],'노말 2라운드');
for(const mode of ['easy','order','mid','order','legend','easy']){
 context.opts.rounds=()=>({light:mode,chapter:1,get:()=>({best:0,cleared:false}),unlocked:()=>true});
 vm.runInContext('refreshArcade(true)',context);
 const buttons=context.arcadeState.buttons;
 assert.equal(buttons.filter(b=>b.active).length,1,'exactly one mode selected after '+mode);
 assert.equal(buttons.find(b=>b.active).light,mode);
 assert.equal(buttons.filter(b=>renderer.arcadeButtonBrightness(b)>1).length,1,'only one light is on after '+mode);
}
const renderSource=fs.readFileSync('mole/js/home3d-renderer.js','utf8');assert(renderSource.includes('for(const h of arcade.holes)if(h.n>=1&&h.n<=8)draw(roundNumbers[h.n-1]'));
const ringPass=renderSource.slice(renderSource.indexOf('if(b.active&&b.unlocked&&modeSelectionRing)'),renderSource.indexOf('          const mh = arcade.moleOn'));
assert(ringPass.includes('draw(modeSelectionRing.core,world,null)'));assert(ringPass.includes('draw(modeSelectionRing.halo,world,null)'));assert(!ringPass.includes('Math.sin')&&!ringPass.includes('now'),'ring never blinks with the button');
console.log('PASS eight solid numbered meshes fit holes, selected button blinks and selection ring stays lit, locked state preserved, existing display restored, order display uses saved progress, numbers independent of clear state');
