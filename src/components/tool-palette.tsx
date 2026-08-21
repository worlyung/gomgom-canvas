"use client";
// 왼쪽 세로 도구 팔레트 — 캔버스에 무언가를 "얹는" 도구들.
// 하단 바(생성 설정)와 성격이 달라 분리했다.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShapeKind } from "@/types/canvas";

interface Props {
  onAddText: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddNote: () => void;
  onUpload: () => void;
}

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "▭ 사각형 (강조 박스)" },
  { kind: "ellipse", label: "◯ 동그라미" },
  { kind: "triangle", label: "△ 세모" },
  { kind: "star", label: "★ 별" },
  { kind: "arrow", label: "↗ 화살표" },
  { kind: "line", label: "╱ 선" },
];

function ToolButton({
  onClick,
  glyph,
  label,
}: {
  onClick?: () => void;
  glyph: string;
  label: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors hover:bg-accent"
          >
            {glyph}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span className="text-xs">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ToolPalette({
  onAddText,
  onAddShape,
  onAddNote,
  onUpload,
}: Props) {
  return (
    <div className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-0.5 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur md:flex">
      <ToolButton
        glyph="📎"
        label="업로드 — 이미지·제안서(md·PDF)"
        onClick={onUpload}
      />
      <div className="my-1 h-px bg-border" />
      <ToolButton glyph="T" label="텍스트 — 진짜 폰트로 정확한 글자" onClick={onAddText} />

      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors hover:bg-accent">
                    ◇
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  {SHAPES.map((sp) => (
                    <DropdownMenuItem
                      key={sp.kind}
                      onClick={() => onAddShape(sp.kind)}
                    >
                      {sp.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span className="text-xs">도형 — 박스·원·세모·화살표</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ToolButton
        glyph="📝"
        label="메모 — 검토 의견 (결과물엔 안 찍힘)"
        onClick={onAddNote}
      />
    </div>
  );
}
