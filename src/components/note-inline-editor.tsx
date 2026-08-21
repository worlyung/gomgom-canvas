"use client";
// 메모지 위에 그대로 얹히는 편집기.
// 하단 바에서 고치면 바가 메모를 가려서 어디를 가리키는 메모인지 안 보였다.
// 그래서 글은 메모지에서 바로 쓰고, 색·옵션만 옆에 작은 팝업으로 띄운다.
import { useEffect, useRef } from "react";
import type { PlacedNote } from "@/types/canvas";
import {
  NOTE_FONT,
  NOTE_LINE_HEIGHT,
  NOTE_PAD,
  NOTE_WIDTH_NARROW,
  NOTE_WIDTH_WIDE,
  noteHeight,
} from "@/components/canvas/CanvasNote";

const NOTE_COLORS = ["#fef08a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff"];

interface Props {
  item: PlacedNote;
  viewport: { x: number; y: number; scale: number };
  onChange: (patch: Partial<PlacedNote>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NoteInlineEditor({
  item,
  viewport,
  onChange,
  onDelete,
  onClose,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // 메모를 고르면 바로 타이핑할 수 있게 (커서는 글 끝에)
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [item.id]);

  const s = viewport.scale;
  const left = item.x * s + viewport.x;
  const top = item.y * s + viewport.y;
  const w = item.width * s;
  const h = noteHeight(item.text, item.width) * s;

  // 팝업은 메모 오른쪽에, 화면 밖으로 나가면 왼쪽으로 접는다
  const popupOnLeft =
    typeof window !== "undefined" && left + w + 200 > window.innerWidth;

  return (
    <>
      {/* 메모지 본문 — 캔버스 글자와 같은 크기·여백이라 자리가 그대로다 */}
      <textarea
        ref={ref}
        value={item.text}
        onChange={(e) => onChange({ text: e.target.value })}
        onKeyDown={(e) => {
          e.stopPropagation(); // 캔버스 단축키(삭제·복사)로 새지 않게
          if (e.key === "Escape") onClose();
        }}
        placeholder="고칠 점을 적어두세요 (예: 제목 더 크게)"
        spellCheck={false}
        className="absolute z-30 resize-none rounded-[6px] border-0 bg-transparent text-[#3f3f46] outline-none placeholder:text-[#3f3f46]/40"
        style={{
          left: left + NOTE_PAD * s,
          top: top + NOTE_PAD * s,
          width: w - NOTE_PAD * 2 * s,
          height: h - NOTE_PAD * 2 * s,
          fontSize: NOTE_FONT * s,
          lineHeight: NOTE_LINE_HEIGHT,
          fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
          textDecoration: item.done ? "line-through" : undefined,
        }}
      />

      {/* 옵션 팝업 — 메모를 안 가리게 옆에 붙는다 */}
      <div
        className="absolute z-30 flex flex-col gap-2 rounded-xl border bg-popover/95 p-2 shadow-lg backdrop-blur"
        style={{
          left: popupOnLeft ? undefined : left + w + 8,
          right: popupOnLeft ? window.innerWidth - left + 8 : undefined,
          top,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              title="메모지 색"
              className={`h-5 w-5 rounded border ${item.color === c ? "ring-2 ring-blue-500" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ done: !item.done })}
            className={`rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent ${item.done ? "bg-secondary" : ""}`}
          >
            {item.done ? "✓ 처리됨" : "처리 표시"}
          </button>
          <button
            onClick={() =>
              onChange({
                width:
                  item.width >= NOTE_WIDTH_WIDE
                    ? NOTE_WIDTH_NARROW
                    : NOTE_WIDTH_WIDE,
              })
            }
            className="rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent"
          >
            너비 {item.width >= NOTE_WIDTH_WIDE ? "좁게" : "넓게"}
          </button>
          <button
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            삭제
          </button>
        </div>
        <p className="max-w-[200px] text-[11px] leading-snug text-muted-foreground">
          연결선 끝 동그라미를 끌어 가리킬 곳을 정하세요 · 메모는 결과물에 안
          찍힙니다
        </p>
      </div>
    </>
  );
}
