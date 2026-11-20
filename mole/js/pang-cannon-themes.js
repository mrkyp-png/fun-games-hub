/* Eight independent round looks; no original mini-game assets or settings are changed. */
(function(root){'use strict';
 const row=(id,ko,en,ground,rock,bank,cap,sky,far,motion)=>Object.freeze({id,ko,en,ground,rock,bank,cap,sky,far,motion});
 const themes=Object.freeze([
  row('beach','빙판 해안','ICY SHORE',[.88,.68,.34],[.31,.24,.16],[.66,.46,.19],[.96,.85,.56],[.35,.67,.94],[.03,.4,.7],'ocean')
 ]);
 // V1759 C: rounds 2-8 backgrounds removed by user request; every round uses the round-1 icy shore.
 const api={themes,forRound:n=>themes[Math.max(0,Math.min(themes.length-1,(n||1)-1))]};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.PangCannonThemes=api;
})(typeof window!=='undefined'?window:globalThis);
