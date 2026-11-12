/* Plaza ocean equations, projected toward a straight beach shoreline. Audio-clock driven. */
(function(root){
 'use strict';
 const VS=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
 const FS=`#version 300 es
precision highp float;
uniform vec2 uSize;uniform float uTime;uniform vec3 uSun;out vec4 frag;
float seaH(vec2 p,float t){return .06*sin(.55*p.x+1.1*t)+.04*sin(.8*p.y-.9*t+1.3)+.02*sin(.37*(p.x+p.y)+1.7*t);}
void main(){
 vec2 uv=vec2(gl_FragCoord.x/uSize.x,1.-gl_FragCoord.y/uSize.y);
 vec3 eye=vec3(0.,4.,0.),ray=vec3((uv.x-.5)*1.6,-(.045+uv.y*.55),-1.);
 float distance=-eye.y/ray.y;
 for(int j=0;j<2;j++){vec3 hit=eye+ray*distance;distance=(seaH(hit.xz,uTime)-eye.y)/ray.y;}
 vec3 world=eye+ray*distance;vec2 p=world.xz;float t=uTime;vec2 g=vec2(0.);
 const vec3 W[6]=vec3[6](vec3(.90,.42,.45),vec3(-.55,.83,.62),vec3(.20,-.98,.85),vec3(-.94,-.33,1.4),vec3(.70,.71,2.1),vec3(-.15,.99,3.0));
 for(int i=0;i<6;i++){vec2 dir=normalize(W[i].xy);float k=W[i].z,amp=.09/k;float ph=dot(dir,p)*k*1.3+t*sqrt(9.8*k)*.55+float(i)*1.7;float resolved=1.-smoothstep(1.,3.14159,fwidth(ph));g+=dir*cos(ph)*amp*k*1.3*resolved;}
 vec3 n=normalize(vec3(-g.x,1.,-g.y)),V=normalize(eye-world),Ls=uSun;
 // Only the shore-distance mapping differs from the plaza's circular island.
 float d=max(0.,(1.-uv.y)*22.);
 vec3 deep=vec3(.05,.34,.64),shallow=vec3(.18,.69,.78),body=mix(shallow,deep,smoothstep(.5,9.,d));
 vec3 sky=mix(vec3(.65,.83,.98),vec3(.36,.66,.94),clamp(reflect(-V,n).y,0.,1.));
 float fres=min(.38,.06+.94*pow(1.-max(0.,dot(n,V)),5.));vec3 c=mix(body,sky,fres);
 c+=vec3(1.,.97,.9)*pow(max(0.,dot(reflect(-Ls,n),V)),180.)*.32;
 float foam=smoothstep(0.,.9,.9-d)*(.6+.4*sin(d*6.-t*1.8+g.x*8.));
 c=mix(c,vec3(.96,.98,1.),clamp(foam,0.,1.)*.7);
 // Keep the plaza's blue/turquoise water rather than a broad sky-coloured band.
 float fog=smoothstep(26.,100.,length(eye-world))*.26;c=mix(clamp(c,0.,1.),vec3(.45,.72,.94),fog);
 c=mix(vec3(.51,.72,.86),c,smoothstep(0.,.10,uv.y));
 // Fade wholly inside the original sand, so no old photographic water leaks through.
 float horizonAlpha=smoothstep(0.,5./uSize.y,uv.y);
 float alpha=horizonAlpha*(1.-smoothstep(.94,1.,uv.y));frag=vec4(c,alpha);
}`;
 function create(holder){
  let canvas=null,gl=null,program=null,vao=null,U=null,ready=false,lost=false,failed=false,lastTime=0,lastDraw=-Infinity,width=1,height=1;
  function init(){
   try{
    if(!canvas){canvas=root.document.createElement('canvas');canvas.className='rp-beach-ocean';canvas.setAttribute('aria-hidden','true');holder.appendChild(canvas);
     canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;ready=false;});
     canvas.addEventListener('webglcontextrestored',()=>{lost=false;failed=false;init();resize(width,height);render(lastTime,true);});}
    gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false,stencil:false});if(!gl)throw Error('Beach ocean WebGL2 unavailable');
    const shaders=[];
    try{for(const [type,source] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,FS]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));}
     program=gl.createProgram();for(const s of shaders)gl.attachShader(program,s);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    }finally{for(const s of shaders)gl.deleteShader(s);}
    vao=gl.createVertexArray();U=Object.fromEntries(['Size','Time','Sun'].map(n=>[n,gl.getUniformLocation(program,'u'+n)]));ready=true;failed=false;canvas.hidden=false;
   }catch(e){failed=true;ready=false;if(canvas)canvas.hidden=true;console.warn('Beach ocean: static water fallback',e);}
  }
  function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);if(!ready)return;
   const ratio=Math.min(root.devicePixelRatio||1,1.25,800/width),pw=Math.max(1,Math.round(width*ratio)),ph=Math.max(1,Math.round(height*ratio));
   if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;lastDraw=-Infinity;}
  }
  function render(time,force=false){
   lastTime=Math.max(0,time);if(!ready&&!failed&&!lost){init();resize(width,height);}if(!ready||lost||root.document.hidden)return;
   if(!force&&lastTime>=lastDraw&&lastTime-lastDraw<1/30)return;lastDraw=lastTime;
   gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(vao);
   gl.uniform2f(U.Size,canvas.width,canvas.height);gl.uniform1f(U.Time,lastTime);
   const sun=root.MoleGame.Home3DRenderer?.sunDir(lastTime)||[.819152,.573576,0];gl.uniform3fv(U.Sun,sun);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function stop(){lastDraw=-Infinity;}
  return {resize,render,stop,dbg:()=>({ready,lost,failed,time:lastTime,width,height})};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmBeachOcean={create};
})(window);
