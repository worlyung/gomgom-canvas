// 지도 옆 순위·분포 차트의 미리보기, 저장, 캔버스 가져오기를 실제 화면에서 확인한다.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { unzipSync } = require("fflate");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const output = process.env.MAP_TEST_OUTPUT || path.resolve(".tmp/map-charts-test");
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.CANVAS_TEST_URL || "http://127.0.0.1:3000/");
    await page.getByRole("button", { name: "지도 만들기", exact: true }).click();
    const frame = await (await page.locator('iframe[title="대한민국 지도 편집기"]').elementHandle()).contentFrame();
    await frame.waitForFunction(() => !!document.querySelector("#map svg"));
    await frame.locator('#ptab [data-v="data"]').click();
    await frame.locator('#dataSrc [data-v="stats"]').click();
    await frame.locator('#statQuick [data-id="old60R"]').click();
    await frame.locator("#charts").selectOption("both");
    try {
      await frame.waitForFunction(() => document.querySelectorAll("#chartPreview > svg").length === 2, {}, { timeout: 30000 });
    } catch (error) {
      console.error("차트 상태:", await frame.locator("#chartPreview").textContent(), "화면 오류:", errors);
      await page.screenshot({ path: path.join(output, "map-charts-failed.png") });
      throw error;
    }
    assert.equal(await frame.locator("#chartPreview").isVisible(), true);
    assert.match(await frame.locator("#chartPreview").textContent(), /지역별 순위/);
    await page.screenshot({ path: path.join(output, "map-charts-preview.png") });

    const download = async (button, ext) => {
      const [file] = await Promise.all([page.waitForEvent("download"), frame.locator(button).click()]);
      assert(file.suggestedFilename().endsWith(ext));
      const filename = path.join(output, `map-charts${ext}`);
      await file.saveAs(filename);
      return fs.readFileSync(filename);
    };
    const svg = (await download("#dlSvg", ".svg")).toString("utf8");
    assert.match(svg, /지역별 순위/);
    assert.match(svg, /전국 속 위치/);
    const png = await download("#dlPng", ".png");
    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
    assert(png.readUInt32BE(16) > 4000, "차트가 붙은 PNG 가 지도보다 넓어야 해요");
    const pptx = unzipSync(await download("#dlPptx", ".pptx"));
    assert(pptx["ppt/slides/slide1.xml"], "PPTX 슬라이드가 필요해요");
    assert(Object.keys(pptx).filter((name) => /^ppt\/media\/.*\.png$/.test(name)).length >= 2, "차트 그림 두 장이 필요해요");
    const work = JSON.parse((await download("#saveWork", ".json")).toString("utf8"));
    assert.equal(work.state.charts, "both", "차트 선택이 작업 파일에 남아야 해요");
    await frame.locator("#deckAdd").click();
    const deck = unzipSync(await download("#deckSave", ".pptx"));
    assert(deck["ppt/slides/slide1.xml"]);
    assert(Object.keys(deck).filter((name) => /^ppt\/media\/.*\.png$/.test(name)).length >= 2, "묶음 PPTX에도 차트가 필요해요");

    const imported = await frame.evaluate(async () => {
      const { blob } = await window.exportMapForCanvas();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { width: new DataView(bytes.buffer).getUint32(16), height: new DataView(bytes.buffer).getUint32(20) };
    });
    assert(imported.width > 4000 && imported.height > 1000);
    await page.getByRole("button", { name: "캔버스에 넣기", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("canvas-state") || "{}").elements?.some((e) => e.type === "image" && e.id.startsWith("map-")), {}, { timeout: 30000 });
    assert.deepEqual(errors, []);
    console.log("PASS map charts: preview, SVG, PNG, PPTX, saved work, slide deck, canvas import");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
