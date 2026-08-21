"use client";
// 선택된 텍스트의 속성 편집 바
import type { PlacedText } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 한글이 정상 표시되는 계열만 (Windows/맥 공통 대비 폴백 포함)
export const FONT_CHOICES = [
  { label: "고딕 (기본)", value: "'Noto Sans KR', 'Malgun Gothic', sans-serif" },
  { label: "포스터 제목", value: "'Black Han Sans', 'Malgun Gothic', sans-serif" },
  { label: "명조", value: "'Nanum Myeongjo', Batang, serif" },
  { label: "손글씨", value: "'Nanum Pen Script', cursive" },
];

const PRESET_COLORS = [
  "#ffffff",
  "#111111",
  "#e11d48",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#7c3aed",
];

interface Props {
  item: PlacedText;
  onChange: (patch: Partial<PlacedText>) => void;
  onDelete: () => void;
}

export function TextToolbar({ item, onChange, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background/60 p-2">
      <Textarea
        value={item.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="문구를 입력하세요 (줄바꿈 가능)"
        className="h-14 resize-none"
        style={{ fontSize: "14px" }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={item.fontFamily}
          onValueChange={(v) => onChange({ fontFamily: v })}
        >
          <SelectTrigger className="h-7 w-[118px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_CHOICES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() =>
              onChange({ fontSize: Math.max(8, item.fontSize - 4) })
            }
          >
            −
          </Button>
          <span className="w-8 text-center text-xs tabular-nums">
            {item.fontSize}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => onChange({ fontSize: item.fontSize + 4 })}
          >
            +
          </Button>
        </div>

        <Button
          variant={item.bold ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-7 p-0 text-xs font-bold"
          onClick={() => onChange({ bold: !item.bold })}
          title="굵게"
        >
          B
        </Button>

        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ fill: c })}
              title={c}
              className={`h-5 w-5 rounded-full border ${
                item.fill === c ? "ring-2 ring-blue-500" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <Button
          variant={item.stroke ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onChange({
              stroke: item.stroke
                ? undefined
                : item.fill === "#ffffff"
                  ? "#111111"
                  : "#ffffff",
            })
          }
          title="배경과 겹칠 때 글자를 또렷하게"
        >
          테두리
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
    </div>
  );
}
