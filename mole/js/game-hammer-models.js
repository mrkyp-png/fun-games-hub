/* Gold Mjolnir3D replacement inside original sprite boxes. Legacy code owns every movement. */
(function(root){'use strict';
 const R=root.StudioRig,MG=root.MoleGame,assets=new Map();let shared=null,nextId=0;
 const VIEW=R.transform({rotation:[0,Math.sin(-5*Math.PI/12),0,Math.cos(-5*Math.PI/12)]});
 // Fit a rigid model inside the original sprite box, then inherit the box's existing CSS transform.
 // No target selection, flight path, swing angles, timing or return motion is calculated here.
 function frameMatrix(viewBounds,width,height,rect,cssTransform,rootRect,rootWidth,rootHeight,reference){
  const values=(cssTransform||'none').match(/matrix(3d)?\(([^)]+)\)/);let a=1,b=0,c=0,d=1;
  if(values){const v=values[2].split(',').map(Number);a=v[0];b=v[1];c=v[values[1]?4:2];d=v[values[1]?5:3];}
  const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>[a*x+c*y,b*x+d*y]),low=[0,1].map(i=>Math.min(...corners.map(v=>v[i]))),high=[0,1].map(i=>Math.max(...corners.map(v=>v[i])));
  const sx=rect.width/Math.max(1e-8,high[0]-low[0])*rootWidth/rootRect.width,sy=rect.height/Math.max(1e-8,high[1]-low[1])*rootHeight/rootRect.height;
  const tx=(rect.left-rootRect.left)*rootWidth/rootRect.width-low[0]*sx,ty=(rect.top-rootRect.top)*rootHeight/rootRect.height-low[1]*sy;
  const affine=R.identity();affine[0]=a*sx;affine[1]=-b*sy;affine[4]=-c*sx;affine[5]=d*sy;affine[12]=tx+c*sx*height;affine[13]=rootHeight-ty-d*sy*height;
  if(reference){const cx=affine[12]+affine[0]*width/2+affine[4]*height/2,cy=affine[13]+affine[1]*width/2+affine[5]*height/2;
   const xs=(reference.scaleX||1)/Math.max(1e-8,Math.hypot(a,b)),ys=(reference.scaleY||1)/Math.max(1e-8,Math.hypot(c,d));affine[0]*=xs;affine[1]*=xs;affine[4]*=ys;affine[5]*=ys;width=reference.width;height=reference.height;affine[12]=cx-affine[0]*width/2-affine[4]*height/2;affine[13]=cy-affine[1]*width/2-affine[5]*height/2;}
  const scale=Math.min(width/(viewBounds.high[0]-viewBounds.low[0]),height/(viewBounds.high[1]-viewBounds.low[1]))*.98;
  const fit=R.multiply(R.transform({translation:[width/2-scale*viewBounds.center[0],height/2-scale*viewBounds.center[1],0]}),R.multiply(R.transform({scale:[scale,scale,scale]}),VIEW));
  return R.multiply(affine,fit);
 }
 function load(id){if(!assets.has(id))assets.set(id,MG.WeaponModels.loadModel(id).catch(e=>{assets.delete(id);throw e}));return assets.get(id);}
 function lightningColor(level){const hex=(MG.Workshop?.GLOW||['','#ffe24a','#4aa8ff','#b35cff','#ff9a2e','#ff3b3b'])[level];return hex?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255):[0,0,0];}
 let lightningBlob;
 function loadLightning(){if(!lightningBlob){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);lightningBlob=fetch('assets/weapon-vfx-v1692/lightning-imagegen.png',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Lightning '+r.status);return r.blob();}).finally(()=>clearTimeout(timer)).catch(e=>{lightningBlob=null;throw e});}return lightningBlob;}
 const VS=`#version 300 es
precision highp float;layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;
layout(location=3) in vec4 aM0;layout(location=4) in vec4 aM1;layout(location=5) in vec4 aM2;layout(location=6) in vec4 aM3;layout(location=7) in float aOpacity;layout(location=8) in float aFlash;
uniform mat4 uVP,uPart,uView;out vec3 vNormal,vSurface,vSurfaceNormal;out vec2 vUV;out float vOpacity,vFlash;
void main(){mat4 model=mat4(aM0,aM1,aM2,aM3)*uPart;vSurfaceNormal=normalize(transpose(inverse(mat3(uPart)))*aNormal);vNormal=normalize(mat3(uView)*vSurfaceNormal);vSurface=(uPart*vec4(aPosition,1.)).xyz;vUV=aUV;vOpacity=aOpacity;vFlash=aFlash;gl_Position=uVP*model*vec4(aPosition,1.);}`;
 const FS=`#version 300 es
precision highp float;in vec3 vNormal,vSurface,vSurfaceNormal;in vec2 vUV;in float vOpacity,vFlash;uniform vec4 uColor;uniform vec3 uEmission,uModelLow,uModelSpan,uLightningColor;uniform float uTime;uniform float uRoughness;uniform bool uTextured;uniform sampler2D uTexture,uLightning;out vec4 frag;
float artwork(vec2 uv){vec4 p=texture(uLightning,fract(uv));return p.a*dot(p.rgb,vec3(.333333));}
void main(){vec4 texel=uTextured?texture(uTexture,vUV):vec4(1.);float alpha=uColor.a*texel.a*vOpacity;if(alpha<.003)discard;vec3 n=normalize(vNormal),L=normalize(vec3(-.45,.8,1.)),V=vec3(0.,0.,1.);if(!gl_FrontFacing)n=-n;vec3 fill=normalize(vec3(.8,.3,-.5));float light=max(0.,dot(n,L)),bounce=max(0.,dot(n,fill));vec3 base=uColor.rgb*pow(texel.rgb,vec3(2.2));float spec=pow(max(0.,dot(n,normalize(L+V))),mix(8.,64.,1.-max(uRoughness,.35)))*.48;float rim=pow(1.-max(0.,dot(n,V)),3.)*max(0.,dot(n,normalize(vec3(.8,.6,.2))))*.12;vec3 color=base*(.62+.65*light+.25*bounce)+vec3(spec)+vec3(1.,.84,.48)*rim+uEmission;if(vFlash>.01){vec3 q=(vSurface-uModelLow)/uModelSpan;vec3 weights=pow(abs(normalize(vSurfaceNormal)),vec3(4.));weights/=max(.0001,weights.x+weights.y+weights.z);vec2 shift=vec2(mod(floor(uTime*12.5),4.)*.25,0.);float arc=dot(weights,vec3(artwork(q.yz+shift),artwork(q.xz+shift),artwork(q.xy+shift)));vec3 tint=pow(uLightningColor,vec3(2.2));color=mix(color,tint,clamp(arc*1.4,0.,.9))+tint*arc*.9;}frag=vec4(pow(clamp(color,0.,1.),vec3(1./2.2)),alpha);}`;
 function createScene(screen){
  const canvas=document.createElement('canvas');canvas.className='game-hammer-models';canvas.setAttribute('aria-hidden','true');screen.appendChild(canvas);
  const state={screen,canvas,entries:new Map(),models:new Map(),pending:new Map(),failedModels:new Set(),buffers:new Set(),vaos:new Set(),textures:new Set(),dead:false,lost:false,epoch:0,raf:0,last:-Infinity,key:'',gl:null,program:null,U:null,instanceBuffer:null,drawCalls:0};
  function initialize(){
   state.epoch++;state.lost=false;state.key='';state.last=-Infinity;state.buffers.clear();state.vaos.clear();state.textures.clear();
   const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});if(!gl)throw Error('Hammer WebGL2 unavailable');state.gl=gl;
   const shaders=[];for(const [type,source] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,FS]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));}
   const program=gl.createProgram();for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);for(const shader of shaders)gl.deleteShader(shader);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));state.program=program;
   state.U=Object.fromEntries(['VP','Part','View','Color','Emission','Roughness','Textured','Texture','Lightning','LightningColor','Time','ModelLow','ModelSpan'].map(n=>[n,gl.getUniformLocation(program,'u'+n)]));state.instanceBuffer=gl.createBuffer();state.buffers.add(state.instanceBuffer);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);state.failed=false;
   const epoch=state.epoch,tex=gl.createTexture();state.lightning=tex;state.textures.add(tex);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
   loadLightning().then(async blob=>{let expired=false,timer;const decode=createImageBitmap(blob,{premultiplyAlpha:'none'}).then(bitmap=>{if(expired){bitmap.close();throw Error('Late lightning decode');}return bitmap;});const bitmap=await Promise.race([decode,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Lightning decode timeout'));},4000)})]).finally(()=>clearTimeout(timer));try{if(state.dead||state.lost||epoch!==state.epoch)return;gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);state.key='';schedule();}finally{bitmap.close();}}).catch(error=>console.warn('Imagegen lightning unavailable',error));
  }
  async function upload(id){
   const epoch=state.epoch,model=await load(id);if(state.dead||state.lost||epoch!==state.epoch)return;const gl=state.gl,parts=[],list=R.instances(model),box=R.bounds(model,list),viewBounds=R.bounds(model,list.map(d=>({...d,world:R.multiply(VIEW,d.world)}))),textures=new Map();
   async function texture(index){if(textures.has(index))return textures.get(index);const image=model.json.images[model.json.textures[index].source],view=model.json.bufferViews[image.bufferView],blob=new Blob([model.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)],{type:image.mimeType||'image/png'});let timer;
    const bitmap=await Promise.race([createImageBitmap(blob,{premultiplyAlpha:'none'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Hammer texture decode timeout')),4000)})]).finally(()=>clearTimeout(timer));
    if(state.dead||epoch!==state.epoch){bitmap.close();return null;}const tex=gl.createTexture();state.textures.add(tex);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);bitmap.close();gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);textures.set(index,tex);return tex;}
   for(const item of list){
    if(state.dead||epoch!==state.epoch)return;const p=item.primitive,mat=model.json.materials[p.material]||{},pbr=mat.pbrMetallicRoughness||{},tex=pbr.baseColorTexture?await texture(pbr.baseColorTexture.index):null;if(state.dead||epoch!==state.epoch)return;
    const vao=gl.createVertexArray();state.vaos.add(vao);gl.bindVertexArray(vao);const count=model.json.accessors[p.attributes.POSITION].count;
    for(const [loc,key,size] of [[0,'POSITION',3],[1,'NORMAL',3],[2,'TEXCOORD_0',2]]){const buffer=gl.createBuffer();state.buffers.add(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,p.attributes[key]===undefined?new Float32Array(count*size):R.accessor(model,p.attributes[key]),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}
    gl.bindBuffer(gl.ARRAY_BUFFER,state.instanceBuffer);for(let i=0;i<4;i++){gl.enableVertexAttribArray(3+i);gl.vertexAttribPointer(3+i,4,gl.FLOAT,false,72,i*16);gl.vertexAttribDivisor(3+i,1);}for(let i=0;i<2;i++){gl.enableVertexAttribArray(7+i);gl.vertexAttribPointer(7+i,1,gl.FLOAT,false,72,64+i*4);gl.vertexAttribDivisor(7+i,1);}
    const indices=R.accessor(model,p.indices),ib=gl.createBuffer();state.buffers.add(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
    parts.push({vao,count:indices.length,world:item.world,texture:tex,color:pbr.baseColorFactor||[1,1,1,1],roughness:pbr.roughnessFactor??.5,emission:(mat.emissiveFactor||[0,0,0]).map(v=>v*(mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1)),double:mat.doubleSided});
   }
   if(!state.dead&&epoch===state.epoch){state.models.set(id,{parts,bounds:box,viewBounds});state.key='';schedule();}
  }
  function ensure(id){if(state.models.has(id)||state.pending.has(id)||state.failedModels.has(id)||state.dead||state.lost)return;const promise=upload(id).catch(error=>{state.failedModels.add(id);console.warn('3D hammer: sprite fallback',error);}).finally(()=>{if(state.pending.get(id)===promise)state.pending.delete(id)});state.pending.set(id,promise);}
  function draw(now){
   if(state.dead||state.lost)return false;if(document.hidden||!screen.isConnected||getComputedStyle(screen).display==='none'){canvas.hidden=true;return false;}if(now-state.last<1000/30-.5)return true;
   const rect=screen.getBoundingClientRect(),w=screen.clientWidth,h=screen.clientHeight;if(!w||!h||!rect.width)return false;
   const level=MG.Workshop?.weaponLevel?.('goldhammer')||0,groups=new Map(),keys=[w,h,Math.min(root.devicePixelRatio||1,1.25),level],parents=new Map();for(const entry of state.entries.values())if(!entry.clone&&entry.el.isConnected)parents.set(entry.layer,entry);
   for(const entry of state.entries.values()){
    if(!entry.el.isConnected){state.entries.delete(entry.key);continue;}if(!entry.packet)continue;const model=state.models.get(entry.id);if(!model)continue;
    const style=getComputedStyle(entry.el),layerStyle=getComputedStyle(entry.layer);if((style.visibility==='hidden'&&!entry.selfImage)||layerStyle.visibility==='hidden'||layerStyle.display==='none')continue;
    const parent=entry.clone?parents.get(entry.layer):null,parentStyle=parent?getComputedStyle(parent.el):null;
    const opacity=(parentStyle?(+parentStyle.opacity||0)*.7*Math.min(1,(+style.opacity||0)/.7):(+style.opacity||0))*(layerStyle.opacity===''?1:(+layerStyle.opacity||0));if(opacity<.002)continue;
    const width=entry.el.offsetWidth,height=entry.el.offsetHeight;if(!width||!height)continue;
    let reference;if(parent){const v=(parentStyle.transform||'').match(/matrix(3d)?\(([^)]+)\)/),n=v?v[2].split(',').map(Number):[1,0,0,1];reference={width:parent.el.offsetWidth,height:parent.el.offsetHeight,scaleX:Math.hypot(n[0],n[1]),scaleY:Math.hypot(n[v?.[1]?4:2],n[v?.[1]?5:3])};}
    const er=entry.el.getBoundingClientRect(),matrix=frameMatrix(model.viewBounds,width,height,er,style.transform,rect,w,h,reference),modelId=entry.id;
    const alpha=opacity,flash=level>0&&(parent||entry).img?.dataset.zapOrig?1:0,key=modelId+':'+(entry.clone?'clone':'main');if(!groups.has(key))groups.set(key,{id:modelId,clone:entry.clone,items:[]});groups.get(key).items.push([...matrix,alpha,flash]);keys.push(key,...matrix,alpha,flash,flash?Math.floor(now/80):0);entry.el.classList.add(entry.selfImage?'gold-model-source':'has-hammer-model');
   }
   canvas.hidden=!groups.size;if(!groups.size)return false;const key=keys.join(',');if(key===state.key)return true;state.key=key;state.last=now;
   const gl=state.gl,dpr=Math.min(root.devicePixelRatio||1,1.25),pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
   gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(state.program);const vp=R.identity();vp[0]=2/w;vp[5]=2/h;vp[10]=-1/2048;vp[12]=vp[13]=-1;gl.uniformMatrix4fv(state.U.VP,false,vp);gl.uniform1i(state.U.Texture,0);gl.uniform1f(state.U.Time,now/1000);state.drawCalls=0;
   gl.uniformMatrix4fv(state.U.View,false,VIEW);gl.uniform3fv(state.U.LightningColor,lightningColor(level));gl.uniform1i(state.U.Lightning,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,state.lightning);
   const ordered=[...groups.values()].sort((a,b)=>+b.clone-+a.clone);let main=false;
   for(const group of ordered){if(!group.clone&&!main){gl.clear(gl.DEPTH_BUFFER_BIT);main=true;}const model=state.models.get(group.id);gl.uniform3fv(state.U.ModelLow,model.bounds.low);gl.uniform3fv(state.U.ModelSpan,model.bounds.high.map((v,i)=>Math.max(.001,v-model.bounds.low[i])));gl.bindBuffer(gl.ARRAY_BUFFER,state.instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(group.items.flat()),gl.DYNAMIC_DRAW);
    for(const part of model.parts){gl.bindVertexArray(part.vao);if(part.double)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);gl.uniformMatrix4fv(state.U.Part,false,part.world);gl.uniform4fv(state.U.Color,part.color);gl.uniform3fv(state.U.Emission,part.emission);gl.uniform1f(state.U.Roughness,part.roughness);gl.uniform1i(state.U.Textured,!!part.texture);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,part.texture);gl.drawElementsInstanced(gl.TRIANGLES,part.count,gl.UNSIGNED_INT,0,group.items.length);state.drawCalls++;}
   }return true;
  }
  function schedule(){if(state.dead||state.raf)return;state.raf=requestAnimationFrame(function frame(now){state.raf=0;if(draw(now))schedule();});}
  state.schedule=schedule;state.ensure=ensure;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();state.lost=true;state.epoch++;cancelAnimationFrame(state.raf);state.raf=0;canvas.hidden=true;state.models.clear();for(const entry of state.entries.values())entry.el.classList.remove('has-hammer-model','gold-model-source');});
  canvas.addEventListener('webglcontextrestored',()=>{if(state.dead)return;try{initialize();state.pending.clear();state.failedModels.clear();for(const entry of state.entries.values())ensure(entry.id);}catch(error){console.warn(error);}});
  try{initialize();}catch(error){state.failed=true;canvas.hidden=true;console.warn('3D hammer unavailable; retaining sprite',error);}
  return state;
 }
 function create({el,layer,id,img,clone=false,selfImage=false}){
  const screen=el.closest('#game-screen');if(id!=='goldhammer'||!screen||!MG.WeaponModels?.loadModel)return null;
  if(!shared||shared.dead||shared.screen!==screen){releaseGPU();shared=createScene(screen);}const state=shared,entry={key:++nextId,el,layer,id,img,clone,selfImage,packet:selfImage?{phase:'legacy-clone'}:null};state.entries.set(entry.key,entry);if(state.models.has(id))el.classList.add(selfImage?'gold-model-source':'has-hammer-model');if(!state.failed)state.ensure(id);
  return {update(packet){if(state.dead)return;entry.packet=packet;if(!state.failed)state.schedule();},clear(){state.entries.delete(entry.key);el.classList.remove('has-hammer-model','gold-model-source');state.key='';if(!state.entries.size){if(shared===state)releaseGPU();}else state.schedule();}};
 }
 function releaseGPU(){const state=shared;if(!state)return;shared=null;state.dead=true;cancelAnimationFrame(state.raf);state.canvas.remove();const gl=state.gl;if(gl){for(const b of state.buffers)gl.deleteBuffer(b);for(const v of state.vaos)gl.deleteVertexArray(v);for(const t of state.textures)gl.deleteTexture(t);if(state.program)gl.deleteProgram(state.program);gl.getExtension('WEBGL_lose_context')?.loseContext();}state.buffers.clear();state.vaos.clear();state.textures.clear();state.entries.clear();}
 MG.GameHammerModels={create,releaseGPU,frameMatrix,lightningColor,viewMatrix:VIEW,ready:id=>id==='goldhammer'&&!!shared?.models.has(id),stats:()=>shared?{contexts:shared.failed?0:1,actors:shared.entries.size,models:shared.models.size,drawCalls:shared.drawCalls}: {contexts:0,actors:0,models:0,drawCalls:0}};
})(window);
