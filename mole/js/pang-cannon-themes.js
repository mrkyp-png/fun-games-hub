/* Eight independent round looks; no original mini-game assets or settings are changed. */
(function(root){'use strict';
 const row=(id,ko,en,ground,rock,bank,cap,sky,far,motion)=>Object.freeze({id,ko,en,ground,rock,bank,cap,sky,far,motion});
 const themes=Object.freeze([
  row('beach','빙판 해안','ICY SHORE',[.88,.68,.34],[.31,.24,.16],[.66,.46,.19],[.96,.85,.56],[.35,.67,.94],[.03,.4,.7],'ocean'),
  row('ice','얼음','ICE',[.79,.89,.98],[.12,.19,.3],[.025,.42,.68],[.95,.97,1],[.52,.74,.94],[.18,.55,.72],'snow'),
  row('desert','사막','DESERT',[.87,.48,.17],[.42,.19,.08],[.65,.32,.11],[.92,.62,.28],[.9,.63,.37],[.66,.37,.15],'sand'),
  row('cave','동굴','CAVE',[.09,.08,.15],[.15,.12,.25],[.19,.2,.38],[.35,.5,.7],[.055,.04,.11],[.12,.07,.25],'crystal'),
  row('volcano','화산','VOLCANO',[.12,.065,.055],[.075,.05,.055],[.19,.075,.035],[.28,.12,.065],[.27,.095,.07],[1,.15,.01],'lava'),
  row('sky','하늘','SKY',[.73,.84,.98],[.28,.4,.57],[.64,.8,.98],[.97,.98,1],[.21,.49,.88],[.64,.81,1],'cloud'),
  row('space','우주','SPACE',[.16,.16,.23],[.23,.21,.31],[.21,.19,.33],[.35,.34,.45],[.012,.008,.045],[.12,.06,.24],'stars'),
  row('storm','폭풍 바다','STORM SEA',[.26,.29,.32],[.12,.16,.22],[.17,.23,.3],[.38,.44,.48],[.16,.24,.35],[.02,.17,.3],'storm')
 ]);
 const api={themes,forRound:n=>themes[Math.max(0,Math.min(7,(n||1)-1))]};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoleGame.PangCannonThemes=api;
})(typeof window!=='undefined'?window:globalThis);
