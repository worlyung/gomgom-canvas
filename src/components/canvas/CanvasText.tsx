"use client";
// 캔버스 텍스트 레이어 — 진짜 폰트로 렌더하므로 오타가 없고 수정이 즉시·무료
// 선택하면 모서리 핸들로 크기·회전을 마우스로 조절할 수 있다.
import { useEffect, useRef } from "react";
import { Text, Transformer } from "react-konva";
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
  const textRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, item.text, item.fontSize, item.fontFamily]);

  return (
    <>
      <Text
        ref={textRef}
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
        onTransformStart={onDragStart}
        onTransformEnd={() => {
          const node = textRef.current;
          if (!node) return;
          // 늘린 배율을 글자 크기로 환산하고 배율은 1로 되돌린다 (글자가 찌그러지지 않게)
          const scale = Math.max(node.scaleX(), node.scaleY());
          node.scaleX(1);
          node.scaleY(1);
          onChange(item.id, {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: Math.max(8, Math.round(item.fontSize * scale)),
          });
          onDragEnd();
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          anchorSize={9}
          anchorCornerRadius={4}
          borderStroke="#3b82f6"
          anchorStroke="#3b82f6"
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 12 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
