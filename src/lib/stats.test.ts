import { describe, expect, it } from "vitest";
import type { ActivityDay, ExamRecord, QuizRecord } from "./doc";
import { WEAK_MIN_QUESTIONS, WEAK_WINDOW, accuracy, dayAccuracy, examSectionAccuracy, kindAccuracy, weakKinds, weakestAreas } from "./stats";

const quiz = (kind: string, correct: number, total: number): QuizRecord => ({
  at: 1, kind, level: "N5", correct, total, minutes: 2,
});

const exam = (sections: { name: string; correct: number; total: number }[]): ExamRecord => ({
  id: "e1",
  level: "N2",
  at: 1,
  sections: sections.map((s) => ({ ...s, score: s.correct, max: s.total })),
  total: 0,
  max: 0,
  passed: false,
  minutes: 80,
  mock: true,
});

const day = (over: Partial<ActivityDay> = {}): ActivityDay => ({
  xp: 0, min: 0, newCards: 0, reviews: 0, correct: 0, total: 0, ...over,
});

describe("accuracy", () => {
  it("computes a ratio", () => {
    expect(accuracy(3, 4)).toBeCloseTo(0.75);
  });

  it("never divides by zero", () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(5, 0)).toBe(0);
  });

  it("clamps impossible input instead of showing >100%", () => {
    expect(accuracy(9, 4)).toBe(1);
    expect(accuracy(-2, 4)).toBe(0);
    expect(accuracy(Number.NaN, 4)).toBe(0);
  });
});

describe("dayAccuracy", () => {
  it("returns null when the day has no answers", () => {
    expect(dayAccuracy(undefined)).toBeNull();
    expect(dayAccuracy(day())).toBeNull();
  });

  it("returns the clamped ratio for a real day", () => {
    expect(dayAccuracy(day({ correct: 3, total: 4 }))).toBeCloseTo(0.75);
  });
});

