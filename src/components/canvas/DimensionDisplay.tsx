import React from "react";
import type { PlacedImage } from "@/types/canvas";
import {
  canvasToScreen,
  calculateBoundingBox,
  type Viewport,
} from "@/utils/canvas-utils";

interface DimensionDisplayProps {
  selectedImages: PlacedImage[];
  viewport: Viewport;
}

/**
 * Calculate the natural (API) dimensions that get sent to generation endpoints.
 * We show these instead of display dimensions because:
 * - They represent the actual pixel data AI models process
 * - They account for crops (cropWidth × naturalWidth)
 * - They're consistent regardless of canvas zoom/scaling
 * - Users need to know the true resolution for generation quality
 */
const getApiDimensions = async (img: PlacedImage) => {
  try {
    // Load the image to get natural dimensions
    const imgElement = new window.Image();
    imgElement.crossOrigin = "anonymous";
    imgElement.src = img.src;

    await new Promise((resolve, reject) => {
      imgElement.onload = resolve;
      imgElement.onerror = reject;
    });

    // Calculate effective dimensions accounting for crops (same logic as generation handler)
    const cropWidth = img.cropWidth || 1;
    const cropHeight = img.cropHeight || 1;

    return {
      width: Math.round(cropWidth * imgElement.naturalWidth),
      height: Math.round(cropHeight * imgElement.naturalHeight),
      isCropped: cropWidth !== 1 || cropHeight !== 1,
    };
  } catch {
    // Fallback to display dimensions if image loading fails
    return {
      width: Math.round(img.width),
      height: Math.round(img.height),
      isCropped: false,
    };
  }
};

export const DimensionDisplay: React.FC<DimensionDisplayProps> = ({
  selectedImages,
  viewport,
}) => {
  // 훅은 조건 없이 항상 같은 개수로 호출해야 한다.
  // 예전엔 여기서 selectedImages.length !== 1이면 먼저 return null 하고
  // 그 아래에서 useState/useEffect를 불러서, 선택 개수가 바뀔 때마다 훅 개수가 달라졌다
  // → "Expected static flag was missing" React 내부 오류. 그래서 훅을 위로 올렸다.
  const image = selectedImages.length === 1 ? selectedImages[0] : null;

  const [apiDimensions, setApiDimensions] = React.useState<{
    width: number;
    height: number;
    isCropped: boolean;
  } | null>(null);

  const src = image?.src;
  const cropW = image?.cropWidth;
  const cropH = image?.cropHeight;

  React.useEffect(() => {
    if (!image) {
      setApiDimensions(null);
      return;
    }
    let alive = true;
    getApiDimensions(image).then((d) => {
      if (alive) setApiDimensions(d);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cropW, cropH]);

  // Only show for single image selection to avoid clutter
  if (!image || !apiDimensions) return null;

  // Get rotation-aware bottom center position using bounding box
  const boundingBox = calculateBoundingBox(image);
  const { x: screenX, y: screenY } = canvasToScreen(
    boundingBox.x + boundingBox.width / 2,
    boundingBox.y + boundingBox.height,
    viewport,
  );

  return (
    <div
      className="fixed pointer-events-none z-10 bg-background/90 backdrop-blur-sm border rounded-xl px-2 py-1 text-xs text-foreground/80 shadow-sm hidden md:block"
      style={{
        left: screenX,
        top: screenY + 8, // 8px below the image
        transform: "translateX(-50%)", // Center horizontally under the image
      }}
    >
      <div className="flex flex-col gap-0.5">
        <div className="font-medium">
          {apiDimensions.width} × {apiDimensions.height} px
        </div>
      </div>
    </div>
  );
};
