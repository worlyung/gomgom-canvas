// 사용량 집계 (F-12) — usage.jsonl을 읽어 오늘/누적 호출수·예상 비용 반환
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const USAGE_FILE = path.join(process.cwd(), "..", "usage.jsonl");

// 예상 단가 (USD / 1M tokens) — gpt-image-1 공시가 기준 추정치. 공식 gpt-image-2 단가 확인 시 수정
const RATE = { textIn: 5, imageIn: 10, imageOut: 40 };
const KRW_PER_USD = 1400; // 대략 환산용

function costOf(usage: any): number {
  if (!usage) return 0;
  const textIn = usage.input_tokens_details?.text_tokens || 0;
  const imageIn = usage.input_tokens_details?.image_tokens || 0;
  const imageOut = usage.output_tokens || 0;
  return (
    (textIn * RATE.textIn + imageIn * RATE.imageIn + imageOut * RATE.imageOut) /
    1_000_000
  );
}

export async function GET() {
  let today = { calls: 0, cost: 0 };
  let total = { calls: 0, cost: 0 };
  try {
    const lines = fs.readFileSync(USAGE_FILE, "utf8").split("\n").filter(Boolean);
    const todayStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, 로컬(KST)
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        const cost = costOf(rec.usage);
        total.calls++;
        total.cost += cost;
        if (new Date(rec.ts).toLocaleDateString("sv-SE") === todayStr) {
          today.calls++;
          today.cost += cost;
        }
      } catch {}
    }
  } catch {} // 파일 없으면 0
  return NextResponse.json({ today, total, krwPerUsd: KRW_PER_USD });
}
