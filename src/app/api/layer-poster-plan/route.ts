import { NextRequest, NextResponse } from "next/server";
import { getKey } from "@/lib/server-keys";
import { parsePosterPlan, posterPlanResponseFormat } from "@/lib/layer-poster";

export const maxDuration = 120;
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (
      typeof body.brief !== "string" ||
      !body.brief.trim() ||
      body.brief.length > 8000
    )
      return NextResponse.json(
        { error: "기획 요청을 8,000자 이내로 적어주세요" },
        { status: 400 },
      );
    const key = getKey("OPENAI_API_KEY_COMPANY");
    if (!key)
      return NextResponse.json(
        { error: "OpenAI 키를 설정해 주세요" },
        { status: 503 },
      );
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(110000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        response_format: posterPlanResponseFormat,
        messages: [
          {
            role: "system",
            content: `한국 문화예술 포스터를 편집 가능한 레이어로 기획한다. JSON만 반환한다.
형식: {"concept":"기획 요약", "style":"모든 그림에 적용할 화풍, 색상, 질감", "background":"글자와 주요 오브제 없는 배경 생성 지시", "ink":"#RRGGBB", "elements":[{"name":"요소 이름", "prompt":"그 요소 하나만 그리는 지시", "x":0.15,"y":0.4,"width":0.6}]}
캔버스는 1024x1536 세로. 상단 0~0.34는 제목, 하단 0.87~1은 일시와 장소. 그림은 중간에 둔다. 좌표와 폭은 캔버스 대비 비율이다. 요소 2~3개를 각각 투명 PNG로 만들 예정이므로 연결되지 않은 독립 형태로 기획한다. 가장 큰 주연부터 나열한다. 요소의 정사각형 상자 높이는 width*2/3 비율이며 하단 0.87을 넘기지 마라. 요소의 겹침은 허용하되 제목과 상세 정보는 가리지 마라. 배경은 낮은 대비의 여백 위주. 모든 그림에 글자, 로고, 날짜, 안내문을 그리지 마라. 사용자 요청에 없는 행사 사실을 만들지 마라.`,
          },
          { role: "user", content: body.brief },
        ],
      }),
    });
    if (!response.ok) throw new Error(`기획 요청 실패 (${response.status})`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("기획 응답 없음");
    const plan = parsePosterPlan(JSON.parse(content));
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      {
        error:
          "기획 결과를 완성하지 못했어요. 잠시 후 ‘기획·구도 만들기’를 다시 눌러주세요.",
      },
      { status: 502 },
    );
  }
}
