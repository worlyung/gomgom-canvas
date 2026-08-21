"use client";
// 제공자별 API 키 설정 — 키 값은 서버에만 저장되고 화면에는 가림 표기만 돌아온다.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProviderCapabilities } from "@/lib/providers";

export interface ProviderStatus {
  id: string;
  label: string;
  envKey: string;
  keyHint: string;
  docsUrl: string;
  caps: ProviderCapabilities;
  note?: string;
  configured: boolean;
  masked: string | null;
}

const CAP_LABELS: [keyof ProviderCapabilities, string][] = [
  ["generate", "생성"],
  ["reference", "참조"],
  ["mask", "부분수정"],
  ["transparent", "투명배경"],
  ["customSize", "자유크기"],
];

export function useProviders() {
  const [list, setList] = useState<ProviderStatus[]>([]);
  const [editLocked, setEditLocked] = useState(false);

  const reload = () =>
    fetch("/api/providers")
      .then((r) => r.json())
      .then((j) => {
        setList(j.providers || []);
        setEditLocked(!!j.editLocked);
      })
      .catch(() => {});

  useEffect(() => {
    reload();
  }, []);

  return { list, editLocked, reload };
}

export function ProviderSettings({
  list,
  editLocked,
  onSaved,
  toast,
}: {
  list: ProviderStatus[];
  editLocked: boolean;
  onSaved: () => void;
  toast: (p: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (id: string, value: string) => {
    setBusy(id);
    try {
      const r = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, value }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "저장 실패");
      setDrafts((d) => ({ ...d, [id]: "" }));
      onSaved();
      toast({
        title: value.trim() ? "키를 저장했어요" : "키를 지웠어요",
        description: value.trim() ? "바로 사용할 수 있습니다" : undefined,
      });
    } catch (e) {
      toast({
        title: "저장 실패",
        description: e instanceof Error ? e.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        키는 <strong>이 컴퓨터의 서버에만</strong> 저장되고 브라우저로는 내려오지
        않습니다. 제공자마다 되는 기능이 다릅니다.
      </p>
      {editLocked && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
          이 서버는 키 편집이 잠겨 있습니다 (LOCK_KEY_EDITING=1)
        </div>
      )}
      {list.map((p) => (
        <div key={p.id} className="rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{p.label}</span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] ${
                p.configured
                  ? "bg-green-500/15 text-green-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {p.configured ? `설정됨 · ${p.masked}` : "미설정"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {CAP_LABELS.map(([k, label]) => (
              <span
                key={k}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  p.caps[k]
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-muted text-muted-foreground line-through"
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          {p.note && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{p.note}</p>
          )}

          {!editLocked && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="password"
                value={drafts[p.id] ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                }
                placeholder={`${p.envKey} (${p.keyHint})`}
                className="h-8 font-mono text-xs"
                style={{ fontSize: "14px" }}
              />
              <Button
                size="sm"
                variant="primary"
                className="h-8"
                disabled={busy === p.id || !(drafts[p.id] ?? "").trim()}
                onClick={() => save(p.id, drafts[p.id] ?? "")}
              >
                저장
              </Button>
              {p.configured && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive"
                  disabled={busy === p.id}
                  onClick={() => save(p.id, "")}
                >
                  지우기
                </Button>
              )}
            </div>
          )}
          <a
            href={p.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[11px] text-muted-foreground underline"
          >
            키 발급받기 →
          </a>
        </div>
      ))}
    </div>
  );
}
