"use client";
// 생성 진행 표시 — 경과 시간과 살아있는 스피너 (고품질 생성은 1~3분 걸린다)
import { useEffect, useRef, useState } from "react";
import { SpinnerIcon } from "@/components/icons";

export function GeneratingIndicator({
  active,
  note,
}: {
  active: boolean;
  note?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    startRef.current = Date.now();
    setElapsed(0);
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  const m = Math.floor(elapsed / 60);
  const s = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed bottom-40 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full border bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
      <SpinnerIcon className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium tabular-nums">
        생성 중… {m}:{s}
      </span>
      <span className="text-xs text-muted-foreground">
        {note || "(고품질은 1~3분 걸려요)"}
      </span>
    </div>
  );
}
