"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MapWindow = Window & {
  exportMapForCanvas?: () => Promise<{ blob: Blob; name: string }>;
};

export function MapStudio({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (blob: Blob, name: string) => Promise<void>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function importMap() {
    setBusy(true);
    setError("");
    try {
      const exportMap = (frame.current?.contentWindow as MapWindow | null)
        ?.exportMapForCanvas;
      if (!exportMap)
        throw new Error(
          "지도 편집기를 불러오는 중이에요. 잠시 후 다시 눌러주세요.",
        );
      const { blob, name } = await exportMap();
      await onImport(blob, name);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "지도를 가져오지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-2 p-4"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-wrap items-center gap-3 pr-10">
          <div className="flex-1">
            <DialogTitle>대한민국 지도 만들기</DialogTitle>
            <DialogDescription className="mt-1">
              지역과 색을 꾸민 뒤 지도 이미지를 캔버스에 넣으세요.
              SVG·PNG·PPTX로 따로 저장할 수도 있어요.
            </DialogDescription>
          </div>
          <Button disabled={busy} onClick={importMap}>
            {busy ? "지도를 넣는 중…" : "캔버스에 넣기"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <iframe
          ref={frame}
          title="대한민국 지도 편집기"
          src="/krmap/index.html"
          className="min-h-0 flex-1 rounded-lg border bg-white"
        />
      </DialogContent>
    </Dialog>
  );
}
