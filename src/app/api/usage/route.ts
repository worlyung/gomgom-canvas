// 사용량 집계 (F-12) — usage.jsonl을 읽어 오늘/누적 호출수·예상 비용 반환
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const USAGE_FILE = path.join(process.cwd(), "..", "usage.jsonl");

// 일반 API 호출 기준 USD / 1M tokens (OpenAI 공식 이미지 모델 요금)
const RATE = {
  latest: { textIn: 5, imageIn: 8, imageOut: 30 },
  legacy: { textIn: 2.5, imageIn: 4, imageOut: 15 },
};
const KRW_PER_USD = 1400; // 대략 환산용

function costOf(usage: any, model?: string): number {
  if (!usage) return 0;
  const textIn = usage.input_tokens_details?.text_tokens || 0;
  const imageIn = usage.input_tokens_details?.image_tokens || 0;
  const imageOut = usage.output_tokens || 0;
  const rate =
    model?.includes("2.5") || model?.includes("2.6")
      ? RATE.latest
      : RATE.legacy;
  return (
    (textIn * rate.textIn + imageIn * rate.imageIn + imageOut * rate.imageOut) /
    1_000_000
  );
}

export async function GET() {
  const today = { calls: 0, cost: 0, unpriced: 0 };
  const total = { calls: 0, cost: 0, unpriced: 0 };
  try {
    const lines = fs
      .readFileSync(USAGE_FILE, "utf8")
      .split("\n")
      .filter(Boolean);
    const todayStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, 로컬(KST)
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        const unknown =
          rec.provider !== "openai" ||
          !rec.usage?.input_tokens_details ||
          typeof rec.usage.output_tokens !== "number";
        const cost = unknown ? 0 : costOf(rec.usage, rec.model);
        total.calls++;
        if (unknown) total.unpriced++;
        total.cost += cost;
        if (new Date(rec.ts).toLocaleDateString("sv-SE") === todayStr) {
          today.calls++;
          if (unknown) today.unpriced++;
          today.cost += cost;
        }
      } catch {}
    }
  } catch {} // 파일 없으면 0
  return NextResponse.json({ today, total, krwPerUsd: KRW_PER_USD });
}
