const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  try {
    await page.goto("http://localhost:3012");
    await page
      .getByRole("button", { name: "원본으로 홍보물", exact: true })
      .click();
    await page
      .getByLabel("포스터 원본 업로드")
      .setInputFiles(path.resolve("public/layout-catalog/143.jpg"));
    await page.getByAltText("보존할 원본").waitFor();
    await page
      .getByLabel("원본 포스터 구도", { exact: true })
      .selectOption("140");
    const title = "2026 서울 한국춤 페스티벌 전통과 현대가 함께하는 특별공연 "
      .repeat(12)
      .trim();
    const info =
      "2026.12.7~12.8 서울남산국악당·남산골한옥마을 공연과 체험 프로그램 안내\n"
        .repeat(35)
        .trim();
    await page.getByLabel("홍보물 제목").fill(title);
    await page.getByLabel("홍보물 정보").fill(info);
    await page
      .getByRole("button", { name: "원본 보존 초안 만들기", exact: true })
      .click();
    await page.getByText(/문구를 모두 넣어 초안을 만들었어요/).waitFor();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((e) => e.type === "text").length === 2,
    );
    const texts = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("canvas-state")).elements.filter(
        (e) => e.type === "text",
      ),
    );
    assert.equal(texts[0].text.replace(/\s/g, ""), title.replace(/\s/g, ""));
    assert.equal(texts[1].text.replace(/\s/g, ""), info.replace(/\s/g, ""));
    assert(texts.every((t) => t.fontSize >= 14));
    await page.getByRole("button", { name: "크게 열어 집중 편집" }).click();
    await page.getByRole("heading", { name: "포스터 집중 편집" }).waitFor();
    console.log(
      "PASS: long title and 35-line information produce an editable draft without discarded copy",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
