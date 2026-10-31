import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { firstNonEmpty, kangxiChar, kanjiGaps, renderReport } from "./lib/kanji-meta.mjs";
import { applyKanjiMeta, buildKanjiMetaReport, pickRadical } from "./kanji-meta.mjs";

/* ── түр ширээгийн үндэс ─────────────────────────────────────────── */
const root = mkdtempSync(path.join(tmpdir(), "kanjimeta-"));
const w = (rel, value) => {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
};

const RECORDS = [
  // A: радикал байна, он/кун хоосон (kanji-data-д он байна)
  { k: "電", lvl: "N1", rad: "雨", on: [], kun: [], mn: ["цахилгаан"], mq: "auto", src: "openjlpt+kanji-data", sid: "電" },
  // B: радикал хоосон — OpenJLPT-д байна; он хоосон — OpenJLPT-ээс ирнэ
  { k: "校", lvl: "N1", rad: null, on: [], kun: [], mn: ["сургууль"], mq: "auto", src: "kanji-data", sid: "校" },
  // C: радикалд англи үг (WaniKani нэр) — KANJIDIC2-аар солигдоно
  { k: "柏", lvl: "N1", rad: "Bamboo", on: ["ハク"], kun: ["かしわ"], mn: ["кэшигээ"], mq: "auto", src: "kanji-data", sid: "柏" },
  // D: ямар ч эх сурвалжгүй — хэзээ ч дүүрэхгүй, needs-review үлдэнэ
  { k: "鿐", lvl: "N1", rad: null, on: [], kun: [], mn: [], mq: "none", src: "kanji-data", sid: "鿐" },
];

