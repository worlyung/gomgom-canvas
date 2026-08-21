// 제공자 키 상태 조회 / 저장 / 삭제
// ⚠️ 키 "값"은 절대 내려보내지 않는다. 가림 표기만.
import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/providers";
import { clearKey, getKey, maskKey, saveKey } from "@/lib/server-keys";

// 사내 서버 등 여러 사람이 접근하는 곳에서는 키 편집을 잠근다
const EDIT_LOCKED = process.env.LOCK_KEY_EDITING === "1";

export async function GET() {
  return NextResponse.json({
    editLocked: EDIT_LOCKED,
    providers: PROVIDERS.map((p) => {
      const key = getKey(p.envKey);
      return {
        id: p.id,
        label: p.label,
        envKey: p.envKey,
        keyHint: p.keyHint,
        docsUrl: p.docsUrl,
        caps: p.caps,
        note: p.note,
        configured: !!key,
        masked: key ? maskKey(key) : null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  if (EDIT_LOCKED) {
    return NextResponse.json(
      { error: "이 서버에서는 키 편집이 잠겨 있습니다 (LOCK_KEY_EDITING=1)" },
      { status: 403 },
    );
  }
  const { id, value } = await req.json();
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    return NextResponse.json({ error: "알 수 없는 제공자" }, { status: 400 });
  }
  if (typeof value !== "string" || !value.trim()) {
    clearKey(provider.envKey);
    return NextResponse.json({ ok: true, configured: false });
  }
  saveKey(provider.envKey, value.trim());
  return NextResponse.json({
    ok: true,
    configured: true,
    masked: maskKey(value.trim()),
  });
}
