// 진짜 오려내기 — 원본 픽셀 보존, 배경만 투명 (AI 재생성 아님, API 비용 0원)
// 모델: onnx-community/BiRefNet_lite-ONNX (MIT) · 라이브러리: @huggingface/transformers (Apache-2.0)
// 서버에서 실행: 모델을 서버가 한 번만 받고(약 200MB, ~/.cache) 모두가 함께 쓴다.
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipePromise: Promise<any> | null = null;

function getPipe() {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline(
        "background-removal",
        "onnx-community/BiRefNet_lite-ONNX",
        { dtype: "fp32" },
      );
    })();
    pipePromise.catch(() => {
      pipePromise = null; // 실패 시 다음 요청에서 재시도
    });
  }
  return pipePromise;
}

export async function POST(req: NextRequest) {
  const { image } = await req.json();
  if (typeof image !== "string" || !image.startsWith("data:image")) {
    return NextResponse.json({ error: "이미지가 없습니다" }, { status: 400 });
  }

  try {
    const pipe = await getPipe();
    // Node에서는 data URL을 직접 못 읽으므로 Blob으로 변환해서 넘긴다
    const { RawImage } = await import("@huggingface/transformers");
    const buf = Buffer.from(image.split(",", 2)[1], "base64");
    const raw = await RawImage.fromBlob(
      new Blob([new Uint8Array(buf)], { type: "image/png" }),
    );
    const result = await pipe(raw);
    const out = Array.isArray(result) ? result[0] : result;

    // RawImage(RGBA) → PNG (Node에서는 toBlob 대신 sharp 경로를 쓴다)
    const png = await out.toSharp().png().toBuffer();
    return NextResponse.json({
      image: `data:image/png;base64,${png.toString("base64")}`,
    });
  } catch (e) {
    console.error("cutout 실패:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "오려내기 실패" },
      { status: 500 },
    );
  }
}
