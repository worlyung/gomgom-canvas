"use client";
// 포스터 판(아트보드) 대화상자 (P2) — 규격 고르기 · 판 만들기/없애기 · 화면 맞춤 · 인쇄용 PNG 내보내기
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAPER_PRESETS, mmToPx, DEFAULT_DPI } from "@/lib/artboard";
import type { Artboard } from "@/types/canvas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artboard: Artboard | null;
  exporting: string; // 진행 문구. 비어 있으면 대기
  onCreate: (widthMm: number, heightMm: number, name: string) => void;
  onRemove: () => void;
  onFit: () => void;
  onExport: () => void;
}

export function ArtboardDialog({
  open,
  onOpenChange,
  artboard,
  exporting,
  onCreate,
  onRemove,
  onFit,
  onExport,
}: Props) {
  const [presetId, setPresetId] = useState("A2");
  const [landscape, setLandscape] = useState(false);
  const [customW, setCustomW] = useState("420");
  const [customH, setCustomH] = useState("594");

  const preset = PAPER_PRESETS.find((p) => p.id === presetId)!;
  let w = preset.id === "custom" ? Number(customW) || 0 : preset.w;
  let h = preset.id === "custom" ? Number(customH) || 0 : preset.h;
  if (landscape) [w, h] = [h, w];
  const valid = w >= 50 && h >= 50 && w <= 3000 && h <= 3000;
  const name =
    preset.id === "custom" ? `${w}x${h}mm` : `${preset.id} ${landscape ? "가로" : "세로"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>포스터 판</DialogTitle>
          <DialogDescription>
            인쇄 크기의 흰 판을 캔버스에 깔고, 내보낼 때 그 안만 {DEFAULT_DPI}dpi로 굽습니다.
            글씨·도형 레이어는 그대로 남아 나중에 고쳐 다시 뽑을 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {artboard && (
          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="font-medium">지금 판: {artboard.name}</div>
            <div className="text-xs text-muted-foreground">
              {artboard.widthMm}×{artboard.heightMm}mm · {artboard.width}×{artboard.height}px ·{" "}
              {artboard.dpi}dpi
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onFit}>
                화면 맞춤
              </Button>
              <Button size="sm" onClick={onExport} disabled={!!exporting}>
                {exporting || "인쇄용 PNG 내보내기"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onRemove} disabled={!!exporting}>
                판 없애기
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">
            {artboard ? "다른 크기로 바꾸기" : "새 판 만들기"}
          </div>
          <div className="flex gap-2">
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={landscape ? "default" : "secondary"}
              onClick={() => setLandscape((v) => !v)}
              title="가로/세로 바꾸기"
            >
              {landscape ? "가로" : "세로"}
            </Button>
          </div>
          {preset.id === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <Input
                type="number"
                value={customW}
                onChange={(e) => setCustomW(e.target.value)}
                className="w-24"
                min={50}
                max={3000}
              />
              <span>×</span>
              <Input
                type="number"
                value={customH}
                onChange={(e) => setCustomH(e.target.value)}
                className="w-24"
                min={50}
                max={3000}
              />
              <span className="text-muted-foreground">mm</span>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {valid
              ? `${w}×${h}mm → ${mmToPx(w)}×${mmToPx(h)}px (${DEFAULT_DPI}dpi)`
              : "50~3000mm 사이로 넣어 주세요"}
          </div>
          <Button
            className="w-full"
            disabled={!valid || !!exporting}
            onClick={() => {
              onCreate(w, h, name);
              onOpenChange(false);
            }}
          >
            {artboard ? "이 크기로 판 바꾸기" : "판 만들기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
