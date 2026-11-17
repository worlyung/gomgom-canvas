"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KImage } from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CanvasText } from "@/components/canvas/CanvasText";
import { CanvasShape } from "@/components/canvas/CanvasShape";
import { TextToolbar, FONT_CHOICES } from "@/components/text-toolbar";
import { ensureLocalFont, familyFromValue } from "@/lib/local-fonts";
import type { PlacedImage, PlacedText, PlacedShape } from "@/types/canvas";

export interface FocusDocument {
  bounds: { x: number; y: number; width: number; height: number };
  images: PlacedImage[];
  texts: PlacedText[];
  shapes: PlacedShape[];
}

function FocusImage({
  item,
  selected,
  select,
  change,
}: {
  item: PlacedImage;
  selected: boolean;
  select: () => void;
  change: (patch: Partial<PlacedImage>) => void;
}) {
  const [image] = useImage(item.src, "anonymous");
  return (
    <KImage
      id={item.id}
      image={image}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      opacity={item.opacity ?? 1}
      crop={
        item.cropX !== undefined && image
          ? {
              x: (item.cropX || 0) * image.naturalWidth,
              y: (item.cropY || 0) * image.naturalHeight,
              width: (item.cropWidth || 1) * image.naturalWidth,
              height: (item.cropHeight || 1) * image.naturalHeight,
            }
          : undefined
      }
      stroke={selected ? "#3b82f6" : undefined}
      strokeWidth={selected ? 2 : 0}
      draggable={!item.locked}
      onClick={select}
      onTap={select}
      onDragStart={select}
      onDragEnd={(e) => change({ x: e.target.x(), y: e.target.y() })}
    />
  );
}

