// 캠페인 자동 분해 — "○○ 브랜드 캠페인 만들어줘" 한 줄을 실제 이미지 작업 목록으로 쪼갠다.
// 생성은 하지 않는다. 계획만 돌려주고, 곰곰님이 확인한 뒤에 만든다.
import { NextRequest, NextResponse } from "next/server";
import { getKey } from "@/lib/server-keys";

export const maxDuration = 120;

const MODELS = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o-mini"];
let workingModel: string | undefined;

const SYSTEM = `너는 한국 공공 행사·브랜드 캠페인의 아트디렉터다.
사용자의 요청 한 줄을 실제로 만들 이미지 목록으로 쪼갠다.

🔴 가장 중요한 규칙: **사용자가 말한 행사명·주제·시기·대상을 그대로 유지한다.**
다른 주제로 바꾸거나 일반적인 캠페인으로 대체하지 마라. 사용자가 "부천 달빛국악제"라 했으면 모든 항목이 그 행사여야 한다.

규칙:
- JSON만 출력한다. 설명·마크다운 금지.
- 형식: {"concept":"한 줄 컨셉","palette":["#RRGGBB",...3~4개],"items":[{"role":"역할","prompt":"이미지 생성 프롬프트","size":"1024x1024"}]}
- items는 4~6개. 첫 번째는 반드시 **키비주얼**(전체 톤을 정하는 대표 이미지)로 두고, 나머지는 그 톤을 따르게 쓴다.
- 역할은 이 중에서 고른다: 키비주얼, 로고·심볼, 포스터, 카드뉴스 표지, 배너·현수막, 굿즈·응용, 아이콘 세트
- size는 역할에 맞게: 로고·아이콘=1024x1024, 포스터=1760x2480, 카드뉴스=1024x1024, 배너·현수막=2880x960, 키비주얼=1536x1024
- prompt는 한국어로 200자 내외. 구도·색감·분위기를 구체적으로. 문서에 없는 사실(행사명·날짜)은 지어내지 않는다.
- palette는 요청의 성격에 맞는 색을 직접 고른다.`;

export async function POST(req: NextRequest) {
  const key = getKey("OPENAI_API_KEY");
  if (!key) {
    return NextResponse.json(
      { error: "OpenAI 키가 필요합니다 (분해는 OpenAI 텍스트 모델을 씁니다)" },
      { status: 500 },
    );
  }
  const { request: userRequest } = await req.json();
  if (typeof userRequest !== "string" || !userRequest.trim()) {
    return NextResponse.json({ error: "요청이 비었습니다" }, { status: 400 });
  }

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
            content: `아래 요청을 그대로 살려서 캠페인을 쪼개라. 주제를 바꾸지 마라.

요청: ${userRequest}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.ok) {
      workingModel = model;
      const j = await resp.json();
      try {
        const plan = JSON.parse(j.choices[0].message.content);
        if (!Array.isArray(plan.items) || !plan.items.length) {
          throw new Error("items 없음");
        }
        return NextResponse.json(plan);
      } catch {
        return NextResponse.json({ error: "계획을 읽지 못했습니다" }, { status: 502 });
      }
    }
    lastErr = `${model}: ${resp.status}`;
    if (resp.status !== 404 && resp.status !== 400) break;
  }
  return NextResponse.json({ error: `분해 실패 — ${lastErr}` }, { status: 502 });
}
