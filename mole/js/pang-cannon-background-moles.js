/* Reusable ascending jump. A missed mole leaves the screen and never falls back. */
(function(root){'use strict';
 function sample(age,index=0,{speed=12,hiddenDepth=6.5}={}){return{active:age>=0&&age<12,progress:Math.min(1,Math.max(0,age)/.75),lift:-hiddenDepth+Math.max(0,age)*speed};}
 function bounds(m,shape){const centers=[shape.headCenter,shape.bodyCenter],halves=[shape.headHalf||[shape.headRadius,shape.headRadius,shape.headRadius],shape.bodyHalf],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<2;k++)for(let i=0;i<3;i++){min[i]=Math.min(min[i],m.pos[i]+centers[k][i]-halves[k][i]);max[i]=Math.max(max[i],m.pos[i]+centers[k][i]+halves[k][i]);}min[1]=Math.max(min[1],m.hole.pos[1]+m.hole.radius*.16);return min[1]<max[1]?{min,max}:null;}
 const api={sample,bounds};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.PangCannonBackgroundMoles=api;
})(typeof window!=='undefined'?window:globalThis);
