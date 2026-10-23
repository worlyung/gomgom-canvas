// 지도 갱신 뒤 실제 캔버스 연결을 검사해요. 유료 API는 호출하지 않아요.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1050}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.CANVAS_TEST_URL||'http://127.0.0.1:3000');
    await page.getByRole('button',{name:'지도 만들기',exact:true}).click();
    const frame=await (await page.locator('iframe[title="대한민국 지도 편집기"]').elementHandle()).contentFrame();
    await frame.waitForFunction(()=>typeof window.exportMapForCanvas==='function'&&document.querySelector('#map svg'));
    await frame.evaluate(()=>location.hash='sido-50');
    await frame.waitForFunction(()=>document.querySelector('#crumbs').textContent.includes('제주'));
    await frame.locator('#look [data-v="dots"]').click();
    await frame.waitForFunction(()=>!!document.querySelector('#map #도트'));
    await frame.locator('#look [data-v="regionDots"]').click();
    await frame.waitForFunction(()=>document.querySelectorAll('#map #도트 circle').length>=43,{},{timeout:30000});
    const before=await frame.locator('#map svg').getAttribute('viewBox');
    await frame.locator('#zoomIn').click();
    const zoomed=await frame.locator('#map svg').getAttribute('viewBox');
    assert(Number(zoomed.split(' ')[2])<Number(before.split(' ')[2]));
    await frame.locator('#map').scrollIntoViewIfNeeded();
    const box=await frame.locator('#map svg').boundingBox();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
    await page.mouse.down();await page.mouse.move(box.x+box.width*.5+70,box.y+box.height*.5+40,{steps:8});await page.mouse.up();
    assert.notEqual(await frame.locator('#map svg').getAttribute('viewBox'),zoomed);
    assert.equal(await frame.locator('#infoApply').count(),1);
    const output=process.env.MAP_TEST_OUTPUT||path.resolve('.tmp/map-studio-test');fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,'regional-dots.png')});
    await page.getByRole('button',{name:'캔버스에 넣기',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')||'{}').elements?.some(e=>e.type==='image'&&e.id.startsWith('map-')),{},{timeout:30000});
    assert.equal(await page.getByRole('dialog').count(),0);
    await page.screenshot({path:path.join(output,'map-imported.png')});
    await page.getByRole('button',{name:'실행취소',exact:true}).click();
    await page.waitForFunction(()=>!(JSON.parse(localStorage.getItem('canvas-state')||'{}').elements||[]).some(e=>e.id.startsWith('map-')));
    assert.deepEqual(errors,[]);
    console.log('PASS map studio: Jeju, dotted/43 regional points, zoom, pan, chart controls, PNG import and undo; zero page errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
