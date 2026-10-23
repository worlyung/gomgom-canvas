# 곰곰 캔버스 지도 도구

- 원본: https://github.com/worlyung/krmap
- 기준 커밋: `6e0b51ce7e5bda6247b847542884fbb309fa43ff`
- `web/`를 복사했으며 코드·데이터·글꼴 사용 조건은 LICENSE와 NOTICE.md에 있어요.
- 로컬 변경: app.js의 `window.exportMapForCanvas()`가 기존 PNG 내보내기로 만든 Blob을 캔버스에 전달해요. 화면 확대와 관계없이 전체 내보내기 구성과 출처를 보존해요.
- 업데이트할 때 이 연결 함수를 유지하고 지도 열기, 지역 변경, 캔버스로 가져오기, 되돌리기를 확인해요.
