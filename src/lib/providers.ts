// 이미지 생성 제공자 정의 — 제공자마다 되는 기능이 다르므로 여기 한 곳에 적어둔다.
// 화면은 이 표를 보고 "이 제공자로는 못 하는 기능"을 잠근다.
export type ProviderId = "openai" | "grok" | "gemini";

export interface ProviderCapabilities {
  generate: boolean; // 프롬프트 → 이미지
  reference: boolean; // 참조 이미지로 생성
  mask: boolean; // 부분수정·글자수정·사이즈 전개
  transparent: boolean; // 투명 배경
  customSize: boolean; // 자유 크기
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  envKey: string; // 서버가 읽는 환경변수 이름
  keyHint: string; // 키 형태 안내
  docsUrl: string;
  model: string;
  caps: ProviderCapabilities;
  note?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI (gpt-image-2)",
    envKey: "OPENAI_API_KEY",
    keyHint: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    model: "gpt-image-2",
    caps: {
      generate: true,
      reference: true,
      mask: true,
      transparent: true,
      customSize: true,
    },
    note: "모든 기능 지원 — 부분수정·투명배경·자유크기까지",
  },
  {
    id: "gemini",
    label: "Google Gemini (Nano Banana)",
    envKey: "GEMINI_API_KEY",
    keyHint: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
    model: "gemini-3-pro-image-preview",
    caps: {
      generate: true,
      reference: true,
      mask: false,
      transparent: false,
      customSize: false,
    },
    note: "생성·참조는 되지만 부분수정·투명배경은 미지원. 무료 한도가 있어 시안 뽑기에 좋다",
  },
  {
    id: "grok",
    label: "xAI Grok (grok-imagine)",
    envKey: "XAI_API_KEY",
    keyHint: "xai-...",
    docsUrl: "https://console.x.ai",
    model: "grok-2-image",
    caps: {
      generate: true,
      reference: false,
      mask: false,
      transparent: false,
      customSize: false,
    },
    note: "생성 전용 — 참조·부분수정·투명배경 미지원",
  },
];

export const getProvider = (id: string): ProviderDef =>
  PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

/** 이 기능을 쓰려면 어떤 제공자가 필요한지 안내 문구 */
export function capabilityHint(
  provider: ProviderDef,
  cap: keyof ProviderCapabilities,
): string | null {
  if (provider.caps[cap]) return null;
  const names: Record<keyof ProviderCapabilities, string> = {
    generate: "이미지 생성",
    reference: "참조 생성",
    mask: "부분수정·사이즈 전개",
    transparent: "투명 배경",
    customSize: "자유 크기",
  };
  const able = PROVIDERS.filter((p) => p.caps[cap]).map((p) => p.label);
  return `${provider.label}는 ${names[cap]}을 지원하지 않습니다 (가능: ${able.join(", ")})`;
}
