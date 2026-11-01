import { describe, expect, it } from "vitest";
import type { ActivityDay, ExamRecord, QuizRecord } from "./doc";
import { accuracy, dayAccuracy, examSectionAccuracy, kindAccuracy, weakestAreas } from "./stats";

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
    const rows = weakestAreas([quiz("rare", 0, 2), quiz("common", 5, 10)], [], 3);
    expect(rows.map((r) => r.kind)).toEqual(["common"]);
  });
});
