"use client";
// 부분 수정 오버레이 (F-07): 선택한 이미지 위에 브러시로 칠하거나 점을 찍어
// 수정 영역을 지정한다. 적용 시 원본 해상도 마스크 PNG(알파=0=수정영역)를 돌려준다.
//
// 영역을 여러 개 잡을 수 있다. 마스크는 "어디를 고쳐라"만 담고 "어느 지시인지"는 못 담아서,
// 영역마다 위치를 말로 풀어(왼쪽 위 / 가로 12~30% 세로 5~18%) 한 문장으로 합쳐 보낸다.
// ponytail: 회전된 이미지는 미지원(오버레이가 회전을 안 따라감) — 필요해지면 transform 추가
import { useEffect, useRef, useState } from "react";
import type { PlacedImage } from "@/types/canvas";
import { Button } from "@/components/ui/button";

interface Props {
  image: PlacedImage;
  screenRect: { x: number; y: number; w: number; h: number };
  mode: "brush" | "point" | "text"; // text = 글자 위를 칠하고 새 문구 입력
  /** regions가 2개 이상이면 영역별 지시가 담긴다 (한 개면 기존과 같음) */
  onApply: (maskDataUrl: string, text?: string, regions?: RegionOut[]) => void;
  onCancel: () => void;
}

export interface RegionOut {
  label: number;
  /** "왼쪽 위 (가로 12~30%, 세로 5~18%)" */
  where: string;
  /** 이 영역에 내릴 지시 */
  instruction: string;
}

interface Stroke {
  x: number;
  y: number;
  r: number;
}

interface Region {
  label: number;
  strokes: Stroke[];
  instruction: string;
}

// 영역마다 다른 색으로 칠해서 어느 게 몇 번인지 눈으로 구분되게
const REGION_COLORS = [
  "rgba(255,40,40,0.55)",
  "rgba(40,120,255,0.55)",
  "rgba(30,180,90,0.55)",
  "rgba(240,150,20,0.55)",
  "rgba(170,60,220,0.55)",
  "rgba(0,175,195,0.55)",
];
const BADGE_COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#0891b2",
];

/** 영역의 위치를 사람 말로 — 모델이 어느 지시가 어느 자리인지 알아듣게 */
function describeWhere(strokes: Stroke[], w: number, h: number): string {
  const x0 = Math.min(...strokes.map((s) => s.x - s.r));
  const x1 = Math.max(...strokes.map((s) => s.x + s.r));
  const y0 = Math.min(...strokes.map((s) => s.y - s.r));
  const y1 = Math.max(...strokes.map((s) => s.y + s.r));
  const pct = (v: number, total: number) =>
    Math.round((Math.max(0, Math.min(total, v)) / total) * 100);
  const cx = (x0 + x1) / 2 / w;
  const cy = (y0 + y1) / 2 / h;
  const col = cx < 0.34 ? "왼쪽" : cx > 0.66 ? "오른쪽" : "가로 가운데";
  const row = cy < 0.34 ? "위" : cy > 0.66 ? "아래" : "세로 가운데";
  return `${col} ${row} (가로 ${pct(x0, w)}~${pct(x1, w)}%, 세로 ${pct(y0, h)}~${pct(y1, h)}%)`;
}

