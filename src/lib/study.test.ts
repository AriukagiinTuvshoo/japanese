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

  it("counts exam questions (not points) for the activity log", () => {
    const res = scoreExam(bp, [
      { section: sec("lang"), correct: 15, total: 20 },
      { section: sec("read"), correct: 10, total: 12 },
      { section: sec("listen"), correct: 9, total: 12 },
    ], 80);
    expect(examTotals(res.sections)).toEqual({ correct: 34, total: 44 });
  });
});
