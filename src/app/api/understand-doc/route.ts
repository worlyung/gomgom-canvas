// 문서(제안서 md/txt/pdf) → 포스터 프롬프트 자동 생성
// 텍스트 추출 후 OpenAI 텍스트 모델로 요약·프롬프트화 (키는 서버 전용, generate/route.ts와 동일)
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

// 모델명은 시점에 따라 다를 수 있어 후보를 순서대로 시도, 성공한 것 캐시
const MODEL_CANDIDATES = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o-mini"];
let workingModel: string | undefined;

const SYSTEM = `너는 한국 공공 행사 포스터의 아트디렉터다. 사용자가 준 문서(제안서·기획서)에서 핵심을 뽑아, 이미지 생성 AI(gpt-image-2)용 포스터 생성 프롬프트를 "한국어 한 문단"으로 작성한다.
반드시 포함: ①행사명(이미지 안에 큰 글자로 넣으라고 지시) ②일시·장소가 문서에 있으면 작은 글자로 포함 지시 ③행사 성격에 맞는 분위기·색감·비주얼 소재 ④"포스터, 세로 구도, 인쇄 품질" 지시.
문서에 없는 정보는 지어내지 말 것. 250자 이내. 프롬프트 본문만 출력(설명·따옴표 금지).`;

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }
  return buf.toString("utf8"); // md / txt
}

export async function POST(req: NextRequest) {
  const key = getOpenAIKey();
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY 없음 (~/.env 확인)" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });

  let text: string;
  try {
    text = (await extractText(file)).trim();
  } catch (e) {
    return NextResponse.json(
      { error: `문서 읽기 실패: ${e instanceof Error ? e.message : e}` },
      { status: 400 },
    );
  }
  if (text.length < 30) {
    return NextResponse.json({ error: "문서에서 텍스트를 거의 못 읽었습니다 (스캔 PDF는 미지원)" }, { status: 400 });
  }
  const clipped = text.slice(0, 15000); // ponytail: 15k자 컷 — 초장문 제안서는 앞부분(개요·과업)이 핵심

  const models = workingModel ? [workingModel] : MODEL_CANDIDATES;
  let lastErr = "";
  for (const model of models) {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `문서 파일명: ${file.name}\n\n--- 문서 내용 ---\n${clipped}` },
        ],
      }),
    });
    if (resp.ok) {
      workingModel = model;
      const j = await resp.json();
      const prompt = j.choices?.[0]?.message?.content?.trim();
      if (!prompt) return NextResponse.json({ error: "빈 응답" }, { status: 502 });
      return NextResponse.json({ prompt, model });
    }
    lastErr = `${model}: ${resp.status} ${(await resp.text()).slice(0, 150)}`;
    if (resp.status !== 404 && resp.status !== 400) break; // 모델 없음 계열만 다음 후보 시도
  }
  console.error("understand-doc 실패:", lastErr);
  return NextResponse.json({ error: `텍스트 모델 호출 실패 — ${lastErr}` }, { status: 502 });
}
