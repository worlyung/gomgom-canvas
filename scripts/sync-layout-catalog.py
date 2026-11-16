"""Vendor the attributed layout catalog and thumbnails at one immutable revision."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
REPO = 'worlyung/korean-layout-compositions'

def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()

def main():
    revision = json.loads(fetch(f'https://api.github.com/repos/{REPO}/commits/main'))['sha']
    base = f'https://raw.githubusercontent.com/{REPO}/{revision}/'
    catalog = json.loads(fetch(base + 'catalog.json'))
    assert len({x['id'] for x in catalog}) == len(catalog)
    target = ROOT / 'public/layout-catalog'
    target.mkdir(parents=True, exist_ok=True)
    def thumbnail(row):
        data = fetch(base + urllib.parse.quote(row['thumbnail']))
        assert data[:2] == b'\xff\xd8', row['id']
        (target / f"{row['id']}.jpg").write_bytes(data)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(thumbnail, catalog))
    (ROOT / 'src/lib/composition-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (target / 'LICENSE.txt').write_bytes(fetch(base + 'LICENSE'))
    (target / 'SOURCE.json').write_text(json.dumps({'repository':f'https://github.com/{REPO}', 'revision':revision,'count':len(catalog),'license':'CC BY 4.0','author':'정재훈 / 한국형 레이아웃 구성 도감','changes':'원문 설명과 썸네일 보존. 썸네일 파일명은 번호로 변경. 자동 배치 구현은 별도 작성.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Imported {len(catalog)} thumbnails at {revision}')

if __name__ == '__main__':
    main()
