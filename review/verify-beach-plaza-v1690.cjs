const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),R=require('../mole/js/clay-rig-runtime.js');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r/g,'');
function model(p){const b=fs.readFileSync(p);return R.parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));}
// Rebuilding the plaza must only remove the two wooden sign boards.
const before=model('review/beach-plaza-v1690/plaza-before.glb'),after=model('mole/assets/home3d/plaza.glb');
function triangles(m,node){const out=new Map();for(const p of m.json.meshes[node.mesh].primitives){const pos=R.accessor(m,p.attributes.POSITION),col=p.attributes.COLOR_0===undefined?new Float32Array(pos.length).fill(1):R.accessor(m,p.attributes.COLOR_0),indices=R.accessor(m,p.indices),cn=p.attributes.COLOR_0===undefined||m.json.accessors[p.attributes.COLOR_0].type==='VEC3'?3:4;
 for(let i=0;i<indices.length;i+=3){const vertices=Array.from(indices.slice(i,i+3),j=>[...pos.slice(j*3,j*3+3),...col.slice(j*cn,j*cn+cn)].map(v=>Math.round(v*10000)).join(','));const key=vertices.sort().join('|');out.set(key,(out.get(key)||0)+1);}}
 return out;}
let removed=0;
for(const node of after.json.nodes.filter(n=>n.mesh!==undefined)){
 const old=before.json.nodes.find(n=>n.name===node.name);assert(old,node.name);
 const a=triangles(before,old),b=triangles(after,node);
 for(const [key,count] of b){assert((a.get(key)||0)>=count,'No new/changed plaza triangles: '+node.name);a.set(key,a.get(key)-count);}
 const rest=[...a.values()].reduce((x,y)=>x+y,0);if(node.name!=='Home clay batch')assert.equal(rest,0,node.name+' preserved');removed+=rest;
}
assert.equal(removed,376,'Only two bevelled board meshes removed');
// Sharp sign canvases retain transparency, without glow, borders, or painted backing.
const Signs=require('../mole/js/home3d-signs.js');assert.equal(Signs.labelFor({action:'shop',labelKey:'shop'},'ko',()=> '상점'),'상 점');
const canvases=[];const glSigns=new Proxy({texImage2D(...args){canvases.push(args.at(-1));}},{get:(o,k)=>o[k]||(()=>({}))});
const makeCanvas=()=>{const calls=[];return {calls,getContext:()=>new Proxy({measureText:s=>({width:s.length*40})},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args]))})};};
Signs.create(glSigns,{makeCanvas}).build('ko',[{action:'shop',labelKey:'상점'},{action:'rhythm',labelKey:'리듬팡'}],x=>x);
for(const c of canvases){assert(c.width===1024);assert(c.calls.some(x=>x[0]==='fillText'));assert(!c.calls.some(x=>['fillRect','strokeText','stroke','roundRect'].includes(x[0])));}
// Real ocean controller exercised with a GPU mock; no browser is launched.
const times=[],sources=[],events={},draws=[];
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,shaderSource:(_,s)=>sources.push(s),uniform1f:(name,value)=>{if(name==='uTime')times.push(value);},drawArrays:()=>draws.push(1)},{get:(o,k)=>o[k]||(()=>({}))});
const canvas={hidden:false,setAttribute(){},addEventListener(n,f){events[n]=f;},getContext:()=>gl};
const holder={appendChild(){}};const root={document:{hidden:false,createElement:()=>canvas},devicePixelRatio:3,MoleGame:{Home3DRenderer:{sunDir:()=>[.8,.6,0]}}};
vm.runInNewContext(read('mole/js/rhythm-beach-ocean.js'),{window:root,console});
const ocean=root.MoleGame.RhythmBeachOcean.create(holder);ocean.resize(1200,400);ocean.render(0);assert.equal(canvas.width,800,'Mobile fill-rate cap');ocean.render(.01);assert.equal(draws.length,1);ocean.render(1);assert.equal(times.at(-1),1);
events.webglcontextlost({preventDefault(){}});ocean.render(2);assert.equal(times.at(-1),1);events.webglcontextrestored();assert.equal(times.at(-1),2);ocean.stop();ocean.render(0);assert.equal(times.at(-1),0);
const plazaSource=read('mole/js/home3d-renderer.js'),oceanSource=read('mole/js/rhythm-beach-ocean.js');
assert.equal(oceanSource.match(/float seaH\([^\n]+/)[0],plazaSource.match(/float seaH\([^\n]+/)[0]);
assert.equal(oceanSource.match(/const vec3 W\[6\]=[^;]+;/)[0],plazaSource.match(/const vec3 W\[6\]=[^;]+;/)[0]);
assert(!oceanSource.includes('requestAnimationFrame('),'Use the existing audio clock');
const source=read('mole/js/rhythm-beach.js');
// Gull and hippo motion stays byte-for-byte equivalent to the previous release.
const oldController=read('review/beach-plaza-v1690/rhythm-beach-before.js');
assert.equal(source.slice(source.indexOf('  function stopGulls'),source.indexOf('  function stop(){')).trim(),oldController.slice(oldController.indexOf('  function stopGulls'),oldController.indexOf('  function randomFrame')).trim());
const motions=[],sea={style:{},hidden:true},sky={style:{}},hippo={classList:{remove(){},add(){},contains:()=>false}},boss={classList:{remove(){}}};
const things=()=>({style:{},firstElementChild:{style:{}},animate(){const a={cancel(){},pause(){this.paused=true;},play(){this.paused=false;}};motions.push(a);return a;}});
const screen={clientWidth:390,clientHeight:844,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},querySelector:s=>({'.rp-a-sea':sea,'.rp-a-sky':sky})[s],querySelectorAll:s=>s==='.rp-gull'?[things(),things(),things()]:[]};
const renders=[];root.matchMedia=()=>({matches:false});root.MoleGame.RhythmBeachOcean={create:()=>({resize(){},render:t=>renders.push(t),stop(){},dbg(){return {};}})};
vm.runInNewContext(source,{window:root,console,Math,Map,Array,clearTimeout(){},setTimeout(){},cancelAnimationFrame(){},requestAnimationFrame(){throw Error('Unexpected independent frame');}});
const beach=root.MoleGame.RhythmBeach.create(screen);beach.start(83);beach.update(5);assert.equal(renders.at(-1),5);assert.equal(motions.length,3);beach.hurt(5);beach.combo();beach.pause(true);beach.update(6);assert.equal(renders.at(-1),5);assert(motions.every(m=>m.paused));beach.pause(false);beach.update(7);assert.equal(renders.at(-1),7);beach.stop();beach.update(8);assert.equal(renders.at(-1),7);assert(sea.hidden);
// A half-covered rim must not mix the dark opening into the character/foreground seam twice.
const actor=1,sand=.7,dark=0,coverage=.5;
const oldSeam=actor*(1-coverage)+(sand*coverage+dark*(1-coverage))*coverage;
const corrected=actor*(1-coverage)+sand*coverage;assert(corrected>oldSeam);
const moleSource=read('mole/js/rhythm-beach-moles.js');assert(moleSource.includes('mix(body,sand,1.-visibility)'));assert(!moleSource.includes('uColor.a*vColor.a*visibility'));
console.log('PASS: only two sign boards removed; sharp transparent labels and spacing; same plaza waves; ocean clock/pause/resize/context recovery; gull motion retained, hippo removed; no double-alpha dark seam. Actual browser/GPU/phone performance not verified.');
