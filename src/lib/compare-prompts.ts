import type { PlacedImage } from "@/types/canvas";

const directions = [
  "시안 A — 타이포그래피 중심. 글자가 필요한 작업이면 제목을 왼쪽 위에 크게 두고, 핵심 시각물 한 개를 오른쪽 아래에 배치한다. 시각물은 작은 크기로 쓰고 넓은 여백을 남긴다. 지정색이 없다면 따뜻한 아이보리·먹색에 빨강을 소량만 쓴다.",
  "시안 B — 인물·대상 중심. 핵심 시각물을 화면 중앙에 크게 두고 강한 수직 리듬을 만든다. 글자가 필요한 작업이면 제목을 오른쪽 가장자리나 아래쪽에 모아 A와 다른 크기·위계로 배치한다. 지정색이 없다면 짙은 남색과 밝은 크림색으로 강하게 대비한다.",
  "시안 C — 상징 오브제 중심. 주제를 드러내는 다른 오브제나 장면을 주인공으로 삼는다. 왼쪽 좁은 세로 영역에 글자를 모으고, 시각물은 오른쪽으로 비대칭 배치한다. A·B의 주인공과 배치를 반복하지 않는다. 지정색이 없다면 산호색·황토색·검정을 사용한다.",
  "시안 D — 추상·여백 중심. 인물이나 대상의 크기를 작게 줄이거나 추상적인 선과 형태로 바꾼다. 제목이 있다면 하단에 독립된 블록으로 놓고, 상단 절반 이상을 비운다. 앞선 시안과 색 면적·시점·구도를 다르게 한다. 지정색이 없다면 연한 녹색·미색·먹색을 사용한다.",
];

// 사용자 문장 속 시안 수는 한 번의 이미지에 그릴 대상이 아니라 요청 횟수다.
export function requestedImageCount(prompt: string): number | undefined {
  const match = prompt.match(
    /(?:^|\s)([234]|두|세|네)\s*(?:장|개|가지)(?:을|를)?\s*(?=(?:각각\s*)?(?:이미지|시안|포스터|뽑|만들|생성|비교))/,
  );
  if (!match) return undefined;
  return (
    ({ 두: 2, 세: 3, 네: 4 } as Record<string, number>)[match[1]] ??
    Number(match[1])
  );
}

export function stripMultiImageInstructions(prompt: string): string {
  return prompt
    .replace(
      /(?:이미지\s*(?:한\s*개|1개)(?:를|을)?\s*)?[2-4]\s*분할\s*(?:하지\s*말고|하지\s*않고|말고|금지)?/g,
      " ",
    )
    .replace(
      /(?:[2-4]|두|세|네)\s*(?:장|개|가지)(?:을|를)?\s*(?:각각\s*)?(?:이미지|시안|포스터)?\s*(?:뽑아?봐|뽑아?줘|만들자|만들어?봐|만들어?줘|만들라고|생성해?줘|비교해?줘)?/g,
      " ",
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function isFollowupRequest(prompt: string): boolean {
  const value = stripMultiImageInstructions(prompt);
  if (
    /(?:20\d{2}.{0,80}(?:페스티벌|축제|공연|행사|전시)|일시|장소|행사명|제품명|상품명|브랜드명)/.test(
      value,
    )
  )
    return false;
  return /(?:^|[\s,.])(?:이걸|이거|이전|기존|방금|앞서|더|다시|서로|좀)|(?:바꿔|고쳐|수정|조정|유지|참조|다르게|비슷하게|구조|위치)/.test(
    value,
  );
}

// 옛 결과에는 brief 필드가 없으므로 행사명·일시·장소가 있는 문장을 복구한다.
export function stableBriefFromPrompt(prompt: string): string | undefined {
  const value = stripMultiImageInstructions(prompt);
  if (isFollowupRequest(value)) return undefined;
  const sentences = value
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((part) => part.trim());
  const facts = sentences.filter((part) =>
    /(?:20\d{2}|일시|장소|행사명|제품명|상품명|브랜드명)/.test(part),
  );
  if (facts.length)
    return facts
      .slice(0, 3)
      .map((part) =>
        part
          .replace(/(?:큰|작은)\s*(?:글자|글씨)로\s*(?:넣기|표기)?/g, "")
          .replace(/\s*(?:넣기|삽입|표기)\s*([.!?。]?)$/g, "$1")
          .replace(/\s+([.!?。])/g, "$1")
          .trim(),
      )
      .join(" ");
  return value && !isFollowupRequest(value) ? value.slice(0, 600) : undefined;
}

export function recentCanvasBrief(images: PlacedImage[]): string | undefined {
  for (let index = images.length - 1; index >= 0; index--) {
    const generation = images[index].generation;
    if (!generation) continue;
    const brief = generation.brief
      ? stableBriefFromPrompt(generation.brief) || generation.brief
      : stableBriefFromPrompt(generation.prompt);
    if (brief) return brief;
  }
  return undefined;
}

export function continueReferenceBrief(
  prompt: string,
  brief: string | undefined,
  enabled: boolean,
): string {
  const current = stripMultiImageInstructions(prompt);
  if (!enabled || !brief || current.includes(brief)) return current;
  return [
    "현재 작업의 주제와 반드시 지킬 정보:",
    brief,
    "이번 수정 요청:",
    current,
    "행사명·일시·장소·필수 문구는 유지하되, 이전 이미지의 글자 위치·구도·주요 형상은 이번 요청에 맞게 새로 설계하라.",
  ].join("\n\n");
}

export function comparisonPrompt(prompt: string, index: number): string {
  return [
    prompt,
    directions[index % directions.length],
    "이 결과는 완성된 독립 이미지 단 한 장이다. 다른 시안과 같은 인물 자세·오브제·제목 위치·색 배치를 반복하지 마라. 한 화면에 여러 포스터나 격자·콜라주·분할 화면을 넣지 마라. 지정된 글자와 주제는 유지하라.",
  ].join("\n\n");
}
