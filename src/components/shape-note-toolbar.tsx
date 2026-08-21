"use client";
// 선택된 도형 / 메모의 속성 편집 바
import type { PlacedShape } from "@/types/canvas";
import { Button } from "@/components/ui/button";

const COLORS = [
  "#e11d48",
  "#f59e0b",
  "#facc15",
  "#10b981",
  "#3b82f6",
  "#7c3aed",
  "#111111",
  "#ffffff",
];

export function ShapeToolbar({
  item,
  onChange,
  onDelete,
}: {
  item: PlacedShape;
  onChange: (patch: Partial<PlacedShape>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">선</span>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ stroke: c })}
            title={c}
            className={`h-5 w-5 rounded-full border ${item.stroke === c ? "ring-2 ring-blue-500" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(item.stroke) ? item.stroke : "#e11d48"}
          onChange={(e) => onChange({ stroke: e.target.value })}
          className="h-6 w-7 cursor-pointer rounded border bg-transparent p-0"
          title="선 색 직접 고르기"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() =>
              onChange({ strokeWidth: Math.max(1, item.strokeWidth - 1) })
            }
          >
            −
          </Button>
          <span className="w-5 text-center text-xs tabular-nums">
            {item.strokeWidth}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => onChange({ strokeWidth: item.strokeWidth + 1 })}
          >
            +
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">채움</span>
        <Button
          variant={!item.fill ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange({ fill: undefined })}
        >
          없음
        </Button>
        <input
          type="color"
          value={
            item.fill && /^#[0-9a-f]{6}$/i.test(item.fill)
              ? item.fill
              : "#f59e0b"
          }
          onChange={(e) => onChange({ fill: e.target.value })}
          className="h-6 w-7 cursor-pointer rounded border bg-transparent p-0"
          title="채움 색"
        />
        <span className="ml-2 text-xs text-muted-foreground">투명도</span>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(item.opacity * 100)}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          className="w-20"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive"
          onClick={onDelete}
        >
          삭제
        </Button>
      </div>
    </div>
  );
}

// NoteToolbar는 제거됨 — 메모는 메모지 위에서 바로 고친다 (note-inline-editor.tsx)
