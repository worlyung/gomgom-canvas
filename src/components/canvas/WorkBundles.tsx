"use client";

import { useState } from "react";
import { openDB } from "idb";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { BundleContent, WorkBundle } from "@/lib/work-bundles";

async function database() {
  return openDB("gomgom-work-bundles", 1, { upgrade(db) { db.createObjectStore("bundles", { keyPath: "id" }); } });
}

async function durableSource(src: string) {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("이미지·영상 원본을 읽지 못했어요. 파일을 다시 넣고 저장해 주세요.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("원본 파일 저장에 실패했어요."));
    reader.readAsDataURL(blob);
  });
}

export function WorkBundles({ content, onInsert }: { content: BundleContent; onInsert: (bundle: BundleContent) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [bundles, setBundles] = useState<WorkBundle[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const count = Object.values(content).reduce((n, items) => n + items.length, 0);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch(e) { setMessage(e instanceof Error ? e.message : "저장 공간을 확인해 주세요."); }
    finally { setBusy(false); }
  }
  async function refresh() {
    const db = await database();
    try { setBundles(await db.getAll("bundles")); } finally { db.close(); }
  }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) void run(refresh); }}>
    <DialogTrigger asChild><button>작업 묶음</button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>작업 묶음</DialogTitle>
        <DialogDescription>선택한 이미지·문구·도형·메모·영상을 저장하고 다시 꺼내 쓰세요. 이 브라우저에 보관되며 브라우저 데이터 삭제 시 사라져요.</DialogDescription>
      </DialogHeader>
      <p className="text-sm">선택한 요소 {count}개 · 여러 요소는 Shift를 누른 채 선택하세요.</p>
      <input aria-label="작업 묶음 이름" placeholder="예: 봄 축제 홍보물" value={name} maxLength={80} onChange={e => setName(e.target.value)} className="rounded-md border bg-background p-2" />
      <button disabled={busy || !count || !name.trim()} className="rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-40" onClick={() => void run(async () => {
        const bundle: WorkBundle = { ...structuredClone(content), id: crypto.randomUUID(), name: name.trim() };
        for (const item of [...bundle.images, ...bundle.videos]) item.src = await durableSource(item.src);
        const db = await database();
        try { await db.put("bundles", bundle); } finally { db.close(); }
        setName(""); await refresh(); setMessage("작업 묶음을 저장했어요.");
      })}>{busy ? "처리 중…" : "선택한 요소 저장"}</button>
      <div className="space-y-2">
        {!bundles.length && <p className="text-sm text-muted-foreground">저장한 작업 묶음이 없어요.</p>}
        {bundles.map(bundle => <div key={bundle.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="min-w-0 break-words text-sm">{bundle.name}</span>
          <button disabled={busy} className="shrink-0 rounded-md border px-3 py-2 text-sm disabled:opacity-40" aria-label={`${bundle.name} 복제해서 넣기`} onClick={() => void run(async () => { await onInsert(bundle); setOpen(false); })}>복제해서 넣기</button>
        </div>)}
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
    </DialogContent>
  </Dialog>;
}
