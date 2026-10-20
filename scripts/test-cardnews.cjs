// Run against a local production build. No paid image generation: /api/generate is mocked.
// PLAYWRIGHT_MODULE points to an existing Playwright install when not installed here.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { unzipSync } = require(process.env.FFLATE_MODULE || 'fflate');
const out = process.env.CARDNEWS_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(),'cardnews-'));
fs.mkdirSync(out,{recursive:true});
const base=process.env.CARDNEWS_TEST_URL || 'http://127.0.0.1:3009';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // This inherited Vercel-only analytics script redirects to HTML on a local server.
  await page.route('**/_vercel/**',route=>route.fulfill({contentType:'application/javascript',body:''}));
  let paidCalls=0;
  await page.route('**/api/generate',async route=>{paidCalls++; await route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'테스트용 생성 실패'})});});
  const click=label=>page.getByRole('button',{name:label,exact:true}).click();
  const download=async(label,name)=>{const p=page.waitForEvent('download');await click(label);const d=await p;const f=path.join(out,name||d.suggestedFilename());await d.saveAs(f);return f;};
  try {
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('canvas').first().waitFor({state:'attached',timeout:60000});
    await click('카드뉴스 만들기');
    await page.getByLabel('안내선과 자동 맞춤').uncheck();
    await page.getByLabel('카드뉴스 이름').fill('행사 안내 카드뉴스');
    await page.getByLabel('선택한 글씨 내용').fill('봄날의 음악회\n함께 만나요');
    await page.getByLabel('글자 색상').fill('#f4edc5');
    const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');x.fillStyle='#357466';x.fillRect(0,0,900,600);x.fillStyle='#e3a23c';x.fillRect(450,0,450,600);return c.toDataURL('image/png');});
    const payload={name:'existing-photo.png',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')};
    await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').setInputFiles(payload);
    await page.getByText('사진을 바꿨어요. 글씨는 그대로예요.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('선택한 글씨 내용').inputValue(),'봄날의 음악회\n함께 만나요');
    await page.getByLabel('사진 확대').fill('1.5');
    await page.getByLabel('사진 좌우 위치').fill('75');
    await page.getByLabel('사진 어둡게',{exact:true}).fill('25');
    // Drag selected title on the real preview.
    const preview=page.getByRole('dialog').locator('main canvas');const box=await preview.boundingBox();
    const beforeDrag=await preview.evaluate(c=>c.toDataURL());
    await page.mouse.move(box.x+150/1080*box.width,box.y+700/1350*box.height);
    await page.mouse.down();
    await page.mouse.move(box.x+170/1080*box.width,box.y+710/1350*box.height,{steps:6});
    await preview.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const duringDrag=await preview.evaluate(c=>c.toDataURL());assert.notEqual(duringDrag,beforeDrag,'preview must move before pointer release');
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),80,'draft is committed only on release');
    await page.mouse.move(box.x+190/1080*box.width,box.y+720/1350*box.height,{steps:6});
    await preview.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.notEqual(await preview.evaluate(c=>c.toDataURL()),duringDrag,'preview must track successive moves');
    await page.screenshot({path:path.join(out,'cardnews-drag-held.png')});
    await page.mouse.up();
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),120);
    await click('되돌리기');
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),80,'one undo must restore the whole drag');
    await page.mouse.move(box.x+150/1080*box.width,box.y+700/1350*box.height);await page.mouse.down();
    await page.mouse.move(box.x+190/1080*box.width,box.y+720/1350*box.height,{steps:6});await page.mouse.up();
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),120);
    const beforeCancel=await preview.evaluate(c=>c.toDataURL());
    await page.mouse.move(box.x+190/1080*box.width,box.y+720/1350*box.height);await page.mouse.down();
    await page.mouse.move(box.x+230/1080*box.width,box.y+740/1350*box.height,{steps:6});
    await preview.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),120);
    assert.equal(await preview.evaluate(c=>c.toDataURL()),beforeCancel,'cancelled drag must restore the preview');
    console.log('PASS live drag before release, successive positions, one-step undo and pointer cancellation');
    const savedFile=await download('작업 파일 저장','editable.cardnews.json');
    const original=JSON.parse(fs.readFileSync(savedFile,'utf8'));
    assert(original.cards[0].photo.startsWith('data:image/jpeg;'));
    assert.equal(original.cards[0].texts[1].text,'봄날의 음악회\n함께 만나요');
    assert.equal(original.cards[0].texts[1].color,'#f4edc5');
    console.log('PASS photo upload, independent text/color edits, drag, editable JSON');
    await page.screenshot({path:path.join(out,'cardnews-editor.png')});
    await click('복제');await click('뒤로');
    assert.equal(await page.getByRole('button',{name:/번 카드 선택/}).count(),4);
    await click('카드 삭제');
    await page.getByRole('button',{name:'1번 카드 선택',exact:true}).click();
    await page.getByLabel('선택한 글씨 내용').fill('바뀐 문구');
    await page.locator('input[type=file][accept=".json"]').setInputFiles(savedFile);
    await page.getByText('작업 파일을 열었어요. 글씨와 사진을 다시 수정할 수 있어요.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('선택한 글씨 내용').inputValue(),'봄날의 음악회\n함께 만나요');
    // Invalid project leaves current work intact.
    await page.locator('input[type=file][accept=".json"]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"name":"bad","cards":[{}]}')});
    await page.getByText('올바른 카드뉴스 작업 파일이 아니에요.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('카드뉴스 이름').inputValue(),'행사 안내 카드뉴스');
    // All seven templates remain editable and exportable.
    for(const key of ['cover','photo_story','points','caution','prompt','outro','brandcard']) {
      await page.getByLabel('카드 레이아웃').selectOption(key);
      assert(await page.getByLabel('선택한 글씨 내용').isVisible());
    }
    await page.locator('input[type=file][accept=".json"]').setInputFiles(savedFile);
    await page.getByText('작업 파일을 열었어요. 글씨와 사진을 다시 수정할 수 있어요.',{exact:true}).waitFor();
    const zipPath=await download('전체 PNG 저장','cards.zip');
    const files=unzipSync(fs.readFileSync(zipPath));assert.deepEqual(Object.keys(files),['01.png','02.png','03.png']);
    for(const bytes of Object.values(files)){const b=Buffer.from(bytes);assert.equal(b.readUInt32BE(16),1080);assert.equal(b.readUInt32BE(20),1350);}
    console.log('PASS seven layouts, page order, reopen, invalid input protection, ordered 1080x1350 PNG ZIP');
    await click('전체 카드를 캔버스에 추가');
    await page.getByText('캔버스에 편집 가능한 사본을 추가했어요. 이 창을 닫으면 확인할 수 있어요.',{exact:true}).waitFor();
    await click('캔버스로 돌아가기');
    await page.waitForFunction(()=>{const raw=localStorage.getItem('canvas-state');return raw&&JSON.parse(raw).elements.filter(e=>e.type==='text').length>=8;});
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('canvas-state')));
    assert(state.elements.some(e=>e.type==='text'&&e.text==='봄날의 음악회'));
    assert(state.elements.some(e=>e.type==='image'));
    const crop=state.elements.find(e=>e.type==='image').transform.cropBox;
    assert(crop.x>=0&&crop.x<1&&crop.y>=0&&crop.y<1);
    assert(crop.width>0&&crop.width<=1&&crop.height>0&&crop.height<=1);
    await page.screenshot({path:path.join(out,'cardnews-canvas-layers.png')});
    await click('카드뉴스 만들기');
    await page.getByText('AI로 배경 만들기',{exact:true}).click();
    await page.getByLabel('배경 생성 설명').fill('야외 공연장');
    await click('이 카드 배경 1장 생성');await page.getByText('테스트용 생성 실패',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('선택한 글씨 내용').inputValue(),'봄날의 음악회\n함께 만나요');
    assert.equal(paidCalls,1);
    // Replace mock with successful image result; never call an external provider.
    await page.unroute('**/api/generate');
    await page.route('**/api/generate',async route=>{paidCalls++;assert.equal(route.request().postDataJSON().n,1);await route.fulfill({json:{images:[photo]}});});
    await click('이 카드 배경 1장 생성');await page.getByText('배경을 생성했어요. 글씨는 그대로 유지했어요.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('선택한 글씨 내용').inputValue(),'봄날의 음악회\n함께 만나요');
    // Wait for actual IDB write, then reload.
    await page.waitForFunction(async()=>{const r=indexedDB.open('gomgom-cardnews',1);const db=await new Promise(res=>r.onsuccess=()=>res(r.result));const q=db.transaction('drafts').objectStore('drafts').get('current');const d=await new Promise(res=>q.onsuccess=()=>res(q.result));db.close();return d?.cards?.[0]?.zoom===1;});
    await page.reload({waitUntil:'domcontentloaded'});await click('카드뉴스 만들기');
    await page.waitForFunction(()=>document.querySelector('input[aria-label="카드뉴스 이름"]')?.value==='행사 안내 카드뉴스');
    assert.equal(await page.getByLabel('선택한 글씨 내용').inputValue(),'봄날의 음악회\n함께 만나요');
    await page.setViewportSize({width:1024,height:768});
    await page.screenshot({path:path.join(out,'cardnews-compact.png')});
    const fits=await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2);assert(fits);
    assert.equal(paidCalls,2);assert.deepEqual(errors,[]);
    console.log('PASS native editable layers, background API failure/success mocks, persisted draft, compact layout; no paid calls');
    console.log('Artifacts:',out);
  } catch(e) {await page.screenshot({path:path.join(out,'test-failure.png')}).catch(()=>{});throw e;}
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
