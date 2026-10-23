"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emptyExtras,
  eventFields,
  parseCsv,
  parseProject,
  portableProject,
  downloadFile,
  type StudioProject,
  type EventField,
} from "@/lib/studio-project";
import {
  formats,
  preflight,
  renderFormat,
  resizeProject,
} from "@/lib/studio-render";
import { zipSync } from "fflate";
type Props = {
  open: boolean;
  videoMode?: boolean;
  onClose: () => void;
  project: StudioProject;
  onApply: (p: StudioProject, detach?: boolean) => void;
  selectedIds: string[];
  boardId: string | null;
  boardName: string;
};
type Line = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type Job = {
  id: string;
  model: string;
  prompt: string;
  status: string;
  error?: string;
  files?: { name: string; type: string }[];
  createdAt: string;
};
const tabs = [
  "프로젝트·복구",
  "행사·브랜드",
  "글씨 읽기",
  "규격·일괄 출력",
  "비교·검사",
  "Higgsfield",
];
export function StudioWorkbench({
  open,
  videoMode = false,
  onClose,
  project: p,
  onApply,
  selectedIds,
  boardId,
  boardName,
}: Props) {
  const [tab, setTab] = useState(tabs[0]),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [versions, setVersions] = useState<{ id: string; createdAt: string }[]>([]);
  const [ocr, setOcr] = useState<Line[]>([]),
    [ocrColor, setOcrColor] = useState("#ffffff"),
    [ocrId, setOcrId] = useState(""),
    [csv, setCsv] = useState("행사명,일시,장소\n국악 한마당,2026-11-01,인천"),
    [chosen, setChosen] = useState([0, 2]),
    [checks, setChecks] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]),
    [configured, setConfigured] = useState(false),
    [key, setKey] = useState(""),
    [hfModel, setHfModel] = useState("soul"),
    [hfPrompt, setHfPrompt] = useState(""),
    [ratio, setRatio] = useState("16:9"),
    [duration, setDuration] = useState(5);
  const [videoReference, setVideoReference] = useState<{
    src: string;
    name: string;
  } | null>(null);
  const selected = p.images.filter((i) => selectedIds.includes(i.id)),
    image = selected[0];
  useEffect(() => {
    if (open && image)
      setVideoReference({ src: image.src, name: "캔버스에서 선택한 이미지" });
  }, [open, image?.id]);
  useEffect(() => {
    if (open && videoMode) {
      setTab("Higgsfield");
      setHfModel((current) => (current === "soul" ? "seedance" : current));
      setDuration((current) => Math.max(4, current));
    }
  }, [open, videoMode]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "작업 실패");
    } finally {
      setBusy("");
    }
  };
  const request = async (url: string, body?: unknown) => {
    const r = await fetch(
      url,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : undefined,
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "요청 실패");
    return j;
  };
  const refresh = async () => {
    const j = await request("/api/higgsfield");
    setJobs(j.jobs);
    setConfigured(j.configured);
  };
  useEffect(() => {
    if (!open) return;
    if (tab === "Higgsfield") refresh().catch((e) => setNotice(e.message));
    if (tab === tabs[0] && boardId)
      request(`/api/boards/${boardId}/versions`)
        .then((j) => setVersions(j.versions))
        .catch((e) => setNotice(e.message));
  }, [open, tab, boardId]);
  useEffect(() => {
    if (!open || tab !== "Higgsfield") return;
    const timer = setInterval(async () => {
      try {
        for (const j of jobs.filter((j) =>
          ["queued", "in_progress", "processing", "cancel_requested"].includes(
            j.status,
          ),
        ))
          await request(`/api/higgsfield?id=${j.id}`);
        await refresh();
      } catch (e) {
        setNotice((e as Error).message);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [open, tab, jobs]);
  const updateEvent = (field: EventField, value: string) =>
    onApply({
      ...p,
      extras: { ...p.extras, event: { ...p.extras.event, [field]: value } },
      texts: p.texts.map((t) =>
        p.extras.links[t.id] === field ? { ...t, text: value } : t,
      ),
    });
  const fileData = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>작업 관리</DialogTitle>
        </DialogHeader>
        <nav className="flex flex-wrap gap-2" aria-label="작업 관리 메뉴">
          {tabs.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "primary" : "outline"}
              onClick={() => {
                setTab(t);
                setNotice("");
              }}
            >
              {t}
            </Button>
          ))}
        </nav>
        {busy && <p role="status">{busy}…</p>}
        {notice && (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 p-3 text-amber-900 whitespace-pre-wrap"
          >
            {notice}
          </p>
        )}
        <fieldset disabled={!!busy} className="space-y-4 min-w-0">
          {tab === tabs[0] && (
            <>
              <p>
                이미지·영상·편집 요소·행사 자료·생성 설정을 한 파일로 보관해요.
                API 키는 포함하지 않아요.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={() =>
                    act("프로젝트 파일 준비", async () => {
                      const data = await portableProject(
                        p,
                        boardName || "새 작업",
                      );
                      downloadFile(
                        `${boardName || "곰곰작업"}.gomgom.json`,
                        new Blob([JSON.stringify(data)], {
                          type: "application/json",
                        }),
                      );
                      setNotice("프로젝트 파일을 내려받았어요.");
                    })
                  }
                >
                  프로젝트 내보내기
                </Button>
                <label className="border rounded-lg p-2 cursor-pointer">
                  프로젝트 가져오기
                  <input
                    aria-label="프로젝트 가져오기"
                    type="file"
                    accept=".json"
                    className="block text-xs mt-1"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        act("프로젝트 읽기", async () => {
                          if (f.size > 400 * 1024 * 1024)
                            throw new Error("프로젝트는 400MB 이하여야 해요");
                          const data = parseProject(JSON.parse(await f.text()));
                          if (
                            !confirm(
                              "현재 화면을 가져온 프로젝트로 바꿀까요? 현재 작업은 먼저 저장해 주세요.",
                            )
                          )
                            return;
                          onApply(data.project, true);
                          setNotice(
                            `${data.name}을 열었어요. 다른 이름으로 저장해 주세요.`,
                          );
                        });
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <h3 className="font-semibold">이전 저장본 복구 · 최근 10개</h3>
              <p className="text-sm text-muted-foreground">
                이름 있는 보드를 다시 저장할 때 이전 상태를 남겨요. 복구한
                화면을 확인한 후 저장하면 적용돼요.
              </p>
              {!boardId ? (
                <p>먼저 보드 저장·열기에서 이름을 붙여 저장해 주세요.</p>
              ) : versions.length ? (
                versions.map((v) => (
                  <Button
                    key={v.id}
                    variant="outline"
                    className="mr-2"
                    onClick={() =>
                      act("복구본 열기", async () => {
                        const d = await request(
                          `/api/boards/${boardId}/versions?version=${encodeURIComponent(v.id)}`,
                        );
                        if (!confirm("선택한 저장 시점으로 화면을 바꿀까요?"))
                          return;
                        onApply({
                          ...p,
                          ...d.state,
                          images: (d.state.images || []).map(
                            (i: { id: string }) => ({
                              ...i,
                              src: d.images[i.id],
                            }),
                          ),
                          videos: d.state.videos || [],
                          extras: d.state.extras || emptyExtras(),
                        });
                        setNotice("복구본을 열었어요. 확인 후 저장해 주세요.");
                      })
                    }
                  >
                    {new Date(v.createdAt).toLocaleString("ko-KR")}
                  </Button>
                ))
              ) : (
                <p>아직 이전 저장본이 없어요.</p>
              )}
            </>
          )}
          {tab === tabs[1] && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                {eventFields.map((field) => (
                  <label key={field}>
                    {field}
                    <Input
                      value={p.extras.event[field]}
                      onChange={(e) => updateEvent(field, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <Button
                onClick={() => {
                  const links = { ...p.extras.links };
                  const texts = eventFields
                    .filter((f) => p.extras.event[f])
                    .map((f, n) => {
                      const id = crypto.randomUUID();
                      links[id] = f;
                      return {
                        id,
                        text: p.extras.event[f],
                        x: p.artboard?.x || 0,
                        y: (p.artboard?.y || 0) + n * 65,
                        fontSize: n ? 32 : 48,
                        fontFamily: p.extras.brand.font,
                        fill: p.extras.brand.color,
                        rotation: 0,
                        z: 10000 + n,
                      };
                    });
                  onApply({
                    ...p,
                    texts: [...p.texts, ...texts],
                    extras: { ...p.extras, links },
                  });
                  setNotice(
                    "행사 정보와 연결된 글자를 넣었어요. 위 정보를 바꾸면 함께 바뀌어요.",
                  );
                }}
              >
                행사 문구를 편집 가능한 글자로 넣기
              </Button>
              {p.texts
                .filter(
                  (t) => selectedIds.includes(t.id) && p.extras.links[t.id],
                )
                .map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    onClick={() => {
                      const links = { ...p.extras.links };
                      delete links[t.id];
                      onApply({ ...p, extras: { ...p.extras, links } });
                    }}
                  >
                    선택 글자 연결 해제 · {t.text.slice(0, 20)}
                  </Button>
                ))}
              <div className="grid sm:grid-cols-3 gap-3">
                <label>
                  브랜드 이름
                  <Input
                    value={p.extras.brand.name}
                    onChange={(e) =>
                      onApply({
                        ...p,
                        extras: {
                          ...p.extras,
                          brand: { ...p.extras.brand, name: e.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  기본 글자색
                  <Input
                    type="color"
                    value={p.extras.brand.color}
                    onChange={(e) =>
                      onApply({
                        ...p,
                        extras: {
                          ...p.extras,
                          brand: { ...p.extras.brand, color: e.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  폰트
                  <Input
                    value={p.extras.brand.font}
                    onChange={(e) =>
                      onApply({
                        ...p,
                        extras: {
                          ...p.extras,
                          brand: { ...p.extras.brand, font: e.target.value },
                        },
                      })
                    }
                  />
                </label>
              </div>
              <label className="block">
                로고·공연자 사진 보관
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    act("자료 보관", async () => {
                      const assets = await Promise.all(
                        files.map(async (f) => {
                          if (f.size > 10 * 1024 * 1024)
                            throw new Error("자료당 10MB 이하를 사용해 주세요");
                          return {
                            id: crypto.randomUUID(),
                            name: f.name,
                            src: await fileData(f),
                            role: "자료",
                          };
                        }),
                      );
                      onApply({
                        ...p,
                        extras: {
                          ...p.extras,
                          brand: {
                            ...p.extras.brand,
                            assets: [...p.extras.brand.assets, ...assets],
                          },
                        },
                      });
                    });
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                {p.extras.brand.assets.map((a) => (
                  <div key={a.id} className="rounded-xl border p-2">
                    <img
                      src={a.src}
                      alt={a.name}
                      className="h-24 w-full object-contain"
                    />
                    <p className="truncate text-sm">{a.name}</p>
                    <select
                      aria-label={`${a.name} 용도`}
                      value={a.role}
                      onChange={(e) =>
                        onApply({
                          ...p,
                          extras: {
                            ...p.extras,
                            brand: {
                              ...p.extras.brand,
                              assets: p.extras.brand.assets.map((x) =>
                                x.id === a.id
                                  ? { ...x, role: e.target.value }
                                  : x,
                              ),
                            },
                          },
                        })
                      }
                    >
                      {["자료", "로고", "인물", "스타일", "구도"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        act("자료 넣기", async () => {
                          const i = new Image();
                          i.src = a.src;
                          await i.decode();
                          onApply({
                            ...p,
                            images: [
                              ...p.images,
                              {
                                id: crypto.randomUUID(),
                                src: a.src,
                                x: 0,
                                y: 0,
                                width: 300,
                                height: (300 * i.height) / i.width,
                                rotation: 0,
                                z: 10000,
                              },
                            ],
                          });
                        })
                      }
                    >
                      캔버스에 넣기
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onApply({
                          ...p,
                          extras: {
                            ...p.extras,
                            brand: {
                              ...p.extras.brand,
                              assets: p.extras.brand.assets.filter(
                                (x) => x.id !== a.id,
                              ),
                            },
                          },
                        })
                      }
                    >
                      보관함에서 빼기
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === tabs[2] && (
            <>
              <p>
                캔버스에서 이미지 한 장을 선택한 뒤 읽어 주세요. 인식
                위치·폰트는 근사값이며 적용 전에 문구를 확인해 주세요.
              </p>
              <Button
                disabled={!image}
                onClick={() =>
                  act("글씨 읽기", async () => {
                    const j = await request("/api/ocr", { image: image.src });
                    setOcr(j.lines);
                    setOcrId(image.id);
                    setNotice(
                      `${j.lines.length}줄을 읽었어요. 틀린 글자를 고친 뒤 적용해 주세요.`,
                    );
                  })
                }
              >
                선택 이미지 글씨 읽기
              </Button>
              {ocr.map((line, i) => (
                <Input
                  key={i}
                  aria-label={`인식 글씨 ${i + 1}`}
                  value={line.text}
                  onChange={(e) =>
                    setOcr(
                      ocr.map((l, n) =>
                        n === i ? { ...l, text: e.target.value } : l,
                      ),
                    )
                  }
                />
              ))}
              {ocr.length > 0 && (
                <label className="flex items-center gap-3">
                  새 글자 색상
                  <Input
                    type="color"
                    aria-label="인식 글자 색상"
                    value={ocrColor}
                    onChange={(e) => setOcrColor(e.target.value)}
                    className="w-20"
                  />
                </label>
              )}
              <Button
                disabled={!ocr.length || !p.images.some((i) => i.id === ocrId)}
                onClick={() => {
                  const im = p.images.find((i) => i.id === ocrId)!;
                  onApply({
                    ...p,
                    texts: [
                      ...p.texts,
                      ...ocr
                        .filter((l) => l.text.trim())
                        .map((l) => ({
                          id: crypto.randomUUID(),
                          text: l.text,
                          x: im.x + l.x * im.width,
                          y: im.y + l.y * im.height,
                          fontSize: Math.max(
                            8,
                            Math.min(
                              l.height * im.height * 0.8,
                              (l.width * im.width) /
                                Math.max(1, l.text.length * 0.8),
                            ),
                          ),
                          fontFamily: p.extras.brand.font,
                          fill: ocrColor,
                          rotation: 0,
                          z: (im.z || 0) + 1,
                        })),
                    ],
                  });
                  setNotice(
                    "편집 가능한 글자를 추가했어요. 원래 이미지 글씨를 지우려면 아래 배경 정리를 실행하세요.",
                  );
                }}
              >
                확인한 글씨를 편집 요소로 추가
              </Button>
              <Button
                variant="outline"
                disabled={!ocr.length}
                onClick={() =>
                  act("원래 글씨 배경 정리", async () => {
                    const im = p.images.find((i) => i.id === ocrId);
                    if (!im) throw new Error("원본 이미지가 없어요");
                    const img = new Image();
                    img.src = im.src;
                    await img.decode();
                    const mask = document.createElement("canvas");
                    mask.width = img.naturalWidth;
                    mask.height = img.naturalHeight;
                    const ctx = mask.getContext("2d")!;
                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, mask.width, mask.height);
                    ocr.forEach((l) =>
                      ctx.clearRect(
                        Math.max(0, l.x * mask.width - 4),
                        Math.max(0, l.y * mask.height - 4),
                        l.width * mask.width + 8,
                        l.height * mask.height + 8,
                      ),
                    );
                    const j = await request("/api/generate", {
                      prompt:
                        "Remove only the writing inside transparent mask regions. Reconstruct the underlying background naturally. Do not add any text. Keep the remaining image unchanged.",
                      refs: [im.src],
                      mask: mask.toDataURL(),
                      size: `${Math.round(img.width / 16) * 16}x${Math.round(img.height / 16) * 16}`,
                      quality: "high",
                      provider: "openai",
                      openaiModel: "gpt-image-2",
                      n: 1,
                    });
                    const src =
                      typeof j.images[0] === "string"
                        ? j.images[0]
                        : j.images[0].url;
                    onApply({
                      ...p,
                      images: [
                        ...p.images.map((i) =>
                          i.id === im.id ? { ...i, hidden: true } : i,
                        ),
                        { ...im, id: crypto.randomUUID(), src, hidden: false },
                      ],
                    });
                    setNotice(
                      "원본은 숨겨 보존했어요. 배경 정리 결과와 글씨 위치를 확인해 주세요.",
                    );
                  })
                }
              >
                원래 글씨 지우고 배경 정리 · AI 사용
              </Button>
            </>
          )}
          {tab === tabs[3] && (
            <>
              <p>
                현재 작업판 또는 전체 내용을 비율 유지해 맞춰 넣어요.
                글자·로고를 다시 생성하지 않아요. 규격마다 여백과 배치를 미리
                확인해 주세요.
              </p>
              <div className="flex flex-wrap gap-3">
                {formats.map((f, i) => (
                  <label key={f.name}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(i)}
                      onChange={(e) =>
                        setChosen(
                          e.target.checked
                            ? [...chosen, i]
                            : chosen.filter((n) => n !== i),
                        )
                      }
                    />{" "}
                    {f.name} {f.w}×{f.h}
                  </label>
                ))}
              </div>
              <Button
                disabled={!chosen.length}
                onClick={() =>
                  act("규격별 PNG 묶음 만들기", async () => {
                    const files: Record<string, Uint8Array> = {};
                    for (const i of chosen) {
                      const f = formats[i];
                      files[`${f.name}.png`] = new Uint8Array(
                        await (await renderFormat(p, f.w, f.h)).arrayBuffer(),
                      );
                    }
                    downloadFile(
                      "홍보물_규격별.zip",
                      new Blob([new Uint8Array(zipSync(files))]),
                    );
                    setNotice(
                      "규격별 PNG를 묶었어요. 여백·글씨 크기를 확인해 주세요.",
                    );
                  })
                }
              >
                선택 규격 ZIP 출력
              </Button>
              <Button
                variant="outline"
                disabled={!chosen.length}
                onClick={() =>
                  act("출력 미리보기", async () => {
                    const f = formats[chosen[0]];
                    setPreview(
                      URL.createObjectURL(await renderFormat(p, f.w, f.h)),
                    );
                  })
                }
              >
                첫 선택 규격 미리보기
              </Button>
              <Button
                variant="outline"
                disabled={!chosen.length}
                onClick={() =>
                  act("규격 편집본 만들기", async () => {
                    if (
                      !confirm(
                        "현재 작업을 먼저 저장했나요? 선택 규격의 새 편집본으로 화면을 바꿔요.",
                      )
                    )
                      return;
                    const f = formats[chosen[0]];
                    onApply(resizeProject(p, f), true);
                    setNotice(
                      `${f.name} 편집본을 만들었어요. 글자와 로고를 조절한 뒤 다른 이름으로 저장해 주세요.`,
                    );
                  })
                }
              >
                첫 선택 규격을 새 편집본으로
              </Button>
              {preview && (
                <img
                  src={preview}
                  alt="규격 출력 미리보기"
                  className="max-h-80 max-w-full border rounded-lg"
                />
              )}
              <h3>행사 목록으로 반복 제작</h3>
              <p className="text-sm">
                행사·브랜드에서 연결한 글자가 CSV 값으로 바뀌어요. 제목 행은
                행사명·일시·장소·주최·문의 중에서 사용하세요. 최대 30행이에요.
              </p>
              <textarea
                aria-label="행사 CSV"
                className="w-full min-h-32 border rounded p-2 bg-background"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
              />
              <input
                aria-label="CSV 파일 가져오기"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) act("CSV 읽기", async () => setCsv(await f.text()));
                  e.target.value = "";
                }}
              />
              <Button
                disabled={!chosen.length}
                onClick={() =>
                  act("행사별 시안 만들기", async () => {
                    const rows = parseCsv(csv);
                    if (!rows.length || rows.length > 30)
                      throw new Error("1~30행을 넣어 주세요");
                    if (
                      Object.keys(rows[0]).some(
                        (h) => !eventFields.includes(h as EventField),
                      )
                    )
                      throw new Error(
                        "CSV 제목은 행사명·일시·장소·주최·문의만 사용할 수 있어요",
                      );
                    if (
                      rows.length *
                        chosen.reduce(
                          (sum, i) => sum + formats[i].w * formats[i].h,
                          0,
                        ) >
                      200_000_000
                    )
                      throw new Error(
                        "출력량이 커요. 행사 행이나 규격을 나누어 출력해 주세요",
                      );
                    if (!Object.keys(p.extras.links).length)
                      throw new Error(
                        "먼저 행사 정보를 연결한 글자를 넣어 주세요",
                      );
                    const files: Record<string, Uint8Array> = {};
                    for (let n = 0; n < rows.length; n++)
                      for (const i of chosen) {
                        const f = formats[i];
                        files[`${n + 1}_${f.name}.png`] = new Uint8Array(
                          await (
                            await renderFormat(p, f.w, f.h, rows[n])
                          ).arrayBuffer(),
                        );
                      }
                    downloadFile(
                      "행사별_홍보물.zip",
                      new Blob([new Uint8Array(zipSync(files))]),
                    );
                  })
                }
              >
                CSV 행사별 ZIP 출력
              </Button>
            </>
          )}
          {tab === tabs[4] && (
            <>
              <p>
                이미지를 두 장 이상 선택하면 나란히 비교할 수 있어요. 확정
                표시는 프로젝트에 저장돼요.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {selected.map((im) => (
                  <div key={im.id}>
                    <img
                      src={im.src}
                      alt={im.promptHint || "비교 이미지"}
                      className="w-full max-h-80 object-contain rounded border"
                    />
                    <p className="text-xs">{im.promptHint}</p>
                    {im.generation && (
                      <details className="text-xs my-2">
                        <summary>생성 조건·참조 기록</summary>
                        <p>
                          {im.generation.provider} · {im.generation.model} ·{" "}
                          {im.generation.size} · {im.generation.quality}
                        </p>
                        <p className="whitespace-pre-wrap">
                          {im.generation.prompt}
                        </p>
                        <p>
                          참조 {im.generation.referenceIds.length}개 ·{" "}
                          {new Date(im.generation.createdAt).toLocaleString(
                            "ko-KR",
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onApply({
                              ...p,
                              extras: {
                                ...p.extras,
                                settings: {
                                  prompt: im.generation!.prompt,
                                  provider: im.generation!.provider,
                                  model: im.generation!.model,
                                  size: im.generation!.size,
                                  quality: im.generation!.quality,
                                },
                              },
                            });
                            setNotice(
                              "생성 조건을 불러왔어요. 같은 조건으로 생성해도 결과는 달라질 수 있어요.",
                            );
                          }}
                        >
                          생성 조건 불러오기
                        </Button>
                      </details>
                    )}
                    <Button
                      variant={
                        p.extras.approvedIds.includes(im.id)
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        onApply({
                          ...p,
                          extras: {
                            ...p.extras,
                            approvedIds: p.extras.approvedIds.includes(im.id)
                              ? p.extras.approvedIds.filter(
                                  (id) => id !== im.id,
                                )
                              : [...p.extras.approvedIds, im.id],
                          },
                        })
                      }
                    >
                      {p.extras.approvedIds.includes(im.id)
                        ? "확정됨 · 해제"
                        : "이 시안 확정"}
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                onClick={() =>
                  act("출력 전 검사", async () => setChecks(await preflight(p)))
                }
              >
                출력 전 검사
              </Button>
              <ul className="list-disc pl-5 space-y-2">
                {checks.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {tab === tabs[5] && (
            <>
              <p>
                Higgsfield API{" "}
                {configured
                  ? "키가 저장되어 있어요 · 실제 사용 가능 여부는 생성 시 확인해요"
                  : "키가 필요해요"}
                . 웹 구독과 API 이용 조건은 다를 수 있어요.
              </p>
              <details>
                <summary>API 키 연결·교체</summary>
                <p className="text-sm">
                  open.higgsfield.ai에서 복사한 API 키를 그대로 넣어 주세요.
                  서버 .env.local에만 저장해요.
                </p>
                <Input
                  type="password"
                  aria-label="Higgsfield API 키"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <Button
                  onClick={() =>
                    act("API 키 저장", async () => {
                      await request("/api/higgsfield", { action: "key", key });
                      setKey("");
                      await refresh();
                    })
                  }
                >
                  키 저장
                </Button>
              </details>
              <div className="flex gap-3 flex-wrap">
                <select
                  aria-label="Higgsfield 모델"
                  value={hfModel}
                  onChange={(e) => {
                    setHfModel(e.target.value);
                    setDuration((d) =>
                      Math.min(
                        e.target.value.startsWith("seedance") ? 30 : 15,
                        Math.max(
                          e.target.value.startsWith("seedance") ? 4 : 3,
                          d,
                        ),
                      ),
                    );
                  }}
                >
                  <option value="soul">Soul 2 · 이미지</option>
                  <option value="seedance">Seedance 2.5 · 글에서 영상</option>
                  <option value="seedance-image">
                    Seedance 2.5 · 선택 이미지로 영상
                  </option>
                  <option value="kling">Kling 3 · 글에서 영상</option>
                  <option value="kling-image">
                    Kling 3 · 선택 이미지에서 영상
                  </option>
                </select>
                <select
                  aria-label="Higgsfield 비율"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                >
                  {["16:9", "9:16", "1:1"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                {hfModel !== "soul" && (
                  <label>
                    길이(초)
                    <Input
                      type="number"
                      min={hfModel.startsWith("seedance") ? 4 : 3}
                      max={hfModel.startsWith("seedance") ? 30 : 15}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>
              <textarea
                aria-label="Higgsfield 프롬프트"
                className="w-full min-h-28 border rounded p-2 bg-background"
                value={hfPrompt}
                onChange={(e) => setHfPrompt(e.target.value)}
                placeholder="만들 이미지 또는 영상 장면을 설명해 주세요"
              />
              {hfModel.endsWith("-image") && (
                <section
                  className="border rounded-xl p-3 space-y-3"
                  aria-label="영상에 사용할 이미지"
                >
                  <p className="font-medium">영상에 사용할 이미지</p>
                  <label className="block text-sm">
                    이미지 파일 올리기
                    <input
                      aria-label="영상 참조 이미지 업로드"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void act("영상 이미지 가져오기", async () => {
                          if (
                            !["image/png", "image/jpeg", "image/webp"].includes(
                              file.type,
                            ) ||
                            file.size > 14_000_000
                          )
                            throw new Error(
                              "14MB 이하 PNG·JPEG·WebP 파일을 골라 주세요",
                            );
                          const src = await new Promise<string>(
                            (resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () =>
                                resolve(String(reader.result));
                              reader.onerror = () =>
                                reject(new Error("이미지를 읽지 못했어요"));
                              reader.readAsDataURL(file);
                            },
                          );
                          setVideoReference({ src, name: file.name });
                        });
                      }}
                    />
                  </label>
                  {p.images.length > 0 && (
                    <div>
                      <p className="text-sm mb-2">
                        또는 캔버스 이미지에서 선택
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {p.images.map((im, index) => (
                          <button
                            type="button"
                            key={im.id}
                            aria-label={`캔버스 이미지 ${index + 1} 선택`}
                            aria-pressed={videoReference?.src === im.src}
                            className="shrink-0 rounded border-2 p-1 aria-pressed:border-primary"
                            onClick={() =>
                              setVideoReference({
                                src: im.src,
                                name: `캔버스 이미지 ${index + 1}`,
                              })
                            }
                          >
                            <img
                              src={im.src}
                              alt={`캔버스 이미지 ${index + 1}`}
                              className="w-20 h-16 object-contain"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {videoReference ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={videoReference.src}
                        alt="선택한 영상 참조 이미지"
                        className="w-36 h-24 object-contain rounded border"
                      />
                      <div>
                        <p className="text-sm">{videoReference.name}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVideoReference(null)}
                        >
                          선택 해제
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      위에서 이미지를 고르면 영상 생성 버튼이 활성화돼요.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {hfModel === "seedance-image"
                      ? "선택한 이미지를 영상의 참고 자료로 사용해요."
                      : "선택한 이미지를 시작 장면으로 사용해요."}
                  </p>
                </section>
              )}
              <p className="text-sm text-muted-foreground">
                {hfModel.startsWith("seedance") ? (
                  "Seedance 비용은 공급자 최신 요금을 확인해 주세요. "
                ) : (
                  <>
                    참고 예상 비용: 약 $
                    {(hfModel === "soul"
                      ? 0.0032
                      : duration * (hfModel === "kling" ? 0.042 : 0.063)
                    ).toFixed(4)}{" "}
                    (2026-10-23 공개 요금 기준, 실제 청구액은 공급자
                    대시보드에서 확인).
                  </>
                )}{" "}
                <a
                  href="https://open.higgsfield.ai/pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  공급자 최신 요금 확인
                </a>{" "}
                · 이미지 720p, 영상 소리 끔으로 생성해요.
              </p>
              <Button
                disabled={
                  !configured ||
                  !hfPrompt.trim() ||
                  (hfModel.endsWith("-image") && !videoReference) ||
                  !!busy ||
                  (hfModel !== "soul" &&
                    (!Number.isInteger(duration) ||
                      duration < (hfModel.startsWith("seedance") ? 4 : 3) ||
                      duration > (hfModel.startsWith("seedance") ? 30 : 15)))
                }
                onClick={() =>
                  act("Higgsfield 요청 접수", async () => {
                    let reference: string | undefined;
                    if (hfModel.endsWith("-image") && videoReference) {
                      const response = await fetch(videoReference.src);
                      if (!response.ok)
                        throw new Error(
                          "선택한 이미지를 읽지 못했어요. 다시 골라 주세요.",
                        );
                      const blob = await response.blob();
                      if (
                        !["image/png", "image/jpeg", "image/webp"].includes(
                          blob.type,
                        ) ||
                        blob.size > 14_000_000
                      )
                        throw new Error(
                          "14MB 이하 PNG·JPEG·WebP 이미지를 골라 주세요.",
                        );
                      reference = await new Promise<string>(
                        (resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result));
                          reader.onerror = () =>
                            reject(new Error("이미지 변환 실패"));
                          reader.readAsDataURL(blob);
                        },
                      );
                    }
                    const j = await request("/api/higgsfield", {
                      id: crypto.randomUUID(),
                      model: hfModel,
                      prompt: hfPrompt,
                      ratio,
                      duration,
                      reference,
                    });
                    await refresh();
                    if (j.job.error) setNotice(j.job.error);
                  })
                }
              >
                Higgsfield 생성
              </Button>
              <Button
                variant="outline"
                onClick={() => act("작업 상태 확인", refresh)}
              >
                목록 새로고침
              </Button>
              <div className="space-y-3">
                {jobs.map((j) => (
                  <div key={j.id} className="border rounded-xl p-3">
                    <p>
                      {j.model} ·{" "}
                      {(
                        {
                          queued: "대기 중",
                          in_progress: "생성 중",
                          completed: "완료",
                          failed: "실패",
                          nsfw: "생성 제한",
                          canceled: "취소됨",
                          cancel_requested: "취소 확인 중",
                          unknown: "접수 확인 필요",
                          download_failed: "결과 보관 실패",
                          preparing: "준비 중",
                          submitting: "접수 중",
                        } as Record<string, string>
                      )[j.status] || j.status}{" "}
                      · {new Date(j.createdAt).toLocaleString("ko-KR")}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{j.prompt}</p>
                    {j.error && <p role="alert">{j.error}</p>}
                    {["failed", "canceled"].includes(j.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setHfModel(j.model);
                          setHfPrompt(j.prompt);
                          setNotice(
                            "실패한 작업의 조건을 불러왔어요. 이미지 참조와 길이를 확인한 뒤 생성 버튼을 누르세요.",
                          );
                        }}
                      >
                        실패한 작업 조건 불러오기
                      </Button>
                    )}
                    {![
                      "completed",
                      "failed",
                      "nsfw",
                      "canceled",
                      "unknown",
                    ].includes(j.status) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            act("상태 확인", async () => {
                              await request(`/api/higgsfield?id=${j.id}`);
                              await refresh();
                            })
                          }
                        >
                          상태 확인·결과 재보관
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            act("취소 요청", async () => {
                              await request("/api/higgsfield", {
                                action: "cancel",
                                id: j.id,
                              });
                              await refresh();
                            })
                          }
                        >
                          취소 요청
                        </Button>
                      </>
                    )}
                    {j.files?.map((f, n) => (
                      <div key={f.name}>
                        {f.type.startsWith("video") ? (
                          <video
                            controls
                            src={`/api/higgsfield?id=${j.id}&media=${n}`}
                            className="max-h-56"
                          />
                        ) : (
                          <img
                            src={`/api/higgsfield?id=${j.id}&media=${n}`}
                            alt="Higgsfield 결과"
                            className="max-h-56"
                          />
                        )}
                        <Button
                          size="sm"
                          onClick={() =>
                            act("결과를 캔버스에 넣기", async () => {
                              const r = await fetch(
                                `/api/higgsfield?id=${j.id}&media=${n}`,
                              );
                              if (!r.ok) throw new Error("결과 파일 읽기 실패");
                              const src = await fileData(
                                new File([await r.blob()], f.name, {
                                  type: f.type,
                                }),
                              );
                              const base = {
                                id: crypto.randomUUID(),
                                src,
                                x: 0,
                                y: 0,
                                width: 640,
                                height: 360,
                                rotation: 0,
                                promptHint: j.prompt,
                              };
                              if (f.type.startsWith("video")) {
                                const video = document.createElement("video");
                                video.preload = "metadata";
                                await new Promise<void>((resolve, reject) => {
                                  video.onloadedmetadata = () => resolve();
                                  video.onerror = () =>
                                    reject(
                                      new Error("영상 정보를 읽지 못했어요"),
                                    );
                                  video.src = src;
                                });
                                onApply({
                                  ...p,
                                  videos: [
                                    ...p.videos,
                                    {
                                      ...base,
                                      isVideo: true,
                                      height:
                                        (640 * video.videoHeight) /
                                        video.videoWidth,
                                      duration: video.duration,
                                      currentTime: 0,
                                      isPlaying: false,
                                      volume: 1,
                                      muted: true,
                                    },
                                  ],
                                });
                              } else {
                                const im = new Image();
                                im.src = src;
                                await im.decode();
                                onApply({
                                  ...p,
                                  images: [
                                    ...p.images,
                                    {
                                      ...base,
                                      height: (640 * im.height) / im.width,
                                      isGenerated: true,
                                    },
                                  ],
                                });
                              }
                              setNotice(
                                "결과를 캔버스에 넣었어요. 프로젝트 저장으로 보관해 주세요.",
                              );
                            })
                          }
                        >
                          캔버스에 넣기
                        </Button>
                        <a
                          className="text-sm underline ml-3"
                          href={`/api/higgsfield?id=${j.id}&media=${n}`}
                          download={f.name}
                        >
                          파일 다운로드
                        </a>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