export function PosterFocusEditor({
  initial,
  onFinish,
}: {
  initial: FocusDocument;
  onFinish: (result: FocusDocument) => void;
}) {
  const [doc, setDoc] = useState(initial);
  const [selected, setSelected] = useState("");
  const [size, setSize] = useState({ width: 800, height: 700 });
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<FocusDocument[]>([]);
  const [message, setMessage] = useState("");
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const stage = useRef<Konva.Stage>(null);
  const b = initial.bounds;
  const scale =
    Math.min((size.width - 64) / b.width, (size.height - 64) / b.height) * zoom;
  const offset = {
    x: (size.width - b.width * scale) / 2 - b.x * scale,
    y: (size.height - b.height * scale) / 2 - b.y * scale,
  };
  useEffect(() => {
    const el = container;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [container]);
  useEffect(() => {
    const redraw = () => {
      stage.current?.find(".canvas-text").forEach((n) => {
        const t = n as Konva.Text;
        t.text(t.text());
      });
      stage.current?.batchDraw();
    };
    doc.texts.forEach((t) => {
      const f = familyFromValue(t.fontFamily);
      if (f) ensureLocalFont(f).then(redraw);
    });
    document.fonts.addEventListener("loadingdone", redraw);
    document.addEventListener("gomgom-font-loaded", redraw);
    return () => {
      document.fonts.removeEventListener("loadingdone", redraw);
      document.removeEventListener("gomgom-font-loaded", redraw);
    };
  }, [doc.texts]);
  const change = (next: FocusDocument) => {
    setHistory((h) => [...h.slice(-49), doc]);
    setDoc(next);
  };
  const updateText = (id: string, patch: Partial<PlacedText>) =>
    change({
      ...doc,
      texts: doc.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const updateShape = (id: string, patch: Partial<PlacedShape>) =>
    change({
      ...doc,
      shapes: doc.shapes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const updateImage = (id: string, patch: Partial<PlacedImage>) =>
    change({
      ...doc,
      images: doc.images.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const entries = [
    ...doc.images.map((item) => ({ kind: "image" as const, item })),
    ...doc.shapes.map((item) => ({ kind: "shape" as const, item })),
    ...doc.texts.map((item) => ({ kind: "text" as const, item })),
  ].sort((a, c) => (a.item.z ?? 0) - (c.item.z ?? 0));
  const text = doc.texts.find((t) => t.id === selected);
  const image = doc.images.find((t) => t.id === selected);
  function toggle(id: string, flag: "hidden" | "locked") {
    const item = entries.find((e) => e.item.id === id)?.item;
    if (!item) return;
    change({
      ...doc,
      images: doc.images.map((t) =>
        t.id === id ? { ...t, [flag]: !item[flag] } : t,
      ),
      texts: doc.texts.map((t) =>
        t.id === id ? { ...t, [flag]: !item[flag] } : t,
      ),
      shapes: doc.shapes.map((t) =>
        t.id === id ? { ...t, [flag]: !item[flag] } : t,
      ),
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onFinish(doc);
      }}
    >
      <DialogContent
        className="poster-focus-dialog"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 border-b px-5 py-3 pr-14">
          <div className="mr-auto">
            <DialogTitle>포스터 집중 편집</DialogTitle>
            <DialogDescription>
              글자와 요소를 직접 수정하세요. 돌아가면 전체 캔버스에 반영됩니다.
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            disabled={!history.length}
            onClick={() => {
              setDoc(history[history.length - 1]);
              setHistory((h) => h.slice(0, -1));
            }}
          >
            되돌리기
          </Button>
          <Button onClick={() => onFinish(doc)}>전체 캔버스로 돌아가기</Button>
        </header>
        <div className="poster-focus-body">
          <section
            className="relative min-h-0 min-w-0 bg-muted/40"
            ref={setContainer}
            aria-label="집중 편집 작업 영역"
          >
            <Stage
              ref={stage}
              width={size.width}
              height={size.height}
              x={offset.x}
              y={offset.y}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage()) setSelected("");
              }}
            >
              <Layer>
                <Rect {...b} fill="white" listening={false} />
                {entries.map(({ kind, item }) =>
                  item.hidden ? null : kind === "text" ? (
                    <CanvasText
                      key={item.id}
                      item={item as PlacedText}
                      isSelected={selected === item.id}
                      onSelect={setSelected}
                      onChange={updateText}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                    />
                  ) : kind === "shape" ? (
                    <CanvasShape
                      key={item.id}
                      item={item as PlacedShape}
                      isSelected={selected === item.id}
                      onSelect={setSelected}
                      onChange={updateShape}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                    />
                  ) : (
                    <FocusImage
                      key={item.id}
                      item={item as PlacedImage}
                      selected={selected === item.id}
                      select={() => setSelected(item.id)}
                      change={(patch) => updateImage(item.id, patch)}
                    />
                  ),
                )}
              </Layer>
            </Stage>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border bg-background p-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom((z) => Math.max(0.25, z / 1.2))}
              >
                축소
              </Button>
              <span className="text-xs">{Math.round(scale * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
              >
                확대
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setZoom(1)}>
                화면에 맞춤
              </Button>
            </div>
          </section>
          <aside
            className="min-h-0 overflow-y-auto border-l bg-background p-4 space-y-4"
            aria-label="포스터 편집 설정"
          >
            <Button
              className="w-full"
              onClick={() => {
                const id = crypto.randomUUID();
                change({
                  ...doc,
                  texts: [
                    ...doc.texts,
                    {
                      id,
                      text: "제목을 입력하세요",
                      x: b.x + b.width * 0.1,
                      y: b.y + b.height * 0.1,
                      fontSize: Math.max(24, Math.round(b.width * 0.06)),
                      fontFamily: FONT_CHOICES[0].value,
                      fill: "#111111",
                      rotation: 0,
                      z: Math.max(0, ...entries.map((e) => e.item.z ?? 0)) + 1,
                    },
                  ],
                });
                setSelected(id);
              }}
            >
              글자 추가
            </Button>
            {text ? (
              text.locked ? (
                <p>잠긴 글자입니다. 아래 레이어에서 잠금을 풀어 주세요.</p>
              ) : (
                <TextToolbar
                  item={text}
                  onChange={(patch) => updateText(text.id, patch)}
                  onDelete={() => {
                    change({
                      ...doc,
                      texts: doc.texts.filter((t) => t.id !== text.id),
                    });
                    setSelected("");
                  }}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                글자를 클릭하면 글꼴·색·간격을 바꿀 수 있습니다. 이미지에 그려진
                기존 글씨는 별도 글자 레이어가 아닙니다.
              </p>
            )}
            {image && (
              <label className="block text-sm">
                이미지 투명도
                <input
                  aria-label="이미지 투명도"
                  disabled={image.locked}
                  className="w-full"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={image.opacity ?? 1}
                  onChange={(e) =>
                    updateImage(image.id, { opacity: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <div className="border-t pt-3">
              <h3 className="font-semibold mb-2">이 포스터의 레이어</h3>
              {[...entries].reverse().map(({ kind, item }) => (
                <div
                  key={item.id}
                  className={`flex gap-1 items-center rounded border p-2 mb-2 ${selected === item.id ? "border-blue-500 bg-blue-500/10" : ""}`}
                >
                  <button
                    className="min-w-0 flex-1 text-left text-sm truncate"
                    onClick={() => setSelected(item.id)}
                  >
                    {kind === "text"
                      ? (item as PlacedText).text
                      : kind === "image"
                        ? "이미지"
                        : "도형"}
                  </button>
                  <button
                    className="text-xs p-1"
                    onClick={() => toggle(item.id, "hidden")}
                    aria-label={`${item.id} 표시`}
                  >
                    {item.hidden ? "숨김" : "표시"}
                  </button>
                  <button
                    className="text-xs p-1"
                    onClick={() => toggle(item.id, "locked")}
                    aria-label={`${item.id} 잠금`}
                  >
                    {item.locked ? "잠김" : "잠금"}
                  </button>
                </div>
              ))}
            </div>
            {message && <p role="status">{message}</p>}
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const keep = selected;
                setSelected("");
                try {
                  await document.fonts.ready;
                  await Promise.all(
                    doc.images
                      .filter((i) => !i.hidden)
                      .map(async (i) => {
                        const img = new window.Image();
                        img.crossOrigin = "anonymous";
                        img.src = i.src;
                        await img.decode();
                      }),
                  );
                  await new Promise((r) => setTimeout(r, 100));
                  if (!stage.current) return;
                  const node = stage.current;
                  const oldPosition = node.position(),
                    oldScale = node.scale();
                  let url: string;
                  try {
                    node.position({ x: -b.x, y: -b.y });
                    node.scale({ x: 1, y: 1 });
                    url = node.toDataURL({
                      x: 0,
                      y: 0,
                      width: Math.round(b.width),
                      height: Math.round(b.height),
                      pixelRatio: 1,
                    });
                  } finally {
                    node.position(oldPosition);
                    node.scale(oldScale);
                    node.batchDraw();
                  }
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "포스터-편집.png";
                  a.click();
                  setMessage("포스터 PNG를 저장했습니다.");
                } catch {
                  setMessage(
                    "이미지를 저장하지 못했습니다. 원본 이미지 접근 권한을 확인해 주세요.",
                  );
                } finally {
                  setSelected(keep);
                }
              }}
            >
              포스터 PNG 저장
            </Button>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
