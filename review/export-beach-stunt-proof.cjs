/* Bake actual runtime hair/turn transforms for Blender QA. Not a game screenshot. */
const fs=require('fs'),path=require('path'),vm=require('vm'),R=require('../mole/js/clay-rig-runtime.js');
const dir=path.join(__dirname,'beach-stunts-v1690');fs.mkdirSync(dir,{recursive:true});const read=p=>fs.readFileSync(path.join(__dirname,'../mole',p));
const win={StudioRig:R,MoleGame:{}},context={window:win,console,fetch:async p=>{const b=read(p);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}}};
for(const file of ['js/mole-appearances.js','js/rhythm-beach-stunts.js'])vm.runInNewContext(read(file).toString(),context);
(async()=>{
 const AP=win.MoleGame.MoleAppearances,FX=win.MoleGame.RhythmBeachStunts,b=read('assets/home3d/mole-clay-v47-smile.glb'),model=await AP.prepare(R.parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.length))),rig=R.prepare(model),duration=rig.animations.find(a=>a.name==='Jump').duration;
 const forelockOnly=process.argv.includes('--forelock'),cases=forelockOnly?[['forelock',0,0],['forelock',.4,0],['forelock',.75,0],['forelock',1,0]]:[['mohawk',0,0],['mohawk',.25,0],['mohawk',.75,0],['mohawk',.70,10],['curly',0,0],['curly',.25,0],['curly',.5,0],['curly',.70,20]];
 const g={asset:{version:'2.0',generator:'Baked runtime hair and stunt QA; not browser'},buffers:[{}],bufferViews:[],accessors:[],materials:[],meshes:[],nodes:[],scenes:[{nodes:[]}],scene:0};let chunks=[],bytes=0;
 function accessor(data,type,component=5126){const arr=component===5125?new Uint32Array(data):new Float32Array(data),buffer=Buffer.from(arr.buffer),vi=g.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:buffer.length})-1;chunks.push(buffer);bytes+=buffer.length;return g.accessors.push({bufferView:vi,componentType:component,count:data.length/({VEC3:3,VEC4:4,SCALAR:1}[type]),type})-1;}
 for(let ci=0;ci<cases.length;ci++){
  const [id,p,combo]=cases[ci],worlds=AP.pose(rig,p?'Jump':'Idle',p*duration,!p,AP.face(rig),p*.42,id);FX.hair(rig,worlds,id,FX.hairMotion(p*.42,0,.42,id));
  const head=R.point(worlds[model.json.nodes.findIndex(n=>n.name==='Head')],[0,.57,0]),base=R.transform({translation:[ci%4*3-head[0],Math.floor(ci/4)*4+2.5-head[1],-head[2]]}),m={jumpAt:0};if(combo)FX.cue(m,combo,.19,.42);
  const inst=FX.turn(base,R.point(worlds[model.json.nodes.findIndex(n=>n.name==='Body')],[0,.2,0]),FX.sample(m,p*.42)),materialOffset=g.materials.length;
  g.materials.push(...model.json.materials.map(mat=>({...mat,pbrMetallicRoughness:{...mat.pbrMetallicRoughness,baseColorFactor:AP.materialColor(mat,id)}})));
  for(let node=0;node<model.json.nodes.length;node++){
   const n=model.json.nodes[node];if(n.mesh===undefined||(n.name!=='Mole_Clay_Skin'&&AP.hairStyle(n)!==id))continue;
   const palette=R.palette(rig,worlds,node),world=R.multiply(inst,worlds[node]),normalWorld=R.normals(world);
   for(const p of model.json.meshes[n.mesh].primitives){
    const positions=R.accessor(model,p.attributes.POSITION),normals=R.accessor(model,p.attributes.NORMAL),joints=R.accessor(model,p.attributes.JOINTS_0),weights=R.accessor(model,p.attributes.WEIGHTS_0),out=[],outNormals=[];
    for(let i=0;i<positions.length/3;i++){
     const j=joints.subarray(i*4,i*4+4),w=weights.subarray(i*4,i*4+4);out.push(...R.point(world,R.skinPoint(positions.subarray(i*3,i*3+3),j,w,palette)));
     const local=[0,0,0];for(let k=0;k<4;k++)for(let r=0;r<3;r++)for(let c=0;c<3;c++)local[r]+=palette[j[k]*16+c*4+r]*normals[i*3+c]*w[k];
     const nor=[0,0,0];for(let r=0;r<3;r++)for(let c=0;c<3;c++)nor[r]+=normalWorld[c*3+r]*local[c];const length=Math.hypot(...nor)||1;outNormals.push(...nor.map(x=>x/length));
    }
    const attributes={POSITION:accessor(out,'VEC3'),NORMAL:accessor(outNormals,'VEC3')};if(p.attributes.COLOR_0!==undefined)attributes.COLOR_0=accessor(AP.vertexColors(model,p,id),model.json.accessors[p.attributes.COLOR_0].type);
    const mi=g.meshes.push({primitives:[{attributes,indices:accessor(R.accessor(model,p.indices),'SCALAR',5125),material:materialOffset+p.material}]})-1;g.scenes[0].nodes.push(g.nodes.push({mesh:mi,name:ci+' '+id+' '+n.name})-1);
   }
  }
 }
 g.buffers[0].byteLength=bytes;let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),output=Buffer.alloc(28+json.length+bin.length);output.writeUInt32LE(0x46546c67);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(json.length,12);output.writeUInt32LE(0x4e4f534a,16);json.copy(output,20);output.writeUInt32LE(bin.length,20+json.length);output.writeUInt32LE(0x004e4942,24+json.length);bin.copy(output,28+json.length);fs.writeFileSync(path.join(dir,forelockOnly?'forelock-poses.glb':'runtime-poses.glb'),output);console.log('EXPORTED '+cases.length+' real skinned runtime snapshots, '+Math.round(output.length/1e6)+'MB');
})().catch(e=>{console.error(e);process.exitCode=1});
