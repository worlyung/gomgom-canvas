"use client";
// 캔버스 텍스트 레이어 — 진짜 폰트로 렌더하므로 오타가 없고 수정이 즉시·무료
import { Text } from "react-konva";
import type Konva from "konva";
import type { PlacedText } from "@/types/canvas";

interface Props {
  item: PlacedText;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onChange: (id: string, patch: Partial<PlacedText>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function CanvasText({
  item,
  isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragEnd,
}: Props) {
  return (
    <Text
      id={item.id}
      name="canvas-text"
      text={item.text}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      fontSize={item.fontSize}
      fill={item.fill}
      fontFamily={item.fontFamily}
      fontStyle={item.bold ? "bold" : "normal"}
      align={item.align || "left"}
      stroke={item.stroke}
      strokeWidth={item.stroke ? Math.max(1, item.fontSize / 18) : 0}
      fillAfterStrokeEnabled
      draggable
      // 선택 표시: 얇은 그림자로 테두리 대신 (Transformer 없이 가볍게)
      shadowColor={isSelected ? "#3b82f6" : undefined}
      shadowBlur={isSelected ? 12 : 0}
      shadowOpacity={isSelected ? 0.9 : 0}
      onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onSelect(item.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      }}
      onTap={() => onSelect(item.id, false)}
      onDragStart={onDragStart}
      onDragEnd={(e) => {
        onChange(item.id, { x: e.target.x(), y: e.target.y() });
        onDragEnd();
      }}
    />
  );
}
