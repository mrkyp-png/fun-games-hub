/* Build collision bounds from the original posed GLB; source files stay unchanged. */
(function(root){'use strict';const node=typeof module!=='undefined'&&module.exports,R=node?require('./clay-rig-runtime'):root.StudioRig;
 function fromModel(model,runtime,worlds,parts,scale=.8){const head=model.json.nodes.findIndex(n=>n.name==='Head'),headNodes=new Set(),palettes=new Map(),headBox={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},bodyBox={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  function visit(i){headNodes.add(i);for(const c of model.json.nodes[i].children||[])visit(c);}visit(head);
  function include(box,p){for(let k=0;k<3;k++){box.min[k]=Math.min(box.min[k],p[k]);box.max[k]=Math.max(box.max[k],p[k]);}}
  for(const item of parts){const n=model.json.nodes[item.node],p=item.primitive,positions=R.accessor(model,p.attributes.POSITION),joints=p.attributes.JOINTS_0===undefined?null:R.accessor(model,p.attributes.JOINTS_0),weights=joints?R.accessor(model,p.attributes.WEIGHTS_0):null;if(!palettes.has(item.node))palettes.set(item.node,R.palette(runtime,worlds,item.node));const palette=palettes.get(item.node);
   for(let i=0;i<positions.length/3;i++){let point=Array.from(positions.subarray(i*3,i*3+3)),headWeight=headNodes.has(item.node)?1:0;if(palette){const js=joints.subarray(i*4,i*4+4),ws=weights.subarray(i*4,i*4+4);point=R.skinPoint(point,js,ws,palette);for(let k=0;k<4;k++)if(headNodes.has(runtime.skins[n.skin].joints[js[k]]))headWeight+=ws[k];}point=R.point(worlds[item.node],point);include(headWeight>.5?headBox:bodyBox,point);}
  }
  if(!headBox.min.every(Number.isFinite)||!bodyBox.min.every(Number.isFinite))throw Error('Original mole collision bounds missing');const lift=-Math.min(headBox.min[1],bodyBox.min[1])*scale;
  function shape(box){return{center:box.min.map((x,k)=>(x+box.max[k])/2*scale+(k===1?lift:0)),half:box.min.map((x,k)=>(box.max[k]-x)/2*scale+.025)};}
  const h=shape(headBox),b=shape(bodyBox);return{headCenter:[-h.center[0],h.center[1],-h.center[2]],headHalf:h.half,bodyCenter:[-b.center[0],b.center[1],-b.center[2]],bodyHalf:b.half,renderScale:scale,renderLift:lift};
 }
 const api={fromModel};if(node)module.exports=api;else root.MoleGame.PangCannonShapes=api;
})(typeof window!=='undefined'?window:globalThis);
