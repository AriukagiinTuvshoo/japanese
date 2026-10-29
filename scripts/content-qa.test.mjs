import { describe, expect, it, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runQa, duplicateJsonKeys } from "./content-qa.mjs";
import { MQ_STATUSES, RULES_TEXT, coverageTable, statusCounts } from "./lib/coverage.mjs";

const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const roots = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** Ижил бүтэцтэй жинхэнэ төсөл үүсгэнэ (public/data + content/mn). */
function fixture({
  vocab = [],
  kanji = [],
  grammar = [],
  contentVocab = {},
  contentKanji = {},
  contentGrammar = {},
  terms = {},
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "content-qa-"));
  roots.push(root);
  const write = (rel, value) => {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 1));
  };

  const byLevel = (arr) => Object.fromEntries(LEVELS.map((l) => [l.toUpperCase(), arr.filter((r) => (r.lvl ?? "N5") === l.toUpperCase())]));
  const vocabLevels = byLevel(vocab);
  const kanjiLevels = Object.fromEntries(LEVELS.map((l) => [l.toUpperCase(), kanji.filter((r) => (r.lvl ?? "N5") === l.toUpperCase())]));
  const grammarLevels = Object.fromEntries(LEVELS.map((l) => [l.toUpperCase(), grammar.filter((r) => (r.lvl ?? "N5") === l.toUpperCase())]));

  for (const l of LEVELS) {
    write(`public/data/vocab/${l}.json`, vocabLevels[l.toUpperCase()]);
    write(`public/data/kanji/${l}.json`, kanjiLevels[l.toUpperCase()]);
    write(`public/data/grammar/${l}.json`, grammarLevels[l.toUpperCase()]);
  }

  const counts = Object.fromEntries(MQ_STATUSES.map((s) => [s, 0]));
  for (const r of vocab) counts[r.mq] = (counts[r.mq] ?? 0) + 1;
  write("public/data/index/meta.json", {
    counts: { vocab: vocab.length, kanji: kanji.length, grammar: grammar.length, mn: { vocab: counts } },
  });

  write("content/mn/vocab.json", contentVocab);
  write("content/mn/kanji.json", contentKanji);
  write("content/mn/grammar.json", contentGrammar);
  write("content/mn/terms.json", terms);
  return root;
}

const V = (over = {}) => ({
  id: "v1",
  w: "学校",
  r: "がっこう",
  rm: "gakkou",
  en: ["school"],
  mn: ["сургууль"],
  mq: "draft",
  lvl: "N5",
  tier: "jlpt",
  pos: ["n"],
  t: "n",
  kd: ["学", "校"],
  src: "openjlpt",
  sid: "1",
  ex: [],
  ...over,
});

