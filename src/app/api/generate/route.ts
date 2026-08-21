// 이미지 생성 중계 — API 키는 이 서버만 안다 (F-05)
// 제공자(OpenAI·Gemini·Grok)별 호출은 lib/generate-providers.ts 가 맡는다.
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateWith } from "@/lib/generate-providers";
import type { ProviderId } from "@/lib/providers";

export const maxDuration = 600;

const USAGE_FILE = path.join(process.cwd(), "..", "usage.jsonl");

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt: string = body.prompt;
  const size: string = body.size || "1024x1024";
  const quality: string = body.quality || "high";
  const n: number = Math.min(Math.max(Number(body.n) || 1, 1), 4);
  const refs: string[] = Array.isArray(body.refs) ? body.refs.slice(0, 16) : [];
  const mask: string | undefined = body.mask;
  const transparent = !!body.transparent;
  const provider: ProviderId = body.provider || "openai";
  const geminiModel: string | undefined = body.geminiModel;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "프롬프트가 비었습니다" }, { status: 400 });
  }

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
    });
    if (!result.images.length) {
      return NextResponse.json({ error: "결과 이미지가 없습니다" }, { status: 502 });
    }

    // 사용량 기록 (F-12)
    try {
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

    return NextResponse.json({ images: result.images, usage: result.usage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "생성 실패";
    console.error("generate 실패:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
