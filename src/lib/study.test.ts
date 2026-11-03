import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXAM_BLUEPRINTS,
  SECTION_PASS_RATIO,
  buildExam,
  buildQuiz,
  examTotals,
  scoreExam,
  sectionPassMark,
} from "./study";
import type { Grammar, Kanji, ReadingPassage, Vocab } from "./types";

const json = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const LEVEL_FILES = ["n5", "n4", "n3", "n2", "n1"] as const;
const all = <T>(kind: string): T[] => LEVEL_FILES.flatMap((l) => json<T[]>(`public/data/${kind}/${l}.json`));

const data = {
  vocab: all<Vocab>("vocab"),
  kanji: all<Kanji>("kanji"),
  grammar: all<Grammar>("grammar"),
  reading: json<ReadingPassage[]>("content/reading.json"),
};

describe("reading (読解) questions", () => {
  it("builds questions from real N2 passages instead of returning nothing", () => {
    const set = buildQuiz({ mode: "reading", level: "N2", count: 4 }, data);
    expect(set.questions.length).toBeGreaterThan(0);
    expect(set.questions.every((q) => q.kind === "reading")).toBe(true);
  });

  it("covers every level that ships a passage", () => {
    for (const level of ["N5", "N4", "N3", "N2", "N1"] as const) {
      const set = buildQuiz({ mode: "reading", level, count: 4 }, data);
      expect(set.questions.length, level).toBeGreaterThan(0);
      expect(set.questions.every((q) => q.passage && q.passage.length > 0)).toBe(true);
    }
  });

  it("shows the passage text with every question", () => {
    const set = buildQuiz({ mode: "reading", level: "N2", count: 4 }, data);
    for (const q of set.questions) {
      expect(Array.isArray(q.passage)).toBe(true);
      expect(q.passage!.join("").length).toBeGreaterThan(20);
    }
  });

  it("maps options and the answer index faithfully", () => {
    const set = buildQuiz({ mode: "reading", level: "N2", count: 4 }, data);
    const byQuestion = new Map<string, ReadingPassage["questions"][number]>();
    for (const p of data.reading) for (const q of p.questions) byQuestion.set(q.q, q);

    for (const q of set.questions) {
      const source = byQuestion.get(q.prompt);
      expect(source).toBeTruthy();
      // Сонголтууд холигддог ч зөв хариулт нь эх сурвалжийн зөв сонголт хэвээр.
      expect([...q.options].sort()).toEqual([...source!.opts].sort());
      expect(q.options[q.answer]).toBe(source!.opts[source!.a]);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
    }
  });

  it("never mixes passages from another level", () => {
    const set = buildQuiz({ mode: "reading", level: "N1", count: 6 }, data);
    for (const q of set.questions) expect(q.level).toBe("N1");
  });

  it("returns an empty set instead of crashing when no passage exists", () => {
    const set = buildQuiz({ mode: "reading", level: "N1", count: 4 }, { ...data, reading: [] });
    expect(set.questions).toHaveLength(0);
  });
});

describe("answer options stay in the active language", () => {
  /* Монгол орчуулгагүй үгсийн англи утга — MN горимд сонголт болж гарах ёсгүй. */
  const enOnly = new Set(data.vocab.filter((v) => !v.mn?.length).map((v) => v.en[0]));
  const enOnlyKanji = new Set(data.kanji.filter((k) => !k.mn.length).map((k) => k.en[0] ?? k.k));

  it("never fills Mongolian options from untranslated vocabulary", () => {
    for (const level of ["N5", "N4", "N3", "N2", "N1"] as const) {
      for (const mode of ["vocab-jp-mn", "vocab-listen"] as const) {
        const set = buildQuiz({ mode, level, count: 12, lang: "mn" }, data);
        for (const q of set.questions) {
          for (const o of q.options) expect(enOnly.has(o), `${level} ${mode}: «${o}»`).toBe(false);
        }
      }
    }
  });

  it("never fills Mongolian kanji options from untranslated kanji", () => {
    for (const level of ["N5", "N4", "N3", "N2", "N1"] as const) {
      const set = buildQuiz({ mode: "kanji-mn", level, count: 12, lang: "mn" }, data);
      for (const q of set.questions) {
        for (const o of q.options) expect(enOnlyKanji.has(o), `${level}: «${o}»`).toBe(false);
      }
    }
  });

  it("still fills the plan whenever translated content exists", () => {
    for (const level of ["N5", "N4", "N3", "N2", "N1"] as const) {
      const available = data.vocab.filter((v) => v.lvl === level && !!v.mn?.length).length;
      const set = buildQuiz({ mode: "vocab-jp-mn", level, count: 20, lang: "mn" }, data);
      expect(set.questions, level).toHaveLength(Math.min(20, available));
    }
  });

  it("reports the N1 kanji translation gap instead of inventing meanings", () => {
    // N1 ханз бүрэн орчуулагдаагүй — англи утгыг монгол сонголт болгож ХАРУУЛАХГҮЙ.
    const translated = data.kanji.filter((k) => k.lvl === "N1" && k.mn.length > 0).length;
    const set = buildQuiz({ mode: "kanji-mn", level: "N1", count: 10, lang: "mn" }, data);
    expect(set.questions).toHaveLength(Math.min(10, translated));
  });
});

