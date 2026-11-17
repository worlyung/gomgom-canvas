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
import { useEffect, useRef, useState } from "react";
import {
  listLocalFonts,
  ensureLocalFont,
  localFontValue,
  familyFromValue,
  type LocalFont,
  importFont,
  importedFonts,
} from "@/lib/local-fonts";

// 전부 구글 폰트(OFL) — 상업 사용 자유. 선택할 때 해당 폰트만 내려받는다.
export const FONT_CHOICES = [
  {
    label: "고딕 (기본)",
    value: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
  },
  {
    label: "포스터 제목",
    value: "'Black Han Sans', 'Malgun Gothic', sans-serif",
  },
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
  const fontInput = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ family: string; name: string }[]>(
    [],
  );
  const [fontStatus, setFontStatus] = useState("");
  useEffect(() => {
    importedFonts()
      .then(setUploads)
      .catch(() => setFontStatus("저장한 폰트를 읽지 못했습니다."));
  }, []);
  // 이 PC 폰트 목록 (P3). 한 번만 받는다
  const [localFonts, setLocalFonts] = useState<LocalFont[]>([]);
  useEffect(() => {
    listLocalFonts().then(setLocalFonts);
  }, []);
  // 지금 값이 목록에 없는 PC 폰트(다른 PC에서 만든 보드)여도 선택 표시가 깨지지 않게
  const curFamily = familyFromValue(item.fontFamily);
  const known =
    FONT_CHOICES.some((f) => f.value === item.fontFamily) ||
    localFonts.some((f) => localFontValue(f.family) === item.fontFamily) ||
    uploads.some((f) => localFontValue(f.family) === item.fontFamily);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3"
      data-testid="text-properties"
    >
      <strong className="text-sm">글자 편집</strong>
      <Textarea
        aria-label="글자 내용"
        value={item.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="문구를 입력하세요 (줄바꿈 가능)"
        className="min-h-28 resize-y"
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
          <SelectTrigger aria-label="글꼴" className="h-9 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {uploads.length > 0 && (
              <SelectGroup>
                <SelectLabel>내가 추가한 폰트</SelectLabel>
                {uploads.map((f) => (
                  <SelectItem key={f.family} value={localFontValue(f.family)}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel className="text-[11px]">
                기본 (구글 폰트, 상업 사용 자유)
              </SelectLabel>
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
              <SelectItem value={item.fontFamily}>
                {curFamily} (이 PC에 없음)
              </SelectItem>
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
      <input
        ref={fontInput}
        type="file"
        accept=".ttf,.otf"
        className="sr-only"
        aria-label="내 폰트 파일"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setFontStatus("폰트를 불러오는 중…");
          try {
            const family = await importFont(file);
            setUploads(await importedFonts());
            onChange({ fontFamily: localFontValue(family) });
            setFontStatus(`${file.name} 적용됨`);
          } catch (error) {
            setFontStatus(
              error instanceof Error
                ? error.message
                : "폰트를 불러오지 못했습니다.",
            );
          }
        }}
      />
      <Button variant="outline" onClick={() => fontInput.current?.click()}>
        내 폰트 넣기 · TTF / OTF
      </Button>
      {fontStatus && (
        <p role="status" className="text-xs">
          {fontStatus}
        </p>
      )}
      {!known && curFamily && (
        <p className="text-xs text-amber-600">
          이 글꼴이 없어 대체 글꼴로 표시됩니다. 원래 폰트 파일을 넣어 주세요.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["글자 크기", "fontSize", item.fontSize, 8, 1000, 1],
            ["자간", "letterSpacing", item.letterSpacing ?? 0, -10, 100, 1],
            ["줄간격", "lineHeight", item.lineHeight ?? 1, 0.5, 4, 0.05],
            [
              "외곽선 두께",
              "strokeWidth",
              item.strokeWidth ?? Math.max(1, item.fontSize / 18),
              0,
              50,
              1,
            ],
          ] as const
        ).map(([label, key, value, min, max, step]) => (
          <label key={key} className="text-xs">
            {label}
            <input
              aria-label={label}
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              className="mt-1 w-full rounded border bg-background p-2"
              onChange={(e) => {
                if (e.target.value !== "")
                  onChange({
                    [key]: Math.min(max, Math.max(min, Number(e.target.value))),
                  });
              }}
            />
          </label>
        ))}
        <label className="text-xs">
          글자색
          <input
            aria-label="글자색"
            type="color"
            value={item.fill}
            onChange={(e) => onChange({ fill: e.target.value })}
            className="block h-9 w-full"
          />
        </label>
        <label className="text-xs">
          외곽선색
          <input
            aria-label="외곽선색"
            type="color"
            value={item.stroke || "#ffffff"}
            onChange={(e) => onChange({ stroke: e.target.value })}
            className="block h-9 w-full"
          />
        </label>
      </div>
      <div className="flex gap-1" aria-label="글자 정렬">
        {(
          [
            ["left", "왼쪽 정렬"],
            ["center", "가운데 정렬"],
            ["right", "오른쪽 정렬"],
          ] as const
        ).map(([align, label]) => (
          <Button
            key={align}
            size="sm"
            variant={(item.align || "left") === align ? "secondary" : "outline"}
            onClick={() => onChange({ align })}
          >
            {label}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!item.shadowColor}
          onChange={(e) =>
            onChange({
              shadowColor: e.target.checked ? "#000000" : undefined,
              shadowBlur: item.shadowBlur ?? 6,
              shadowOffset: item.shadowOffset ?? 3,
            })
          }
        />
        그림자
      </label>
      {item.shadowColor && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            그림자색
            <input
              aria-label="그림자색"
              type="color"
              value={item.shadowColor}
              onChange={(e) => onChange({ shadowColor: e.target.value })}
            />
          </label>
          <label className="text-xs">
            흐림
            <input
              aria-label="그림자 흐림"
              type="number"
              min="0"
              max="50"
              value={item.shadowBlur ?? 6}
              onChange={(e) =>
                onChange({
                  shadowBlur: Math.max(0, Math.min(50, Number(e.target.value))),
                })
              }
              className="w-full border rounded bg-background p-2"
            />
          </label>
        </div>
      )}
      <p className="px-1 text-[11px] text-muted-foreground">
        추가한 폰트는 이 브라우저에 저장됩니다. 다른 PC에서는 같은 폰트 파일을
        추가해 주세요.
      </p>
    </div>
  );
}
