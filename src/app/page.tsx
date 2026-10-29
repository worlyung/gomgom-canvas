"use client";

import React from "react";
import { useState, useCallback, useMemo } from "react";
import { Stage, Layer, Rect, Group, Line } from "react-konva";
import Konva from "konva";
import { canvasStorage, type CanvasState } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  X,
  ChevronDown,
  Check,
  Plus,
  ImageIcon,
  Trash2,
  Undo,
  Redo,
  SlidersHorizontal,
  PlayIcon,
  Paperclip,
  MonitorIcon,
  SunIcon,
  MoonIcon,
  ExternalLink,
  History,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo, SpinnerIcon } from "@/components/icons";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  Tooltip,
} from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { styleModels } from "@/lib/models";
import { useToast } from "@/hooks/use-toast";
import { createFalClient } from "@fal-ai/client";

// Import extracted components
import { ShortcutBadge } from "@/components/canvas/ShortcutBadge";
import { StreamingImage } from "@/components/canvas/StreamingImage";
import { StreamingVideo } from "@/components/canvas/StreamingVideo";
import { CropOverlayWrapper } from "@/components/canvas/CropOverlayWrapper";
import { CanvasImage } from "@/components/canvas/CanvasImage";
import { CanvasText } from "@/components/canvas/CanvasText";
import { TextToolbar, FONT_CHOICES } from "@/components/text-toolbar";
import { CanvasShape } from "@/components/canvas/CanvasShape";
import { CanvasNote, NOTE_WIDTH_NARROW } from "@/components/canvas/CanvasNote";
import { ShapeToolbar } from "@/components/shape-note-toolbar";
import { NoteInlineEditor } from "@/components/note-inline-editor";
import { ToolPalette } from "@/components/tool-palette";
import { BoardPanel, type BoardMeta } from "@/components/board-panel";
import { loadBoard, saveBoard } from "@/lib/board-sync";
import { StudioWorkbench } from "@/components/studio-workbench";
import {
  emptyExtras,
  saveStudioExtras,
  loadStudioExtras,
  type StudioExtras,
  type StudioProject,
} from "@/lib/studio-project";
import { LayerPanel } from "@/components/layer-panel";
import { ArtboardDialog } from "@/components/artboard-dialog";
import { CardnewsStudio } from "@/components/cardnews-studio";
import { MapStudio } from "@/components/map-studio";
import { cardLayers, CARD_W, CARD_H, type CardDeck } from "@/lib/cardnews";
import {
  makeArtboard,
  fitArtboard as fitFullArtboard,
  artboardFileName,
} from "@/lib/artboard";
import { ensureLocalFont, familyFromValue } from "@/lib/local-fonts";
import {
  orderLayers,
  moveSelected,
  moveToIndex,
  zMap,
  type LayerEntry,
} from "@/lib/layer-order";
import {
  runCampaign,
  type CampaignPlan,
} from "@/lib/handlers/campaign-handler";
import {
  normalizeSize,
  promptImageSize,
  sizeForAspect,
} from "@/lib/image-sizes";
import {
  checkExportSize,
  pngWithDpi,
  renderSelectedImage,
  loadOutputImage,
} from "@/lib/canvas-output";
import { ProviderSettings, useProviders } from "@/components/provider-settings";
import {
  getProvider,
  GEMINI_MODELS,
  OPENAI_MODELS,
  type ProviderId,
} from "@/lib/providers";
import { CanvasVideo } from "@/components/canvas/CanvasVideo";
import { VideoControls } from "@/components/canvas/VideoControls";
import { ImageToVideoDialog } from "@/components/canvas/ImageToVideoDialog";
import { VideoToVideoDialog } from "@/components/canvas/VideoToVideoDialog";
import { ExtendVideoDialog } from "@/components/canvas/ExtendVideoDialog";
import { RemoveVideoBackgroundDialog } from "@/components/canvas/VideoModelComponents";
import { getVideoModelById } from "@/lib/video-models";

// Import types
import type {
  PlacedImage,
  PlacedVideo,
  HistoryState,
  GenerationSettings,
  VideoGenerationSettings,
  ActiveGeneration,
  ActiveVideoGeneration,
  SelectionBox,
  PlacedText,
  PlacedShape,
  PlacedNote,
  Artboard,
} from "@/types/canvas";

import {
  imageToCanvasElement,
  videoToCanvasElement,
  textToCanvasElement,
  shapeToCanvasElement,
  noteToCanvasElement,
} from "@/utils/canvas-utils";
import { checkOS } from "@/utils/os-utils";
import { convertImageToVideo } from "@/utils/video-utils";

// Import additional extracted components
import { useFalClient } from "@/hooks/useFalClient";
import { CanvasGrid } from "@/components/canvas/CanvasGrid";
import { SelectionBoxComponent } from "@/components/canvas/SelectionBox";
import { MiniMap } from "@/components/canvas/MiniMap";
import { ZoomControls } from "@/components/canvas/ZoomControls";
import { MobileToolbar } from "@/components/canvas/MobileToolbar";
import { PoweredByFalBadge } from "@/components/canvas/PoweredByFalBadge";
import { CanvasContextMenu } from "@/components/canvas/CanvasContextMenu";
import { useTheme } from "next-themes";
import { VideoOverlays } from "@/components/canvas/VideoOverlays";
import { DimensionDisplay } from "@/components/canvas/DimensionDisplay";
import Image from "next/image";

// Import handlers
import {
  handleRun as handleRunHandler,
  uploadImageDirect,
  generateImage,
} from "@/lib/handlers/generation-handler";
import { handleRemoveBackground as handleRemoveBackgroundHandler } from "@/lib/handlers/background-handler";
import {
  runOpenAIGeneration,
  runMaskEdit,
  runExpand,
  runCardnews,
  runRemoveBackground,
  runCutout,
  placeholderSrc as generationPlaceholderSrc,
  type HistoryEntry,
} from "@/lib/handlers/openai-handler";
import { MaskEditor } from "@/components/mask-editor";
import {
  isFollowupRequest,
  recentCanvasBrief,
  requestedImageCount,
  stableBriefFromPrompt,
} from "@/lib/compare-prompts";
import { HistoryPanel } from "@/components/history-panel";
import { RevisionLinks } from "@/components/canvas/RevisionLinks";
import { CompanyAssets } from "@/components/canvas/CompanyAssets";
import { WorkBundles } from "@/components/canvas/WorkBundles";
import { copyBundle } from "@/lib/work-bundles";
import { GeneratingIndicator } from "@/components/generating-indicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadImagesAsZip } from "@/lib/zip-download";
import { UsageBadge } from "@/components/usage-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GithubBadge } from "@/components/canvas/GithubBadge";
import { GenerationsIndicator } from "@/components/generations-indicator";

function fitArtboard(board: Artboard, width: number, height: number) {
  const left = width >= 768 ? 348 : 0;
  const right = width >= 1100 ? 280 : 0;
  const top = 160;
  const bottom = width >= 768 ? 60 : height * 0.48;
  const frame = fitFullArtboard(
    board,
    Math.max(160, width - left - right),
    Math.max(160, height - top - bottom),
  );
  return { ...frame, x: frame.x + left, y: frame.y + top };
}

