const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
(async () => {
  const dir = path.resolve(
    process.env.LAYER_TEST_DIR || ".tmp/layer-poster-live",
  );
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    storageState: path.join(dir, "browser-state.json"),
  });
  const page = await context.newPage();
  try {
    await page.goto(process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011");
    await page.getByTestId("layer-poster-studio").waitFor();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state")),
    );
    const before = JSON.parse(
      fs.readFileSync(path.join(dir, "initial-state.json"), "utf8"),
    );
    const target = before.elements
      .filter((e) => e.generation?.layerPoster?.role === "element")
      .at(-1);
    const after = saved.elements.find((e) => e.id === target.id);
    assert.notEqual(after.transform.x, target.transform.x);
    const pixel = await page.evaluate(
      (id) =>
        new Promise((resolve, reject) => {
          const q = indexedDB.open("infinite-kanvas-db");
          q.onsuccess = () => {
            const db = q.result;
            const r = db.transaction("images").objectStore("images").get(id);
            r.onsuccess = () => {
              resolve(r.result.originalDataUrl);
              db.close();
            };
            r.onerror = reject;
          };
          q.onerror = reject;
        }),
      target.id,
    );
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^image-.*png$/.test(f))
      .sort();
    assert.equal(
      pixel.split(",")[1],
      fs.readFileSync(path.join(dir, files.at(-1))).toString("base64"),
      "replacement pixels must survive reload",
    );
    await page.getByRole("button", { name: /보드 저장.*열기/ }).click();
    await page
      .getByPlaceholder("새 보드 이름")
      .fill("한국춤 페스티벌 · 레이어 포스터 실생성 검증");
    const savedResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/boards") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "새로 저장", exact: true }).click();
    const result = await (await savedResponse).json();
    assert(result.ok);
    fs.writeFileSync(
      path.join(dir, "saved-board.json"),
      JSON.stringify(result.meta, null, 2),
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.getByRole("button", { name: "작업 관리", exact: true }).click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "프로젝트 내보내기", exact: true })
      .click();
    const dest =
      process.env.LAYER_TEST_EXPORT ||
      "C:/Users/Admin/Desktop/한국춤페스티벌_레이어포스터_테스트.gomgom.json";
    await (await download).saveAs(dest);
    const project = JSON.parse(fs.readFileSync(dest, "utf8"));
    assert.equal(
      project.project.images.length,
      saved.elements.filter((e) => e.generation?.layerPoster).length,
    );
    assert.equal(project.project.texts.length, 2);
    assert(project.project.artboard);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.screenshot({
      path: "C:/Users/Admin/Desktop/한국춤페스티벌_레이어포스터_테스트.png",
    });
    console.log(
      "PASS: replaced pixels persisted, named board saved, portable project exported",
      dest,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
