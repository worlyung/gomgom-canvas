// Verify default routing without another paid generation.
const assert = require("assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = require("sharp");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const png = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: "#a06442",
      },
    })
      .png()
      .toBuffer();
    const src = `data:image/png;base64,${png.toString("base64")}`;
    const calls = [];
    await page.route("**/api/generate", (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ json: { images: [src] } });
    });
    await page.route("**/api/cutout", () => {
      throw Error("Default must not call free cutout");
    });
    await page.goto(process.env.CANVAS_TEST_URL || "http://127.0.0.1:3000");
    await page.locator("#studio-prompt").fill("test");
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.getByRole("button", { name: "배경 제거", exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].openaiModel, "gpt-image-2.6-sunburst");
    assert.equal(calls[1].provider, "openai");
    assert.equal(calls[1].openaiModel, "gpt-image-2.6-sunburst");
    assert.equal(calls[1].transparent, true);
    assert.equal(calls[1].refs.length, 1);
    console.log(
      "PASS default generation and background removal use GPT Image 2.6 Sunburst",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
