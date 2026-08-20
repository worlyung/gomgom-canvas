"use client";
// 생성 이력 패널 (F-10) — 최근 50건, 조건 불러오기
import { useEffect, useState } from "react";
import { readHistory, type HistoryEntry } from "@/lib/handlers/openai-handler";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  onApplyEntry: (entry: HistoryEntry) => void;
  onClose: () => void;
}

const KIND_COLOR: Record<string, string> = {
  생성: "bg-blue-500/15 text-blue-600",
  부분수정: "bg-purple-500/15 text-purple-600",
  글자수정: "bg-amber-500/15 text-amber-600",
  "사이즈 전개": "bg-green-500/15 text-green-600",
  카드뉴스: "bg-pink-500/15 text-pink-600",
};

export function HistoryPanel({ onApplyEntry, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const load = () => setEntries(readHistory());
    load();
    window.addEventListener("history-updated", load);
    return () => window.removeEventListener("history-updated", load);
  }, []);

  return (
    <div className="fixed top-16 right-4 bottom-28 z-30 w-80 flex flex-col rounded-2xl border bg-card/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">생성 이력</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {entries.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">
            아직 이력이 없어요. 생성하면 여기에 쌓입니다.
          </p>
        )}
        {entries.map((e, i) => (
          <div key={i} className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className={`rounded-md px-1.5 py-0.5 font-medium ${KIND_COLOR[e.kind] || "bg-muted text-muted-foreground"}`}
              >
                {e.kind}
              </span>
              <span className="text-muted-foreground">
                {e.size} · {e.quality}
                {e.refs > 0 ? ` · 참조${e.refs}` : ""}
              </span>
              <span className="ml-auto text-muted-foreground">
                {new Date(e.ts).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed">{e.prompt}</p>
            <div className="mt-2 flex gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => onApplyEntry(e)}
              >
                조건 불러오기
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => navigator.clipboard.writeText(e.prompt)}
              >
                프롬프트 복사
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
