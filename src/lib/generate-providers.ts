// 제공자별 실제 호출 — 결과는 모두 PNG dataURL 배열로 통일해서 돌려준다.
import "server-only";
import { getProvider, type ProviderId } from "@/lib/providers";
import { getKey } from "@/lib/server-keys";

export interface GenArgs {
  prompt: string;
  size: string;
  quality: string;
  n: number;
  refs: string[];
  mask?: string;
  transparent?: boolean;
}

export interface GenResult {
  images: string[];
  usage?: unknown;
  model: string;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

async function runOpenAI(key: string, a: GenArgs): Promise<GenResult> {
  const model = "gpt-image-2";
  let resp: Response;
  if (a.refs.length > 0) {
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", a.prompt);
    form.set("size", a.size);
    form.set("quality", a.quality);
    form.set("n", String(a.n));
    if (a.transparent) form.set("background", "transparent");
    for (let i = 0; i < a.refs.length; i++) {
      form.append("image[]", await dataUrlToBlob(a.refs[i]), `ref-${i}.png`);
    }
    if (a.mask) form.append("mask", await dataUrlToBlob(a.mask), "mask.png");
    resp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: a.prompt,
        size: a.size,
        quality: a.quality,
        n: a.n,
        ...(a.transparent && { background: "transparent" }),
      }),
    });
  }
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const j = await resp.json();
  return {
    images: (j.data || [])
      .filter((d: { b64_json?: string }) => d.b64_json)
      .map((d: { b64_json: string }) => `data:image/png;base64,${d.b64_json}`),
    usage: j.usage,
    model,
  };
}

// 제미나이는 픽셀 크기를 못 받고 비율만 받는다 → 요청 크기에서 가장 가까운 비율로 변환
function toAspectRatio(size: string): string {
  const [w, h] = size.split("x").map(Number);
  if (!w || !h) return "1:1";
  const r = w / h;
  const options: [string, number][] = [
    ["1:1", 1],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["21:9", 21 / 9],
  ];
  return options.reduce((best, cur) =>
    Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best,
  )[0];
}

async function runGemini(key: string, a: GenArgs): Promise<GenResult> {
  const model = getProvider("gemini").model;
  const parts: Record<string, unknown>[] = [{ text: a.prompt }];
  for (const ref of a.refs.slice(0, 3)) {
    const b64 = ref.split(",", 2)[1];
    parts.push({ inline_data: { mime_type: "image/png", data: b64 } });
  }
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          imageConfig: { aspectRatio: toAspectRatio(a.size) },
        },
      }),
    },
  );
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const j = await resp.json();
  const images: string[] = [];
  for (const cand of j.candidates || []) {
    for (const part of cand.content?.parts || []) {
      const d = part.inlineData || part.inline_data;
      if (d?.data) images.push(`data:image/png;base64,${d.data}`);
    }
  }
  if (!images.length) {
    const reason = j.candidates?.[0]?.finishReason || "이미지가 오지 않았습니다";
    throw new Error(`Gemini: ${reason}`);
  }
  return { images, usage: j.usageMetadata, model };
}

async function runGrok(key: string, a: GenArgs): Promise<GenResult> {
  const model = getProvider("grok").model;
  // Grok은 품질이 low/medium만 (high 없음)
  const quality = a.quality === "low" ? "low" : "medium";
  let resp: Response;

  if (a.refs.length > 0) {
    // 참조 편집 — xAI는 OpenAI 호환 스펙을 따른다 (최대 3장)
    // ⚠️ 크레딧이 없어 실호출로 확인하지 못한 경로
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", a.prompt);
    form.set("n", String(a.n));
    form.set("quality", quality);
    form.set("response_format", "b64_json");
    for (let i = 0; i < Math.min(a.refs.length, 3); i++) {
      form.append("image[]", await dataUrlToBlob(a.refs[i]), `ref-${i}.png`);
    }
    resp = await fetch("https://api.x.ai/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    resp = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: a.prompt,
        n: a.n,
        quality,
        response_format: "b64_json",
      }),
    });
  }
  if (!resp.ok) throw new Error(`Grok ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const j = await resp.json();
  return {
    images: (j.data || [])
      .filter((d: { b64_json?: string }) => d.b64_json)
      .map((d: { b64_json: string }) => `data:image/png;base64,${d.b64_json}`),
    model,
  };
}

export async function generateWith(
  providerId: ProviderId,
  args: GenArgs,
): Promise<GenResult> {
  const provider = getProvider(providerId);
  const key = getKey(provider.envKey);
  if (!key) {
    throw new Error(
      `${provider.label} 키가 없습니다 — 설정에서 ${provider.envKey}를 넣어주세요`,
    );
  }
  if (args.mask && !provider.caps.mask) {
    throw new Error(`${provider.label}는 부분수정을 지원하지 않습니다`);
  }
  if (args.transparent && !provider.caps.transparent) {
    throw new Error(`${provider.label}는 투명 배경을 지원하지 않습니다`);
  }
  if (args.refs.length > 0 && !provider.caps.reference) {
    throw new Error(`${provider.label}는 참조 생성을 지원하지 않습니다`);
  }

  if (providerId === "gemini") return runGemini(key, args);
  if (providerId === "grok") return runGrok(key, args);
  return runOpenAI(key, args);
}
