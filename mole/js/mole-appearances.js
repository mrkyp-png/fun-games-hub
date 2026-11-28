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
let repairCostume;
function arcadeRepair() {
 if(!repairCostume)repairCostume=fetch('assets/home3d/mole-arcade-repair.glb')
  .then(response=>{if(!response.ok)throw Error('Arcade repair costume '+response.status);return response.arrayBuffer();})
  .then(R.parseGLB).catch(()=>{repairCostume=null;return null;});
 return repairCostume;
}
// V1812 C: 리듬팡 비치 2~4번 두더지 복장(뼈 고정 부품, review/beach-costumes/export.cjs)
const wornCostumes=new Map();
function wornCostume(id){if(!wornCostumes.has(id))wornCostumes.set(id,fetch('assets/home3d/mole-costume-'+id+'.glb').then(r=>{if(!r.ok)throw Error('Costume '+id+' '+r.status);return r.arrayBuffer();}).then(R.parseGLB).catch(()=>{wornCostumes.delete(id);return null;}));return wornCostumes.get(id);}
function costumeParts(model,costume) {
 if(!costume)return [];
 return R.instances(costume).flatMap(({name,primitive})=>{
  const joint=model.json.nodes.findIndex(node=>node.name===name);
  return joint<0?[]:[{joint,primitive}];
 });
}
// V1842 C 사용자: 광장 조끼 기준 — 팔꿈치(Forearm 평균)가 몸통보다 올라간 만큼(점프 0.5배·날갯짓 0.7배) 조끼를 모양 그대로 위로
const liftRest=new WeakMap();
function vestLift(runtime,worlds,clip,factor,higherArm=false){ // higherArm: 두 팔꿈치 평균 대신 더 높은 쪽(한 손만 들어도 올라감, V1843 C 춤)
 if(!liftRest.has(runtime)){const nodes=runtime.model.json.nodes,at=n=>nodes.findIndex(x=>x.name===n),ids=[at('Body'),at('Forearm.L'),at('Forearm.R')],rest=R.pose(runtime,null,0,false),parent=new Int32Array(nodes.length).fill(-1);nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));
  const under=(i,top)=>{for(;i>=0;i=parent[i])if(i===top)return true;return false},head=at('Head');
  liftRest.set(runtime,ids.every(i=>i>=0)?{ids,base:(rest[ids[1]][13]+rest[ids[2]][13])/2-rest[ids[0]][13],moved:nodes.map((n,i)=>under(i,ids[0])&&!under(i,head))}:null);}
 const r=liftRest.get(runtime);if(!r)return {lift:0,worlds};
 const elbow=higherArm?Math.max(worlds[r.ids[1]][13],worlds[r.ids[2]][13]):(worlds[r.ids[1]][13]+worlds[r.ids[2]][13])/2;
 const lift=(factor??(clip==='Flap'?.7:.5))*Math.max(0,elbow-worlds[r.ids[0]][13]-r.base);
 if(!lift)return {lift,worlds};
 const up=R.transform({translation:[0,lift,0]});return {lift,worlds:worlds.map((w,i)=>r.moved[i]?R.multiply(up,w):w)}; // 몸통과 그 아래 뼈(머리 쪽 제외)만 올림 → 고글 등 머리 부품은 그대로
}
// V1844 C 사용자: 일자 눈썹 = 곧은 직선 — 눈썹 점을 좌우 위치별 가운데 선이 한 높이가 되게 위아래로 옮김(두께 그대로). 'Eyebrow' 재질 부품의 새 위치 배열
function straightBrow(model,primitive){
 const P=R.accessor(model,primitive.attributes.POSITION),out=new Float32Array(P),N=24;
 for(const side of [1,-1]){
  const idx=[];for(let v=0;v<P.length/3;v++)if((P[v*3]>=0?1:-1)===side)idx.push(v);if(!idx.length)continue;
  let lo=Infinity,hi=-Infinity;for(const v of idx){lo=Math.min(lo,P[v*3]);hi=Math.max(hi,P[v*3]);}
  const span=hi-lo||1,bin=x=>Math.min(N-1,Math.floor((x-lo)/span*N)),mn=new Array(N).fill(Infinity),mx=new Array(N).fill(-Infinity);
  for(const v of idx){const b=bin(P[v*3]);mn[b]=Math.min(mn[b],P[v*3+1]);mx[b]=Math.max(mx[b],P[v*3+1]);}
  const mid=mn.map((a,b)=>Number.isFinite(a)?(a+mx[b])/2:null),known=mid.map((m,b)=>m===null?null:b).filter(b=>b!==null),avg=known.reduce((s,b)=>s+mid[b],0)/known.length;
  const center=x=>{const t=Math.max(known[0],Math.min(known[known.length-1],(x-lo)/span*N-.5));let a=known[0],c=known[known.length-1];for(const b of known){if(b<=t)a=b;if(b>=t){c=b;break;}}return a===c?mid[a]:mid[a]+(mid[c]-mid[a])*(t-a)/(c-a);};
  for(const v of idx)out[v*3+1]=P[v*3+1]-center(P[v*3])+avg;
 }
 return out;
}
// V1844 C 사용자: 'angry' 화난 눈썹(안쪽 끝을 아래로 기울임). 머리가 움직인 만큼 따라감
const BROW_ANGRY=.38,browIds=new WeakMap();
function browShape(runtime,worlds,kind){
 if(!browIds.has(runtime)){const nodes=runtime.model.json.nodes,at=n=>nodes.findIndex(x=>x.name===n),head=at('Head');browIds.set(runtime,{head,rest:head<0?null:R.pose(runtime,null,0,false)[head],brows:[at('Brow.L'),at('Brow.R')].filter(i=>i>=0)});}
 const {head,rest,brows}=browIds.get(runtime);if(head<0||!kind)return worlds;
 const H=R.multiply(worlds[head],R.inverse(rest)),Hi=R.inverse(H); // 머리가 휴식 자세에서 움직인 만큼 — 그 안에서는 두더지 좌표(위 Y·앞 Z·옆 X)
 for(const k of brows){const local=R.multiply(Hi,worlds[k]),p=[local[12],local[13],local[14]],side=p[0]>=0?1:-1;
  const shape=R.transform({rotation:[0,0,Math.sin(side*BROW_ANGRY/2),Math.cos(side*BROW_ANGRY/2)]});
  const about=R.multiply(R.multiply(R.transform({translation:p}),shape),R.transform({translation:p.map(v=>-v)}));
  worlds[k]=R.multiply(H,R.multiply(about,local));}
 return worlds;
}
// V1843 C 사용자: 세이프찬스 조끼도 주황 조끼와 똑같이 — 머리 위쪽 점(고글, 높이 1.95 위·머리 뼈 위주)은 머리 뼈, 나머지는 몸통 뼈에 딱 붙임(팔·머리 무게가 섞여 늘어나던 것 제거)
function rigidWorn(model,worn){
 if(!worn)return worn;const names=model.json.skins[0].joints.map(n=>model.json.nodes[n].name),body=names.indexOf('Body'),head=names.indexOf('Head');if(body<0||head<0)return worn;
 const g=JSON.parse(JSON.stringify(worn.json));let bin=worn.bin;
 const add=(data,count)=>{const off=bin.length,next=new Uint8Array(off+data.byteLength);next.set(bin);next.set(new Uint8Array(data.buffer),off);bin=next;const view=g.bufferViews.push({buffer:0,byteOffset:off,byteLength:data.byteLength,target:34962})-1;return g.accessors.push({bufferView:view,componentType:5126,count,type:'VEC4'})-1;};
 for(const mesh of g.meshes)for(const p of mesh.primitives){
  const J=R.accessor(worn,p.attributes.JOINTS_0),W=R.accessor(worn,p.attributes.WEIGHTS_0),P=R.accessor(worn,p.attributes.POSITION),n=W.length/4,nj=new Float32Array(n*4),nw=new Float32Array(n*4);
  for(let v=0;v<n;v++){let b=0;for(let k=1;k<4;k++)if(W[v*4+k]>W[v*4+b])b=k;nj[v*4]=J[v*4+b]===head&&P[v*3+1]>1.95?head:body;nw[v*4]=1;}
  p.attributes.JOINTS_0=add(nj,n);p.attributes.WEIGHTS_0=add(nw,n);
 }
 g.buffers=[{byteLength:bin.length}];return {json:g,bin};
}
const faces=new WeakMap();
function face(runtime,hurt=false){if(!faces.has(runtime)){const clip=runtime.animations.find(c=>c.name==='Smile'),smile=clip?clip.tracks.filter(t=>{const name=runtime.model.json.nodes[t.node].name;return name==='Jaw'||/^(Brow|MouthCorner|HappyEye)\.[LR]$/.test(name)||(t.path==='scale'&&/^(Eye|PainEye)\.[LR]$/.test(name))}):[];const hidden=runtime.model.json.nodes.flatMap((n,i)=>/^HappyEye\.[LR]$/.test(n.name)?[{node:i,path:'scale',times:new Float32Array([0]),values:new Float32Array([0,0,0]),width:3}]:[]);faces.set(runtime,{smile,hidden})}return faces.get(runtime)[hurt?'hidden':'smile']}
function pose(runtime,clip,time,loop,expression,windTime,id='mohawk'){return R.pose(runtime,clip,time,loop,expression,{animation:'HairWind_'+names[id],time:windTime})}
MG.MoleAppearances={styles,palettes,random,load,prepare,paint,materialColor,vertexColors,hairStyle,face,pose,arcadeRepair,wornCostume,costumeParts,vestLift,rigidWorn,browShape,straightBrow};
})(window);
