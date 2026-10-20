// Installed TURDAM integration smoke, using a disposable profile and saved fixture.
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const output=process.env.CARDNEWS_TEST_OUTPUT;if(!output)throw new Error('CARDNEWS_TEST_OUTPUT is required');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'turdam-cardnews-'));
  const env={...process.env,TURDAM_TEST_DATA:profile};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.CARDNEWS_TEST_EXE || path.join(process.env.LOCALAPPDATA,'Programs/TURDAM/TURDAM.exe');
  const app=await _electron.launch({executablePath,env,timeout:60000});
  try{
    const main=await app.firstWindow();await main.waitForFunction(()=>!!window.__f3d);
    const pending=app.context().waitForEvent('page');await main.evaluate(()=>document.getElementById('gomgomCanvasBtn').click());
    const page=await pending;await page.getByRole('button',{name:'카드뉴스 만들기',exact:true}).waitFor({timeout:60000});
    await page.getByRole('button',{name:'카드뉴스 만들기',exact:true}).click();
    await page.getByLabel('카드뉴스 이름').waitFor();
    await page.getByLabel('안내선과 자동 맞춤').uncheck();
    await page.locator('input[type=file][accept=".json"]').setInputFiles(path.join(output,'editable.cardnews.json'));
    await page.getByText('작업 파일을 열었어요. 글씨와 사진을 다시 수정할 수 있어요.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('선택한 글씨 내용').inputValue(),'봄날의 음악회\n함께 만나요');
    const preview=page.getByRole('dialog').locator('main canvas');const box=await preview.boundingBox();
    const initialX=Number(await page.getByLabel('글씨 가로 위치').inputValue());
    const before=await preview.evaluate(c=>c.toDataURL());
    await page.mouse.move(box.x+160/1080*box.width,box.y+720/1350*box.height);await page.mouse.down();
    await page.mouse.move(box.x+200/1080*box.width,box.y+740/1350*box.height,{steps:8});
    await preview.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.notEqual(await preview.evaluate(c=>c.toDataURL()),before,'installed preview must move while holding the pointer');
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),initialX);
    await page.screenshot({path:path.join(output,'cardnews-installed-drag-held.png')});
    await page.mouse.up();assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),initialX+40);
    await page.getByRole('button',{name:'본문',exact:true}).click({modifiers:['Shift']});
    assert.equal(await page.getByLabel('선택한 글상자 수').innerText(),'2개 선택');
    await page.getByRole('button',{name:'왼쪽 맞춤',exact:true}).click();
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),80);
    await page.getByRole('button',{name:'제목',exact:true}).click();
    assert.equal(Number(await page.getByLabel('글씨 가로 위치').inputValue()),80);
    await page.getByLabel('문단 정렬').selectOption('center');
    const fontInfo=path.join(output,'font-test-info.json');
    if(fs.existsSync(fontInfo)){
      const {titleFont}=JSON.parse(fs.readFileSync(fontInfo,'utf8'));
      await page.getByLabel('카드뉴스 글꼴',{exact:true}).selectOption(titleFont);
      await page.getByText('글꼴을 바꿨어요. 미리보기와 저장 이미지에 함께 적용돼요.',{exact:true}).waitFor();
      assert(await page.evaluate(f=>[...document.fonts].some(x=>x.family===f&&x.status==='loaded'),titleFont));
      console.log('PASS installed font selection and loaded face:',titleFont);
    }
    await page.getByLabel('선택한 글씨 내용').fill('설치형에서도\n따로 편집돼요');
    await page.screenshot({path:path.join(output,'cardnews-installed.png')});
    const dest=path.join(output,'installed-cards.zip');
    await app.evaluate(({session},dest)=>{
      session.defaultSession.on('will-download',(_event,item)=>item.setSavePath(dest));
    },dest);
    await page.getByRole('button',{name:'전체 PNG 저장',exact:true}).click();
    await page.getByText('3장 저장 완료 · 글씨를 다시 수정하려면 작업 파일도 저장해 주세요.',{exact:true}).waitFor();
    for(let i=0;i<40&&!fs.existsSync(dest);i++)await new Promise(r=>setTimeout(r,100));
    assert(fs.existsSync(dest));assert(fs.statSync(dest).size>10000);
    await page.getByRole('button',{name:'전체 카드를 캔버스에 추가',exact:true}).click();
    await page.getByText('캔버스에 편집 가능한 사본을 추가했어요. 이 창을 닫으면 확인할 수 있어요.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'캔버스로 돌아가기',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')||'{"elements":[]}').elements.some(e=>e.text==='설치형에서도'));
    console.log('PASS installed TURDAM live drag before release, editable photos/text, ZIP and native layers; no paid API');
  } finally {await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
