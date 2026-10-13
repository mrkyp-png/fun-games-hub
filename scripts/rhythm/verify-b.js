const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
(async () => {
 const browser = await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:390,height:884});
  await page.goto('http://localhost:8844/mole/index.html',{waitUntil:'load'});
  await page.waitForSelector('#splash.is-ready'); await page.click('#splash');
  await page.waitForSelector('.intro-skip'); await page.click('.intro-skip');
  await new Promise(r=>setTimeout(r,14000));
  const button=await page.evaluateHandle(()=>Array.from(document.querySelectorAll('#lane-button-bar .lane-face--wide')).pop());
  await button.asElement().click();
  await page.waitForSelector('[data-rp-types]:not([hidden])'); await page.click('[data-rp-type=B]');
  await page.waitForSelector('[data-rp-select]:not([hidden])');await page.click('[data-rp-diff=EASY]');
  await page.waitForFunction(()=>window.__rhythmB.dbg()&&!window.__rhythmB.dbg().loading);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.rb-board img')).every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-circuit').length),18);
  assert.equal(await page.evaluate(()=>new Set(Array.from(document.querySelectorAll('.rb-circuit'),i=>i.src)).size),1);
  assert(await page.evaluate(()=>{const a=Array.from(document.querySelectorAll('.rb-circuit'),i=>i.getBoundingClientRect());return a.every(r=>Math.abs(r.width-a[0].width)<.01&&Math.abs(r.height-a[0].height)<.01);}));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-skeleton').length),1);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-mini').length),9);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-mini-face').length),0);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-mini-part').length),0);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-color').length),9);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-button-glow').length),9);
  assert(await page.evaluate(()=>{const z=s=>Number(getComputedStyle(document.querySelector(s)).zIndex);return z('.rb-skeleton')>z('.rb-button-glow')&&z('.rb-button-glow')>z('.rb-color')&&z('.rb-color')>z('.rb-circuit');}));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-button-glow svg, .rb-button-glow path').length),0);
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.rb-color')).every((el,i)=>{const r=el.getBoundingClientRect(),g=document.querySelectorAll('.rb-button-glow')[i].getBoundingClientRect();return Math.abs(r.x+r.width/2-g.x-g.width/2)<.05&&Math.abs(r.y+r.height/2-g.y-g.height/2)<.05&&r.width>g.width&&getComputedStyle(el).clipPath==='none';})));
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.rb-color')).every(el=>getComputedStyle(el).opacity==='0.2')));
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.rb-mini')).every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<.05;})));
  await page.evaluate(async()=>{const img=new Image();img.src='assets/rhythm-b/mini-user.png';await img.decode();});
  assert(await page.evaluate(()=>new Set(Array.from(document.querySelectorAll('.rb-mini'),el=>el.style.backgroundSize.split(' ')[1])).size===1));
  assert.equal(await page.evaluate(()=>document.querySelector('[data-rb-score]').textContent),'000000');
  assert.equal(await page.evaluate(()=>document.querySelector('[data-rb-combo]').textContent),'0');
  assert(await page.evaluate(()=>window.__rhythmB.dbg().notes.length>0));
  assert(await page.evaluate(()=>{const x=s=>document.querySelector(s).getBoundingClientRect().x;return x('.rb-status--score')<x('.rb-status--judge')&&x('.rb-status--judge')<x('.rb-status--combo')&&x('.rb-status--combo')<x('.rb-pause-button');}));
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.rb-mini')).every(el=>{const r=el.getBoundingClientRect(),board=document.querySelector('.rb-board').getBoundingClientRect();return el.children.length===0&&Math.abs(r.width/board.width*952-304)<.1&&Number(getComputedStyle(el).zIndex)<Number(getComputedStyle(document.querySelector('.rb-skeleton')).zIndex);})));
  assert(await page.evaluate(()=>{const board=document.querySelector('.rb-board').getBoundingClientRect(),xs=[[26,326],[326,626],[626,926]],ys=[[26,326],[326,626],[626,926]];return Array.from(document.querySelectorAll('.rb-mini')).every((el,i)=>{const r=el.getBoundingClientRect(),x=xs[i%3],y=ys[Math.floor(i/3)],cx=(r.x+r.width/2-board.x)/board.width*952,cy=(r.y+r.height/2-board.y)/board.height*2078;return Math.abs(cx-(x[0]+x[1])/2)<.1&&Math.abs(cy-(y[0]+y[1])/2)<.1&&r.width/board.width*952>x[1]-x[0]&&r.height/board.height*2078>y[1]-y[0];});}));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.rb-upper-glow').length),1);
  const centers=await page.evaluate(()=>{const board=document.querySelector('.rb-board').getBoundingClientRect(),xs=[[26,326],[326,626],[626,926]],ys=[[1056,1356],[1356,1656],[1656,1956]];return Array.from(document.querySelectorAll('.rb-circuit')).map((el,i)=>{const j=i%9,r=el.getBoundingClientRect(),x=xs[j%3],y=ys[Math.floor(j/3)];const cx=r.x+r.width*646/1281,cy=r.y+r.height*621/1228;const tx=i>=9?(x[0]+x[1])/2:176+(j%3)*300,ty=i>=9?(y[0]+y[1])/2:176+Math.floor(j/3)*300;return Math.abs((cx-board.x)/board.width-tx/952)<.001&&Math.abs((cy-board.y)/board.height-ty/2078)<.001;});});
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.rb-circuit')).every(el=>{const r=el.getBoundingClientRect(),b=document.querySelector('.rb-board').getBoundingClientRect();return Math.abs(r.width*1164/1281/b.width*952-244)<.1&&Math.abs(r.height*1116/1228/b.height*2078-244)<.1;})));
  assert(centers.every(Boolean)); assert.deepEqual(errors,[]);
  assert.equal(await page.$$eval('.rb-hit', els=>els.length),9);
  assert.equal(await page.$$eval('.rb-flow', els=>els.length),0);
  assert.equal(await page.$$eval('.rb-flow-canvas', els=>els.length),9);
  assert.equal(await page.evaluate(()=>window.__rhythmB.flowDebug().slots.length),27);
  assert(await page.$eval('.rb-mini',el=>getComputedStyle(el).filter==='none'&&getComputedStyle(el,'::after').backgroundImage.includes('radial-gradient')));
  await page.waitForFunction(()=>{const c=document.querySelector('.rb-flow-canvas');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
  assert(await page.evaluate(()=>window.__rhythmB.flowDebug().renderer==='canvas'));
  assert(await page.evaluate(()=>!document.querySelector('.rb-circuit').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))));
  assert(await page.evaluate(()=>!document.querySelector('.rb-circuit').dispatchEvent(new Event('dragstart',{bubbles:true,cancelable:true}))));
  assert.equal(await page.evaluate(()=>window.MoleGame.rhythmBCircuitRoutes.length),80);
  const buttonBox=await page.$eval('.rb-hit',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  const circuitBefore=await page.$$eval('.rb-circuit',els=>JSON.stringify(els[9].getBoundingClientRect()));
  const frameBefore=await page.$eval('.rb-skeleton',el=>JSON.stringify(el.getBoundingClientRect()));
  await page.mouse.move(buttonBox.x,buttonBox.y);await page.mouse.down();
  await new Promise(r=>setTimeout(r,100));
  assert(await page.$eval('.rb-color',el=>el.classList.contains('is-pressed')&&getComputedStyle(el).transform!=='none'));
  assert(await page.$eval('.rb-hit',el=>el.classList.contains('is-hit-flash')&&getComputedStyle(el,'::after').animationName==='rb-hit-flash'));
  assert.equal(await page.$eval('.rb-skeleton',el=>JSON.stringify(el.getBoundingClientRect())),frameBefore);
  assert.equal(await page.$$eval('.rb-circuit',els=>JSON.stringify(els[9].getBoundingClientRect())),circuitBefore);
  await (await page.$('.rb-board')).screenshot({path:'review/rhythm-b-pressed-v1040.png'});
  await page.mouse.up();await new Promise(r=>setTimeout(r,350));
  assert(await page.$eval('.rb-color',el=>!el.classList.contains('is-pressed')));
  assert(await page.$eval('.rb-hit',el=>!el.classList.contains('is-hit-flash')));
  await page.focus('.rb-hit');await page.keyboard.down('Space');
  assert(await page.$eval('.rb-color',el=>el.classList.contains('is-pressed')));
  await page.keyboard.up('Space');await new Promise(r=>setTimeout(r,350));
  assert(await page.$eval('.rb-color',el=>!el.classList.contains('is-pressed')));
  assert(await page.$eval('.rb-hit',el=>!el.classList.contains('is-hit-flash')));
  const el=await page.evaluateHandle(()=>document.querySelector('.rb-board'));
  await el.asElement().screenshot({path:'rhythm-b-skeleton-preview.png'});
  if (process.env.RB_CAPTURE_FRAMES==='1') {
   require('node:fs').mkdirSync('review/rb-effect-frames',{recursive:true});
   await page.mouse.move(buttonBox.x,buttonBox.y);
   for (let i=0;i<30;i++) {
    if(i===6)await page.mouse.down();if(i===10)await page.mouse.up();
    await el.asElement().screenshot({path:'review/rb-effect-frames/'+String(i).padStart(2,'0')+'.png'});
    await new Promise(r=>setTimeout(r,70));
   }
  }

  for (const [width,height] of [[360,800],[430,932]]) {
   await page.setViewport({width,height});
   assert(await page.evaluate(()=>{const els=Array.from(document.querySelectorAll('.rb-mini,.rb-color')),r=els[0].getBoundingClientRect();return els.every(el=>{const a=el.getBoundingClientRect();return Math.abs(a.width-r.width)<.001&&Math.abs(a.height-r.height)<.001;});}));
  }
  await page.setViewport({width:390,height:884});
  const pauseBox=await page.$eval('.rb-pause-button',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  const pauseFrameBefore=await page.$eval('.rb-pause-button',el=>JSON.stringify(el.getBoundingClientRect()));
  await page.mouse.move(pauseBox.x,pauseBox.y);await page.mouse.down();await new Promise(r=>setTimeout(r,100));
  assert.equal(await page.$eval('.rb-pause-button',el=>JSON.stringify(el.getBoundingClientRect())),pauseFrameBefore);
  assert(await page.$eval('.rb-pause-face',el=>getComputedStyle(el).transform!=='none'));
  await page.mouse.up();await page.waitForSelector('[data-rp-pause]:not([hidden])');
  assert(await page.evaluate(()=>window.__rhythmB.flowDebug().paused));
  const pausedImage=await page.$eval('.rb-flow-canvas',c=>c.toDataURL());
  await new Promise(r=>setTimeout(r,200));
  assert.equal(await page.$eval('.rb-flow-canvas',c=>c.toDataURL()),pausedImage);
  await page.click('[data-rp-resume]'); await page.waitForSelector('[data-rp-pause][hidden]');
  await page.click('.rb-pause-button'); await page.click('[data-rp-quit]');
  await page.waitForSelector('[data-rp-types]:not([hidden])');
  assert.equal(await page.evaluate(()=>window.__rhythmB.flowDebug().running),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: uniform 18 cells and centers at 3 viewport sizes; existing 18 circuits preserved; 9 mini boards square with square corners; 9 glass color boxes opacity .2; score/combo; shared A pause/resume/quit; no page errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
