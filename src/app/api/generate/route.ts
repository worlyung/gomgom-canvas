// OpenAI gpt-image-2 중계 라우트 — API 키는 이 서버만 안다 (F-05)
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const maxDuration = 600;

let cachedKey: string | undefined;
function getOpenAIKey(): string | undefined {
  if (cachedKey) return cachedKey;
  if (process.env.OPENAI_API_KEY) return (cachedKey = process.env.OPENAI_API_KEY);
  // 비밀은 ~/.env 한 곳에만 둔다 (회사 규칙)
  try {
    const envFile = fs.readFileSync(path.join(os.homedir(), ".env"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const m = line.match(/^OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)["']?\s*$/);
      if (m) return (cachedKey = m[1]);
    }
  } catch {}
  return undefined;
}

const USAGE_FILE = path.join(process.cwd(), "..", "usage.jsonl");

export async function POST(req: NextRequest) {
  const key = getOpenAIKey();
  if (!key) {
    return NextResponse.json(
      { error: "서버에서 OPENAI_API_KEY를 찾지 못했습니다 (~/.env 확인)" },
      { status: 500 },
    );
  }

  const body = await req.json();
  const prompt: string = body.prompt;
  const size: string = body.size || "1024x1024";
  const quality: string = body.quality || "high";
  const n: number = Math.min(Math.max(Number(body.n) || 1, 1), 4);
  const refs: string[] = Array.isArray(body.refs) ? body.refs.slice(0, 16) : [];
  const mask: string | undefined = body.mask; // 알파=0 영역만 수정 (F-07)

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "프롬프트가 비었습니다" }, { status: 400 });
  }

  const model = "gpt-image-2";
  let resp: Response;
  if (refs.length > 0) {
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", prompt);
    form.set("size", size);
    form.set("quality", quality);
    form.set("n", String(n));
    for (let i = 0; i < refs.length; i++) {
      const blob = await (await fetch(refs[i])).blob();
      form.append("image[]", blob, `ref-${i}.png`);
    }
    if (mask) {
      form.append("mask", await (await fetch(mask)).blob(), "mask.png");
    }
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
      body: JSON.stringify({ model, prompt, size, quality, n }),
    });
  }

  if (!resp.ok) {
    const text = await resp.text();
    console.error("OpenAI error:", resp.status, text.slice(0, 500));
    return NextResponse.json(
      { error: `OpenAI ${resp.status}: ${text.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const j = await resp.json();
  const images: string[] = (j.data || [])
    .filter((d: any) => d.b64_json)
    .map((d: any) => `data:image/png;base64,${d.b64_json}`);

  // 사용량 기록 (F-12)
  try {
    fs.appendFileSync(
      USAGE_FILE,
      JSON.stringify({
        ts: new Date().toISOString(),
        model,
        size,
        quality,
        n,
        refs: refs.length,
        mask: !!mask,
        usage: j.usage || null,
      }) + "\n",
    );
  } catch (e) {
    console.error("usage.jsonl 기록 실패:", e);
  }

  return NextResponse.json({ images, usage: j.usage || null });
}
