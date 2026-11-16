// 구도 원칙: https://github.com/worlyung/korean-layout-compositions
// 원본 catalog.json의 번호와 이름을 사용한다 (CC BY 4.0).
export const POSTER_LAYOUTS = [
  {
    id: 142,
    name: "대제목 판면",
    instruction:
      "제목을 지면의 가장 큰 형태로 만들고 화면 한쪽을 차지하게 하라. 주요 그림은 제목과 크기 경쟁을 하지 않게 작게 두고, 제목 주변에 넉넉한 빈 공간을 남겨라.",
  },
  {
    id: 143,
    name: "이미지 창 판면",
    instruction:
      "넓은 단색 여백 속에 하나의 뚜렷한 이미지 창을 만들고 핵심 시각물을 그 안에 넣어라. 제목과 필수 정보는 창 바깥에 독립적으로 배치하라.",
  },
  {
    id: 146,
    name: "몬드리안 판면",
    instruction:
      "한 장의 포스터 안에서 크기가 다른 직사각형 영역으로 제목, 핵심 이미지, 상세 정보를 분리하라. 영역의 비율을 비대칭으로 두되 전체는 하나의 포스터로 읽히게 하라.",
  },
  {
    id: 148,
    name: "실루엣 판면",
    instruction:
      "주요 인물이나 오브제를 배경에서 분리한 큰 실루엣으로 배치하라. 제목과 작은 정보는 실루엣의 외곽을 따라 흐르게 하되 글자의 판독성을 지켜라.",
  },
] as const;

export type PosterLayoutId = (typeof POSTER_LAYOUTS)[number]["id"];

export function getPosterLayout(id: number | undefined) {
  return POSTER_LAYOUTS.find((layout) => layout.id === id);
}

export function posterLayoutForIndex(index: number) {
  return POSTER_LAYOUTS[index % POSTER_LAYOUTS.length];
}
