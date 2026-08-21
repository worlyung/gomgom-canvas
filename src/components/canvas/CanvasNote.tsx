"use client";
// 메모(주석) — "여기 글자 키우자" 같은 검토 메모.
// 어디를 두고 하는 말인지 연결선으로 가리킨다. 끝점(동그라미)을 끌어 가리킬 곳을 바꾼다.
// 화면에만 보이고 이미지로 구울 때는 제외된다 (결과물이 아니라 협업용이라서).
import { Group, Rect, Text, Line, Circle } from "react-konva";
import type Konva from "konva";
import type { PlacedNote } from "@/types/canvas";

interface Props {
  item: PlacedNote;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onChange: (id: string, patch: Partial<PlacedNote>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** 메모지 위에 편집기(textarea)를 얹는 동안은 캔버스 글자를 숨긴다 (겹쳐 보이지 않게) */
  hideText?: boolean;
}

export const NOTE_PAD = 14;
export const NOTE_FONT = 20;
export const NOTE_LINE_HEIGHT = 1.5;

/** 메모지 너비 — 좁게/넓게 두 단계 */
export const NOTE_WIDTH_NARROW = 340;
export const NOTE_WIDTH_WIDE = 500;

/** 메모지 높이 — 캔버스 도형과 위에 얹는 편집기가 같은 값을 써야 어긋나지 않는다. */
export function noteHeight(text: string, width: number): number {
  const lines = Math.max(1, text.split("\n").length);
  // 글자 하나가 대략 폰트 크기의 0.62배 폭 (한글 기준으로 넉넉히)
  const perLine = Math.max(6, Math.floor((width - NOTE_PAD * 2) / (NOTE_FONT * 0.62)));
  const est = Math.ceil(text.length / perLine);
  const rows = Math.max(2, Math.max(lines, est));
  return NOTE_PAD * 2 + rows * Math.round(NOTE_FONT * NOTE_LINE_HEIGHT) + 4;
}

const PAD = NOTE_PAD;
const FONT = NOTE_FONT;

export function CanvasNote({
  item,
  isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragEnd,
  hideText,
}: Props) {
  const height = noteHeight(item.text, item.width);

  // 연결선은 메모의 네 변 중 목표에 가장 가까운 지점에서 출발한다
  const cx = item.x + item.width / 2;
  const cy = item.y + height / 2;
  const dx = item.targetX - cx;
  const dy = item.targetY - cy;
  const startX =
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? item.x + item.width
        : item.x
      : cx;
  const startY =
    Math.abs(dx) > Math.abs(dy)
      ? cy
      : dy > 0
        ? item.y + height
        : item.y;

  const lineColor = item.done ? "#a1a1aa" : "#f59e0b";

  return (
    <>
      {/* 연결선 — 메모 아래에 그려 메모 뒤에서 나오는 것처럼 보이게 */}
      <Line
        points={[startX, startY, item.targetX, item.targetY]}
        stroke={lineColor}
        strokeWidth={2}
        dash={[6, 4]}
        opacity={item.done ? 0.5 : 0.95}
        listening={false}
      />
      {/* 가리키는 지점 — 끌어서 옮긴다 */}
      <Circle
        x={item.targetX}
        y={item.targetY}
        radius={7}
        fill={lineColor}
        stroke="#ffffff"
        strokeWidth={2}
        opacity={item.done ? 0.5 : 1}
        draggable
        onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true;
        }}
        onDragStart={onDragStart}
        onDragEnd={(e) => {
          onChange(item.id, { targetX: e.target.x(), targetY: e.target.y() });
          onDragEnd();
        }}
      />

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
        {!hideText && (
          <Text
            x={PAD}
            y={PAD}
            width={item.width - PAD * 2}
            text={item.text || "메모를 입력하세요"}
            fontSize={FONT}
            lineHeight={NOTE_LINE_HEIGHT}
            fill="#3f3f46"
            fontFamily="'Noto Sans KR', 'Malgun Gothic', sans-serif"
            listening={false}
          />
        )}
        {item.done && (
          <Line
            points={[PAD, height / 2, item.width - PAD, height / 2]}
            stroke="#71717a"
            strokeWidth={1.5}
            listening={false}
          />
        )}
      </Group>
    </>
  );
}
