// 폰트 파일 내려주기 (P3) — 목록 API가 준 "폴더|파일명" 만 허용한다 (임의 경로 금지)
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const ALLOWED = [
  path.join(process.env.WINDIR || "C:\\Windows", "Fonts"),
  path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Windows", "Fonts"),
].map((d) => path.resolve(d));

const MIME: Record<string, string> = {
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ttc": "font/collection",
};

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") || "";
  const [dir, file] = name.split("|");
  if (!dir || !file || file !== path.basename(file)) {
    return NextResponse.json({ error: "잘못된 이름" }, { status: 400 });
  }
  const resolvedDir = path.resolve(dir);
  if (!ALLOWED.includes(resolvedDir)) {
    return NextResponse.json({ error: "허용되지 않은 폴더" }, { status: 403 });
  }
  const full = path.join(resolvedDir, file);
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: "폰트 없음" }, { status: 404 });
  }
  const buf = fs.readFileSync(full);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
