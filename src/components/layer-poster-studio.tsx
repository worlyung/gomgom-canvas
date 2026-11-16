"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  posterPlanSchema,
  type PosterContext,
  type PosterPlan,
} from "@/lib/layer-poster";
import { hasTransparentEdge } from "@/lib/alpha-check";
import { loadOutputImage } from "@/lib/canvas-output";
import type { Artboard, PlacedImage, PlacedText } from "@/types/canvas";

type Props = {
  images: PlacedImage[];
  texts: PlacedText[];
  selectedIds: string[];
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setTexts: React.Dispatch<React.SetStateAction<PlacedText[]>>;
  setSelectedIds: (ids: string[]) => void;
  setArtboard: (board: Artboard) => void;
  saveHistory: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  model: string;
};

export function LayerPosterStudio(p: Props) {
  const [title, setTitle] = useState("2026 서울 한국춤 페스티벌");
  const [date, setDate] = useState("2026.12.7~12.8");
  const [venue, setVenue] = useState("서울남산국악당·남산골한옥마을");
  const [brief, setBrief] = useState(
    "전통과 컨템포러리를 잇는 우아하고 역동적인 분위기. 무용수, 부채와 학. 단순한 색면과 유려한 붓터치, 넓은 여백.",
  );
  const [plan, setPlan] = useState<PosterPlan | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reference, setReference] = useState("");
  const [referenceMode, setReferenceMode] = useState("style");
  const [candidate, setCandidate] = useState<{
    src: string;
    targetId?: string;
    context: PosterContext;
    prompt: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chosen = p.images.find(
    (i) => p.selectedIds.length === 1 && i.id === p.selectedIds[0],
  );
  const current =
    chosen?.generation?.layerPoster ||
    [...p.images].reverse().find((i) => i.generation?.layerPoster)?.generation
      ?.layerPoster;
  const context = (): PosterContext => ({
    projectId: crypto.randomUUID(),
    title,
    date,
    venue,
    brief,
    plan: plan!,
    role: "background",
    name: "배경",
  });
  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (p.busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    p.setBusy(true);
    setError("");
    try {
      await work(controller.signal);
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "생성을 취소했어요. 완성된 레이어는 남겨 두었습니다."
          : e instanceof Error
            ? e.message
            : "생성 실패",
      );
    } finally {
      p.setBusy(false);
      setStatus("");
      abortRef.current = null;
    }
  };
  const makeImage = async (
    request: string,
    c: PosterContext,
    signal: AbortSignal,
    source?: string,
  ) => {
    const transparent = c.role !== "background";
    const prompt = `${c.plan.style}\n현재 행사: ${c.title}. ${c.brief}\n이번에 만들 재료: ${request}\n${transparent ? "독립된 요소 하나만 투명 배경 PNG로 그려라. 전체 형태를 정사각형 화면 안에 넣고 주위에 작은 투명 여백을 둬라. 바닥, 액자, 배경, 가짜 체크무늬를 그리지 마라." : "포스터 바탕만 그려라. 인물, 오브제 없이 넓은 여백을 유지하라."}\n어떤 글자, 숫자, 행사명, 로고도 이미지에 그리지 마라. 글자는 별도 레이어로 배치한다.\n${source ? "첫 참조는 교체할 원본 요소다. 요청한 변경을 반영해 이 요소만 다시 그려라." : ""}\n${reference ? (referenceMode === "style" ? "마지막 참조는 화풍과 색감만 참고한다. 글자, 로고, 구도, 대상을 복사하지 마라." : "마지막 참조의 대상 형태를 참고하되 글자와 배경은 제외하라.") : ""}`;
    const response = await fetch("/api/generate", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size: transparent ? "1024x1024" : "1024x1536",
        quality: "high",
        n: 1,
        provider: "openai",
        openaiModel: p.model,
        transparent,
        refs: [source, reference].filter(Boolean),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.images?.[0])
      throw new Error(result.error || "이미지가 없습니다");
    let src = result.images[0] as string;
    if (transparent && !(await hasTransparentEdge(src))) {
      setStatus("투명 배경을 보정하는 중…");
      const { cutoutBackground } = await import("@/lib/cutout");
      src = await cutoutBackground(src);
      if (!(await hasTransparentEdge(src)))
        throw new Error("투명 배경을 만들지 못했습니다. 다시 생성해 주세요.");
    }
    await loadOutputImage(src);
    signal.throwIfAborted();
    return src;
  };
  const imageLayer = (
    src: string,
    c: PosterContext,
    request: string,
    x: number,
    y: number,
    width: number,
    height: number,
    z: number,
  ): PlacedImage => ({
    id: crypto.randomUUID(),
    src,
    x,
    y,
    width,
    height,
    z,
    rotation: 0,
    isGenerated: true,
    locked: c.role === "background",
    promptHint: c.name,
    generation: {
      prompt: request,
      brief: c.brief,
      layerPoster: c,
      provider: "openai",
      model: p.model,
      size: c.role === "background" ? "1024x1536" : "1024x1024",
      quality: "high",
      referenceIds: [],
      createdAt: new Date().toISOString(),
    },
  });
  const generate = () =>
    run(async (signal) => {
      if (!plan) return;
      const c = context();
      const x = p.images.length
        ? Math.max(...p.images.map((i) => i.x + i.width)) + 120
        : 0;
      const y = 0;
      const z =
        Math.max(
          0,
          ...p.images.map((i) => i.z || 0),
          ...p.texts.map((i) => i.z || 0),
        ) + 1;
      setStatus("1단계 · 배경 생성 중…");
      const src = await makeImage(plan.background, c, signal);
      p.saveHistory();
      p.setArtboard({
        x,
        y,
        width: 1024,
        height: 1536,
        widthMm: 260.096,
        heightMm: 390.144,
        dpi: 100,
        name: title,
      });
      p.setImages((prev) => [
        ...prev,
        imageLayer(src, c, plan.background, x, y, 1024, 1536, z),
      ]);
      const base = {
        fill: plan.ink,
        fontFamily: "'Malgun Gothic', sans-serif",
        rotation: 0,
        z: z + 10,
      };
      const lines =
        title.length > 18
          ? title.replace(/ (?!.* )/, "\n")
          : title.replace(" 한국춤 ", "\n한국춤\n");
      p.setTexts((prev) => [
        ...prev,
        {
          ...base,
          id: crypto.randomUUID(),
          text: lines,
          x: x + 72,
          y: 80,
          fontSize: 64,
          bold: true,
        },
        {
          ...base,
          id: crypto.randomUUID(),
          text: `일시  ${date}\n장소  ${venue}`,
          x: x + 72,
          y: 1400,
          fontSize: 28,
        },
      ]);
      for (let index = 0; index < plan.elements.length; index++) {
        const element = plan.elements[index];
        setStatus(`${index + 2}단계 · ${element.name} 생성 중…`);
        const ec = { ...c, role: "element" as const, name: element.name };
        const image = await makeImage(element.prompt, ec, signal);
        const width = Math.min(element.width * 1024, 700);
        p.setImages((prev) => [
          ...prev,
          imageLayer(
            image,
            ec,
            element.prompt,
            x + Math.min(element.x * 1024, 1024 - width),
            Math.min(element.y * 1536, 1336 - width),
            width,
            width,
            z + index + 1,
          ),
        ]);
      }
      p.setSelectedIds([]);
    });
  const generateElement = (replace: boolean) =>
    run(async (signal) => {
      if (
        !current ||
        !feedback.trim() ||
        (replace && (!chosen || chosen.locked))
      )
        return;
      const c = {
        ...current,
        role: "element" as const,
        name: replace
          ? chosen!.generation?.layerPoster?.name || "수정 요소"
          : feedback.slice(0, 30),
      };
      setStatus(replace ? "선택한 요소의 수정안 생성 중…" : "새 요소 생성 중…");
      const src = await makeImage(
        feedback,
        c,
        signal,
        replace ? chosen!.src : undefined,
      );
      setCandidate({
        src,
        targetId: replace ? chosen!.id : undefined,
        context: c,
        prompt: feedback,
      });
    });
  const apply = () => {
    if (!candidate) return;
    if (candidate.targetId) {
      const target = p.images.find((i) => i.id === candidate.targetId);
      if (!target || target.locked) {
        setError("원본이 삭제되었거나 잠겨 있습니다");
        return;
      }
      p.saveHistory();
      p.setImages((prev) =>
        prev.map((i) =>
          i.id === candidate.targetId
            ? {
                ...i,
                src: candidate.src,
                generation: {
                  ...i.generation!,
                  prompt: candidate.prompt,
                  layerPoster: candidate.context,
                },
              }
            : i,
        ),
      );
      p.setSelectedIds([candidate.targetId]);
    } else {
      const bg = p.images.find(
        (i) =>
          i.generation?.layerPoster?.projectId ===
            candidate.context.projectId &&
          i.generation?.layerPoster?.role === "background",
      );
      const layer = imageLayer(
        candidate.src,
        candidate.context,
        candidate.prompt,
        (bg?.x || 0) + 350,
        (bg?.y || 0) + 650,
        350,
        350,
        Math.max(0, ...p.images.map((i) => i.z || 0)) + 1,
      );
      p.saveHistory();
      p.setImages((prev) => [...prev, layer]);
      p.setSelectedIds([layer.id]);
    }
    setCandidate(null);
  };
  return (
    <div className="space-y-4 p-3" data-testid="layer-poster-studio">
      <div>
        <h2 className="text-lg font-semibold">레이어 포스터</h2>
        <p className="text-xs text-muted-foreground">
          기획 → 재료 생성 → 직접 배치·수정
        </p>
      </div>
      <fieldset disabled={p.busy} className="space-y-3">
        <label className="block text-sm">
          축제명
          <Input
            aria-label="레이어 축제명"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setPlan(null);
            }}
          />
        </label>
        <label className="block text-sm">
          일시
          <Input
            aria-label="레이어 일시"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          장소
          <Input
            aria-label="레이어 장소"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          기획 요청
          <Textarea
            aria-label="레이어 기획 요청"
            rows={5}
            value={brief}
            onChange={(e) => {
              setBrief(e.target.value);
              setPlan(null);
            }}
          />
        </label>
        <label className="block text-sm">
          레퍼런스 이미지
          <input
            className="block w-full text-xs mt-2"
            aria-label="레이어 레퍼런스"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) {
                setError("10MB 이하 이미지를 선택해 주세요");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setReference(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {reference && (
          <div className="flex gap-2 items-center">
            <img
              src={reference}
              alt="레퍼런스"
              className="w-16 h-16 object-contain"
            />
            <select
              aria-label="레이어 참조 방식"
              value={referenceMode}
              onChange={(e) => setReferenceMode(e.target.value)}
            >
              <option value="style">그림체·색감만</option>
              <option value="shape">대상 형태 참고</option>
            </select>
            <Button variant="outline" onClick={() => setReference("")}>
              제거
            </Button>
          </div>
        )}
        <Button
          className="w-full"
          disabled={!title.trim() || !brief.trim()}
          onClick={() =>
            run(async (signal) => {
              setStatus("기획과 구도를 정하는 중…");
              const r = await fetch("/api/layer-poster-plan", {
                method: "POST",
                signal,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  brief: `${title}\n${date}\n${venue}\n${brief}`,
                }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error);
              setPlan(posterPlanSchema.parse(j));
            })
          }
        >
          기획·구도 만들기
        </Button>
        {plan && (
          <div className="rounded-lg border p-3 text-sm space-y-2">
            <p>{plan.concept}</p>
            <p className="text-xs">
              배경 + {plan.elements.map((e) => e.name).join(" · ")} + 편집
              가능한 글자
            </p>
            <p className="text-xs text-muted-foreground">
              상단 제목 · 중앙 그림 · 하단 행사 정보. 이미지{" "}
              {plan.elements.length + 1}건을 생성합니다. 초안은
              1024×1536px입니다.
            </p>
            <Button className="w-full" onClick={generate}>
              레이어 초안 생성
            </Button>
          </div>
        )}
        {current && (
          <div className="border-t pt-3 space-y-2">
            <h3 className="font-medium">요소 추가·교체</h3>
            <div className="flex flex-wrap gap-1">
              {p.images
                .filter(
                  (i) =>
                    i.generation?.layerPoster?.projectId === current.projectId,
                )
                .map((i) => (
                  <Button
                    key={i.id}
                    variant="outline"
                    size="sm"
                    aria-pressed={chosen?.id === i.id}
                    onClick={() => p.setSelectedIds([i.id])}
                  >
                    {i.generation?.layerPoster?.name}
                  </Button>
                ))}
            </div>
            {chosen && (
              <label className="block text-xs">
                선택 요소 불투명도 {Math.round((chosen.opacity ?? 1) * 100)}%
                <input
                  aria-label="선택 요소 불투명도"
                  type="range"
                  min="0"
                  max="100"
                  value={(chosen.opacity ?? 1) * 100}
                  disabled={chosen.locked}
                  onPointerDown={p.saveHistory}
                  onChange={(e) => {
                    const opacity = Number(e.target.value) / 100;
                    p.setImages((prev) =>
                      prev.map((i) =>
                        i.id === chosen.id ? { ...i, opacity } : i,
                      ),
                    );
                  }}
                  className="w-full"
                />
              </label>
            )}
            <p className="text-xs">작업: {current.title}</p>
            <p className="text-xs">
              선택:{" "}
              {chosen?.generation?.layerPoster?.name ||
                "캔버스에서 요소를 선택하세요"}
              {chosen?.locked ? " (잠김)" : ""}
            </p>
            <Textarea
              aria-label="요소 수정 요청"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="예: 부채를 더 크게 펼친 형태로 바꿔줘"
            />
            <div className="flex gap-2">
              <Button
                disabled={!feedback.trim()}
                onClick={() => generateElement(false)}
              >
                새 요소 만들기
              </Button>
              <Button
                disabled={
                  !feedback.trim() ||
                  !chosen ||
                  chosen.locked ||
                  chosen.generation?.layerPoster?.role !== "element"
                }
                onClick={() => generateElement(true)}
              >
                선택 요소 수정안
              </Button>
            </div>
          </div>
        )}
        {candidate && (
          <div className="border rounded-lg p-3 space-y-2">
            <img
              src={candidate.src}
              alt="요소 수정안"
              className="w-full max-h-48 object-contain bg-slate-200"
            />
            <Button onClick={apply}>
              {candidate.targetId ? "이 수정안으로 교체" : "캔버스에 추가"}
            </Button>
            <Button variant="outline" onClick={() => setCandidate(null)}>
              취소
            </Button>
            <p className="text-xs">
              교체 시 현재 위치·크기를 유지합니다. 되돌리기로 원본을 복원할 수
              있어요.
            </p>
          </div>
        )}
      </fieldset>
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
      {p.busy && (
        <Button variant="outline" onClick={() => abortRef.current?.abort()}>
          생성 취소
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
