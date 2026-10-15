const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
(async()=>{const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage();await page.setViewport({width:390,height:884,isMobile:true,deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);let held=[];let release=false;
 page.on('request',r=>{if(!release&&r.url().endsWith('/assets/rhythm/bg-beach.jpg'))held.push(r);else r.continue();});
 await page.goto('http://localhost:8846/mole/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.splash-loading');
 const before=await page.evaluate(()=>{const e=document.querySelector('.splash-loading'),r=e.getBoundingClientRect();return {visible:getComputedStyle(e).display!=='none',text:e.textContent,ready:document.querySelector('#splash').classList.contains('is-ready'),x:r.x,y:r.y,right:r.right,bottom:r.bottom,animation:getComputedStyle(e.querySelector('.splash-loading-fill')).animationName};});
 assert(held.length>0);assert(before.visible&&!before.ready);assert.equal(before.text,'로딩 중…');assert(before.x>=0&&before.right<=390&&before.bottom<=884);assert.equal(before.animation,'splash-loading-slide');
 await page.screenshot({path:'review/splash-loading-v1130.png'});
 release=true;await Promise.all(held.map(r=>r.continue()));
 await page.waitForSelector('#splash.is-ready',{timeout:60000});
 assert.equal(await page.$eval('.splash-loading',e=>getComputedStyle(e).display),'none');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.splash-cta')).opacity==='1');
 assert.equal(await page.$eval('.splash-txt',e=>e.textContent),'GET NOW');
 await page.screenshot({path:'review/splash-ready-v1130.png'});
 await page.click('.splash-cta');await page.waitForFunction(()=>!document.querySelector('#splash')||document.querySelector('#splash').classList.contains('is-hiding'));
 assert.deepEqual(errors,[]);console.log('PASS held resource: loading indicator visible/in viewport, ready hides indicator and restores GET NOW, tap continues');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
