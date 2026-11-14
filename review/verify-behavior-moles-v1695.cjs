// 나쁜 두더지(술·담배·휴대폰·도둑) 게임 적용 검사 — 모의 WebGL, 실제 GLB·실제 clay-round1-local.js
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),R=require('../mole/js/clay-rig-runtime.js');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,'mole',p.split('?')[0]));
const fetch=async p=>{const b=read(String(p));return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length),blob:async()=>new Blob([b])}};
function glMock(){const v={draws:0,maxJointUpload:0,sources:[],finite:true};const gl=new Proxy({getParameter:()=>256,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,getAttribLocation:(_,n)=>['aPosition','aNormal','aColor','aJoints','aWeights','aUV'].indexOf(n),shaderSource:(_,s)=>v.sources.push(s),uniformMatrix4fv:(n,_,a)=>{if(!Array.from(a).every(Number.isFinite))v.finite=false;if(n==='uJoints[0]')v.maxJointUpload=Math.max(v.maxJointUpload,a.length/16)},drawElements:()=>v.draws++,drawArrays:()=>v.draws++},{get:(o,k)=>k in o?o[k]:()=>({})});return {gl,v}}
(async()=>{
 const {gl,v}=glMock(),raf=[],gameScreen={style:{setProperty(){}},classList:{toggle(){}},appendChild(){}},board={clientWidth:390,clientHeight:420};
 const doc={hidden:false,getElementById:id=>id==='game-screen'?gameScreen:id==='mole-board'?board:{appendChild(){},append(){}},createElement:()=>({getContext:()=>gl,classList:{toggle(){}},remove(){}})};
 const win={StudioRig:R,MoleGame:{},matchMedia:()=>({matches:false})};
 const sb={window:win,fetch,console,Float32Array,Uint8Array,Uint32Array,Map,WeakMap,Promise,Math,Blob,document:doc,devicePixelRatio:1,requestAnimationFrame:f=>raf.push(f),cancelAnimationFrame(){},setTimeout:()=>{},Image:class{decode(){return Promise.resolve()}},createImageBitmap:async()=>({width:4,height:4,close(){}})};
 vm.runInNewContext(fs.readFileSync(path.join(root,'mole/js/mole-appearances.js'),'utf8'),sb);
 vm.runInNewContext(fs.readFileSync(path.join(root,'mole/js/clay-round1-local.js'),'utf8'),sb);
 const game=win.MoleGame.ClayRoundOne;await game.prepare();
 const errs=[];sb.console={...console,error:(...a)=>{errs.push(a.join(' '));console.error(...a)}};
 for(let i=0;i<400;i++){await new Promise(r=>setImmediate(r))}
 assert.deepEqual(errs,[],'all four behavior models loaded');
 assert(v.sources.some(s=>s.includes('uJoints[54]')),'shader sized for 54-joint behavior models');
 game.setActive(true);
 const seen={},orig=Math.random;let k=0;
 const moles=[];for(let i=0;i<10;i++){Math.random=()=>((i%5)+.5)/5;const m={el:{isConnected:true,style:{left:(10+i*8)+'%',top:'50%'}},img:{style:{}},kind:'mole',hits:0,shownDepth:0,remaining:5};game.renderPop(m);moles.push(m);seen[m._behavior||'normal']=(seen[m._behavior||'normal']||0)+1}
 Math.random=orig;
 assert.deepEqual(Object.keys(seen).sort(),['drink','normal','phone','smoke','thief']);
 const bomb={el:{isConnected:true,style:{left:'50%',top:'50%'}},img:{style:{}},kind:'mole',bomb:true,hits:0,shownDepth:0};game.renderPop(bomb);
 assert.equal(bomb._behavior,null,'bomb carrier keeps bomb motion');assert(['mohawk','spiky','curly','forelock'].includes(bomb._appearance));
 // 올라온 뒤 시간 진행: 나쁜 두더지 동작으로 그려짐
 let t=100;for(let f=0;f<40;f++){t+=50;game.clock(t);raf.shift()()}
 assert(v.draws>0&&v.finite,'draws finite');assert(v.maxJointUpload>=54,'54-joint palette uploaded '+v.maxJointUpload);
 // 맞으면 일반 두더지
 for(const b of ['drink','smoke','phone','thief']){
  const hit=moles.find(m=>m._behavior===b);hit.hits=1;game.renderPop(hit);
  assert(hit._propFly,'prop fly starts on hit: '+b);
  const before=v.draws;t+=50;game.clock(t);raf.shift()();assert(v.draws>before&&v.finite,'hit frame draws finite: '+b);
 }
 for(let f=0;f<20;f++){t+=50;game.clock(t);raf.shift()()}
 assert(v.finite);
 const sw=fs.readFileSync(path.join(root,'mole/sw.js'),'utf8');
 console.log('PASS behavior moles: kinds',JSON.stringify(seen),'joints upload',v.maxJointUpload,'draws',v.draws,'sw lists v1694 assets:',sw.includes('characters-v1694'));
})().catch(e=>{console.error(e);process.exitCode=1});
