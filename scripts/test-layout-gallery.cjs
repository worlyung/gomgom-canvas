const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const out = path.resolve(".tmp/layout-gallery-check");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("http://localhost:3012");
    await page
      .getByRole("button", {
        name: "전체 구도 썸네일 보기 · 278종",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(
      await page.getByTestId("layout-gallery-grid").getByRole("button").count(),
      24,
    );
    const catalog = require("../src/lib/composition-catalog.json");
    assert.equal(catalog.length, 278);
    // Every thumbnail ships and decodes locally, not merely the first screen.
    const valid = await page.evaluate(
      async (ids) => {
        let count = 0;
        for (let i = 0; i < ids.length; i += 12)
          await Promise.all(
            ids.slice(i, i + 12).map(async (id) => {
              const image = new Image();
              image.src = "/layout-catalog/" + id + ".jpg";
              await image.decode();
              if (image.naturalWidth > 0) count++;
            }),
          );
        return count;
      },
      catalog.map((c) => c.id),
    );
    assert.equal(valid, 278);
    await page.screenshot({ path: path.join(out, "gallery.png") });
    await dialog.getByRole("button", { name: "다음", exact: true }).click();
    assert.match(
      await page
        .getByTestId("layout-gallery-grid")
        .getByRole("button")
        .first()
        .textContent(),
      /25\./,
    );
    await page
      .getByLabel("구도 분류", { exact: true })
      .selectOption("한국 전통 구도");
    assert(
      (await page.getByTestId("layout-gallery-grid").textContent()).includes(
        "참고용",
      ),
    );
    await page.getByLabel("구도 검색", { exact: true }).fill("없는구도문구");
    await page
      .getByText("검색 결과가 없어요. 다른 이름으로 검색하세요.")
      .waitFor();
    await page.getByLabel("구도 검색", { exact: true }).fill("");
    await page.getByLabel("구도 분류", { exact: true }).selectOption("전체");
    await page.getByLabel("지금 적용 가능한 구도만").check();
    assert.equal(
      await page.getByTestId("layout-gallery-grid").getByRole("button").count(),
      24,
    );
    await page.getByLabel("구도 검색", { exact: true }).fill("곁단 판면");
    await page.getByTestId("layout-gallery-grid").getByRole("button").click();
    await page
      .getByRole("button", { name: "이 구도 적용", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("포스터 구도", { exact: true }).inputValue(),
      "156",
    );
    await page
      .getByRole("button", { name: "원본으로 홍보물", exact: true })
      .click();
    assert.equal(
      await page
        .getByLabel("원본 포스터 구도", { exact: true })
        .locator("option")
        .count(),
      12,
    );
    await page
      .getByRole("button", {
        name: "전체 구도 썸네일 보기 · 278종",
        exact: true,
      })
      .click();
    await page.getByLabel("지금 적용 가능한 구도만").check();
    assert.equal(
      await page.getByTestId("layout-gallery-grid").getByRole("button").count(),
      12,
    );
    await page.getByLabel("구도 검색", { exact: true }).fill("실루엣");
    await page.getByLabel("지금 적용 가능한 구도만").uncheck();
    await page.getByTestId("layout-gallery-grid").getByRole("button").click();
    assert.equal(
      await page
        .getByRole("button", { name: "이 구도 적용", exact: true })
        .count(),
      0,
    );
    await page.keyboard.press("Escape");
    const fixture = path.resolve("public/layout-catalog/143.jpg");
    const src =
      "data:image/jpeg;base64," + fs.readFileSync(fixture).toString("base64");
    await page.getByLabel("포스터 원본 업로드").setInputFiles(fixture);
    await page.getByAltText("보존할 원본").waitFor();
    await page.getByLabel("홍보물 제목").fill("2026 서울 한국춤 페스티벌");
    await page
      .getByLabel("홍보물 정보")
      .fill("2026.12.7~12.8\n서울남산국악당·남산골한옥마을");
    const ids = await page
      .getByLabel("원본 포스터 구도", { exact: true })
      .locator("option")
      .evaluateAll((options) => options.map((o) => o.value));
    const signatures = [];
    for (let index = 0; index < ids.length; index++) {
      await page
        .getByLabel("원본 포스터 구도", { exact: true })
        .selectOption(ids[index]);
      await page
        .getByRole("button", { name: "원본 보존 초안 만들기", exact: true })
        .click();
      await page.waitForFunction(
        (n) =>
          JSON.parse(
            localStorage.getItem("canvas-state") || "{}",
          ).elements?.filter((e) => e.promptHint === "포스터 원본 이미지")
            .length === n,
        index + 1,
      );
      const result = await page.evaluate(async () => {
        const state = JSON.parse(localStorage.getItem("canvas-state")),
          board = JSON.parse(localStorage.getItem("gomgom-artboard"));
        const img = state.elements
            .filter((e) => e.promptHint === "포스터 원본 이미지")
            .at(-1),
          texts = state.elements.filter((e) => e.type === "text").slice(-2);
        const db = await new Promise((r) => {
          const q = indexedDB.open("infinite-kanvas-db");
          q.onsuccess = () => r(q.result);
        });
        const data = await new Promise((r) => {
          const q = db
            .transaction("images")
            .objectStore("images")
            .get(img.imageId);
          q.onsuccess = () => r(q.result);
        });
        db.close();
        return { img, texts, board, src: data.originalDataUrl };
      });
      assert.equal(result.src, src);
      assert.equal(result.texts.length, 2);
      assert.equal(
        result.texts[0].text.replace(/\s/g, ""),
        "2026서울한국춤페스티벌",
      );
      for (const element of [result.img, ...result.texts]) {
        assert(element.transform.x >= result.board.x);
        assert(element.transform.y >= 0);
        assert(element.transform.x < result.board.x + 1024);
        assert(element.transform.y < 1536);
      }
      signatures.push(
        JSON.stringify([
          result.img.transform.x - result.board.x,
          result.img.transform.y,
          result.img.width,
          result.img.height,
        ]),
      );
      if (["13", "156"].includes(ids[index]))
        await page.screenshot({
          path: path.join(out, "layout-" + ids[index] + ".png"),
        });
    }
    assert.equal(
      new Set(signatures).size,
      12,
      "all twelve source layouts have distinct placements",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS 278 local thumbnails; category/search/pagination; 24 AI choices; 12 distinct real source layouts; original bytes and editable text retained",
    );
  } catch (e) {
    await page.screenshot({ path: path.join(out, "error.png") });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
