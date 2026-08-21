// 보드 목록 / 저장
import { NextRequest, NextResponse } from "next/server";
import {
  listBoards,
  pruneImages,
  readMeta,
  safeId,
  writeBoard,
} from "@/lib/board-store";

export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ boards: listBoards() });
}

export async function POST(req: NextRequest) {
  const { id, name, state, updatedBy, knownUpdatedAt, keepImageIds } =
    await req.json();
  const boardId = safeId(String(id || ""));
  if (!boardId) {
    return NextResponse.json({ error: "잘못된 보드 id" }, { status: 400 });
  }

  // 다른 사람이 먼저 저장했는지 확인 (덮어쓰기 사고 방지)
  const current = readMeta(boardId);
  if (current && knownUpdatedAt && current.updatedAt !== knownUpdatedAt) {
    return NextResponse.json(
      {
        error: "conflict",
        message: `${current.updatedBy}님이 ${new Date(
          current.updatedAt,
        ).toLocaleString("ko-KR")}에 먼저 저장했습니다`,
        serverUpdatedAt: current.updatedAt,
      },
      { status: 409 },
    );
  }

  if (Array.isArray(keepImageIds)) pruneImages(boardId, keepImageIds);
  const meta = writeBoard(
    boardId,
    String(name || "이름 없는 보드"),
    state,
    String(updatedBy || ""),
  );
  return NextResponse.json({ ok: true, meta });
}
