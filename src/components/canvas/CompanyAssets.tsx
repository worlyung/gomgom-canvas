"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const assets = [
  { file: "horizontal.png", name: "가로형 CI" },
  { file: "alternate.png", name: "가로형 CI · 다른 버전" },
  { file: "portrait.png", name: "세로형 CI 원본" },
  { file: "english-horizontal.png", name: "영문 CI · 가로형 (투명)" },
  { file: "english-vertical.png", name: "영문 CI · 세로형 (투명)" },
];

export function CompanyAssets({
  onInsert,
}: {
  onInsert: (image: {
    src: string;
    width: number;
    height: number;
    name: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function insert(asset: (typeof assets)[number]) {
    setBusy(asset.file);
    setError("");
    try {
      const response = await fetch(`/brand/arts-foret/${asset.file}`);
      if (!response.ok) throw new Error("CI 파일을 불러오지 못했어요.");
      const blob = await response.blob();
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("CI 파일을 읽지 못했어요."));
        reader.readAsDataURL(blob);
      });
      const size = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new window.Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("CI 이미지를 열지 못했어요."));
          image.src = src;
        },
      );
      await onInsert({ src, ...size, name: `예술숲 ${asset.name}` });
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "CI를 추가하지 못했어요. 다시 선택해 주세요.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>예술숲 CI</button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>예술숲 CI</DialogTitle>
          <DialogDescription>
            골라서 캔버스에 넣으세요. 원본의 배경·여백·비율을 그대로 유지해요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {assets.map((asset) => (
            <button
              key={asset.file}
              disabled={busy !== null}
              onClick={() => void insert(asset)}
              aria-label={`${asset.name} 넣기`}
              className="rounded-xl border p-3 text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <div className="relative mb-3 h-28 rounded-lg bg-stone-200">
                <Image
                  src={`/brand/arts-foret/${asset.file}`}
                  alt={asset.name}
                  fill
                  sizes="240px"
                  unoptimized
                  className="object-contain p-2"
                />
              </div>
              <span className="text-sm font-medium">{asset.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {busy === asset.file ? "넣는 중…" : "캔버스에 넣기"}
              </span>
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
