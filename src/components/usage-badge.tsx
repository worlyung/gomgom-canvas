"use client";
// 사용량 상시 표시 (F-12) — 오늘/누적 호출수·예상 비용
import { useEffect, useState } from "react";

interface Usage {
  today: { calls: number; cost: number };
  total: { calls: number; cost: number };
  krwPerUsd: number;
}

export function UsageBadge() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/usage")
        .then((r) => r.json())
        .then(setUsage)
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener("usage-updated", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("usage-updated", load);
    };
  }, []);

  if (!usage) return null;
  const krw = (usd: number) =>
    `₩${Math.round(usd * usage.krwPerUsd).toLocaleString()}`;

  return (
    <div className="fixed top-4 right-4 z-50 rounded-lg border border-border/40 bg-card/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
      <span className="font-medium">
        오늘 {usage.today.calls}회 · {krw(usage.today.cost)}
      </span>
      <span className="text-muted-foreground">
        {" "}
        / 누적 {usage.total.calls}회 · {krw(usage.total.cost)} (예상)
      </span>
    </div>
  );
}
