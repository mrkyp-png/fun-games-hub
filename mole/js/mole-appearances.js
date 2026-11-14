/* Appearance assets are independent of costume inventory and gameplay rules. */
(function(root){'use strict';
const R=root.StudioRig,MG=root.MoleGame=root.MoleGame||{};
const styles=['mohawk','spiky','curly','forelock'],names={mohawk:'Mohawk',spiky:'Spiky',curly:'Curly',forelock:'Forelock'};
const hex={mohawk:['#D8BE98','#733B50'],spiky:['#DCA88E','#35465F'],curly:['#B9AA99','#985B3E'],forelock:['#DFCD98','#356B65']};
function linear(s){return [1,3,5].map(i=>{const v=parseInt(s.slice(i,i+2),16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}).concat(1)}
const palettes=Object.fromEntries(styles.map(id=>[id,{body:linear(hex[id][0]),hair:linear(hex[id][1])}])),loads=new Map();
function load(id){if(!loads.has(id))loads.set(id,fetch('assets/characters-v1689/hair-'+id+'.glb').then(r=>{if(!r.ok)throw Error('Hair model '+r.status);return r.arrayBuffer()}).then(R.parseGLB).catch(e=>{loads.delete(id);throw e}));return loads.get(id)}
function random(random=Math.random){return styles[Math.min(3,Math.max(0,Math.floor(random()*4)))]}
function hairStyle(node){return node?.extras?.appearanceStyle||null}
async function prepare(model,ids=styles){
 const hairs=await Promise.all(ids.map(load)),g=JSON.parse(JSON.stringify(model.json));let bin=new Uint8Array(model.bin);const runtime=R.prepare({json:g,bin}),worlds=R.pose(runtime,null,0,false),head=g.nodes.findIndex(n=>n.name==='Head');
 if(head<0)throw Error('Appearance requires Head joint');const bindInverse=Array.from(R.inverse(worlds[head]));
 for(let h=0;h<hairs.length;h++){
  const source=hairs[h],s=source.json,bo=bin.length,ao=g.accessors.length,vo=g.bufferViews.length,mo=g.meshes.length,ma=g.materials.length,no=g.nodes.length,so=g.skins.length;
  const joined=new Uint8Array(bo+source.bin.length);joined.set(bin);joined.set(source.bin,bo);bin=joined;
  g.bufferViews.push(...s.bufferViews.map(v=>({...v,buffer:0,byteOffset:(v.byteOffset||0)+bo})));
  g.accessors.push(...s.accessors.map(a=>({...a,bufferView:a.bufferView+vo})));
  g.materials.push(...s.materials.map(m=>({...m,pbrMetallicRoughness:{...m.pbrMetallicRoughness,baseColorFactor:palettes[ids[h]].hair}})));
  g.meshes.push(...s.meshes.map(m=>({...m,primitives:m.primitives.map(p=>({...p,indices:p.indices===undefined?undefined:p.indices+ao,material:p.material+ma,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,v+ao]))}))})));
  g.skins.push(...s.skins.map(sk=>({...sk,joints:sk.joints.map(n=>n+no),inverseBindMatrices:sk.inverseBindMatrices+ao,...(sk.skeleton===undefined?{}:{skeleton:sk.skeleton+no})})));
  g.nodes.push(...s.nodes.map(n=>({...n,...(n.children?{children:n.children.map(c=>c+no)}:{}),...(n.mesh===undefined?{}:{mesh:n.mesh+mo}),...(n.skin===undefined?{}:{skin:n.skin+so}),extras:{...n.extras,appearanceStyle:ids[h]}})));
  for(const a of s.animations||[])g.animations.push({...a,samplers:a.samplers.map(t=>({...t,input:t.input+ao,output:t.output+ao})),channels:a.channels.map(c=>({...c,target:{...c.target,node:c.target.node+no}}))});
  const container=s.nodes.findIndex(n=>n.name==='HairAsset_'+names[ids[h]]);if(container<0)throw Error('Missing hair attachment');const n=g.nodes[container+no];delete n.translation;delete n.rotation;delete n.scale;n.matrix=bindInverse;g.nodes[head].children=(g.nodes[head].children||[]).concat(container+no);
 }
 g.buffers=[{byteLength:bin.length}];return {json:g,bin};
}
// 주둥이: 원래 몸색 대비 주둥이 밝기 비율을 새 몸색에 그대로 적용(같은 계열의 연한 색)
const baseBody=[0.68668532,0.51491767,0.31398872,1];
function muzzleColor(material,body){const m=material.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];return [0,1,2].map(k=>Math.min(1,body[k]*m[k]/baseBody[k])).concat(m[3]??1)}
function materialColor(material,id){const p=palettes[id];if(!p)return material.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];if(material.name==='Muzzle peach cream')return muzzleColor(material,p.body);return ['Clay warm caramel','Feet cocoa'].includes(material.name)?p.body:material.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]}
function vertexColors(model,primitive,id){
 const index=primitive.attributes.COLOR_0;if(index===undefined)return null;const original=R.accessor(model,index),material=model.json.materials[primitive.material];
 if(material.name!=='Head smooth tone'||!palettes[id])return original;
 const old=model.json.materials.find(m=>m.name==='Clay warm caramel').pbrMetallicRoughness.baseColorFactor,newColor=palettes[id].body,width=model.json.accessors[index].type==='VEC3'?3:4,result=new Float32Array(original);
 for(let i=0;i<result.length;i+=width)for(let k=0;k<3;k++)result[i+k]=Math.min(1,Math.max(0,original[i+k]/old[k]*newColor[k]));return result;
}
function paint(model,id){
 const g=model.json;for(const mesh of g.meshes)for(const primitive of mesh.primitives){if(g.materials[primitive.material].name!=='Head smooth tone')continue;const original=g.accessors[primitive.attributes.COLOR_0],colors=vertexColors(model,primitive,id),offset=model.bin.length,next=new Uint8Array(offset+colors.byteLength);next.set(model.bin);next.set(new Uint8Array(colors.buffer),offset);model.bin=next;const vi=g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:colors.byteLength,target:34962})-1;primitive.attributes.COLOR_0=g.accessors.push({bufferView:vi,componentType:5126,count:original.count,type:original.type})-1;}
 for(const m of g.materials)m.pbrMetallicRoughness={...m.pbrMetallicRoughness,baseColorFactor:materialColor(m,id)};g.buffers[0].byteLength=model.bin.length;return model;
}
const faces=new WeakMap();
function face(runtime,hurt=false){if(!faces.has(runtime)){const clip=runtime.animations.find(c=>c.name==='Smile'),smile=clip?clip.tracks.filter(t=>{const name=runtime.model.json.nodes[t.node].name;return name==='Jaw'||/^(Brow|MouthCorner|HappyEye)\.[LR]$/.test(name)||(t.path==='scale'&&/^(Eye|PainEye)\.[LR]$/.test(name))}):[];const hidden=runtime.model.json.nodes.flatMap((n,i)=>/^HappyEye\.[LR]$/.test(n.name)?[{node:i,path:'scale',times:new Float32Array([0]),values:new Float32Array([0,0,0]),width:3}]:[]);faces.set(runtime,{smile,hidden})}return faces.get(runtime)[hurt?'hidden':'smile']}
function pose(runtime,clip,time,loop,expression,windTime,id='mohawk'){return R.pose(runtime,clip,time,loop,expression,{animation:'HairWind_'+names[id],time:windTime})}
MG.MoleAppearances={styles,palettes,random,load,prepare,paint,materialColor,vertexColors,hairStyle,face,pose};
})(window);
