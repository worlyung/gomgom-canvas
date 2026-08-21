// 보드(프로젝트) 저장소 — 서버 파일 시스템. DB 없이 폴더 하나로 끝낸다.
//   boards/<id>/meta.json   이름·수정시각·수정자
//   boards/<id>/state.json  캔버스 상태(이미지 데이터는 빼고 id만)
//   boards/<id>/images/*.png
import "server-only";
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "..", "boards");

export interface BoardMeta {
  id: string;
  name: string;
  updatedAt: string;
  updatedBy: string;
  imageCount: number;
}

const dir = (id: string) => path.join(ROOT, id);
const imagesDir = (id: string) => path.join(dir(id), "images");

export function safeId(id: string): string | null {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

export function listBoards(): BoardMeta[] {
  try {
    return fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        try {
          const meta = JSON.parse(
            fs.readFileSync(path.join(dir(e.name), "meta.json"), "utf8"),
          );
          return meta as BoardMeta;
        } catch {
          return null;
        }
      })
      .filter((m): m is BoardMeta => !!m)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function readMeta(id: string): BoardMeta | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir(id), "meta.json"), "utf8"));
  } catch {
    return null;
  }
}

export function writeBoard(
  id: string,
  name: string,
  state: unknown,
  updatedBy: string,
) {
  fs.mkdirSync(imagesDir(id), { recursive: true });
  fs.writeFileSync(
    path.join(dir(id), "state.json"),
    JSON.stringify(state),
    "utf8",
  );
  const meta: BoardMeta = {
    id,
    name,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || "이름 없음",
    imageCount: storedImageIds(id).length,
  };
  fs.writeFileSync(
    path.join(dir(id), "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8",
  );
  return meta;
}

export function readState(id: string): unknown | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dir(id), "state.json"), "utf8"),
    );
  } catch {
    return null;
  }
}

export function storedImageIds(id: string): string[] {
  try {
    return fs
      .readdirSync(imagesDir(id))
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(/\.png$/, ""));
  } catch {
    return [];
  }
}

export function saveImage(boardId: string, imageId: string, dataUrl: string) {
  fs.mkdirSync(imagesDir(boardId), { recursive: true });
  const b64 = dataUrl.split(",", 2)[1];
  fs.writeFileSync(
    path.join(imagesDir(boardId), `${imageId}.png`),
    Buffer.from(b64, "base64"),
  );
}

export function readImages(boardId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const imgId of storedImageIds(boardId)) {
    try {
      const buf = fs.readFileSync(
        path.join(imagesDir(boardId), `${imgId}.png`),
      );
      out[imgId] = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {}
  }
  return out;
}

/** state에서 쓰이지 않는 이미지 파일 정리 */
export function pruneImages(boardId: string, keep: string[]) {
  const keepSet = new Set(keep);
  for (const imgId of storedImageIds(boardId)) {
    if (!keepSet.has(imgId)) {
      try {
        fs.unlinkSync(path.join(imagesDir(boardId), `${imgId}.png`));
      } catch {}
    }
  }
}

export function deleteBoard(id: string) {
  fs.rmSync(dir(id), { recursive: true, force: true });
}
