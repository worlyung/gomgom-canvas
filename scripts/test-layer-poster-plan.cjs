const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const ts = require("typescript");
const file = path.resolve("src/lib/layer-poster.ts");
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = module.paths;
loaded._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const { parsePosterPlan, posterPlanResponseFormat } = loaded.exports;
const base = {
  concept: "서울불꽃축제",
  style: "화려한 색면",
  background: "한강의 밤",
  ink: "#123456",
  elements: [
    { name: "불꽃", prompt: "다채로운 불꽃" },
    { name: "서울", prompt: "서울 도시 풍경" },
    { name: "관객", prompt: "남녀노소와 외국인, 동물 캐릭터" },
  ],
};
const checkBounds = (plan) =>
  plan.elements.forEach((e) => {
    assert(
      Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.width),
    );
    assert(e.x >= 0 && e.x + e.width <= 1.000001);
    assert(e.y >= 0.35 && e.y + (e.width * 2) / 3 <= 0.870001);
  });
checkBounds(parsePosterPlan(base));
for (const v of [undefined, null, NaN, Infinity, -10, 100, "0.5"]) {
  checkBounds(
    parsePosterPlan({
      ...base,
      elements: base.elements.map((e) => ({ ...e, x: v, y: v, width: v })),
    }),
  );
}
const valid = {
  ...base,
  elements: [{ ...base.elements[0], x: 0.15, y: 0.4, width: 0.6 }],
};
assert.deepEqual(parsePosterPlan(valid), valid);
assert.throws(() => parsePosterPlan({ ...base, elements: [{ x: 0.2 }] }));
assert.throws(() => parsePosterPlan({ ...base, elements: [] }));
assert.throws(() =>
  parsePosterPlan({ ...base, elements: [...base.elements, base.elements[0]] }),
);
assert(posterPlanResponseFormat.json_schema.strict);
assert.deepEqual(
  posterPlanResponseFormat.json_schema.schema.properties.elements.items
    .required,
  ["name", "prompt", "x", "y", "width"],
);
console.log(
  "PASS: missing coordinates, invalid values, safe layout bounds, valid layout preservation, required content and strict output",
);
