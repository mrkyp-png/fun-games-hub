/* Rebuild only the existing three-ring fur strands. All other meshes/rigs/clips remain byte-identical. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),R=require('../mole/js/clay-rig-runtime.js');
const folder='mole/assets/characters-v1692';fs.mkdirSync(folder,{recursive:true});const reports=[];
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),mix=(a,b,t)=>add(mul(a,1-t),mul(b,t)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.max(1e-12,Math.hypot(...a)));
function save(m,file){let j=Buffer.from(JSON.stringify(m.json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);let b=Buffer.from(m.bin);b=Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]);const o=Buffer.alloc(28+j.length+b.length);o.writeUInt32LE(0x46546c67,0);o.writeUInt32LE(2,4);o.writeUInt32LE(o.length,8);o.writeUInt32LE(j.length,12);o.writeUInt32LE(0x4e4f534a,16);j.copy(o,20);o.writeUInt32LE(b.length,20+j.length);o.writeUInt32LE(0x004e4942,24+j.length);b.copy(o,28+j.length);fs.writeFileSync(file,o);}
for(const file of ['home3d/mole-clay-v47-smile.glb','home3d/mole-rhythm-dance-v2.glb','characters-v1689/mole-game-smile.glb']){
 const input=fs.readFileSync('mole/assets/'+file),m=R.parseGLB(input.buffer.slice(input.byteOffset,input.byteOffset+input.length)),chunks=[Buffer.from(m.bin)];let offset=m.bin.length,strands=0,oldTriangles=0,newTriangles=0;
 function append(values,type,componentType=5126){const data=componentType===5125?new Uint32Array(values):componentType===5123?new Uint16Array(values):new Float32Array(values),padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}const view=m.json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.byteLength})-1;chunks.push(Buffer.from(data.buffer));offset+=data.byteLength;const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type],a={bufferView:view,componentType,count:values.length/width,type};if(type==='VEC3'){a.min=[0,1,2].map(k=>{let min=Infinity;for(let i=k;i<values.length;i+=3)min=Math.min(min,values[i]);return min});a.max=[0,1,2].map(k=>{let max=-Infinity;for(let i=k;i<values.length;i+=3)max=Math.max(max,values[i]);return max});}return m.json.accessors.push(a)-1;}
 for(const mesh of m.json.meshes)for(const p of mesh.primitives){if(!/armpit/i.test(m.json.materials[p.material].name))continue;
  const old=Object.fromEntries(Object.entries(p.attributes).map(([k,a])=>[k,{values:R.accessor(m,a),width:{VEC2:2,VEC3:3,VEC4:4}[m.json.accessors[a].type],type:m.json.accessors[a].type}])),n=old.POSITION.values.length/3;assert.equal(n%21,0);oldTriangles+=m.json.accessors[p.indices].count/3;
  const attributes=Object.fromEntries(Object.keys(old).map(k=>[k,[]])),indices=[],positions=attributes.POSITION,normals=attributes.NORMAL,SIDES=10,RINGS=8;
  for(let start=0;start<n;start+=21){strands++;const v=i=>Array.from(old.POSITION.values.slice((start+i)*3,(start+i+1)*3)),centres=[0,7,14].map(r=>mul([0,2,3,4,5,6].reduce((a,i)=>add(a,v(r+i)),[0,0,0]),1/6)),us=[0,7,14].map((r,i)=>sub(v(r),centres[i])),vs=[0,7,14].map((r,i)=>mul(sub(sub(v(r+2),centres[i]),mul(us[i],.5)),1/Math.sin(Math.PI/3))),base=positions.length/3;
   function centre(t){const control=sub(mul(centres[1],2),mul(add(centres[0],centres[2]),.5));return add(centres[0],mul(sub(add(add(mul(centres[0],(1-t)**2),mul(control,2*t*(1-t))),mul(centres[2],t*t)),centres[0]),1.10));}
   function vertex(point,sourceIndex){positions.push(...point);normals.push(0,0,0);for(const [k,a]of Object.entries(old))if(!['POSITION','NORMAL'].includes(k))attributes[k].push(...a.values.slice((start+sourceIndex)*a.width,(start+sourceIndex+1)*a.width));}
   for(let ring=0;ring<RINGS;ring++){const t=ring/RINGS,segment=t<.5?0:1,f=t*2-segment,u=mix(us[segment],us[segment+1],f),v0=mix(vs[segment],vs[segment+1],f),c=centre(t),taper=1-t*t;
    for(let j=0;j<SIDES;j++){const a=j*Math.PI*2/SIDES;vertex(add(c,mul(add(mul(u,Math.cos(a)),mul(v0,Math.sin(a))),taper)),Math.round(t*2)*7);}
   }
   const tip=positions.length/3;vertex(centre(1),14);
   for(let ring=0;ring<RINGS-1;ring++)for(let j=0;j<SIDES;j++){const a=base+ring*SIDES+j,b=base+ring*SIDES+(j+1)%SIDES,c=a+SIDES,d=b+SIDES;indices.push(a,d,c,a,b,d);}
   for(let j=0;j<SIDES;j++)indices.push(base+(RINGS-1)*SIDES+j,base+(RINGS-1)*SIDES+(j+1)%SIDES,tip);
  }
  // Smooth area-weighted normals shared around each tapered tube (no faceted six-sided outline).
  for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),q=ids.map(v=>positions.slice(v*3,v*3+3)),normal=cross(sub(q[1],q[0]),sub(q[2],q[0]));for(const id of ids)for(let k=0;k<3;k++)normals[id*3+k]+=normal[k];}
  for(let i=0;i<normals.length;i+=3)normals.splice(i,3,...unit(normals.slice(i,i+3)));
  for(const [k,a]of Object.entries(old))p.attributes[k]=append(attributes[k],a.type,k==='JOINTS_0'?5123:5126);p.indices=append(indices,'SCALAR',5125);newTriangles+=indices.length/3;
 }
 m.bin=new Uint8Array(Buffer.concat(chunks));m.json.buffers[0].byteLength=m.bin.length;const out=folder+'/'+path.basename(file);save(m,out);reports.push({source:'mole/assets/'+file,output:out,strands,lengthFactor:1.10,oldTriangles,newTriangles,rigAndAnimationsUnchanged:true});
}
fs.writeFileSync('review/smooth-armpit-v1692.json',JSON.stringify(reports,null,2)+'\n');console.log(reports);
