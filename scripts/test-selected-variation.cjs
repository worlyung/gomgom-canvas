/* eslint-disable @typescript-eslint/no-require-imports */
// The generation route is mocked; this test spends no API credits.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const sharp = require("sharp");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    if (process.env.CANVAS_TEST_DARK)
      await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    const requests = [];
    const pageErrors = [];
    const png =
      "data:image/png;base64," +
      (
        await sharp({
          create: {
            width: 120,
            height: 180,
            channels: 3,
            background: "#c5b28a",
          },
        })
          .png()
          .toBuffer()
      ).toString("base64");
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/generate", (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { images: [png], model: "mock" } });
    });

    await page.goto(process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011/");
    const prompt = page.locator("#studio-prompt");
    await page
      .locator("#studio-prompt:not([disabled])")
      .waitFor({ timeout: 30000 });
    const promptBox = await prompt.boundingBox();
    const sidebarBox = await page.locator(".studio-composer").boundingBox();
    assert(promptBox && promptBox.height >= 260);
    assert(sidebarBox && sidebarBox.width >= 420);
    assert.equal(
      await page
        .locator(".studio-ratio-grid")
        .evaluate(
          (grid) =>
            getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        ),
      3,
    );
    const original =
      "2026 서울 한국춤 페스티벌. 일시 2026.12.7~12.8. 장소 서울남산국악당·남산골한옥마을. 세로 포스터.";
    await prompt.fill(original);
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 1,
    );
    const variationButton = page.getByRole("button", {
      name: /이 시안으로 4장 변형/,
    });
    const buttonLayout = await page
      .locator(".studio-properties button")
      .evaluateAll((buttons) =>
        buttons.map((button) => ({
          background: getComputedStyle(button).backgroundColor,
          clipped: button.scrollWidth > button.clientWidth + 1,
        })),
      );
    assert(buttonLayout.every((button) => !button.clipped));
    assert.equal(buttonLayout[0].background, buttonLayout[1].background);
    if (process.env.CANVAS_TEST_SCREENSHOT) {
      await page.locator(".studio-composer").evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({ path: process.env.CANVAS_TEST_SCREENSHOT });
    }
    if (process.env.CANVAS_TEST_SETTINGS_SCREENSHOT) {
      await page.locator(".studio-composer").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.screenshot({
        path: process.env.CANVAS_TEST_SETTINGS_SCREENSHOT,
      });
    }
    await variationButton.click();
    const dialog = page.getByRole("dialog", { name: "이 시안으로 4장 변형" });
    await dialog
      .getByLabel("이 시안에서 바꿀 점")
      .fill("제목을 하단으로 옮기고 붉은색을 줄여줘");
    assert(
      await dialog.getByRole("radio", { name: /분위기만 유지/ }).isChecked(),
    );
    await dialog.getByRole("button", { name: "4장 생성" }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 5,
    );
    assert.equal(requests.length, 5);
    assert.equal(
      new Set(requests.slice(1).map((request) => request.prompt)).size,
      4,
    );
    assert(
      requests
        .slice(1)
        .every(
          (request) =>
            request.n === 1 &&
            request.refs.length === 1 &&
            request.prompt.includes("2026 서울 한국춤 페스티벌") &&
            request.prompt.includes("2026.12.7~12.8") &&
            request.prompt.includes("서울남산국악당·남산골한옥마을") &&
            request.prompt.includes("제목을 하단으로 옮기고 붉은색을 줄여줘") &&
            request.prompt.includes("참조 이미지의 글자·숫자"),
        ),
    );
    assert.equal(await prompt.inputValue(), original);
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state")),
    );
    const images = state.elements.filter((item) => item.type === "image");
    assert(
      images
        .slice(1)
        .every(
          (image) =>
            image.transform.y > images[0].transform.y + images[0].height,
        ),
    );
    assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
    const referencePage = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const referenceRequests = [];
    await referencePage.route("**/api/generate", (route) => {
      referenceRequests.push(route.request().postDataJSON());
      return route.fulfill({ json: { images: [png], model: "mock" } });
    });
    await referencePage.goto(
      process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011/",
    );
    await referencePage.locator("#studio-prompt:not([disabled])").waitFor();
    const chooserPromise = referencePage.waitForEvent("filechooser");
    await referencePage.getByRole("button", { name: "+ 이미지 추가" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "reference.png",
      mimeType: "image/png",
      buffer: Buffer.from(png.split(",")[1], "base64"),
    });
    await referencePage.getByText("참조 이미지 1장 선택됨").waitFor();
    await referencePage.locator("#studio-prompt").fill(original);
    await referencePage
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await referencePage.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 2,
    );
    assert.equal(referenceRequests[0].refs.length, 1);
    console.log(
      "selected variation and reference upload: mock requests, prompt continuity and layout passed",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
