const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {unzipSync}=require(process.env.FFLATE_MODULE||'fflate');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.CARDNEWS_TEST_OUTPUT;if(!out)throw Error('CARDNEWS_TEST_OUTPUT required');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/_vercel/**',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.route('**/api/generate',r=>r.abort());
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const download=async(label,name)=>{const wait=page.waitForEvent('download');await click(label);const d=await wait;const file=path.join(out,name);await d.saveAs(file);return file;};
 const fixture={version:1,name:'글꼴 검사',cards:[{id:'card',layout:'cover',background:'#203c34',accent:'#d8e6aa',focalX:50,focalY:50,zoom:1,shade:0,texts:[
  {id:'brand',role:'브랜드',text:'GOMGOM STUDIO',x:80,y:68,width:920,size:27,color:'#ffffff',bold:true},
  {id:'title',role:'제목',text:'한글 제목 GOMGOM',x:80,y:250,width:920,size:64,color:'#ffffff',bold:true},
  {id:'body',role:'본문',text:'본문 글꼴도 따로 바꿔요',x:80,y:550,width:920,size:36,color:'#ffffff',bold:false}]}]};
 const open=async deck=>{await page.locator('input[type=file][accept=".json"]').setInputFiles({name:'font.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(deck))});await page.getByText('작업 파일을 열었어요. 글씨와 사진을 다시 수정할 수 있어요.',{exact:true}).waitFor();};
 try{
  await page.goto(process.env.CARDNEWS_TEST_URL||'http://127.0.0.1:3009');await click('카드뉴스 만들기');await open(fixture);
  await page.waitForFunction(()=>document.querySelectorAll('select[aria-label="카드뉴스 글꼴"] option').length>5);
  const picker=page.getByLabel('카드뉴스 글꼴',{exact:true});
  const names=await picker.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
  const titleFont=['휴먼명조','나눔명조','궁서','바탕','Georgia'].find(n=>names.includes(n));assert(titleFont,'A contrasting installed font is required');
  const bodyFont=names.includes('Arial')?'Arial':names.find(n=>n!==titleFont&&n!=='Malgun Gothic');assert(bodyFont);
  const preview=page.getByRole('dialog').locator('main canvas');const before=await preview.evaluate(c=>c.toDataURL());
  await page.getByLabel('카드뉴스 글꼴 검색').fill(titleFont);assert((await picker.locator('option').count())<names.length);
  await picker.selectOption(titleFont);await page.getByText('글꼴을 바꿨어요. 미리보기와 저장 이미지에 함께 적용돼요.',{exact:true}).waitFor();
  assert(await page.evaluate(f=>[...document.fonts].some(x=>x.family===f&&x.status==='loaded'),titleFont));assert.notEqual(await preview.evaluate(c=>c.toDataURL()),before);
  await click('본문');assert.equal(await picker.inputValue(),'Malgun Gothic');
  await page.getByLabel('카드뉴스 글꼴 검색').fill('');await picker.selectOption(bodyFont);
  await page.waitForFunction(f=>document.querySelector('select[aria-label="카드뉴스 글꼴"]')?.value===f,bodyFont);
  await click('제목');assert.equal(await picker.inputValue(),titleFont);
  const file=await download('작업 파일 저장','fonts.cardnews.json');const deck=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(deck.cards[0].texts[1].fontFamily,titleFont);assert.equal(deck.cards[0].texts[2].fontFamily,bodyFont);
  await page.getByLabel('카드 레이아웃').selectOption('photo_story');assert.equal(await picker.inputValue(),titleFont);
  await open(deck);assert.equal(await picker.inputValue(),titleFont);
  await page.screenshot({path:path.join(out,'cardnews-font-picker.png')});await click('선택 해제');
  const zip=await download('전체 PNG 저장','fonts.zip');const png=unzipSync(fs.readFileSync(zip))['01.png'];
  const equal=await preview.evaluate(async(c,b64)=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const x=document.createElement('canvas');x.width=1080;x.height=1350;x.getContext('2d').drawImage(im,0,0);const a=c.getContext('2d').getImageData(0,0,1080,1350).data,b=x.getContext('2d').getImageData(0,0,1080,1350).data;return a.every((v,i)=>v===b[i]);},Buffer.from(png).toString('base64'));assert(equal,'export pixels must match loaded-font preview exactly');
  await click('전체 카드를 캔버스에 추가');await page.getByText('캔버스에 편집 가능한 사본을 추가했어요. 이 창을 닫으면 확인할 수 있어요.',{exact:true}).waitFor();await click('캔버스로 돌아가기');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')||'{"elements":[]}').elements.some(e=>e.text==='한글 제목 GOMGOM'));
  const texts=await page.evaluate(()=>JSON.parse(localStorage.getItem('canvas-state')).elements.filter(e=>e.type==='text'));assert(texts.find(e=>e.text==='한글 제목 GOMGOM').fontFamily.includes(titleFont));assert(texts.find(e=>e.text==='본문 글꼴도 따로 바꿔요').fontFamily.includes(bodyFont));
  await click('카드뉴스 만들기');const missing=JSON.parse(JSON.stringify(deck));missing.cards[0].texts[1].fontFamily='Missing Font Test 2026';await open(missing);await page.getByText(/불러올 수 없는 글꼴: Missing Font Test 2026/).waitFor();assert.equal(await picker.inputValue(),'Missing Font Test 2026');
  await open(deck);await page.waitForFunction(async()=>{const r=indexedDB.open('gomgom-cardnews',1);const db=await new Promise(res=>r.onsuccess=()=>res(r.result));const q=db.transaction('drafts').objectStore('drafts').get('current');const d=await new Promise(res=>q.onsuccess=()=>res(q.result));db.close();return d?.cards?.[0]?.texts?.[1]?.fontFamily&&!d.cards[0].texts[1].fontFamily.startsWith('Missing');});
  await page.reload();await click('카드뉴스 만들기');await page.waitForFunction(f=>document.querySelector('select[aria-label="카드뉴스 글꼴"]')?.value===f,titleFont);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'font-test-info.json'),JSON.stringify({titleFont,bodyFont,count:names.length}));
  console.log(`PASS ${names.length} font options; ${titleFont}/${bodyFont}; independent selection, search, loaded-font redraw, exact PNG pixels, native font preservation, layout/reopen/draft, missing-font notice`);
 }catch(e){await page.screenshot({path:path.join(out,'fonts-failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
