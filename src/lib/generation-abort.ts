// 생성 취소 — 진행 중인 /api 요청을 한 곳에서 끊는다.
// 생성 경로가 8군데라 각자 AbortController를 들고 다니면 취소 버튼이 일부만 끊는다.
let controller: AbortController | null = null;

/** 진행 중인 생성 요청에 붙일 signal. 없으면 새로 연다. */
export function genSignal(): AbortSignal {
  if (!controller || controller.signal.aborted) controller = new AbortController();
  return controller.signal;
}

/** 취소 버튼이 부르는 함수. 진행 중인 모든 생성 요청을 끊는다. */
export function cancelGeneration(): void {
  controller?.abort();
  controller = null;
}

/** 다음 생성이 새 signal로 시작하도록 초기화. */
export function resetGeneration(): void {
  controller = null;
}

/** 사용자가 취소해서 끊긴 것인지 (진짜 실패와 구분). */
export function isCancel(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/** 생성 요청 전용 fetch — 취소 signal이 자동으로 붙는다. */
export function genFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, { ...init, signal: genSignal() });
}
