"use client";
// 도형 레이어 — 강조 박스·원·화살표 등. 결과물에 함께 구워진다.
import { useEffect, useRef } from "react";
import {
  Rect,
  Ellipse,
  RegularPolygon,
  Star,
  Arrow,
  Line,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type { PlacedShape } from "@/types/canvas";

interface Props {
  item: PlacedShape;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onChange: (id: string, patch: Partial<PlacedShape>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function CanvasShape({
  item,
  isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragEnd,
}: Props) {
  const ref = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && ref.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, item.kind, item.width, item.height]);

  const common = {
    ref: ref as never,
    id: item.id,
    name: "canvas-shape",
    x: item.x,
    y: item.y,
    rotation: item.rotation,
    fill: item.fill,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
    opacity: item.opacity,
    draggable: true,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(item.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
    },
    onTap: () => onSelect(item.id, false),
    onDragStart,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange(item.id, { x: e.target.x(), y: e.target.y() });
      onDragEnd();
    },
    onTransformStart: onDragStart,
    onTransformEnd: () => {
      const node = ref.current;
      if (!node) return;
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange(item.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(8, Math.round(item.width * sx)),
        height: Math.max(8, Math.round(item.height * sy)),
      });
      onDragEnd();
    },
  };

  const w = item.width;
  const h = item.height;

  return (
    <>
      {item.kind === "rect" && <Rect {...common} width={w} height={h} cornerRadius={4} />}
      {item.kind === "ellipse" && (
        <Ellipse {...common} radiusX={w / 2} radiusY={h / 2} />
      )}
      {item.kind === "triangle" && (
        <RegularPolygon {...common} sides={3} radius={Math.max(w, h) / 2} />
      )}
      {item.kind === "star" && (
        <Star
          {...common}
          numPoints={5}
          innerRadius={Math.max(w, h) / 4}
          outerRadius={Math.max(w, h) / 2}
        />
      )}
      {item.kind === "arrow" && (
        <Arrow {...common} points={[0, 0, w, h]} pointerLength={12} pointerWidth={12} />
      )}
      {item.kind === "line" && <Line {...common} points={[0, 0, w, h]} />}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          anchorSize={9}
          anchorCornerRadius={4}
          borderStroke="#3b82f6"
          anchorStroke="#3b82f6"
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