describe("kindAccuracy", () => {
  it("groups by practice kind and sorts the weakest first", () => {
    const rows = kindAccuracy([
      quiz("vocab-jp-mn", 9, 10),
      quiz("vocab-jp-mn", 8, 10),
      quiz("kanji-read", 1, 10),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["kanji-read", "vocab-jp-mn"]);
    expect(rows[1]).toMatchObject({ correct: 17, total: 20 });
  });

  it("ignores empty records and clamps broken ones", () => {
    const rows = kindAccuracy([quiz("x", 0, 0), quiz("y", 7, 3)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].accuracy).toBe(1);
  });
});

describe("examSectionAccuracy", () => {
  it("groups the same section across exams", () => {
    const rows = examSectionAccuracy([
      exam([{ name: "Уншлага", correct: 6, total: 12 }, { name: "Сонсгол", correct: 10, total: 12 }]),
      exam([{ name: "Уншлага", correct: 4, total: 12 }]),
    ]);
    const read = rows.find((r) => r.kind === "Уншлага")!;
    expect(read).toMatchObject({ correct: 10, total: 24 });
    expect(rows[0].kind).toBe("Уншлага");
  });
});

describe("weakestAreas", () => {
  it("merges practice and exam sections into one ranking", () => {
    const rows = weakestAreas(
      [quiz("vocab-jp-mn", 6, 10)],
      [exam([{ name: "Уншлага", correct: 3, total: 12 }, { name: "Сонсгол", correct: 11, total: 12 }])],
    );
    expect(rows.map((r) => r.kind)).toEqual(["Уншлага", "vocab-jp-mn", "Сонсгол"]);
  });

  it("skips groups with too few answers to be meaningful", () => {
    const rows = weakestAreas([quiz("rare", 0, 2), quiz("common", 5, 10)], [], { minQuestions: 3 });
    expect(rows.map((r) => r.kind)).toEqual(["common"]);
  });

  it("counts each exam section exactly once", () => {
    const rows = weakestAreas([], [exam([{ name: "Уншлага", correct: 3, total: 12 }])], { minQuestions: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "Уншлага", correct: 3, total: 12 });
  });

  it("uses one shared window and threshold for every caller", () => {
    expect(WEAK_WINDOW).toBe(30);
    expect(WEAK_MIN_QUESTIONS).toBe(5);
    const old = quiz("kanji-read", 1, 20);
    const recent = quiz("vocab-jp-mn", 18, 20);
    // 31 дэхь (хамгийн хуучин) бичлэг цонхноос гарна — бараг бүх бичлэг "recent" байна.
    const quizzes = [recent, ...Array.from({ length: 29 }, () => quiz("vocab-jp-mn", 9, 10)), old];
    const rows = weakestAreas(quizzes, []);
    expect(rows.every((r) => r.total >= WEAK_MIN_QUESTIONS)).toBe(true);
    expect(rows.map((r) => r.kind)).toEqual(["vocab-jp-mn"]);
  });
});

describe("weakKinds", () => {
  it("returns drillable practice kinds, weakest first", () => {
    const rows = weakKinds([
      quiz("vocab-jp-mn", 6, 10),
      quiz("kanji-read", 1, 10),
      quiz("reading", 4, 10),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["kanji-read", "reading", "vocab-jp-mn"]);
  });

  it("excludes kinds at or above the weak threshold", () => {
    expect(weakKinds([quiz("kanji-read", 7, 10)])).toEqual([]);
    expect(weakKinds([quiz("kanji-read", 6, 10)])).toHaveLength(1);
    expect(weakKinds([quiz("kanji-read", 9, 10)], { maxAccuracy: 1 })).toHaveLength(1);
  });

  it("ignores aggregate modes so the weak drill cannot recurse", () => {
    const rows = weakKinds([
      quiz("weak", 1, 10),
      quiz("mixed", 1, 10),
      quiz("mistakes", 1, 10),
      quiz("grammar-mn", 5, 10),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["grammar-mn"]);
  });

  it("ignores legacy labels that were never normalized", () => {
    const rows = weakKinds([quiz("N5 жишиг шалгалт · Сонсгол", 0, 20), quiz("kanji-mn", 4, 10)]);
    expect(rows.map((r) => r.kind)).toEqual(["kanji-mn"]);
  });

  it("applies the sample threshold and the limit", () => {
    expect(weakKinds([quiz("kanji-read", 0, 2)])).toEqual([]);
    const rows = weakKinds(
      [quiz("kanji-read", 0, 10), quiz("kanji-mn", 1, 10), quiz("grammar-mn", 2, 10)],
      { limit: 2 },
    );
    expect(rows.map((r) => r.kind)).toEqual(["kanji-read", "kanji-mn"]);
  });
});

/* ─────────────── Хуучин MockExam-ийн quiz мөр ─────────────── */

describe("legacy mock-exam quiz rows", () => {
  it("never double-count a section that also has a legacy quiz row", () => {
    const rows = weakestAreas(
      [quiz("N5 жишиг шалгалт · Сонсгол", 2, 10)],
      [exam([{ name: "Сонсгол", correct: 2, total: 10 }])],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "Сонсгол", correct: 2, total: 10 });
  });

  it("keeps real drill rows next to exam sections", () => {
    const rows = weakestAreas(
      [quiz("kanji-read", 1, 10), quiz("N5 жишиг шалгалт · Хэлний мэдлэг · Уншла", 5, 20)],
      [exam([{ name: "Сонсгол", correct: 2, total: 10 }])],
    );
    expect(rows.map((r) => r.kind)).toEqual(["kanji-read", "Сонсгол"]);
  });

  it("keeps legacy rows out of the section ranking even without an exam record", () => {
    expect(weakestAreas([quiz("N5 жишиг шалгалт · Сонсгол", 2, 10)], [])).toEqual([]);
    expect(weakestAreas([quiz("N5 mock exam · Listening", 2, 10)], [])).toEqual([]);
  });
});
