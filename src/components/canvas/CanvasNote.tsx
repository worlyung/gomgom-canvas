"use client";
// 메모(주석) — "여기 글자 키우자" 같은 검토 메모.
// 화면에만 보이고 이미지로 구울 때는 제외된다 (결과물이 아니라 협업용이라서).
import { Group, Rect, Text, Line } from "react-konva";
import type Konva from "konva";
import type { PlacedNote } from "@/types/canvas";

interface Props {
  item: PlacedNote;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onChange: (id: string, patch: Partial<PlacedNote>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const PAD = 10;
const FONT = 14;

export function CanvasNote({
  item,
  isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragEnd,
}: Props) {
  const lines = Math.max(1, item.text.split("\n").length);
  const est = Math.ceil(item.text.length / Math.max(8, item.width / 9));
  const height = PAD * 2 + Math.max(lines, est) * (FONT + 6) + 6;

  return (
    <Group
      id={item.id}
      name="canvas-note"
      x={item.x}
      y={item.y}
      draggable
      opacity={item.done ? 0.5 : 1}
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
    >
      {/* 포스트잇 */}
      <Rect
        width={item.width}
        height={height}
        fill={item.color}
        cornerRadius={6}
        shadowColor="#000000"
        shadowBlur={isSelected ? 14 : 6}
        shadowOpacity={isSelected ? 0.45 : 0.18}
        shadowOffsetY={2}
        stroke={isSelected ? "#3b82f6" : undefined}
        strokeWidth={isSelected ? 2 : 0}
      />
      <Text
        x={PAD}
        y={PAD}
        width={item.width - PAD * 2}
        text={item.text || "메모를 입력하세요"}
        fontSize={FONT}
        lineHeight={1.45}
        fill="#3f3f46"
        fontFamily="'Noto Sans KR', 'Malgun Gothic', sans-serif"
        listening={false}
      />
      {/* 처리 완료면 취소선 */}
      {item.done && (
        <Line
          points={[PAD, height / 2, item.width - PAD, height / 2]}
          stroke="#71717a"
          strokeWidth={1.5}
          listening={false}
        />
      )}
    </Group>
  );
}