export function MaskEditor({
  image,
  screenRect,
  mode,
  onApply,
  onCancel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [newText, setNewText] = useState("");
  const [regions, setRegions] = useState<Region[]>([
    { label: 1, strokes: [], instruction: "" },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const drawing = useRef(false);

  useEffect(() => {
    const el = new window.Image();
    el.src = image.src;
    el.onload = () => setNatural({ w: el.naturalWidth, h: el.naturalHeight });
  }, [image.src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // 영역이 바뀔 때마다 오버레이를 다시 그린다 (색·번호가 항상 최신)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !natural) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, natural.w, natural.h);
    regions.forEach((rg, i) => {
      ctx.fillStyle = REGION_COLORS[i % REGION_COLORS.length];
      rg.strokes.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!rg.strokes.length || regions.length < 2) return;
      // 번호 배지 — 어느 색이 몇 번인지 그림 위에서 바로 보이게
      const bx = rg.strokes.reduce((a, s) => a + s.x, 0) / rg.strokes.length;
      const by = rg.strokes.reduce((a, s) => a + s.y, 0) / rg.strokes.length;
      const br = Math.max(18, natural.w / 34);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = BADGE_COLORS[i % BADGE_COLORS.length];
      ctx.fill();
      ctx.lineWidth = Math.max(2, br / 8);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(br * 1.25)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(rg.label), bx, by);
    });
  }, [regions, natural]);

  if (!natural) return null;

  // 포인트 반지름: 곰곰님 요청으로 기존 폭/20의 30%로 축소 (1024px 기준 50px → 15px).
  // 기존 값은 "이 크기면 모델이 사물 전체를 인식한다"는 1단계 실측치였으므로,
  // 작은 점이 대상을 덜 집어낼 수 있다 — 안 먹으면 두 번 찍거나 브러시로.
  const brushR = mode === "point" ? natural.w / 66.7 : natural.w / 24;
  const multi = mode !== "text"; // 글자수정은 한 덩어리로 다룬다
  const hasDrawing = regions.some((r) => r.strokes.length > 0);

  const toCanvasXY = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * natural.w,
      y: ((e.clientY - rect.top) / rect.height) * natural.h,
    };
  };

  const dot = (x: number, y: number) => {
    setRegions((prev) =>
      prev.map((rg, i) =>
        i === activeIdx
          ? { ...rg, strokes: [...rg.strokes, { x, y, r: brushR }] }
          : rg,
      ),
    );
  };

  /** 마스크는 모든 영역을 합친다 — 칠한 곳 전부가 "고칠 곳" */
  const buildMask = (): string => {
    const m = document.createElement("canvas");
    m.width = natural.w;
    m.height = natural.h;
    const ctx = m.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, m.width, m.height); // 흰 불투명 = 보존
    ctx.globalCompositeOperation = "destination-out"; // 칠한 곳 = 투명(수정)
    regions.forEach((rg) =>
      rg.strokes.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }),
    );
    return m.toDataURL("image/png");
  };

  const filled = regions.filter((r) => r.strokes.length > 0);
  const needInstruction =
    multi && filled.length > 1 && filled.some((r) => !r.instruction.trim());

  const apply = () => {
    const out: RegionOut[] | undefined =
      multi && filled.length > 1
        ? filled.map((r) => ({
            label: r.label,
            where: describeWhere(r.strokes, natural.w, natural.h),
            instruction: r.instruction.trim(),
          }))
        : undefined;
    onApply(buildMask(), newText.trim() || undefined, out);
  };

  return (
    <div
      className="fixed inset-0 z-40"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <canvas
        ref={canvasRef}
        width={natural.w}
        height={natural.h}
        className="absolute cursor-crosshair rounded-sm ring-2 ring-red-400"
        style={{
          left: screenRect.x,
          top: screenRect.y,
          width: screenRect.w,
          height: screenRect.h,
          backgroundImage: `url(${image.src})`,
          backgroundSize: "100% 100%",
        }}
        onPointerDown={(e) => {
          const p = toCanvasXY(e);
          if (mode === "point") {
            dot(p.x, p.y);
          } else {
            drawing.current = true;
            dot(p.x, p.y);
          }
        }}
        onPointerMove={(e) => {
          if (mode !== "point" && drawing.current) {
            const p = toCanvasXY(e);
            dot(p.x, p.y);
          }
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
      />

      {/* 상단 바 — 안내 + 지우기/취소/적용 */}
      <div
        className="absolute flex items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
        style={{ left: screenRect.x, top: Math.max(8, screenRect.y - 52) }}
      >
        <span className="text-xs text-muted-foreground">
          {mode === "text"
            ? "바꿀 글자를 칠하고 새 문구 입력"
            : filled.length > 1
              ? `영역 ${filled.length}곳 — 오른쪽에 각각 뭘 고칠지 쓰세요`
              : mode === "brush"
                ? "고칠 부분을 칠하세요 — 여러 곳이면 오른쪽 '영역 추가'"
                : "고칠 것을 콕 찍으세요 — 여러 곳이면 오른쪽 '영역 추가'"}
        </span>
        {mode === "text" && (
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="새 문구 (예: 10월 23~24일)"
            className="h-7 w-44 rounded-md border bg-background px-2 text-xs outline-none"
            style={{ fontSize: "13px" }}
            autoFocus
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            setRegions([{ label: 1, strokes: [], instruction: "" }]);
            setActiveIdx(0);
          }}
        >
          지우기
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          취소
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="h-7 text-xs"
          disabled={
            !hasDrawing ||
            (mode === "text" && !newText.trim()) ||
            needInstruction
          }
          title={
            needInstruction ? "영역마다 뭘 고칠지 적어야 합니다" : undefined
          }
          onClick={apply}
        >
          적용
        </Button>
      </div>

      {/* 오른쪽 영역 패널 — 번호마다 지시를 따로 적는다 */}
      {multi && (
        <div
          className="absolute flex max-h-[70vh] w-64 flex-col gap-2 overflow-y-auto rounded-xl border bg-card/95 p-2.5 shadow-lg backdrop-blur"
          style={{
            left: Math.min(
              screenRect.x + screenRect.w + 12,
              window.innerWidth - 268,
            ),
            top: screenRect.y,
          }}
        >
          {regions.map((rg, i) => (
            <div
              key={rg.label}
              onClick={() => setActiveIdx(i)}
              className={`cursor-pointer rounded-lg border p-2 transition-colors ${
                i === activeIdx ? "border-blue-500 bg-accent/50" : "bg-background/40"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{
                    backgroundColor: BADGE_COLORS[i % BADGE_COLORS.length],
                  }}
                >
                  {rg.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {rg.strokes.length
                    ? i === activeIdx
                      ? "칠하는 중"
                      : "칠함"
                    : "아직 안 칠함"}
                </span>
                {regions.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegions((prev) =>
                        prev
                          .filter((_, k) => k !== i)
                          .map((r, k) => ({ ...r, label: k + 1 })),
                      );
                      setActiveIdx((k) => (k >= i && k > 0 ? k - 1 : k));
                    }}
                    className="ml-auto text-[11px] text-destructive hover:underline"
                  >
                    지움
                  </button>
                )}
              </div>
              <textarea
                value={rg.instruction}
                onChange={(e) =>
                  setRegions((prev) =>
                    prev.map((r, k) =>
                      k === i ? { ...r, instruction: e.target.value } : r,
                    ),
                  )
                }
                onClick={(e) => e.stopPropagation()}
                placeholder={
                  i === 0
                    ? "예: 로고를 파란색으로"
                    : "예: 날짜를 4월 6일로"
                }
                rows={2}
                className="w-full resize-none rounded-md border bg-background px-2 py-1 text-xs outline-none"
                style={{ fontSize: "13px" }}
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={
              regions.length >= REGION_COLORS.length ||
              !regions[activeIdx]?.strokes.length
            }
            title={
              !regions[activeIdx]?.strokes.length
                ? "지금 영역을 먼저 칠하세요"
                : undefined
            }
            onClick={() => {
              setRegions((prev) => [
                ...prev,
                { label: prev.length + 1, strokes: [], instruction: "" },
              ]);
              setActiveIdx(regions.length);
            }}
          >
            + 영역 추가
          </Button>
          <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
            영역이 하나면 지시는 아래 프롬프트 창을 씁니다. 둘 이상이면 여기 적은
            내용이 위치와 함께 한 번에 전달됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
