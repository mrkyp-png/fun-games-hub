/* Actual clay meshes. No background painting or camera-projected material. */
(function(root){'use strict';
 const Rock=typeof module!=='undefined'&&module.exports?require('./pang-cannon-rock'):root.MoleGame.PangCannonRock;
 const data=()=>({positions:[],normals:[],colors:[]});
 const unit=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
 function vertex(out,p,n,c){out.positions.push(...p);out.normals.push(...n);out.colors.push(...c,1);}
 function surface(out,point,rows,cols,color){for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)for(const [x,y]of [[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]]){const u=x/cols,v=y/rows,p=point(u,v),e=.0001,vn=Math.max(e,Math.min(1-e,v)),pn=point(u,vn),a=point(u+e,vn).map((x,k)=>x-pn[k]),b=point(u,vn+e).map((x,k)=>x-pn[k]),n=unit([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);vertex(out,p,n,typeof color==='function'?color(u,v,p):color);}}
 function packed(d){return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,new Float32Array(v)]));}
 function build(A){
  const snow=[.79,.89,.98],ice=[.025,.42,.68],dark=[.09,.15,.24],ground=data(),groundFlat=data(),decor=data(),rock=data(),cap=data(),rim=data(),opening=data();
  const holes=A.layout().holes;for(let z=-50;z<106;z+=1)for(let x=-200;x<200;x+=1)for(const tri of [[[0,0],[1,1],[1,0]],[[0,0],[0,1],[1,1]]]){const cx=x+tri.reduce((n,p)=>n+p[0],0)/3,cz=z+tri.reduce((n,p)=>n+p[1],0)/3;for(const [dx,dz]of tri){const px=x+dx,pz=z+dz;vertex(groundFlat,[px,A.heightAt(px,pz),pz],A.normalAt(px,pz),snow);}if(holes.some(h=>tri.some(([dx,dz])=>A.holeDistance(h,x+dx,z+dz)<h.radius*.70)))continue;for(const [dx,dz]of tri){const px=x+dx,pz=z+dz;vertex(ground,[px,A.heightAt(px,pz),pz],A.normalAt(px,pz),snow);}}
  const stone=Rock.build();rock.positions.push(...stone.mesh.positions);rock.normals.push(...stone.mesh.normals);rock.colors.push(...stone.mesh.colors);
  surface(cap,stone.point,16,64,[.95,.96,.9]);
  // Rounded snow lip closes the exposed edge, giving the snow real thickness.
  surface(cap,(u,v)=>{const edge=stone.point(u,1),a=u*Math.PI*2,b=v*Math.PI*2;return[edge[0]+Math.cos(a)*Math.cos(b)*.045,edge[1]+Math.sin(b)*.045,edge[2]+Math.sin(a)*Math.cos(b)*.045];},8,64,[.95,.96,.9]);
  surface(rim,(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI*2,r=.8+.22*Math.cos(b);return[Math.cos(a)*r,.1+.1*Math.sin(b),Math.sin(a)*r];},10,48,(u,v)=>v<.5?[.83,.94,.98]:ice);
  rim.normals=rim.normals.map(x=>-x);
  // A recessed bowl, rather than a black flat decal, forms the mouth of each tunnel.
  surface(opening,(u,v)=>{const a=u*Math.PI*2,r=v*.82;return[Math.cos(a)*r,-.035-.23*(1-v*v),Math.sin(a)*r];},10,48,dark);
  // Snow-capped ice banks stay on the outer edges; the foreground firing lane is clear.
  for(const side of [-1,1])for(let i=0;i<13;i++){const z=10+i*7,x=side*(28+i*.16+(i%2)*1.8),h=2+(i%3)*.7,rx=4.4+(i%3)*.4,rz=4.5,base=A.heightAt(x,z);
   surface(decor,(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI;return[x+rx*Math.sin(b)*Math.cos(a),base+h*(1+Math.cos(b)),z+rz*Math.sin(b)*Math.sin(a)];},10,20,ice);
   surface(decor,(u,v)=>{const a=u*Math.PI*2,b=v*(1.1+.09*Math.sin(a*5));return[x+rx*1.02*Math.sin(b)*Math.cos(a),base+h*(1.04+Math.cos(b)),z+rz*1.02*Math.sin(b)*Math.sin(a)];},8,24,[.92,.96,1]);
  }
  return Object.fromEntries(Object.entries({ground,groundFlat,decor,rock,cap,rim,opening}).map(([k,v])=>[k,packed(v)]));
 }
 const api={build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.PangCannonEnvironment=api;
})(typeof window!=='undefined'?window:globalThis);
