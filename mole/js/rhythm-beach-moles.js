/* Four real 3D actors share one WebGL canvas and the existing beach audio clock. */
(function(root){'use strict';
const MG=root.MoleGame,R=root.StudioRig,AP=MG.MoleAppearances,FX=MG.RhythmBeachStunts;let modelPromise;
function load(){if(!modelPromise)modelPromise=fetch('assets/home3d/mole-clay-v47-smile.glb?v=1690-G').then(r=>{if(!r.ok)throw Error('Beach mole model '+r.status);return r.arrayBuffer()}).then(R.parseGLB).then(m=>AP.prepare(m)).catch(e=>{modelPromise=null;throw e});return modelPromise}
function create(stage){
 let canvas,gl,rig,parts=[],program,U,A,ready=false,loading=null,lost=false,geometry=null,lastHandError=0;
 const holeBase='assets/rhythm/beach-sand-hole-v1690/';
 function prepare(){if(ready&&!lost)return Promise.resolve(true);if(!loading)loading=Promise.all([load(),fetch(holeBase+'geometry.json').then(r=>{if(!r.ok)throw Error('Hole geometry '+r.status);return r.json()})]).then(([model,data])=>{geometry=data;return initialize(model)}).catch(e=>{loading=null;canvas?.remove();canvas=null;throw e});return loading}
 async function initialize(model){
  if(canvas)canvas.remove();parts=[];
  canvas=document.createElement('canvas');canvas.className='rp-beach-moles-3d';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;ready=false;stop()});canvas.addEventListener('webglcontextrestored',()=>{lost=false;loading=null;prepare().catch(console.error)});
  gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});if(!gl)throw Error('WebGL2 is required for beach characters');rig=R.prepare(model);
  const joints=Math.max(...rig.skins.map(s=>s.joints.length));
  const vs=`#version 300 es
precision highp float;in vec3 aPosition,aNormal;in vec4 aColor,aJoints,aWeights;in float aHand;uniform mat4 uModel,uVP,uBones[${joints}];out vec3 vNormal;out vec4 vColor;out float vHand;void main(){mat4 s=aWeights.x*uBones[int(aJoints.x)]+aWeights.y*uBones[int(aJoints.y)]+aWeights.z*uBones[int(aJoints.z)]+aWeights.w*uBones[int(aJoints.w)];vec4 p=uModel*s*vec4(aPosition,1.);vNormal=normalize(mat3(uModel)*mat3(s)*aNormal);vColor=aColor;vHand=aHand;gl_Position=uVP*p;}`;
  const fs=`#version 300 es
precision highp float;in vec3 vNormal;in vec4 vColor;in float vHand;uniform vec4 uColor,uHoleRect;uniform sampler2D uHoleMask,uHoleFront;uniform float uFlash,uHandsOnRim;out vec4 frag;void main(){vec2 uv=vec2((gl_FragCoord.x-uHoleRect.x)/uHoleRect.z,(uHoleRect.y-gl_FragCoord.y)/uHoleRect.w);if(uv.y>1.)discard;float cover=uv.y<0.?0.:texture(uHoleMask,clamp(uv,vec2(0.),vec2(1.))).a;float visibility=1.-cover*(1.-uHandsOnRim*step(.5,vHand));if(visibility<.001)discard;float d=max(dot(normalize(vNormal),normalize(vec3(-.4,.85,1.))),0.);vec3 base=uColor.rgb*vColor.rgb;base=mix(base,vec3(1.),uFlash);vec3 body=pow(max(base*(.42+.58*d),vec3(0.)),vec3(1./2.2));vec4 front=texture(uHoleFront,clamp(uv,vec2(0.),vec2(1.)));vec3 sand=front.rgb/max(front.a,.00001);frag=vec4(mix(body,sand,1.-visibility),uColor.a*vColor.a);}`;
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
  program=gl.createProgram();const shaders=[shader(gl.VERTEX_SHADER,vs),shader(gl.FRAGMENT_SHADER,fs)];for(const s of shaders)gl.attachShader(program,s);gl.linkProgram(program);for(const s of shaders)gl.deleteShader(s);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  U=Object.fromEntries(['Model','VP','Bones','Color','HoleRect','HoleMask','HoleFront','Flash','HandsOnRim'].map(n=>[n,gl.getUniformLocation(program,'u'+(n==='Bones'?'Bones[0]':n))]));A=Object.fromEntries(['Position','Normal','Color','Joints','Weights','Hand'].map(n=>[n,gl.getAttribLocation(program,'a'+n)]));
  function attribute(name,data,width){const loc=A[name];if(loc<0)return null;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,width,gl.FLOAT,false,0,0);return b}
  model.json.nodes.forEach((node,index)=>{
   if(node.mesh===undefined||(node.name!=='Mole_Clay_Skin'&&!AP.hairStyle(node)))return;
   for(const p of model.json.meshes[node.mesh].primitives){
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const n=model.json.accessors[p.attributes.POSITION].count;
    for(const [name,key,width] of [['Position','POSITION',3],['Normal','NORMAL',3],['Joints','JOINTS_0',4],['Weights','WEIGHTS_0',4]])attribute(name,R.accessor(model,p.attributes[key]),width);
    const jointValues=R.accessor(model,p.attributes.JOINTS_0),weightValues=R.accessor(model,p.attributes.WEIGHTS_0),skin=rig.skins[node.skin],handFlags=new Float32Array(n);for(let v=0;v<n;v++)for(let k=0;k<4;k++)if(/^(Hand|Finger[123]|Thumb)\./.test(model.json.nodes[skin.joints[jointValues[v*4+k]]].name))handFlags[v]+=weightValues[v*4+k];attribute('Hand',handFlags,1);
    const colors=p.attributes.COLOR_0===undefined?new Float32Array(n*4).fill(1):R.accessor(model,p.attributes.COLOR_0),colorSize=p.attributes.COLOR_0===undefined?4:model.json.accessors[p.attributes.COLOR_0].type==='VEC3'?3:4;
    const material=model.json.materials[p.material],colorBuffer=attribute('Color',colors,colorSize),variants={};
    if(material.name==='Head smooth tone')for(const id of AP.styles)variants[id]=attribute('Color',AP.vertexColors(model,p,id),colorSize);
    const indices=R.accessor(model,p.indices),ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
    parts.push({vao,node:index,count:indices.length,style:AP.hairStyle(node),material,colorBuffer,variants,colorSize});
   }
  });
  for(const [slot,file] of [[0,'hole-occlusion.png'],[1,'hole-front.png']]){
   const response=await fetch(holeBase+file);if(!response.ok)throw Error('Hole layer '+response.status);
   const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:slot===1?'premultiply':'none'}),texture=gl.createTexture();
   gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);bitmap.close();
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  gl.useProgram(program);gl.uniform1i(U.HoleMask,0);gl.uniform1i(U.HoleFront,1);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);stage.classList.add('rp-use-3d');ready=true;return true;
 }
 function render(time,layout,heads,moles,jumpDuration=.42){
  if(!ready||lost||document.hidden)return;
  lastHandError=0;
  const host=stage.querySelector('[data-rp-lanes]');if(canvas.parentNode!==host)host.prepend(canvas);canvas.hidden=false;stage.classList.add('rp-3d-ready');
  const w=Math.max(1,Math.round(layout.W)),h=Math.max(1,Math.round(layout.H)),dpr=Math.min(root.devicePixelRatio||1,1.25),pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
  const vp=R.identity();vp[0]=2/w;vp[5]=2/h;vp[10]=-1/1000;vp[12]=-1;vp[13]=-1;gl.uniformMatrix4fv(U.VP,false,vp);
  const nodes=rig.model.json.nodes,headNode=nodes.findIndex(n=>n.name==='Head'),bodyNode=nodes.findIndex(n=>n.name==='Body'),rimWorlds=R.pose(rig,'RimIdle',Math.max(0,time),true),rimBodyInverse=R.inverse(rimWorlds[bodyNode]);
  for(let i=0;i<4;i++){
   const id=AP.styles[i],state=moles[i],dt=time-state.jumpAt,hurt=time-state.hurtAt,jumping=dt>=0&&dt<jumpDuration;
   const clip=hurt>=0&&hurt<.45?'PainHit':jumping?'Jump':'Idle',duration=rig.animations.find(a=>a.name===clip)?.duration||1,clipTime=clip==='Jump'?dt/jumpDuration*duration:clip==='PainHit'?hurt+.22:Math.max(0,time);
   const worlds=AP.pose(rig,clip,clipTime,clip==='Idle',AP.face(rig,clip==='PainHit'),Math.max(0,time),id),head=heads[i].h||heads[i],scale=head.r/.80,anchor=R.point(worlds[headNode],[0,.57,0]),rect=layout.holeRects[i],bodyDelta=R.multiply(worlds[bodyNode],rimBodyInverse);
   FX.hair(rig,worlds,id,FX.hairMotion(time,state.jumpAt,jumpDuration,id));
   const stunt=clip==='PainHit'?{active:false}:FX.sample(state,time);
   const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},rest=stunt.active?0:jumping?1-smooth(Math.min(dt,jumpDuration-dt)/(jumpDuration/7)):1,armRest=clip==='PainHit'?0:rest,offsets={};
   for(const side of ['L','R']){const hand=R.multiply(bodyDelta,rimWorlds[nodes.findIndex(n=>n.name==='Hand.'+side)]),x=head.x+scale*(hand[12]-anchor[0]),u=Math.max(0,Math.min(geometry.width-1,(x-rect.x)/rect.w*(geometry.width-1))),lo=Math.floor(u),hi=Math.min(geometry.width-1,lo+1),f=u-lo,edge=geometry.frontCurvePixels[lo]*(1-f)+geometry.frontCurvePixels[hi]*f,target=rect.y+edge/geometry.height*rect.h-scale*.04;offsets[side]=target-(head.y+scale*(anchor[1]-hand[13]));}
   const offset=(offsets.L+offsets.R)/2;
   nodes.forEach((n,k)=>{const match=/^(UpperArm|Forearm|Hand|Finger[123]|Thumb)\.([LR])$/.exec(n.name||'');if(!match||armRest<=0)return;const rim=R.multiply(bodyDelta,rimWorlds[k]);rim[13]-=(offsets[match[2]]-offset)/scale;worlds[k]=new Float32Array(worlds[k].map((v,c)=>v+(rim[c]-v)*armRest));});
   const baseInstance=R.transform({translation:[head.x-scale*anchor[0],h-head.y-scale*anchor[1]-offset*rest,-scale*anchor[2]],scale:[scale,scale,scale]}),instance=FX.turn(baseInstance,R.point(worlds[bodyNode],[0,.2,0]),stunt);
   if(armRest>.999)for(const side of ['L','R']){const hand=worlds[nodes.findIndex(n=>n.name==='Hand.'+side)],point=R.point(instance,Array.from(hand.slice(12,15))),u=Math.max(0,Math.min(geometry.width-1,(point[0]-rect.x)/rect.w*(geometry.width-1))),lo=Math.floor(u),hi=Math.min(geometry.width-1,lo+1),f=u-lo,target=rect.y+(geometry.frontCurvePixels[lo]*(1-f)+geometry.frontCurvePixels[hi]*f)/geometry.height*rect.h-scale*.04;lastHandError=Math.max(lastHandError,Math.abs((h-point[1])-target));}
   gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.round(i*pw/4),0,Math.ceil(pw/4),ph);gl.uniform4fv(U.HoleRect,[rect.x*pw/layout.W,(layout.H-rect.y)*ph/layout.H,rect.w*pw/layout.W,rect.h*ph/layout.H]);gl.uniform1f(U.HandsOnRim,armRest);gl.uniform1f(U.Flash,clip==='PainHit'?Math.max(0,1-hurt/.15)*.25:0);
   for(const part of parts){if(part.style&&part.style!==id)continue;gl.bindVertexArray(part.vao);const b=part.variants[id]||part.colorBuffer;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(A.Color,part.colorSize,gl.FLOAT,false,0,0);
    gl.uniform4fv(U.Color,AP.materialColor(part.material,id));gl.uniformMatrix4fv(U.Model,false,R.multiply(instance,worlds[part.node]));gl.uniformMatrix4fv(U.Bones,false,R.palette(rig,worlds,part.node));gl.drawElements(gl.TRIANGLES,part.count,gl.UNSIGNED_INT,0);
   }
  }
  gl.disable(gl.SCISSOR_TEST);
 }
 function stop(){if(canvas)canvas.hidden=true;stage.classList.remove('rp-3d-ready')}
 return {prepare,render,stop,holeGeometry:()=>geometry,dbg:()=>({ready,lost,styles:AP.styles.slice(),contexts:canvas?1:0,maxRestingHandError:lastHandError})};
}
MG.RhythmBeachMoles={create};
})(window);
