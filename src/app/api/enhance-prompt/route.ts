// 프롬프트 업그레이더 — 대충 쓴 한 줄을 이미지 모델이 잘 알아듣는 묘사로 부풀린다
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const maxDuration = 120;

let cachedKey: string | undefined;
function getOpenAIKey(): string | undefined {
  if (cachedKey) return cachedKey;
  if (process.env.OPENAI_API_KEY) return (cachedKey = process.env.OPENAI_API_KEY);
  try {
    const envFile = fs.readFileSync(path.join(os.homedir(), ".env"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const m = line.match(/^OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)["']?\s*$/);
      if (m) return (cachedKey = m[1]);
    }
  } catch {}
  return undefined;
}

const MODELS = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o-mini"];
let workingModel: string | undefined;

const SYSTEM = `너는 이미지 생성 프롬프트 전문가다. 사용자가 대충 던진 한국어 요청을 gpt-image-2가 잘 알아듣는 구체적인 한국어 묘사로 다시 쓴다.

규칙:
- 결과는 프롬프트 본문만. 설명·따옴표·머리말 금지.
- 사용자가 말한 소재·의도는 절대 바꾸지 않는다. 없는 대상을 새로 만들지 않는다.
- 다음을 채워 넣는다: 주요 소재의 구체적 묘사, 구도와 시점, 빛과 분위기, 색감, 질감이나 화풍, 배경 처리.
- 화면에 글자를 넣으라는 요청이 있으면 그 문구를 정확히 따옴표로 보존한다. 없으면 글자를 넣지 않는다.
- 200~350자. 문장을 쉼표로 이어 붙인 묘사체로 쓴다.
- 이미 충분히 구체적인 프롬프트면 과하게 늘리지 말고 부족한 항목만 보완한다.`;

export async function POST(req: NextRequest) {
  const key = getOpenAIKey();
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY 없음" }, { status: 500 });
  }

  const { prompt, size, styleLabel, hasRefs } = await req.json();
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "프롬프트가 비었습니다" }, { status: 400 });
  }

  const context = [
    size ? `출력 크기: ${size}` : "",
    styleLabel ? `선택된 스타일: ${styleLabel}` : "",
    hasRefs
      ? "참조 이미지가 함께 들어간다 — 참조의 인물·화풍을 유지하라는 뜻이 담기게 쓸 것"
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const models = workingModel ? [workingModel] : MODELS;
  let lastErr = "";
  for (const model of models) {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `${context ? context + "\n\n" : ""}사용자 요청: ${prompt}`,
          },
        ],
      }),
    });
    if (resp.ok) {
      workingModel = model;
      const j = await resp.json();
      const out = j.choices?.[0]?.message?.content?.trim();
      if (!out) return NextResponse.json({ error: "빈 응답" }, { status: 502 });
      return NextResponse.json({ prompt: out });
    }
    lastErr = `${model}: ${resp.status}`;
    if (resp.status !== 404 && resp.status !== 400) break;
  }
  return NextResponse.json({ error: `다듬기 실패 — ${lastErr}` }, { status: 502 });
}
