// 서버 전용 키 보관 — 브라우저에는 키 값을 절대 내려보내지 않고 "설정됨/미설정"만 알려준다.
// 읽는 순서: 프로세스 환경변수 → 프로젝트 .env.local → 사용자 홈 .env
import "server-only";
import fs from "fs";
import path from "path";
import os from "os";

const LOCAL_ENV = path.join(process.cwd(), ".env.local");
const HOME_ENV = path.join(os.homedir(), ".env");

function readFromFile(file: string, name: string): string | undefined {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(
        new RegExp(`^${name}\\s*=\\s*["']?([^"'\\s]+)["']?\\s*$`),
      );
      if (m) return m[1];
    }
  } catch {}
  return undefined;
}

export function getKey(name: string): string | undefined {
  return (
    process.env[name] || readFromFile(LOCAL_ENV, name) || readFromFile(HOME_ENV, name)
  );
}

/** 설정 화면에서 넣은 키를 프로젝트 .env.local에 저장한다 (로컬 실행 전제) */
export function saveKey(name: string, value: string) {
  let text = "";
  try {
    text = fs.readFileSync(LOCAL_ENV, "utf8");
  } catch {}
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  text = re.test(text)
    ? text.replace(re, line)
    : (text.endsWith("\n") || text === "" ? text : text + "\n") + line + "\n";
  fs.writeFileSync(LOCAL_ENV, text, "utf8");
  process.env[name] = value; // 재시작 없이 즉시 반영
}

export function clearKey(name: string) {
  try {
    const text = fs.readFileSync(LOCAL_ENV, "utf8");
    fs.writeFileSync(
      LOCAL_ENV,
      text.replace(new RegExp(`^${name}=.*$\\n?`, "m"), ""),
      "utf8",
    );
  } catch {}
  delete process.env[name];
}

/** 키 값을 노출하지 않는 가림 표기 (예: sk-…F3kQ) */
export function maskKey(value: string): string {
  return value.length <= 8
    ? "설정됨"
    : `${value.slice(0, 3)}…${value.slice(-4)}`;
}
