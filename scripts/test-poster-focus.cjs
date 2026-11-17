const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const out = path.resolve(".tmp/poster-focus");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(process.env.CANVAS_TEST_URL || "http://localhost:3012");
    await page
      .getByRole("button", { name: "원본으로 홍보물", exact: true })
      .click();
    await page
      .getByLabel("포스터 원본 업로드")
      .setInputFiles(path.resolve("public/layout-catalog/143.jpg"));
    await page.getByAltText("보존할 원본").waitFor();
    await page.getByLabel("홍보물 제목").fill("2026 서울 한국춤 페스티벌");
    await page
      .getByLabel("홍보물 정보")
      .fill("2026.12.7~12.8\n서울남산국악당·남산골한옥마을");
    await page
      .getByRole("button", { name: "원본 보존 초안 만들기", exact: true })
      .click();
    await page.getByRole("button", { name: "크게 열어 집중 편집" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "포스터 집중 편집" }).waitFor();
    await dialog
      .getByRole("button", { name: "글자 추가", exact: true })
      .click();
    await dialog.getByLabel("글자 내용").fill("한국춤\n함께 춤추는 서울");
    await dialog.getByLabel("내 폰트 파일").setInputFiles({
      name: "broken.ttf",
      mimeType: "font/ttf",
      buffer: Buffer.from("invalid font"),
    });
    await dialog.getByRole("status").waitFor();
    await dialog
      .getByLabel("내 폰트 파일")
      .setInputFiles(
        path.resolve("public/fonts/commit/CommitMono-400-Regular.otf"),
      );
    await dialog
      .getByText("CommitMono-400-Regular.otf 적용됨", { exact: true })
      .waitFor();
    const chooserPromise = page.waitForEvent("filechooser");
    await dialog
      .getByRole("button", { name: "내 폰트 넣기 · TTF / OTF" })
      .click();
    await (await chooserPromise).setFiles("C:/Windows/Fonts/malgun.ttf");
    await dialog.getByText("malgun.ttf 적용됨", { exact: true }).waitFor();
    await dialog.getByLabel("글자 크기", { exact: true }).fill("64");
    await dialog.getByLabel("자간", { exact: true }).fill("3");
    await dialog.getByLabel("줄간격", { exact: true }).fill("1.4");
    await dialog.getByLabel("글자색", { exact: true }).fill("#e11d48");
    await dialog.getByLabel("외곽선색", { exact: true }).fill("#ffffff");
    await dialog.getByLabel("외곽선 두께", { exact: true }).fill("2");
    await dialog
      .getByRole("button", { name: "가운데 정렬", exact: true })
      .click();
    await dialog.getByLabel("그림자", { exact: true }).check();
    await dialog.getByLabel("그림자 흐림", { exact: true }).fill("8");
    const board = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gomgom-artboard")),
    );
    const rect = await dialog.getByLabel("집중 편집 작업 영역").boundingBox();
    const scale = Math.min(
      (rect.width - 64) / board.width,
      (rect.height - 64) / board.height,
    );
    const start = {
      x:
        rect.x +
        (rect.width - board.width * scale) / 2 +
        (board.width * 0.1 + 20) * scale,
      y:
        rect.y +
        (rect.height - board.height * scale) / 2 +
        (board.height * 0.1 + 64 * 1.4 + 25) * scale,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 200, { steps: 15 });
    await page.mouse.up();
    await page.screenshot({ path: path.join(out, "focus-font.png") });
    const downloaded = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "포스터 PNG 저장", exact: true })
      .click();
    const file = await downloaded;
    await file.saveAs(path.join(out, "poster.png"));
    assert(fs.statSync(path.join(out, "poster.png")).size > 10000);
    const metadata = await require("sharp")(
      path.join(out, "poster.png"),
    ).metadata();
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 1536);
    await dialog
      .getByRole("button", { name: "전체 캔버스로 돌아가기" })
      .click();
    await page.waitForFunction(() =>
      JSON.parse(localStorage.getItem("canvas-state") || "{}").elements?.some(
        (e) => e.text === "한국춤\n함께 춤추는 서울",
      ),
    );
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state")).elements.find(
        (e) => e.text === "한국춤\n함께 춤추는 서울",
      ),
    );
    assert.equal(before.fontSize, 64);
    assert.equal(before.letterSpacing, 3);
    assert.equal(before.lineHeight, 1.4);
    assert.equal(before.shadowBlur, 8);
    assert.equal(before.strokeWidth, 2);
    assert.match(before.fontFamily, /GomgomFont-/);
    assert(
      Math.abs(
        before.transform.x - (board.x + board.width * 0.1 + 40 / scale),
      ) < 3,
      "drag x persisted",
    );
    assert(
      Math.abs(
        before.transform.y - (board.y + board.height * 0.1 + 200 / scale),
      ) < 3,
      "drag y persisted",
    );
    const savedView = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state")),
    );
    const source = savedView.elements.find((e) => e.type === "image");
    const canvasRect = await page
      .locator(".konvajs-content")
      .first()
      .boundingBox();
    await page.mouse.dblclick(
      canvasRect.x +
        savedView.viewport.x +
        (source.transform.x + source.width / 2) * savedView.viewport.scale,
      canvasRect.y +
        savedView.viewport.y +
        (source.transform.y + source.height / 2) * savedView.viewport.scale,
    );
    await dialog
      .getByRole("button", { name: "한국춤 함께 춤추는 서울", exact: true })
      .click();
    assert.equal(
      await dialog.getByLabel("자간", { exact: true }).inputValue(),
      "3",
    );
    await page.setViewportSize({ width: 720, height: 900 });
    await page.screenshot({ path: path.join(out, "focus-narrow.png") });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await dialog
      .getByRole("button", { name: "전체 캔버스로 돌아가기" })
      .click();
    await page.reload();
    await page.waitForFunction(() =>
      Array.from(document.fonts).some(
        (f) => f.family.startsWith("GomgomFont-") && f.status === "loaded",
      ),
    );
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state")).elements.find(
        (e) => e.text === "한국춤\n함께 춤추는 서울",
      ),
    );
    assert.deepEqual(after, before);
    await page.screenshot({ path: path.join(out, "after-reload.png") });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: actual TTF/OTF import, invalid font recovery, text effects, drag, focus reopen, PNG download, narrow screen, reload font and properties",
    );
  } catch (e) {
    await page.screenshot({ path: path.join(out, "failure.png") });
    console.log(await page.locator("body").innerText());
    console.log(
      await page.evaluate(() => ({
        fonts: Array.from(document.fonts).map((f) => ({
          family: f.family,
          status: f.status,
        })),
        saved: localStorage.getItem("canvas-state"),
      })),
    );
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