beforeAll(() => {
  w(".cache/sources/kanji-data/kanji.json", {
    電: { readings_on: ["デン"], readings_kun: [] },
    校: { readings_on: [], readings_kun: [] },
    柏: { readings_on: ["ハク"], readings_kun: ["かしわ"], wk_radicals: ["tree"] },
  });
  w(".cache/sources/jamdict-data/kanji-radicals.json", { _meta: { source: "KANJIDIC2" }, radicals: { 電: 173, 柏: 75, 校: 75 } });
  w(".cache/sources/openjlpt/data/json/kanji/n1.json", [
    { character: "電", onyomi: ["デン"], kunyomi: [], radical: "雨" },
    { character: "校", onyomi: ["コウ"], kunyomi: [], radical: "木" },
  ]);
  for (const l of ["n5", "n4", "n3", "n2"]) w(`.cache/sources/openjlpt/data/json/kanji/${l}.json`, []);
  for (const l of ["n5", "n4", "n3", "n2"]) w(`public/data/kanji/${l}.json`, []);
  w("public/data/kanji/n1.json", JSON.parse(JSON.stringify(RECORDS)));
  w("content/mn/kanji.json", {});
  // хайлтын индекс — ханзны дараалалтай (n5…n1)
  w("public/data/index/search.json", {
    v: [],
    k: RECORDS.map((r) => [r.k, r.on?.[0] ?? "", r.mn?.[0] ?? "", r.lvl, 5]),
    g: [],
  });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const n1 = () => JSON.parse(readFileSync(path.join(root, "public/data/kanji/n1.json"), "utf8"));
const search = () => JSON.parse(readFileSync(path.join(root, "public/data/index/search.json"), "utf8"));

describe("lib/kanji-meta.mjs — эх сурвалжийн дүрэм", () => {
  it("kangxiChar: Кангийн дугаар → бүтэн ханз, хязгаарас гадуур null", () => {
    expect(kangxiChar(118)).toBe("竹");
    expect(kangxiChar(75)).toBe("木");
    expect(kangxiChar(1)).toBe("一");
    expect(kangxiChar(0)).toBeNull();
    expect(kangxiChar(215)).toBeNull();
    expect(kangxiChar(1.5)).toBeNull();
    expect(kangxiChar("75")).toBeNull();
  });

  it("firstNonEmpty: хоосон массив (`[] ?? x`) алгасаж дараагийн утгыг авна", () => {
    expect(firstNonEmpty([], ["あ"])).toEqual(["あ"]);
    expect(firstNonEmpty(undefined, ["い"])).toEqual(["い"]);
    expect(firstNonEmpty([], null)).toEqual([]);
    expect(firstNonEmpty(["う"], ["え"])).toEqual(["う"]);
  });

  it("pickRadical: content → OpenJLPT → KANJIDIC2 → kanji-data (wk)", () => {
    expect(pickRadical("電", { rad: "雨" }, {}, {}, {}).from).toBe("content");
    expect(pickRadical("電", {}, {}, { radical: "雨" }, {}).v).toBe("雨");
    expect(pickRadical("電", {}, {}, {}, { 電: 173 })).toEqual({ v: "雨", from: "kanjidic2" });
    expect(pickRadical("校", {}, { wk_radicals: ["x"] }, {}, {})).toEqual({ v: "x", from: "wk" });
    expect(pickRadical("鿐", {}, {}, {}, {})).toEqual({ v: null, from: null });
  });
});

describe("kanji-meta apply — зөвхөн хоосон талбарыг эх сурвалжаар нөхнө", () => {
  let firstStats = null;
  beforeAll(() => {
    firstStats = applyKanjiMeta(root).stats;
  });

  it("эхний ажиллагаа зөв тоолсон", () => {
    expect(firstStats).toMatchObject({ radFilled: 1, radReplaced: 1, onFilled: 2, kunFilled: 0, files: 1 });
  });

  it("радикал: хоосон = нөхнө, англи үг = солино, ханз байгаа = хэвээр", () => {
    const [a, b, c, d] = n1();
    expect(a.rad).toBe("雨"); // байсан утга өөрчлөгдөөгүй
    expect(b.rad).toBe("木"); // OpenJLPT-ийн radical
    expect(c.rad).toBe("木"); // англи "Bamboo" → KANJIDIC2 №75
    expect(d.rad).toBeNull(); // эх сурвалжгүй — хэзээ ч дүүргэдэггүй
  });

  it("src-д зөвхөн KANJIDIC2-аас ирсэн радикалд +kanjidic2 нэмэгдэнэ", () => {
    const [, b, c] = n1();
    expect(b.src).toBe("kanji-data"); // OpenJLPT-ээс ирсэн тул нэмэлтгүй
    expect(c.src).toBe("kanji-data+kanjidic2");
  });

  it("on/kun: хоосон талбарыг эх сурвалжаас нөхнө, байгааг дарахгүй", () => {
    const [a, b, , d] = n1();
    expect(a.on).toEqual(["デン"]); // kanji-data-аас
    expect(b.on).toEqual(["コウ"]); // OpenJLPT onyomi (хоосон биш — kanji-data-д алга)
    expect(b.kun).toEqual([]); // ямар ч эх сурвалжгүй — хоосон хэвээр
    expect(d.on).toEqual([]);
    expect(a.kun).toEqual([]); // kanji-data-д мөр байхгүй, OpenJLPT-д ч байхгүй
  });

  it("мөрүүдийн дараалал өөрчлөгдөхгүй", () => {
    expect(n1().map((r) => r.k)).toEqual(RECORDS.map((r) => r.k));
  });

  it("хайлтын индексийн анхны он-уншлага шинэчлэгдэнэ (зөвхөн өөрчлөгдсөн нь)", () => {
    const k = search().k;
    expect(k[0][1]).toBe("デン"); // A: он нөгсөн
    expect(k[1][1]).toBe("コウ"); // B: он нөгсөн
    expect(k[2][1]).toBe("ハク"); // C: өөрчлөгдөөгүй
    expect(k[3][1]).toBe(""); // D: хоосон хэвээр
  });

  it("дахин ажиллуулахад дахин өөрчлөх зүйлгүй (идемпотент)", () => {
    const before = n1();
    const { stats } = applyKanjiMeta(root);
    expect(stats).toMatchObject({ radFilled: 0, radReplaced: 0, onFilled: 0, kunFilled: 0, files: 0 });
    expect(n1()).toEqual(before);
  });
});

describe("kanjiGaps + тайлан — хүлээгдэж буй мөрүүдийг ялгана", () => {
  const sources = {
    radicals: { 電: 173, 柏: 75, 校: 75 },
    kanjiData: { 電: { readings_on: ["デン"], readings_kun: [] }, 校: { readings_on: [], readings_kun: [] }, 柏: { readings_on: ["ハク"], readings_kun: ["かしわ"] } },
    openjlpt: { 電: { onyomi: ["デン"], kunyomi: [], radical: "雨" }, 校: { onyomi: ["コウ"], kunyomi: [], radical: "木" } },
  };

  it("эх сурвалжгүй хоосон утгыг `needs-review` гэж record тус бүрээр гаргана", () => {
    const rows = kanjiGaps(n1(), sources);
    const needs = rows.filter((r) => r.status === "needs-review");
    // 校 kun — ямар ч эх сурвалжгүй; 電 kun — kanji-data/OpenJLPT хоёулангийнх нь хоосон
    expect(needs.map((r) => `${r.k}:${r.field}`)).toEqual(["電:kun", "校:kun", "鿐:rad", "鿐:on", "鿐:kun"]);
    expect(needs.every((r) => r.source.length > 0)).toBe(true);
  });

  it("эх сурвалжаар нөхсөн мөрийг тусад нь статустай гаргана", () => {
    const rows = kanjiGaps(n1(), sources);
    expect(rows.find((r) => r.k === "柏" && r.field === "rad")).toMatchObject({
      status: "filled-kanjidic",
      value: "木",
    });
    expect(rows.find((r) => r.k === "校" && r.field === "on")).toMatchObject({
      status: "filled-openjlpt",
      value: "コウ",
    });
    // 電 on kanji-data-аас ирсэн тул «нөхсөн» мөр биш (эхний эх сурвалж)
    expect(rows.find((r) => r.k === "電" && r.field === "on")).toBeUndefined();
  });

  it("таамаглаар дүүргэсэн утга байхгүй — бүх мөр баримтат эх сурвалжтай", () => {
    const rows = kanjiGaps(n1(), sources);
    for (const r of rows) {
      if (r.status === "needs-review") expect(r.value).toBe("");
      else expect(r.source).toMatch(/KANJIDIC2|OpenJLPT/);
    }
  });

  it("тайлангийн Markdown record/талбар/статустай", () => {
    const { md, stats } = buildKanjiMetaReport(root);
    expect(md).toContain("needs-review");
    expect(md).toContain("| 鿐 | N1 | rad |");
    expect(md).toContain("| 柏 | N1 | rad |");
    expect(stats.total).toBe(4);
    expect(stats.byField.rad.miss).toBe(1);
    expect(existsSync(path.join(root, "content/review/KANJI-META.md"))).toBe(false); // өөрөө бичдэггүй
    expect(renderReport([], { total: 1, byField: { rad: { have: 1, miss: 0 }, on: { have: 1, miss: 0 }, kun: { have: 1, miss: 0 } }, byLevel: [] })).toContain("Олдсонгүй");
  });
});
