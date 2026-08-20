# -*- coding: utf-8 -*-
"""한국어 프리셋 라벨 타일 생성 (150x150 PNG) — 실제 샘플 이미지로 교체 전까지의 썸네일"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "images", "styles")
os.makedirs(OUT, exist_ok=True)

TILES = [
    ("kr-poster", "행사\n포스터", (233, 84, 32)),
    ("kr-cardnews", "카드\n뉴스", (52, 120, 246)),
    ("kr-watercolor", "수채화", (72, 160, 141)),
    ("kr-flat", "플랫\n일러스트", (155, 89, 182)),
    ("kr-photo", "실사\n사진", (44, 62, 80)),
    ("kr-iso3d", "3D\n아이소", (230, 126, 34)),
    ("kr-logo", "로고\n심볼", (127, 140, 141)),
    ("kr-storybook", "동화\n삽화", (241, 148, 138)),
    ("kr-korean", "한국\n전통", (146, 43, 33)),
    ("kr-cinematic", "시네\n마틱", (40, 55, 71)),
]

font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30)

for fid, label, color in TILES:
    img = Image.new("RGB", (150, 150), color)
    d = ImageDraw.Draw(img)
    # 살짝 어두운 하단 그라데이션 느낌의 밴드
    d.rectangle([0, 100, 150, 150], fill=tuple(max(0, c - 25) for c in color))
    bbox = d.multiline_textbbox((0, 0), label, font=font, align="center")
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.multiline_text(((150 - w) / 2, (150 - h) / 2 - bbox[1]), label,
                     font=font, fill="white", align="center")
    img.save(os.path.join(OUT, f"{fid}.png"))

print("tiles saved:", len(TILES))
