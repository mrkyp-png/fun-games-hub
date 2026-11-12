const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),R=require('../mole/js/clay-rig-runtime.js');
const original=fs.readFileSync('review/game-hammer-v1691/lane-hammer-release-v1690.js','utf8'),current=fs.readFileSync('mole/js/lane-hammer.js','utf8');
function laneEnv(source,grid){
 const calls=[],frames=new Map();let serial=0;const layer={children:[],appendChild(el){this.children.push(el);el.parentNode=this;}};
 const element=tag=>({tagName:tag,style:{},children:[],className:'',classList:{add(){},remove(){}},appendChild(el){this.children.push(el);},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(e=>e!==this);},offsetWidth:75});
 const win={MoleGame:{ClayRoundOne:{getGridSize:()=>grid},GameHammerModels:{create(opts){calls.push(opts.id);return {update(){},clear(){}};}}}};
 const c={window:win,document:{createElement:element},performance:{now:()=>0},Math:Object.assign(Object.create(Math),{random:()=>.25}),requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(source,c);return {layer,calls,create:opts=>win.MoleGame.LaneHammer.create({layer,...opts}),frame(time){const f=[...frames.values()];frames.clear();f.forEach(fn=>fn(time));},snapshot(){const el=layer.children[0];return JSON.parse(JSON.stringify({style:el.style,img:el.children[0]?.src}));}};
}
let comparisons=0;
for(const grid of [3,4])for(const id of ['hammer','goldhammer']){
 const old=laneEnv(original,grid),now=laneEnv(current,grid),opts={weaponId:id,...(id==='goldhammer'?{sprite:'assets/weapons/goldpaw-v1382.webp',grip:{x:49,y:72},cssClass:'lane-hammer--gold',gripOff:{x:.107,y:-.072},homeMarginTop:'-.15cm',idle:'spin'}:{idle:'bounce'})},a=old.create(opts),b=now.create(opts);let oldHits=0,newHits=0;
 const equal=()=>{assert.deepEqual(now.snapshot(),old.snapshot(),'Original2D position/rotation/size/opacity/image preserved');assert.equal(b.isBusy(),a.isBusy());assert.equal(newHits,oldHits);comparisons++;};equal();
 for(let row=0;row<grid;row++)for(let col=0;col<grid;col++){
  a.home();b.home();a.strike((col+.5)/grid,(row+.5)/grid,()=>oldHits++,'clay-mole');b.strike((col+.5)/grid,(row+.5)/grid,()=>newHits++,'clay-mole');
  for(const dt of [.02,.03,.04,.02,.025,.05,.05,.11,.11]){a.update(dt);b.update(dt);equal();}
 }
 a.home();b.home();for(let i=0;i<100;i++){a.update(.05);b.update(.05);equal();}
 a.spinIn(.1,.9,1000,3,.1,()=>oldHits++);b.spinIn(.1,.9,1000,3,.1,()=>newHits++);for(let t=0;t<=1100;t+=100){old.frame(t);now.frame(t);equal();}
 a.clear();b.clear();assert.equal(now.calls.length,id==='hammer'?0:1,'Only gold attaches a3D replacement');
}
const win={StudioRig:R,MoleGame:{}};vm.runInNewContext(fs.readFileSync('mole/js/game-hammer-models.js','utf8'),{window:win});const A=win.MoleGame.GameHammerModels;
assert.equal(A.create({id:'hammer',el:{closest:()=>null}}),null);assert.equal(A.ready('hammer'),false);
const bytes=fs.readFileSync('mole/assets/shop-models-v1509/goldhammer-v18-batched-v1520.glb'),model=R.parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)),viewBounds=R.bounds(model,R.instances(model).map(d=>({...d,world:R.multiply(A.viewMatrix,d.world)}))),inverseView=R.inverse(A.viewMatrix);
for(const [width,height]of [[75,105],[150,210],[50,80]])for(const deg of [18,-30,-82,180,378])for(const parentScale of [1,1.75]){
 const angle=deg*Math.PI/180,a=Math.cos(angle),b=Math.sin(angle),c=-b,d=a,tx=211,ty=153;
 const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>[tx+(a*x+c*y)*parentScale,ty+(b*x+d*y)*parentScale]),lo=[0,1].map(i=>Math.min(...corners.map(q=>q[i]))),hi=[0,1].map(i=>Math.max(...corners.map(q=>q[i]))),rect={left:lo[0],top:lo[1],width:hi[0]-lo[0],height:hi[1]-lo[1]},root={left:20,top:30,width:780,height:1688};
 const matrix=A.frameMatrix(viewBounds,width,height,rect,`matrix(${a},${b},${c},${d},-37,-42)`,root,390,844),fit=Math.min(width/(viewBounds.high[0]-viewBounds.low[0]),height/(viewBounds.high[1]-viewBounds.low[1]))*.98;
 for(let k=0;k<8;k++){
  const q=[viewBounds[k&1?'high':'low'][0],viewBounds[k&2?'high':'low'][1],viewBounds[k&4?'high':'low'][2]],point=R.point(matrix,R.point(inverseView,q)),x=width/2+(q[0]-viewBounds.center[0])*fit,y=height/2-(q[1]-viewBounds.center[1])*fit;
  assert(x>=0&&x<=width&&y>=0&&y<=height,'Actual projected3D model fits original2D box');assert(Math.abs(point[0]-(tx+(a*x+c*y)*parentScale-20)/2)<.001);assert(Math.abs(point[1]-(844-(ty+(b*x+d*y)*parentScale-30)/2))<.001,'3D model inherits the original sprite affine transform exactly');
 }
}
const shader=fs.readFileSync('mole/js/game-hammer-models.js','utf8');assert(shader.includes('vSurface=(uPart*vec4(aPosition,1.)).xyz'));assert(shader.includes('q=(vSurface-uModelLow)/uModelSpan'));assert(shader.includes('if(vFlash>.01)'));assert(!shader.includes('function pose('),'No custom attack-motion calculation in renderer');
const game=fs.readFileSync('mole/js/game.js','utf8');assert(!game.includes("&& !MG.GameHammerModels?.ready('goldhammer')"));assert(game.includes('selfImage:true'),'Legacy right-column clone keeps its original movement with3D replacement');
console.log(`PASS ${comparisons} release-versus-current motion snapshots: hammer remains2D, gold retains original moves/timings/idle/intro; real3D model fits90 original sprite transforms; procedural lightning uses model-surface coordinates. Actual GPU/browser visuals unverified.`);