describe("mock exam blueprint", () => {
  it("fills the reading section of N2/N1 with real passage questions", () => {
    for (const level of ["N2", "N1"] as const) {
      const sections = buildExam(EXAM_BLUEPRINTS[level], data, "mn");
      const read = sections.find((s) => s.section.id === "read");
      expect(read).toBeTruthy();
      expect(read!.questions.some((q) => q.kind === "reading")).toBe(true);
    }
  });

  it("always returns exactly the planned number of questions per section", () => {
    for (const level of ["N5", "N4", "N3", "N2", "N1"] as const) {
      for (const s of buildExam(EXAM_BLUEPRINTS[level], data, "mn")) {
        expect(s.questions).toHaveLength(s.section.count);
      }
    }
  });

  it("tops up from other question types when a level has no passages", () => {
    const sections = buildExam(EXAM_BLUEPRINTS.N2, { ...data, reading: [] }, "mn");
    const read = sections.find((s) => s.section.id === "read")!;
    expect(read.questions).toHaveLength(read.section.count);
    expect(read.questions.some((q) => q.kind === "reading")).toBe(false);
  });
});

describe("N5–N1 blueprint integrity", () => {
  const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

  it("builds every planned section with exactly the planned number of questions", () => {
    for (const level of LEVELS) {
      const bp = EXAM_BLUEPRINTS[level];
      const built = buildExam(bp, data, "mn");
      expect(built).toHaveLength(bp.sections.length);
      for (const [i, sec] of built.entries()) {
        expect(sec.section.id).toBe(bp.sections[i].id);
        expect(sec.questions).toHaveLength(bp.sections[i].count);
        expect(sec.questions.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every question at the blueprint level", () => {
    for (const level of LEVELS) {
      for (const sec of buildExam(EXAM_BLUEPRINTS[level], data, "mn")) {
        for (const q of sec.questions) expect(q.level).toBe(level);
      }
    }
  });

  it("puts real passage questions in every section that asks for reading", () => {
    for (const level of LEVELS) {
      for (const sec of buildExam(EXAM_BLUEPRINTS[level], data, "mn")) {
        if (!sec.section.modes.includes("reading")) continue;
        const reading = sec.questions.filter((q) => q.kind === "reading");
        expect(reading.length, `${level} ${sec.section.id}`).toBeGreaterThan(0);
        for (const q of reading) expect(q.passage?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("has a coherent time and score budget", () => {
    for (const level of LEVELS) {
      const bp = EXAM_BLUEPRINTS[level];
      expect(bp.sections.reduce((a, s) => a + s.minutes, 0)).toBeLessThanOrEqual(bp.minutes);
      expect(bp.sections.every((s) => s.max === 60 || s.max === 120)).toBe(true);
      expect(bp.passTotal).toBeGreaterThan(0);
    }
  });
});

describe("exam scoring", () => {
  const bp = EXAM_BLUEPRINTS.N2;
  const sec = (id: "lang" | "read" | "listen") => bp.sections.find((s) => s.id === id)!;

  it("derives the JLPT-style section minimum from the section maximum", () => {
    expect(SECTION_PASS_RATIO).toBeCloseTo(19 / 60, 5);
    expect(sectionPassMark(60)).toBe(19);
    expect(sectionPassMark(120)).toBe(38);
  });

  it("fails an exam where one section is below its minimum even if the total passes", () => {
    const res = scoreExam(bp, [
      { section: sec("lang"), correct: 20, total: 20 },
      { section: sec("read"), correct: 12, total: 12 },
      { section: sec("listen"), correct: 2, total: 12 },
    ], 80);
    expect(res.total).toBeGreaterThanOrEqual(bp.passTotal);
    expect(res.passed).toBe(false);
    expect(res.failed.map((f) => f.name)).toEqual([sec("listen").name]);
  });

  it("fails when the total is below the pass mark even if every section clears its minimum", () => {
    const res = scoreExam(bp, [
      { section: sec("lang"), correct: 7, total: 20 },
      { section: sec("read"), correct: 4, total: 12 },
      { section: sec("listen"), correct: 4, total: 12 },
    ], 80);
    expect(res.sections.every((s) => s.score >= sectionPassMark(s.max))).toBe(true);
    expect(res.passed).toBe(false);
    expect(res.failed).toHaveLength(0);
  });

  it("passes only when the total and every section clear their marks", () => {
    const res = scoreExam(bp, [
      { section: sec("lang"), correct: 15, total: 20 },
      { section: sec("read"), correct: 10, total: 12 },
      { section: sec("listen"), correct: 9, total: 12 },
    ], 80);
    expect(res.passed).toBe(true);
    expect(res.failed).toHaveLength(0);
  });

  it("reports raw counts separately from the estimated scaled score", () => {
    const res = scoreExam(bp, [
      { section: sec("lang"), correct: 15, total: 20 },
      { section: sec("read"), correct: 6, total: 12 },
      { section: sec("listen"), correct: 9, total: 12 },
    ], 80);
    // Raw — бодит зөв хариултын тоо (оноо биш).
    expect(res.raw).toEqual({ correct: 30, total: 44, accuracy: 30 / 44 });
    // Estimated — зөвхөн жишгийн тооцоо; албан ёсны оноо гэж нэрлэгдэхгүй.
    expect(res.kind).toBe("estimated");
    expect(res.estimated.score).toBe(res.total);
    expect(res.estimated.max).toBe(res.max);
    // Хэсэг тус бүрээр хөрвүүлсэн онооны нийлбэр — глобал дугуйруулгаас
    // бага зэрэг зөрж болно (жинхэнэ шалгалтад ч хэсэг тус бүрээр оноодог).
    expect(res.estimated.score).toBe(res.sections.reduce((a, s2) => a + s2.score, 0));
    expect(Math.abs(res.estimated.score - res.raw.accuracy * res.max)).toBeLessThanOrEqual(res.sections.length);
    // Raw хариултын тоо нь оноо биш — шууд дамжуулагдахгүй.
    expect(res.total).not.toBe(res.raw.correct);
  });

  it("keeps the estimated score at the extremes of accuracy", () => {
    const none = scoreExam(bp, [
      { section: sec("lang"), correct: 0, total: 20 },
      { section: sec("read"), correct: 0, total: 12 },
      { section: sec("listen"), correct: 0, total: 12 },
    ], 80);
    expect(none.raw.accuracy).toBe(0);
    expect(none.total).toBe(0);
    expect(none.passed).toBe(false);

    const all = scoreExam(bp, [
      { section: sec("lang"), correct: 20, total: 20 },
      { section: sec("read"), correct: 12, total: 12 },
      { section: sec("listen"), correct: 12, total: 12 },
    ], 80);
    expect(all.raw.accuracy).toBe(1);
    expect(all.total).toBe(all.max);
    expect(all.passed).toBe(true);
  });

  it("counts exam questions (not points) for the activity log", () => {
    const res = scoreExam(bp, [
      { section: sec("lang"), correct: 15, total: 20 },
      { section: sec("read"), correct: 10, total: 12 },
      { section: sec("listen"), correct: 9, total: 12 },
    ], 80);
    expect(examTotals(res.sections)).toEqual({ correct: 34, total: 44 });
  });
});
