"use client";

import { useId } from "react";
import type { PlacedImage } from "@/types/canvas";
import { imageCenter, revisionLinks } from "@/lib/revision-links";

export function RevisionLinks({
  images,
  viewport,
}: {
  images: PlacedImage[];
  viewport: { x: number; y: number; scale: number };
}) {
  const marker = useId().replace(/:/g, "");
  const links = revisionLinks(images);
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-label="수정 이력 연결선"
    >
      <svg className="h-full w-full" aria-hidden="true">
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
          </marker>
        </defs>
        {links.map(({ source, target, prompt }) => {
          const a = imageCenter(source),
            b = imageCenter(target);
          const x1 = a.x * viewport.scale + viewport.x,
            y1 = a.y * viewport.scale + viewport.y;
          const x2 = b.x * viewport.scale + viewport.x,
            y2 = b.y * viewport.scale + viewport.y;
          const label = prompt.replace(/\s+/g, " ").trim();
          const short = label.length > 36 ? label.slice(0, 36) + "…" : label;
          const width = Math.min(420, Math.max(100, short.length * 12 + 24));
          return (
            <g key={`${source.id}:${target.id}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="6 4"
                markerEnd={`url(#${marker})`}
              />
              <g transform={`translate(${(x1 + x2) / 2},${(y1 + y2) / 2})`}>
                <rect
                  x={-width / 2}
                  y={-15}
                  width={width}
                  height={30}
                  rx={6}
                  fill="#0f172a"
                  stroke="#38bdf8"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#f8fafc"
                  fontSize="12"
                >
                  {short}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div
        className="absolute bottom-4 left-4 rounded bg-slate-900/90 px-3 py-2 text-xs text-white"
        role="status"
      >
        {links.length
          ? `수정 이력 ${links.length}개 · 원본 → 결과`
          : "연결된 수정 이력이 없어요. 이미지를 참조하거나 부분 수정하면 표시돼요."}
      </div>
    </div>
  );
}
