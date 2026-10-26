import type {
  PlacedImage,
  PlacedText,
  PlacedShape,
  PlacedNote,
  PlacedVideo,
} from "../types/canvas";

export interface BundleContent {
  images: PlacedImage[];
  texts: PlacedText[];
  shapes: PlacedShape[];
  notes: PlacedNote[];
  videos: PlacedVideo[];
}
export interface WorkBundle extends BundleContent {
  id: string;
  name: string;
}

export function copyBundle(
  source: BundleContent,
  x: number,
  y: number,
  topZ: number,
): BundleContent {
  const result = structuredClone(source);
  const all = [
    ...result.images,
    ...result.texts,
    ...result.shapes,
    ...result.notes,
    ...result.videos,
  ];
  if (!all.length) return result;
  const dx = x - Math.min(...all.map((i) => i.x));
  const dy = y - Math.min(...all.map((i) => i.y));
  const ids = new Map(all.map((i) => [i.id, crypto.randomUUID()]));
  const ordered = [
    ...result.images,
    ...result.videos,
    ...result.shapes,
    ...result.texts,
  ].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  ordered.forEach((i, index) => {
    i.z = topZ + index + 1;
    i.locked = false;
  });
  for (const item of all) {
    item.id = ids.get(item.id)!;
    item.x += dx;
    item.y += dy;
  }
  for (const item of [...result.images, ...result.videos]) {
    delete item.parentGroupId;
    if (item.generation)
      item.generation.referenceIds = item.generation.referenceIds.flatMap(
        (id) => (ids.has(id) ? [ids.get(id)!] : []),
      );
  }
  result.notes.forEach((i) => {
    i.targetX += dx;
    i.targetY += dy;
  });
  result.videos.forEach((i) => {
    i.currentTime = 0;
    i.isPlaying = false;
  });
  return result;
}
