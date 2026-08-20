"use client";
// 부분 수정 오버레이 (F-07): 선택한 이미지 위에 브러시로 칠하거나 점을 찍어
// 수정 영역을 지정한다. 적용 시 원본 해상도 마스크 PNG(알파=0=수정영역)를 돌려준다.
// ponytail: 회전된 이미지는 미지원(오버레이가 회전을 안 따라감) — 필요해지면 transform 추가
import { useEffect, useRef, useState } from "react";
import type { PlacedImage } from "@/types/canvas";
import { Button } from "@/components/ui/button";

interface Props {
  image: PlacedImage;
  screenRect: { x: number; y: number; w: number; h: number };
  mode: "brush" | "point" | "text"; // text = 글자 위를 칠하고 새 문구 입력
  onApply: (maskDataUrl: string, text?: string) => void;
  onCancel: () => void;
}

export function MaskEditor({ image, screenRect, mode, onApply, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [newText, setNewText] = useState("");
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

  if (!natural) return null;

  // 포인트 반지름은 1단계 실증값(1024px 기준 50px = 폭/20) — 이 크기로도 모델이 사물 전체를 인식함
  const brushR = mode === "point" ? natural.w / 20 : natural.w / 24;

  const toCanvasXY = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * natural.w,
      y: ((e.clientY - rect.top) / rect.height) * natural.h,
    };
  };

  const dot = (x: number, y: number) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = "rgba(255,40,40,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, brushR, 0, Math.PI * 2);
    ctx.fill();
    setHasDrawing(true);
  };

  const buildMask = (): string => {
    const m = document.createElement("canvas");
    m.width = natural.w;
    m.height = natural.h;
    const ctx = m.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, m.width, m.height); // 흰 불투명 = 보존
    ctx.globalCompositeOperation = "destination-out"; // 칠한 곳 = 투명(수정)
    ctx.drawImage(canvasRef.current!, 0, 0);
    return m.toDataURL("image/png");
  };

  return (
    <div className="fixed inset-0 z-40" onPointerDown={(e) => e.stopPropagation()}>
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
      <div
        className="absolute flex items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
        style={{ left: screenRect.x, top: Math.max(8, screenRect.y - 52) }}
      >
        <span className="text-xs text-muted-foreground">
          {mode === "text"
            ? "바꿀 글자를 칠하고 새 문구 입력"
            : mode === "brush"
              ? "고칠 부분을 칠하고 적용 — 내용은 아래 프롬프트 창"
              : "고칠 것을 콕 찍고 적용 — 내용은 아래 프롬프트 창"}
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
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.clearRect(0, 0, natural.w, natural.h);
            setHasDrawing(false);
          }}
        >
          지우기
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          취소
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="h-7 text-xs"
          disabled={!hasDrawing || (mode === "text" && !newText.trim())}
          onClick={() => onApply(buildMask(), newText.trim() || undefined)}
        >
          적용
        </Button>
      </div>
    </div>
  );
}
