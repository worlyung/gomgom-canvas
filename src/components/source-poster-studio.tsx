"use client";
import { useState } from "react";
import type {
  Artboard,
  PlacedImage,
  PlacedShape,
  PlacedText,
} from "@/types/canvas";
import {
  SOURCE_POSTER_LAYOUTS,
  SOURCE_LAYOUTS,
  fitPosterText,
} from "@/lib/poster-layouts";
import { LayoutGallery } from "@/components/layout-gallery";

// Palettes are original presets; external galleries are references, not bundled artwork.
const styles = [
  { name: "여백 · 전시", bg: "#f7f3e9", ink: "#233c35", accent: "#b85439" },
  { name: "도시 · 야간", bg: "#18233b", ink: "#fff6e7", accent: "#f3ba59" },
  { name: "선명 · 축제", bg: "#fff4cc", ink: "#222e70", accent: "#e7583f" },
  { name: "흑백 · 편집", bg: "#f5f5f3", ink: "#202020", accent: "#707070" },
];
type Props = {
  images: PlacedImage[];
  texts: PlacedText[];
  shapes: PlacedShape[];
  selectedIds: string[];
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setTexts: React.Dispatch<React.SetStateAction<PlacedText[]>>;
  setShapes: React.Dispatch<React.SetStateAction<PlacedShape[]>>;
  setSelectedIds: (ids: string[]) => void;
  setArtboard: (b: Artboard) => void;
  saveHistory: () => void;
  busy: boolean;
};
export function SourcePosterStudio(p: Props) {
  const [source, setSource] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState("");
  const [layout, setLayout] = useState(143);
  const [style, setStyle] = useState(0);
  const [status, setStatus] = useState("");
  const selected = p.images.find(
    (i) => p.selectedIds.length === 1 && i.id === p.selectedIds[0],
  );
  async function useSource(src: string) {
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      setSource({ src, width: img.naturalWidth, height: img.naturalHeight });
      setStatus(
        "원본을 준비했어요. 자르거나 다시 그리지 않고 전체 이미지를 배치합니다.",
      );
    } catch {
      setStatus("이미지를 읽지 못했어요. PNG·JPG·WebP 파일을 확인해 주세요.");
    }
  }
  function compose() {
    if (!source || !title.trim() || p.busy) return;
    const palette = styles[style],
      w = 1024,
      h = 1536;
    const x =
      Math.max(
        0,
        ...p.images.map((i) => i.x + i.width),
        ...p.shapes.map((i) => i.x + i.width),
        ...p.texts.map((t) => t.x + 2000),
      ) + 160;
    const z =
      Math.max(
        0,
        ...p.images.map((i) => i.z || 0),
        ...p.shapes.map((i) => i.z || 0),
        ...p.texts.map((i) => i.z || 0),
      ) + 1;
    const template = SOURCE_LAYOUTS[layout];
    const box = template.image;
    const scale = Math.min(box.w / source.width, box.h / source.height);
    const image: PlacedImage = {
      id: crypto.randomUUID(),
      src: source.src,
      x: x + box.x + (box.w - source.width * scale) / 2,
      y: box.y + (box.h - source.height * scale) / 2,
      width: source.width * scale,
      height: source.height * scale,
      rotation: 0,
      z: z + 1,
      promptHint: "포스터 원본 이미지",
    };
    const ctx = document.createElement("canvas").getContext("2d")!;
    const measure = (bold: boolean) => (s: string, size: number) => {
      ctx.font = `${bold ? "bold " : ""}${size}px 'Malgun Gothic', sans-serif`;
      return ctx.measureText(s).width;
    };
    const heading = fitPosterText(
      title.trim(),
      template.title,
      template.fontSize,
      measure(true),
    );
    const details = fitPosterText(
      info.trim(),
      template.info,
      25,
      measure(false),
    );
    p.saveHistory();
    p.setShapes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: "rect",
        x,
        y: 0,
        width: w,
        height: h,
        rotation: 0,
        fill: palette.bg,
        stroke: palette.bg,
        strokeWidth: 0,
        opacity: 1,
        z,
        locked: true,
      },
      {
        id: crypto.randomUUID(),
        kind: "rect",
        x: x + (template.frame ? 32 : template.info.x),
        y: template.frame ? 32 : template.info.y - 20,
        width: template.frame ? 960 : template.info.w,
        height: template.frame ? 1472 : 4,
        rotation: 0,
        fill: template.frame ? undefined : palette.accent,
        stroke: palette.accent,
        strokeWidth: template.frame ? 4 : 0,
        opacity: 1,
        z: z + 2,
      },
    ]);
    p.setImages((prev) => [...prev, image]);
    p.setTexts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: heading.text,
        x: x + template.title.x,
        y: template.title.y,
        fontSize: heading.fontSize,
        fill: palette.ink,
        fontFamily: "'Malgun Gothic', sans-serif",
        bold: true,
        rotation: 0,
        z: z + 3,
      },
      {
        id: crypto.randomUUID(),
        text: details.text,
        x: x + template.info.x,
        y: template.info.y,
        fontSize: details.fontSize,
        fill: palette.ink,
        fontFamily: "'Malgun Gothic', sans-serif",
        rotation: 0,
        z: z + 3,
      },
    ]);
    p.setArtboard({
      x,
      y: 0,
      width: w,
      height: h,
      widthMm: 260.096,
      heightMm: 390.144,
      dpi: 100,
      name: title.trim(),
    });
    p.setSelectedIds([image.id]);
    setStatus(
      heading.needsAdjustment || details.needsAdjustment
        ? "문구를 모두 넣어 초안을 만들었어요. 내용이 많아 일부 글씨가 배치 영역을 넘을 수 있어요. 크게 열어 글씨 위치와 크기를 자유롭게 조정하세요."
        : "문구 길이에 맞춰 글씨 크기와 줄바꿈을 조정했어요. 크게 열어 자유롭게 편집하세요.",
    );
  }
  return (
    <section className="space-y-4 p-4" aria-label="원본으로 홍보물 만들기">
      <h2 className="text-lg font-semibold">원본으로 홍보물</h2>
      <p className="text-sm text-muted-foreground">
        원본을 다시 그리지 않습니다. 제목·정보는 직접 편집할 수 있는 글씨로
        넣습니다.
      </p>
      <label className="block text-sm">
        사용할 원본 이미지
        <input
          aria-label="포스터 원본 업로드"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={p.busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 20 * 1024 * 1024) {
              setStatus("20MB 이하 이미지를 선택하세요.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => void useSource(String(reader.result));
            reader.readAsDataURL(f);
            e.target.value = "";
          }}
        />
      </label>
      <button
        className="rounded border p-2 text-sm"
        disabled={!selected || p.busy}
        onClick={() => selected && void useSource(selected.src)}
      >
        선택한 캔버스 이미지 사용
      </button>
      {source && (
        <img
          src={source.src}
          alt="보존할 원본"
          className="max-h-48 w-full object-contain"
        />
      )}
      <label className="block">
        제목
        <textarea
          aria-label="홍보물 제목"
          className="mt-2 w-full rounded border bg-background p-3"
          rows={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="행사명 · 줄바꿈도 직접 넣을 수 있어요"
        />
      </label>
      <label className="block">
        일시·장소·안내
        <textarea
          aria-label="홍보물 정보"
          className="mt-2 w-full rounded border bg-background p-3"
          rows={3}
          value={info}
          onChange={(e) => setInfo(e.target.value)}
        />
      </label>
      <label className="block">
        구도
        <select
          aria-label="원본 포스터 구도"
          className="mt-2 w-full rounded border bg-background p-3"
          value={layout}
          onChange={(e) => setLayout(Number(e.target.value))}
        >
          {SOURCE_POSTER_LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <LayoutGallery mode="source" onSelect={setLayout} disabled={p.busy} />
      <fieldset>
        <legend className="mb-2">색감 선택</legend>
        <div className="grid grid-cols-2 gap-2">
          {styles.map((s, i) => (
            <button
              key={s.name}
              aria-pressed={style === i}
              onClick={() => setStyle(i)}
              className={`rounded border-2 p-3 text-sm ${style === i ? "border-primary" : "border-transparent"}`}
              style={{ background: s.bg, color: s.ink }}
            >
              <span
                className="mb-2 block h-1"
                style={{ background: s.accent }}
              />
              {s.name}
            </button>
          ))}
        </div>
      </fieldset>
      <button
        className="w-full rounded bg-primary p-3 text-primary-foreground"
        disabled={!source || !title.trim() || p.busy}
        onClick={compose}
      >
        원본 보존 초안 만들기
      </button>
      <p role="status" className="text-sm">
        {status}
      </p>
      <details className="text-sm">
        <summary>스타일·구도 참고 자료</summary>
        <p className="my-2">
          아래 갤러리는 참고용 외부 링크입니다. 위 색감 선택과 별개이며 예시의
          글씨·이미지를 자동 복사하지 않습니다.
        </p>
        {[
          [
            "한국형 구도 도감 · CC BY 4.0",
            "https://github.com/worlyung/korean-layout-compositions",
          ],
          [
            "일러스트·스타일 갤러리",
            "https://github.com/wuyoscar/gpt-image2-skill#gallery-illustration",
          ],
          [
            "이미지 프롬프트 예시",
            "https://github.com/Anil-matcha/Awesome-GPT-Image-2.6-API-Prompts",
          ],
          [
            "결과와 함께 보는 프롬프트",
            "https://github.com/tong0619453646-dev/awesome-gpt-image-2.6-prompts",
          ],
        ].map(([name, url]) => (
          <a
            className="my-2 block underline"
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            {name} ↗
          </a>
        ))}
      </details>
    </section>
  );
}
