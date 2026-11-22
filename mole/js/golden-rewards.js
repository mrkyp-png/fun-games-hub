/* Rare loot is additional to the golden mole's existing score and coins. */
(function(root){'use strict';
 const MG=root.MoleGame;
 const TABLE=Object.freeze([
  Object.freeze({kind:'weapon',id:'cannon',chance:0.001}),
  Object.freeze({kind:'weapon',id:'goldhammer',chance:0.0001}),
  Object.freeze({kind:'weapon',id:'alipunch',chance:0.00001}),
  Object.freeze({kind:'skill',ids:Object.freeze(['shield','targeting','ai']),chance:0.005})
 ]);
 const names={cannon:['팡팡 캐논','Pang Pang Cannon'],goldhammer:['골드 묠니르','Gold Mjolnir'],alipunch:['돌주먹','Stone Fist'],shield:['보호막','Shield'],targeting:['타겟팅','Targeting'],ai:['AI','AI']};
 function roll(random=Math.random){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('Loot random value must be in [0, 1)');let end=0;
  for(const entry of TABLE){end+=entry.chance;if(value<end){const id=entry.id||entry.ids[Math.min(entry.ids.length-1,Math.floor(random()*entry.ids.length))];return{kind:entry.kind,id,count:1};}}return null;
 }
 function award(result,random=Math.random){if(!result||!result.golden||!result.done||result._goldenLootRolled)return null;result._goldenLootRolled=true;const reward=roll(random);if(!reward)return null;
  const lang=root.FGH&&root.FGH.I18N&&root.FGH.I18N.lang||'ko',ko=lang==='ko';
  const id='golden-'+(root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const mail={id,title:ko?'황금 두더지 당첨 선물':'Golden mole prize',description:name(reward,lang)+(ko?' 1개에 당첨되었습니다. 수령하면 보관함에 지급됩니다.':' ×1 won! Claim to add it to your inventory.'),mailType:'golden',rewardType:'item',rewardAmount:reward.count,rewardItem:{kind:reward.kind,id:reward.id},expireAt:0};
  if(!MG.Mailbox||!MG.Mailbox.send(mail))return{error:'보상 메일 저장 실패',reward};return Object.assign({mailId:id},reward);
 }
 function name(reward,lang){return names[reward.id][lang==='ko'?0:1];}
 MG.GoldenRewards={TABLE,roll,award,name};
})(window);
