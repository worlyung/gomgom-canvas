// Pure geometry regressions plus real browser interactions; no image API calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const ts=require(process.env.TYPESCRIPT_MODULE||'typescript');
const cache={};
function load(name){
  if(cache[name])return cache[name].exports;
  const file=path.resolve(__dirname,'../src/lib',name+'.ts'),m=new Module(file);cache[name]=m;
  m.require=id=>id.startsWith('./')?load(id.slice(2)):require(id);
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
  return m.exports;
}
const {alignBoxes,snapMove}=load('cardnews-alignment'),{textLineX,parseDeck}=load('cardnews');
const boxes=[{id:'a',role:'브랜드',text:'브랜드',x:100,y:100,width:100,height:27,size:20,color:'#ffffff',bold:false},{id:'b',role:'제목',text:'제목',x:350,y:300,width:200,height:54,size:40,color:'#ffffff',bold:true},{id:'c',role:'본문',text:'본문',x:800,y:650,width:150,height:81,size:60,color:'#ffffff',bold:false}];
const near=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
for(const [action,axis,values] of [['left','x',[100,100,100]],['centerX','x',[475,425,450]],['right','x',[850,750,800]],['top','y',[100,100,100]],['centerY','y',[402,388.5,375]],['bottom','y',[704,677,650]],['gapX','x',[100,400,800]],['gapY','y',[100,361.5,650]],['cardX','x',[115,365,815]],['cardY','y',[359.5,559.5,909.5]]]){
  const result=alignBoxes(boxes,action);result.forEach((p,i)=>near(p[axis],values[i]));
}
assert.throws(()=>alignBoxes(boxes.slice(0,2),'gapX'));
assert.throws(()=>alignBoxes(boxes.map(b=>({...b,x:100})),'gapX'),/겹쳐/);
const snap=snapMove([boxes[0]],[boxes[1]],247,0,5);near(snap.positions[0].x,350);assert(snap.guides.some(g=>g.axis==='x'&&g.at===350));
const bypass=snapMove([boxes[0]],[boxes[1]],247,0,5,false);near(bypass.positions[0].x,347);assert.equal(bypass.guides.length,0);
const group=snapMove(boxes.slice(0,2),[],14,0,5);near(group.positions[1].x-group.positions[0].x,250);
near(textLineX({measureText:()=>({width:40})},{x:100,width:200,align:'center'},'aa'),180);
near(textLineX({measureText:()=>({width:40})},{x:100,width:200,align:'right'},'aa'),260);
console.log('PASS six alignments, unequal-size equal gaps, card centre, group offsets, snap/bypass, paragraph origins');

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.CARDNEWS_TEST_OUTPUT;if(!output)throw Error('CARDNEWS_TEST_OUTPUT required');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/_vercel/**',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.route('**/api/generate',r=>{throw Error('No paid generation allowed');});
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const fixture={version:1,name:'정렬 검사',cards:[{id:'card',layout:'cover',background:'#203c34',accent:'#d8e6aa',shade:0,zoom:1,focalX:50,focalY:50,texts:boxes.map(({height,...t})=>t)}]};
 const open=async()=>{await page.locator('input[type=file][accept=".json"]').setInputFiles({name:'alignment.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.getByText('작업 파일을 열었어요. 글씨와 사진을 다시 수정할 수 있어요.',{exact:true}).waitFor();};
 const saved=async()=>{const wait=page.waitForEvent('download');await click('작업 파일 저장');const d=await wait;const file=path.join(output,'alignment-result.json');await d.saveAs(file);return parseDeck(JSON.parse(fs.readFileSync(file,'utf8'))).cards[0].texts;};
 try{
  await page.goto(process.env.CARDNEWS_TEST_URL||'http://127.0.0.1:3009');await click('카드뉴스 만들기');await open();
  assert(await page.getByRole('button',{name:'왼쪽 맞춤',exact:true}).isDisabled());
  await page.getByRole('button',{name:'본문',exact:true}).click({modifiers:['Shift']});
  assert.equal(await page.getByLabel('선택한 글상자 수').innerText(),'2개 선택');
  await click('왼쪽 맞춤');let values=await saved();near(values[1].x,350);near(values[2].x,350);near(values[0].x,100);
  await click('되돌리기');values=await saved();near(values[2].x,800);
  for(const [label,action] of [['왼쪽 맞춤','left'],['가로 가운데 맞춤','centerX'],['오른쪽 맞춤','right'],['위쪽 맞춤','top'],['세로 가운데 맞춤','centerY'],['아래쪽 맞춤','bottom'],['가로 간격 동일하게','gapX'],['세로 간격 동일하게','gapY'],['카드 가로 중앙','cardX'],['카드 세로 중앙','cardY']]){
   await open();await click('모두 선택');await click(label);values=await saved();const expected=alignBoxes(boxes,action);values.forEach((v,i)=>{near(v.x,expected[i].x);near(v.y,expected[i].y);});
  }
  await open();await click('모두 선택');await page.getByLabel('문단 정렬').selectOption('center');values=await saved();assert(values.every(t=>t.align==='center'));
  await page.getByLabel('문단 정렬').selectOption('right');values=await saved();assert(values.every(t=>t.align==='right'));
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path.join(output,'alignment-result.json'));await page.getByLabel('문단 정렬').selectOption('center');
  await open();await click('선택 해제');
  const preview=page.getByRole('dialog').locator('main canvas'),r=await preview.boundingBox();
  const move=(x,y,options)=>page.mouse.move(r.x+x/1080*r.width,r.y+y/1350*r.height,options);
  await move(120,110);await page.mouse.click(r.x+120/1080*r.width,r.y+110/1350*r.height);
  await page.keyboard.down('Shift');await page.mouse.click(r.x+370/1080*r.width,r.y+320/1350*r.height);await page.keyboard.up('Shift');
  assert.equal(await page.getByLabel('선택한 글상자 수').innerText(),'2개 선택');
  await page.getByLabel('안내선과 자동 맞춤').uncheck();await move(120,110);await page.mouse.down();await move(160,140,{steps:8});await page.mouse.up();
  values=await saved();near(values[0].x,140);near(values[1].x,390);near(values[0].y,130);near(values[1].y,330);near(values[2].x,800);
  await click('되돌리기');values=await saved();near(values[0].x,100);near(values[1].x,350);
  await click('브랜드');await page.getByLabel('안내선과 자동 맞춤').check();
  // A click must not cause a snap or move, even when another edge is close.
  await move(120,110);await page.mouse.down();await page.mouse.up();values=await saved();near(values[0].x,100);
  await move(120,110);await page.mouse.down();await move(507,180,{steps:10});
  await preview.evaluate(()=>new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res))));
  const guidePixels=await preview.evaluate(c=>{const d=c.getContext('2d').getImageData(540,0,1,1350).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>240&&d[i+1]>80&&d[i+1]<140&&d[i+2]>180)n++;return n;});
  assert(guidePixels>100,'visible centre guide while pointer held');await page.screenshot({path:path.join(output,'alignment-guide-held.png')});
  await page.mouse.up();values=await saved();near(values[0].x,490);
  const afterGuide=await preview.evaluate(c=>{const d=c.getContext('2d').getImageData(540,0,1,1350).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>240&&d[i+1]>80&&d[i+1]<140&&d[i+2]>180)n++;return n;});assert.equal(afterGuide,0);
  await click('되돌리기');await click('브랜드');await move(120,110);await page.keyboard.down('Alt');await page.mouse.down();await move(507,180,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');values=await saved();near(values[0].x,487);
  await open();await click('모두 선택');await page.getByLabel('문단 정렬').selectOption('center');
  await page.screenshot({path:path.join(output,'alignment-controls.png')});
  await click('전체 카드를 캔버스에 추가');await page.getByText('캔버스에 편집 가능한 사본을 추가했어요. 이 창을 닫으면 확인할 수 있어요.',{exact:true}).waitFor();await click('캔버스로 돌아가기');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canvas-state')||'{"elements":[]}').elements.some(e=>e.type==='text'));
  const native=await page.evaluate(()=>JSON.parse(localStorage.getItem('canvas-state')).elements.filter(e=>e.type==='text'));
  assert(native.some(t=>t.text==='제목')); // Native copy has shifted origins for centred lines.
  const origins=await page.evaluate(texts=>texts.map(t=>{const c=document.createElement('canvas').getContext('2d');c.font=`${t.bold?'bold':'normal'} ${t.size}px "Malgun Gothic", sans-serif`;return t.x+(t.width-c.measureText(t.text).width)/2;}),fixture.cards[0].texts);
  const offset=native.find(t=>t.text==='브랜드').transform.x-origins[0];fixture.cards[0].texts.forEach((t,i)=>near(native.find(e=>e.text===t.text).transform.x,origins[i]+offset));
  assert.deepEqual(errors,[]);console.log('PASS browser multi-select, 10 actions, undo, paragraph alignment/reopen/native copies, smooth group move, snap guide, Alt bypass and click stability');
 }catch(e){await page.screenshot({path:path.join(output,'alignment-failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
