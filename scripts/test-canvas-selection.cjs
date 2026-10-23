const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.addInitScript(()=>{if(localStorage.getItem('fixture'))return;localStorage.setItem('fixture','1');localStorage.setItem('canvas-state',JSON.stringify({elements:[{id:'t',type:'text',text:'선택 테스트',fontSize:30,fill:'#000000',fontFamily:'Arial',zIndex:0,transform:{x:250,y:300,scale:1,rotation:0}},{id:'s',type:'shape',kind:'rect',width:80,height:60,fill:'#338855',stroke:'#000000',strokeWidth:1,opacity:1,zIndex:1,transform:{x:600,y:300,scale:1,rotation:0}}],lastModified:Date.now(),viewport:{x:0,y:0,scale:1}}));});
await p.goto(process.env.CANVAS_TEST_URL||'http://127.0.0.1:3012');await p.locator('canvas').first().waitFor();await p.waitForTimeout(800);
await p.keyboard.press('Control+a');await p.keyboard.press('Control+d');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')).elements.length===4);
await p.reload();await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('canvas-state')).elements.length),4);
await p.keyboard.press('Control+a');await p.keyboard.press('Delete');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')).elements.length===0);
await p.keyboard.press('Control+z');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')).elements.length===4);
console.log('PASS text/shape select-all, duplicate, reload, delete and undo');await b.close();})().catch(e=>{console.error(e);process.exitCode=1;});
