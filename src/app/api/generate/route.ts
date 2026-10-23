// 이미지 생성 중계 — API 키는 이 서버만 안다 (F-05)
// 제공자(OpenAI·Gemini·Grok)별 호출은 lib/generate-providers.ts 가 맡는다.
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateWith } from "@/lib/generate-providers";
import type { ProviderId } from "@/lib/providers";
import { normalizeSize } from "@/lib/image-sizes";

export const maxDuration = 600;

const USAGE_FILE = path.join(process.cwd(), "..", "usage.jsonl");

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt: string = body.prompt;
  const size: string = body.size || "1024x1024";
  const quality: string = body.quality || "high";
  const n: number = Math.min(Math.max(Math.floor(Number(body.n) || 1), 1), 4);
  const refs: string[] = Array.isArray(body.refs) ? body.refs.slice(0, 16) : [];
  const mask: string | undefined = body.mask;
  const transparent = !!body.transparent;
  const provider: ProviderId = body.provider || "openai";
  const geminiModel: string | undefined = body.geminiModel;
  const openaiModel: string | undefined = body.openaiModel;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "프롬프트가 비었습니다" }, { status: 400 });
  }
  if (!["openai", "gemini", "grok"].includes(provider)) return NextResponse.json({error:"알 수 없는 생성 서비스예요"}, {status:400});
  const dimensions = typeof size === "string" && /^(\d+)x(\d+)$/.exec(size);
  const normalized = dimensions ? normalizeSize(+dimensions[1], +dimensions[2]) : {error:"이미지 크기를 확인해 주세요"};
  if ("error" in normalized || normalized.value !== size) return NextResponse.json({error: "error" in normalized ? normalized.error : "가로·세로는 16의 배수여야 해요"}, {status:400});

  try {
    const result = await generateWith(provider, {
      prompt,
      size,
      quality,
      n,
      refs,
      mask,
      transparent,
      geminiModel,
      openaiModel,
    });
    if (!result.images.length) {
      return NextResponse.json({ error: "결과 이미지가 없습니다" }, { status: 502 });
    }

    // 사용량 기록 (F-12)
    try {
      fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
      fs.appendFileSync(
        USAGE_FILE,
        JSON.stringify({
          ts: new Date().toISOString(),
          provider,
          model: result.model,
          size,
          quality,
          n,
          refs: refs.length,
          mask: !!mask,
          usage: result.usage || null,
        }) + "\n",
      );
    } catch (e) {
      console.error("usage.jsonl 기록 실패:", e);
    }

    return NextResponse.json({ images: result.images, usage: result.usage, model: result.model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "생성 실패";
    console.error("generate 실패:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
