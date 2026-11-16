/* Separate, scissored viewports for guide actors; never touches the game renderer. */
(function(root){'use strict';const MG=root.MoleGame,R=root.StudioRig,AP=MG.MoleAppearances,cache=new Map();
 const paths={smoke:'assets/characters-v1729/behavior-smoke.glb',thief:'assets/characters-v1694/behavior-thief.glb',drink:'assets/characters-v1725/behavior-drink.glb',phone:'assets/characters-v1694/behavior-phone.glb',base:'assets/characters-v1727/mole-game-smile.glb'};
 const tints=['#E5483F','#4285E8','#FFCA52','#4DBB6E','#9B5FD8'].map(hex=>[1,3,5].map(i=>Math.pow(parseInt(hex.slice(i,i+2),16)/255,2.2)).concat(1));
 function load(id){if(!cache.has(id))cache.set(id,fetch(paths[id]).then(r=>{if(!r.ok)throw Error('Guide actor '+r.status);return r.arrayBuffer();}).then(b=>AP.prepare(R.parseGLB(b),['mohawk'])).catch(e=>{cache.delete(id);throw e;}));return cache.get(id);}
 async function mount(host,samples){
  const models=await Promise.all(samples.map(s=>load(s.behavior||'base')));if(!host.isConnected)return()=>{};
  const canvas=document.createElement('canvas');canvas.className='guide-actors';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});if(!gl){canvas.remove();throw Error('Guide WebGL2 unavailable');}
  let stopped=false,raf=0,last=0,time=0;const buffers=[],textures=[],shaders=[];let program;
  function dispose(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);buffers.forEach(b=>gl.deleteBuffer(b));textures.forEach(t=>gl.deleteTexture(t));shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);canvas.remove();const ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}
  try{
  const actors=models.map(model=>({model,runtime:R.prepare(model),draws:[]}));const joints=Math.max(1,...actors.flatMap(a=>a.runtime.skins.map(s=>s.joints.length)));
  if(joints*4+16>gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS))throw Error('Guide joint capacity');
  const vs=`#version 300 es
precision highp float;in vec3 aPosition,aNormal;in vec4 aColor,aJoints,aWeights;in vec2 aUV;uniform mat4 uModel,uVP,uBones[${joints}];uniform bool uSkin;uniform float uOutline;out vec3 vNormal;out vec4 vColor;out vec2 vUV;
void main(){mat4 s=mat4(1.);if(uSkin)s=aWeights.x*uBones[int(aJoints.x)]+aWeights.y*uBones[int(aJoints.y)]+aWeights.z*uBones[int(aJoints.z)]+aWeights.w*uBones[int(aJoints.w)];vec4 p=uModel*s*vec4(aPosition,1.);vNormal=mat3(uModel)*mat3(s)*aNormal;p.xyz+=normalize(vNormal)*uOutline;vColor=aColor;vUV=aUV;gl_Position=uVP*p;}`;
  const fs=`#version 300 es
precision highp float;in vec3 vNormal;in vec4 vColor;in vec2 vUV;uniform vec4 uColor;uniform bool uHasTexture,uOutlinePass;uniform sampler2D uTexture;out vec4 frag;
void main(){if(uOutlinePass){frag=vec4(0.,1.,.2353,1.);return;}vec4 tex=uHasTexture?texture(uTexture,vUV):vec4(1.);float alpha=tex.a*uColor.a*vColor.a;if(alpha<.03)discard;vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;float light=.4+.6*max(0.,dot(n,normalize(vec3(-.4,.85,1.))));vec3 color=uColor.rgb*vColor.rgb*(uHasTexture?pow(tex.rgb,vec3(2.2)):vec3(1.))*light;frag=vec4(pow(max(color,vec3(0.)),vec3(1./2.2)),alpha);}`;
  function shader(type,text){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const U=Object.fromEntries(['uModel','uVP','uBones[0]','uSkin','uColor','uHasTexture','uTexture','uOutline','uOutlinePass'].map(n=>[n,gl.getUniformLocation(program,n)])),A=Object.fromEntries(['aPosition','aNormal','aColor','aJoints','aWeights','aUV'].map(n=>[n,gl.getAttribLocation(program,n)]));
  function buffer(data,target=gl.ARRAY_BUFFER){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
  function bind(b,id,n){if(id<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,n,gl.FLOAT,false,0,0);}
  for(let a=0;a<actors.length;a++){const actor=actors[a],model=actor.model,g=model.json,sample=samples[a],color=sample.golden?[1,.62,.08,1]:tints[sample.tint]|| (sample.kind==='animal'?MG.ClayRoundOne.animalVariant(sample.color).color:null),body=g.materials.find(m=>m.name==='Clay warm caramel').pbrMetallicRoughness.baseColorFactor;
   for(let node=0;node<g.nodes.length;node++){const n=g.nodes[node],name=n.name||'';if(n.mesh===undefined||n.extras?.appearanceStyle&&n.extras.appearanceStyle!=='mohawk'||/^Surprise /.test(name)||name==='Mole_Carrier_Skin'&&!sample.bomb||name==='Mole_Clay_Skin'&&sample.bomb)continue;
    for(const p of g.meshes[n.mesh].primitives){const mat=g.materials[p.material]||{},pbr=mat.pbrMetallicRoughness||{};if((mat.name||'').startsWith('Carry bomb ')&&!sample.bomb)continue;if(/^Bottle text (ko|en)$/.test(name)&&!name.endsWith(root.FGH.I18N.lang==='ko'?'ko':'en'))continue;
     const position=R.accessor(model,p.attributes.POSITION),count=position.length/3,width=p.attributes.COLOR_0===undefined?4:g.accessors[p.attributes.COLOR_0].type==='VEC3'?3:4;
     let colors=p.attributes.COLOR_0===undefined?new Float32Array(count*4).fill(1):new Float32Array(color&&mat.name==='Head smooth tone'?R.accessor(model,p.attributes.COLOR_0):(AP.vertexColors(model,p,'mohawk')||R.accessor(model,p.attributes.COLOR_0)));
     if(color&&mat.name==='Head smooth tone')for(let i=0;i<colors.length;i+=width)for(let k=0;k<3;k++)colors[i+k]=sample.golden?color[k]:Math.min(1,colors[i+k]/body[k]*color[k]);
     let factor=AP.materialColor(mat,'mohawk');if(color&&['Clay warm caramel','Feet cocoa'].includes(mat.name))factor=color;if(color&&mat.name==='Muzzle peach cream')factor=color.map((c,i)=>i<3?c+(1-c)*.4:1);
     const indices=p.indices===undefined?null:new Uint32Array(R.accessor(model,p.indices));let texture=null;
     if(pbr.baseColorTexture){const image=g.images[g.textures[pbr.baseColorTexture.index].source],view=g.bufferViews[image.bufferView],bitmap=await createImageBitmap(new Blob([model.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)],{type:image.mimeType||'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);bitmap.close();gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
     const data=(attr,size)=>p.attributes[attr]===undefined?new Float32Array(count*size):R.accessor(model,p.attributes[attr]);actor.draws.push({node,factor,texture,bombOutline:!!sample.bomb&&(mat.name||'').startsWith('Carry bomb ')&&!/^Carry bomb (fuse|tip)$/.test(mat.name),double:mat.doubleSided,position:buffer(position),normal:buffer(data('NORMAL',3)),colors:buffer(colors),width,joints:buffer(data('JOINTS_0',4)),weights:buffer(data('WEIGHTS_0',4)),uv:buffer(data('TEXCOORD_0',2)),indices:indices?buffer(indices,gl.ELEMENT_ARRAY_BUFFER):null,count:indices?indices.length:count});
    }
   }
  }
  if(!host.isConnected){dispose();return()=>{};}
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1i(U.uTexture,0);
  function frame(now){if(stopped)return;if(!host.isConnected){dispose();return;}raf=requestAnimationFrame(frame);if(document.hidden){last=0;return;}if(last&&now-last<32)return;time+=last?Math.min(.1,(now-last)/1000):0;last=now;
   const box=host.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,1.5),w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.disable(gl.SCISSOR_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.SCISSOR_TEST);
   actors.forEach((actor,i)=>{const sample=samples[i],r=sample.slot.getBoundingClientRect(),x=Math.round((r.left-box.left)*dpr),y=Math.round((box.bottom-r.bottom)*dpr),sw=Math.max(1,Math.round(r.width*dpr)),sh=Math.max(1,Math.round(r.height*dpr));gl.viewport(x,y,sw,sh);gl.scissor(x,y,sw,sh);gl.clear(gl.DEPTH_BUFFER_BIT);
    const span=4.4,projection=new Float32Array([2/(span*sw/sh),0,0,0,0,2/span,0,0,0,0,-2/50,0,0,0,-1,1]);gl.uniformMatrix4fv(U.uVP,false,R.multiply(projection,R.lookAt([0,6.6,8.66],[0,1.6,0])));
    const runtime=actor.runtime,t=sample.behavior==='smoke'&&time>3?1.5+(time-1.5)%1.5:time,clip=sample.behavior?'Behavior':sample.bomb?'CarryIdle':'RimIdle',worlds=AP.pose(runtime,clip,t,true,null,time,'mohawk');
    gl.uniform1f(U.uOutline,0);gl.uniform1i(U.uOutlinePass,0);
    for(const d of actor.draws){const palette=R.palette(runtime,worlds,d.node);gl.uniformMatrix4fv(U.uModel,false,worlds[d.node]);gl.uniform1i(U.uSkin,!!palette);if(palette)gl.uniformMatrix4fv(U['uBones[0]'],false,palette);gl.uniform4fv(U.uColor,d.factor);gl.uniform1i(U.uHasTexture,!!d.texture);if(d.texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,d.texture);}d.double?gl.disable(gl.CULL_FACE):gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);bind(d.position,A.aPosition,3);bind(d.normal,A.aNormal,3);bind(d.colors,A.aColor,d.width);bind(d.joints,A.aJoints,4);bind(d.weights,A.aWeights,4);bind(d.uv,A.aUV,2);const draw=()=>{if(d.indices){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.indices);gl.drawElements(gl.TRIANGLES,d.count,gl.UNSIGNED_INT,0);}else gl.drawArrays(gl.TRIANGLES,0,d.count);};draw();if(d.bombOutline){gl.uniform1f(U.uOutline,span/sh*1.4);gl.uniform1i(U.uOutlinePass,1);gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);gl.depthMask(false);draw();gl.depthMask(true);gl.cullFace(gl.BACK);gl.uniform1f(U.uOutline,0);gl.uniform1i(U.uOutlinePass,0);}}
   });
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();dispose();});raf=requestAnimationFrame(frame);return dispose;
  }catch(e){dispose();throw e;}
 }
 MG.GuideActors={mount};
})(window);
