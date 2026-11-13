/* Restrained physical light guides inside the existing rhythm doorway. No collision geometry. */
(function(root){'use strict';
 const L=root.MoleGame.Home3DLayout,site=L.SITES.find(s=>s.id==='rhythm');
 function approach(view,height=0){if(height>.45)return 0;const p=L.doorCoordinates(site,view.x,view.z);return Math.max(0,Math.min(1,(2.6-p.along)/1.7))*Math.max(0,Math.min(1,(.85-Math.abs(p.side))/.5))*(p.along>-.3?1:0);}
 function geometry(){
  const positions=[],normals=[],colors=[],uvs=[],indices=[],d=Math.hypot(site.x,site.z),front=[-site.x/d,-site.z/d],right=[-front[1],front[0]],origin=[site.x+front[0]*.9,site.z+front[1]*.9],depth=1.28;
  const point=([x,y,z])=>[origin[0]+right[0]*x-front[0]*z,y,origin[1]+right[1]*x-front[1]*z];
  function tube(path,radius,alpha,closed){const base=positions.length/3,N=6,count=path.length;
   for(let i=0;i<count;i++){const a=path[closed?(i+count-1)%count:Math.max(0,i-1)],b=path[closed?(i+1)%count:Math.min(count-1,i+1)],v=b.map((x,k)=>x-a[k]),len=Math.hypot(...v),t=v.map(x=>x/len),seed=Math.abs(t[2])<.8?[0,0,1]:[1,0,0],u=[t[1]*seed[2]-t[2]*seed[1],t[2]*seed[0]-t[0]*seed[2],t[0]*seed[1]-t[1]*seed[0]],ul=Math.hypot(...u);for(let k=0;k<3;k++)u[k]/=ul;const w=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]];
    for(let j=0;j<N;j++){const angle=j*2*Math.PI/N,n=u.map((x,k)=>x*Math.cos(angle)+w[k]*Math.sin(angle));positions.push(...point(path[i].map((x,k)=>x+n[k]*radius)));normals.push(right[0]*n[0]-front[0]*n[2],n[1],right[1]*n[0]-front[1]*n[2]);colors.push(.60,.96,.88,alpha);uvs.push(path[i][2]/depth,i/(count-1));}
   }
   for(let i=0;i<(closed?count:count-1);i++)for(let j=0;j<N;j++){const a=base+i*N+j,b=base+i*N+(j+1)%N,c=base+(i+1)%count*N+j,e=base+(i+1)%count*N+(j+1)%N;indices.push(a,b,c,b,e,c);}
  }
  const frames=[];
  for(let i=0;i<3;i++){const z=i*.59,half=.728-i*.012,bottom=.144,top=2.49,r=.12,path=[];for(const [cx,cy,start]of [[half-r,top-r,0],[-half+r,top-r,Math.PI/2],[-half+r,bottom+r,Math.PI],[half-r,bottom+r,Math.PI*1.5]])for(let j=0;j<9;j++){const a=start+j*Math.PI/16;path.push([cx+r*Math.cos(a),cy+r*Math.sin(a),z]);}tube(path,.013,i===0?.82:.67,true);frames.push({depth:z,width:half*2,bottom,top});}
  // Two flush floor guides; a short light segment travels inward, keeping the walking centre clear.
  for(const x of [-.51,.51]){const path=[];for(let i=0;i<=24;i++)path.push([x,.141,depth*i/24]);tube(path,.012,.65,false);}
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),colors:new Float32Array(colors),uvs:new Float32Array(uvs),indices:new Uint32Array(indices),frames,depth};
 }
 root.MoleGame.RhythmTunnel={geometry,approach};
 if(typeof module!=='undefined')module.exports=root.MoleGame.RhythmTunnel;
})(typeof window!=='undefined'?window:globalThis);
