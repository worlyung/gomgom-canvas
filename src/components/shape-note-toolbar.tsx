"use client";
// 선택된 도형 / 메모의 속성 편집 바
import type { PlacedNote, PlacedShape } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

export function NoteToolbar({
  item,
  onChange,
  onDelete,
}: {
  item: PlacedNote;
  onChange: (patch: Partial<PlacedNote>) => void;
  onDelete: () => void;
}) {
  const NOTE_COLORS = ["#fef08a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff"];
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background/60 p-2">
      <Textarea
        value={item.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="고칠 점을 적어두세요 (예: 제목 더 크게, 날짜 위치 아래로)"
        className="h-14 resize-none"
        style={{ fontSize: "14px" }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ color: c })}
            className={`h-5 w-5 rounded border ${item.color === c ? "ring-2 ring-blue-500" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <Button
          variant={item.done ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange({ done: !item.done })}
        >
          {item.done ? "✓ 처리됨" : "처리 표시"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange({ width: item.width === 220 ? 320 : 220 })}
        >
          너비 {item.width === 220 ? "넓게" : "좁게"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive"
          onClick={onDelete}
        >
          삭제
        </Button>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        연결선 끝 동그라미를 끌어 가리킬 곳을 정하세요 · 메모는 결과물에 안 찍힙니다
      </p>
    </div>
  );
}
