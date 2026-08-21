"use client";
// 왼쪽 세로 도구 팔레트.
// 성격별로 묶는다: 얹기(캔버스에 요소 추가) / 수정(고르기) / 전개(화면 넓히기) / 생성(새 결과물).
// 이미지 대상 도구는 이미지를 하나 골랐을 때만 켜진다.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  /** 컨텍스트 메뉴와 같은 액션 문자열 — brush|point|text|cutout|removebg|expand-<size>|cardnews */
  onEditAction: (action: string) => void;
  /** 이미지가 정확히 한 장 선택됐을 때만 이미지 도구가 켜진다 */
  imageSelected: boolean;
}

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "▭ 사각형 (강조 박스)" },
  { kind: "ellipse", label: "◯ 동그라미" },
  { kind: "triangle", label: "△ 세모" },
  { kind: "star", label: "★ 별" },
  { kind: "arrow", label: "↗ 화살표" },
  { kind: "line", label: "╱ 선" },
];

const FIX_ACTIONS = [
  { action: "brush", label: "🖌 부분수정 — 고칠 부분 칠하기" },
  { action: "point", label: "📍 포인트수정 — 고칠 것 콕 찍기" },
  { action: "text", label: "✏️ 글자수정 — 글자 칠하고 새 문구" },
];

const CUT_ACTIONS = [
  { action: "cutout", label: "✂️ 오려내기 — 원본 그대로, 배경만 투명 (무료)" },
  { action: "removebg", label: "🫥 배경 제거 — AI가 피사체를 다시 그림" },
];

const EXPAND_ACTIONS = [
  { action: "expand-1536x1024", label: "↔ 가로로 전개" },
  { action: "expand-1024x1536", label: "↕ 세로로 전개" },
  { action: "expand-1024x1024", label: "⬜ 정사각 전개" },
];

function ToolButton({
  onClick,
  glyph,
  label,
  disabled,
}: {
  onClick?: () => void;
  glyph: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
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

/** 드롭다운을 여는 도구 버튼 — 툴팁과 메뉴를 같이 단다. */
function MenuTool({
  glyph,
  label,
  disabled,
  children,
}: {
  glyph: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <button
                  disabled={disabled}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  {glyph}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-72">
                {children}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
  onEditAction,
  imageSelected,
}: Props) {
  const need = imageSelected ? "" : " (이미지를 한 장 고르세요)";

  return (
    <div className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-0.5 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur md:flex">
      {/* --- 얹기: 캔버스에 요소를 올린다 --- */}
      <ToolButton
        glyph="📎"
        label="업로드 — 이미지·제안서(md·PDF)"
        onClick={onUpload}
      />
      <ToolButton
        glyph="T"
        label="텍스트 — 진짜 폰트로 정확한 글자"
        onClick={onAddText}
      />
      <MenuTool glyph="◇" label="도형 — 박스·원·세모·화살표">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          도형
        </DropdownMenuLabel>
        {SHAPES.map((sp) => (
          <DropdownMenuItem key={sp.kind} onClick={() => onAddShape(sp.kind)}>
            {sp.label}
          </DropdownMenuItem>
        ))}
      </MenuTool>
      <ToolButton
        glyph="📝"
        label="메모 — 검토 의견 (결과물엔 안 찍힘)"
        onClick={onAddNote}
      />

      <div className="my-1 h-px bg-border" />

      {/* --- 수정: 고른 이미지를 고친다 --- */}
      <MenuTool
        glyph="🖌"
        label={"수정 — 부분·포인트·글자" + need}
        disabled={!imageSelected}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          고친 자리만 바꿉니다
        </DropdownMenuLabel>
        {FIX_ACTIONS.map((a) => (
          <DropdownMenuItem key={a.action} onClick={() => onEditAction(a.action)}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </MenuTool>

      {/* --- 분리: 피사체와 배경을 가른다 --- */}
      <MenuTool
        glyph="✂️"
        label={"배경 분리 — 오려내기·배경 제거" + need}
        disabled={!imageSelected}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          배경을 걷어냅니다
        </DropdownMenuLabel>
        {CUT_ACTIONS.map((a) => (
          <DropdownMenuItem key={a.action} onClick={() => onEditAction(a.action)}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </MenuTool>

      <div className="my-1 h-px bg-border" />

      {/* --- 전개: 화면을 넓힌다 --- */}
      <MenuTool
        glyph="⤢"
        label={"전개 — 화면 비율 넓히기" + need}
        disabled={!imageSelected}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          원본은 그대로 두고 여백을 채웁니다
        </DropdownMenuLabel>
        {EXPAND_ACTIONS.map((a) => (
          <DropdownMenuItem key={a.action} onClick={() => onEditAction(a.action)}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </MenuTool>

      {/* --- 생성: 새 결과물을 만든다 --- */}
      <MenuTool
        glyph="🗂"
        label={"생성 — 카드뉴스 내용 페이지" + need}
        disabled={!imageSelected}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          고른 이미지를 표지로 삼습니다
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onEditAction("cardnews")}>
          🗂 카드뉴스 페이지 생성
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          캠페인 통째 만들기는 아래 입력창에 있습니다
        </DropdownMenuLabel>
      </MenuTool>
    </div>
  );
}
