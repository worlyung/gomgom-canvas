// 이 PC에 설치된 폰트 목록 (P3) — Windows 폰트 폴더 2곳을 읽어 글꼴 이름을 뽑는다
// 파일 안의 name 테이블에서 한국어 이름(0x0412)을 우선, 없으면 영어(0x0409)
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DIRS = [
  path.join(process.env.WINDIR || "C:\\Windows", "Fonts"),
  path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Windows", "Fonts"),
].filter((d) => d && fs.existsSync(d));

const EXT = new Set([".ttf", ".otf", ".ttc"]);

interface Face {
  family: string;
  sub: string;
}

function readNameTable(buf: Buffer, dirOffset: number): Face | null {
  if (dirOffset + 12 > buf.length) return null;
  const numTables = buf.readUInt16BE(dirOffset + 4);
  let nameOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = dirOffset + 12 + i * 16;
    if (rec + 16 > buf.length) return null;
    if (buf.toString("latin1", rec, rec + 4) === "name") {
      nameOff = buf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (nameOff < 0 || nameOff + 6 > buf.length) return null;
  const count = buf.readUInt16BE(nameOff + 2);
  const strOff = nameOff + buf.readUInt16BE(nameOff + 4);
  const pick: Record<string, { ko?: string; en?: string; any?: string }> = {};
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    if (r + 12 > buf.length) break;
    const platform = buf.readUInt16BE(r);
    const lang = buf.readUInt16BE(r + 4);
    const nameId = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8);
    const off = strOff + buf.readUInt16BE(r + 10);
    if (platform !== 3 || off + len > buf.length) continue; // Windows 유니코드만
    if (![1, 2, 16, 17].includes(nameId)) continue;
    // UTF-16BE → 문자열
    const s = Buffer.from(buf.subarray(off, off + len))
      .swap16()
      .toString("utf16le")
      .trim();
    if (!s) continue;
    const key =
      nameId === 16
        ? "fam16"
        : nameId === 17
          ? "sub17"
          : nameId === 1
            ? "fam"
            : "sub";
    const slot = (pick[key] ||= {});
    if (lang === 0x0412) slot.ko = s;
    else if (lang === 0x0409) slot.en = s;
    else slot.any ||= s;
  }
  const get = (k: string) =>
    pick[k] && (pick[k].ko || pick[k].en || pick[k].any);
  const family = get("fam16") || get("fam");
  const sub = get("sub17") || get("sub") || "Regular";
  return family ? { family, sub } : null;
}

function readFaces(file: string): Face[] {
  const buf = fs.readFileSync(file);
  if (buf.length < 12) return [];
  const tag = buf.toString("latin1", 0, 4);
  if (tag === "ttcf") {
    // 모음 파일(.ttc) — 브라우저는 첫 얼굴만 쓰므로 첫 것만
    const off = buf.readUInt32BE(12);
    const f = readNameTable(buf, off);
    return f ? [f] : [];
  }
  const f = readNameTable(buf, 0);
  return f ? [f] : [];
}

let cache: { at: number; fonts: { family: string; file: string }[] } | null =
  null;

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) {
    return NextResponse.json({ fonts: cache.fonts });
  }
  const byFamily = new Map<string, { file: string; sub: string }>();
  for (const dir of DIRS) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of names) {
      if (!EXT.has(path.extname(n).toLowerCase())) continue;
      try {
        for (const face of readFaces(path.join(dir, n))) {
          const cur = byFamily.get(face.family);
          const isRegular = /^(regular|normal|book|보통|일반)$/i.test(face.sub);
          // 같은 글꼴의 여러 굵기 중 Regular를 대표로
          if (
            !cur ||
            (isRegular && !/^(regular|normal|book|보통|일반)$/i.test(cur.sub))
          ) {
            byFamily.set(face.family, { file: `${dir}|${n}`, sub: face.sub });
          }
        }
      } catch {
        /* 깨진 폰트는 건너뜀 */
      }
    }
  }
  const fonts = [...byFamily.entries()]
    .map(([family, v]) => ({ family, file: v.file }))
    .sort((a, b) => a.family.localeCompare(b.family, "ko"));
  cache = { at: Date.now(), fonts };
  return NextResponse.json({ fonts });
}