describe("content:qa — контентын чанарын хаалга", () => {
  it("1) хүчинтэй өгөгдөл → PASS (алдаагүй)", () => {
    const root = fixture({
      vocab: [V()],
      kanji: [
        { k: "学", lvl: "N5", mq: "draft", mn: ["суралцах"], en: ["study"], on: ["ガク"], kun: ["まな.ぶ"], rad: null, w: [], src: "kanjidic", sid: "k1", ex: [] },
      ],
      grammar: [{ id: "wa", p: "〜は", lvl: "N5", mn: "Сэдвийг заана.", en: ["topic"], related: [], src: "openjlpt" }],
      contentVocab: { "学校|がっこう": "сургууль" },
      contentKanji: { 学: { m: ["суралцах"] } },
      contentGrammar: { "〜は": { m: "Сэдвийг заана." } },
      terms: { noun: { ja: "名詞", mn: "Нэр үг", note: "тест", example: "本", source: "тест", status: "draft" } },
    });
    const { errors } = runQa({ root });
    expect(errors).toEqual([]);
  });

  it("2) МОНГОЛ УТГА ХООСОН record → FAIL (файл/түлхүүр/талбар нь заасан)", () => {
    const root = fixture({
      vocab: [V()],
      contentVocab: { "学校|がっこう": "" },
      terms: {},
    });
    const { errors } = runQa({ root });
    expect(errors.some((e) => e.startsWith("content/mn/vocab.json") && e.includes("хоосон"))).toBe(true);
  });

  it("3) ХҮЧИНГҮЙ reference → FAIL (байхгүй мөр рүү холбосон)", () => {
    const root = fixture({
      vocab: [V()],
      grammar: [{ id: "wa", p: "〜は", lvl: "N5", mn: "Сэдвийг заана.", en: [], related: [], src: "openjlpt" }],
      contentVocab: { "байхгүй үг|よみ": "утга" },
      contentGrammar: { "〜ばаа": { m: "буруу хэв" } },
      terms: {},
    });
    const { errors } = runQa({ root });
    expect(errors.some((e) => e.includes("хүчингүй холбоос") && e.includes("content/mn/vocab.json"))).toBe(true);
    expect(errors.some((e) => e.includes("хүчингүй холбоос") && e.includes("content/mn/grammar.json"))).toBe(true);
  });

  it("4) review-гүй зүйл CURATED болдоггүй (толь + public/data хоёулаа)", () => {
    // толь: curated, гэхдээ хүн хянаагүй
    const withReview = fixture({
      vocab: [V()],
      terms: { particle: { ja: "助詞", mn: "Тусаглал", note: "тест", example: "は", source: "тест", status: "curated" } },
    });
    const a = runQa({ root: withReview });
    expect(a.errors.some((e) => e.includes("curated төлөвт reviewedBy заавал"))).toBe(true);

    // public/data: curated мөр эх сурвалжгүй
    const noSource = fixture({
      vocab: [V({ mq: "curated", src: "", sid: "" })],
      terms: {},
    });
    const b = runQa({ root: noSource });
    expect(b.errors.some((e) => e.includes("мөр curated байж болохгүй"))).toBe(true);

    // эх сурвалжтай curated → зөвшөөрөгдөнө
    const withSource = fixture({ vocab: [V({ mq: "curated" })], terms: {} });
    const c = runQa({ root: withSource });
    expect(c.errors.filter((e) => e.includes("curated")).length).toBe(0);
  });

  it("5) auto болон none-ийг бүх тооцоолол ЯГ ИЖИЛ дүрмээр тоолдог", () => {
    const records = [
      V({ mq: "curated" }),
      V({ id: "v2", w: "学生", r: "がくせい", mq: "draft" }),
      V({ id: "v3", w: "先生", r: "せんせい", mq: "auto" }),
      V({ id: "v4", w: "教室", r: "きょうしつ", mq: "none", mn: [] }),
      V({ id: "v5", w: "机", r: "つくえ", mq: "derived" }),
    ];
    const sc = statusCounts(records);
    expect(sc.balanced).toBe(true);
    expect(sc.counts).toEqual({ curated: 1, draft: 1, auto: 1, derived: 1, none: 1 });
    expect(sc.sum).toBe(records.length);
    // auto мөр none болдоггүй (мөр байгаа, зөвхөн хүн хянаагүй)
    expect(statusCounts([V({ mq: "auto" })]).counts).toEqual({ curated: 0, draft: 0, auto: 1, derived: 0, none: 0 });
    expect(statusCounts([V({ id: "v9", w: "空", r: "から", mq: "none", mn: [] })]).counts).toEqual({
      curated: 0,
      draft: 0,
      auto: 0,
      derived: 0,
      none: 1,
    });

    const { rows, total } = coverageTable({ vocab: records });
    expect(total.auto).toBe(1);
    expect(total.none).toBe(1);
    expect(total.curated).toBe(1);
    expect(total.draft).toBe(1);
    expect(total.derived).toBe(1);
    expect(total.total).toBe(5);
    // hasMn төлөвөөс үл хамаарна: none мөрөөр тэнцэхгүй
    expect(total.hasMn).toBe(4);
    expect(rows[0].balanced).toBe(true);

    // meta мэта ч тэдгээр таван төлөвийг ашиглана (нэг нь алгасвал алдаа)
    const root = fixture({ vocab: records, terms: {} });
    const { errors } = runQa({ root });
    expect(errors.filter((e) => e.includes("coverage") || e.includes("counts.mn.vocab"))).toEqual([]);

    // meta нэг төлөвийг алгасвал → FAIL
    const root2 = fixture({ vocab: records, terms: {} });
    writeFileSync(
      path.join(root2, "public/data/index/meta.json"),
      JSON.stringify({
        counts: { vocab: 5, kanji: 0, grammar: 0, mn: { vocab: { curated: 1, draft: 1, auto: 2, none: 0 } } },
      }),
    );
    const bad = runQa({ root: root2 });
    expect(bad.errors.some((e) => e.includes("counts.mn.vocab"))).toBe(true);
  });

  it("нэг япон нэр — олон монгол нэр → FAIL (нэр томьёо зөрөлдөх)", () => {
    const root = fixture({
      vocab: [V()],
      terms: {
        a: { ja: "助詞", mn: "Тусаглал", note: "нэг", example: "は", source: "тест", status: "draft" },
        b: { ja: "助詞", mn: "Хэллиг", note: "хоёр", example: "が", source: "тест", status: "draft" },
      },
    });
    const { errors } = runQa({ root });
    expect(errors.some((e) => e.includes("хоёр монгол нэртэй"))).toBe(true);
  });

  it("давхардсан түлхүүр → FAIL (JSON нэг мөрийг алга болгоно)", () => {
    const root = fixture({ vocab: [V()], terms: {} });
    writeFileSync(
      path.join(root, "content/mn/vocab.json"),
      '{ "学校|がっこう": "сургууль", "学校|がっこう": "сургууль-2" }',
    );
    const { errors } = runQa({ root });
    expect(errors.some((e) => e.includes("content/mn/vocab.json") && e.includes("давхардсан түлхүүр"))).toBe(true);
    expect(duplicateJsonKeys('{"a":1,"a":2}')).toEqual(["a"]);
    expect(duplicateJsonKeys('{"a":1,"b":{"a":2}}')).toEqual([]);
    expect(duplicateJsonKeys('{"a":1,"b":2}')).toEqual([]);
  });

  it("covareжийн дүрэм тайлбарлагдсан байдаг (content:qa-н гаралтад)", () => {
    expect(RULES_TEXT).toContain("auto ≠ none");
    expect(RULES_TEXT).toContain("нийт");
    expect(MQ_STATUSES).toEqual(["curated", "draft", "auto", "derived", "none"]);
  });
});
