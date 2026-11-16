// Explicit opt-in: this test makes paid image generation requests.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
if (process.env.LIVE_LAYER_POSTER !== "1")
  throw new Error("Set LIVE_LAYER_POSTER=1 for paid test");
(async () => {
  const dir = path.resolve(
    process.env.LAYER_TEST_DIR || ".tmp/layer-poster-live",
  );
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
  });
  const page = await ctx.newPage();
  if (process.env.REUSE_LAYER_ASSETS === "1") {
    const initial = JSON.parse(
      fs.readFileSync(path.join(dir, "initial-state.json"), "utf8"),
    );
    const plan = initial.elements.find((e) => e.generation?.layerPoster)
      .generation.layerPoster.plan;
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^image-.*png$/.test(f))
      .sort()
      .slice(0, plan.elements.length + 1);
    let index = 0;
    await page.route("**/api/layer-poster-plan", (r) =>
      r.fulfill({ json: plan }),
    );
    await page.route("**/api/generate", (r) =>
      index < files.length
        ? r.fulfill({
            json: {
              images: [
                "data:image/png;base64," +
                  fs
                    .readFileSync(path.join(dir, files[index++]))
                    .toString("base64"),
              ],
              model: "gpt-image-2.6-sunburst",
            },
          })
        : r.continue(),
    );
  }
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/generate")) {
      const j = await r.json();
      if (j.images) {
        fs.writeFileSync(
          path.join(dir, `image-${Date.now()}.png`),
          Buffer.from(j.images[0].split(",")[1], "base64"),
        );
        console.log("image saved", j.model);
      } else console.log("generation error", j.error);
    }
  });
  const state = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state") || "{}"),
    );
  try {
    await page.goto(process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011");
    await page
      .getByRole("button", { name: "레이어 포스터", exact: true })
      .click();
    await page
      .getByRole("button", { name: "기획·구도 만들기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "레이어 초안 생성", exact: true })
      .waitFor({ timeout: 150000 });
    console.log("plan ready");
    await page
      .getByRole("button", { name: "레이어 초안 생성", exact: true })
      .click();
    await page
      .getByRole("button", { name: "기획·구도 만들기", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-testid="layer-poster-studio"] fieldset')
          .disabled,
      {},
      { timeout: 1200000 },
    );
    const alert = page.locator(
      '[data-testid="layer-poster-studio"] [role="alert"]',
    );
    if (await alert.count()) throw new Error(await alert.innerText());
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((e) => e.generation?.layerPoster).length >= 3,
    );
    let before = await state();
    fs.writeFileSync(
      path.join(dir, "initial-state.json"),
      JSON.stringify(before, null, 2),
    );
    await page.screenshot({ path: path.join(dir, "initial.png") });
    const element = before.elements
      .filter((e) => e.generation?.layerPoster?.role === "element")
      .at(-1);
    const viewport = before.viewport;
    console.log("viewport", viewport);
    const box = await page.locator(".konvajs-content").boundingBox();
    const px =
      box.x +
      viewport.x +
      (element.transform.x + element.width / 2) * viewport.scale;
    const py =
      box.y +
      viewport.y +
      (element.transform.y + element.height / 2) * viewport.scale;
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 45, py + 25, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    let moved = (await state()).elements.find((e) => e.id === element.id);
    assert.notEqual(
      moved.transform.x,
      element.transform.x,
      "drag must change x",
    );
    console.log("drag passed");
    await page
      .getByLabel("요소 수정 요청")
      .fill(
        "같은 그림체와 색감을 유지하고 형태를 더 단순하고 우아하게 바꿔줘. 요소 하나만 투명 배경으로.",
      );
    await page
      .getByRole("button", { name: "선택 요소 수정안", exact: true })
      .click();
    await page
      .getByRole("button", { name: "이 수정안으로 교체", exact: true })
      .waitFor({ timeout: 600000 });
    await page
      .getByRole("button", { name: "이 수정안으로 교체", exact: true })
      .click();
    await page.waitForTimeout(1500);
    const replaced = (await state()).elements.find((e) => e.id === element.id);
    assert.deepEqual(replaced.transform, moved.transform);
    assert.equal(replaced.width, moved.width);
    assert.equal(replaced.height, moved.height);
    await page.screenshot({ path: path.join(dir, "replaced.png") });
    fs.writeFileSync(
      path.join(dir, "final-state.json"),
      JSON.stringify(await state(), null, 2),
    );
    await page.reload();
    await page.waitForTimeout(2500);
    const restored = (await state()).elements.find((e) => e.id === element.id);
    assert.deepEqual(restored.transform, moved.transform);
    assert.equal(
      restored.generation.layerPoster.title,
      "2026 서울 한국춤 페스티벌",
    );
    await page.screenshot({ path: path.join(dir, "restored.png") });
    await ctx.storageState({
      path: path.join(dir, "browser-state.json"),
      indexedDB: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: live planning, separated images/text, drag, replacement geometry, reload persistence",
    );
  } catch (e) {
    await page.screenshot({ path: path.join(dir, "error.png") });
    console.error(e);
    process.exitCode = 1;
  } finally {
    await ctx.storageState({
      path: path.join(dir, "browser-state.json"),
      indexedDB: true,
    });
    await browser.close();
  }
})();
