/* Shared 3D surface effects. Ocean wave coefficients match RhythmBeachOcean. */
(function(root){'use strict';
 const vertex=`
uniform float sceneTime;uniform int sceneSurface,sceneTheme;
vec3 scenePosition(vec3 p){
 if(sceneSurface==1){if(sceneTheme==0||sceneTheme==7)p.y+=.06*sin(.55*p.x+1.1*sceneTime)+.04*sin(.8*p.z-.9*sceneTime+1.3)+.02*sin(.37*(p.x+p.z)+1.7*sceneTime);}
 if(sceneSurface==2){float speed=sceneTheme==7?17.:sceneTheme==3?3.:.8;p.y=mod(p.y-sceneTime*speed+100.,70.)-4.;p.x+=sin(p.z*.8+sceneTime*.35)*1.3;if(sceneTheme==2){p.x=mod(p.x+sceneTime*4.+40.,80.)-40.;p.y=mod(p.y,16.)+.4;}}
 return p;
}`;
 const fragment=`
uniform float sceneTime;uniform int sceneSurface,sceneTheme,paletteRole;
uniform vec3 groundTint,rockTint,bankTint,capTint,skyTint,farTint;
float sceneHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sceneNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(sceneHash(i),sceneHash(i+vec2(1.,0.)),f.x),mix(sceneHash(i+vec2(0.,1.)),sceneHash(i+vec2(1.,1.)),f.x),f.y);}
vec3 sceneAlbedo(vec3 base){if(paletteRole==1)return groundTint;if(paletteRole==2)return rockTint*(.9+.1*clamp(C.g/.16,0.,1.));if(paletteRole==3)return capTint;if(paletteRole==4)return C.b-C.r>.25?bankTint:capTint;if(paletteRole==5)return C.b-C.r>.25?bankTint:capTint;return base;}
vec3 sceneFar(){float t=sceneTime;vec2 p=W.xz;
 if(sceneTheme==0||sceneTheme==7){vec2 g=vec2(0.);const vec3 waves[6]=vec3[6](vec3(.90,.42,.45),vec3(-.55,.83,.62),vec3(.20,-.98,.85),vec3(-.94,-.33,1.4),vec3(.70,.71,2.1),vec3(-.15,.99,3.0));for(int i=0;i<6;i++){vec2 d=normalize(waves[i].xy);float k=waves[i].z,phase=dot(d,p)*k*1.3+t*sqrt(9.8*k)*.55+float(i)*1.7;float resolved=1.-smoothstep(1.,3.14159,fwidth(phase));g+=d*cos(phase)*.09*1.3*resolved;}
 vec3 n=normalize(vec3(-g.x,1.,-g.y)),v=normalize(vec3(0.,28.,-24.)-W);float fres=min(.38,.06+.94*pow(1.-max(0.,dot(n,v)),5.));vec3 body=mix(farTint*1.5,farTint,smoothstep(106.,170.,W.z));body=mix(body,skyTint,fres);body+=vec3(1.,.97,.9)*pow(max(0.,dot(reflect(-normalize(vec3(-.4,.9,-.5)),n),v)),100.)*.24;float shore=1.-smoothstep(106.,112.,W.z);float foam=shore*(.55+.45*sin((W.z-106.)*3.-t*1.8+g.x*8.));return mix(body,vec3(.94,.98,1.),foam*.8);}
 if(sceneTheme==4){vec2 uv=p*.045+vec2(t*.025,-t*.04);float flow=.6*sceneNoise(uv)+.3*sceneNoise(uv*2.03+vec2(.3*sin(t*.13),.2))+.1*sceneNoise(uv*4.1);float aa=max(.025,fwidth(flow)),veins=1.-smoothstep(.045,.15+aa,abs(flow-.5));vec2 cell=floor(p*.12),f=fract(p*.12)-.5;float pulse=.5+.5*sin(t*1.4+sceneHash(cell)*6.28),bubble=(1.-smoothstep(.02,.11,length(f)))*step(.82,sceneHash(cell))*pulse;return mix(vec3(.14,.018,.008),farTint,veins*.9)+vec3(1.,.55,.04)*bubble*.35;}

 if(sceneTheme==3){float glow=.5+.5*sin(t*.9+p.x*.1);return farTint*(.55+.45*glow);}
 if(sceneTheme==2){float dune=.5+.5*sin(p.y*.11+sin(p.x*.08)*2.+t*.06);return farTint*(.8+.2*dune);}
 if(sceneTheme==6){float stars=step(.996,sceneHash(floor(p*.7+vec2(t*.08,0.))));return farTint*.35+vec3(stars)*(.7+.3*sin(t+p.x));}
 return farTint*(.92+.08*sin(p.x*.12+p.y*.1+t*.16));
}
vec3 sceneSky(){float horizon=clamp(W.y/180.,0.,1.);vec3 c=skyTint*(1.-.3*horizon);if(sceneTheme==6){vec2 grid=floor(W.xy*.3+vec2(sceneTime*.01,0.));float star=step(.992,sceneHash(grid));c+=vec3(star)*(.65+.35*sin(sceneTime+grid.x));}return c;}
`;
 function build(){const mesh=(p,n)=>({positions:new Float32Array(p),normals:new Float32Array(n)}),far=[],normals=[];for(let z=106;z<360;z+=4)for(let x=-300;x<300;x+=6)for(const [dx,dz]of [[0,0],[6,4],[6,0],[0,0],[0,4],[6,4]]){far.push(x+dx,-.18,z+dz);normals.push(0,1,0);}const weather=[],wn=[];for(let i=0;i<90;i++){const x=Math.sin(i*35.7)*25,y=(i*7.73)%70,z=5+(i*13.17)%95;for(const [dx,dy]of [[-.045,0],[.045,0],[.045,.8],[-.045,0],[.045,.8],[-.045,.8]]){weather.push(x+dx,y+dy,z);wn.push(0,0,-1);}}return{far:mesh(far,normals),sky:mesh([-800,-100,380,800,-100,380,800,300,380,-800,-100,380,800,300,380,-800,300,380],Array(6).fill([0,0,-1]).flat()),weather:mesh(weather,wn)};}
 const api={vertex,fragment,build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.PangCannonSceneFx=api;
})(typeof window!=='undefined'?window:globalThis);
