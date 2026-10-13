"use client";
// 선택된 텍스트의 속성 편집 바
import type { PlacedText } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import {
  listLocalFonts,
  ensureLocalFont,
  localFontValue,
  familyFromValue,
  type LocalFont,
} from "@/lib/local-fonts";

// 전부 구글 폰트(OFL) — 상업 사용 자유. 선택할 때 해당 폰트만 내려받는다.
export const FONT_CHOICES = [
  { label: "고딕 (기본)", value: "'Noto Sans KR', 'Malgun Gothic', sans-serif" },
  { label: "포스터 제목", value: "'Black Han Sans', 'Malgun Gothic', sans-serif" },
  { label: "둥근 제목", value: "'Do Hyeon', 'Malgun Gothic', sans-serif" },
  { label: "귀여운 제목", value: "'Jua', 'Malgun Gothic', sans-serif" },
  { label: "굵은 고딕", value: "'Gothic A1', 'Malgun Gothic', sans-serif" },
  { label: "명조", value: "'Nanum Myeongjo', Batang, serif" },
  { label: "고운 명조", value: "'Gowun Batang', Batang, serif" },
  { label: "얇은 명조", value: "'Song Myung', Batang, serif" },
  { label: "손글씨", value: "'Nanum Pen Script', cursive" },
  { label: "붓글씨", value: "'Nanum Brush Script', cursive" },
  { label: "삐뚤 손글씨", value: "'Gaegu', cursive" },
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
  // 이 PC 폰트 목록 (P3). 한 번만 받는다
  const [localFonts, setLocalFonts] = useState<LocalFont[]>([]);
  useEffect(() => {
    listLocalFonts().then(setLocalFonts);
  }, []);
  // 지금 값이 목록에 없는 PC 폰트(다른 PC에서 만든 보드)여도 선택 표시가 깨지지 않게
  const curFamily = familyFromValue(item.fontFamily);
  const known =
    FONT_CHOICES.some((f) => f.value === item.fontFamily) ||
    localFonts.some((f) => localFontValue(f.family) === item.fontFamily);

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
          onValueChange={(v) => {
            onChange({ fontFamily: v });
            const fam = familyFromValue(v);
            if (fam) ensureLocalFont(fam); // 내려받아지면 page 쪽에서 다시 그린다
          }}
        >
          <SelectTrigger className="h-7 w-[124px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectGroup>
              <SelectLabel className="text-[11px]">기본 (구글 폰트, 상업 사용 자유)</SelectLabel>
              {FONT_CHOICES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectGroup>
            {localFonts.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[11px]">
                  내 PC 폰트 {localFonts.length}개 · 사용권은 폰트마다 다름
                </SelectLabel>
                {localFonts.map((f) => (
                  <SelectItem key={f.file} value={localFontValue(f.family)}>
                    {f.family}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {!known && curFamily && (
              <SelectItem value={item.fontFamily}>{curFamily} (이 PC에 없음)</SelectItem>
            )}
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
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(item.fill) ? item.fill : "#111111"}
            onChange={(e) => onChange({ fill: e.target.value })}
            title="색 직접 고르기"
            className="h-6 w-7 cursor-pointer rounded border bg-transparent p-0"
          />
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
      <p className="px-1 text-[11px] text-muted-foreground">
        모서리 핸들을 끌면 크기·회전이 바뀝니다
      </p>
    </div>
  );
}
