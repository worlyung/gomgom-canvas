# -*- coding: utf-8 -*-
"""프리셋 썸네일용 실제 샘플 생성 — 각 스타일 프롬프트 + 공통 소재, low 품질 1024 → 512 축소"""
import os
import subprocess
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "images", "styles")
TMP = os.path.join(HERE, "..", ".samples-tmp")
API = "C:/Users/Admin/.claude/skills/gomgom-image/tools/gpt_image_api.py"
os.makedirs(TMP, exist_ok=True)

# (파일id, 소재+스타일 프롬프트) — models.ts의 프리셋 프롬프트와 같은 결)
SAMPLES = [
    ("kr-poster", "가을 지역 축제 행사 포스터. 밝고 따뜻한 색감, 명확한 중심 소재, 글자 없이 비주얼만"),
    ("kr-cardnews", "인스타그램 카드뉴스 표지 느낌. 미니멀 플랫 디자인, 넓은 단색 배경, 중앙에 단순한 축제 그래픽, 글자 없음"),
    ("kr-watercolor", "가을 공원의 은행나무, 부드러운 수채화 일러스트, 따뜻한 색조, 종이 질감"),
    ("kr-flat", "공연 무대와 관객, 모던 플랫 벡터 일러스트, 단순한 도형, 파스텔 팔레트"),
    ("kr-photo", "가을 공원 야외 공연장, 포토리얼 실사 사진, 자연광, 얕은 심도"),
    ("kr-iso3d", "작은 축제 무대와 부스, 귀여운 3D 아이소메트릭 렌더, 부드러운 조명, 파스텔"),
    ("kr-logo", "은행잎 모티프 미니멀 로고 심볼, 흰 배경, 단순한 기하 도형, 2색"),
    ("kr-storybook", "곰 인형과 아이가 공원을 걷는 장면, 따뜻한 동화책 삽화, 크레용 질감"),
    ("kr-korean", "한옥과 소나무, 한국 전통 미술 감성, 한지 질감, 수묵 담채, 오방색 포인트"),
    ("kr-cinematic", "노을 지는 축제 현장, 시네마틱 영화 스틸컷, 극적인 조명, 깊이 있는 색보정"),
]

fails = []
for fid, prompt in SAMPLES:
    tmp_png = os.path.join(TMP, f"{fid}.png")
    r = subprocess.run(
        [sys.executable, API, "--prompt", prompt, "--out", tmp_png,
         "--size", "1024x1024", "--quality", "low", "--n", "1"],
        capture_output=True, text=True, timeout=300,
    )
    if not os.path.isfile(tmp_png):
        fails.append((fid, (r.stderr or r.stdout)[-150:]))
        print("FAIL", fid)
        continue
    img = Image.open(tmp_png).convert("RGB").resize((512, 512))
    img.save(os.path.join(OUT, f"{fid}.png"), optimize=True)
    print("ok", fid)

print("done, fails:", fails)
