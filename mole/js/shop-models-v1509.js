/* Shop-only 3D previews. GLB decoding/shading adapted from the user's Studio portable viewer. */
(function(root){
'use strict';
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function transform(n){if(n.matrix)return new Float32Array(n.matrix);const [x,y,z,w]=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],t=n.translation||[0,0,0];return new Float32Array([(1-2*y*y-2*z*z)*s[0],(2*x*y+2*w*z)*s[0],(2*x*z-2*w*y)*s[0],0,(2*x*y-2*w*z)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*w*x)*s[1],0,(2*x*z+2*w*y)*s[2],(2*y*z-2*w*x)*s[2],(1-2*x*x-2*y*y)*s[2],0,t[0],t[1],t[2],1]);}
function point(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
function normals(m){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],x=cross(b,c),y=cross(c,a),z=cross(a,b),d=dot(a,x)||1;return new Float32Array([...x,...y,...z].map(v=>v/d));}
function parseGLB(buffer){const v=new DataView(buffer);if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2)throw new Error('지원하지 않는 3D 파일입니다.');let json,bin;for(let p=12;p<buffer.byteLength;){const len=v.getUint32(p,true),type=v.getUint32(p+4,true);p+=8;if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,p,len)));if(type===0x004e4942)bin=new Uint8Array(buffer,p,len);p+=len;}if(!json||!bin)throw new Error('3D 메시 데이터가 없습니다.');if((json.extensionsRequired||[]).some(x=>/draco|meshopt|basisu/i.test(x)))throw new Error('압축되지 않은 GLB로 다시 저장해 주세요.');return {json,bin};}
function decodeAccessor(model,index){const a=model.json.accessors[index],view=model.json.bufferViews[a.bufferView];if(a.sparse||view.buffer&&view.buffer!==0)throw new Error('지원하지 않는 메시 저장 형식입니다.');const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},formats={5120:[1,'getInt8'],5121:[1,'getUint8'],5122:[2,'getInt16'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32']},f=formats[a.componentType],width=sizes[a.type];if(!f||!width)throw new Error('잘못된 메시 형식');const out=new Float32Array(a.count*width),data=new DataView(model.bin.buffer,model.bin.byteOffset),start=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||f[0]*width;for(let i=0;i<a.count;i++)for(let k=0;k<width;k++){let v=data[f[1]](start+i*stride+k*f[0],true);if(a.normalized){if(a.componentType===5121)v/=255;if(a.componentType===5123)v/=65535;if(a.componentType===5120)v=Math.max(v/127,-1);if(a.componentType===5122)v=Math.max(v/32767,-1);}out[i*width+k]=v;}return out;}
function instances(model){const list=[],g=model.json;function walk(index,parent){const node=g.nodes[index],world=multiply(parent,transform(node));if(node.mesh!==undefined)for(const primitive of g.meshes[node.mesh].primitives)list.push({primitive,world,name:node.name||'Mesh'});for(const c of node.children||[])walk(c,world);}for(const n of g.scenes[g.scene||0].nodes)walk(n,identity());return list;}
function bounds(model,list){const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(const item of list){const p=accessor(model,item.primitive.attributes.POSITION);for(let i=0;i<p.length;i+=3){const v=point(item.world,[p[i],p[i+1],p[i+2]]);for(let k=0;k<3;k++){low[k]=Math.min(low[k],v[k]);high[k]=Math.max(high[k],v[k]);}}}return {low,high,center:low.map((v,i)=>(v+high[i])/2),radius:Math.hypot(...high.map((v,i)=>(v-low[i])/2))};}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o;}
function lookAt(eye,target){const z=unit(eye.map((v,i)=>v-target[i])),x=unit(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}

const accessorCaches=new WeakMap();function accessor(model,index){let cache=accessorCaches.get(model);if(!cache){cache=new Map();accessorCaches.set(model,cache);}if(!cache.has(index))cache.set(index,decodeAccessor(model,index));return cache.get(index);}

const paths={hammer:'hammer-v5-batched-v1509.glb',cannon:'cannon-v1-batched-v1509.glb',goldhammer:'goldhammer-v16-batched-v1509.glb'};
const assets=new Map(),views=new Set(),dormant=new Map(),waiting=new Map();let frameId=0,lastTick=0,lastAction=-Infinity,activeScreen=null,initQueue=Promise.resolve();
function reserveInit(){let unlock;const previous=initQueue;initQueue=new Promise(resolve=>{unlock=resolve;});return previous.then(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(unlock))));}
function load(id){if(!assets.has(id))assets.set(id,fetch('assets/shop-models-v1509/'+paths[id]).then(r=>{if(!r.ok)throw Error('Model '+r.status);return r.arrayBuffer();}).then(parseGLB).catch(e=>{assets.delete(id);throw e;}));return assets.get(id);}
function translation(x,y,z){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;}
function rotate(axis,angle){const [x,y,z]=unit(axis),c=Math.cos(angle),s=Math.sin(angle),t=1-c;return new Float32Array([t*x*x+c,t*x*y+s*z,t*x*z-s*y,0,t*x*y-s*z,t*y*y+c,t*y*z+s*x,0,t*x*z+s*y,t*y*z-s*x,t*z*z+c,0,0,0,0,1]);}
function scaleMatrix(x,y,z){const m=identity();m[0]=x;m[5]=y;m[10]=z;return m;}
function projectPoint(m,p){const q=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return {x:((m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/q+1)/2,y:(1-(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/q)/2};}
function orthographic(half,aspect,near,far){const m=identity();m[0]=1/(half*aspect);m[5]=1/half;m[10]=-2/(far-near);m[14]=-(far+near)/(far-near);return m;}
// Same idle cadence as lane-hammer.js: 2.5s wait, two hops in 0.5s, every 3.2s.
const HAMMER_IDLE={delay:2500,cycle:3200,duration:500};
const INVENTORY_CANNON={wait:600,recoil:200,turn:300};
function inventoryCannonPose(elapsed){const {wait,recoil,turn}=INVENTORY_CANNON,step=wait*2+recoil+turn,half=Math.floor(elapsed/step),age=elapsed-half*step,k=Math.max(0,Math.min(1,(age-wait*2-recoil)/turn));return {yaw:(half+k*k*(3-2*k))*Math.PI,step,first:wait};}
function strikeLightning(gl){
 const vs=gl.createShader(gl.VERTEX_SHADER);gl.shaderSource(vs,'attribute vec3 aPosition;void main(){gl_Position=vec4(aPosition,1.0);}');gl.compileShader(vs);
 const fs=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(fs,'precision highp float;uniform vec4 uColor;void main(){gl_FragColor=uColor;}');gl.compileShader(fs);
 const fx=gl.createProgram();gl.attachShader(fx,vs);gl.attachShader(fx,fs);gl.linkProgram(fx);
 if(!gl.getProgramParameter(fx,gl.LINK_STATUS))throw Error('Lightning shader');
 const at=gl.getAttribLocation(fx,'aPosition'),color=gl.getUniformLocation(fx,'uColor'),buffer=gl.createBuffer();
 function project(m,p){const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w];}
 return function(m,box,seed,w,h,dpr,main){
  const c=box.center,r=box.high.map((v,i)=>(v-box.low[i])*.52),paths=[];
  const random=n=>{const v=Math.sin(n*12.9898+seed*17.19)*43758.5453;return(v-Math.floor(v))-.5;};
  for(let side=0;side<4;side++){const path=[];for(let i=0;i<8;i++){const t=i/7,j=random(i+side*11);let p;
   if(side<2)p=[c[0]+r[0]*(-.85+1.7*t),c[1]+r[1]*((side?-.62:.72)+j*.25),c[2]+r[2]*(side?-1.02:1.02)];
   else p=[c[0]+r[0]*(side===2?-1.02:1.02),c[1]+r[1]*(.8-1.6*t),c[2]+r[2]*(j*.6)];
   path.push(project(m,p));}paths.push(path);}
  function ribbon(thickness){const verts=[];for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=(b[0]-a[0])*w,dy=(b[1]-a[1])*h,len=Math.hypot(dx,dy)||1,ox=-dy/len*thickness/w,oy=dx/len*thickness/h;const p=[a[0]+ox,a[1]+oy,a[2]],q=[a[0]-ox,a[1]-oy,a[2]],r=[b[0]+ox,b[1]+oy,b[2]],s=[b[0]-ox,b[1]-oy,b[2]];verts.push(...p,...q,...r,...r,...q,...s);}return new Float32Array(verts);}
  gl.useProgram(fx);gl.disable(gl.CULL_FACE);gl.depthMask(false);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,3,gl.FLOAT,false,0,0);
  for(const [width,rgba] of [[1.65*dpr,[.08,.56,1,.94]],[.55*dpr,[.88,.98,1,.98]]]){const positions=ribbon(width);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW);gl.uniform4fv(color,rgba);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);}
  gl.depthMask(true);gl.useProgram(main);
 };
}
function drawable(v){const screen=v.host.closest('#shop-screen,#inventory-screen,#workshop-screen,#game-screen');return v.host.isConnected&&v.inView&&!document.hidden&&screen&&!screen.hidden&&(!activeScreen||screen.id===activeScreen)&&v.host.classList.contains('shop-model-ready');}
function tick(time){frameId=0;lastTick=time;for(const v of [...views]){if(!v.host.isConnected){v.dispose();continue;}if(!v.animated||!drawable(v)){v.lastSeen=time;continue;}if(time-v.lastFrame<1000/24)continue;v.elapsed+=Math.max(0,time-v.lastSeen);v.lastSeen=time;v.lastFrame=time;v.draw(time);}if([...views].some(v=>v.animated&&drawable(v)))frameId=requestAnimationFrame(tick);else lastTick=0;}
document.addEventListener('visibilitychange',()=>{const now=performance.now();for(const v of views)v.lastSeen=now;if(!document.hidden)start();});
function start(){if(!frameId&&[...views].some(v=>v.animated&&drawable(v)))frameId=requestAnimationFrame(tick);}
function measureCanvas(view,canvas){if(view.options.motion==='inventory'){const rect=canvas.getBoundingClientRect();if(rect.width>0&&rect.height>0){view.width=rect.width;view.height=rect.height;}view.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);return;}let factor=1;if(!view.options.external)for(let node=canvas.parentElement;node&&node!==document.body;node=node.parentElement){const value=getComputedStyle(node).transform;if(value&&value!=='none'){const m=new DOMMatrixReadOnly(value);factor*=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));}}view.width=canvas.clientWidth*factor;view.height=canvas.clientHeight*factor;}
root.addEventListener('resize',()=>{requestAnimationFrame(()=>{for(const v of views)v.resize?.();});});
async function create(host,id,index,options={}){
 const canvas=document.createElement('canvas');canvas.className='shop-model-canvas';canvas.setAttribute('aria-label',id==='hammer'?'뿅망치 3D':id==='cannon'?'팡팡 캐논 3D':'골드 묠니르 3D');
 host.appendChild(canvas);let gl=null,disposed=false,observer=null,visibility=null,releaseInit=null;
 const view={host,id,index,options,pose:{yaw:0,pitch:25,kick:0},inView:!('IntersectionObserver' in root),elapsed:0,lastSeen:performance.now(),lastFrame:0,width:0,height:0,draw(){},setPose(pose){Object.assign(this.pose,pose);this.draw(performance.now());},dispose(){if(disposed)return;disposed=true;views.delete(view);if(observer)observer.disconnect();if(visibility)visibility.disconnect();host.classList.remove('shop-model-ready');canvas.remove();gl?.getExtension('WEBGL_lose_context')?.loseContext();}};
 views.add(view);
 try{
  const model=await load(id);if(disposed||!host.isConnected){view.dispose();return;}
  releaseInit=await reserveInit();if(disposed||!host.isConnected){view.dispose();return;}
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');
  const list=model._previewInstances||(model._previewInstances=instances(model)),box=model._previewBounds||(model._previewBounds=bounds(model,list)),radius=box.radius||1;
  const vertex='attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uModel;uniform mat4 uVP;uniform mat3 uNormal;varying vec3 vPosition;varying vec3 vNormal;varying vec2 vUV;void main(){vec4 p=uModel*vec4(aPosition,1.0);vPosition=p.xyz;vNormal=normalize(uNormal*aNormal);vUV=aUV;gl_Position=uVP*p;}';
  const fragment='precision highp float;varying vec3 vPosition;varying vec3 vNormal;varying vec2 vUV;uniform vec4 uColor;uniform sampler2D uTexture;uniform bool uTextured;uniform float uRoughness;uniform float uCutoff;uniform vec3 uEye;uniform vec3 uEmission;void main(){vec4 t=uTextured?texture2D(uTexture,vUV):vec4(1.0);float alpha=t.a*uColor.a;if(alpha<uCutoff)discard;vec3 base=uColor.rgb*(uTextured?pow(t.rgb,vec3(2.2)):vec3(1.0));vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-0.4,0.85,0.8)),fill=normalize(vec3(0.8,0.3,-0.5)),v=normalize(uEye-vPosition),h=normalize(l+v);float diffuse=max(dot(n,l),0.0),d2=max(dot(n,fill),0.0),spec=pow(max(dot(n,h),0.0),mix(8.0,64.0,1.0-max(uRoughness,0.35)))*0.48;vec3 c=base*(0.62+0.65*diffuse+0.25*d2)+vec3(spec)+uEmission;gl_FragColor=vec4(pow(max(c,vec3(0.0)),vec3(1.0/2.2)),alpha);}';
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('3D 그래픽 초기화 실패');gl.useProgram(program);
  const loc={};for(const n of ['uModel','uVP','uNormal','uColor','uTexture','uTextured','uRoughness','uCutoff','uEye','uEmission'])loc[n]=gl.getUniformLocation(program,n);
  const attr={};for(const n of ['aPosition','aNormal','aUV'])attr[n]=gl.getAttribLocation(program,n);
  const uint32=gl.getExtension('OES_element_index_uint');
  const uploadedBuffers=new WeakMap();function buffer(values,target=gl.ARRAY_BUFFER){let cache=uploadedBuffers.get(values);if(!cache){cache=new Map();uploadedBuffers.set(values,cache);}if(cache.has(target))return cache.get(target);const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,values,gl.STATIC_DRAW);cache.set(target,b);return b;}
  const textures=new Map();
  async function texture(index){if(textures.has(index))return textures.get(index);const request=(async()=>{const image=model.json.images[model.json.textures[index].source];let blob;if(image.bufferView!==undefined){const v=model.json.bufferViews[image.bufferView];blob=new Blob([model.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)],{type:image.mimeType||'image/png'});}else if(image.uri&&image.uri.startsWith('data:')){const pair=image.uri.split(',');blob=new Blob([Uint8Array.from(atob(pair[1]),c=>c.charCodeAt(0))],{type:pair[0].slice(5).split(';')[0]});}else throw new Error('이 3D 파일의 텍스처가 내장되어 있지 않습니다.');const url=URL.createObjectURL(blob),img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);URL.revokeObjectURL(url);return tex;})();textures.set(index,request);return request;}
  const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const draws=[];
  for(const item of list){const p=item.primitive,g=model.json,position=accessor(model,p.attributes.POSITION),count=position.length/3,normal=p.attributes.NORMAL===undefined?new Float32Array(count*3):accessor(model,p.attributes.NORMAL),uv=p.attributes.TEXCOORD_0===undefined?new Float32Array(count*2):accessor(model,p.attributes.TEXCOORD_0);if(p.attributes.NORMAL===undefined)for(let i=0;i<count;i++)normal[i*3+1]=1;
   const mat=g.materials?.[p.material]||{},pbr=mat.pbrMetallicRoughness||{},color=pbr.baseColorFactor||[1,1,1,1];let indices=null,indexType=gl.UNSIGNED_SHORT,indexCount=0;
   if(p.indices!==undefined){const data=accessor(model,p.indices);let max=0;for(const v of data)max=Math.max(max,v);if(max>65535&&!uint32)throw new Error('이 브라우저는 큰 메시를 표시하지 못합니다.');const typed=max>65535?new Uint32Array(data):new Uint16Array(data);indexType=max>65535?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;indexCount=typed.length;indices=buffer(typed,gl.ELEMENT_ARRAY_BUFFER);}
   draws.push({name:item.name,world:item.world,slotGlow:item.name==='Right recessed bright yellow glowing capsule floor',normalMatrix:normals(item.world),positions:buffer(position),normals:buffer(normal),uv:buffer(uv),count,indices,indexType,indexCount,mode:p.mode??4,color,emission:(mat.emissiveFactor||[0,0,0]).map(v=>v*(mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1)),roughness:pbr.roughnessFactor??.5,double:mat.doubleSided,alpha:mat.alphaMode||'OPAQUE',cutoff:mat.alphaMode==='MASK'?(mat.alphaCutoff??.5):0,texture:pbr.baseColorTexture?await texture(pbr.baseColorTexture.index):white,textured:!!pbr.baseColorTexture});
  }

  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1i(loc.uTexture,0);
  function bind(b,id,size){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,size,gl.FLOAT,false,0,0);}

  // Keep the exact geometry/shader; cache vertex bindings on browsers that support VAOs.
  const vao=gl.getExtension('OES_vertex_array_object');
  if(vao){for(const d of draws){d.vao=vao.createVertexArrayOES();vao.bindVertexArrayOES(d.vao);bind(d.positions,attr.aPosition,3);bind(d.normals,attr.aNormal,3);bind(d.uv,attr.aUV,2);if(d.indices)gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.indices);}vao.bindVertexArrayOES(null);}
  if(disposed||!host.isConnected){view.dispose();return;}
  const height=box.high[1]-box.low[1],pivot=[box.center[0],box.low[1]+height*.08,box.center[2]];
  // Reference video: keep the axle/chassis center fixed, not the asymmetric muzzle bounds.
  const carriage=id==='cannon'?(model._carriageBounds||(model._carriageBounds=bounds(model,list.filter(d=>d.name==='Blue rectangular chassis')))):null;
  const turnCenter=carriage?[carriage.center[0],box.center[1],carriage.center[2]]:box.center;
  let barrelPivot=null,muzzleBase=null;const barrelNames=new Set();
  if(id==='cannon'&&options.external){
   function walk(index,parent,barrel){const node=model.json.nodes[index],world=multiply(parent,transform(node)),inside=barrel||node.name==='BarrelPitchPivot';if(node.name==='BarrelPitchPivot'){barrelPivot=[world[12],world[13],world[14]];muzzleBase=point(world,[0,1.34,0]);}if(inside)barrelNames.add(node.name);for(const c of node.children||[])walk(c,world,inside);}
   for(const n of model.json.scenes[model.json.scene||0].nodes)walk(n,identity(),false);
   view.solveTarget=function(u,v){const c=view.camera;if(!c)return null;const origin=c.eye.map((n,i)=>n+c.right[i]*(u*2-1)*c.half*c.aspect+c.up[i]*(1-v*2)*c.half),t=-origin[1]/c.forward[1],target=origin.map((n,i)=>n+c.forward[i]*t),delta=target.map((n,i)=>n-barrelPivot[i]);return {bodyYaw:Math.atan2(delta[0],delta[2]),pitch:Math.atan2(delta[1],Math.hypot(delta[0],delta[2]))*180/Math.PI};};
  }
  const headBox=id==='goldhammer'?(model._headBounds||(model._headBounds=bounds(model,list.filter(d=>!/handle|grip|neck|pommel/i.test(d.name))))):null;
  const lightning=id==='goldhammer'?strikeLightning(gl):null;
  // Reuse the model's five raised front paw pieces; never redraw or alter the GLB.
  const pawParts=id==='goldhammer'?list.filter(d=>/^Front raised (central paw pad|toe [1-4])$/.test(d.name)):[];
  const pawBox=pawParts.length?bounds(model,pawParts):null;
  const pawDraws=pawBox?draws.filter(d=>/^Front raised (central paw pad|toe [1-4])$/.test(d.name)):[];
  const pawNormal=pawBox?unit([pawBox.center[0]-headBox.center[0],0,pawBox.center[2]-headBox.center[2]]):null;
  if(pawBox)host.dataset.modelPawParts=String(pawDraws.length);
  let nextAction=8000+index*1900+Math.random()*2200,actionStart=-Infinity,actionDirection=0,shots=0,lastQuarter=-1,lastGoldQuarter=-1;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  view.animated=!reduced&&!options.external;
  view.resize=function(){if(!disposed){measureCanvas(view,canvas);if(!options.external&&drawable(view))view.draw(performance.now());}};
  view.draw=function(time){
   if(disposed)return;
   const dpr=Math.min(Math.max(devicePixelRatio||1,2),2.5),cap=options.maxPixels||512;
   const inventory=options.motion==='inventory',pixelScale=inventory?Math.min(dpr,cap/Math.max(1,view.width,view.height)):dpr;
   const w=Math.max(1,Math.min(cap,Math.round(view.width*pixelScale))),h=Math.max(1,Math.min(cap,Math.round(view.height*pixelScale)));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   const elapsed=view.elapsed;
   const automatic=!options.manual&&!options.external;
   if(!reduced&&automatic&&id==='cannon'){
    const cadence=inventory?inventoryCannonPose(elapsed):null,step=cadence?cadence.step:5000,first=cadence?cadence.first:0,quarter=Math.floor((elapsed-first)/step);
    if(quarter>=0&&quarter>lastQuarter){lastQuarter=quarter;actionStart=first+quarter*step;lastAction=time;shots++;host.dataset.modelActions=String(shots);host.dataset.modelCardinal=String(inventory?(quarter*180)%360:(90+quarter*90)%360);}
   }else if(!reduced&&automatic&&id==='goldhammer'){
    const first=inventory?(Math.PI*2-.7)/(Math.PI*2)*20000:2500,step=inventory?20000:5000,quarter=Math.floor((elapsed-first)/step);
    if(quarter>=0&&quarter>lastGoldQuarter){lastGoldQuarter=quarter;actionStart=first+quarter*step;lastAction=time;shots++;host.dataset.modelActions=String(shots);host.dataset.modelCardinal=String(inventory?0:(45+quarter*90)%360);}
   }
   const duration=id==='cannon'?200:id==='goldhammer'?300:1100,progress=(elapsed-actionStart)/duration;
   const amount=options.external?view.pose.kick:progress>=0&&progress<1?(id!=='hammer'?(progress<.2?progress/.2:Math.pow((1-progress)/.8,2)):Math.sin(Math.PI*progress)):0;
   // Cannon reference: level side -> rear -> opposite side -> muzzle, one turn in 20s.
   let phase=reduced?0:elapsed*Math.PI*2/20000;
   if(id==='cannon'&&!reduced&&automatic){
    const quarter=Math.floor(elapsed/5000),age=elapsed-quarter*5000;
    // Hold the exact cardinal through the 200ms recoil, then traverse the next quadrant.
    phase=(quarter+Math.max(0,age-200)/4800)*Math.PI/2;
   }
   let yaw=(id==='cannon'?Math.PI/2:.7)+phase,pitch=id==='cannon'?0:.22;
   if(inventory&&id==='cannon')yaw=inventoryCannonPose(elapsed).yaw;
   if(options.manual||options.external){yaw=view.pose.yaw;pitch=view.pose.cameraPitch??(options.external?0:.1);}
   let motion=identity();
   if(id==='cannon')motion=options.external?multiply(rotate([0,1,0],view.pose.bodyYaw||0),translation(0,0,-radius*.23*amount)):translation(0,0,-radius*.23*amount);
   else if(id==='goldhammer'&&amount)motion=multiply(multiply(translation(...pivot),rotate([1,0,0],amount*.36)),translation(...pivot.map(v=>-v))); // Front (+Z) face has no rubies.
   else if(amount)motion=multiply(multiply(translation(...pivot),rotate([Math.cos(actionDirection),0,Math.sin(actionDirection)],amount*.24)),translation(...pivot.map(v=>-v)));
   if(id==='hammer'&&!options.manual&&!options.external){
    const idleAge=elapsed-(Number.isFinite(actionStart)?actionStart+duration:0),cycle=(idleAge-HAMMER_IDLE.delay)%HAMMER_IDLE.cycle;
    const k=!reduced&&!amount&&idleAge>HAMMER_IDLE.delay&&cycle<HAMMER_IDLE.duration?cycle/HAMMER_IDLE.duration:0;
    const hop=Math.abs(Math.sin(k*Math.PI*2))*.018,roll=Math.PI/12+Math.sin(k*Math.PI*2)*4*Math.PI/180;
    const axis=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
    const tilt=multiply(multiply(translation(...box.center),rotate(axis,-roll)),translation(...box.center.map(v=>-v)));
    const squash=multiply(multiply(translation(...pivot),scaleMatrix(1+hop*1.5,1-hop*3,1)),translation(...pivot.map(v=>-v)));
    motion=multiply(translation(0,height*hop*3.4,0),multiply(tilt,multiply(squash,motion)));
    host.dataset.modelRoll=String(roll);host.dataset.modelHop=String(hop);
    host.style.setProperty('--shop-shadow-scale',String(1-hop*8));host.style.setProperty('--shop-shadow-opacity',String(.32-hop*5));
   }
   if(inventory&&id==='goldhammer'){const axis=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];motion=multiply(multiply(multiply(translation(...box.center),rotate(axis,-Math.PI/12)),translation(...box.center.map(v=>-v))),motion);}
   if(options.roll){const axis=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];motion=multiply(multiply(multiply(translation(...box.center),rotate(axis,-options.roll*Math.PI/180)),translation(...box.center.map(v=>-v))),motion);}
   let barrelMotion=null;
   if(barrelPivot){const angle=(25-view.pose.pitch)*Math.PI/180;barrelMotion=multiply(motion,multiply(multiply(translation(...barrelPivot),rotate([1,0,0],angle)),translation(...barrelPivot.map(v=>-v))));}
   if(id!=='hammer'){host.style.setProperty('--shop-shadow-scale',String(1+amount*.06));host.style.setProperty('--shop-shadow-opacity',String(.32+amount*.08));}
   const aspect=inventory?(view.aspect||120/110):w/h,fov=Math.PI/5,limit=2*Math.atan(Math.tan(fov/2)*Math.min(1,aspect));
   const distance=radius/Math.sin(limit/2)*.9,target=turnCenter,eye=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
   const vp=multiply(options.external?orthographic(radius*.8,aspect,Math.max(radius*.1,distance-radius*2),distance+radius*2):perspective(fov,aspect,Math.max(radius*.1,distance-radius*2),distance+radius*2),lookAt(eye,target));
   if(options.external){const forward=unit(target.map((n,i)=>n-eye[i])),right=unit(cross(forward,[0,1,0])),up=cross(right,forward);view.camera={eye,forward,right,up,half:radius*.8,aspect};}
   gl.uniformMatrix4fv(loc.uVP,false,vp);gl.uniform3fv(loc.uEye,eye);
   const slotLight=.8+.2*Math.sin(elapsed*Math.PI*2/1800);
   const pawAge=elapsed-actionStart-60,pawTime=pawAge/480;
   const pawActive=!!pawBox&&!reduced&&pawTime>=0&&pawTime<1;
   const pawFlash=pawActive&&pawAge<150;
   function drawPart(d,world,color,emission,normal){if(d.double)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);gl.uniformMatrix4fv(loc.uModel,false,world);gl.uniformMatrix3fv(loc.uNormal,false,normal||normals(world));gl.uniform4fv(loc.uColor,color);gl.uniform3fv(loc.uEmission,emission);gl.uniform1f(loc.uRoughness,d.roughness);gl.uniform1f(loc.uCutoff,d.cutoff);gl.uniform1i(loc.uTextured,d.textured);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,d.texture);if(vao)vao.bindVertexArrayOES(d.vao);else{bind(d.positions,attr.aPosition,3);bind(d.normals,attr.aNormal,3);bind(d.uv,attr.aUV,2);if(d.indices)gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.indices);}if(d.indices)gl.drawElements(d.mode,d.indexCount,d.indexType,0);else gl.drawArrays(d.mode,0,d.count);}
   const staticPose=id==='goldhammer'&&!inventory&&!options.roll&&!amount,staticNormals=staticPose||id==='cannon'&&!options.roll&&!options.external;
   for(const d of draws){const red=pawFlash&&pawDraws.includes(d),barrel=barrelMotion&&barrelNames.has(d.name);drawPart(d,staticPose?d.world:multiply(barrel?barrelMotion:motion,d.world),red?[.9,.008,.015,1]:d.color,red?[.42,.005,.008]:id==='goldhammer'&&d.slotGlow?[.8*slotLight,.5*slotLight,.015]:d.emission,staticNormals&&!barrel?d.normalMatrix:null);}
   if(muzzleBase){const matrix=multiply(vp,barrelMotion),end=muzzleBase.map((n,i)=>n+(n-barrelPivot[i])*.2),tip=projectPoint(matrix,end);view.muzzle=projectPoint(matrix,muzzleBase);view.breech=projectPoint(vp,barrelPivot);view.projectedAim=Math.atan2(tip.y-view.muzzle.y,tip.x-view.muzzle.x)*180/Math.PI;}
   if(pawActive){
    const ease=1-Math.pow(1-pawTime,3),size=1+ease*.85,travel=radius*(.018+ease*.28);
    const c=pawBox.center,offset=pawNormal.map(v=>v*travel);
    const burst=multiply(motion,multiply(translation(...c.map((v,i)=>v+offset[i])),multiply(scaleMatrix(size,size,size),translation(...c.map(v=>-v)))));
    gl.depthMask(false);
    for(const d of pawDraws)drawPart(d,multiply(burst,d.world),[.95,.008,.018,Math.pow(1-pawTime,1.5)*.9],[.38,.006,.009]);
    gl.depthMask(true);
   }
   if(vao)vao.bindVertexArrayOES(null);
   host.dataset.modelPaw=String(pawActive);host.dataset.modelPawScale=String(pawActive?1+(1-Math.pow(1-pawTime,3))*.85:1);
   host.dataset.modelYaw=String(yaw);host.dataset.modelPitch=String(pitch);host.dataset.modelTurnCenter=JSON.stringify(turnCenter);host.dataset.modelFrame=String((+host.dataset.modelFrame||0)+1);
   const effect=!!lightning&&(view.pose.zap||progress>=.12&&progress<.9);
   if(effect)lightning(multiply(vp,motion),headBox,Math.floor(progress*12)+shots*17,w,h,dpr,program);
   host.dataset.modelFx=String(effect);
   if(inventory&&options.onFrame){const matrix=multiply(vp,motion),points=[];for(const x of [box.low[0],box.high[0]])for(const y of [box.low[1],box.high[1]])for(const z of [box.low[2],box.high[2]])points.push(projectPoint(matrix,[x,y,z]));options.onFrame({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),hop:+host.dataset.modelHop||0,recoil:amount});}
  };
  host.classList.add('shop-model-ready');host.dataset.model=id;view.elapsed=0;view.lastSeen=performance.now();measureCanvas(view,canvas);view.draw(view.lastSeen);
  observer=new ResizeObserver(()=>{if(!disposed)view.resize();});observer.observe(host);
  if('IntersectionObserver' in root){visibility=new IntersectionObserver(entries=>{if(disposed)return;view.inView=entries.some(e=>e.isIntersecting&&e.intersectionRatio>0);view.lastSeen=performance.now();if(view.inView){view.resize();if(!reduced)start();}},{threshold:0});visibility.observe(host);}
  if(!reduced)start();
  return view;
 }catch(error){view.dispose();host.dataset.modelError=error.message;}finally{if(releaseInit)releaseInit();}
}
function createVisible(host,id,options){if(options.motion!=='inventory'||!('IntersectionObserver' in root))return create(host,id,0,options);return new Promise(resolve=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>0)){observer.disconnect();waiting.delete(host);if(host.isConnected)create(host,id,0,options).then(resolve);else resolve();}},{threshold:0});waiting.set(host,{observer,resolve});observer.observe(host);});}
function snapshot(preview){for(const v of views){const target=preview.querySelector('.shop-model-ready[data-model="'+v.host.dataset.model+'"] canvas');if(!target||!v.host.classList.contains('shop-model-ready'))continue;try{v.draw(performance.now());const img=document.createElement('img');img.className='shop-model-canvas shop-model-snapshot';img.alt='';img.src=v.host.querySelector('canvas').toDataURL('image/png');target.replaceWith(img);}catch(error){target.remove();preview.querySelector('[data-model="'+v.host.dataset.model+'"]')?.classList.remove('shop-model-ready');}}}
function clear(){for(const v of [...views])if(v.host.closest('#shop-screen'))v.dispose();for(const host of dormant.keys())if(host.closest('#shop-screen'))dormant.delete(host);if(!views.size){if(frameId)cancelAnimationFrame(frameId);frameId=0;lastTick=0;}}
function activateScreen(id){activeScreen=id;const now=performance.now();for(const v of [...views]){v.lastSeen=now;const screen=v.host.closest('#shop-screen,#inventory-screen,#workshop-screen,#game-screen');if(screen&&screen.id!==id&&!v.options.external&&!v.options.manual){dormant.set(v.host,{id:v.id,index:v.index,options:v.options,elapsed:v.elapsed});v.dispose();}}for(const [host,record] of [...dormant]){if(!host.isConnected){dormant.delete(host);continue;}if(host.closest('#shop-screen,#inventory-screen,#workshop-screen,#game-screen')?.id===id){dormant.delete(host);create(host,record.id,record.index,record.options).then(view=>{if(view){view.elapsed=record.elapsed;view.draw(performance.now());}});}}if(frameId){cancelAnimationFrame(frameId);frameId=0;}start();}
function attach(cards,weapons){clear();const cardsList=cards.querySelectorAll('.shop-card--weapon-product');cardsList.forEach((card,index)=>{const id=weapons[index]?.id;if(!paths[id])return;const host=card.querySelector('.shop-card-img-box,.shop-card-badge--default-weapon');if(host)create(host,id,index);});}
root.MoleGame=root.MoleGame||{};root.MoleGame.ShopModels={attach,clear,snapshot};
root.MoleGame.WeaponModels={create:(host,id,options={})=>createVisible(host,id,options),refreshWithin:host=>{for(const v of views)if(host.contains(v.host)&&v.options.motion==='inventory'){const wasVisible=v.inView,rect=v.host.getBoundingClientRect(),clip=v.host.closest('.iw-pages,.ks-case')?.getBoundingClientRect();if(clip)v.inView=rect.right>clip.left&&rect.left<clip.right&&rect.bottom>clip.top&&rect.top<clip.bottom;if(v.inView!==wasVisible)v.lastSeen=performance.now();v.resize?.();}start();},setActiveScreen:activateScreen,stats:()=>[...views].map(v=>({screen:v.host.closest('#shop-screen,#inventory-screen,#workshop-screen,#game-screen')?.id,animated:v.animated,drawable:!!drawable(v),frames:+v.host.dataset.modelFrame||0})),clearWithin:host=>{for(const v of [...views])if(host.contains(v.host))v.dispose();for(const element of dormant.keys())if(host.contains(element))dormant.delete(element);for(const [element,record] of waiting)if(host.contains(element)){record.observer.disconnect();record.resolve();waiting.delete(element);}}};
new MutationObserver(()=>{for(const v of [...views])if(!v.host.isConnected)v.dispose();for(const host of dormant.keys())if(!host.isConnected)dormant.delete(host);for(const [host,record] of waiting)if(!host.isConnected){record.observer.disconnect();record.resolve();waiting.delete(host);}}).observe(document.body,{childList:true,subtree:true});
})(window);
