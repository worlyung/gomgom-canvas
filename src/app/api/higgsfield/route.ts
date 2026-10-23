import { NextRequest, NextResponse } from "next/server";
import {
  HF_MODELS,
  hfConfigured,
  listJobs,
  readJob,
  submitJob,
  refreshJob,
  cancelJob,
  readJobMedia,
} from "@/lib/higgsfield";
import { saveKey } from "@/lib/server-keys";
import { z } from "zod";
export const maxDuration = 180;
function local(req: NextRequest) {
  const host = req.nextUrl.hostname;
  return (
    ["localhost", "127.0.0.1", "[::1]"].includes(host) &&
    (!req.headers.get("origin") ||
      req.headers.get("origin") === req.nextUrl.origin)
  );
}
function owner(req: NextRequest) {
  const s = req.cookies.get("canvas-owner")?.value;
  return s && /^[a-f0-9-]{36}$/.test(s) ? s : crypto.randomUUID();
}
function reply(data: unknown, user: string, status = 200) {
  const r = NextResponse.json(data, { status });
  r.cookies.set("canvas-owner", user, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 365 * 86400,
    path: "/",
  });
  return r;
}
export async function GET(req: NextRequest) {
  if (!local(req))
    return NextResponse.json(
      { error: "로컬 앱에서만 사용할 수 있어요" },
      { status: 403 },
    );
  const user = owner(req);
  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return reply(
      { configured: hfConfigured(), models: HF_MODELS, jobs: listJobs(user) },
      user,
    );
  const job = readJob(id);
  if (!job || job.owner !== user)
    return reply({ error: "작업을 찾을 수 없어요" }, user, 404);
  try {
    if (req.nextUrl.searchParams.has("media")) {
      const m = readJobMedia(
        job,
        Number(req.nextUrl.searchParams.get("media")),
      );
      if (!m) return reply({ error: "파일 없음" }, user, 404);
      return new NextResponse(new Uint8Array(m.data), {
        headers: {
          "Content-Type": m.type,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return reply({ job: await refreshJob(job) }, user);
  } catch (e) {
    return reply({ error: (e as Error).message }, user, 502);
  }
}
export async function POST(req: NextRequest) {
  if (!local(req))
    return NextResponse.json(
      { error: "로컬 앱에서만 사용할 수 있어요" },
      { status: 403 },
    );
  const user = owner(req);
  try {
    const b = await req.json();
    if (b.action === "key") {
      if (process.env.LOCK_KEY_EDITING === "1")
        return reply({ error: "키 편집이 잠겨 있어요" }, user, 403);
      const key = z
        .string()
        .trim()
        .min(8)
        .max(500)
        .regex(/^[^\s'"`]+$/)
        .parse(b.key);
      saveKey("HF_API_KEY", key);
      return reply({ configured: true }, user);
    }
    if (b.action === "cancel") {
      const j = readJob(String(b.id));
      if (!j || j.owner !== user)
        return reply({ error: "작업 없음" }, user, 404);
      return reply({ job: await cancelJob(j) }, user);
    }
    const data = z
      .object({
        id: z.string().uuid(),
        model: z.enum([
          "soul",
          "kling",
          "kling-image",
          "seedance",
          "seedance-image",
        ]),
        prompt: z.string().trim().min(1).max(5000),
        duration: z.number().int().min(3).max(30),
        ratio: z.enum(["16:9", "9:16", "1:1"]),
        reference: z.string().max(20_000_000).optional(),
      })
      .refine(
        (d) =>
          d.model.startsWith("seedance") ? d.duration >= 4 : d.duration <= 15,
        {
          message: "모델에 맞는 영상 길이를 선택해 주세요",
          path: ["duration"],
        },
      )
      .parse(b);
    const existing = readJob(data.id);
    if (existing)
      return existing.owner === user
        ? reply({ job: existing }, user)
        : reply({ error: "중복 ID" }, user, 409);
    if (!hfConfigured())
      return reply({ error: "Higgsfield API 키를 연결해 주세요" }, user, 503);
    const job = await submitJob(
      {
        id: data.id,
        owner: user,
        model: data.model,
        prompt: data.prompt,
        duration: data.duration,
        ratio: data.ratio,
        createdAt: new Date().toISOString(),
        status: "preparing",
      },
      data.reference,
    );
    return reply({ job }, user);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof z.ZodError
            ? "입력값을 확인해 주세요"
            : (e as Error).message,
      },
      user,
      400,
    );
  }
}
