/* Local amateur-round-one trial. Actual GLB skin animation, one shared canvas. */
(function(root){'use strict';
const MG=root.MoleGame,R=root.StudioRig,base='assets/checkerboard-v1590/';
let active=false,ready=false,loading=null,pending=false,generation=0,clockTime=0,lastClock=0,canvas,paint,queued=false;
const entries=new Map();
// Species index is poseIndex %4 in the unchanged spawn scheduler.
const animalVariants=[['rabbit','yellow','#FFCA52'],['tiger','green','#66C884'],['hippo','pink','#EF96B8'],['lion','charcoal','#50545C']].map(([species,id,hex])=>({species,id,hex,color:[1,3,5].map(i=>Math.pow(parseInt(hex.slice(i,i+2),16)/255,2.2)).concat(1)}));
function animalVariant(index){const n=Number.isFinite(index)?Math.trunc(index):0;return animalVariants[((n%4)+4)%4]}
function canRender(m){return !m.bomb&&(m.kind==='mole'||m.kind==='animal')}
function sinkDepth(m){return m.dying&&!m.killed?Math.max(0,(m.shownDepth/4-.26)/.74)*4:m.shownDepth}
function clipFor(m,now=clockTime){
 const hitElapsed=now-m._clayHit;
 if(m.dying&&m.killed){const elapsed=Math.max(0,now-(m._clayKilledAt??now));return {clip:'PainHit',time:elapsed+.22,loop:false,handsUp:true,upTime:Math.min(.5,elapsed*3.4)}}
 if(m.dying&&m._clayRestTime!=null&&m._clayExitAt!=null)return {clip:'RimRelease',time:(now-m._clayExitAt)*2,loop:false};
 if(m.hits>0&&hitElapsed<1.28)return {clip:'PainHit',time:Math.max(0,hitElapsed)+.22,loop:false};
 if(m._clayRestTime!=null){
  const rest=now-m._clayRestTime;
  if(rest<.6)return {clip:'RimSettle',time:rest,loop:false};
  return {clip:'RimIdle',time:rest-.6,loop:true};
 }
 return {clip:'Idle',time:now-m._clayBorn,loop:true};
}
function poseFor(runtime,m,motion,now=clockTime){
 const moving=R.pose(runtime,motion.clip,Math.max(0,motion.time),motion.loop);
 if(motion.handsUp){
  const raised=R.pose(runtime,'ArmsUp',motion.upTime,false),body=runtime.model.json.nodes.findIndex(n=>n.name==='Body'),delta=R.multiply(moving[body],R.inverse(raised[body]));
  return moving.map((matrix,i)=>/^(UpperArm|Hand|Finger[123]|Thumb)\./.test(runtime.model.json.nodes[i].name||'')?R.multiply(delta,raised[i]):matrix);
 }
 if(!motion.clip.startsWith('Rim'))return moving;
 // Rim motions own the arms only. Every body/head/helmet transform stays on
 // the original approved Idle animation, rather than moving the whole actor.
 const original=R.pose(runtime,'Idle',Math.max(0,now-m._clayBorn),true);
 return original.map((matrix,i)=>/^(UpperArm|Hand|Finger[123]|Thumb)\./.test(runtime.model.json.nodes[i].name||'')?moving[i]:matrix);
}
async function initialize(){
 const board=document.getElementById('mole-board');canvas=document.createElement('canvas');canvas.className='clay-mole-canvas';canvas.hidden=true;document.getElementById('mole-pop-layer').append(canvas);
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:false});if(!gl)throw Error('WebGL2 unavailable for local 3D trial');
 const response=await fetch(base+'mole-v41.glb');if(!response.ok)throw Error('Mole model load failed');const model=R.parseGLB(await response.arrayBuffer()),runtime=R.prepare(model),draws=[];let estimatedGpuBytes=0;
 const joints=Math.max(1,...runtime.skins.map(s=>s.joints.length));if(joints*5+24>gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS))throw Error('이 기기의 관절 셰이더 용량을 초과합니다.');
 const vs=`#version 300 es
precision highp float;in vec3 aPosition;in vec4 aColor;in vec3 aNormal;in vec2 aUV;in vec4 aJoints;in vec4 aWeights;uniform vec2 uOffset;uniform mat4 uModel,uVP,uJoints[${joints}];uniform float uRimJoint[${joints}];uniform bool uSkinned;out vec4 vColor;out float vOverRim;out vec3 vPosition,vNormal;out vec2 vUV;void main(){mat4 s=mat4(1.0);if(uSkinned)s=aWeights.x*uJoints[int(aJoints.x)]+aWeights.y*uJoints[int(aJoints.y)]+aWeights.z*uJoints[int(aJoints.z)]+aWeights.w*uJoints[int(aJoints.w)];vOverRim=uSkinned?aWeights.x*uRimJoint[int(aJoints.x)]+aWeights.y*uRimJoint[int(aJoints.y)]+aWeights.z*uRimJoint[int(aJoints.z)]+aWeights.w*uRimJoint[int(aJoints.w)]:0.0;vec4 p=uModel*s*vec4(aPosition,1.0);vPosition=p.xyz;vNormal=mat3(uModel)*mat3(s)*aNormal;vUV=aUV;vColor=aColor;gl_Position=uVP*p;gl_Position.xy+=uOffset*gl_Position.w;}`;
 const fs=`#version 300 es
precision highp float;in vec4 vColor;in float vOverRim;in vec3 vPosition,vNormal;in vec2 vUV;uniform vec4 uHole;uniform vec4 uColor;uniform sampler2D uBase,uNormal,uRim;uniform float uRimWidth,uRimHeight;uniform bool uHasBase,uHasNormal;uniform float uNormalScale,uFlash,uRoughness;uniform vec3 uEye;out vec4 color;void main(){vec2 hd=(gl_FragCoord.xy-uHole.xy)/uHole.zw;if(dot(hd,hd)>1.0&&(vPosition.y<1.0||(gl_FragCoord.y<uHole.y&&!(vOverRim>.5&&vPosition.y>1.10))))discard;vec2 rimUV=vec2(.5,278.0/494.0)+(gl_FragCoord.xy-uHole.xy)/vec2(uRimWidth,-uRimHeight);if(!(vOverRim>.5&&vPosition.y>1.10)&&all(greaterThanEqual(rimUV,vec2(0.0)))&&all(lessThanEqual(rimUV,vec2(1.0)))&&texture(uRim,rimUV).a>.5)discard;vec4 tex=uHasBase?texture(uBase,vUV):vec4(1.0);if(tex.a*uColor.a<.05)discard;vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;if(uHasNormal){vec3 q1=dFdx(vPosition),q2=dFdy(vPosition);vec2 st1=dFdx(vUV),st2=dFdy(vUV);vec3 t=normalize(q1*st2.t-q2*st1.t);vec3 b=-normalize(cross(n,t));vec3 map=texture(uNormal,vUV).xyz*2.0-1.0;map.xy*=uNormalScale;n=normalize(mat3(t,b,n)*map);}vec3 base=uColor.rgb*vColor.rgb*(uHasBase?pow(tex.rgb,vec3(2.2)):vec3(1.0));base=mix(base,vec3(1.0),uFlash);vec3 l=normalize(vec3(-.4,.85,1.0)),v=normalize(uEye-vPosition),h=normalize(l+v);float d=max(dot(n,l),0.0),spec=pow(max(dot(n,h),0.0),mix(8.0,100.0,1.0-uRoughness))*.18;color=vec4(pow(max(base*(.4+.6*d)+vec3(spec),vec3(0.0)),vec3(1.0/2.2)),tex.a*uColor.a);}`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const loc=Object.fromEntries(['uRimJoint','uRim','uRimWidth','uRimHeight','uOffset','uHole','uModel','uVP','uJoints','uSkinned','uColor','uBase','uNormal','uHasBase','uHasNormal','uNormalScale','uFlash','uRoughness','uEye'].map(n=>[n,gl.getUniformLocation(program,n==='uJoints'?'uJoints[0]':n==='uRimJoint'?'uRimJoint[0]':n)]));
 const attr=Object.fromEntries(['aPosition','aColor','aNormal','aUV','aJoints','aWeights'].map(n=>[n,gl.getAttribLocation(program,n)]));
 function buffer(values,target=gl.ARRAY_BUFFER){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,values,gl.STATIC_DRAW);estimatedGpuBytes+=values.byteLength;return b}
 function solid(pixel){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixel));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);return t}
 const white=solid([255,255,255,255]),normalWhite=solid([128,128,255,255]),textureCache=new Map();
 async function texture(index){if(textureCache.has(index))return textureCache.get(index);const promise=(async()=>{const image=model.json.images[model.json.textures[index].source];if(image.bufferView===undefined)throw Error('부하 시험에는 GLB 내장 텍스처가 필요합니다.');const view=model.json.bufferViews[image.bufferView],blob=new Blob([model.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)],{type:image.mimeType||'image/png'}),bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);estimatedGpuBytes+=bitmap.width*bitmap.height*4;bitmap.close();return t})();textureCache.set(index,promise);return promise}
 const zero=(n,w)=>new Float32Array(n*w),g=model.json;
 for(let node=0;node<g.nodes.length;node++)if(g.nodes[node].mesh!==undefined)for(const p of g.meshes[g.nodes[node].mesh].primitives){
  if((p.mode??4)!==4)throw Error('삼각형 메시만 부하 시험을 지원합니다.');
  const positions=R.accessor(model,p.attributes.POSITION),n=positions.length/3,indices=p.indices===undefined?null:new Uint32Array(R.accessor(model,p.indices)),material=g.materials?.[p.material]||{},pbr=material.pbrMetallicRoughness||{};
  const weights=p.attributes.WEIGHTS_0===undefined?zero(n,4):R.accessor(model,p.attributes.WEIGHTS_0);if(p.attributes.WEIGHTS_0===undefined)for(let i=0;i<n;i++)weights[i*4]=1;
  const vertexColors=p.attributes.COLOR_0===undefined?new Float32Array(n*4).fill(1):R.accessor(model,p.attributes.COLOR_0);
  draws.push({node,count:n,vertexColors:buffer(vertexColors),positions:buffer(positions),normals:buffer(p.attributes.NORMAL===undefined?zero(n,3):R.accessor(model,p.attributes.NORMAL)),uv:buffer(p.attributes.TEXCOORD_0===undefined?zero(n,2):R.accessor(model,p.attributes.TEXCOORD_0)),joints:buffer(p.attributes.JOINTS_0===undefined?zero(n,4):R.accessor(model,p.attributes.JOINTS_0)),weights:buffer(weights),indices:indices?buffer(indices,gl.ELEMENT_ARRAY_BUFFER):null,indexCount:indices?.length||0,materialName:material.name||'',color:pbr.baseColorFactor||[1,1,1,1],roughness:pbr.roughnessFactor??.5,base:pbr.baseColorTexture?await texture(pbr.baseColorTexture.index):white,normal:material.normalTexture?await texture(material.normalTexture.index):normalWhite,hasBase:!!pbr.baseColorTexture,hasNormal:!!material.normalTexture,normalScale:material.normalTexture?.scale??1,double:material.doubleSided});
 }

 gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1i(loc.uBase,0);gl.uniform1i(loc.uNormal,1);
 const rimResponse=await fetch(base+'floor-mask.webp');if(!rimResponse.ok)throw Error('Hole rim load failed');const rimBitmap=await createImageBitmap(await rimResponse.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'}),rimTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+2);gl.bindTexture(gl.TEXTURE_2D,rimTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,rimBitmap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);rimBitmap.close();gl.uniform1i(loc.uRim,2);
 const rimFlags=runtime.skins.map(skeleton=>new Float32Array(skeleton.joints.map(j=>/^(UpperArm|Hand|Finger[123]|Thumb)\./.test(model.json.nodes[j].name||'')?1:0)));
 function bind(b,id,size){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,size,gl.FLOAT,false,0,0)}
 const span=10.2,angle=Math.PI/6,eye=[0,1+10*Math.sin(angle),10*Math.cos(angle)];
 const projection=new Float32Array([2/span,0,0,0,0,2/span,0,0,0,0,-2/50,0,0,0,-1,1]);
 const vp=R.multiply(projection,R.lookAt(eye,[0,1,0]));gl.uniformMatrix4fv(loc.uVP,false,vp);gl.uniform3fv(loc.uEye,eye);
 paint=()=>{
  const dpr=Math.min(devicePixelRatio||1,1.5),size=Math.max(1,Math.round(board.clientWidth*dpr));if(canvas.width!==size||canvas.height!==size){canvas.width=canvas.height=size}
  gl.viewport(0,0,size,size);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const boardAspect=board.clientWidth/Math.max(1,board.clientHeight);
  gl.activeTexture(gl.TEXTURE0+2);gl.bindTexture(gl.TEXTURE_2D,rimTexture);gl.uniform1f(loc.uRimWidth,size/3);gl.uniform1f(loc.uRimHeight,494/1254*size*boardAspect);
  if(!active)return;
  entries.forEach((m,el)=>{
   if(!el.isConnected){entries.delete(el);return}if(m.shownDepth>=3.999)return;
   if(m.dying&&m.killed&&m._clayKilledAt==null)m._clayKilledAt=clockTime;
   const x=parseFloat(el.style.left)/100,y=parseFloat(el.style.top)/100;
   const motion=clipFor(m);
   const depth=sinkDepth(m);
   const worlds=poseFor(runtime,m,motion),palettes=new Map(),instance=R.transform({translation:[0,-3.4*depth/4,0]});
   // The approved inside-hole anchor stays fixed across all poses and clips.
   gl.uniform2f(loc.uOffset,(x-.5)*2,(.5-y-Math.cos(angle)*.2/span)*2);gl.uniform4f(loc.uHole,x*size,(1-y)*size,135/1254*size,58/1254*size*boardAspect);
   gl.uniform1f(loc.uFlash,Math.max(0,Math.min(1,((m._clayFlashUntil||0)-clockTime)/.09))*.8);
   for(const d of draws){
    if(!palettes.has(d.node))palettes.set(d.node,R.palette(runtime,worlds,d.node));const skin=palettes.get(d.node);
    gl.uniformMatrix4fv(loc.uModel,false,R.multiply(instance,worlds[d.node]));gl.uniform1i(loc.uSkinned,!!skin);if(skin)gl.uniformMatrix4fv(loc.uJoints,false,skin);
    if(skin)gl.uniform1fv(loc.uRimJoint,rimFlags[model.json.nodes[d.node].skin]);
    const color=m.kind==='animal'&&d.materialName==='Clay warm caramel'?animalVariant(m.poseIndex).color:d.color;
    gl.uniform4fv(loc.uColor,color);gl.uniform1f(loc.uRoughness,d.roughness);gl.uniform1i(loc.uHasBase,d.hasBase);gl.uniform1i(loc.uHasNormal,d.hasNormal);gl.uniform1f(loc.uNormalScale,d.normalScale);
    d.double?gl.disable(gl.CULL_FACE):gl.enable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,d.base);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,d.normal);
    bind(d.positions,attr.aPosition,3);bind(d.vertexColors,attr.aColor,4);bind(d.normals,attr.aNormal,3);bind(d.uv,attr.aUV,2);bind(d.joints,attr.aJoints,4);bind(d.weights,attr.aWeights,4);
    if(d.indices){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.indices);gl.drawElements(gl.TRIANGLES,d.indexCount,gl.UNSIGNED_INT,0)}else gl.drawArrays(gl.TRIANGLES,0,d.count);
   }
  });
 };
 await Promise.all(['floor-mask.webp',...Array.from({length:9},(_,i)=>'cell-'+i+'.webp')].map(file=>{const img=new Image();img.src=base+file;return img.decode()}));
 ready=true;return true;
}
function prepare(){if(ready)return Promise.resolve(true);if(!loading)loading=initialize().catch(e=>{canvas?.remove();loading=null;throw e});return loading}
function frame(){queued=false;if(!active)return;if(!document.hidden)paint();queued=true;requestAnimationFrame(frame)}
function applyOrientation(){try{const orientation=root.screen?.orientation;if(orientation?.lock)orientation.lock(active?'any':'portrait').catch(()=>{});}catch(e){/* Keep responsive layout when orientation locking is unavailable. */}}
function setActive(value){if(MG.HUD&&MG.HUD.setPopupMode)MG.HUD.setPopupMode(!!value);active=!!value;applyOrientation();document.getElementById('game-screen').classList.toggle('clay-round-one',active);if(canvas)canvas.hidden=!active;if(!active){generation++;pending=false;entries.clear();lastClock=0;if(paint)paint()}else if(!queued){queued=true;requestAnimationFrame(frame)}}
function wait(callback){if(ready)return false;if(pending)return true;pending=true;const token=generation;const attempt=()=>prepare().then(()=>{if(token!==generation)return;pending=false;callback()}).catch(e=>{console.error('Local clay preparation',e);if(token===generation)setTimeout(attempt,1000)});attempt();return true}
function renderPop(m){if(!active||!canRender(m))return false;if(!entries.has(m.el)){m._clayBorn=clockTime;m._clayHits=0;m._clayHit=-10;entries.set(m.el,m)}if(!m.dying&&m.shownDepth<=.001&&m._clayRestTime==null)m._clayRestTime=clockTime;if(m.dying&&m._clayExitAt==null)m._clayExitAt=clockTime;if(m.hits!==m._clayHits){m._clayHits=m.hits;m._clayHit=clockTime}m.img.style.visibility='hidden';return true}
function clock(now){if(lastClock)clockTime+=Math.min(.05,Math.max(0,(now-lastClock)/1000));lastClock=now}
function clear(){entries.clear();lastClock=0;if(paint)paint()}
function flash(m){if(active&&canRender(m))m._clayFlashUntil=clockTime+.09}
MG.ClayRoundOne={prepare,wait,setActive,renderPop,clock,clear,flash,animalVariant,canRender,clipFor,poseFor,sinkDepth,isActive:()=>active};
// Warm the actual model before the user starts round one; does not gate unrelated screens.
setTimeout(()=>prepare().catch(e=>console.warn('Local clay prewarm',e)),0);
})(window);
