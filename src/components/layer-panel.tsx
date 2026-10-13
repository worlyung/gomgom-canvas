"use client";
// 레이어 패널 (포스터 모드 P1) — 위가 앞. 클릭=선택 · 눈=숨김 · 자물쇠=잠금 · 끌어서 순서 바꾸기
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ImageIcon,
  Type,
  Square,
  Film,
  GripVertical,
} from "lucide-react";
import type { LayerEntry } from "@/lib/layer-order";
import type { PlacedImage, PlacedShape, PlacedText } from "@/types/canvas";

interface Props {
  entries: LayerEntry[]; // 아래 → 위 (orderLayers 결과)
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onMove: (id: string, newIndexBottomFirst: number) => void;
  onClose: () => void;
}

const SHAPE_KO: Record<string, string> = {
  rect: "네모",
  ellipse: "원",
  triangle: "세모",
  star: "별",
  arrow: "화살표",
  line: "선",
};

function labelOf(e: LayerEntry): string {
  if (e.kind === "text") {
    const t = (e.item as PlacedText).text.replace(/\s+/g, " ").trim();
    return t.slice(0, 16) || "빈 글씨";
  }
  if (e.kind === "shape") return SHAPE_KO[(e.item as PlacedShape).kind] || "도형";
  if (e.kind === "video") return "영상";
  return ((e.item as PlacedImage).promptHint || "이미지").slice(0, 16);
}

export function LayerPanel({
  entries,
  selectedIds,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onMove,
  onClose,
}: Props) {
  const rows = [...entries].reverse(); // 화면에는 위가 앞
  const n = entries.length;
  // 끌고 있는 항목 — 놓는 순간 바로 읽어야 하므로 상태가 아니라 참조로 든다 (상태는 표시용)
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  return (
    <div className="fixed top-16 right-4 bottom-28 z-30 w-72 flex flex-col rounded-2xl border bg-card/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">
          레이어 <span className="font-normal text-muted-foreground">{n}</span>
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {n === 0 && (
          <p className="p-4 text-xs text-muted-foreground">
            캔버스에 놓인 게 없어요.
          </p>
        )}
        {rows.map((e, i) => {
          const sel = selectedIds.includes(e.id);
          const hidden = !!e.item.hidden;
          const locked = !!e.item.locked;
          const Icon =
            e.kind === "text"
              ? Type
              : e.kind === "shape"
                ? Square
                : e.kind === "video"
                  ? Film
                  : ImageIcon;
          const isDropTarget = overIdx === i && dragId !== null && dragId !== e.id;
          return (
            <div
              key={e.id}
              draggable
              onDragStart={() => {
                dragRef.current = e.id;
                setDragId(e.id);
              }}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.stopPropagation(); // 캔버스의 파일 떨어뜨리기 처리로 새지 않게
                setOverIdx(i);
              }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                // 화면 i번째(위가 0) = 아래 기준 n-1-i 번째. 끌어온 항목이 정확히 이 줄에 온다
                const from = dragRef.current;
                if (from && from !== e.id) onMove(from, n - 1 - i);
                dragRef.current = null;
                setDragId(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                dragRef.current = null;
                setDragId(null);
                setOverIdx(null);
              }}
              onClick={(ev) =>
                onSelect(e.id, ev.shiftKey || ev.ctrlKey || ev.metaKey)
              }
              className={[
                "group flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-xs cursor-pointer select-none",
                sel
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-transparent hover:bg-muted/60",
                isDropTarget ? "ring-2 ring-blue-400" : "",
                hidden ? "opacity-50" : "",
              ].join(" ")}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {e.kind === "image" || e.kind === "video" ? (
                <img
                  src={(e.item as PlacedImage).src}
                  alt=""
                  draggable={false}
                  className="h-7 w-7 shrink-0 rounded bg-muted object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              )}
              <span
                className="flex-1 truncate"
                style={
                  e.kind === "text"
                    ? { fontFamily: (e.item as PlacedText).fontFamily }
                    : undefined
                }
              >
                {labelOf(e)}
              </span>
              <button
                type="button"
                title={hidden ? "보이기" : "숨기기"}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onToggleHidden(e.id);
                }}
                className="rounded p-1 hover:bg-muted"
              >
                {hidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                title={locked ? "잠금 풀기" : "잠그기"}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onToggleLocked(e.id);
                }}
                className="rounded p-1 hover:bg-muted"
              >
                {locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        위가 앞 · 끌어서 순서 바꾸기 · <kbd>]</kbd> 앞으로 <kbd>[</kbd> 뒤로
      </div>
    </div>
  );
}
