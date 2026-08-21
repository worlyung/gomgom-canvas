// 이미지 한 장씩 올린다 (한꺼번에 보내면 요청이 너무 커진다)
import { NextRequest, NextResponse } from "next/server";
import { safeId, saveImage } from "@/lib/board-store";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const boardId = safeId(id);
  if (!boardId) return NextResponse.json({ error: "잘못된 id" }, { status: 400 });

  const { imageId, dataUrl } = await req.json();
  if (!imageId || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "이미지가 없습니다" }, { status: 400 });
  }
  saveImage(boardId, String(imageId).replace(/[^A-Za-z0-9_-]/g, "_"), dataUrl);
  return NextResponse.json({ ok: true });
}
