import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runQa } from "./content-qa.mjs";

/* REVIEW_ROOT нь модуль ачаалагдах ҮЕД уншигдаг тул эхлээд түр үндэс
 * үүсгээд дараа нь динамик импорт хийнэ. */
const root = mkdtempSync(path.join(tmpdir(), "review-"));
const w = (rel, value) => {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
};

for (const l of ["n5", "n4", "n3", "n2", "n1"]) {
  w(`public/data/vocab/${l}.json`, l === "n5"
    ? [{ id: "v1", w: "学校", r: "がっこう", rm: "", en: ["school"], mn: ["сургууль"], mq: "draft", lvl: "N5", tier: "jlpt", pos: [], t: "n", kd: ["学"], src: "openjlpt", sid: "1", ex: [] }]
    : []);
  w(`public/data/kanji/${l}.json`, []);
  w(`public/data/grammar/${l}.json`, l === "n5" ? [{ id: "wa", p: "〜は", lvl: "N5", mn: "Сэдвийг заана.", en: ["topic"], related: [], src: "openjlpt" }] : []);
}
w("public/data/index/meta.json", {
  counts: { vocab: 1, kanji: 0, grammar: 1, mn: { vocab: { curated: 0, draft: 1, auto: 0, derived: 0, none: 0 } } },
});
w("content/mn/vocab.json", {});
w("content/mn/kanji.json", {});
w("content/mn/grammar.json", {});
w("content/mn/terms.json", {
  particle: { ja: "助詞", mn: "Тусаглал", note: "тест", example: "は", source: "тест", status: "needs_review" },
});
w("content/review/decisions.json", {});

process.env.REVIEW_ROOT = root;
const { cmdQueue, cmdMark, cmdStatus } = await import("./review.mjs");

const TERMS_FILE = path.join(root, "content/mn/terms.json");
const DECISIONS_FILE = path.join(root, "content/review/decisions.json");
const QUEUE_FILE = path.join(root, "content/review/QUEUE.md");
const readTerms = () => JSON.parse(readFileSync(TERMS_FILE, "utf8"));
const readDecisions = () => JSON.parse(readFileSync(DECISIONS_FILE, "utf8"));

beforeEach(() => {
  w("content/review/decisions.json", {});
  w("content/mn/vocab.json", {});
  w("content/mn/terms.json", {
    particle: { ja: "助詞", mn: "Тусаглал", note: "тест", example: "は", source: "тест", status: "needs_review" },
  });
});

afterAll(() => {
  delete process.env.REVIEW_ROOT;
  rmSync(root, { recursive: true, force: true });
});

