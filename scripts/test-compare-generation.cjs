// The generation route is mocked: this test never spends API credits.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const sharp = require("sharp");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const requests = [];
    const errors = [];
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
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/generate", (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { images: [png], model: "mock" } });
    });
    await page.goto(process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011/");
    await page.locator("#studio-prompt").waitFor({ timeout: 30000 });

    const brief =
      "2026 서울 한국춤 페스티벌 큰 글자로 넣기. 작은 글씨로 일시 2026.12.7~12.8 / 장소 서울남산국악당·남산골한옥마을 표기. 전통과 컨템포러리를 잇는 우아하고 역동적 분위기. 포스터, 세로 구도, 인쇄용 고해상도. 4장을 각각 만들자. 이미지 한개를 4분할 하지 말고 다른 느낌의 4개 이미지를 만들라고";
    await page.locator("#studio-prompt").fill(brief);
    await page.getByLabel("시안 수", { exact: true }).selectOption("4");
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 4,
    );
    assert.equal(requests.length, 4);
    assert(requests.every((request) => request.n === 1));
    assert.equal(new Set(requests.map((request) => request.prompt)).size, 4);
    assert(
      requests.every(
        (request) =>
          request.prompt.includes("2026 서울 한국춤 페스티벌") &&
          request.prompt.includes("2026.12.7~12.8") &&
          request.prompt.includes("서울남산국악당·남산골한옥마을") &&
          request.prompt.includes("독립 이미지 단 한 장") &&
          !request.prompt.includes("4장을 각각 만들자") &&
          !request.prompt.includes("4개 이미지를 만들라고"),
      ),
    );

    await page.getByLabel("시안 수", { exact: true }).selectOption("1");
    const revision =
      "글씨 위치나 구조를 바꿔봐 이미지도 바꿔봐 좀 서로 다른 느낌으로 만들어봐 4장을 뽑아봐";
    await page.locator("#studio-prompt").fill(revision);
    assert(await page.getByLabel("이전 작업 주제 이어가기").isChecked());
    assert(
      (await page.locator(".studio-composer").innerText()).includes(
        "2026 서울 한국춤 페스티벌",
      ),
    );
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 8,
    );
    assert.equal(
      await page.getByLabel("시안 수", { exact: true }).inputValue(),
      "4",
    );
    assert.equal(requests.length, 8);
    assert.equal(
      new Set(requests.slice(4, 8).map((request) => request.prompt)).size,
      4,
    );
    assert(
      requests
        .slice(4, 8)
        .every(
          (request) =>
            request.n === 1 &&
            request.refs.length === 0 &&
            request.prompt.includes("2026 서울 한국춤 페스티벌") &&
            request.prompt.includes("2026.12.7~12.8") &&
            request.prompt.includes("글씨 위치나 구조를 바꿔봐") &&
            !request.prompt.includes("4장을 뽑아봐"),
        ),
    );
    assert(requests[4].prompt.includes("제목을 왼쪽 위"));
    assert(requests[5].prompt.includes("화면 중앙"));
    assert(requests[6].prompt.includes("상징 오브제"));
    assert(requests[7].prompt.includes("상단 절반 이상"));

    await page.getByLabel("시안 수", { exact: true }).selectOption("1");
    await page
      .locator("#studio-prompt")
      .fill(
        "2026 서울 한국춤 페스티벌. 일시 2026.12.7~12.8. 장소 서울남산국악당·남산골한옥마을. 세로 포스터.",
      );
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 9,
    );
    await page
      .locator("#studio-prompt")
      .fill(
        "여백의 미를 살리고 형상을 더 단순화. 앙리 마티스의 느낌을 참고하되 그대로 복제하지 않기.",
      );
    await page.getByText("문구·참조 세부 지시", { exact: true }).click();
    assert(await page.getByLabel("이전 작업 주제 이어가기").isChecked());
    assert.equal(
      await page.getByLabel("참조 이미지 사용 방식").inputValue(),
      "style",
    );
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 10,
    );
    const followup = requests.at(-1);
    assert.equal(followup.refs.length, 1);
    assert(followup.prompt.includes("2026 서울 한국춤 페스티벌"));
    assert(followup.prompt.includes("2026.12.7~12.8"));
    assert(followup.prompt.includes("서울남산국악당·남산골한옥마을"));
    assert(followup.prompt.includes("여백의 미"));
    assert(followup.prompt.includes("참조 이미지의 글자·숫자"));
    assert.notEqual(followup.refs[0], png);
    const styleMeta = await sharp(
      Buffer.from(followup.refs[0].split(",")[1], "base64"),
    ).metadata();
    assert.equal(styleMeta.height, 768);
    assert.equal(styleMeta.width, 768);

    await page.getByLabel("참조 이미지 사용 방식").selectOption("content");
    await page
      .locator("#studio-prompt")
      .fill("같은 그림에서 글자만 조금 조정해봐");
    await page
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("canvas-state") || "{}",
        ).elements?.filter((item) => item.type === "image").length === 11,
    );
    const contentRef = requests.at(-1);
    const contentMeta = await sharp(
      Buffer.from(contentRef.refs[0].split(",")[1], "base64"),
    ).metadata();
    assert.equal(contentMeta.width, 120);
    assert(!contentRef.prompt.includes("참조 이미지의 글자·숫자"));

    const emptyPage = await browser.newPage();
    let unexpectedRequest = false;
    await emptyPage.route("**/api/generate", (route) => {
      unexpectedRequest = true;
      return route.fulfill({ json: { images: [png] } });
    });
    await emptyPage.goto(
      process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011/",
    );
    await emptyPage.locator("#studio-prompt").fill("글씨 위치만 바꿔봐");
    await emptyPage
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await emptyPage
      .getByText("이어갈 작업을 찾지 못했어요", { exact: true })
      .waitFor();
    assert.equal(unexpectedRequest, false);

    const failedPage = await browser.newPage();
    await failedPage.route("**/api/generate", (route) =>
      route.fulfill({ status: 502, json: { error: "참조 이미지 입력 오류" } }),
    );
    await failedPage.goto(
      process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011/",
    );
    await failedPage
      .locator("#studio-prompt")
      .fill("2026 서울 한국춤 페스티벌 포스터");
    await failedPage
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await failedPage
      .locator('.studio-composer [role="alert"]')
      .getByText("참조 이미지 입력 오류")
      .waitFor();

    const partialPage = await browser.newPage();
    let partialCalls = 0;
    await partialPage.route("**/api/generate", (route) => {
      partialCalls++;
      return partialCalls === 1
        ? route.fulfill({ json: { images: [png], model: "mock" } })
        : route.fulfill({ status: 502, json: { error: "두 번째 시안 오류" } });
    });
    await partialPage.goto(
      process.env.CANVAS_TEST_URL || "http://127.0.0.1:3011/",
    );
    await partialPage
      .locator("#studio-prompt")
      .fill("2026 서울 한국춤 페스티벌 포스터");
    await partialPage.getByLabel("시안 수", { exact: true }).selectOption("2");
    await partialPage
      .getByRole("button", { name: "이미지 생성", exact: true })
      .click();
    await partialPage
      .locator('.studio-composer [role="alert"]')
      .getByText(/1장만 완성했어요.*두 번째 시안 오류/)
      .waitFor();
    assert.equal(partialCalls, 2);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: separate variants, inherited brief, style-only text removal, content reference, missing-context guard, visible errors",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
