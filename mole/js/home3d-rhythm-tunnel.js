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
  for(let i=0;i<1;i++){const z=i*.59,half=.728-i*.012,bottom=.144,top=2.49,r=.12,path=[];for(const [cx,cy,start]of [[half-r,top-r,0],[-half+r,top-r,Math.PI/2],[-half+r,bottom+r,Math.PI],[half-r,bottom+r,Math.PI*1.5]])for(let j=0;j<9;j++){const a=start+j*Math.PI/16;path.push([cx+r*Math.cos(a),cy+r*Math.sin(a),z]);}tube(path,.013,i===0?.82:.67,true);frames.push({depth:z,width:half*2,bottom,top});}
  // Two flush floor guides; a short light segment travels inward, keeping the walking centre clear.
  // Recess both ends inside the outer/inner frame, including the tube radius.
  const guideStart=.04,guideEnd=1.14;
  for(const x of [-.51,.51]){const path=[];for(let i=0;i<=24;i++)path.push([x,.141,guideStart+(guideEnd-guideStart)*i/24]);tube(path,.012,.65,false);}
  // Single outer glass panel retracts below the floor; middle/inner doors removed.
  const field={positions:[],normals:[],colors:[],uvs:[],indices:[]};
  for(let i=0;i<1;i++){const side=0;
   const z=i*.59+.035,half=.728-i*.012,left=-half,rightEdge=half;
   function solid(x0,x1,y0,y1,z0,z1,trim){
    const corners=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    for(const [ids,n,edge]of [[[0,1,2,3],[0,0,-1],0],[[5,4,7,6],[0,0,1],0],[[4,0,3,7],[-1,0,0],1],[[1,5,6,2],[1,0,0],1],[[3,2,6,7],[0,1,0],1],[[4,5,1,0],[0,-1,0],1]]){
     const base=field.positions.length/3;
     for(const id of ids){const c=corners[id];field.positions.push(...point(c));field.normals.push(right[0]*n[0]-front[0]*n[2],n[1],right[1]*n[0]-front[1]*n[2]);field.colors.push(side,half,i/2,trim?2:edge);field.uvs.push((c[0]/half+1)/2,(c[1]-.144)/2.346);}
     field.indices.push(base,base+1,base+2,base,base+2,base+3);
    }
   }
   solid(left,rightEdge,.144,2.49,z-.025,z+.025,false);
   // One continuous solid border: no decorative channels or gaps.
   for(let ring=0;ring<1;ring++){
    const w=.045,x0=left,x1=rightEdge,y0=.144,y1=2.49,thick=.037;
    solid(x0,x0+w,y0,y1,z-thick,z+thick,true);solid(x1-w,x1,y0,y1,z-thick,z+thick,true);
    solid(x0+w,x1-w,y0,y0+w,z-thick,z+thick,true);solid(x0+w,x1-w,y1-w,y1,z-thick,z+thick,true);
   }
  }
  for(const k of ['positions','normals','colors','uvs'])field[k]=new Float32Array(field[k]);field.indices=new Uint32Array(field.indices);
  return {field,positions:new Float32Array(positions),normals:new Float32Array(normals),colors:new Float32Array(colors),uvs:new Float32Array(uvs),indices:new Uint32Array(indices),frames,depth};
 }
 function noteGeometry(){
  const positions=[],normals=[],indices=[];
  function quad(points,n){const base=positions.length/3;for(const p of points){positions.push(...p);normals.push(...n);}indices.push(base,base+1,base+2,base,base+2,base+3);}
  function box(x0,x1,y0,y1){const z0=-.022,z1=.022;quad([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[0,0,-1]);quad([[x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1]],[0,0,1]);quad([[x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1]],[-1,0,0]);quad([[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],[1,0,0]);quad([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],[0,1,0]);quad([[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0]],[0,-1,0]);}
  // Rounded extruded note head and a solid stem/flag; final half-size footprint.
  for(let j=0;j<=8;j++)for(let k=0;k<=16;k++){const a=j*Math.PI/8,b=k*Math.PI/8,n=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];positions.push(-.055+n[0]*.095,-.19+n[1]*.06,n[2]*.035);const q=[n[0]/.095,n[1]/.06,n[2]/.035],l=Math.hypot(...q);normals.push(...q.map(v=>v/l));}
  for(let j=0;j<8;j++)for(let k=0;k<16;k++){const a=j*17+k,b=a+17;indices.push(a,b,a+1,a+1,b,b+1);}
  box(.015,.045,-.19,.235);box(.045,.17,.19,.235);
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint32Array(indices)};
 }
 root.MoleGame.RhythmTunnel={geometry,approach,noteGeometry};
 if(typeof module!=='undefined')module.exports=root.MoleGame.RhythmTunnel;
})(typeof window!=='undefined'?window:globalThis);
