const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const data=new Map(),storage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
const w={localStorage:storage,MoleGame:{Economy:{addCoins(){},addHearts(){},addTickets(){}},Skills:{activeSkills:()=>[],addQuantity(){}}},FGH:{I18N:{lang:'ko'}},crypto:{randomUUID:(()=>{let n=0;return()=>String(++n)})()},location:{hostname:'example.test',protocol:'https:'},CustomEvent:class{},dispatchEvent(){}};
const c={window:w,console,Date,Math,Set,Number,JSON};vm.createContext(c);
for(const file of ['item-inventory.js','mailbox.js','golden-rewards.js'])vm.runInContext(fs.readFileSync('mole/js/'+file,'utf8'),c);
const MG=w.MoleGame,G=MG.GoldenRewards,MB=MG.Mailbox,Inv=MG.ItemInventory;
assert.deepEqual(Array.from(G.TABLE.slice(0,3),x=>[x.id,x.chance]),[['cannon',.001],['goldhammer',.0001],['alipunch',.00001]]);
for(const [p,id] of [[.0005,'cannon'],[.00105,'goldhammer'],[.001105,'alipunch']])assert.equal(G.roll(()=>p).id,id);
assert.equal(G.roll(()=>.9),null);for(const [p,id] of [[0,'shield'],[.5,'targeting'],[.99,'ai']]){let n=0;assert.equal(G.roll(()=>n++?p:.002).id,id);}
assert.equal(G.award({golden:false,done:true},()=>{throw Error('must not roll')}),null);
assert.equal(Inv.owns('weapon','cannon'),false);const result={golden:true,done:true};const reward=G.award(result,()=>0);assert(reward.mailId);assert.equal(Inv.owns('weapon','cannon'),false,'winning only sends mail');assert.equal(MB.list()[0].rewardItem.id,'cannon');assert.equal(G.award(result,()=>0),null,'same completed hit is not rolled twice');
assert(MB.claim(reward.mailId));assert(Inv.owns('weapon','cannon'));assert.equal(MB.claim(reward.mailId),null,'claimed mail cannot grant again');assert.equal(Inv.materials('weapon','cannon'),0);
const second=G.award({golden:true,done:true},()=>0);const normalSet=storage.setItem;let fail=true;storage.setItem=(k,v)=>{if(k==='mole.mailbox'&&fail){fail=false;throw Error('mail save failure')}normalSet(k,v)};assert(MB.claim(second.mailId));assert.equal(Inv.materials('weapon','cannon'),1);storage.setItem=normalSet;assert(MB.claim(second.mailId));assert.equal(Inv.materials('weapon','cannon'),1,'retry after mailbox save failure must not duplicate reward');
let n=0;const skill=G.award({golden:true,done:true},()=>n++?.99:.002);assert.equal(skill.kind,'skill');const before=JSON.parse(data.get('mole.skill.inventory')||'{}').ai||0;assert(MB.claim(skill.mailId));assert.equal(JSON.parse(data.get('mole.skill.inventory')).ai,before+1);
const missing=MB.send({id:'invalid-item',rewardType:'item',rewardAmount:1,rewardItem:{kind:'weapon',id:'invalid'}});assert(missing);assert.equal(MB.claim('invalid-item'),null);assert(!MB.list().find(m=>m.id==='invalid-item').isClaimed);
for(const mail of MB.list().filter(m=>m.rewardType==='item'&&m.id!=='invalid-item'))assert(fs.existsSync('mole/'+MB.rewardIcon(mail)));
console.log('PASS exact weapon odds, rare/no-win boundaries, random consumables, mail-only delivery, claim once, interrupted-mail-save retry, duplicate weapons become materials, skill grant, invalid rewards remain unclaimed, item icon paths');
