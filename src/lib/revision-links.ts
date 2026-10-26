import type { PlacedImage } from "../types/canvas";

// Deleted, hidden, and old images without provenance do not produce invented links.
export function revisionLinks(images: PlacedImage[]) {
  const visible = new Map(
    images.filter((image) => !image.hidden).map((image) => [image.id, image]),
  );
  return images
    .filter((image) => !image.hidden)
    .flatMap((target) =>
      [...new Set(target.generation?.referenceIds || [])].flatMap((id) => {
        const source = visible.get(id);
        return source && source.id !== target.id
          ? [
              {
                source,
                target,
                prompt: target.generation?.prompt || "참조 이미지로 생성",
              },
            ]
          : [];
      }),
    );
}

export function imageCenter(image: PlacedImage) {
  const angle = ((image.rotation || 0) * Math.PI) / 180;
  return {
    x:
      image.x +
      (image.width * Math.cos(angle) - image.height * Math.sin(angle)) / 2,
    y:
      image.y +
      (image.width * Math.sin(angle) + image.height * Math.cos(angle)) / 2,
  };
}
