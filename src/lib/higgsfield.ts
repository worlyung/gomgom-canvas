import "server-only";
import fs from "fs";
import path from "path";
import { getKey } from "./server-keys";
export const HF_MODELS = {
  seedance: {
    label: "Seedance 2.5 · 글에서 영상",
    path: "bytedance/seedance-2.5/text-to-video",
    kind: "video",
  },
  "seedance-image": {
    label: "Seedance 2.5 · 선택 이미지로 영상",
    path: "bytedance/seedance-2.5/reference-to-video",
    kind: "video",
  },
  soul: {
    label: "Soul 2 · 이미지",
    path: "higgsfield-ai/soul/v2/standard",
    kind: "image",
  },
  kling: {
    label: "Kling 3 · 글에서 영상",
    path: "kling-video/v3.0/std/text-to-video",
    kind: "video",
  },
  "kling-image": {
    label: "Kling 3 · 이미지에서 영상",
    path: "kling-video/v3.0/std/image-to-video",
    kind: "video",
  },
} as const;
export interface HFJob {
  id: string;
  owner: string;
  createdAt: string;
  model: keyof typeof HF_MODELS;
  prompt: string;
  status: string;
  requestId?: string;
  error?: string;
  files?: { name: string; type: string }[];
  duration: number;
  ratio: string;
}
const root = () =>
  process.env.CANVAS_JOBS_DIR ||
  path.join(
    process.env.TURDAM_CANVAS_DATA || path.join(process.cwd(), ".."),
    "canvas-jobs",
  );
export function readJob(id: string): HFJob | null {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(root(), `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}
export function writeJob(job: HFJob) {
  fs.mkdirSync(root(), { recursive: true });
  const p = path.join(root(), `${job.id}.json`),
    temp = p + `.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(job));
  fs.renameSync(temp, p);
}
export function listJobs(owner: string) {
  if (!fs.existsSync(root())) return [];
  return fs
    .readdirSync(root())
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJob(f.slice(0, -5)))
    .filter((j): j is HFJob => !!j && j.owner === owner)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
const credential = () => getKey("HF_API_KEY") || getKey("HIGGSFIELD_API_KEY");
export function hfConfigured() {
  return !!credential();
}
class ProviderRejected extends Error {}
async function hf(endpoint: string, method = "GET", body?: unknown) {
  const key = credential();
  if (!key) throw new Error("Higgsfield API 키를 먼저 연결해 주세요");
  const r = await fetch(`https://api.higgsfield.ai/${endpoint}`, {
    method,
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) {
    const message = await r.text();
    const error = message.includes("not_enough_credits")
      ? "Higgsfield API 잔액이 부족해요. API 대시보드에서 잔액을 확인해 주세요."
      : `Higgsfield 요청 실패 (${r.status})`;
    if (r.status >= 400 && r.status < 500) throw new ProviderRejected(error);
    throw new Error(error);
  }
  return await r.json();
}
export async function uploadReference(data: string) {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(data);
  if (!match || data.length > 20_000_000)
    throw new Error("20MB 이하 PNG·JPEG·WebP 이미지를 선택해 주세요");
  const signed = await hf("files/generate-upload-url", "POST", {
    content_type: match[1],
  });
  const u = new URL(signed.upload_url);
  if (u.protocol !== "https:") throw new Error("잘못된 업로드 주소");
  const r = await fetch(u, {
    method: "PUT",
    headers: signed.upload_headers,
    body: Buffer.from(match[2], "base64"),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error("참조 이미지 업로드 실패");
  return String(signed.public_url);
}
export async function submitJob(job: HFJob, reference?: string) {
  // Reserve the id before any paid request. Ambiguous failures must not resubmit.
  const folder = root();
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${job.id}.json`), JSON.stringify(job), {
    flag: "wx",
  });
  try {
    const input: Record<string, unknown> = { prompt: job.prompt };
    if (job.model === "soul")
      Object.assign(input, {
        batch_size: 1,
        resolution: "720p",
        aspect_ratio: job.ratio,
        enhance_prompt: false,
      });
    else if (job.model.startsWith("seedance")) {
      Object.assign(input, {
        duration: job.duration,
        resolution: "720p",
        aspect_ratio: job.ratio,
        output_format: "mp4",
        generate_audio: false,
      });
      if (job.model === "seedance-image")
        input.image_urls = [await uploadReference(reference || "")];
    } else {
      Object.assign(input, {
        duration: job.duration,
        sound: "off",
        multi_shots: false,
        cfg_scale: 0.5,
      });
      if (job.model === "kling-image")
        input.image_url = await uploadReference(reference || "");
      else input.aspect_ratio = job.ratio;
    }
    job.status = "submitting";
    writeJob(job);
    const result = await hf(HF_MODELS[job.model].path, "POST", input);
    if (typeof result.request_id !== "string")
      throw new Error("요청 ID를 받지 못했어요");
    job.requestId = result.request_id;
    job.status = "queued";
    writeJob(job);
    return job;
  } catch (e) {
    job.status =
      job.status === "submitting" && !(e instanceof ProviderRejected)
        ? "unknown"
        : "failed";
    job.error =
      (e as Error).message +
      (job.status === "unknown"
        ? " — 접수 여부가 불확실해요. 공급자 요청 기록을 확인한 뒤 다시 생성하세요."
        : "");
    writeJob(job);
    return job;
  }
}
const locks = new Map<string, Promise<HFJob>>();
export async function refreshJob(job: HFJob): Promise<HFJob> {
  if (locks.has(job.id)) return locks.get(job.id)!;
  const run = (async () => {
    if (
      !job.requestId ||
      ["completed", "failed", "nsfw", "canceled"].includes(job.status)
    )
      return job;
    const result = await hf(
      `requests/${encodeURIComponent(job.requestId!)}/status`,
    );
    job.status = String(result.status);
    if (job.status === "completed") {
      try {
        const media = [
          ...(Array.isArray(result.images) ? result.images : []),
          ...(result.video ? [result.video] : []),
        ];
        if (!media.length) throw new Error("결과 파일이 없어요");
        job.files = [];
        for (let i = 0; i < media.length; i++) {
          const url = new URL(media[i].url);
          if (url.protocol !== "https:") throw new Error("잘못된 결과 주소");
          const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
          if (!r.ok) throw new Error("결과 다운로드 실패");
          const type = r.headers.get("content-type")?.split(";")[0] || "";
          if (!/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(type))
            throw new Error("지원하지 않는 결과 형식");
          const data = Buffer.from(await r.arrayBuffer());
          if (data.length > 200 * 1024 * 1024)
            throw new Error("결과가 200MB를 초과했어요");
          const name = `${job.id}-${i}.${type.split("/")[1]}`;
          fs.writeFileSync(path.join(root(), name), data);
          job.files.push({ name, type });
        }
        job.error = undefined;
      } catch (e) {
        job.status = "download_failed";
        job.error = (e as Error).message;
      }
    }
    writeJob(job);
    return job;
  })();
  locks.set(job.id, run);
  try {
    return await run;
  } finally {
    locks.delete(job.id);
  }
}
export async function cancelJob(job: HFJob) {
  if (!job.requestId) throw new Error("요청 ID가 없어 취소할 수 없어요");
  await hf(`requests/${encodeURIComponent(job.requestId)}/cancel`, "POST");
  job.status = "cancel_requested";
  writeJob(job);
  return job;
}
export function readJobMedia(job: HFJob, index: number) {
  const f = job.files?.[index];
  if (!f) return null;
  return { data: fs.readFileSync(path.join(root(), f.name)), type: f.type };
}
