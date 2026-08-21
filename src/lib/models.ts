export interface StyleModel {
  id: string;
  name: string;
  imageSrc: string;
  prompt: string;
  loraUrl?: string;
  overlay?: boolean;
}

// 곰곰 한국어 프리셋 (F-11) — 프롬프트를 채워주는 시작점.
// 이미지를 선택(참조)한 상태면 "그 이미지를 이 스타일로", 없으면 뒤에 소재만 붙여 쓰면 된다.
// 썸네일은 라벨 타일(public/images/styles/kr-*.png) — 마음에 드는 실제 샘플로 교체 가능.
export const styleModels: StyleModel[] = [
  {
    id: "poster",
    name: "행사 포스터",
    imageSrc: "/images/styles/kr-poster.png",
    prompt:
      "한국 지역 축제 행사 포스터 스타일. 밝고 따뜻한 색감, 명확한 중심 소재, 상단과 하단에 글자 넣을 여백, 인쇄용 고품질",
  },
  {
    id: "cardnews",
    name: "카드뉴스",
    imageSrc: "/images/styles/kr-cardnews.png",
    prompt:
      "인스타그램 카드뉴스 표지 스타일. 미니멀 플랫 디자인, 넓은 단색 배경, 중앙에 단순한 핵심 그래픽, 글자 공간 확보",
  },
  {
    id: "watercolor",
    name: "수채화",
    imageSrc: "/images/styles/kr-watercolor.png",
    prompt: "부드러운 수채화 일러스트 스타일. 따뜻한 색조, 종이 질감, 은은한 번짐",
  },
  {
    id: "flat",
    name: "플랫 일러스트",
    imageSrc: "/images/styles/kr-flat.png",
    prompt: "모던 플랫 벡터 일러스트 스타일. 단순한 도형, 파스텔 팔레트, 깔끔한 외곽선 없음",
  },
  {
    id: "photo",
    name: "실사 사진",
    imageSrc: "/images/styles/kr-photo.png",
    prompt: "포토리얼 실사 사진 스타일. 자연광, 얕은 심도, 전문 사진가 구도",
  },
  {
    id: "iso3d",
    name: "3D 아이소",
    imageSrc: "/images/styles/kr-iso3d.png",
    prompt: "귀여운 3D 아이소메트릭 렌더 스타일. 부드러운 조명, 파스텔 색, 매끈한 질감",
  },
  {
    id: "logo",
    name: "로고·심볼",
    imageSrc: "/images/styles/kr-logo.png",
    prompt: "미니멀 로고 심볼 스타일. 흰 배경, 단순한 기하 도형, 벡터 느낌, 2~3색 이내",
  },
  {
    // s1dashu/ip-as-logo-skill(MIT)의 규칙을 프리셋으로 흡수
    // 핵심: 극단적 단순화 · 두꺼운 둥근 형태 · 캐릭터 2색 + 배경 1색 · 하단 코너 구도
    id: "mascot",
    name: "마스코트 캐릭터",
    imageSrc: "/images/styles/kr-mascot.png",
    prompt:
      "아주 단순하고 귀여운 정사각 캐릭터 그림. 두껍고 둥글둥글한 덩어리 형태, 넓은 색면. 캐릭터는 딱 두 가지 색만 쓰고 배경은 다른 한 가지 단색으로 꽉 채운다. 캐릭터는 화면 왼쪽 아래(또는 오른쪽 아래) 모서리에서 올라오듯 배치하고 화면의 85~95%를 차지하게 크게. 귀·뿔·날개처럼 쌍을 이루는 특징은 둘 다 보이게. 32픽셀로 줄여도 알아볼 수 있을 만큼 형태를 단순화. 제약: 뾰족한 모서리·바늘 같은 가는 선·글자·그라데이션·그림자·질감 없이, 모든 끝을 뭉툭하게 둥글릴 것",
  },
  {
    id: "storybook",
    name: "동화 삽화",
    imageSrc: "/images/styles/kr-storybook.png",
    prompt: "따뜻한 동화책 삽화 스타일. 크레용과 색연필 질감, 다정한 분위기, 어린이 친화적",
  },
  {
    id: "korean",
    name: "한국 전통",
    imageSrc: "/images/styles/kr-korean.png",
    prompt: "한국 전통 미술 감성. 한지 질감, 수묵 담채, 오방색 포인트, 절제된 여백",
  },
  {
    id: "cinematic",
    name: "시네마틱",
    imageSrc: "/images/styles/kr-cinematic.png",
    prompt: "시네마틱 영화 스틸컷 스타일. 극적인 조명, 넓은 화면 구도, 깊이 있는 색보정",
  },
];
