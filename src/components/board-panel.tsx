"use client";
// 협업 보드 — 서버에 저장해 여러 프로젝트를 오가고, 다른 사람이 이어받는다.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BoardMeta {
  id: string;
  name: string;
  updatedAt: string;
  updatedBy: string;
  imageCount: number;
}

interface Props {
  currentId: string | null;
  currentName: string;
  myName: string;
  busy: string;
  onSetMyName: (v: string) => void;
  onSaveAs: (name: string) => void;
  onSaveCurrent: () => void;
  onOpen: (b: BoardMeta) => void;
  onDelete: (b: BoardMeta) => void;
  onClose: () => void;
  refreshKey: number;
}

export function BoardPanel({
  currentId,
  currentName,
  myName,
  busy,
  onSetMyName,
  onSaveAs,
  onSaveCurrent,
  onOpen,
  onDelete,
  onClose,
  refreshKey,
}: Props) {
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch("/api/boards")
      .then((r) => r.json())
      .then((j) => setBoards(j.boards || []))
      .catch(() => {});
  }, [refreshKey]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          내 이름 (누가 저장했는지 표시됩니다)
        </label>
        <Input
          value={myName}
          onChange={(e) => onSetMyName(e.target.value)}
          placeholder="예: 정재훈"
          className="h-8"
          style={{ fontSize: "14px" }}
        />
      </div>

      <div className="rounded-xl border p-3">
        <p className="text-xs text-muted-foreground">지금 작업 중</p>
        <p className="mt-0.5 text-sm font-medium">
          {currentId ? currentName : "저장 안 된 캔버스"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {currentId && (
            <Button
              size="sm"
              variant="primary"
              className="h-8"
              disabled={!!busy}
              onClick={onSaveCurrent}
            >
              {busy || "저장"}
            </Button>
          )}
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 보드 이름"
              className="h-8"
              style={{ fontSize: "14px" }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="h-8 shrink-0"
              disabled={!!busy || !newName.trim()}
              onClick={() => {
                onSaveAs(newName.trim());
                setNewName("");
              }}
            >
              새로 저장
            </Button>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          저장된 보드 {boards.length}개
        </p>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {boards.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              아직 저장된 보드가 없어요
            </p>
          )}
          {boards.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                b.id === currentId ? "ring-1 ring-blue-500" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {b.updatedBy} · {new Date(b.updatedAt).toLocaleString("ko-KR")}{" "}
                  · 이미지 {b.imageCount}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 shrink-0 text-xs"
                disabled={!!busy}
                onClick={() => onOpen(b)}
              >
                열기
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 text-xs text-destructive"
                disabled={!!busy}
                onClick={() => onDelete(b)}
              >
                삭제
              </Button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        같은 보드를 두 사람이 동시에 열면, 나중에 저장하는 쪽에 경고가 뜹니다
        (덮어쓰기 사고 방지)
      </p>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
