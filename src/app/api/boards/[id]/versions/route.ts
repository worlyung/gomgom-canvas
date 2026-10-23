import { NextRequest, NextResponse } from "next/server";
import { safeId, listVersions, readVersion } from "@/lib/board-store";
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = safeId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "잘못된 보드" }, { status: 400 });
  const version = req.nextUrl.searchParams.get("version");
  if (!version) return NextResponse.json({ versions: listVersions(id) });
  const snapshot = readVersion(id, version);
  return snapshot
    ? NextResponse.json(snapshot)
    : NextResponse.json({ error: "복구 기록 없음" }, { status: 404 });
}