export default function OverlayPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [images, setImages] = useState<PlacedImage[]>([]);
  const [texts, setTexts] = useState<PlacedText[]>([]);
  const [shapes, setShapes] = useState<PlacedShape[]>([]);
  const [notes, setNotes] = useState<PlacedNote[]>([]);
  const [videos, setVideos] = useState<PlacedVideo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [visibleIndicators, setVisibleIndicators] = useState<Set<string>>(
    new Set(),
  );
  const { toast } = useToast();

  // 기본값 = 스타일 없음·빈 프롬프트 (원본의 심슨 기본값 제거)
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettings>({
      prompt: "",
      loraUrl: "",
      styleId: "custom",
    });
  const [previousStyleId, setPreviousStyleId] = useState<string>("custom");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageQuality, setImageQuality] = useState("high");
  const [transparentBg, setTransparentBg] = useState(false);
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const {
    list: providerList,
    editLocked,
    reload: reloadProviders,
  } = useProviders();
  const provider = getProvider(providerId);
  const [geminiModel, setGeminiModel] = useState(GEMINI_MODELS[0].value);
  // OpenAI 생성 모델 — 마지막 선택을 기억한다 (편집 기능은 서버가 2.0으로 고정)
  const [openaiModel, setOpenaiModel] = useState(() => {
    try {
      const v = localStorage.getItem("gomgom-openai-model");
      if (v && OPENAI_MODELS.some((m) => m.value === v)) return v;
    } catch {}
    return OPENAI_MODELS[0].value;
  });
  useEffect(() => {
    try {
      localStorage.setItem("gomgom-openai-model", openaiModel);
    } catch {}
  }, [openaiModel]);
  const [progressNote, setProgressNote] = useState("");
  const [isBaking, setIsBaking] = useState(false); // 굽는 순간엔 메모를 숨긴다
  const [customSizeOpen, setCustomSizeOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [studioExtras, setStudioExtras] = useState<StudioExtras>(emptyExtras);
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  useEffect(() => {
    loadStudioExtras()
      .then((data) => {
        if (data) {
          setStudioExtras(data);
          setGenerationSettings((s) => ({
            ...s,
            prompt: data.settings.prompt,
          }));
          setImageSize(data.settings.size);
          setImageQuality(data.settings.quality);
          if (["openai", "gemini", "grok"].includes(data.settings.provider))
            setProviderId(data.settings.provider as ProviderId);
          if (data.settings.provider === "gemini")
            setGeminiModel(data.settings.model);
          else if (data.settings.model) setOpenaiModel(data.settings.model);
        }
      })
      .catch(() =>
        toast({ title: "행사 자료 복구 실패", variant: "destructive" }),
      )
      .finally(() => setExtrasLoaded(true));
  }, []);
  useEffect(() => {
    if (extrasLoaded)
      saveStudioExtras({
        ...studioExtras,
        settings: {
          prompt: generationSettings.prompt,
          provider: providerId,
          model: providerId === "gemini" ? geminiModel : openaiModel,
          size: imageSize,
          quality: imageQuality,
        },
      }).catch(() =>
        toast({
          title: "행사 자료 자동 저장 실패",
          description: "프로젝트 파일로 내보내 주세요",
          variant: "destructive",
        }),
      );
  }, [
    studioExtras,
    extrasLoaded,
    generationSettings.prompt,
    providerId,
    geminiModel,
    openaiModel,
    imageSize,
    imageQuality,
  ]);
  const [cardnewsStudioOpen, setCardnewsStudioOpen] = useState(false);
  const [mapStudioOpen, setMapStudioOpen] = useState(false);
  const [cardnewsMounted, setCardnewsMounted] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState("");
  const [boardUpdatedAt, setBoardUpdatedAt] = useState<string | undefined>();
  const [myName, setMyName] = useState("");
  const [boardBusy, setBoardBusy] = useState("");
  const [boardRefresh, setBoardRefresh] = useState(0);
  const [campaignRequest, setCampaignRequest] = useState("");
  const [campaignPlan, setCampaignPlan] = useState<CampaignPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [promptBeforeEnhance, setPromptBeforeEnhance] = useState<string | null>(
    null,
  );
  const [customW, setCustomW] = useState("1600");
  const [customH, setCustomH] = useState("2400");
  const [maskEdit, setMaskEdit] = useState<{
    id: string;
    mode: "brush" | "point" | "text";
    rect: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisionLinksVisible, setRevisionLinksVisible] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false); // 레이어 패널 (P1)
  const [artboard, setArtboard] = useState<Artboard | null>(null); // 포스터 판 (P2)
  const [artboardOpen, setArtboardOpen] = useState(false);
  const [exporting, setExporting] = useState(""); // 내보내는 중 문구
  const [cardnewsOpen, setCardnewsOpen] = useState(false);
  const [cardnewsText, setCardnewsText] = useState("");
  const [expandKey, setExpandKey] = useState(0);
  const [activeGenerations, setActiveGenerations] = useState<
    Map<string, ActiveGeneration>
  >(new Map());
  const [activeVideoGenerations, setActiveVideoGenerations] = useState<
    Map<string, ActiveVideoGeneration>
  >(new Map());
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    visible: false,
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragStartPositions, setDragStartPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  // 메모를 끄는 동안은 위에 얹은 편집기를 숨긴다 (좌표가 놓은 뒤에 갱신되므로)
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [hiddenVideoControlsIds, setHiddenVideoControlsIds] = useState<
    Set<string>
  >(new Set());
  // Use a consistent initial value for server and client to avoid hydration errors
  const [canvasSize, setCanvasSize] = useState({
    width: 1200,
    height: 800,
  });
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const [croppingImageId, setCroppingImageId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });
  const stageRef = useRef<Konva.Stage>(null);
  const [isolateTarget, setIsolateTarget] = useState<string | null>(null);
  const [isolateInputValue, setIsolateInputValue] = useState("");
  const [isIsolating, setIsIsolating] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const [variantCount, setVariantCount] = useState(1);
  const [exactCopy, setExactCopy] = useState("");
  const [referenceKeep, setReferenceKeep] = useState("");
  const [inheritReferencePrompt, setInheritReferencePrompt] = useState(true);
  const [referenceMode, setReferenceMode] = useState<"style" | "content">(
    "style",
  );
  const [generationError, setGenerationError] = useState("");
  const [usageOpen, setUsageOpen] = useState(false);
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [isImageToVideoDialogOpen, setIsImageToVideoDialogOpen] =
    useState(false);
  const [selectedImageForVideo, setSelectedImageForVideo] = useState<
    string | null
  >(null);
  const [isConvertingToVideo, setIsConvertingToVideo] = useState(false);
  const [isVideoToVideoDialogOpen, setIsVideoToVideoDialogOpen] =
    useState(false);
  const [selectedVideoForVideo, setSelectedVideoForVideo] = useState<
    string | null
  >(null);
  const [isTransformingVideo, setIsTransformingVideo] = useState(false);
  const [isExtendVideoDialogOpen, setIsExtendVideoDialogOpen] = useState(false);
  const [selectedVideoForExtend, setSelectedVideoForExtend] = useState<
    string | null
  >(null);
  const [isExtendingVideo, setIsExtendingVideo] = useState(false);
  const [
    isRemoveVideoBackgroundDialogOpen,
    setIsRemoveVideoBackgroundDialogOpen,
  ] = useState(false);
  const [
    selectedVideoForBackgroundRemoval,
    setSelectedVideoForBackgroundRemoval,
  ] = useState<string | null>(null);
  const [isRemovingVideoBackground, setIsRemovingVideoBackground] =
    useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [tempApiKey, setTempApiKey] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveRevision = useRef(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Touch event states for mobile
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(
    null,
  );
  const [lastTouchCenter, setLastTouchCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isTouchingImage, setIsTouchingImage] = useState(false);

  // Track when generation completes
  const [previousGenerationCount, setPreviousGenerationCount] = useState(0);

  useEffect(() => {
    const currentCount =
      activeGenerations.size +
      activeVideoGenerations.size +
      (isGenerating ? 1 : 0) +
      (isRemovingVideoBackground ? 1 : 0) +
      (isIsolating ? 1 : 0) +
      (isExtendingVideo ? 1 : 0) +
      (isTransformingVideo ? 1 : 0);

    // If we went from having generations to having none, show success
    if (previousGenerationCount > 0 && currentCount === 0) {
      setShowSuccess(true);
      // Hide success after 2 seconds
      const timeout = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }

    setPreviousGenerationCount(currentCount);
  }, [
    activeGenerations.size,
    activeVideoGenerations.size,
    isGenerating,
    isRemovingVideoBackground,
    isIsolating,
    isExtendingVideo,
    isTransformingVideo,
    previousGenerationCount,
  ]);

  // Create FAL client instance with proxy
  const falClient = useFalClient(customApiKey);

  const trpc = useTRPC();

  // Direct FAL upload function using proxy

  const { mutateAsync: removeBackground } = useMutation(
    trpc.removeBackground.mutationOptions(),
  );

  // Function to handle the "Convert to Video" option in the context menu
  const handleConvertToVideo = (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    setSelectedImageForVideo(imageId);
    setIsImageToVideoDialogOpen(true);
  };

  // Function to handle the image-to-video conversion
  const handleImageToVideoConversion = async (
    settings: VideoGenerationSettings,
  ) => {
    if (!selectedImageForVideo) return;

    const image = images.find((img) => img.id === selectedImageForVideo);
    if (!image) return;

    try {
      setIsConvertingToVideo(true);

      // Upload image if it's a data URL
      let imageUrl = image.src;
      if (imageUrl.startsWith("data:")) {
        const uploadResult = await falClient.storage.upload(
          await (await fetch(imageUrl)).blob(),
        );
        imageUrl = uploadResult;
      }

      // Create a unique ID for this generation
      const generationId = `img2vid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          imageUrl,
          prompt: settings.prompt || "",
          duration: settings.duration || 5,
          modelId: settings.modelId, // Add video modelId
          resolution: settings.resolution || "720p",
          cameraFixed: settings.cameraFixed,
          seed: settings.seed,
          sourceImageId: selectedImageForVideo, // Store the source image ID
        });
        return newMap;
      });

      // Clear the converting flag since it's now tracked in activeVideoGenerations
      setIsConvertingToVideo(false);

      // Close the dialog
      setIsImageToVideoDialogOpen(false);

      // Get video model name for toast display
      let modelName = "Video Model";
      const modelId = settings.modelId || "ltx-video"; // Default to ltx-video
      const { getVideoModelById } = await import("@/lib/video-models");
      const model = getVideoModelById(modelId);
      if (model) {
        modelName = model.name;
      }

      // Store the toast ID with the generation for later reference
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, generation);
        }
        return newMap;
      });
    } catch (error) {
      console.error("Error starting image-to-video conversion:", error);
      toast({
        title: "Conversion failed",
        description:
          error instanceof Error ? error.message : "Failed to start conversion",
        variant: "destructive",
      });
      setIsConvertingToVideo(false);
    }
  };

  // Function to handle the "Video to Video" option in the context menu
  const handleVideoToVideo = (videoId: string) => {
    const video = videos.find((vid) => vid.id === videoId);
    if (!video) return;

    setSelectedVideoForVideo(videoId);
    setIsVideoToVideoDialogOpen(true);
  };

  // Function to handle the video-to-video transformation
  const handleVideoToVideoTransformation = async (
    settings: VideoGenerationSettings,
  ) => {
    if (!selectedVideoForVideo) return;

    const video = videos.find((vid) => vid.id === selectedVideoForVideo);
    if (!video) return;

    try {
      setIsTransformingVideo(true);

      // Upload video if it's a data URL or local file
      let videoUrl = video.src;
      if (videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
        const uploadResult = await falClient.storage.upload(
          await (await fetch(videoUrl)).blob(),
        );
        videoUrl = uploadResult;
      }

      // Create a unique ID for this generation
      const generationId = `vid2vid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          ...settings, // Include all settings first
          imageUrl: videoUrl, // Using imageUrl field for video URL
          duration: video.duration || settings.duration || 5,
          modelId: settings.modelId || "seedance-pro",
          resolution: settings.resolution || "720p",
          isVideoToVideo: true,
          sourceVideoId: selectedVideoForVideo,
        });
        return newMap;
      });

      // Close the dialog
      setIsVideoToVideoDialogOpen(false);

      // Get video model name for toast display
      let modelName = "Video Model";
      const modelId = settings.modelId || "seedance-pro";
      const { getVideoModelById } = await import("@/lib/video-models");
      const model = getVideoModelById(modelId);
      if (model) {
        modelName = model.name;
      }

      // Create a persistent toast
      const toastId = toast({
        title: `Transforming video (${modelName} - ${settings.resolution || "Default"})`,
        description: "This may take a minute...",
        duration: Infinity,
      }).id;

      // Store the toast ID with the generation
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            toastId,
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error("Error starting video-to-video transformation:", error);
      toast({
        title: "Transformation failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start transformation",
        variant: "destructive",
      });
      setIsTransformingVideo(false);
    }
  };

  // Function to handle the "Extend Video" option in the context menu
  const handleExtendVideo = (videoId: string) => {
    const video = videos.find((vid) => vid.id === videoId);
    if (!video) return;

    setSelectedVideoForExtend(videoId);
    setIsExtendVideoDialogOpen(true);
  };

  // Function to handle the video extension
  const handleVideoExtension = async (settings: VideoGenerationSettings) => {
    if (!selectedVideoForExtend) return;

    const video = videos.find((vid) => vid.id === selectedVideoForExtend);
    if (!video) return;

    try {
      setIsExtendingVideo(true);

      // Upload video if it's a data URL or local file
      let videoUrl = video.src;
      if (videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
        const uploadResult = await falClient.storage.upload(
          await (await fetch(videoUrl)).blob(),
        );
        videoUrl = uploadResult;
      }

      // Create a unique ID for this generation
      const generationId = `vid_ext_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          ...settings, // Include all settings first
          imageUrl: videoUrl, // Using imageUrl field for video URL
          duration: video.duration || settings.duration || 5,
          modelId: settings.modelId || "seedance-pro",
          resolution: settings.resolution || "720p",
          isVideoToVideo: true,
          isVideoExtension: true,
          sourceVideoId: selectedVideoForExtend,
        });
        return newMap;
      });

      // Close the dialog
      setIsExtendVideoDialogOpen(false);

      // Get video model name for toast display
      let modelName = "Video Model";
      const modelId = settings.modelId || "seedance-pro";
      const { getVideoModelById } = await import("@/lib/video-models");
      const model = getVideoModelById(modelId);
      if (model) {
        modelName = model.name;
      }

      // Create a persistent toast
      const toastId = toast({
        title: `Extending video (${modelName} - ${settings.resolution || "Default"})`,
        description: "This may take a minute...",
        duration: Infinity,
      }).id;

      // Store the toast ID with the generation
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            toastId,
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error("Error starting video extension:", error);
      toast({
        title: "Extension failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start video extension",
        variant: "destructive",
      });
      setIsExtendingVideo(false);
    }
  };

  // Function to handle video generation completion
  const handleVideoGenerationComplete = async (
    videoId: string,
    videoUrl: string,
    duration: number,
  ) => {
    try {
      console.log("Video generation complete:", {
        videoId,
        videoUrl,
        duration,
      });

      // Get the generation data to check for source image ID
      const generation = activeVideoGenerations.get(videoId);
      const sourceImageId = generation?.sourceImageId || selectedImageForVideo;
      const isBackgroundRemoval =
        generation?.modelId === "bria-video-background-removal";

      // Dismiss progress toast if it exists
      if (generation?.toastId) {
        const toastElement = document.querySelector(
          `[data-toast-id="${generation.toastId}"]`,
        );
        if (toastElement) {
          // Trigger dismiss by clicking the close button
          const closeButton = toastElement.querySelector(
            "[data-radix-toast-close]",
          );
          if (closeButton instanceof HTMLElement) {
            closeButton.click();
          }
        }
      }

      // Find the original image if this was an image-to-video conversion
      if (sourceImageId) {
        const image = images.find((img) => img.id === sourceImageId);
        if (image) {
          // Create a video element based on the original image
          const video = convertImageToVideo(
            image,
            videoUrl,
            duration,
            false, // Don't replace the original image
          );

          // Position the video to the right of the source image
          // Add a small gap between the image and video (20px)
          video.x = image.x + image.width + 20;
          video.y = image.y; // Keep the same vertical position

          // Add the video to the videos state
          setVideos((prev) => [...prev, { ...video, isVideo: true as const }]);

          // Save to history
          saveToHistory();

          // Show success toast
          toast({
            title: "Video created successfully",
            description:
              "The video has been added to the right of the source image.",
          });
        } else {
          console.error("Source image not found:", sourceImageId);
          toast({
            title: "Error creating video",
            description: "The source image could not be found.",
            variant: "destructive",
          });
        }
      } else if (generation?.sourceVideoId || generation?.isVideoToVideo) {
        // This was a video-to-video transformation or extension
        const sourceVideoId =
          generation?.sourceVideoId ||
          selectedVideoForVideo ||
          selectedVideoForExtend;
        const isExtension = generation?.isVideoExtension;

        if (sourceVideoId) {
          const sourceVideo = videos.find((vid) => vid.id === sourceVideoId);
          if (sourceVideo) {
            // Create a new video based on the source video
            const newVideo: PlacedVideo = {
              id: `video_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              src: videoUrl,
              x: sourceVideo.x + sourceVideo.width + 20, // Position to the right
              y: sourceVideo.y,
              width: sourceVideo.width,
              height: sourceVideo.height,
              rotation: 0,
              isPlaying: false,
              currentTime: 0,
              duration: duration,
              volume: 1,
              muted: false,
              isLooping: false,
              isVideo: true as const,
            };

            // Add the transformed video to the canvas
            setVideos((prev) => [...prev, newVideo]);

            // Save to history
            saveToHistory();

            if (isExtension) {
              toast({
                title: "Video extended successfully",
                description:
                  "The extended video has been added to the right of the source video.",
              });
            } else if (
              generation?.modelId === "bria-video-background-removal"
            ) {
              toast({
                title: "Background removed successfully",
                description:
                  "The video with removed background has been added to the right of the source video.",
              });
            } else {
              toast({
                title: "Video transformed successfully",
                description:
                  "The transformed video has been added to the right of the source video.",
              });
            }
          } else {
            console.error("Source video not found:", sourceVideoId);
            toast({
              title: "Error creating video",
              description: "The source video could not be found.",
              variant: "destructive",
            });
          }
        }

        // Reset the transformation/extension state
        setIsTransformingVideo(false);
        setSelectedVideoForVideo(null);
        setIsExtendingVideo(false);
        setSelectedVideoForExtend(null);
      } else {
        // This was a text-to-video generation
        // For now, just log it as the placement function is missing
        console.log("Generated video URL:", videoUrl);
        toast({
          title: "Video generated",
          description: "Video is ready but cannot be placed on canvas yet.",
        });
      }

      // Remove from active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });

      // Reset appropriate flags based on generation type
      if (isBackgroundRemoval) {
        setIsRemovingVideoBackground(false);
      } else {
        setIsConvertingToVideo(false);
        setSelectedImageForVideo(null);
      }
    } catch (error) {
      console.error("Error completing video generation:", error);

      toast({
        title: "Error creating video",
        description:
          error instanceof Error ? error.message : "Failed to create video",
        variant: "destructive",
      });

      // Remove from active generations even on error
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });

      setIsConvertingToVideo(false);
      setSelectedImageForVideo(null);
    }
  };

  // Function to handle video generation errors
  const handleVideoGenerationError = (videoId: string, error: string) => {
    console.error("Video generation error:", error);

    // Check if this was a background removal
    const generation = activeVideoGenerations.get(videoId);
    const isBackgroundRemoval =
      generation?.modelId === "bria-video-background-removal";

    toast({
      title: isBackgroundRemoval
        ? "Background removal failed"
        : "Video generation failed",
      description: error,
      variant: "destructive",
    });

    // Remove from active generations
    setActiveVideoGenerations((prev) => {
      const newMap = new Map(prev);
      newMap.delete(videoId);
      return newMap;
    });

    // Reset appropriate flags
    if (isBackgroundRemoval) {
      setIsRemovingVideoBackground(false);
    } else {
      setIsConvertingToVideo(false);
      setIsTransformingVideo(false);
      setIsExtendingVideo(false);
    }
  };

  // Function to handle video generation progress
  const handleVideoGenerationProgress = (
    videoId: string,
    progress: number,
    status: string,
  ) => {
    // You could update a progress indicator here if needed
    console.log(`Video generation progress: ${progress}% - ${status}`);
  };

  const { mutateAsync: isolateObject } = useMutation(
    trpc.isolateObject.mutationOptions(),
  );

  const { mutateAsync: generateTextToImage } = useMutation(
    trpc.generateTextToImage.mutationOptions(),
  );

  // Save current state to storage
  const saveToStorage = useCallback(async () => {
    const revision = ++saveRevision.current;
    try {
      setIsSaving(true);

      // Save canvas state (positions, transforms, etc.)
      const canvasState: CanvasState = {
        elements: [
          ...images.map(imageToCanvasElement),
          ...videos.map(videoToCanvasElement),
          ...texts.map(textToCanvasElement),
          ...shapes.map(shapeToCanvasElement),
          ...notes.map(noteToCanvasElement),
        ],
        backgroundColor: "#ffffff",
        lastModified: Date.now(),
        viewport: viewport,
      };

      // Save actual image data to IndexedDB
      for (const image of images) {
        // Skip if it's a placeholder for generation
        if (
          image.src.startsWith("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP")
        )
          continue;
        // gpt-image 생성 중 자리표시자도 저장 금지 — 같은 id로 먼저 저장되면
        // 완성본이 "이미 있음"으로 건너뛰어져 영구히 placeholder만 남는다
        if (image.src === generationPlaceholderSrc) continue;

        // Check if we already have this image stored
        const existingImage = await canvasStorage.getImage(image.id);
        if (!existingImage || existingImage.originalDataUrl !== image.src) {
          await canvasStorage.saveImage(image.src, image.id);
        }
      }

      // Save video data to IndexedDB
      for (const video of videos) {
        // Skip if it's a placeholder for generation
        if (
          video.src.startsWith("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP")
        )
          continue;

        // Check if we already have this video stored
        const existingVideo = await canvasStorage.getVideo(video.id);
        if (!existingVideo) {
          await canvasStorage.saveVideo(video.src, video.duration, video.id);
        }
      }

      // Commit only after media is durable. Keep removed media for undo/recovery.
      if (revision !== saveRevision.current) return;
      canvasStorage.saveCanvasState(canvasState);
      setSaveError(false);

      // Brief delay to show the indicator
      setIsSaving(false);
    } catch (error) {
      console.error("Failed to save to storage:", error);
      setSaveError(true);
      toast({
        title: "자동 저장에 실패했어요",
        description:
          "이 창을 닫지 말고 보드 저장·열기에서 작업을 저장해 주세요. 기존 이미지는 삭제하지 않았어요.",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  }, [images, videos, texts, shapes, notes, viewport]);

  // Load state from storage
  const loadFromStorage = useCallback(async () => {
    try {
      const canvasState = canvasStorage.getCanvasState();
      if (!canvasState) {
        setIsStorageLoaded(true);
        return;
      }

      const loadedImages: PlacedImage[] = [];
      const loadedVideos: PlacedVideo[] = [];

      const restoredTexts: PlacedText[] = [];
      const restoredShapes: PlacedShape[] = [];
      const restoredNotes: PlacedNote[] = [];
      for (const element of canvasState.elements) {
        if (element.type === "shape") {
          restoredShapes.push({
            id: element.id,
            hidden: element.hidden,
            locked: element.locked,
            z: element.zIndex,
            kind: (element.kind || "rect") as PlacedShape["kind"],
            x: element.transform.x,
            y: element.transform.y,
            width: element.width || 160,
            height: element.height || 120,
            rotation: element.transform.rotation,
            fill: element.fill,
            stroke: element.stroke || "#e11d48",
            strokeWidth: element.strokeWidth || 4,
            opacity: element.opacity ?? 1,
          });
          continue;
        }
        if (element.type === "note") {
          restoredNotes.push({
            id: element.id,
            text: element.text || "",
            x: element.transform.x,
            y: element.transform.y,
            width: element.width || 220,
            color: element.color || "#fef08a",
            done: element.done,
            targetX: element.targetX ?? element.transform.x + 140,
            targetY: element.targetY ?? element.transform.y + 180,
          });
          continue;
        }
        if (element.type === "text") {
          restoredTexts.push({
            id: element.id,
            hidden: element.hidden,
            locked: element.locked,
            z: element.zIndex,
            text: element.text || "",
            x: element.transform.x,
            y: element.transform.y,
            rotation: element.transform.rotation,
            fontSize: element.fontSize || 48,
            fill: element.fill || "#111111",
            fontFamily: element.fontFamily || FONT_CHOICES[0].value,
            bold: element.bold,
            align: element.align,
            stroke: element.stroke,
          });
          continue;
        }
        if (element.type === "image" && element.imageId) {
          const imageData = await canvasStorage.getImage(element.imageId);
          if (imageData) {
            loadedImages.push({
              id: element.id,
              hidden: element.hidden,
              locked: element.locked,
              z: element.zIndex,
              src: imageData.originalDataUrl,
              ...(element.promptHint && { promptHint: element.promptHint }),
              generation: element.generation,
              x: element.transform.x,
              y: element.transform.y,
              width: element.width || 300,
              height: element.height || 300,
              rotation: element.transform.rotation,
              ...(element.transform.cropBox && {
                cropX: element.transform.cropBox.x,
                cropY: element.transform.cropBox.y,
                cropWidth: element.transform.cropBox.width,
                cropHeight: element.transform.cropBox.height,
              }),
            });
          }
        } else if (element.type === "video" && element.videoId) {
          const videoData = await canvasStorage.getVideo(element.videoId);
          if (videoData) {
            loadedVideos.push({
              id: element.id,
              hidden: element.hidden,
              locked: element.locked,
              z: element.zIndex,
              src: videoData.originalDataUrl,
              x: element.transform.x,
              y: element.transform.y,
              width: element.width || 300,
              height: element.height || 300,
              rotation: element.transform.rotation,
              isVideo: true,
              duration: element.duration || videoData.duration,
              currentTime: element.currentTime || 0,
              isPlaying: element.isPlaying || false,
              volume: element.volume || 1,
              muted: element.muted || false,
              isLoaded: false, // Initialize as not loaded
              ...(element.transform.cropBox && {
                cropX: element.transform.cropBox.x,
                cropY: element.transform.cropBox.y,
                cropWidth: element.transform.cropBox.width,
                cropHeight: element.transform.cropBox.height,
              }),
            });
          }
        }
      }

      // Set loaded images and videos
      setTexts(restoredTexts);
      setShapes(restoredShapes);
      setNotes(restoredNotes);
      if (loadedImages.length > 0) {
        setImages(loadedImages);
      }

      if (loadedVideos.length > 0) {
        setVideos(loadedVideos);
      }

      // Restore viewport if available
      if (canvasState.viewport) {
        setViewport(canvasState.viewport);
      }
    } catch (error) {
      console.error("Failed to load from storage:", error);
      toast({
        title: "Failed to restore canvas",
        description: "Starting with a fresh canvas",
        variant: "destructive",
      });
    } finally {
      setIsStorageLoaded(true);
    }
  }, [toast]);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("fal-api-key");
    if (savedKey) {
      setCustomApiKey(savedKey);
      setTempApiKey(savedKey);
    }
  }, []);

  // Load grid setting from localStorage on mount
  useEffect(() => {
    const savedShowGrid = localStorage.getItem("showGrid");
    if (savedShowGrid !== null) {
      setShowGrid(savedShowGrid === "true");
    }
  }, []);

  // Load minimap setting from localStorage on mount
  useEffect(() => {
    const savedShowMinimap = localStorage.getItem("showMinimap");
    if (savedShowMinimap !== null) {
      setShowMinimap(savedShowMinimap === "true");
    }
  }, []);

  // Save grid setting to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("showGrid", showGrid.toString());
  }, [showGrid]);

  // Save minimap setting to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("showMinimap", showMinimap.toString());
  }, [showMinimap]);

  // Track previous style when changing styles (but not when reverting from custom)
  useEffect(() => {
    const currentStyleId = generationSettings.styleId;
    if (
      currentStyleId &&
      currentStyleId !== "custom" &&
      currentStyleId !== previousStyleId
    ) {
      setPreviousStyleId(currentStyleId);
    }
  }, [generationSettings.styleId, previousStyleId]);

  // Save API key to localStorage when it changes
  useEffect(() => {
    if (customApiKey) {
      localStorage.setItem("fal-api-key", customApiKey);
    } else {
      localStorage.removeItem("fal-api-key");
    }
  }, [customApiKey]);

  // Save state to history — 글씨·도형·메모도 함께 기억한다 (P1: 순서 바꾼 것도 되돌리려면 필요)
  const saveToHistory = useCallback(() => {
    const newState: HistoryState = {
      images: [...images],
      videos: [...videos],
      texts: [...texts],
      shapes: [...shapes],
      notes: [...notes],
      selectedIds: [...selectedIds],
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [
    images,
    videos,
    texts,
    shapes,
    notes,
    selectedIds,
    history,
    historyIndex,
  ]);

  // 기록 한 칸을 화면에 되살린다. 옛 기록(글씨·도형 없음)이면 지금 것을 그대로 둔다
  const restoreHistory = useCallback((s: HistoryState) => {
    setImages(s.images);
    setVideos(s.videos || []);
    if (s.texts) setTexts(s.texts);
    if (s.shapes) setShapes(s.shapes);
    if (s.notes) setNotes(s.notes);
    setSelectedIds(s.selectedIds);
  }, []);

  // 두 기록이 같은 화면인가 (항목 객체는 바뀔 때마다 새로 만들어지므로 참조 비교로 충분)
  const sameSnapshot = (a: HistoryState, b: HistoryState) => {
    const eq = <T,>(x?: T[], y?: T[]) =>
      !x || !y || (x.length === y.length && x.every((v, i) => v === y[i]));
    return (
      eq(a.images, b.images) &&
      eq(a.videos, b.videos) &&
      eq(a.texts, b.texts) &&
      eq(a.shapes, b.shapes) &&
      eq(a.notes, b.notes)
    );
  };

  // Undo — 이 앱은 대부분 "행동 전"을 저장하고(추가·순서·글씨 끌기), 이미지 끌기만 "행동 후"를 저장한다.
  // 그래서 지금 화면이 기록에 없으면(행동 전 저장) 지금 화면을 되살리기용으로 얹은 뒤 마지막 기록으로 돌아가고,
  // 지금 화면이 곧 마지막 기록이면(행동 후 저장) 그 앞 칸으로 돌아간다. 둘 다 정확히 한 걸음이 된다.
  const undo = useCallback(() => {
    if (historyIndex < 0) return;
    const live: HistoryState = {
      images,
      videos,
      texts,
      shapes,
      notes,
      selectedIds,
    };
    const top = history[historyIndex];
    if (top && !sameSnapshot(live, top)) {
      const kept = history.slice(0, historyIndex + 1);
      setHistory([...kept, live]); // redo 할 수 있게 지금 화면을 뒤에 둔다
      restoreHistory(top); // historyIndex는 그대로 — top이 이제 화면이다
    } else if (historyIndex > 0) {
      restoreHistory(history[historyIndex - 1]);
      setHistoryIndex(historyIndex - 1);
    }
  }, [
    history,
    historyIndex,
    restoreHistory,
    images,
    videos,
    texts,
    shapes,
    notes,
    selectedIds,
  ]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      restoreHistory(history[historyIndex + 1]);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, restoreHistory]);

  // Save initial state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, []);

  // Set canvas ready state after mount
  useEffect(() => {
    // Only set canvas ready after we have valid dimensions
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      setIsCanvasReady(true);
    }
  }, [canvasSize]);

  // Update canvas size on window resize
  useEffect(() => {
    const updateCanvasSize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    updateCanvasSize();

    // Update on resize
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Prevent body scrolling on mobile
  useEffect(() => {
    // Prevent scrolling on mobile
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, []);

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Auto-save to storage when images change (with debounce)
  useEffect(() => {
    if (!isStorageLoaded) return; // Don't save until we've loaded
    if (activeGenerations.size > 0) return;

    const timeoutId = setTimeout(() => {
      saveToStorage();
    }, 1000); // Save after 1 second of no changes

    return () => clearTimeout(timeoutId);
  }, [
    images,
    viewport,
    isStorageLoaded,
    saveToStorage,
    activeGenerations.size,
  ]);

  // 원본의 데모 이미지 자동 채우기 제거 — 빈 캔버스는 빈 채로 시작한다

  // Helper function to resize image if too large
  const resizeImageIfNeeded = async (
    dataUrl: string,
    maxWidth: number = 2048,
    maxHeight: number = 2048,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Check if resize is needed
        if (img.width <= maxWidth && img.height <= maxHeight) {
          resolve(dataUrl);
          return;
        }

        // Calculate new dimensions
        let newWidth = img.width;
        let newHeight = img.height;
        const aspectRatio = img.width / img.height;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = newWidth / aspectRatio;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = newHeight * aspectRatio;
        }

        // Create canvas and resize
        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to data URL with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.9, // 90% quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  };

  // Helper function to create a cropped image
  const createCroppedImage = async (
    imageSrc: string,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous"; // Enable CORS
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Set canvas size to the natural cropped dimensions
        canvas.width = cropWidth * img.naturalWidth;
        canvas.height = cropHeight * img.naturalHeight;

        // Draw the cropped portion at full resolution
        ctx.drawImage(
          img,
          cropX * img.naturalWidth,
          cropY * img.naturalHeight,
          cropWidth * img.naturalWidth,
          cropHeight * img.naturalHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        // Convert to data URL
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageSrc;
    });
  };

  // Handle file upload
  const handleFileUpload = (
    files: FileList | null,
    position?: { x: number; y: number },
  ) => {
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      // 문서(제안서 md/txt/pdf) → 포스터 프롬프트 자동 채우기
      if (/\.(md|txt|pdf)$/i.test(file.name)) {
        (async () => {
          toast({ title: "문서를 읽는 중…", description: file.name });
          try {
            const fd = new FormData();
            fd.set("file", file);
            const resp = await fetch("/api/understand-doc", {
              method: "POST",
              body: fd,
            });
            const j = await resp.json();
            if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
            setGenerationSettings((prev) => ({
              ...prev,
              prompt: j.prompt,
              styleId: "custom",
            }));
            setImageSize("1024x1536"); // 포스터 기본 = 세로
            toast({
              title: "제안서를 읽었어요 — 프롬프트를 채워뒀습니다",
              description: "내용 확인 후 실행(▶)을 누르면 포스터가 생성됩니다",
            });
          } catch (err) {
            toast({
              title: "문서 이해 실패",
              description:
                err instanceof Error ? err.message : "알 수 없는 오류",
              variant: "destructive",
            });
          }
        })();
        return;
      }
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const id = `img-${Date.now()}-${Math.random()}`;
          const img = new window.Image();
          img.crossOrigin = "anonymous"; // Enable CORS
          img.onload = () => {
            // 크기 정보 없는 SVG는 width/height가 0 → 정사각 300으로 (P4)
            const aspectRatio =
              img.width > 0 && img.height > 0 ? img.width / img.height : 1;
            const maxSize = 300;
            let width = maxSize;
            let height = maxSize / aspectRatio;

            if (height > maxSize) {
              height = maxSize;
              width = maxSize * aspectRatio;
            }

            // Place image at position or center of current viewport
            let x, y;
            if (position) {
              // Convert screen position to canvas coordinates
              x = (position.x - viewport.x) / viewport.scale - width / 2;
              y = (position.y - viewport.y) / viewport.scale - height / 2;
            } else {
              // Center of viewport
              const viewportCenterX =
                (canvasSize.width / 2 - viewport.x) / viewport.scale;
              const viewportCenterY =
                (canvasSize.height / 2 - viewport.y) / viewport.scale;
              x = viewportCenterX - width / 2;
              y = viewportCenterY - height / 2;
            }

            // Add offset for multiple files
            if (index > 0) {
              x += index * 20;
              y += index * 20;
            }

            setImages((prev) => [
              ...prev,
              {
                id,
                src: e.target?.result as string,
                x,
                y,
                width,
                height,
                rotation: 0,
              },
            ]);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    // Get drop position relative to the stage
    const stage = stageRef.current;
    if (stage) {
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const dropPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      handleFileUpload(e.dataTransfer.files, dropPosition);
    } else {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Handle wheel for zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    // Check if this is a pinch gesture (ctrl key is pressed on trackpad pinch)
    if (e.evt.ctrlKey) {
      // This is a pinch-to-zoom gesture
      const oldScale = viewport.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      // Zoom based on deltaY (negative = zoom in, positive = zoom out)
      const scaleBy = 1.01;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const steps = Math.min(Math.abs(e.evt.deltaY), 10);
      let newScale = oldScale;

      for (let i = 0; i < steps; i++) {
        newScale = direction > 0 ? newScale * scaleBy : newScale / scaleBy;
      }

      // Limit zoom (10% to 500%)
      const scale = Math.max(0.1, Math.min(5, newScale));

      const newPos = {
        x: pointer.x - mousePointTo.x * scale,
        y: pointer.y - mousePointTo.y * scale,
      };

      setViewport({ x: newPos.x, y: newPos.y, scale });
    } else {
      // This is a pan gesture (two-finger swipe on trackpad or mouse wheel)
      const deltaX = e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX;
      const deltaY = e.evt.shiftKey ? 0 : e.evt.deltaY;

      // Invert the direction to match natural scrolling
      setViewport((prev) => ({
        ...prev,
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    const stage = stageRef.current;

    if (touches.length === 2) {
      // Two fingers - prepare for pinch-to-zoom
      const touch1 = { x: touches[0].clientX, y: touches[0].clientY };
      const touch2 = { x: touches[1].clientX, y: touches[1].clientY };

      const distance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2),
      );

      const center = {
        x: (touch1.x + touch2.x) / 2,
        y: (touch1.y + touch2.y) / 2,
      };

      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    } else if (touches.length === 1) {
      // Single finger - check if touching an image
      const touch = { x: touches[0].clientX, y: touches[0].clientY };

      // Check if we're touching an image
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          const canvasPos = {
            x: (pos.x - viewport.x) / viewport.scale,
            y: (pos.y - viewport.y) / viewport.scale,
          };

          // Check if touch is on any image
          const touchedImage = images.some((img) => {
            return (
              canvasPos.x >= img.x &&
              canvasPos.x <= img.x + img.width &&
              canvasPos.y >= img.y &&
              canvasPos.y <= img.y + img.height
            );
          });

          setIsTouchingImage(touchedImage);
        }
      }

      setLastTouchCenter(touch);
    }
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;

    if (touches.length === 2 && lastTouchDistance && lastTouchCenter) {
      // Two fingers - handle pinch-to-zoom
      e.evt.preventDefault();

      const touch1 = { x: touches[0].clientX, y: touches[0].clientY };
      const touch2 = { x: touches[1].clientX, y: touches[1].clientY };

      const distance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2),
      );

      const center = {
        x: (touch1.x + touch2.x) / 2,
        y: (touch1.y + touch2.y) / 2,
      };

      // Calculate scale change
      const scaleFactor = distance / lastTouchDistance;
      const newScale = Math.max(0.1, Math.min(5, viewport.scale * scaleFactor));

      // Calculate new position to zoom towards pinch center
      const stage = stageRef.current;
      if (stage) {
        const stageBox = stage.container().getBoundingClientRect();
        const stageCenter = {
          x: center.x - stageBox.left,
          y: center.y - stageBox.top,
        };

        const mousePointTo = {
          x: (stageCenter.x - viewport.x) / viewport.scale,
          y: (stageCenter.y - viewport.y) / viewport.scale,
        };

        const newPos = {
          x: stageCenter.x - mousePointTo.x * newScale,
          y: stageCenter.y - mousePointTo.y * newScale,
        };

        setViewport({ x: newPos.x, y: newPos.y, scale: newScale });
      }

      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    } else if (
      touches.length === 1 &&
      lastTouchCenter &&
      !isSelecting &&
      !isDraggingImage &&
      !isTouchingImage
    ) {
      // Single finger - handle pan (only if not selecting, dragging, or touching an image)
      // Don't prevent default if there might be system dialogs open
      const hasActiveFileInput = document.querySelector('input[type="file"]');
      if (!hasActiveFileInput) {
        e.evt.preventDefault();
      }

      const touch = { x: touches[0].clientX, y: touches[0].clientY };
      const deltaX = touch.x - lastTouchCenter.x;
      const deltaY = touch.y - lastTouchCenter.y;

      setViewport((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastTouchCenter(touch);
    }
  };

  const handleTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    setLastTouchDistance(null);
    setLastTouchCenter(null);
    setIsTouchingImage(false);
  };

  // Handle selection
  const handleSelect = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  };

  // Handle drag selection and panning
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    const stage = e.target.getStage();
    const mouseButton = e.evt.button; // 0 = left, 1 = middle, 2 = right

    // If middle mouse button, start panning
    if (mouseButton === 1) {
      e.evt.preventDefault();
      setIsPanningCanvas(true);
      setLastPanPosition({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    // If in crop mode and clicked outside, exit crop mode
    if (croppingImageId) {
      const clickedNode = e.target;
      const cropGroup = clickedNode.findAncestor((node: any) => {
        return node.attrs && node.attrs.name === "crop-overlay";
      });

      if (!cropGroup) {
        setCroppingImageId(null);
        return;
      }
    }

    // Start selection box when left-clicking on empty space
    if (clickedOnEmpty && !croppingImageId && mouseButton === 0) {
      const pos = stage?.getPointerPosition();
      if (pos) {
        // Convert screen coordinates to canvas coordinates
        const canvasPos = {
          x: (pos.x - viewport.x) / viewport.scale,
          y: (pos.y - viewport.y) / viewport.scale,
        };

        setIsSelecting(true);
        setSelectionBox({
          startX: canvasPos.x,
          startY: canvasPos.y,
          endX: canvasPos.x,
          endY: canvasPos.y,
          visible: true,
        });
        setSelectedIds([]);
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();

    // Handle canvas panning with middle mouse
    if (isPanningCanvas) {
      const deltaX = e.evt.clientX - lastPanPosition.x;
      const deltaY = e.evt.clientY - lastPanPosition.y;

      setViewport((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastPanPosition({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    // Handle selection
    if (!isSelecting) return;

    const pos = stage?.getPointerPosition();
    if (pos) {
      // Convert screen coordinates to canvas coordinates
      const canvasPos = {
        x: (pos.x - viewport.x) / viewport.scale,
        y: (pos.y - viewport.y) / viewport.scale,
      };

      setSelectionBox((prev) => ({
        ...prev,
        endX: canvasPos.x,
        endY: canvasPos.y,
      }));
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Stop canvas panning
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
      return;
    }

    if (!isSelecting) return;

    // Calculate which images and videos are in the selection box
    const box = {
      x: Math.min(selectionBox.startX, selectionBox.endX),
      y: Math.min(selectionBox.startY, selectionBox.endY),
      width: Math.abs(selectionBox.endX - selectionBox.startX),
      height: Math.abs(selectionBox.endY - selectionBox.startY),
    };

    // Only select if the box has some size
    if (box.width > 5 || box.height > 5) {
      // Check for images in the selection box
      const selectedImages = images.filter((img) => {
        // Check if image intersects with selection box
        return !(
          img.x + img.width < box.x ||
          img.x > box.x + box.width ||
          img.y + img.height < box.y ||
          img.y > box.y + box.height
        );
      });

      // Check for videos in the selection box
      const selectedVideos = videos.filter((vid) => {
        // Check if video intersects with selection box
        return !(
          vid.x + vid.width < box.x ||
          vid.x > box.x + box.width ||
          vid.y + vid.height < box.y ||
          vid.y > box.y + box.height
        );
      });

      // Combine selected images and videos
      const selectedIds = [
        ...selectedImages.map((img) => img.id),
        ...selectedVideos.map((vid) => vid.id),
      ];

      if (selectedIds.length > 0) {
        setSelectedIds(selectedIds);
      }
    }

    setIsSelecting(false);
    setSelectionBox({ ...selectionBox, visible: false });
  };

  // Note: Overlapping detection has been removed in favor of explicit "Combine Images" action
  // Users can now manually combine images via the context menu before running generation

  // Handle context menu actions
  const openMaskEdit = (mode: "brush" | "point" | "text") => {
    const img = images.find((i) => i.id === selectedIds[0]);
    if (!img) return;
    // 캔버스 축소 상태와 무관하게 화면 중앙에 크게 띄운다 (칠하기 편하게)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = img.width / img.height;
    let h = Math.min(vh * 0.62, 680);
    let w = h * aspect;
    if (w > vw * 0.82) {
      w = vw * 0.82;
      h = w / aspect;
    }
    setMaskEdit({
      id: img.id,
      mode,
      rect: { x: (vw - w) / 2, y: (vh - h) / 2 - 20, w, h },
    });
  };

  const removeBgForSelected = () => {
    const img = images.find((i) => i.id === selectedIds[0]);
    if (!img) return;
    runRemoveBackground({
      image: img,
      quality: imageQuality,
      setImages,
      setSelectedIds,
      setIsGenerating,
      toast,
    });
  };

  useEffect(() => {
    setMyName(localStorage.getItem("gomgom-my-name") || "");
  }, []);
  useEffect(() => {
    if (myName) localStorage.setItem("gomgom-my-name", myName);
  }, [myName]);

  // 캔버스(Konva) 렌더는 웹폰트 다운로드를 유발하지 않는다 → 명시적으로 불러온 뒤 다시 그린다
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    const families = FONT_CHOICES.map((f) =>
      f.value.split(",")[0].replace(/['"]/g, "").trim(),
    );
    Promise.all(
      families.flatMap((fam) => [
        document.fonts.load(`400 16px "${fam}"`).catch(() => null),
        document.fonts.load(`700 16px "${fam}"`).catch(() => null),
      ]),
    ).then(() => {
      stageRef.current?.batchDraw();
    });
  }, []);

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.md,.txt,.pdf";
    input.multiple = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.onchange = (e) => {
      try {
        handleFileUpload((e.target as HTMLInputElement).files);
      } finally {
        if (input.parentNode) document.body.removeChild(input);
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      if (input.parentNode) document.body.removeChild(input);
    }, 30000);
  };

  // 대충 쓴 프롬프트를 구체적인 묘사로 부풀린다
  const enhancePrompt = async () => {
    const raw = generationSettings.prompt.trim();
    if (!raw) {
      toast({
        title: "먼저 뭘 만들지 한 줄 적어주세요",
        variant: "destructive",
      });
      return;
    }
    setIsEnhancing(true);
    try {
      const styleLabel = styleModels.find(
        (m) => m.id === generationSettings.styleId,
      )?.name;
      const resp = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: raw,
          size: imageSize,
          styleLabel,
          hasRefs: selectedIds.some((id) => images.some((i) => i.id === id)),
        }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
      setPromptBeforeEnhance(raw);
      setGenerationSettings((prev) => ({ ...prev, prompt: j.prompt }));
      toast({
        title: "프롬프트를 다듬었어요",
        description: "마음에 안 들면 ↩ 되돌리기를 누르세요",
      });
    } catch (e) {
      toast({
        title: "다듬기 실패",
        description: e instanceof Error ? e.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const doSaveBoard = async (id: string, name: string, force = false) => {
    setBoardBusy("저장 중…");
    try {
      const meta = await saveBoard({
        boardId: id,
        name,
        myName,
        knownUpdatedAt: force ? undefined : boardUpdatedAt,
        images,
        texts,
        shapes,
        notes,
        viewport,
        artboard,
        videos,
        extras: {
          ...studioExtras,
          settings: {
            prompt: generationSettings.prompt,
            provider: providerId,
            model: providerId === "gemini" ? geminiModel : openaiModel,
            size: imageSize,
            quality: imageQuality,
          },
        },
        onProgress: (m) => setBoardBusy(m),
      });
      setBoardId(meta.id);
      setBoardName(meta.name);
      setBoardUpdatedAt(meta.updatedAt);
      setBoardRefresh((n) => n + 1);
      toast({ title: `"${meta.name}" 저장 완료` });
    } catch (e) {
      const conflict = (e as Error & { conflict?: boolean }).conflict;
      if (conflict) {
        if (
          confirm(
            `${e instanceof Error ? e.message : ""}

그래도 내 것으로 덮어쓸까요? (상대 작업이 사라집니다)`,
          )
        ) {
          await doSaveBoard(id, name, true);
          return;
        }
        toast({
          title: "저장하지 않았습니다",
          description: "먼저 상대 보드를 열어 확인하세요",
        });
      } else {
        toast({
          title: "보드 저장 실패",
          description: e instanceof Error ? e.message : "알 수 없는 오류",
          variant: "destructive",
        });
      }
    } finally {
      setBoardBusy("");
    }
  };

  const openBoard = async (b: BoardMeta) => {
    setBoardBusy("불러오는 중…");
    try {
      const data = await loadBoard(b.id);
      saveToHistory();
      setImages(data.images);
      setVideos(data.videos);
      if (data.extras) {
        setStudioExtras(data.extras);
        setGenerationSettings((s) => ({
          ...s,
          prompt: data.extras!.settings.prompt,
        }));
        setImageSize(data.extras.settings.size);
        setImageQuality(data.extras.settings.quality);
        if (
          ["openai", "gemini", "grok"].includes(data.extras.settings.provider)
        )
          setProviderId(data.extras.settings.provider as ProviderId);
        if (data.extras.settings.provider === "gemini")
          setGeminiModel(data.extras.settings.model);
        else if (data.extras.settings.model)
          setOpenaiModel(data.extras.settings.model);
      } else setStudioExtras(emptyExtras());
      setTexts(data.texts);
      setShapes(data.shapes);
      setNotes(data.notes);
      setViewport(data.viewport);
      setArtboard(data.artboard ?? null);
      setSelectedIds([]);
      setBoardId(b.id);
      setBoardName(data.meta.name);
      setBoardUpdatedAt(data.meta.updatedAt);
      setBoardOpen(false);
      toast({
        title: `"${data.meta.name}" 열었어요`,
        description: `마지막 저장: ${data.meta.updatedBy}`,
      });
    } catch (e) {
      toast({
        title: "불러오기 실패",
        description: e instanceof Error ? e.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setBoardBusy("");
    }
  };

  const planCampaign = async () => {
    if (!campaignRequest.trim()) return;
    setIsPlanning(true);
    setCampaignPlan(null);
    try {
      const resp = await fetch("/api/campaign-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: campaignRequest }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
      setCampaignPlan(j);
    } catch (e) {
      toast({
        title: "계획 세우기 실패",
        description: e instanceof Error ? e.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const startCampaign = () => {
    if (!campaignPlan) return;
    const cx = (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const cy = (canvasSize.height / 2 - viewport.y) / viewport.scale;
    setCampaignOpen(false);
    runCampaign({
      plan: campaignPlan,
      quality: imageQuality,
      provider: providerId,
      geminiModel,
      openaiModel,
      startX: cx - 600,
      startY: cy - 180,
      setImages,
      setSelectedIds,
      setIsGenerating,
      setProgressNote,
      toast,
    });
  };

  const addShape = (kind: PlacedShape["kind"]) => {
    const id = `shape-${Date.now()}`;
    const cx = (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const cy = (canvasSize.height / 2 - viewport.y) / viewport.scale;
    saveToHistory();
    setShapes((prev) => [
      ...prev,
      {
        id,
        kind,
        x: cx - 80,
        y: cy - 60,
        width: 160,
        height: 120,
        rotation: 0,
        fill: undefined,
        stroke: "#e11d48",
        strokeWidth: 4,
        opacity: 1,
      },
    ]);
    setSelectedIds([id]);
  };

  const addNote = () => {
    const id = `note-${Date.now()}`;
    const cx = (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const cy = (canvasSize.height / 2 - viewport.y) / viewport.scale;
    saveToHistory();
    setNotes((prev) => [
      ...prev,
      {
        id,
        text: "",
        x: cx - NOTE_WIDTH_NARROW / 2,
        y: cy - 50,
        width: NOTE_WIDTH_NARROW,
        color: "#fef08a",
        targetX: cx + 30,
        targetY: cy + 180,
      },
    ]);
    setSelectedIds([id]);
  };

  const addTextLayer = () => {
    const id = `text-${Date.now()}`;
    // 화면 중앙에 놓는다
    const cx = (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const cy = (canvasSize.height / 2 - viewport.y) / viewport.scale;
    saveToHistory();
    setTexts((prev) => [
      ...prev,
      {
        id,
        text: "문구를 입력하세요",
        x: cx - 120,
        y: cy - 24,
        fontSize: 48,
        fill: "#111111",
        fontFamily: FONT_CHOICES[0].value,
        rotation: 0,
      },
    ]);
    setSelectedIds([id]);
  };

  // 이미지 + 그 위 텍스트를 한 장으로 합쳐 새 이미지로 (다운로드·재편집용)
  const bakeTextIntoImage = async () => {
    const img = images.find((i) => i.id === selectedIds[0]);
    if (!img) return;
    const stage = stageRef.current;
    if (!stage) return;

    // 원본 해상도로 굽기 위해 배율 계산
    const el = new window.Image();
    el.src = img.src;
    await new Promise((r) => (el.onload = r));
    const pixelRatio = el.naturalWidth / (img.width * viewport.scale);

    // 굽는 동안 선택 표시와 메모가 찍히지 않도록 잠시 감춘다
    const keep = selectedIds;
    setSelectedIds([]);
    setIsBaking(true);
    await new Promise((r) => setTimeout(r, 120));

    const dataUrl = stage.toDataURL({
      x: img.x * viewport.scale + viewport.x,
      y: img.y * viewport.scale + viewport.y,
      width: img.width * viewport.scale,
      height: img.height * viewport.scale,
      pixelRatio,
    });

    setIsBaking(false);

    // 합친 결과 안에 들어간 텍스트·도형은 지우고, 원본 자리에 결과를 놓는다
    const inBounds = (x: number, y: number) =>
      x >= img.x - 20 &&
      x <= img.x + img.width + 20 &&
      y >= img.y - 20 &&
      y <= img.y + img.height + 20;
    const shapeIds = shapes
      .filter((sp) => inBounds(sp.x, sp.y))
      .map((sp) => sp.id);
    setShapes((prev) => prev.filter((sp) => !shapeIds.includes(sp.id)));
    const insideIds = texts
      .filter(
        (t) =>
          t.x >= img.x - 20 &&
          t.x <= img.x + img.width + 20 &&
          t.y >= img.y - 20 &&
          t.y <= img.y + img.height + 20,
      )
      .map((t) => t.id);
    saveToHistory();
    setTexts((prev) => prev.filter((t) => !insideIds.includes(t.id)));

    const id = `baked-${Date.now()}`;
    setImages((prev) => [
      ...prev,
      {
        ...img,
        id,
        src: dataUrl,
        x: img.x + img.width + 20,
        promptHint: `${img.promptHint || "이미지"}-글자합침`,
        cropX: undefined,
        cropY: undefined,
        cropWidth: undefined,
        cropHeight: undefined,
      },
    ]);
    setSelectedIds([id]);
    toast({
      title: "글자를 이미지에 합쳤어요",
      description: "이제 그대로 내려받거나 다시 수정할 수 있습니다",
    });
    void keep;
  };

  const cutoutForSelected = () => {
    const img = images.find((i) => i.id === selectedIds[0]);
    if (!img) return;
    runCutout({
      image: img,
      setImages,
      setSelectedIds,
      setIsGenerating,
      setProgressNote,
      toast,
    });
  };

  const runExpandFor = (target: string) => {
    const img = images.find((i) => i.id === selectedIds[0]);
    if (!img) return;
    runExpand({
      image: img,
      target,
      quality: imageQuality,
      setImages,
      setSelectedIds,
      setIsGenerating,
      toast,
    });
  };

  // 이미지 대상 액션 한 곳 — 왼쪽 도구 팔레트와 우클릭 메뉴가 같이 쓴다
  const handleEditAction = (action: string) => {
    if (action === "cardnews") setCardnewsOpen(true);
    else if (action === "removebg") removeBgForSelected();
    else if (action === "cutout") cutoutForSelected();
    else if (action.startsWith("expand-")) runExpandFor(action.slice(7));
    else openMaskEdit(action as "brush" | "point" | "text");
  };

  const detectedPromptSize = promptImageSize(generationSettings.prompt);
  useEffect(() => {
    if (detectedPromptSize) setImageSize(detectedPromptSize);
  }, [detectedPromptSize]);

  const selectedBrief = images
    .filter((image) => selectedIds.includes(image.id))
    .map(
      (image) =>
        (image.generation?.brief
          ? stableBriefFromPrompt(image.generation.brief) ||
            image.generation.brief
          : undefined) ||
        (image.generation?.prompt
          ? stableBriefFromPrompt(image.generation.prompt)
          : undefined),
    )
    .find(Boolean);
  const suggestedBrief =
    referenceMode === "style"
      ? recentCanvasBrief(images) || selectedBrief
      : selectedBrief || recentCanvasBrief(images);
  const showingPriorBrief = isFollowupRequest(generationSettings.prompt);
  const promptImageCount = requestedImageCount(generationSettings.prompt);

  const handleRun = async () => {
    setGenerationError("");
    const resolvedSize = imageSize;
    if (resolvedSize !== imageSize) setImageSize(resolvedSize);
    const count =
      providerId === "openai" ? promptImageCount || variantCount : 1;
    if (providerId === "openai" && count !== variantCount)
      setVariantCount(count);
    saveToHistory();
    // fal 파이프라인 대신 gpt-image-2 중계 서버 사용 (선택 이미지 = 참조, F-04)
    await runOpenAIGeneration({
      images,
      selectedIds,
      userPrompt: generationSettings.prompt,
      referenceMode,
      onError: setGenerationError,
      prompt: [
        generationSettings.prompt,
        exactCopy.trim() &&
          `이미지에 넣을 문구는 다음과 같다. 따옴표 안 내용을 번역하거나 바꾸지 말고 정확하게 표기하고, 읽기 좋은 크기와 대비로 배치하라: ${JSON.stringify(exactCopy.trim())}`,
        images.some((i) => selectedIds.includes(i.id)) &&
          referenceKeep.trim() &&
          `참조 이미지에서 반드시 유지할 특징: ${referenceKeep.trim()}. 요청한 변경 외에는 이 특징을 유지하라.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      n: count,
      inheritReferencePrompt,
      workspaceLeft: canvasSize.width >= 768 ? 348 : 0,
      workspaceRight: canvasSize.width >= 1100 ? 280 : 0,
      workspaceBottom: canvasSize.width >= 768 ? 60 : canvasSize.height * 0.48,
      setViewport,
      size: resolvedSize,
      quality: imageQuality,
      transparent: transparentBg,
      provider: providerId,
      geminiModel,
      openaiModel,
      canvasSize,
      viewport,
      setImages,
      setSelectedIds,
      setIsGenerating,
      toast,
    });
  };

  const handleDelete = () => {
    // Save to history before deleting
    saveToHistory();
    setTexts((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
    setShapes((prev) => prev.filter((sp) => !selectedIds.includes(sp.id)));
    setNotes((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
    setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)));
    setVideos((prev) => prev.filter((vid) => !selectedIds.includes(vid.id)));
    setSelectedIds([]);
  };

  const handleDuplicate = () => {
    // Save to history before duplicating
    saveToHistory();

    // Duplicate selected images
    const selectedImages = images.filter((img) => selectedIds.includes(img.id));
    const newImages = selectedImages.map((img) => ({
      ...img,
      id: `img-${Date.now()}-${Math.random()}`,
      x: img.x + 20,
      y: img.y + 20,
    }));

    // Duplicate selected videos
    const selectedVideos = videos.filter((vid) => selectedIds.includes(vid.id));
    const newVideos = selectedVideos.map((vid) => ({
      ...vid,
      id: `vid-${Date.now()}-${Math.random()}`,
      x: vid.x + 20,
      y: vid.y + 20,
      // Reset playback state for duplicated videos
      currentTime: 0,
      isPlaying: false,
    }));

    // Update both arrays
    setImages((prev) => [...prev, ...newImages]);
    setVideos((prev) => [...prev, ...newVideos]);
    const copy = <T extends { id: string; x: number; y: number }>(items: T[]) =>
      items
        .filter((i) => selectedIds.includes(i.id))
        .map((i) => ({
          ...i,
          id: crypto.randomUUID(),
          x: i.x + 20,
          y: i.y + 20,
        }));
    const newTexts = copy(texts),
      newShapes = copy(shapes),
      newNotes = copy(notes).map((n) => ({
        ...n,
        targetX: n.targetX + 20,
        targetY: n.targetY + 20,
      }));
    setTexts((prev) => [...prev, ...newTexts]);
    setShapes((prev) => [...prev, ...newShapes]);
    setNotes((prev) => [...prev, ...newNotes]);

    // Select all duplicated items
    const newIds = [
      ...newImages.map((img) => img.id),
      ...newVideos.map((vid) => vid.id),
      ...newTexts.map((i) => i.id),
      ...newShapes.map((i) => i.id),
      ...newNotes.map((i) => i.id),
    ];
    setSelectedIds(newIds);
  };

  const handleRemoveBackground = async () => {
    await handleRemoveBackgroundHandler({
      images,
      selectedIds,
      setImages,
      toast,
      saveToHistory,
      removeBackground,
      customApiKey,
      falClient,
      setIsApiKeyDialogOpen,
    });
  };

  // Function to handle the "Remove Background from Video" option in the context menu
  const handleRemoveVideoBackground = (videoId: string) => {
    const video = videos.find((vid) => vid.id === videoId);
    if (!video) return;

    setSelectedVideoForBackgroundRemoval(videoId);
    setIsRemoveVideoBackgroundDialogOpen(true);
  };

  // Function to handle the video background removal
  const handleVideoBackgroundRemoval = async (backgroundColor: string) => {
    if (!selectedVideoForBackgroundRemoval) return;

    const video = videos.find(
      (vid) => vid.id === selectedVideoForBackgroundRemoval,
    );
    if (!video) return;

    try {
      setIsRemovingVideoBackground(true);

      // Close the dialog
      setIsRemoveVideoBackgroundDialogOpen(false);

      // Don't show a toast here - the StreamingVideo component will handle progress

      // Upload video if it's a data URL or blob URL
      let videoUrl = video.src;
      if (videoUrl.startsWith("data:") || videoUrl.startsWith("blob:")) {
        const uploadResult = await falClient.storage.upload(
          await (await fetch(videoUrl)).blob(),
        );
        videoUrl = uploadResult;
      }

      // Create a unique ID for this generation
      const generationId = `bg_removal_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Map the background color to the API's expected format
      const colorMap: Record<string, string> = {
        transparent: "Transparent",
        black: "Black",
        white: "White",
        gray: "Gray",
        red: "Red",
        green: "Green",
        blue: "Blue",
        yellow: "Yellow",
        cyan: "Cyan",
        magenta: "Magenta",
        orange: "Orange",
      };

      // Map to API format
      const apiBackgroundColor = colorMap[backgroundColor] || "Black";

      // Add to active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        newMap.set(generationId, {
          imageUrl: videoUrl,
          prompt: `Removing background from video`,
          duration: video.duration || 5,
          modelId: "bria-video-background-removal",
          modelConfig: getVideoModelById("bria-video-background-removal"),
          sourceVideoId: video.id,
          backgroundColor: apiBackgroundColor,
        });
        return newMap;
      });

      // Create a persistent toast that will stay visible until the conversion completes
      const toastId = toast({
        title: "Removing background from video",
        description: "This may take several minutes...",
        duration: Infinity, // Make the toast stay until manually dismissed
      }).id;

      // Store the toast ID with the generation for later reference
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generation = newMap.get(generationId);
        if (generation) {
          newMap.set(generationId, {
            ...generation,
            toastId,
          });
        }
        return newMap;
      });

      // Remove the direct API call since StreamingVideo will handle it
      // The StreamingVideo component will handle the actual API call and progress updates
    } catch (error) {
      console.error("Error removing video background:", error);
      toast({
        title: "Error processing video",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });

      // Remove from active generations
      setActiveVideoGenerations((prev) => {
        const newMap = new Map(prev);
        const generationId = Array.from(prev.keys()).find(
          (key) =>
            prev.get(key)?.sourceVideoId === selectedVideoForBackgroundRemoval,
        );
        if (generationId) {
          newMap.delete(generationId);
        }
        return newMap;
      });
    } finally {
      // Don't set isRemovingVideoBackground to false here - let the completion/error handlers do it
      setSelectedVideoForBackgroundRemoval(null);
    }
  };

  // ── 레이어 순서 통합 (포스터 모드 P1) ─────────────────────────────
  // 이미지·영상·도형·글씨를 순서 번호(z) 하나로 다룬다. 아래 → 위.
  // 예전엔 이미지끼리만 순서를 바꿀 수 있었고 글씨·도형은 늘 이미지 위에 고정이었다.
  const orderedLayers = useMemo(
    () => orderLayers(images, videos, shapes, texts),
    [images, videos, shapes, texts],
  );

  // 새 순서를 각 배열의 z에 써넣는다 (0..N-1로 다시 매김 → 순서가 굳는다)
  const applyLayerOrder = useCallback((entries: LayerEntry[]) => {
    const zm = zMap(entries);
    const stamp = <T extends { id: string; z?: number }>(arr: T[]) =>
      arr.map((it) => (zm.has(it.id) ? { ...it, z: zm.get(it.id)! } : it));
    setImages((prev) => stamp(prev));
    setVideos((prev) => stamp(prev));
    setShapes((prev) => stamp(prev));
    setTexts((prev) => stamp(prev));
  }, []);

  const reorderSelected = useCallback(
    (mode: "front" | "back" | "forward" | "backward") => {
      if (selectedIds.length === 0) return;
      saveToHistory();
      applyLayerOrder(moveSelected(orderedLayers, selectedIds, mode));
    },
    [selectedIds, saveToHistory, applyLayerOrder, orderedLayers],
  );

  const sendToFront = useCallback(
    () => reorderSelected("front"),
    [reorderSelected],
  );
  const sendToBack = useCallback(
    () => reorderSelected("back"),
    [reorderSelected],
  );
  const bringForward = useCallback(
    () => reorderSelected("forward"),
    [reorderSelected],
  );
  const sendBackward = useCallback(
    () => reorderSelected("backward"),
    [reorderSelected],
  );

  // 레이어 패널에서 끌어다 놓기 — newIndex는 아래 기준
  const moveLayerTo = useCallback(
    (id: string, newIndex: number) => {
      saveToHistory();
      applyLayerOrder(moveToIndex(orderedLayers, id, newIndex));
    },
    [saveToHistory, applyLayerOrder, orderedLayers],
  );

  // 숨김·잠금 토글 (모든 종류 공통). 숨기면 선택도 푼다
  const toggleLayerFlag = useCallback(
    (id: string, flag: "hidden" | "locked") => {
      const cur = orderedLayers.find((e) => e.id === id)?.item;
      if (!cur) return;
      saveToHistory();
      const flip = <
        T extends { id: string; hidden?: boolean; locked?: boolean },
      >(
        arr: T[],
      ) => arr.map((it) => (it.id === id ? { ...it, [flag]: !it[flag] } : it));
      setImages((prev) => flip(prev));
      setVideos((prev) => flip(prev));
      setShapes((prev) => flip(prev));
      setTexts((prev) => flip(prev));
      if (flag === "hidden" && !cur.hidden) {
        setSelectedIds((prev) => prev.filter((s) => s !== id));
      }
    },
    [orderedLayers, saveToHistory],
  );

  // 패널에서 줄을 클릭해 고르기 (Shift/Ctrl = 여러 개)
  const selectFromPanel = useCallback((id: string, additive: boolean) => {
    setSelectedIds((prev) =>
      additive
        ? prev.includes(id)
          ? prev.filter((p) => p !== id)
          : [...prev, id]
        : [id],
    );
  }, []);

  // ── PC 폰트 (P3) ──────────────────────────────────────────────────
  // 글씨가 쓰는 PC 폰트를 내려받고, 다 받아지면 캔버스 글씨를 다시 그린다 (보드 열기·새로고침에도 동작)
  useEffect(() => {
    const fams = new Set<string>();
    texts.forEach((t) => {
      const f = familyFromValue(t.fontFamily);
      if (f) fams.add(f);
    });
    fams.forEach((f) => ensureLocalFont(f));
  }, [texts]);
  useEffect(() => {
    const redraw = () => {
      const stage = stageRef.current;
      if (!stage) return;
      // 글자 폭·높이를 새 폰트로 다시 재게 한 뒤 그린다
      stage.find(".canvas-text").forEach((n) => {
        const t = n as Konva.Text;
        t.text(t.text());
      });
      stage.batchDraw();
    };
    document.fonts.addEventListener("loadingdone", redraw);
    return () => document.fonts.removeEventListener("loadingdone", redraw);
  }, []);

  // ── 포스터 판 (P2) ────────────────────────────────────────────────
  // 새 세션은 자유 작업으로 시작한다. 저장한 보드를 명시적으로 열 때만 판을 복원한다.
  useEffect(() => {
    try {
      if (artboard)
        localStorage.setItem("gomgom-artboard", JSON.stringify(artboard));
      else localStorage.removeItem("gomgom-artboard");
    } catch {}
  }, [artboard]);

  const fitToArtboard = useCallback(() => {
    if (!artboard) return;
    setViewport(fitArtboard(artboard, canvasSize.width, canvasSize.height));
  }, [artboard, canvasSize.width, canvasSize.height]);

  const createArtboard = (widthMm: number, heightMm: number, name: string) => {
    const cx = (canvasSize.width / 2 - viewport.x) / viewport.scale;
    const cy = (canvasSize.height / 2 - viewport.y) / viewport.scale;
    const ab = makeArtboard(cx, cy, widthMm, heightMm, name);
    setArtboard(ab);
    setViewport(fitArtboard(ab, canvasSize.width, canvasSize.height));
    toast({
      title: `${name} 판을 깔았어요`,
      description: `${ab.width}×${ab.height}px (${ab.dpi}dpi). 이 안에 놓은 것만 내보내집니다`,
    });
  };

  // 판 영역만 1:1(캔버스 px = 출력 px)로 구워 PNG로 내려받는다. 레이어는 건드리지 않는다
  const exportArtboard = async () => {
    const stage = stageRef.current;
    if (!artboard || !stage) return;
    setExporting("굽는 중… (큰 판은 수십 초)");
    const keep = selectedIds,
      previousViewport = viewport;
    const frame = fitArtboard(artboard, canvasSize.width, canvasSize.height);
    setSelectedIds([]);
    setIsBaking(true); // 메모·선택 표시·판 테두리·판 밖 회색을 숨긴다
    setViewport(frame);
    await new Promise((r) => setTimeout(r, 150));
    try {
      checkExportSize(artboard.width, artboard.height);
      await document.fonts.ready;
      const s = frame.scale;
      const raw = stage.toCanvas({
        x: artboard.x * s + frame.x,
        y: artboard.y * s + frame.y,
        width: artboard.width * s,
        height: artboard.height * s,
        pixelRatio: 1 / s,
      });
      // 소수점 배율 때문에 1px 어긋나지 않게 정확한 크기로 옮겨 담는다
      const out = document.createElement("canvas");
      out.width = artboard.width;
      out.height = artboard.height;
      out
        .getContext("2d")!
        .drawImage(raw, 0, 0, artboard.width, artboard.height);
      const blob: Blob | null = await new Promise((res) =>
        out.toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("PNG 변환 실패");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await pngWithDpi(blob, artboard.dpi));
      a.download = artboardFileName(artboard);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast({
        title: "내보냈어요",
        description: `${out.width}×${out.height}px · ${a.download}`,
      });
    } catch (e) {
      toast({
        title: "내보내기 실패",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setIsBaking(false);
      setSelectedIds(keep);
      setViewport(previousViewport);
      setExporting("");
    }
  };

  const [turdam, setTurdam] = useState<{
    token: string;
    origin: string;
    name: string;
    board: Artboard;
  } | null>(null);
  const turdamLoaded = useRef(false);
  const [turdamStatus, setTurdamStatus] = useState("");
  const [turdamSending, setTurdamSending] = useState(false);
  const [turdamSource, setTurdamSource] = useState<"image" | "board">("image");
  const [turdamFit, setTurdamFit] = useState<"contain" | "cover">("contain");
  const [turdamPreview, setTurdamPreview] = useState("");
  const selectedTurdamImage =
    selectedIds.length === 1
      ? images.find(
          (i) => i.id === selectedIds[0] && i.src !== generationPlaceholderSrc,
        )
      : undefined;
  useEffect(() => {
    if (turdamSending) return;
    let cancelled = false;
    setTurdamPreview("");
    if (turdam && turdamSource === "image" && selectedTurdamImage) {
      renderSelectedImage(
        selectedTurdamImage,
        turdam.board.width,
        turdam.board.height,
        turdamFit,
      )
        .then((src) => {
          if (!cancelled) setTurdamPreview(src);
        })
        .catch(() => {
          if (!cancelled)
            setTurdamStatus(
              "선택한 이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요.",
            );
        });
    }
    return () => {
      cancelled = true;
    };
  }, [turdam, turdamSource, turdamFit, selectedTurdamImage, turdamSending]);
  useEffect(() => {
    if (!isStorageLoaded || !window.opener) return;
    const query = new URLSearchParams(location.search),
      token = query.get("turdam"),
      origin = query.get("origin");
    if (
      !token ||
      !origin ||
      !/^http:\/\/(localhost|127\.0\.0\.1):(?:8788|18788)$/.test(origin)
    )
      return;
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window.opener ||
        event.origin !== origin ||
        event.data?.token !== token
      )
        return;
      if (event.data.type === "turdam-canvas-applied") {
        setTurdamSending(false);
        setTurdamStatus(
          event.data.error ||
            event.data.message ||
            "터담에 적용했어요. 무대 스튜디오에서 확인 후 지도에 반영하세요.",
        );
      }
      if (event.data.type !== "turdam-canvas-init" || turdamLoaded.current)
        return;
      const { width, height, image } = event.data;
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0 ||
        width > 40 ||
        height > 40
      )
        return;
      if (
        typeof image !== "string" ||
        image.length > 6000000 ||
        (image && !/^data:image\/(png|jpeg|webp);base64,/.test(image))
      )
        return;
      turdamLoaded.current = true;
      const name = String(event.data.name || "무대 디자인").slice(0, 80);
      const scale = 1200 / Math.max(width, height),
        w = Math.max(1, Math.round(width * scale)),
        h = Math.max(1, Math.round(height * scale));
      // Keep the existing canvas intact; create the new design to its right.
      const x =
        Math.max(
          0,
          ...images.map((i) => i.x + i.width),
          ...shapes.map((i) => i.x + i.width),
          ...texts.map((i) => i.x + 2000),
        ) + 500;
      const board: Artboard = {
        x,
        y: 0,
        width: w,
        height: h,
        widthMm: width * 1000,
        heightMm: height * 1000,
        dpi: w / ((width * 1000) / 25.4),
        name,
      };
      const id = crypto.randomUUID();
      if (image)
        setImages((prev) => [
          ...prev,
          { id, src: image, x, y: 0, width: w, height: h, rotation: 0 },
        ]);
      setSelectedIds(image ? [id] : []);
      setArtboard(null);
      setViewport(fitArtboard(board, canvasSize.width, canvasSize.height));
      setGenerationSettings((prev) => ({
        ...prev,
        prompt: `${name} 디자인. 가로 ${width}m × 세로 ${height}m 비율에 맞춰 주세요.`,
      }));
      setImageSize(sizeForAspect(w, h));
      setTurdam({ token, origin, name, board });
      setTurdamStatus(
        "이미지를 만들거나 선택한 뒤 바로 적용하세요. 흰 작업판에 옮길 필요 없어요.",
      );
    };
    window.addEventListener("message", receive);
    window.opener.postMessage({ type: "turdam-canvas-ready", token }, origin);
    return () => window.removeEventListener("message", receive);
  }, [
    isStorageLoaded,
    images,
    shapes,
    texts,
    canvasSize.width,
    canvasSize.height,
  ]);

  const applyToTurdam = async () => {
    if (!turdam || !stageRef.current || turdamSending) return;
    if (turdamSource === "image" && !selectedTurdamImage) {
      setTurdamStatus("적용할 이미지 한 장을 선택해 주세요.");
      return;
    }
    if (!window.opener || window.opener.closed) {
      setTurdamStatus("터담 창이 닫혔어요. 터담에서 다시 연결해 주세요.");
      return;
    }
    setTurdamSending(true);
    setTurdamStatus("디자인을 보내고 있어요…");
    const keep = selectedIds,
      previousViewport = viewport;
    try {
      let image: string;
      const b = turdam.board;
      if (turdamSource === "image") {
        image = await renderSelectedImage(
          selectedTurdamImage!,
          b.width,
          b.height,
          turdamFit,
        );
      } else {
        const frame = fitArtboard(b, canvasSize.width, canvasSize.height);
        setSelectedIds([]);
        setIsBaking(true);
        setViewport(frame);
        await document.fonts.ready;
        await new Promise((resolve) => setTimeout(resolve, 180));
        image = stageRef.current.toDataURL({
          x: b.x * frame.scale + frame.x,
          y: b.y * frame.scale + frame.y,
          width: b.width * frame.scale,
          height: b.height * frame.scale,
          pixelRatio: 1 / frame.scale,
          mimeType: "image/png",
        });
      }
      if (image.length > 6000000) throw new Error("이미지가 너무 커요");
      window.opener.postMessage(
        { type: "turdam-canvas-result", token: turdam.token, image },
        turdam.origin,
      );
    } catch {
      setTurdamSending(false);
      setTurdamStatus(
        "이미지를 보내지 못했어요. 업로드한 이미지 상태를 확인해 주세요.",
      );
    } finally {
      setIsBaking(false);
      setSelectedIds(keep);
      if (turdamSource === "board") setViewport(previousViewport);
    }
  };

  useEffect(() => {
    if (!turdamSending) return;
    const timer = setTimeout(() => {
      setTurdamSending(false);
      setTurdamStatus(
        "터담 응답이 없어요. 원래 무대 스튜디오가 열려 있는지 확인해 주세요.",
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [turdamSending]);

  // ── 그리기 도우미 — 종류별 JSX를 함수로 빼서 순서대로 한 줄에 그린다 ──
  const inView = (it: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    // 화면 밖은 안 그린다 (성능). 예전 필터와 같은 계산
    const buffer = 100;
    const left = -viewport.x / viewport.scale - buffer;
    const top = -viewport.y / viewport.scale - buffer;
    const right = (canvasSize.width - viewport.x) / viewport.scale + buffer;
    const bottom = (canvasSize.height - viewport.y) / viewport.scale + buffer;
    return !(
      it.x + it.width < left ||
      it.x > right ||
      it.y + it.height < top ||
      it.y > bottom
    );
  };

  const renderImage = (image: PlacedImage) => {
    if (!inView(image)) return null;
    return (
      <CanvasImage
        key={image.id}
        image={image}
        locked={image.locked}
        isSelected={selectedIds.includes(image.id)}
        onSelect={(e) => handleSelect(image.id, e)}
        onChange={(newAttrs) => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === image.id ? { ...img, ...newAttrs } : img,
            ),
          );
        }}
        onDoubleClick={() => {
          if (!image.locked) setCroppingImageId(image.id);
        }}
        onDragStart={() => {
          // 여러 개 선택 중 하나를 끌면 선택 유지, 선택 안 된 걸 끌면 그것만 선택
          let currentSelectedIds = selectedIds;
          if (!selectedIds.includes(image.id)) {
            currentSelectedIds = [image.id];
            setSelectedIds(currentSelectedIds);
          }
          setIsDraggingImage(true);
          const positions = new Map<string, { x: number; y: number }>();
          currentSelectedIds.forEach((id) => {
            const img = images.find((i) => i.id === id);
            if (img) positions.set(id, { x: img.x, y: img.y });
          });
          setDragStartPositions(positions);
        }}
        onDragEnd={() => {
          setIsDraggingImage(false);
          saveToHistory();
          setDragStartPositions(new Map());
        }}
        selectedIds={selectedIds}
        images={images}
        setImages={setImages}
        isDraggingImage={isDraggingImage}
        isCroppingImage={croppingImageId === image.id}
        dragStartPositions={dragStartPositions}
      />
    );
  };

  const renderVideo = (video: PlacedVideo) => {
    if (!inView(video)) return null;
    return (
      <CanvasVideo
        key={video.id}
        video={video}
        isSelected={selectedIds.includes(video.id)}
        onSelect={(e) => handleSelect(video.id, e)}
        onChange={(newAttrs) => {
          setVideos((prev) =>
            prev.map((vid) =>
              vid.id === video.id ? { ...vid, ...newAttrs } : vid,
            ),
          );
        }}
        onDragStart={() => {
          let currentSelectedIds = selectedIds;
          if (!selectedIds.includes(video.id)) {
            currentSelectedIds = [video.id];
            setSelectedIds(currentSelectedIds);
          }
          setIsDraggingImage(true);
          setHiddenVideoControlsIds((prev) => new Set([...prev, video.id]));
          const positions = new Map<string, { x: number; y: number }>();
          currentSelectedIds.forEach((id) => {
            const vid = videos.find((v) => v.id === id);
            if (vid) positions.set(id, { x: vid.x, y: vid.y });
          });
          setDragStartPositions(positions);
        }}
        onDragEnd={() => {
          setIsDraggingImage(false);
          setHiddenVideoControlsIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(video.id);
            return newSet;
          });
          saveToHistory();
          setDragStartPositions(new Map());
        }}
        selectedIds={selectedIds}
        videos={videos}
        setVideos={setVideos}
        isDraggingVideo={isDraggingImage}
        isCroppingVideo={false}
        dragStartPositions={dragStartPositions}
        onResizeStart={() =>
          setHiddenVideoControlsIds((prev) => new Set([...prev, video.id]))
        }
        onResizeEnd={() =>
          setHiddenVideoControlsIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(video.id);
            return newSet;
          })
        }
      />
    );
  };

  const renderShape = (sp: PlacedShape) => (
    <CanvasShape
      key={sp.id}
      item={sp}
      isSelected={selectedIds.includes(sp.id)}
      onSelect={selectFromPanel}
      onChange={(id, patch) =>
        setShapes((prev) =>
          prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        )
      }
      onDragStart={() => saveToHistory()}
      onDragEnd={() => {}}
    />
  );

  const renderText = (t: PlacedText) => (
    <CanvasText
      key={t.id}
      item={t}
      isSelected={selectedIds.includes(t.id)}
      onSelect={selectFromPanel}
      onChange={(id, patch) =>
        setTexts((prev) =>
          prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        )
      }
      onDragStart={() => saveToHistory()}
      onDragEnd={() => {}}
    />
  );

  const handleIsolate = async () => {
    if (!isolateTarget || !isolateInputValue.trim() || isIsolating) {
      return;
    }

    setIsIsolating(true);

    try {
      const image = images.find((img) => img.id === isolateTarget);
      if (!image) {
        setIsIsolating(false);
        return;
      }

      // Show loading state
      toast({
        title: "Processing...",
        description: `Isolating "${isolateInputValue}" from image`,
      });

      // Process the image to get the cropped/processed version
      const imgElement = new window.Image();
      imgElement.crossOrigin = "anonymous"; // Enable CORS
      imgElement.src = image.src;
      await new Promise((resolve) => {
        imgElement.onload = resolve;
      });

      // Create canvas for processing
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      // Get crop values
      const cropX = image.cropX || 0;
      const cropY = image.cropY || 0;
      const cropWidth = image.cropWidth || 1;
      const cropHeight = image.cropHeight || 1;

      // Set canvas size based on crop
      canvas.width = cropWidth * imgElement.naturalWidth;
      canvas.height = cropHeight * imgElement.naturalHeight;

      // Draw cropped image
      ctx.drawImage(
        imgElement,
        cropX * imgElement.naturalWidth,
        cropY * imgElement.naturalHeight,
        cropWidth * imgElement.naturalWidth,
        cropHeight * imgElement.naturalHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // Convert to blob and upload
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png");
      });

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(blob);
      });

      // Upload the processed image
      const uploadResult = await uploadImageDirect(
        dataUrl,
        falClient,
        toast,
        setIsApiKeyDialogOpen,
      );

      // Isolate object using EVF-SAM2
      console.log("Calling isolateObject with:", {
        imageUrl: uploadResult?.url || "",
        textInput: isolateInputValue,
      });

      const result = await isolateObject({
        imageUrl: uploadResult?.url || "",
        textInput: isolateInputValue,
        apiKey: customApiKey || undefined,
      });

      console.log("IsolateObject result:", result);

      // Use the segmented image URL directly (backend already applied the mask)
      if (result.url) {
        console.log("Original image URL:", image.src);
        console.log("New isolated image URL:", result.url);
        console.log("Result object:", JSON.stringify(result, null, 2));

        // AUTO DOWNLOAD FOR DEBUGGING
        try {
          const link = document.createElement("a");
          link.href = result.url;
          link.download = `isolated-${isolateInputValue}-${Date.now()}.png`;
          link.target = "_blank"; // Open in new tab to see the image
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log("Auto-downloaded isolated image for debugging");
        } catch (e) {
          console.error("Failed to auto-download:", e);
        }

        // Force load the new image before updating state
        const testImg = new window.Image();
        testImg.crossOrigin = "anonymous";
        testImg.onload = () => {
          console.log(
            "New image loaded successfully:",
            testImg.width,
            "x",
            testImg.height,
          );

          // Create a test canvas to verify the image has transparency
          const testCanvas = document.createElement("canvas");
          testCanvas.width = testImg.width;
          testCanvas.height = testImg.height;
          const testCtx = testCanvas.getContext("2d");
          if (testCtx) {
            // Fill with red background
            testCtx.fillStyle = "red";
            testCtx.fillRect(0, 0, testCanvas.width, testCanvas.height);
            // Draw the image on top
            testCtx.drawImage(testImg, 0, 0);

            // Get a pixel from what should be transparent area (corner)
            const pixelData = testCtx.getImageData(0, 0, 1, 1).data;
            console.log("Corner pixel (should show red if transparent):", {
              r: pixelData[0],
              g: pixelData[1],
              b: pixelData[2],
              a: pixelData[3],
            });
          }

          // Update the image in place with the segmented image
          saveToHistory();

          // Create a completely new image URL with timestamp
          const newImageUrl = `${result.url}${result.url.includes("?") ? "&" : "?"}t=${Date.now()}&cache=no`;

          // Get the current image to preserve position
          const currentImage = images.find((img) => img.id === isolateTarget);
          if (!currentImage) {
            console.error("Could not find current image!");
            return;
          }

          // Create new image with isolated- prefix ID
          const newImage: PlacedImage = {
            ...currentImage,
            id: `isolated-${Date.now()}-${Math.random()}`,
            src: newImageUrl,
            // Remove crop values since we've applied them
            cropX: undefined,
            cropY: undefined,
            cropWidth: undefined,
            cropHeight: undefined,
          };

          setImages((prev) => {
            // Replace old image with new one at same index
            const newImages = [...prev];
            const index = newImages.findIndex(
              (img) => img.id === isolateTarget,
            );
            if (index !== -1) {
              newImages[index] = newImage;
            }
            return newImages;
          });

          // Update selection
          setSelectedIds([newImage.id]);

          toast({
            title: "Success",
            description: `Isolated "${isolateInputValue}" successfully`,
          });
        };

        testImg.onerror = (e) => {
          console.error("Failed to load new image:", e);
          toast({
            title: "Failed to load isolated image",
            description: "The isolated image could not be loaded",
            variant: "destructive",
          });
        };

        testImg.src = result.url;
      } else {
        toast({
          title: "No object found",
          description: `Could not find "${isolateInputValue}" in the image`,
          variant: "destructive",
        });
      }

      // Reset the isolate input
      setIsolateTarget(null);
      setIsolateInputValue("");
      setIsIsolating(false);
    } catch (error) {
      console.error("Error isolating object:", error);
      toast({
        title: "Failed to isolate object",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setIsolateTarget(null);
      setIsolateInputValue("");
      setIsIsolating(false);
    }
  };

  const handleCombineImages = async () => {
    if (selectedIds.length < 2) return;

    // Save to history before combining
    saveToHistory();

    // Get selected images and sort by layer order
    const selectedImages = selectedIds
      .map((id) => images.find((img) => img.id === id))
      .filter((img) => img !== undefined) as PlacedImage[];

    const sortedImages = [...selectedImages].sort((a, b) => {
      const indexA = images.findIndex((img) => img.id === a.id);
      const indexB = images.findIndex((img) => img.id === b.id);
      return indexA - indexB;
    });

    // Load all images to calculate scale factors
    const imageElements: {
      img: PlacedImage;
      element: HTMLImageElement;
      scale: number;
    }[] = [];
    let maxScale = 1;

    for (const img of sortedImages) {
      const imgElement = new window.Image();
      imgElement.crossOrigin = "anonymous"; // Enable CORS
      imgElement.src = img.src;
      await new Promise((resolve) => {
        imgElement.onload = resolve;
      });

      // Calculate scale factor (original size / display size)
      // Account for crops if they exist
      const effectiveWidth = img.cropWidth
        ? imgElement.naturalWidth * img.cropWidth
        : imgElement.naturalWidth;
      const effectiveHeight = img.cropHeight
        ? imgElement.naturalHeight * img.cropHeight
        : imgElement.naturalHeight;

      const scaleX = effectiveWidth / img.width;
      const scaleY = effectiveHeight / img.height;
      const scale = Math.min(scaleX, scaleY); // Use min to maintain aspect ratio

      maxScale = Math.max(maxScale, scale);
      imageElements.push({ img, element: imgElement, scale });
    }

    // Use a reasonable scale - not too large to avoid memory issues
    const optimalScale = Math.min(maxScale, 4); // Cap at 4x to prevent huge images

    // Calculate bounding box of all selected images
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    sortedImages.forEach((img) => {
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width);
      maxY = Math.max(maxY, img.y + img.height);
    });

    const combinedWidth = maxX - minX;
    const combinedHeight = maxY - minY;

    // Create canvas at higher resolution
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }

    canvas.width = Math.round(combinedWidth * optimalScale);
    canvas.height = Math.round(combinedHeight * optimalScale);

    console.log(
      `Creating combined image at ${canvas.width}x${canvas.height} (scale: ${optimalScale.toFixed(2)}x)`,
    );

    // Draw each image in order using the pre-loaded elements
    for (const { img, element: imgElement } of imageElements) {
      // Calculate position relative to the combined canvas, scaled up
      const relX = (img.x - minX) * optimalScale;
      const relY = (img.y - minY) * optimalScale;
      const scaledWidth = img.width * optimalScale;
      const scaledHeight = img.height * optimalScale;

      ctx.save();

      // Handle rotation if needed
      if (img.rotation) {
        ctx.translate(relX + scaledWidth / 2, relY + scaledHeight / 2);
        ctx.rotate((img.rotation * Math.PI) / 180);
        ctx.drawImage(
          imgElement,
          -scaledWidth / 2,
          -scaledHeight / 2,
          scaledWidth,
          scaledHeight,
        );
      } else {
        // Handle cropping if exists
        if (
          img.cropX !== undefined &&
          img.cropY !== undefined &&
          img.cropWidth !== undefined &&
          img.cropHeight !== undefined
        ) {
          ctx.drawImage(
            imgElement,
            img.cropX * imgElement.naturalWidth,
            img.cropY * imgElement.naturalHeight,
            img.cropWidth * imgElement.naturalWidth,
            img.cropHeight * imgElement.naturalHeight,
            relX,
            relY,
            scaledWidth,
            scaledHeight,
          );
        } else {
          ctx.drawImage(
            imgElement,
            0,
            0,
            imgElement.naturalWidth,
            imgElement.naturalHeight,
            relX,
            relY,
            scaledWidth,
            scaledHeight,
          );
        }
      }

      ctx.restore();
    }

    // Convert to blob and create data URL
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/png");
    });

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(blob);
    });

    // Create new combined image
    const combinedImage: PlacedImage = {
      id: `combined-${Date.now()}-${Math.random()}`,
      src: dataUrl,
      x: minX,
      y: minY,
      width: combinedWidth,
      height: combinedHeight,
      rotation: 0,
    };

    // Remove the original images and add the combined one
    setImages((prev) => [
      ...prev.filter((img) => !selectedIds.includes(img.id)),
      combinedImage,
    ]);

    // Select the new combined image
    setSelectedIds([combinedImage.id]);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is an input element
      const isInputElement =
        e.target && (e.target as HTMLElement).matches("input, textarea");

      // Undo/Redo — 글 입력창 안에서는 글자 되돌리기여야 하므로 캔버스 되돌리기를 건드리지 않는다
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "z" &&
        !e.shiftKey &&
        !isInputElement
      ) {
        e.preventDefault();
        undo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        ((e.key === "z" && e.shiftKey) || e.key === "y") &&
        !isInputElement
      ) {
        e.preventDefault();
        redo();
      }
      // Select all
      else if ((e.metaKey || e.ctrlKey) && e.key === "a" && !isInputElement) {
        e.preventDefault();
        setSelectedIds(
          [...images, ...videos, ...texts, ...shapes, ...notes]
            .filter((i) => !("hidden" in i && i.hidden))
            .map((i) => i.id),
        );
      }
      // Delete
      else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isInputElement
      ) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDelete();
        }
      }
      // Duplicate
      else if ((e.metaKey || e.ctrlKey) && e.key === "d" && !isInputElement) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          handleDuplicate();
        }
      }
      // Run generation
      else if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        !isInputElement
      ) {
        e.preventDefault();
        if (!isGenerating && generationSettings.prompt.trim()) {
          handleRun();
        }
      }
      // Layer ordering shortcuts
      else if (e.key === "]" && !isInputElement) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          if (e.metaKey || e.ctrlKey) {
            sendToFront();
          } else {
            bringForward();
          }
        }
      } else if (e.key === "[" && !isInputElement) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          if (e.metaKey || e.ctrlKey) {
            sendToBack();
          } else {
            sendBackward();
          }
        }
      }
      // Escape to exit crop mode
      else if (e.key === "Escape" && croppingImageId) {
        e.preventDefault();
        setCroppingImageId(null);
      }
      // Zoom in
      else if ((e.key === "+" || e.key === "=") && !isInputElement) {
        e.preventDefault();
        const newScale = Math.min(5, viewport.scale * 1.2);
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;

        const mousePointTo = {
          x: (centerX - viewport.x) / viewport.scale,
          y: (centerY - viewport.y) / viewport.scale,
        };

        setViewport({
          x: centerX - mousePointTo.x * newScale,
          y: centerY - mousePointTo.y * newScale,
          scale: newScale,
        });
      }
      // Zoom out
      else if (e.key === "-" && !isInputElement) {
        e.preventDefault();
        const newScale = Math.max(0.1, viewport.scale / 1.2);
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;

        const mousePointTo = {
          x: (centerX - viewport.x) / viewport.scale,
          y: (centerY - viewport.y) / viewport.scale,
        };

        setViewport({
          x: centerX - mousePointTo.x * newScale,
          y: centerY - mousePointTo.y * newScale,
          scale: newScale,
        });
      }
      // Reset zoom
      else if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setViewport({ x: 0, y: 0, scale: 1 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Currently no key up handlers needed
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    selectedIds,
    images,
    generationSettings,
    undo,
    redo,
    handleDelete,
    handleDuplicate,
    handleRun,
    croppingImageId,
    viewport,
    canvasSize,
    sendToFront,
    sendToBack,
    bringForward,
    sendBackward,
  ]);

  return (
    <div
      className="canvas-workspace bg-background text-foreground font-focal relative flex flex-col w-full overflow-hidden h-screen"
      style={{ height: "100dvh" }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => e.preventDefault()}
      onDragLeave={(e) => e.preventDefault()}
    >
      {turdam && (
        <div
          role="region"
          aria-label="터담 디자인 연결"
          className="studio-turdam"
        >
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <strong className="text-sm">{turdam.name}에 디자인 적용</strong>
              <p className="mt-1 text-xs">
                이미지는 어디에 놓여 있어도 바로 사용할 수 있어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={turdamSource === "image" ? "default" : "outline"}
                  aria-pressed={turdamSource === "image"}
                  onClick={() => {
                    setTurdamSource("image");
                    setArtboard(null);
                  }}
                  disabled={turdamSending}
                >
                  선택한 이미지 사용
                </Button>
                <Button
                  size="sm"
                  variant={turdamSource === "board" ? "default" : "outline"}
                  aria-pressed={turdamSource === "board"}
                  onClick={() => {
                    setTurdamSource("board");
                    setArtboard(turdam.board);
                    setViewport(
                      fitArtboard(
                        turdam.board,
                        canvasSize.width,
                        canvasSize.height,
                      ),
                    );
                  }}
                  disabled={turdamSending}
                >
                  작업판 전체 사용
                </Button>
              </div>
              {turdamSource === "image" ? (
                <label className="mt-2 flex items-center gap-2 text-xs">
                  비율 맞추기
                  <select
                    aria-label="터담 이미지 맞춤"
                    className="rounded-md border bg-white p-1.5"
                    value={turdamFit}
                    disabled={turdamSending}
                    onChange={(e) =>
                      setTurdamFit(e.target.value as "contain" | "cover")
                    }
                  >
                    <option value="contain">전체 보이기 · 여백 허용</option>
                    <option value="cover">꽉 채우기 · 가장자리 잘림</option>
                  </select>
                </label>
              ) : (
                <p className="mt-2 text-xs">
                  작업판 안의 이미지·글자·도형을 함께 적용해요.
                </p>
              )}
            </div>
            {turdamSource === "image" && (
              <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white text-center text-xs text-slate-500">
                {turdamPreview ? (
                  <img
                    src={turdamPreview}
                    alt="터담 적용 미리보기"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  "이미지 한 장을 선택해 주세요"
                )}
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/10 pt-3">
            <p role="status" className="max-w-sm text-xs">
              {turdamStatus}
            </p>
            <div className="flex gap-2">
              {turdamSource === "board" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setArtboard(turdam.board);
                    setViewport(
                      fitArtboard(
                        turdam.board,
                        canvasSize.width,
                        canvasSize.height,
                      ),
                    );
                  }}
                >
                  작업 면 보기
                </Button>
              )}
              <Button
                size="sm"
                className="bg-[#20382c] text-white hover:bg-[#315743]"
                disabled={
                  turdamSending ||
                  isGenerating ||
                  (turdamSource === "image" && !turdamPreview)
                }
                onClick={applyToTurdam}
              >
                {turdamSending ? "적용 중…" : "터담에 적용"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Render streaming components for active generations */}
      {Array.from(activeGenerations.entries()).map(([imageId, generation]) => (
        <StreamingImage
          key={imageId}
          imageId={imageId}
          generation={generation}
          apiKey={customApiKey}
          onStreamingUpdate={(id, url) => {
            setImages((prev) =>
              prev.map((img) => (img.id === id ? { ...img, src: url } : img)),
            );
          }}
          onComplete={(id, finalUrl) => {
            setImages((prev) =>
              prev.map((img) =>
                img.id === id ? { ...img, src: finalUrl } : img,
              ),
            );
            setActiveGenerations((prev) => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
            });
            setIsGenerating(false);

            // Immediately save after generation completes
            setTimeout(() => {
              saveToStorage();
            }, 100); // Small delay to ensure state updates are processed
          }}
          onError={(id, error) => {
            console.error(`Generation error for ${id}:`, error);
            // Remove the failed image
            setImages((prev) => prev.filter((img) => img.id !== id));
            setActiveGenerations((prev) => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
            });
            setIsGenerating(false);
            toast({
              title: "Generation failed",
              description: error.toString(),
              variant: "destructive",
            });
          }}
        />
      ))}

      {/* Main content */}
      <main className="flex-1 relative flex items-center justify-center w-full">
        <div className="relative w-full h-full">
          {/* Gradient Overlays */}
          <div
            className="pointer-events-none absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10"
            aria-hidden="true"
          />
          <ContextMenu
            onOpenChange={(open) => {
              if (!open) {
                // Reset isolate state when context menu closes
                setIsolateTarget(null);
                setIsolateInputValue("");
              }
            }}
          >
            <ContextMenuTrigger asChild>
              <div
                className="relative bg-background overflow-hidden w-full h-full"
                style={{
                  // Use consistent style property names to avoid hydration errors
                  height: `${canvasSize.height}px`,
                  width: `${canvasSize.width}px`,
                  minHeight: `${canvasSize.height}px`,
                  minWidth: `${canvasSize.width}px`,
                  cursor: isPanningCanvas ? "grabbing" : "default",
                  WebkitTouchCallout: "none", // Add this for iOS
                  touchAction: "none", // For touch devices
                }}
              >
                {isCanvasReady && (
                  <Stage
                    ref={stageRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    x={viewport.x}
                    y={viewport.y}
                    scaleX={viewport.scale}
                    scaleY={viewport.scale}
                    draggable={false}
                    onDragStart={(e) => {
                      e.evt?.preventDefault();
                    }}
                    onDragEnd={(e) => {
                      e.evt?.preventDefault();
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => {
                      // Stop panning if mouse leaves the stage
                      if (isPanningCanvas) {
                        setIsPanningCanvas(false);
                      }
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => {
                      // Check if this is a forwarded event from a video overlay
                      const videoId =
                        (e.evt as any)?.videoId || (e as any)?.videoId;
                      if (videoId) {
                        // This is a right-click on a video
                        if (!selectedIds.includes(videoId)) {
                          setSelectedIds([videoId]);
                        }
                        return;
                      }

                      // Get clicked position
                      const stage = e.target.getStage();
                      if (!stage) return;

                      const point = stage.getPointerPosition();
                      if (!point) return;

                      // Convert to canvas coordinates
                      const canvasPoint = {
                        x: (point.x - viewport.x) / viewport.scale,
                        y: (point.y - viewport.y) / viewport.scale,
                      };

                      // Check if we clicked on a video first (check in reverse order for top-most)
                      const clickedVideo = [...videos].reverse().find((vid) => {
                        return (
                          canvasPoint.x >= vid.x &&
                          canvasPoint.x <= vid.x + vid.width &&
                          canvasPoint.y >= vid.y &&
                          canvasPoint.y <= vid.y + vid.height
                        );
                      });

                      if (clickedVideo) {
                        if (!selectedIds.includes(clickedVideo.id)) {
                          setSelectedIds([clickedVideo.id]);
                        }
                        return;
                      }

                      // Check if we clicked on an image (check in reverse order for top-most image)
                      const clickedImage = [...images].reverse().find((img) => {
                        // Simple bounding box check
                        // TODO: Could be improved to handle rotation
                        return (
                          canvasPoint.x >= img.x &&
                          canvasPoint.x <= img.x + img.width &&
                          canvasPoint.y >= img.y &&
                          canvasPoint.y <= img.y + img.height
                        );
                      });

                      if (clickedImage) {
                        if (!selectedIds.includes(clickedImage.id)) {
                          // If clicking on unselected image, select only that image
                          setSelectedIds([clickedImage.id]);
                        }
                        // If already selected, keep current selection for multi-select context menu
                      }
                    }}
                    onWheel={handleWheel}
                  >
                    <Layer>
                      {/* Grid background */}
                      {showGrid && (
                        <CanvasGrid
                          viewport={viewport}
                          canvasSize={canvasSize}
                        />
                      )}

                      {/* Selection box */}
                      <SelectionBoxComponent selectionBox={selectionBox} />

                      {/* 포스터 판 (P2) — 흰 판 + 판 밖은 옅은 회색. 굽는 동안엔 흰 판만 남긴다 */}
                      {artboard && (
                        <>
                          {!isBaking &&
                            (
                              [
                                [-1e6, -1e6, 2e6, 1e6 + artboard.y],
                                [-1e6, artboard.y + artboard.height, 2e6, 1e6],
                                [
                                  -1e6,
                                  artboard.y,
                                  1e6 + artboard.x,
                                  artboard.height,
                                ],
                                [
                                  artboard.x + artboard.width,
                                  artboard.y,
                                  1e6,
                                  artboard.height,
                                ],
                              ] as [number, number, number, number][]
                            ).map(([x, y, w, h], i) => (
                              <Rect
                                key={`ab-dim-${i}`}
                                x={x}
                                y={y}
                                width={w}
                                height={h}
                                fill="rgba(60,60,70,0.10)"
                                listening={false}
                              />
                            ))}
                          <Rect
                            x={artboard.x}
                            y={artboard.y}
                            width={artboard.width}
                            height={artboard.height}
                            fill="#ffffff"
                            stroke={isBaking ? undefined : "#94a3b8"}
                            strokeWidth={isBaking ? 0 : 2 / viewport.scale}
                            listening={false}
                          />
                        </>
                      )}

                      {/* 레이어 — 이미지·영상·도형·글씨를 순서 번호 하나로 한 줄에 그린다 (P1).
                          숨긴 것은 화면에도 결과물에도 안 나온다 */}
                      {orderedLayers.map((entry) => {
                        if (entry.item.hidden) return null;
                        if (entry.kind === "image")
                          return renderImage(entry.item as PlacedImage);
                        if (entry.kind === "video")
                          return renderVideo(entry.item as PlacedVideo);
                        if (entry.kind === "shape")
                          return renderShape(entry.item as PlacedShape);
                        return renderText(entry.item as PlacedText);
                      })}

                      {/* (영상은 위 레이어 루프에서 함께 그린다) */}

                      {/* Crop overlay */}
                      {croppingImageId &&
                        (() => {
                          const croppingImage = images.find(
                            (img) => img.id === croppingImageId,
                          );
                          if (!croppingImage) return null;

                          return (
                            <CropOverlayWrapper
                              image={croppingImage}
                              viewportScale={viewport.scale}
                              onCropChange={(crop) => {
                                setImages((prev) =>
                                  prev.map((img) =>
                                    img.id === croppingImageId
                                      ? { ...img, ...crop }
                                      : img,
                                  ),
                                );
                              }}
                              onCropEnd={async () => {
                                // Apply crop to image dimensions
                                if (croppingImage) {
                                  const cropWidth =
                                    croppingImage.cropWidth || 1;
                                  const cropHeight =
                                    croppingImage.cropHeight || 1;
                                  const cropX = croppingImage.cropX || 0;
                                  const cropY = croppingImage.cropY || 0;

                                  try {
                                    // Create the cropped image at full resolution
                                    const croppedImageSrc =
                                      await createCroppedImage(
                                        croppingImage.src,
                                        cropX,
                                        cropY,
                                        cropWidth,
                                        cropHeight,
                                      );

                                    setImages((prev) =>
                                      prev.map((img) =>
                                        img.id === croppingImageId
                                          ? {
                                              ...img,
                                              // Replace with cropped image
                                              src: croppedImageSrc,
                                              // Update position to the crop area's top-left
                                              x: img.x + cropX * img.width,
                                              y: img.y + cropY * img.height,
                                              // Update dimensions to match crop size
                                              width: cropWidth * img.width,
                                              height: cropHeight * img.height,
                                              // Remove crop values completely
                                              cropX: undefined,
                                              cropY: undefined,
                                              cropWidth: undefined,
                                              cropHeight: undefined,
                                            }
                                          : img,
                                      ),
                                    );
                                  } catch (error) {
                                    console.error(
                                      "Failed to create cropped image:",
                                      error,
                                    );
                                  }
                                }

                                setCroppingImageId(null);
                                saveToHistory();
                              }}
                            />
                          );
                        })()}
                      {/* (도형·글씨는 위 레이어 루프에서 순서대로 그린다 — 더는 이미지 위에 고정이 아니다) */}

                      {/* 메모 — 항상 맨 위, 굽기에서는 제외 */}
                      {!isBaking &&
                        notes.map((n) => (
                          <CanvasNote
                            key={n.id}
                            item={n}
                            isSelected={selectedIds.includes(n.id)}
                            onSelect={(id, additive) =>
                              setSelectedIds((prev) =>
                                additive
                                  ? prev.includes(id)
                                    ? prev.filter((p) => p !== id)
                                    : [...prev, id]
                                  : [id],
                              )
                            }
                            onChange={(id, patch) =>
                              setNotes((prev) =>
                                prev.map((x) =>
                                  x.id === id ? { ...x, ...patch } : x,
                                ),
                              )
                            }
                            hideText={
                              !isDraggingNote &&
                              selectedIds.length === 1 &&
                              selectedIds[0] === n.id
                            }
                            onDragStart={() => {
                              saveToHistory();
                              setIsDraggingNote(true);
                            }}
                            onDragEnd={() => setIsDraggingNote(false)}
                          />
                        ))}
                    </Layer>
                  </Stage>
                )}
                {isCanvasReady && revisionLinksVisible && !isBaking && (
                  <RevisionLinks images={images} viewport={viewport} />
                )}

                {/* 메모 편집 — 메모지 위에 바로 얹는다 (끄는 중엔 숨김) */}
                {(() => {
                  if (isDraggingNote || selectedIds.length !== 1) return null;
                  const nt = notes.find((x) => x.id === selectedIds[0]);
                  if (!nt) return null;
                  return (
                    <NoteInlineEditor
                      item={nt}
                      viewport={viewport}
                      onChange={(patch) =>
                        setNotes((prev) =>
                          prev.map((x) =>
                            x.id === nt.id ? { ...x, ...patch } : x,
                          ),
                        )
                      }
                      onDelete={() => {
                        saveToHistory();
                        setNotes((prev) => prev.filter((x) => x.id !== nt.id));
                        setSelectedIds([]);
                      }}
                      onClose={() => setSelectedIds([])}
                    />
                  );
                })()}
              </div>
            </ContextMenuTrigger>
            <CanvasContextMenu
              selectedIds={selectedIds}
              images={images}
              videos={videos}
              isolateInputValue={isolateInputValue}
              isIsolating={isIsolating}
              handleDuplicate={handleDuplicate}
              handleRemoveBackground={handleRemoveBackground}
              handleCombineImages={handleCombineImages}
              handleDelete={handleDelete}
              handleIsolate={handleIsolate}
              handleConvertToVideo={handleConvertToVideo}
              handleVideoToVideo={handleVideoToVideo}
              handleExtendVideo={handleExtendVideo}
              handleRemoveVideoBackground={handleRemoveVideoBackground}
              setCroppingImageId={setCroppingImageId}
              setIsolateInputValue={setIsolateInputValue}
              setIsolateTarget={setIsolateTarget}
              onEditAction={handleEditAction}
              sendToFront={sendToFront}
              sendToBack={sendToBack}
              bringForward={bringForward}
              sendBackward={sendBackward}
            />
          </ContextMenu>

          <div className="absolute top-32 left-4 z-20 flex flex-col items-start gap-2">
            {/* Mobile tool icons - animated based on selection */}
            <MobileToolbar
              selectedIds={selectedIds}
              images={images}
              isGenerating={isGenerating}
              generationSettings={generationSettings}
              handleRun={handleRun}
              handleDuplicate={handleDuplicate}
              handleRemoveBackground={handleRemoveBackground}
              handleCombineImages={handleCombineImages}
              handleDelete={handleDelete}
              setCroppingImageId={setCroppingImageId}
              sendToFront={sendToFront}
              sendToBack={sendToBack}
              bringForward={bringForward}
              sendBackward={sendBackward}
            />
          </div>

          <div
            className="studio-composer"
            role="region"
            aria-label="이미지 생성 설정"
          >
            <nav className="studio-nav" aria-label="작업 종류">
              <button
                aria-current="page"
                onClick={() =>
                  document.getElementById("studio-prompt")?.focus()
                }
              >
                이미지 만들기
              </button>
              <button
                onClick={() => {
                  setVideoMode(true);
                  setWorkbenchOpen(true);
                }}
              >
                동영상 만들기
              </button>
              <button onClick={openFilePicker}>이미지 가져오기</button>
              <button
                onClick={() => {
                  setCardnewsMounted(true);
                  setCardnewsStudioOpen(true);
                }}
              >
                카드뉴스 만들기
              </button>
              <button onClick={() => setMapStudioOpen(true)}>
                지도 만들기
              </button>
            </nav>
            <div className="studio-section-title">
              <span>이미지 만들기</span>
              <small>생각을 한 장의 이미지로</small>
            </div>
            <div
              className={cn(
                "studio-composer-body bg-card",
                "dark:shadow-none dark:outline dark:outline-1 dark:outline-border",
              )}
            >
              <div className="flex flex-col gap-3 px-3 md:px-3 py-2 md:py-3 relative">
                {/* Active generations indicator */}
                <AnimatePresence mode="wait">
                  {(activeGenerations.size > 0 ||
                    activeVideoGenerations.size > 0 ||
                    isGenerating ||
                    isRemovingVideoBackground ||
                    isIsolating ||
                    isExtendingVideo ||
                    isTransformingVideo ||
                    showSuccess) && (
                    <motion.div
                      key={showSuccess ? "success" : "generating"}
                      initial={{ opacity: 0, y: -10, scale: 0.9, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                      exit={{ opacity: 0, y: -10, scale: 0.9, x: "-50%" }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className={cn(
                        "fixed z-50 top-20 left-1/2",
                        "rounded-xl",
                        showSuccess
                          ? "shadow-[0_0_0_1px_rgba(34,197,94,0.2),0_4px_8px_-0.5px_rgba(34,197,94,0.08),0_8px_16px_-2px_rgba(34,197,94,0.04)] dark:shadow-none dark:border dark:border-green-500/30"
                          : activeVideoGenerations.size > 0 ||
                              isRemovingVideoBackground ||
                              isExtendingVideo ||
                              isTransformingVideo
                            ? "shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_4px_8px_-0.5px_rgba(168,85,247,0.08),0_8px_16px_-2px_rgba(168,85,247,0.04)] dark:shadow-none dark:border dark:border-purple-500/30"
                            : "shadow-[0_0_0_1px_rgba(236,6,72,0.2),0_4px_8px_-0.5px_rgba(236,6,72,0.08),0_8px_16px_-2px_rgba(236,6,72,0.04)] dark:shadow-none dark:border dark:border-[#EC0648]/30",
                      )}
                    >
                      <GenerationsIndicator
                        isAnimating={!showSuccess}
                        isSuccess={showSuccess}
                        className="w-5 h-5"
                        activeGenerationsSize={
                          activeGenerations.size +
                          activeVideoGenerations.size +
                          (isGenerating ? 1 : 0) +
                          (isRemovingVideoBackground ? 1 : 0) +
                          (isIsolating ? 1 : 0) +
                          (isExtendingVideo ? 1 : 0) +
                          (isTransformingVideo ? 1 : 0)
                        }
                        outputType={
                          activeVideoGenerations.size > 0 ||
                          isRemovingVideoBackground ||
                          isExtendingVideo ||
                          isTransformingVideo
                            ? "video"
                            : "image"
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons row */}
                <div
                  className={
                    selectedIds.some(
                      (id) =>
                        texts.some((t) => t.id === id) ||
                        shapes.some((s) => s.id === id),
                    )
                      ? "studio-properties"
                      : ""
                  }
                >
                  {(() => {
                    const sp = shapes.find((x) => selectedIds.includes(x.id));
                    if (sp)
                      return (
                        <ShapeToolbar
                          item={sp}
                          onChange={(patch) =>
                            setShapes((prev) =>
                              prev.map((x) =>
                                x.id === sp.id ? { ...x, ...patch } : x,
                              ),
                            )
                          }
                          onDelete={() => {
                            saveToHistory();
                            setShapes((prev) =>
                              prev.filter((x) => x.id !== sp.id),
                            );
                            setSelectedIds([]);
                          }}
                        />
                      );
                    // 메모는 하단 바가 아니라 메모지 위에서 바로 고친다 (NoteInlineEditor)
                    return null;
                  })()}

                  {(() => {
                    const sel = texts.find((t) => selectedIds.includes(t.id));
                    return sel ? (
                      <TextToolbar
                        item={sel}
                        onChange={(patch) =>
                          setTexts((prev) =>
                            prev.map((t) =>
                              t.id === sel.id ? { ...t, ...patch } : t,
                            ),
                          )
                        }
                        onDelete={() => {
                          saveToHistory();
                          setTexts((prev) =>
                            prev.filter((t) => t.id !== sel.id),
                          );
                          setSelectedIds([]);
                        }}
                      />
                    ) : null;
                  })()}
                </div>
                <label
                  htmlFor="studio-prompt"
                  className="text-sm font-semibold"
                >
                  어떤 이미지를 만들까요?
                </label>
                <div className="relative">
                  <Textarea
                    id="studio-prompt"
                    disabled={!extrasLoaded}
                    value={generationSettings.prompt}
                    onChange={(e) =>
                      setGenerationSettings({
                        ...generationSettings,
                        prompt: e.target.value,
                      })
                    }
                    // OS 분기를 아예 안 쓴다 — 서버는 브라우저의 OS를 모르니 ⌘로 렌더하고
                    // 윈도우 브라우저는 Ctrl로 렌더해서 하이드레이션이 깨졌다. 둘 다 적으면 안 갈린다.
                    placeholder="프롬프트를 입력하세요… (Ctrl/⌘+Enter 실행)"
                    className="w-full h-36 resize-none rounded-xl border p-3 pr-14"
                    style={{ fontSize: "16px" }}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (!isGenerating && generationSettings.prompt.trim()) {
                          handleRun();
                        }
                      }
                    }}
                  />

                  {selectedIds.length > 0 && (
                    <div className="absolute top-1 right-2 flex items-center justify-end">
                      <div className="relative h-12 w-20">
                        {selectedIds.slice(0, 3).map((id, index) => {
                          const image = images.find((img) => img.id === id);
                          if (!image) return null;

                          const isLast =
                            index === Math.min(selectedIds.length - 1, 2);
                          const offset = index * 8;
                          // Make each card progressively smaller
                          const size = 40 - index * 4;
                          const topOffset = index * 2; // Offset from top to maintain visual alignment

                          return (
                            <div
                              key={id}
                              className="absolute rounded-lg border border-border/20 bg-background overflow-hidden"
                              style={{
                                right: `${offset}px`,
                                top: `${topOffset}px`,
                                zIndex: 3 - index,
                                width: `${size}px`,
                                height: `${size}px`,
                              }}
                            >
                              <img
                                src={image.src}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {/* Show count on last visible card if more than 3 selected */}
                              {isLast && selectedIds.length > 3 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <span className="text-white text-xs font-medium">
                                    +{selectedIds.length - 3}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {showingPriorBrief && suggestedBrief && (
                  <label className="block rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={inheritReferencePrompt}
                        onChange={(e) =>
                          setInheritReferencePrompt(e.target.checked)
                        }
                      />
                      이전 작업 주제 이어가기
                    </span>
                    <span className="mt-1 block text-muted-foreground line-clamp-2">
                      {suggestedBrief}
                    </span>
                  </label>
                )}
                {generationError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900"
                  >
                    <strong>생성 실패</strong>
                    <p className="mt-1 break-all">{generationError}</p>
                  </div>
                )}

                <details className="studio-prompt-guide">
                  <summary>문구·참조 세부 지시</summary>
                  <label>
                    이미지에 넣을 정확한 문구
                    <textarea
                      aria-label="이미지에 넣을 정확한 문구"
                      value={exactCopy}
                      onChange={(e) => setExactCopy(e.target.value)}
                      placeholder="예: 가을밤, 국악과 만나다"
                    />
                  </label>
                  <label>
                    참조에서 유지할 특징
                    <textarea
                      aria-label="참조에서 유지할 특징"
                      value={referenceKeep}
                      onChange={(e) => setReferenceKeep(e.target.value)}
                      placeholder="예: 인물의 얼굴, 의상과 로고 색상"
                    />
                  </label>
                  {images.some((image) => selectedIds.includes(image.id)) && (
                    <label>
                      참조 이미지 사용 방식
                      <select
                        aria-label="참조 이미지 사용 방식"
                        value={referenceMode}
                        onChange={(e) =>
                          setReferenceMode(
                            e.target.value as "style" | "content",
                          )
                        }
                      >
                        <option value="style">느낌만 참조 · 글자 제외</option>
                        <option value="content">내용과 형태 유지</option>
                      </select>
                    </label>
                  )}
                  <p>
                    캔버스에서 이미지를 선택하면 참조로 씁니다. 느낌만 참조할
                    때는 이미지 속 글자를 읽을 수 없게 낮은 해상도로 전달합니다.
                  </p>
                </details>
                <div
                  className="px-1 pb-2 text-xs text-muted-foreground"
                  role="status"
                >
                  출력 크기 · {imageSize.replace("x", " × ")}px
                  {artboard &&
                    Math.abs(
                      artboard.width / artboard.height -
                        Number(imageSize.split("x")[0]) /
                          Number(imageSize.split("x")[1]),
                    ) > 0.02 && (
                      <span className="ml-2 text-amber-700">
                        작업판과 비율이 달라요 · 적용할 때 맞춤 방식을
                        선택하세요
                      </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={isEnhancing || !generationSettings.prompt.trim()}
                    onClick={enhancePrompt}
                    title="대충 쓴 문장을 구체적인 묘사로 바꿔줍니다"
                  >
                    {isEnhancing ? "다듬는 중…" : "✨ 프롬프트 다듬기"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setCampaignRequest(generationSettings.prompt);
                      setCampaignOpen(true);
                    }}
                    title="한 줄 요청을 로고·포스터·배너 등으로 쪼개 한 번에 만듭니다"
                  >
                    🎯 캠페인 한 번에
                  </Button>
                  {promptBeforeEnhance !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setGenerationSettings((prev) => ({
                          ...prev,
                          prompt: promptBeforeEnhance,
                        }));
                        setPromptBeforeEnhance(null);
                      }}
                    >
                      ↩ 되돌리기
                    </Button>
                  )}
                  <Select
                    value={providerId}
                    onValueChange={(v) => setProviderId(v as ProviderId)}
                  >
                    <SelectTrigger className="h-7 w-[104px] text-xs">
                      <SelectValue placeholder="OpenAI" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-1.5">
                            <span
                              className={
                                p.configured
                                  ? "text-green-600"
                                  : "text-muted-foreground"
                              }
                            >
                              ●
                            </span>
                            {p.label.split(" (")[0]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {providerId === "openai" && (
                    <Select value={openaiModel} onValueChange={setOpenaiModel}>
                      <SelectTrigger
                        className="h-7 w-[150px] text-xs"
                        title="생성 모델. 부분수정·글자수정·전개는 2.5 Sunburst로 항상 처리"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENAI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {providerId === "gemini" && (
                    <Select value={geminiModel} onValueChange={setGeminiModel}>
                      <SelectTrigger className="h-7 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GEMINI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <fieldset
                    className="flex flex-wrap gap-1 w-full"
                    aria-label="이미지 비율"
                  >
                    <legend className="text-xs mb-1">비율</legend>
                    {[
                      ["정사각", "1024x1024"],
                      ["가로 16:9", "1536x864"],
                      ["세로 9:16", "864x1536"],
                      ["가로 3:2", "1536x1024"],
                      ["세로 2:3", "1024x1536"],
                      ["현수막 3:1", "2880x960"],
                      ["A4 세로", "1760x2480"],
                      ["A4 가로", "2480x1760"],
                    ].map(([label, value]) => {
                      const [w, h] = imageSize.split("x").map(Number),
                        [pw, ph] = value.split("x").map(Number);
                      return (
                        <button
                          key={value}
                          type="button"
                          className="rounded border px-2 py-1 text-xs aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                          aria-pressed={Math.abs(w / h - pw / ph) < 0.02}
                          onClick={() => setImageSize(value)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </fieldset>
                  <details className="w-full">
                    <summary className="cursor-pointer text-xs py-2">
                      세부 설정 · 해상도
                    </summary>
                    <p className="text-xs text-muted-foreground mb-2">
                      현재 {imageSize.replace("x", " × ")}px · 비율을 유지하며
                      크기를 바꿔요.
                    </p>
                    <div className="flex gap-2">
                      {[
                        ["기본", 1_327_104],
                        ["고해상도", 4_000_000],
                      ].map(([label, pixels]) => (
                        <button
                          key={label}
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => {
                            const [w, h] = imageSize.split("x").map(Number);
                            const scale = Math.sqrt(Number(pixels) / (w * h));
                            const result = normalizeSize(w * scale, h * scale);
                            if ("value" in result) setImageSize(result.value);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => setCustomSizeOpen(true)}
                      >
                        직접 입력…
                      </button>
                    </div>
                  </details>
                  {providerId === "openai" && (
                    <label className="studio-variants">
                      시안 수
                      <select
                        aria-label="시안 수"
                        value={variantCount}
                        onChange={(e) =>
                          setVariantCount(Number(e.target.value))
                        }
                      >
                        <option value={1}>1장</option>
                        <option value={2}>2장 비교</option>
                        <option value={3}>3장 비교</option>
                        <option value={4}>4장 비교</option>
                      </select>
                      {variantCount > 1 && (
                        <small>장수에 따라 비용이 늘어요</small>
                      )}
                      {promptImageCount &&
                        promptImageCount !== variantCount && (
                          <small>
                            입력 문구대로 실제 {promptImageCount}장을 생성해요
                          </small>
                        )}
                    </label>
                  )}
                  <Select value={imageQuality} onValueChange={setImageQuality}>
                    <SelectTrigger className="h-7 w-[86px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">고품질</SelectItem>
                      <SelectItem value="medium">중간</SelectItem>
                      <SelectItem value="low">저품질</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={transparentBg ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 text-xs",
                      transparentBg &&
                        "ring-1 ring-blue-400/60 text-blue-600 dark:text-blue-400",
                    )}
                    disabled={!provider.caps.transparent}
                    onClick={() => setTransparentBg((v) => !v)}
                    title={
                      provider.caps.transparent
                        ? "배경 없이 요소만 그린 PNG로 생성 (로고·캐릭터·오려 쓸 요소용)"
                        : `${provider.label}는 투명 배경을 지원하지 않습니다`
                    }
                  >
                    {transparentBg ? "☑ 투명 배경" : "☐ 투명 배경"}
                  </Button>
                </div>

                {/* Style dropdown and Run button */}
                <div className="flex items-center justify-between gap-2">
                  {/* Style selector button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex h-8 min-w-0 shrink items-center gap-1.5"
                    onClick={() => setIsStyleDialogOpen(true)}
                  >
                    {(() => {
                      if (generationSettings.styleId === "custom") {
                        return (
                          <>
                            <div className="w-4 h-4 flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate text-xs">
                              스타일 선택
                            </span>
                          </>
                        );
                      }
                      const selectedModel =
                        styleModels.find(
                          (m) => m.id === generationSettings.styleId,
                        ) || styleModels.find((m) => m.id === "simpsons");
                      return (
                        <>
                          <img
                            src={selectedModel?.imageSrc}
                            alt={selectedModel?.name}
                            className="w-4 h-4 rounded-md object-cover"
                          />
                          <span className="truncate text-xs">
                            {selectedModel?.name || "스타일 선택"}
                          </span>
                        </>
                      );
                    })()}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    {/* Attachment button */}
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="border-none"
                            onClick={() => {
                              // Create file input with better mobile support
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*,.md,.txt,.pdf";
                              input.multiple = true;

                              // Add to DOM for mobile compatibility
                              input.style.position = "fixed";
                              input.style.top = "-1000px";
                              input.style.left = "-1000px";
                              input.style.opacity = "0";
                              input.style.pointerEvents = "none";
                              input.style.width = "1px";
                              input.style.height = "1px";

                              // Add event handlers
                              input.onchange = (e) => {
                                try {
                                  handleFileUpload(
                                    (e.target as HTMLInputElement).files,
                                  );
                                } catch (error) {
                                  console.error("File upload error:", error);
                                  toast({
                                    title: "Upload failed",
                                    description:
                                      "Failed to process selected files",
                                    variant: "destructive",
                                  });
                                } finally {
                                  // Clean up
                                  if (input.parentNode) {
                                    document.body.removeChild(input);
                                  }
                                }
                              };

                              input.onerror = () => {
                                console.error("File input error");
                                if (input.parentNode) {
                                  document.body.removeChild(input);
                                }
                              };

                              // Add to DOM and trigger
                              document.body.appendChild(input);

                              // Use setTimeout to ensure the input is properly attached
                              setTimeout(() => {
                                try {
                                  input.click();
                                } catch (error) {
                                  console.error(
                                    "Failed to trigger file dialog:",
                                    error,
                                  );
                                  toast({
                                    title: "Upload unavailable",
                                    description:
                                      "File upload is not available. Try using drag & drop instead.",
                                    variant: "destructive",
                                  });
                                  if (input.parentNode) {
                                    document.body.removeChild(input);
                                  }
                                }
                              }, 10);

                              // Cleanup after timeout in case dialog was cancelled
                              setTimeout(() => {
                                if (input.parentNode) {
                                  document.body.removeChild(input);
                                }
                              }, 30000); // 30 second cleanup
                            }}
                            title="이미지·제안서 업로드"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>업로드 (이미지·md·PDF)</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Run button */}
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleRun}
                            variant="primary"
                            size="sm"
                            disabled={
                              isGenerating || !generationSettings.prompt.trim()
                            }
                            className={cn(
                              "studio-generate gap-2 font-medium transition-all",
                              isGenerating && "bg-secondary",
                            )}
                          >
                            {isGenerating ? (
                              <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                            ) : (
                              <PlayIcon className="h-4 w-4 text-white fill-white" />
                            )}
                            {isGenerating ? "만드는 중…" : "이미지 생성"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="flex items-center gap-2">
                            <span>실행</span>
                            <ShortcutBadge
                              variant="default"
                              size="xs"
                              shortcut={
                                checkOS("Win") || checkOS("Linux")
                                  ? "ctrl+enter"
                                  : "meta+enter"
                              }
                            />
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini-map */}
          {showMinimap && (
            <MiniMap
              images={images}
              videos={videos}
              viewport={viewport}
              canvasSize={canvasSize}
            />
          )}

          {isStorageLoaded && (
            <div
              role="status"
              className={`fixed bottom-3 right-4 z-30 rounded-lg border bg-white/95 px-3 py-1 text-xs ${saveError ? "text-red-700" : "text-slate-500"}`}
            >
              {saveError
                ? "자동 저장 실패 · 창을 닫기 전 보드에 저장해 주세요"
                : isSaving
                  ? "저장 중…"
                  : "이 브라우저에 자동 저장됨"}
            </div>
          )}

          {/* Zoom controls */}
          <ZoomControls
            viewport={viewport}
            setViewport={setViewport}
            canvasSize={canvasSize}
          />

          {/* 앱 로고 */}
          <header className="studio-header">
            <StudioWorkbench
              videoMode={videoMode}
              open={workbenchOpen}
              onClose={() => setWorkbenchOpen(false)}
              project={{
                images,
                videos,
                texts,
                shapes,
                notes,
                viewport,
                artboard,
                extras: {
                  ...studioExtras,
                  settings: {
                    prompt: generationSettings.prompt,
                    provider: providerId,
                    model: providerId === "gemini" ? geminiModel : openaiModel,
                    size: imageSize,
                    quality: imageQuality,
                  },
                },
              }}
              selectedIds={selectedIds}
              boardId={boardId}
              boardName={boardName}
              onApply={(p: StudioProject, detach?: boolean) => {
                if (detach) {
                  setBoardId(null);
                  setBoardName("");
                  setBoardUpdatedAt(undefined);
                  setSelectedIds([]);
                }
                saveToHistory();
                setImages(p.images);
                setVideos(p.videos);
                setTexts(p.texts);
                setShapes(p.shapes);
                setNotes(p.notes);
                setViewport(p.viewport);
                setArtboard(p.artboard);
                setStudioExtras(p.extras);
                setGenerationSettings((s) => ({
                  ...s,
                  prompt: p.extras.settings.prompt,
                }));
                setImageSize(p.extras.settings.size);
                setImageQuality(p.extras.settings.quality);
                if (
                  ["openai", "gemini", "grok"].includes(
                    p.extras.settings.provider,
                  )
                )
                  setProviderId(p.extras.settings.provider as ProviderId);
                if (p.extras.settings.provider === "gemini")
                  setGeminiModel(p.extras.settings.model);
                else if (p.extras.settings.model)
                  setOpenaiModel(p.extras.settings.model);
              }}
            />
            <img
              src="/logo-small.png"
              alt="곰곰 캔버스"
              className="h-6 w-6 rounded-lg"
            />
            <span className="text-sm font-semibold">곰곰 캔버스</span>
            <div className="ml-1 h-4 w-px bg-border" />
            <button
              onClick={() => setBoardOpen(true)}
              className="max-w-[180px] truncate rounded-lg px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
              title="보드 저장·열기 (프로젝트 전환)"
            >
              {boardId ? `📋 ${boardName}` : "📋 보드 저장·열기"}
            </button>
            <div className="studio-header-undo">
              <button
                title="실행취소"
                aria-label="실행취소"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo size={17} />
              </button>
              <button
                title="다시실행"
                aria-label="다시실행"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo size={17} />
              </button>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => {
                setVideoMode(false);
                setWorkbenchOpen(true);
              }}
            >
              작업 관리
            </button>
            <button
              onClick={() => {
                setLayersOpen((v) => !v);
                setHistoryOpen(false);
              }}
              aria-pressed={layersOpen}
            >
              레이어
            </button>
            {selectedIds.length > 0 && (
              <>
                <div className="mx-0.5 h-4 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    downloadImagesAsZip(
                      images.filter((img) => selectedIds.includes(img.id)),
                    )
                  }
                >
                  ⬇ ZIP ({selectedIds.length})
                </Button>
              </>
            )}
            {selectedIds.length === 1 &&
              images.some((i) => i.id === selectedIds[0]) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      ✏️ 이 이미지 수정 ▾
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(texts.length > 0 || shapes.length > 0) && (
                      <>
                        <DropdownMenuItem onClick={bakeTextIntoImage}>
                          🔥 합치기 — 얹은 글자·도형을 이미지로 굽기
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => openMaskEdit("brush")}>
                      🖌 부분수정 — 고칠 부분 칠하기
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openMaskEdit("point")}>
                      📍 포인트수정 — 고칠 것 콕 찍기
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openMaskEdit("text")}>
                      ✏️ 글자수정 — 글자 칠하고 새 문구
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={removeBgForSelected}>
                      ✂️ 배경 제거 — OpenAI
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={cutoutForSelected}>
                      무료 배경 제거 — 원본 보존
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => runExpandFor("1536x1024")}>
                      ↔ 가로로 전개 (현수막·배너)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => runExpandFor("1024x1536")}>
                      ↕ 세로로 전개 (스토리·배너)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => runExpandFor("1024x1024")}>
                      ⬜ 정사각 전개 (SNS 피드)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setCardnewsOpen(true)}>
                      🗂 카드뉴스 — 표지 스타일로 페이지 생성
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            <button
              onClick={() => {
                setHistoryOpen((v) => !v);
                setLayersOpen(false);
              }}
              aria-pressed={historyOpen}
            >
              생성 이력
            </button>
            <button
              onClick={() => setRevisionLinksVisible((v) => !v)}
              aria-pressed={revisionLinksVisible}
            >
              수정 이력 {revisionLinksVisible ? "숨기기" : "보기"}
            </button>
            <WorkBundles
              content={{
                images: images.filter((i) => selectedIds.includes(i.id)),
                texts: texts.filter((i) => selectedIds.includes(i.id)),
                shapes: shapes.filter((i) => selectedIds.includes(i.id)),
                notes: notes.filter((i) => selectedIds.includes(i.id)),
                videos: videos.filter((i) => selectedIds.includes(i.id)),
              }}
              onInsert={async (source) => {
                const topZ = Math.max(
                  0,
                  ...[...images, ...texts, ...shapes, ...videos].map(
                    (i) => i.z ?? 0,
                  ),
                );
                const bundle = copyBundle(
                  source,
                  (canvasSize.width / 2 - viewport.x) / viewport.scale,
                  (canvasSize.height / 2 - viewport.y) / viewport.scale,
                  topZ,
                );
                for (const item of bundle.images)
                  await canvasStorage.saveImage(item.src, item.id);
                for (const item of bundle.videos)
                  await canvasStorage.saveVideo(
                    item.src,
                    item.duration,
                    item.id,
                  );
                saveToHistory();
                setImages((prev) => [...prev, ...bundle.images]);
                setTexts((prev) => [...prev, ...bundle.texts]);
                setShapes((prev) => [...prev, ...bundle.shapes]);
                setNotes((prev) => [...prev, ...bundle.notes]);
                setVideos((prev) => [...prev, ...bundle.videos]);
                setSelectedIds(
                  [
                    ...bundle.images,
                    ...bundle.texts,
                    ...bundle.shapes,
                    ...bundle.notes,
                    ...bundle.videos,
                  ].map((i) => i.id),
                );
                toast({
                  title: "작업 묶음을 복제했어요",
                  description:
                    "원본과 별도로 문구와 이미지를 수정할 수 있어요.",
                });
              }}
            />
            <CompanyAssets
              onInsert={async ({
                src,
                width: originalWidth,
                height: originalHeight,
                name,
              }) => {
                const scale = Math.min(
                  400 / originalWidth,
                  300 / originalHeight,
                  1,
                );
                const width = originalWidth * scale,
                  height = originalHeight * scale;
                const id = `ci-${crypto.randomUUID()}`;
                await canvasStorage.saveImage(src, id);
                saveToHistory();
                const z =
                  Math.max(
                    0,
                    ...images.map((i) => i.z || 0),
                    ...shapes.map((i) => i.z || 0),
                    ...texts.map((i) => i.z || 0),
                    ...videos.map((i) => i.z || 0),
                  ) + 1;
                setImages((prev) => [
                  ...prev,
                  {
                    id,
                    src,
                    width,
                    height,
                    rotation: 0,
                    z,
                    promptHint: name,
                    x:
                      (canvasSize.width / 2 - viewport.x) / viewport.scale -
                      width / 2,
                    y:
                      (canvasSize.height / 2 - viewport.y) / viewport.scale -
                      height / 2,
                  },
                ]);
                setSelectedIds([id]);
                toast({ title: "예술숲 CI를 넣었어요" });
              }}
            />
            <button onClick={() => setArtboardOpen(true)}>
              작업판·내보내기
            </button>
            <button
              onClick={() => setUsageOpen((v) => !v)}
              aria-expanded={usageOpen}
            >
              사용량
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="작업 설정">
                  <SlidersHorizontal size={16} />
                  <span>설정</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                >
                  {resolvedTheme === "dark"
                    ? "밝은 화면으로"
                    : "어두운 화면으로"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMinimap((v) => !v)}>
                  {showMinimap ? "미니맵 숨기기" : "미니맵 표시"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSettingsDialogOpen(true)}>
                  API·화면 설정
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={async () => {
                    if (
                      !confirm(
                        "캔버스를 비울까요? 캔버스 위 이미지와 저장된 상태가 모두 지워집니다. (생성 이력은 남습니다)",
                      )
                    )
                      return;
                    await canvasStorage.clearAll();
                    setImages([]);
                    setVideos([]);
                    setTexts([]);
                    setShapes([]);
                    setNotes([]);
                    setSelectedIds([]);
                    setHistory([]);
                    setHistoryIndex(-1);
                    setViewport({ x: 0, y: 0, scale: 1 });
                    toast({
                      title: "캔버스를 비웠어요",
                      description: "저장된 캔버스 상태도 함께 지웠습니다",
                    });
                  }}
                >
                  캔버스 초기화
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          {cardnewsMounted && (
            <CardnewsStudio
              open={cardnewsStudioOpen}
              onClose={() => setCardnewsStudioOpen(false)}
              images={images}
              onImport={async (deck: CardDeck) => {
                const right = Math.max(
                  0,
                  ...images.map((i) => i.x + i.width),
                  ...shapes.map((s) => s.x + s.width),
                  ...texts.map((t) => t.x + 1000),
                );
                const startX = right + 160;
                const topZ =
                  Math.max(
                    0,
                    ...images.map((i) => i.z || 0),
                    ...shapes.map((i) => i.z || 0),
                    ...texts.map((i) => i.z || 0),
                    ...videos.map((i) => i.z || 0),
                  ) + 1;
                const layers: Awaited<ReturnType<typeof cardLayers>>[] = [];
                for (let i = 0; i < deck.cards.length; i++)
                  layers.push(
                    await cardLayers(
                      deck.cards[i],
                      i + 1,
                      deck.cards.length,
                      startX + i * (CARD_W + 100),
                      0,
                      topZ + i * 1000,
                    ),
                  );
                saveToHistory();
                const addedImages = layers.flatMap((l) => l.images);
                for (const im of addedImages)
                  await canvasStorage.saveImage(im.src, im.id);
                setImages((prev) => [...prev, ...addedImages]);
                setShapes((prev) => [
                  ...prev,
                  ...layers.flatMap((l) => l.shapes),
                ]);
                setTexts((prev) => [
                  ...prev,
                  ...layers.flatMap((l) => l.texts),
                ]);
                setSelectedIds([]);
                const scale = Math.min(
                  (canvasSize.height - 160) / CARD_H,
                  (canvasSize.width - 220) / CARD_W,
                  1,
                );
                setViewport({
                  x: 100 - startX * scale,
                  y: 80,
                  scale: Math.max(0.05, scale),
                });
              }}
            />
          )}
          <MapStudio
            open={mapStudioOpen}
            onClose={() => setMapStudioOpen(false)}
            onImport={async (blob, name) => {
              const src = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () =>
                  reject(new Error("지도 이미지를 읽지 못했어요."));
                reader.readAsDataURL(blob);
              });
              const dimensions = await new Promise<{
                width: number;
                height: number;
              }>((resolve, reject) => {
                const image = new window.Image();
                image.onload = () =>
                  resolve({
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  });
                image.onerror = () =>
                  reject(new Error("지도 이미지를 열지 못했어요."));
                image.src = src;
              });
              const scale = Math.min(
                800 / dimensions.width,
                650 / dimensions.height,
                1,
              );
              const width = dimensions.width * scale,
                height = dimensions.height * scale;
              const id = `map-${crypto.randomUUID()}`;
              await canvasStorage.saveImage(src, id);
              saveToHistory();
              const z =
                Math.max(
                  0,
                  ...images.map((i) => i.z || 0),
                  ...shapes.map((i) => i.z || 0),
                  ...texts.map((i) => i.z || 0),
                  ...videos.map((i) => i.z || 0),
                ) + 1;
              setImages((prev) => [
                ...prev,
                {
                  id,
                  src,
                  width,
                  height,
                  rotation: 0,
                  z,
                  promptHint: name,
                  x:
                    (canvasSize.width / 2 - viewport.x) / viewport.scale -
                    width / 2,
                  y:
                    (canvasSize.height / 2 - viewport.y) / viewport.scale -
                    height / 2,
                },
              ]);
              setSelectedIds([id]);
              toast({ title: "지도를 캔버스에 넣었어요" });
            }}
          />
          {!turdam &&
            selectedIds.length === 1 &&
            images.some(
              (i) =>
                i.id === selectedIds[0] && i.src !== generationPlaceholderSrc,
            ) && (
              <div className="studio-properties">
                <h2>선택한 이미지</h2>
                <p>고칠 부분과 출력 방식을 선택하세요.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMaskEdit("brush")}
                  >
                    부분 수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMaskEdit("text")}
                  >
                    글자 수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isGenerating}
                    title="OpenAI로 배경을 제거해요. API 비용이 발생하며 결과는 원본 옆에 추가돼요."
                    onClick={removeBgForSelected}
                  >
                    배경 제거 · OpenAI
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runExpandFor("1536x864")}
                  >
                    가로로 확장
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadImagesAsZip(
                      images.filter((i) => selectedIds.includes(i.id)),
                    )
                  }
                >
                  이미지 다운로드
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const img = images.find((i) => i.id === selectedIds[0])!;
                    try {
                      const source = await loadOutputImage(img.src);
                      const width = Math.round(
                          source.naturalWidth * (img.cropWidth ?? 1),
                        ),
                        height = Math.round(
                          source.naturalHeight * (img.cropHeight ?? 1),
                        );
                      checkExportSize(width, height);
                      const board: Artboard = {
                        x: img.x,
                        y: img.y,
                        width,
                        height,
                        widthMm: (width / 300) * 25.4,
                        heightMm: (height / 300) * 25.4,
                        dpi: 300,
                        name: "선택 이미지",
                      };
                      saveToHistory();
                      setImages((prev) =>
                        prev.map((i) =>
                          i.id === img.id
                            ? { ...i, width, height, rotation: 0 }
                            : i,
                        ),
                      );
                      setArtboard(board);
                      setViewport(
                        fitArtboard(board, canvasSize.width, canvasSize.height),
                      );
                    } catch (e) {
                      toast({
                        title:
                          e instanceof Error
                            ? e.message
                            : "판을 만들지 못했어요",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  이미지 크기로 작업판
                </Button>
                {artboard && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const img = images.find((i) => i.id === selectedIds[0])!,
                        scale = Math.min(
                          artboard.width / img.width,
                          artboard.height / img.height,
                        );
                      saveToHistory();
                      setImages((prev) =>
                        prev.map((i) =>
                          i.id === img.id
                            ? {
                                ...i,
                                width: img.width * scale,
                                height: img.height * scale,
                                x:
                                  artboard.x +
                                  (artboard.width - img.width * scale) / 2,
                                y:
                                  artboard.y +
                                  (artboard.height - img.height * scale) / 2,
                                rotation: 0,
                              }
                            : i,
                        ),
                      );
                      setViewport(
                        fitArtboard(
                          artboard,
                          canvasSize.width,
                          canvasSize.height,
                        ),
                      );
                    }}
                  >
                    작업판에 맞춤
                  </Button>
                )}
              </div>
            )}
          {usageOpen && <UsageBadge />}
          <ToolPalette
            onAddText={addTextLayer}
            onAddShape={addShape}
            onAddNote={addNote}
            onUpload={openFilePicker}
            onEditAction={handleEditAction}
            imageSelected={
              selectedIds.length === 1 &&
              images.some((img) => img.id === selectedIds[0])
            }
          />
          <GeneratingIndicator active={isGenerating} note={progressNote} />
          {isStorageLoaded &&
            images.length === 0 &&
            videos.length === 0 &&
            texts.length === 0 &&
            shapes.length === 0 &&
            notes.length === 0 &&
            !isGenerating && (
              <div
                className="studio-welcome"
                style={artboard ? { display: "none" } : undefined}
              >
                <div>
                  <span className="studio-eyebrow">GOMGOM CANVAS</span>
                  <h1>
                    {turdam
                      ? "무대에 어울리는 이미지를 만들어요"
                      : "오늘의 아이디어를 펼쳐보세요"}
                  </h1>
                  <p>
                    이미지 한 장부터 공연 포스터까지.
                    <br />
                    작업판 없이 자유롭게 시작하세요.
                  </p>
                  <div className="studio-start-actions">
                    <button
                      onClick={() =>
                        document.getElementById("studio-prompt")?.focus()
                      }
                    >
                      <ImageIcon size={24} />
                      <strong>이미지 만들기</strong>
                      <small>말로 설명하고 생성하기</small>
                    </button>
                    <button onClick={openFilePicker}>
                      <Paperclip size={24} />
                      <strong>파일 가져오기</strong>
                      <small>이미지 · 제안서 · PDF</small>
                    </button>
                    <button onClick={() => setBoardOpen(true)}>
                      <History size={24} />
                      <strong>저장한 작업 열기</strong>
                      <small>이어서 작업하기</small>
                    </button>
                  </div>
                  <small>파일을 이곳으로 끌어다 놓아도 돼요</small>
                </div>
              </div>
            )}
          {maskEdit &&
            (() => {
              const img = images.find((i) => i.id === maskEdit.id);
              return img ? (
                <MaskEditor
                  image={img}
                  screenRect={maskEdit.rect}
                  mode={maskEdit.mode}
                  onApply={(maskDataUrl, text, regions) => {
                    const isText = maskEdit.mode === "text" && text;
                    setMaskEdit(null);
                    // 영역이 둘 이상이면 어느 지시가 어느 자리인지 위치로 묶어 한 문장에 담는다
                    const multiPrompt = regions?.length
                      ? "표시한 영역이 여러 곳이다. 각 영역을 아래 지시대로 따로 고쳐라.\n" +
                        regions
                          .map(
                            (r) =>
                              `${r.label}) ${r.where} 영역 → ${r.instruction}`,
                          )
                          .join("\n") +
                        "\n지시가 없는 부분과 표시하지 않은 영역은 전혀 건드리지 마."
                      : null;
                    runMaskEdit({
                      image: img,
                      maskDataUrl,
                      prompt: isText
                        ? `칠한 부분의 글자를 "${text}"로 바꿔줘. 원래 서체·색·크기·배치는 그대로 유지하고, 칠하지 않은 영역은 전혀 건드리지 마.`
                        : multiPrompt || generationSettings.prompt,
                      historyKind: isText
                        ? "글자수정"
                        : multiPrompt
                          ? "다중 수정"
                          : undefined,
                      quality: imageQuality,
                      setImages,
                      setSelectedIds,
                      setIsGenerating,
                      toast,
                    });
                  }}
                  onCancel={() => setMaskEdit(null)}
                />
              ) : null;
            })()}
          <ArtboardDialog
            open={artboardOpen}
            onOpenChange={setArtboardOpen}
            artboard={artboard}
            exporting={exporting}
            onCreate={createArtboard}
            onRemove={() => {
              setArtboard(null);
              toast({
                title: "포스터 판을 없앴어요",
                description: "요소들은 그대로 있습니다",
              });
            }}
            onFit={fitToArtboard}
            onExport={exportArtboard}
          />
          {layersOpen && (
            <LayerPanel
              entries={orderedLayers}
              selectedIds={selectedIds}
              onSelect={selectFromPanel}
              onToggleHidden={(id) => toggleLayerFlag(id, "hidden")}
              onToggleLocked={(id) => toggleLayerFlag(id, "locked")}
              onMove={moveLayerTo}
              onClose={() => setLayersOpen(false)}
            />
          )}
          {historyOpen && (
            <HistoryPanel
              onApplyEntry={(e: HistoryEntry) => {
                setGenerationSettings((prev) => ({
                  ...prev,
                  prompt: e.prompt,
                  styleId: "custom",
                }));
                if (["1024x1024", "1536x1024", "1024x1536"].includes(e.size))
                  setImageSize(e.size);
                setImageQuality(e.quality);
                toast({
                  title: "조건을 불러왔어요",
                  description:
                    e.refs > 0
                      ? "참조가 있던 생성입니다 — 참조 이미지는 캔버스에서 다시 선택하세요"
                      : "실행(▶)을 누르면 같은 조건으로 다시 생성됩니다",
                });
              }}
              onClose={() => setHistoryOpen(false)}
            />
          )}
          <Dialog open={boardOpen} onOpenChange={setBoardOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>보드 (프로젝트)</DialogTitle>
              </DialogHeader>
              <BoardPanel
                currentId={boardId}
                currentName={boardName}
                myName={myName}
                busy={boardBusy}
                refreshKey={boardRefresh}
                onSetMyName={setMyName}
                onSaveCurrent={() => boardId && doSaveBoard(boardId, boardName)}
                onSaveAs={(name) =>
                  doSaveBoard(
                    `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
                    name,
                    true,
                  )
                }
                onOpen={openBoard}
                onDelete={async (b) => {
                  if (
                    !confirm(`"${b.name}" 보드를 지울까요? 되돌릴 수 없습니다.`)
                  )
                    return;
                  await fetch(`/api/boards/${b.id}`, { method: "DELETE" });
                  if (b.id === boardId) {
                    setBoardId(null);
                    setBoardName("");
                    setBoardUpdatedAt(undefined);
                  }
                  setBoardRefresh((n) => n + 1);
                  toast({ title: "보드를 지웠어요" });
                }}
                onClose={() => setBoardOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>캠페인 한 번에 만들기</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                한 줄로 요청하면 키비주얼·로고·포스터·배너 등으로 쪼개 계획을
                세웁니다. 계획을 보고 확인한 뒤에 만들어요.
              </p>
              <Textarea
                value={campaignRequest}
                onChange={(e) => setCampaignRequest(e.target.value)}
                placeholder="예: 2026 부천 달빛국악제 브랜드 캠페인 만들어줘. 가을밤 국악 축제, 가족 관객"
                className="h-20"
                style={{ fontSize: "14px" }}
              />
              {!campaignPlan && (
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    disabled={isPlanning || !campaignRequest.trim()}
                    onClick={planCampaign}
                  >
                    {isPlanning ? "계획 세우는 중…" : "계획 세우기"}
                  </Button>
                </div>
              )}

              {campaignPlan && (
                <div className="space-y-3">
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      {campaignPlan.concept}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {(campaignPlan.palette || []).map((c) => (
                        <span
                          key={c}
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {campaignPlan.items.map((it, i) => (
                      <div
                        key={i}
                        className="rounded-lg border bg-background/60 p-2"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-medium text-blue-600">
                            {i + 1}. {it.role}
                          </span>
                          <span className="text-muted-foreground">
                            {it.size.replace("x", "×")}
                          </span>
                          {i === 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              — 이 톤을 나머지가 따라갑니다
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                          {it.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {campaignPlan.items.length}장을 순서대로 만듭니다 · 몇 분
                    걸리고 그만큼 비용이 듭니다
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setCampaignPlan(null)}
                    >
                      다시 계획
                    </Button>
                    <Button variant="primary" onClick={startCampaign}>
                      이대로 만들기
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={customSizeOpen} onOpenChange={setCustomSizeOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>크기 직접 입력</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Input
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  placeholder="가로"
                  inputMode="numeric"
                  style={{ fontSize: "16px" }}
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  placeholder="세로"
                  inputMode="numeric"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                16의 배수로 자동 조정됩니다 · 가장 긴 변 3840px 이하 · 전체 약
                440만 픽셀 이하 (예: 2480×1760)
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setCustomSizeOpen(false)}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const r = normalizeSize(Number(customW), Number(customH));
                    if ("error" in r) {
                      toast({
                        title: "쓸 수 없는 크기",
                        description: r.error,
                        variant: "destructive",
                      });
                      return;
                    }
                    setImageSize(r.value);
                    setCustomSizeOpen(false);
                    toast({
                      title: `크기를 ${r.value.replace("x", "×")}로 정했어요`,
                      description: r.adjusted
                        ? "16의 배수로 맞춰 조정했습니다"
                        : undefined,
                    });
                  }}
                >
                  적용
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={cardnewsOpen} onOpenChange={setCardnewsOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>카드뉴스 만들기</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                선택한 이미지를 표지로 삼아 같은 스타일의 내용 페이지를
                만들어요. 한 줄 = 한 페이지 (최대 6페이지, 순서대로 생성)
              </p>
              <Textarea
                value={cardnewsText}
                onChange={(e) => setCardnewsText(e.target.value)}
                placeholder={
                  "행사 일정: 10월 16~17일 부천중앙공원\n프로그램: 판소리·사물놀이·퓨전국악\n참여 방법: 무료 입장, 예약 불필요"
                }
                className="h-32"
                style={{ fontSize: "14px" }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setCardnewsOpen(false)}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  disabled={isGenerating || !cardnewsText.trim()}
                  onClick={() => {
                    const cover = images.find((i) => i.id === selectedIds[0]);
                    const lines = cardnewsText
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .slice(0, 6);
                    if (!cover || !lines.length) {
                      toast({
                        title: "표지 이미지를 먼저 선택하세요",
                        variant: "destructive",
                      });
                      return;
                    }
                    setCardnewsOpen(false);
                    runCardnews({
                      cover,
                      lines,
                      quality: imageQuality,
                      setImages,
                      setSelectedIds,
                      setIsGenerating,
                      toast,
                    });
                  }}
                >
                  페이지 생성 시작
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dimension display for selected images */}
          <DimensionDisplay
            selectedImages={images.filter((img) =>
              selectedIds.includes(img.id),
            )}
            viewport={viewport}
          />
        </div>
      </main>

      {/* Style Selection Dialog */}
      <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Choose a Style</DialogTitle>
            <DialogDescription>
              Select a style to apply to your images or choose Custom to use
              your own LoRA
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            {/* Fixed gradient overlays outside scrollable area */}
            <div className="pointer-events-none absolute -top-[1px] left-0 right-0 z-30 h-4 md:h-12 bg-gradient-to-b from-background via-background/90 to-transparent" />
            <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 z-30 h-4 md:h-12 bg-gradient-to-t from-background via-background/90 to-transparent" />

            {/* Scrollable content container */}
            <div className="overflow-y-auto max-h-[60vh] px-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 pb-6 md:pt-8 md:pb-12">
                {/* Custom option */}
                <button
                  onClick={() => {
                    setGenerationSettings({
                      ...generationSettings,
                      loraUrl: "",
                      prompt: "",
                      styleId: "custom",
                    });
                    setIsStyleDialogOpen(false);
                  }}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 p-3 rounded-xl border",
                    generationSettings.styleId === "custom"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">Custom</span>
                </button>

                {/* Predefined styles */}
                {styleModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setGenerationSettings({
                        ...generationSettings,
                        loraUrl: model.loraUrl || "",
                        prompt: model.prompt,
                        styleId: model.id,
                      });
                      setIsStyleDialogOpen(false);
                    }}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 p-3 rounded-xl border",
                      generationSettings.styleId === model.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                      <Image
                        src={model.imageSrc}
                        alt={model.name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                      {generationSettings.styleId === model.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"></div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-center">
                      {model.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
      >
        <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>설정</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <ProviderSettings
              list={providerList}
              editLocked={editLocked}
              onSaved={reloadProviders}
              toast={toast}
            />

            <div className="h-px bg-border/40" />

            {/* Appearance */}
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="appearance">화면 모드</Label>
                <p className="text-sm text-muted-foreground">
                  밝은/어두운 화면을 고릅니다.
                </p>
              </div>
              <Select
                value={theme || "system"}
                onValueChange={(value: "system" | "light" | "dark") =>
                  setTheme(value)
                }
              >
                <SelectTrigger className="max-w-[140px] rounded-xl">
                  <div className="flex items-center gap-2">
                    {theme === "light" ? (
                      <SunIcon className="size-4" />
                    ) : theme === "dark" ? (
                      <MoonIcon className="size-4" />
                    ) : (
                      <MonitorIcon className="size-4" />
                    )}
                    <span className="capitalize">{theme || "system"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="system" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <MonitorIcon className="size-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="light" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <SunIcon className="size-4" />
                      <span>Light</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <MoonIcon className="size-4" />
                      <span>Dark</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grid">격자 표시</Label>
                <p className="text-sm text-muted-foreground">
                  이미지 정렬에 도움되는 격자를 캔버스에 표시합니다.
                </p>
              </div>
              <Switch
                id="grid"
                checked={showGrid}
                onCheckedChange={setShowGrid}
              />
            </div>

            {/* Minimap */}
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="minimap">미니맵 표시</Label>
                <p className="text-sm text-muted-foreground">
                  구석에 미니맵을 띄워 캔버스를 한눈에 봅니다.
                </p>
              </div>
              <Switch
                id="minimap"
                checked={showMinimap}
                onCheckedChange={setShowMinimap}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image to Video Dialog */}
      <ImageToVideoDialog
        isOpen={isImageToVideoDialogOpen}
        onClose={() => {
          setIsImageToVideoDialogOpen(false);
          setSelectedImageForVideo(null);
        }}
        onConvert={handleImageToVideoConversion}
        imageUrl={
          selectedImageForVideo
            ? images.find((img) => img.id === selectedImageForVideo)?.src || ""
            : ""
        }
        isConverting={isConvertingToVideo}
      />

      <VideoToVideoDialog
        isOpen={isVideoToVideoDialogOpen}
        onClose={() => {
          setIsVideoToVideoDialogOpen(false);
          setSelectedVideoForVideo(null);
        }}
        onConvert={handleVideoToVideoTransformation}
        videoUrl={
          selectedVideoForVideo
            ? videos.find((vid) => vid.id === selectedVideoForVideo)?.src || ""
            : ""
        }
        isConverting={isTransformingVideo}
      />

      <ExtendVideoDialog
        isOpen={isExtendVideoDialogOpen}
        onClose={() => {
          setIsExtendVideoDialogOpen(false);
          setSelectedVideoForExtend(null);
        }}
        onExtend={handleVideoExtension}
        videoUrl={
          selectedVideoForExtend
            ? videos.find((vid) => vid.id === selectedVideoForExtend)?.src || ""
            : ""
        }
        isExtending={isExtendingVideo}
      />

      <RemoveVideoBackgroundDialog
        isOpen={isRemoveVideoBackgroundDialogOpen}
        onClose={() => {
          setIsRemoveVideoBackgroundDialogOpen(false);
          setSelectedVideoForBackgroundRemoval(null);
        }}
        onProcess={handleVideoBackgroundRemoval}
        videoUrl={
          selectedVideoForBackgroundRemoval
            ? videos.find((vid) => vid.id === selectedVideoForBackgroundRemoval)
                ?.src || ""
            : ""
        }
        videoDuration={
          selectedVideoForBackgroundRemoval
            ? videos.find((vid) => vid.id === selectedVideoForBackgroundRemoval)
                ?.duration || 0
            : 0
        }
        isProcessing={isRemovingVideoBackground}
      />

      {/* Video Generation Streaming Components */}
      {Array.from(activeVideoGenerations.entries()).map(([id, generation]) => (
        <StreamingVideo
          key={id}
          videoId={id}
          generation={generation}
          onComplete={handleVideoGenerationComplete}
          onError={handleVideoGenerationError}
          onProgress={handleVideoGenerationProgress}
          apiKey={customApiKey}
        />
      ))}

      {/* Video Controls Overlays */}
      <VideoOverlays
        videos={videos}
        selectedIds={selectedIds}
        viewport={viewport}
        hiddenVideoControlsIds={hiddenVideoControlsIds}
        setVideos={setVideos}
      />
    </div>
  );
}
