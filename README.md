# 곰곰 캔버스 (Gomgom Canvas)

**제안서를 끌어다 놓으면 포스터가 나오는, OpenAI gpt-image-2 기반 무한 캔버스 이미지 에디터.**

[fal-ai-community/infinite-kanvas](https://github.com/fal-ai-community/infinite-kanvas)(MIT)를 베이스로,
fal.ai 의존을 걷어내고 OpenAI Images API 직결로 재구성했다. 한국 공공 행사(축제·행사 포스터·카드뉴스) 실무를 염두에 두고 만들었다.

> An infinite-canvas image editor rebuilt on OpenAI gpt-image-2 — drop a proposal document (md/txt/PDF), get a poster. Forked from infinite-kanvas (MIT).

## 주요 기능

| 기능 | 설명 |
|---|---|
| 🖼 **이미지 생성** | 프롬프트 → gpt-image-2. 크기(정사각/가로/세로)·품질 선택 |
| 🔗 **참조 생성** | 캔버스 이미지를 선택하면 다음 생성의 참조가 됨 (**최대 16장** — 로고+무드사진+스케치 조합 가능) |
| ✂️ **부분 수정** | 🖌 브러시로 칠하거나 📍 점을 콕 찍고 지시 → 그 부분만 수정 (마스크 인페인팅) |
| 📄 **제안서 드롭** | md/txt/PDF를 캔버스에 떨어뜨리면 문서를 읽고(gpt-5-mini) 행사명·일시·장소·분위기를 뽑아 **포스터 프롬프트 자동 작성** |
| 🎨 **한국어 프리셋 10종** | 행사 포스터·카드뉴스·수채화·한국 전통·시네마틱 등 |
| 💰 **사용량 표시** | 오늘/누적 호출 수·예상 비용 상시 표시 |
| 📦 **ZIP 다운로드** | 선택한 이미지 일괄 다운로드 |
| 🔒 **키 보호** | API 키는 중계 서버만 보관 — 브라우저·개발자도구 어디에도 노출 안 됨 |

무한 캔버스(팬·줌·다중선택·실행취소·IndexedDB 자동저장)는 베이스 그대로.

## 실행

**요구**: Node.js 20+, OpenAI API 키

```
1. 키 설정 — 사용자 홈의 .env 파일에:  OPENAI_API_KEY=sk-...
   (또는 환경변수 OPENAI_API_KEY)

2. 의존성 설치:
   npm install --ignore-scripts
   ※ 일반 install은 상속받은 지갑 라이브러리의 네이티브 빌드에서 실패한다

3. .env.local 생성:
   NEXT_PUBLIC_APP_URL=http://localhost:3000

4. 실행 (Windows): run-canvas.bat 더블클릭
   (직접 실행 시):  NODE_OPTIONS=--no-experimental-webstorage npm run dev
   ※ Node 22+는 서버 전역에 반쪽짜리 localStorage가 있어 이 옵션 없이는 SSR이 500으로 죽는다

5. http://localhost:3000
```

## 비용 감각

high 품질 1024×1024 기준 1장당 약 $0.3 수준 (토큰 기반 추정 단가는 `src/app/api/usage/route.ts`의 `RATE` 상수에서 조정). 화면 우상단에 예상 비용이 상시 표시된다.

## 알려진 제약

- **마스크는 픽셀 경계가 아니라 "지시 대상 지정"** — 글자·사물 같은 국소 수정은 정확하지만, 넓은 배경 수정은 경계 밖까지 자연스럽게 번질 수 있다 (OpenAI 모델 특성)
- 스캔본 PDF(이미지로 된 PDF)는 텍스트 추출 불가
- 회전된 이미지에는 부분 수정 오버레이 미지원
- 원본의 fal 전용 기능(영상 생성·배경 제거·객체 분리)은 제거됨
- 인증 없음 — 로컬/내부망 사용 전제. 외부망에 그대로 열지 말 것

## Credits & License

MIT — [LICENSE](./LICENSE) 참조.
원작: [fal-ai-community/infinite-kanvas](https://github.com/fal-ai-community/infinite-kanvas) (MIT) — 무한 캔버스·자동저장·실행취소 등 훌륭한 뼈대에 감사를.
