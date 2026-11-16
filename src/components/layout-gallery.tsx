"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import catalog from "@/lib/composition-catalog.json";
import { POSTER_LAYOUTS, SOURCE_POSTER_LAYOUTS } from "@/lib/poster-layouts";

export function LayoutGallery({
  mode,
  onSelect,
  disabled = false,
}: {
  mode: "generate" | "source";
  onSelect: (id: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("전체"),
    [onlyUsable, setOnlyUsable] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<number | null>(null);
  const usable = mode === "source" ? SOURCE_POSTER_LAYOUTS : POSTER_LAYOUTS;
  const matches = catalog.filter(
    (c) =>
      (category === "전체" || category === c.category) &&
      (!onlyUsable || usable.some((l) => l.id === c.id)) &&
      `${c.id} ${c.name_ko} ${c.name_en} ${c.desc}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const item = catalog.find((c) => c.id === selected),
    canApply = usable.some((l) => l.id === selected);
  return (
    <>
      <button
        type="button"
        className="my-2 w-full rounded border px-3 py-2 text-sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        전체 구도 썸네일 보기 · {catalog.length}종
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden"
          aria-describedby="layout-gallery-description"
        >
          <DialogTitle>구도 도감</DialogTitle>
          <DialogDescription id="layout-gallery-description">
            전체 {catalog.length}종을 살펴보세요.{" "}
            {mode === "source" ? "원본 보존 자동 배치" : "이미지 생성 구도"}는{" "}
            {usable.length}종을 적용할 수 있습니다.
          </DialogDescription>
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="구도 검색"
              placeholder="이름·설명·번호 검색"
              className="min-w-0 flex-1 rounded border bg-background p-2"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <select
              aria-label="구도 분류"
              className="rounded border bg-background p-2"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              {["전체", ...new Set(catalog.map((c) => c.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyUsable}
                onChange={(e) => {
                  setOnlyUsable(e.target.checked);
                  setPage(0);
                }}
              />
              지금 적용 가능한 구도만
            </label>
          </div>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-[1fr_300px]">
            <div>
              <div
                className="grid grid-cols-2 gap-3 lg:grid-cols-3"
                data-testid="layout-gallery-grid"
              >
                {matches.slice(page * 24, page * 24 + 24).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected === c.id}
                    onClick={() => setSelected(c.id)}
                    className={`rounded-lg border-2 p-2 text-left ${selected === c.id ? "border-primary" : "border-transparent bg-muted"}`}
                  >
                    <img
                      loading="lazy"
                      src={`/layout-catalog/${c.id}.jpg`}
                      alt={`${c.id} ${c.name_ko}`}
                      className="aspect-[4/3] w-full rounded object-contain bg-white"
                    />
                    <strong className="mt-2 block text-sm">
                      {c.id}. {c.name_ko}
                    </strong>
                    <small>
                      {usable.some((l) => l.id === c.id)
                        ? "적용 가능"
                        : c.category + " · 참고용"}
                    </small>
                  </button>
                ))}
              </div>
              {!matches.length && (
                <p className="p-6">
                  검색 결과가 없어요. 다른 이름으로 검색하세요.
                </p>
              )}
            </div>
            <aside className="rounded bg-muted p-4">
              {item ? (
                <>
                  <img
                    src={`/layout-catalog/${item.id}.jpg`}
                    alt={`${item.name_ko} 상세`}
                    className="w-full bg-white object-contain"
                  />
                  <h3 className="my-3 font-semibold">{item.name_ko}</h3>
                  <p className="text-sm">{item.desc}</p>
                  <p className="my-3 text-xs">
                    {item.category} / {item.subcategory}
                  </p>
                  {canApply ? (
                    <button
                      type="button"
                      className="w-full rounded bg-primary p-3 text-primary-foreground"
                      disabled={disabled}
                      onClick={() => {
                        onSelect(item.id);
                        setOpen(false);
                      }}
                    >
                      이 구도 적용
                    </button>
                  ) : (
                    <p className="text-sm">
                      원리를 참고하는 항목입니다. 현재 모드의 자동 배치에는
                      연결하지 않았습니다.
                    </p>
                  )}
                  <a
                    href={`https://github.com/worlyung/korean-layout-compositions/blob/main/${encodeURI(item.image)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block text-xs underline"
                  >
                    원본 카드 크게 보기 ↗
                  </a>
                </>
              ) : (
                <p>카드를 누르면 설명과 적용 여부를 확인할 수 있습니다.</p>
              )}
            </aside>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              이전
            </button>
            <span>
              {matches.length}종 · {page + 1} /{" "}
              {Math.max(1, Math.ceil(matches.length / 24))}
            </span>
            <button
              disabled={(page + 1) * 24 >= matches.length}
              onClick={() => setPage(page + 1)}
            >
              다음
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            <a
              href="https://github.com/worlyung/korean-layout-compositions"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              정재훈 · 한국형 레이아웃 구성 도감
            </a>{" "}
            ·{" "}
            <a
              href="/layout-catalog/LICENSE.txt"
              target="_blank"
              className="underline"
            >
              CC BY 4.0
            </a>{" "}
            · 원문·썸네일 보존, 자동 배치 별도 구현
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