describe("review.mjs — файлд суурилсан хүний хяналт", () => {
  it("queue: QUEUE.md-г бүтээгээд шаардлагатай талбаруудыг харуулна", () => {
    expect(cmdQueue([])).toBe(0);
    const md = readFileSync(QUEUE_FILE, "utf8");
    for (const col of ["Ключ", "Түвшин", "Төрөл", "Япон", "Монгол", "Эх сурвалж", "Төлөв"]) {
      expect(md).toContain(col);
    }
    expect(md).toContain("needs_review");
    expect(md).toContain("curated"); // хуваарилалтын мөр
    expect(md).toContain("Бүртгэгдсэн шийдвэрүүд");
    expect(cmdStatus()).toBe(0);
  });

  it("mark: reviewer үгүй бол шийдвэр үүсдэггүй (curated нотолгоогүй тавигдахгүй)", () => {
    expect(cmdMark(["terms", "particle", "--action=approve"])).toBe(1);
    expect(readDecisions()).toEqual({});
    expect(readTerms().particle.status).toBe("needs_review");
  });

  it("mark: буруу үйлдэл / буруу ключ → 1, өгөгдөл өөрчлөгдөөгүй", () => {
    expect(cmdMark(["terms", "particle", "--action=approve", "--reviewer=Тест"])).toBe(0); // control
    w("content/review/decisions.json", {});
    w("content/mn/terms.json", { particle: { ja: "助詞", mn: "Тусаглал", note: "тест", source: "тест", status: "needs_review" } });

    expect(cmdMark(["terms", "particle", "--action=delete", "--reviewer=Тест"])).toBe(1);
    expect(cmdMark(["terms", "chibe", "--action=approve", "--reviewer=Тест"])).toBe(1);
    expect(cmdMark(["nope", "x", "--action=approve", "--reviewer=Тест"])).toBe(1);
    expect(readDecisions()).toEqual({});
  });

  it("mark approve (terms): шийдвэр + terms.json curated (reviewedBy гарч ирнэ)", () => {
    expect(cmdMark(["terms", "particle", "--action=approve", "--reviewer=Бат", "--note=шалгасан"])).toBe(0);
    const d = readDecisions()["terms:particle"];
    expect(d).toMatchObject({ action: "approve", reviewer: "Бат", note: "шалгасан" });
    expect(d.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const terms = readTerms();
    expect(terms.particle.status).toBe("curated");
    expect(terms.particle.reviewedBy).toBe("Бат");
    expect(terms.particle.reviewedAt).toBe(d.at);

    // content:qa ч баталгаажуулна (curated нотолготой)
    const { errors } = runQa({ root });
    expect(errors.filter((e) => e.includes("terms") || e.includes("curated"))).toEqual([]);
  });

  it("mark approve (vocab): утга content/mn/vocab.json-д бичигдэнэ, өгөгдөл өөрөө curated болохгүй", () => {
    expect(cmdMark(["vocab", "学校|がっこう", "--action=approve", "--reviewer=Бат"])).toBe(0);
    expect(readDecisions()["vocab:学校|がっこう"]).toMatchObject({ action: "approve", reviewer: "Бат" });
    const overrides = JSON.parse(readFileSync(path.join(root, "content/mn/vocab.json"), "utf8"));
    expect(overrides["学校|がっこう"]).toBe("сургууль");
    // generated JSON-ыг approve өөрөө сольж бичихгүй — `build-data.mjs` л mq=curated болгоно
    const row = JSON.parse(readFileSync(path.join(root, "public/data/vocab/n5.json"), "utf8"))[0];
    expect(row.mq).toBe("draft");
  });

  it("mark: дараагийн шийдвэр өмнөхийг history-д хадгална (нотолгоо устахгүй)", () => {
    expect(cmdMark(["terms", "particle", "--action=verify", "--reviewer=Шалгагч", "--note=эх сурвалжтай"])).toBe(0);
    expect(cmdMark(["terms", "particle", "--action=approve", "--reviewer=Бат"])).toBe(0);
    const d = readDecisions()["terms:particle"];
    expect(d).toMatchObject({ action: "approve", reviewer: "Бат" });
    expect(d.history).toHaveLength(1);
    expect(d.history[0]).toMatchObject({ action: "verify", reviewer: "Шалгагч", note: "эх сурвалжтай" });
  });

  it("mark revise: санал хадгалагдана, өгөгдөл өөрчлөгдөхгүй", () => {
    expect(cmdMark(["terms", "particle", "--action=revise", "--reviewer=Сара", "--mn=Хэллиг"])).toBe(0);
    const d = readDecisions()["terms:particle"];
    expect(d).toMatchObject({ action: "revise", mn: "Хэллиг" });
    const terms = readTerms();
    expect(terms.particle.status).toBe("needs_review");
    expect(terms.particle.mn).toBe("Тусаглал");
  });

  it("mark verify: нотолгоо бичигдэхдээ өгөгдөл, статус өөрчлөгддөггүй (curated болдоггүй)", () => {
    expect(
      cmdMark(["terms", "particle", "--action=verify", "--reviewer=Freebuff AI reviewer", "--note=эх сурвалжтай тулгасан"]),
    ).toBe(0);
    const d = readDecisions()["terms:particle"];
    expect(d).toMatchObject({ action: "verify", reviewer: "Freebuff AI reviewer" });
    // verify нь curated болгохгүй — human approve л болгоно
    expect(readTerms().particle.status).toBe("needs_review");
    expect(readTerms().particle.reviewedBy).toBeUndefined();
  });

  it("public/data дэх curated мөрөд заавал хүний шийдвэр шаардана (content:qa)", () => {
    // шийдвэргүй curated → алдаа
    w("public/data/vocab/n5.json", [
      { id: "v1", w: "学校", r: "がっこう", rm: "", en: ["school"], mn: ["сургууль"], mq: "curated", lvl: "N5", tier: "jlpt", pos: [], t: "n", kd: [], src: "openjlpt", sid: "1", ex: [] },
    ]);
    w("public/data/index/meta.json", {
      counts: { vocab: 1, kanji: 0, grammar: 1, mn: { vocab: { curated: 1, draft: 0, auto: 0, derived: 0, none: 0 } } },
    });
    const bad = runQa({ root });
    expect(bad.errors.some((e) => e.includes("хүний шийдвэр"))).toBe(true);

    // шийдвэр байвал өнгөрнө
    w("content/review/decisions.json", { "vocab:学校|がっこう": { action: "approve", reviewer: "Бат", at: "2026-10-29" } });
    const ok = runQa({ root });
    expect(ok.errors.filter((e) => e.includes("хүний шийдвэр"))).toEqual([]);

    // буцаах
    w("public/data/vocab/n5.json", [
      { id: "v1", w: "学校", r: "がっこう", rm: "", en: ["school"], mn: ["сургууль"], mq: "draft", lvl: "N5", tier: "jlpt", pos: [], t: "n", kd: [], src: "openjlpt", sid: "1", ex: [] },
    ]);
    w("public/data/index/meta.json", {
      counts: { vocab: 1, kanji: 0, grammar: 1, mn: { vocab: { curated: 0, draft: 1, auto: 0, derived: 0, none: 0 } } },
    });
  });
});
