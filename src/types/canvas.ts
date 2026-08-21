export interface PlacedImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isGenerated?: boolean;
  parentGroupId?: string;
  promptHint?: string; // 생성 프롬프트 요약 — 다운로드 파일명용
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

// 텍스트 레이어 — AI가 그린 글자와 달리 오타가 없고, 수정이 즉시·무료다
export interface PlacedText {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontFamily: string;
  bold?: boolean;
  rotation: number;
  align?: "left" | "center" | "right";
  stroke?: string; // 테두리(밝은 배경 위 흰 글자 등)
}

// 도형 — 강조 박스·화살표 등 디자인 요소 (결과물에 함께 구워진다)
export type ShapeKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "star"
  | "arrow"
  | "line";

export interface PlacedShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill?: string; // 없으면 속이 빈 도형
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

// 메모 — 검토용 주석. 화면에만 보이고 결과물에는 구워지지 않는다.
export interface PlacedNote {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  color: string; // 포스트잇 색
  done?: boolean; // 처리 완료 표시
}

export interface PlacedVideo extends Omit<PlacedImage, "isGenerated"> {
  isVideo: true;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  isLooping?: boolean; // Whether the video should loop when it reaches the end
  isGenerating?: boolean; // Similar to isGenerated for images
  isLoaded?: boolean; // Whether the video has loaded its metadata
}

export interface HistoryState {
  images: PlacedImage[];
  videos?: PlacedVideo[]; // Optional for backward compatibility
  selectedIds: string[];
}

export interface GenerationSettings {
  prompt: string;
  loraUrl: string;
  styleId?: string;
}

export interface VideoGenerationSettings {
  prompt: string;
  duration?: number;
  styleId?: string;
  motion?: string; // For image-to-video
  sourceUrl?: string; // For image-to-video or video-to-video
  modelId?: string; // Model identifier from video-models.ts
  resolution?: "480p" | "720p" | "1080p"; // Video resolution
  cameraFixed?: boolean; // Whether to fix the camera position
  seed?: number; // Random seed to control video generation
  isVideoToVideo?: boolean; // Indicates if this is a video-to-video transformation
  isVideoExtension?: boolean; // Indicates if this is a video extension (using last frame)
  [key: string]: any; // Allow additional model-specific fields
}

export interface ActiveGeneration {
  imageUrl: string;
  prompt: string;
  loraUrl?: string;
}

export interface ActiveVideoGeneration {
  videoUrl?: string;
  imageUrl?: string; // For image-to-video
  prompt: string;
  duration?: number;
  motion?: string;
  styleId?: string;
  modelId?: string; // Model identifier from video-models.ts
  modelConfig?: any; // Model configuration from video-models.ts
  resolution?: "480p" | "720p" | "1080p"; // Video resolution
  cameraFixed?: boolean; // Whether to fix the camera position
  seed?: number; // Random seed to control video generation
  sourceImageId?: string; // ID of the image used for img2vid
  sourceVideoId?: string; // ID of the video used for vid2vid
  isVideoToVideo?: boolean; // Indicates if this is a video-to-video transformation
  isVideoExtension?: boolean; // Indicates if this is a video extension
  toastId?: string; // ID of the toast notification
  [key: string]: any; // Allow additional model-specific fields
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  visible: boolean;
}
