"use client";

import { useEffect, useRef, useState } from "react";
import { openDB } from "idb";
import { zipSync } from "fflate";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CARD_W, CARD_H, CARD_LAYOUTS, cardId, makeCard, newDeck, parseDeck, paintCard, imageFrom, layoutText,
  readPhoto, normalizePhoto, cardPng, downloadFile, safeDeckName, textOverflow, ensureCardFonts,
  type CardDeck, type NewsCard, type CardLayout, type CardText } from "@/lib/cardnews";
import type { PlacedImage } from "@/types/canvas";
import styles from "./cardnews-studio.module.css";
import { alignBoxes, snapMove, type AlignAction, type TextBox, type Position, type Guide } from "@/lib/cardnews-alignment";
import { listLocalFonts, ensureLocalFont, type LocalFont } from "@/lib/local-fonts";

const draftDB = () => openDB("gomgom-cardnews", 1, { upgrade(db) { db.createObjectStore("drafts"); } });

function Preview({ card, page, total, selected = [], onSelect, onMove, snapping = true }: {
  card: NewsCard; page: number; total: number; selected?: string[]; snapping?: boolean;
  onSelect?: (ids: string[]) => void; onMove?: (positions: Position[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{cardId:string; pointerId:number; x:number; y:number; moving:TextBox[]; stationary:TextBox[]; positions:Position[]; guides:Guide[]} | null>(null);
  const frame = useRef<number | null>(null);
  const photo = useRef<{src?:string; image:HTMLImageElement | null}>({image:null});
  const latest = useRef({card,page,total,selected}); latest.current={card,page,total,selected};
  const [error, setError] = useState("");
  function paint() {
    if (!ref.current) return;
    const {card,page,total,selected}=latest.current;
    if (photo.current.src !== card.photo) return;
    const d=drag.current;
    const view=d && d.cardId===card.id ? {...card,texts:card.texts.map(t=>({...t,...d.positions.find(p=>p.id===t.id)}))} : card;
    paintCard(ref.current,view,page,total,photo.current.image);
    const ctx=ref.current.getContext("2d")!;
    const ids=d?d.moving.map(t=>t.id):selected;
    ctx.save();ctx.strokeStyle="#e4fa70";ctx.lineWidth=3;ctx.setLineDash([12,8]);
    for(const t of view.texts.filter(t=>ids.includes(t.id)))ctx.strokeRect(t.x-8,t.y-8,t.width+16,layoutText(ctx,t).height+16);
    ctx.strokeStyle="#ff6ada";ctx.lineWidth=3;ctx.setLineDash([10,6]);
    for(const g of d?.guides||[]){ctx.beginPath();if(g.axis==="x"){ctx.moveTo(g.at,0);ctx.lineTo(g.at,CARD_H);}else{ctx.moveTo(0,g.at);ctx.lineTo(CARD_W,g.at);}ctx.stroke();}
    ctx.restore();
  }
  function cancelFrame() {
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}
  }
  function updateDrag(clientX:number,clientY:number, bypass=false) {
    const d=drag.current; if(!d || !ref.current)return;
    const r=ref.current.getBoundingClientRect();
    const dx=(clientX-r.left)*CARD_W/r.width-d.x, dy=(clientY-r.top)*CARD_H/r.height-d.y;
    if(Math.hypot(dx*r.width/CARD_W,dy*r.height/CARD_H)<2){d.positions=d.moving.map(t=>({id:t.id,x:t.x,y:t.y}));d.guides=[];return;}
    const result=snapMove(d.moving,d.stationary,dx,dy,6*CARD_W/r.width,snapping&&!bypass);
    d.positions=result.positions;d.guides=result.guides;
  }
  function cancelDrag() {cancelFrame();drag.current=null;paint();}
  useEffect(() => {
    let stale = false;
    if(drag.current?.cardId!==card.id)drag.current=null;
    if(photo.current.src===card.photo){paint();setError("");return;}
    (card.photo?imageFrom(card.photo):Promise.resolve(null)).then(im=>{
      if(stale)return;
      photo.current={src:card.photo,image:im};paint();setError("");
    }).catch(e=>{if(!stale)setError(e.message);});
    return () => { stale = true; };
  }, [card, page, total, selected]);
  useEffect(()=>()=>{cancelFrame();drag.current=null;},[]);
  useEffect(()=>{let stale=false;ensureCardFonts(card).then(()=>{if(!stale)paint();});return()=>{stale=true;};},[card]);
  return <div className={styles.previewWrap}>
    <canvas ref={ref} width={CARD_W} height={CARD_H} aria-label={`${page}번 카드 미리보기`} className={styles.preview}
      onPointerDown={e => {
        if (!onSelect || !ref.current || e.button!==0 || drag.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX-r.left)*CARD_W/r.width, y = (e.clientY-r.top)*CARD_H/r.height;
        const ctx = ref.current.getContext("2d")!;
        const t = [...card.texts].reverse().find(t => x>=t.x && x<=t.x+t.width && y>=t.y && y<=t.y+layoutText(ctx,t).height);
        if(!t){if(!e.shiftKey)onSelect([]);return;}
        e.preventDefault();
        if(e.shiftKey){onSelect(selected.includes(t.id)?selected.filter(id=>id!==t.id):[...selected,t.id]);return;}
        const ids=selected.includes(t.id)?selected:[t.id];onSelect(ids);
        const boxes=card.texts.map(t=>({...t,height:layoutText(ctx,t).height}));
        const moving=boxes.filter(t=>ids.includes(t.id));
        drag.current={cardId:card.id,pointerId:e.pointerId,x,y,moving,stationary:boxes.filter(t=>!ids.includes(t.id)),positions:moving.map(t=>({id:t.id,x:t.x,y:t.y})),guides:[]};
        e.currentTarget.setPointerCapture(e.pointerId);paint();
      }}
      onPointerMove={e=>{
        if(!drag.current || drag.current.pointerId!==e.pointerId)return;
        updateDrag(e.clientX,e.clientY,e.altKey);
        if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;paint();});
      }}
      onPointerUp={e => {
        const d=drag.current;if(!d || d.pointerId!==e.pointerId)return;
        updateDrag(e.clientX,e.clientY,e.altKey);cancelFrame();
        const positions=d.positions.map(p=>({...p,x:Math.round(p.x*1000)/1000,y:Math.round(p.y*1000)/1000}));
        const moved=positions.some(p=>{const t=d.moving.find(t=>t.id===p.id)!;return p.x!==t.x||p.y!==t.y;});
        d.positions=positions;d.guides=[];paint();drag.current=null;
        if(onMove && moved)onMove(positions);
      }} onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current)cancelDrag();}} />
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function CardnewsStudio({ open, onClose, images, onImport }: {
  open: boolean; onClose: () => void; images: PlacedImage[];
  onImport: (deck: CardDeck) => Promise<void>;
}) {
  const [deck, setDeck] = useState<CardDeck>(newDeck);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [selection, setSelectionState] = useState<string[] | null>(null);
  const [snapping, setSnapping] = useState(true);
  const [localFonts,setLocalFonts]=useState<LocalFont[]>([]);
  const [fontSearch,setFontSearch]=useState("");
  const [fontWarning,setFontWarning]=useState("");
  const [,setFontRevision]=useState(0);
  function setSelection(value: string | string[]) {setSelectionState(typeof value==="string"?(value?[value]:null):value);}
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState("");
  const history = useRef<CardDeck[]>([]);
  const current = useRef(deck); current.current=deck;
  const photoInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null);
  const card = deck.cards[Math.min(active,deck.cards.length-1)];
  const selectionIds = selection===null ? [card.texts[1]?.id || card.texts[0]?.id].filter(Boolean) : selection.filter(id=>card.texts.some(t=>t.id===id));
  const selected = card.texts.find(t => t.id===selectionIds[selectionIds.length-1]);
  const overflow = typeof document !== "undefined" && textOverflow(card);
  const fontKey=deck.cards.flatMap(c=>c.texts.map(t=>t.fontFamily||"")).join("\n");
  useEffect(()=>{let alive=true;listLocalFonts().then(fonts=>{if(alive)setLocalFonts(fonts.filter(f=>!/[\x00-\x1f'"\\]/.test(f.family)));});return()=>{alive=false;};},[]);
  useEffect(()=>{let alive=true;Promise.all(deck.cards.map(ensureCardFonts)).then(results=>{
    if(!alive)return;const missing=[...new Set(results.flat())];setFontWarning(missing.length?`불러올 수 없는 글꼴: ${missing.join(", ")} · 맑은 고딕으로 대신 표시·저장해요.`:"");setFontRevision(n=>n+1);
  });return()=>{alive=false;};},[fontKey]);

  useEffect(() => {
    let alive=true;
    draftDB().then(async db => {
      try { const v = await db.get("drafts","current"); if (alive && v) setDeck(parseDeck(v)); }
      finally {db.close();}
    }).catch(() => {if(alive) setStatus("이 PC의 임시 작업을 읽지 못했어요. 저장한 작업 파일을 열어 주세요.");})
      .finally(()=>{if(alive)setReady(true);});
    return ()=>{alive=false;};
  }, []);
  useEffect(() => {
    if (!ready) return;
    let alive=true; setSaved("자동 저장 중…");
    const timer=setTimeout(()=>{
      draftDB().then(async db=>{try{await db.put("drafts",deck,"current");}finally{db.close();}})
        .then(()=>{if(alive)setSaved("이 PC에 자동 저장됨");})
        .catch(()=>{if(alive)setSaved("자동 저장 실패 · 작업 파일을 저장해 주세요");});
    },350);
    return ()=>{alive=false;clearTimeout(timer);};
  },[deck,ready]);

  function change(next: CardDeck) {
    history.current=[...history.current.slice(-29),current.current]; setDeck(next);
  }
  function patchCard(patch: Partial<NewsCard>, id=card.id) {
    change({...current.current,cards:current.current.cards.map(c=>c.id===id?{...c,...patch}:c)});
  }
  function patchText(id:string, patch:Partial<CardText>) {
    patchCard({texts:card.texts.map(t=>t.id===id?{...t,...patch}:t)});
  }
  function applyPositions(positions:Position[]) {patchCard({texts:card.texts.map(t=>({...t,...positions.find(p=>p.id===t.id)}))});}
  function align(action:AlignAction) {
    try {
      const ctx=document.createElement("canvas").getContext("2d")!;
      applyPositions(alignBoxes(card.texts.filter(t=>selectionIds.includes(t.id)).map(t=>({...t,height:layoutText(ctx,t).height})),action));
      setStatus("선택한 글상자의 위치를 맞췄어요. 되돌리기로 복원할 수 있어요.");
    }catch(e){setStatus(e instanceof Error?e.message:"정렬하지 못했어요.");}
  }
  async function task(fn:()=>Promise<void>) {
    setBusy(true); setStatus("");
    try {await fn();} catch(e) {setStatus(e instanceof Error?e.message:"작업에 실패했어요. 다시 시도해 주세요.");}
    finally{setBusy(false);}
  }
  async function exportImages() {
    await Promise.all(deck.cards.map(ensureCardFonts));
    if (deck.cards.some(textOverflow)) throw new Error("일부 카드의 글씨가 아래쪽 영역을 벗어나요. 글자 크기나 위치를 조절해 주세요.");
    const files:Record<string,Uint8Array>={};
    for(let i=0;i<deck.cards.length;i++) {
      setStatus(`${i+1}/${deck.cards.length}장 이미지 만드는 중…`);
      files[`${String(i+1).padStart(2,"0")}.png`]=await cardPng(deck.cards[i],i+1,deck.cards.length);
    }
    const zip=zipSync(files,{level:0}); downloadFile(zip as BlobPart,`${safeDeckName(deck.name)}_이미지.zip`,"application/zip");
    setStatus(`${deck.cards.length}장 저장 완료 · 글씨를 다시 수정하려면 작업 파일도 저장해 주세요.`);
  }
  function movePage(direction:number) {
    const dest=active+direction; if(dest<0||dest>=deck.cards.length)return;
    const cards=[...deck.cards]; [cards[active],cards[dest]]=[cards[dest],cards[active]];
    change({...deck,cards});setActive(dest);
  }

  return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)onClose();}}>
    <DialogContent className={styles.dialog} onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}>
      <div className={styles.studio} onKeyDown={e=>{if(e.key!=="Escape")e.stopPropagation();}}>
        <header className={styles.header}>
          <div><DialogTitle className={styles.title}>카드뉴스 스튜디오</DialogTitle><DialogDescription>사진과 글씨를 따로 편집하는 나만의 카드뉴스</DialogDescription></div>
          <div className={styles.actions}>
            <button disabled={!ready||busy} onClick={()=>projectInput.current?.click()}>작업 열기</button>
            <button disabled={!ready||busy} onClick={()=>downloadFile(JSON.stringify(deck),`${safeDeckName(deck.name)}.cardnews.json`,"application/json")}>작업 파일 저장</button>
            <button disabled={!ready||busy} className={styles.primary} onClick={()=>task(exportImages)}>전체 PNG 저장</button>
          </div>
        </header>
        <fieldset disabled={busy||!ready} className={styles.body}>
          <aside className={styles.pages} aria-label="카드 목록">
            <label>작업 이름<input aria-label="카드뉴스 이름" value={deck.name} maxLength={100} onChange={e=>change({...deck,name:e.target.value})}/></label>
            <div className={styles.pageList}>
              {deck.cards.map((c,i)=><button key={c.id} className={`${styles.thumb} ${i===active?styles.active:""}`} onClick={()=>{setActive(i);setSelection("");}} aria-label={`${i+1}번 카드 선택`} aria-pressed={i===active}>
                <Preview card={c} page={i+1} total={deck.cards.length}/><span>{String(i+1).padStart(2,"0")} · {CARD_LAYOUTS[c.layout]}</span>
              </button>)}
            </div>
            <button disabled={deck.cards.length>=20} onClick={()=>{change({...deck,cards:[...deck.cards,makeCard("photo_story")]});setActive(deck.cards.length);setSelection("");}}>+ 카드 추가</button>
            <div className={styles.row}><button disabled={active===0} onClick={()=>movePage(-1)}>앞으로</button><button disabled={active===deck.cards.length-1} onClick={()=>movePage(1)}>뒤로</button></div>
            <div className={styles.row}><button disabled={deck.cards.length>=20} onClick={()=>{const c={...card,id:cardId(),texts:card.texts.map(t=>({...t,id:cardId()}))};const cards=[...deck.cards];cards.splice(active+1,0,c);change({...deck,cards});setActive(active+1);}}>복제</button>
            <button disabled={deck.cards.length===1} onClick={()=>{change({...deck,cards:deck.cards.filter(c=>c.id!==card.id)});setActive(Math.max(0,active-1));}}>카드 삭제</button></div>
          </aside>
          <main className={styles.stage}>
            <div className={styles.stageTop}><span>{active+1} / {deck.cards.length} · 1080 × 1350</span><button disabled={!history.current.length} onClick={()=>{const previous=history.current.pop();if(previous){setDeck(previous);setActive(0);setSelection("");}}}>되돌리기</button></div>
            <div className={styles.art}><Preview card={card} page={active+1} total={deck.cards.length} selected={selectionIds} snapping={snapping} onSelect={busy?undefined:setSelection} onMove={applyPositions}/></div>
            <p className={overflow?styles.warning:styles.hint}>{overflow?"글씨가 안전 영역을 벗어나요. 크기를 줄이거나 위치를 조절해 주세요.":"Shift+클릭: 여러 개 선택 · 드래그: 함께 이동 · Alt: 안내선에 붙지 않고 이동"}</p>
            <button onClick={()=>task(async()=>{await onImport(deck);setStatus("캔버스에 편집 가능한 사본을 추가했어요. 이 창을 닫으면 확인할 수 있어요.");})}>전체 카드를 캔버스에 추가</button>
            <small>글씨·사진·도형이 분리된 사본으로 추가돼요.</small>
          </main>
          <aside className={styles.settings} aria-label="카드 편집">
            <section><h3>레이아웃</h3><select aria-label="카드 레이아웃" value={card.layout} onChange={e=>{const next=makeCard(e.target.value as CardLayout,card);patchCard({...next,id:card.id});setSelection("");}}>
              {Object.entries(CARD_LAYOUTS).map(([key,name])=><option key={key} value={key}>{name}</option>)}
            </select><small>레이아웃을 바꾸면 글씨 위치와 스타일이 재배치돼요.</small></section>
            <section><h3>정렬 · 간격 맞춤</h3>
              <div className={styles.textTabs}>{card.texts.map(t=><button key={t.id} aria-pressed={selectionIds.includes(t.id)} onClick={e=>setSelection(e.shiftKey?(selectionIds.includes(t.id)?selectionIds.filter(id=>id!==t.id):[...selectionIds,t.id]):[t.id])}>{t.role}</button>)}</div>
              <small>Shift+클릭으로 여러 글상자를 선택해요. 선택한 글상자들의 바깥 범위를 기준으로 맞춰요.</small>
              <div className={styles.row}><span aria-label="선택한 글상자 수">{selectionIds.length}개 선택</span><button onClick={()=>setSelection(card.texts.map(t=>t.id))}>모두 선택</button><button onClick={()=>setSelection([])}>선택 해제</button></div>
              <div className={styles.alignGrid}>
                {([["left","왼쪽 맞춤"],["centerX","가로 가운데 맞춤"],["right","오른쪽 맞춤"],["top","위쪽 맞춤"],["centerY","세로 가운데 맞춤"],["bottom","아래쪽 맞춤"]] as [AlignAction,string][]).map(([action,label])=><button key={action} disabled={selectionIds.length<2} onClick={()=>align(action)}>{label}</button>)}
              </div>
              <div className={styles.row}><button disabled={selectionIds.length<3} onClick={()=>align("gapX")}>가로 간격 동일하게</button><button disabled={selectionIds.length<3} onClick={()=>align("gapY")}>세로 간격 동일하게</button></div>
              <div className={styles.row}><button disabled={!selectionIds.length} onClick={()=>align("cardX")}>카드 가로 중앙</button><button disabled={!selectionIds.length} onClick={()=>align("cardY")}>카드 세로 중앙</button></div>
              <small>간격 맞춤은 3개 이상 선택해요. 카드 중앙은 선택한 글상자를 한 묶음으로 이동해요.</small>
              <label className={styles.inline}><input type="checkbox" aria-label="안내선과 자동 맞춤" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/>안내선과 자동 맞춤</label>
            </section>
            <section><h3>배경</h3>
              <button onClick={()=>photoInput.current?.click()}>내 사진으로 배경 바꾸기</button>
              {images.length>0&&<label>캔버스에 있는 사진<select aria-label="캔버스 사진 선택" value="" onChange={e=>{const src=images.find(im=>im.id===e.target.value)?.src;const id=card.id;if(src)task(async()=>patchCard({photo:await normalizePhoto(src),focalX:50,focalY:50,zoom:1},id));}}><option value="">사진 선택…</option>{images.map((im,i)=><option key={im.id} value={im.id}>{i+1}. {im.promptHint?.slice(0,28)||"캔버스 이미지"}</option>)}</select></label>}
              <div className={styles.row}><label>바탕색<input aria-label="배경 색상" type="color" value={card.background} onChange={e=>patchCard({background:e.target.value})}/></label><label>포인트<input aria-label="포인트 색상" type="color" value={card.accent} onChange={e=>patchCard({accent:e.target.value})}/></label></div>
              {card.photo&&<><label>사진 어둡게 · {card.shade}%<input aria-label="사진 어둡게" type="range" min="0" max="85" value={card.shade} onChange={e=>patchCard({shade:+e.target.value})}/></label>
              <label>사진 확대<input aria-label="사진 확대" type="range" min="1" max="3" step=".05" value={card.zoom} onChange={e=>patchCard({zoom:+e.target.value})}/></label>
              <label>사진 좌우 위치<input aria-label="사진 좌우 위치" type="range" min="0" max="100" value={card.focalX} onChange={e=>patchCard({focalX:+e.target.value})}/></label>
              <label>사진 상하 위치<input aria-label="사진 상하 위치" type="range" min="0" max="100" value={card.focalY} onChange={e=>patchCard({focalY:+e.target.value})}/></label><button onClick={()=>patchCard({photo:undefined})}>사진 제거</button></>}
              <details><summary>AI로 배경 만들기</summary><textarea aria-label="배경 생성 설명" value={prompt} maxLength={2000} placeholder="예: 초록 잔디 위 야외 음악 축제, 글자 없이" onChange={e=>setPrompt(e.target.value)}/>
                <small>기존 OpenAI 연결 사용 · 생성할 때 API 비용이 발생해요. 글씨는 바뀌지 않아요.</small>
                <button disabled={!prompt.trim()} onClick={()=>{const id=card.id;task(async()=>{
                  const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:"openai",prompt:`${prompt}\nBackground photo for a 4:5 editorial card. Absolutely no text, letters, logos or watermarks.`,size:"1024x1536",quality:"medium",n:1})});
                  const result=await res.json();if(!res.ok)throw new Error(result.error||"배경 생성에 실패했어요.");
                  if(!result.images?.[0])throw new Error("생성된 배경이 없어요.");
                  patchCard({photo:await normalizePhoto(result.images[0]),focalX:50,focalY:50,zoom:1},id);setStatus("배경을 생성했어요. 글씨는 그대로 유지했어요.");
                });}}>이 카드 배경 1장 생성</button>
              </details>
            </section>
            <section><h3>글씨</h3>
              <label>선택 글상자 문단 정렬<select aria-label="문단 정렬" disabled={!selectionIds.length} value={selected?.align||"left"} onChange={e=>patchCard({texts:card.texts.map(t=>selectionIds.includes(t.id)?{...t,align:e.target.value as CardText["align"]}:t)})}><option value="left">왼쪽 정렬</option><option value="center">가운데 정렬</option><option value="right">오른쪽 정렬</option></select></label>
              {selectionIds.length>1&&<small>문단 정렬은 선택한 글상자 모두에 적용돼요. 아래 문구·스타일은 마지막에 선택한 글상자를 수정해요.</small>}
              {selected&&<>
                <label>글꼴 검색<input aria-label="카드뉴스 글꼴 검색" placeholder="글꼴 이름으로 검색" value={fontSearch} onChange={e=>setFontSearch(e.target.value)}/></label>
                <label>글꼴<select aria-label="카드뉴스 글꼴" value={selected.fontFamily||"Malgun Gothic"} onChange={e=>{
                  const family=e.target.value,id=selected.id,cardId=card.id;
                  task(async()=>{if(family!=="Malgun Gothic"&&!await ensureLocalFont(family))throw new Error("이 글꼴을 불러오지 못했어요. 다른 글꼴을 선택해 주세요.");
                    const target=current.current.cards.find(c=>c.id===cardId);if(target)patchCard({texts:target.texts.map(t=>t.id===id?{...t,fontFamily:family}:t)},cardId);setStatus("글꼴을 바꿨어요. 미리보기와 저장 이미지에 함께 적용돼요.");});
                }}><option value="Malgun Gothic">맑은 고딕 (기본)</option>
                  <optgroup label={`내 PC 글꼴 · ${localFonts.length}개`}>{localFonts.filter(f=>f.family!=="Malgun Gothic"&&(f.family===selected.fontFamily||f.family.toLocaleLowerCase().includes(fontSearch.trim().toLocaleLowerCase()))).map(f=><option key={f.family} value={f.family}>{f.family}</option>)}</optgroup>
                  {selected.fontFamily&&selected.fontFamily!=="Malgun Gothic"&&!localFonts.some(f=>f.family===selected.fontFamily)&&<option value={selected.fontFamily}>{selected.fontFamily} (이 PC에 없음)</option>}
                </select></label>
                <small>제목·본문마다 따로 선택해요. 다른 PC에서도 같은 글꼴로 편집하려면 그 PC에 해당 글꼴이 있어야 해요.</small>
                {fontWarning&&<p role="alert" className={styles.warning}>{fontWarning}</p>}
                <label>{selected.role}<textarea aria-label="선택한 글씨 내용" value={selected.text} maxLength={2000} rows={5} onChange={e=>patchText(selected.id,{text:e.target.value})}/></label>
                <div className={styles.row}><label>글자 크기<input aria-label="글자 크기" type="number" min="16" max="140" value={selected.size} onChange={e=>patchText(selected.id,{size:Math.max(16,Math.min(140,+e.target.value||16))})}/></label>
                <label>글자색<input aria-label="글자 색상" type="color" value={selected.color} onChange={e=>patchText(selected.id,{color:e.target.value})}/></label></div>
                <label className={styles.inline}><input type="checkbox" checked={selected.bold} onChange={e=>patchText(selected.id,{bold:e.target.checked})}/>굵게</label>
                <label>글상자 폭<input aria-label="글상자 폭" type="range" min="80" max="1000" value={selected.width} onChange={e=>patchText(selected.id,{width:+e.target.value})}/></label>
                <div className={styles.row}><label>가로 위치<input aria-label="글씨 가로 위치" type="number" min="0" max="1000" value={selected.x} onChange={e=>patchText(selected.id,{x:Math.max(0,Math.min(1000,+e.target.value))})}/></label><label>세로 위치<input aria-label="글씨 세로 위치" type="number" min="0" max="1250" value={selected.y} onChange={e=>patchText(selected.id,{y:Math.max(0,Math.min(1250,+e.target.value))})}/></label></div>
                <button onClick={()=>patchCard({texts:card.texts.filter(t=>t.id!==selected.id)})}>선택 글씨 삭제</button>
              </>}
              <button disabled={card.texts.length>=12} onClick={()=>{const id=cardId();patchCard({texts:[...card.texts,{id,role:"추가 글씨",text:"새 문구",x:80,y:300,width:920,size:40,color:"#ffffff",bold:false}]});setSelection(id);}}>+ 글씨 추가</button>
            </section>
          </aside>
        </fieldset>
        <footer className={styles.footer}><span role="status">{busy?"작업 중 · ":""}{status||saved}</span><button disabled={busy} onClick={onClose}>캔버스로 돌아가기</button></footer>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";const id=card.id;if(file)task(async()=>{patchCard({photo:await readPhoto(file),focalX:50,focalY:50,zoom:1},id);setStatus("사진을 바꿨어요. 글씨는 그대로예요.");});}}/>
        <input ref={projectInput} type="file" accept=".json" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)task(async()=>{
          if(file.size>100*1024*1024)throw new Error("작업 파일은 100MB 이하로 열 수 있어요.");
          const next=parseDeck(JSON.parse(await file.text()));change(next);setActive(0);setSelection("");setStatus("작업 파일을 열었어요. 글씨와 사진을 다시 수정할 수 있어요.");
        });}}/>
      </div>
    </DialogContent>
  </Dialog>;
}
