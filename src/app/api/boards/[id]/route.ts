// 보드 하나 불러오기 / 삭제 / 이미지 목록 확인
import { NextRequest, NextResponse } from "next/server";
import {
  deleteBoard,
  readImages,
  readMeta,
  readState,
  safeId,
  storedImageIds,
} from "@/lib/board-store";

export const maxDuration = 120;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const boardId = safeId(id);
  if (!boardId) return NextResponse.json({ error: "잘못된 id" }, { status: 400 });

  const meta = readMeta(boardId);
  if (!meta) return NextResponse.json({ error: "없는 보드" }, { status: 404 });

  // ?manifest=1 이면 저장된 이미지 id만 (저장 전 중복 업로드 방지용)
  if (req.nextUrl.searchParams.get("manifest") === "1") {
    return NextResponse.json({ meta, imageIds: storedImageIds(boardId) });
  }
  return NextResponse.json({
    meta,
    state: readState(boardId),
    images: readImages(boardId),
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const boardId = safeId(id);
  if (!boardId) return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  deleteBoard(boardId);
  return NextResponse.json({ ok: true });
}
