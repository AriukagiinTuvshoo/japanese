import { describe, expect, it } from "vitest";
import { isDrillKind, quizKindOf, quizLogTarget } from "./quizKind";
import { QUIZ_MODES } from "./study";

/* ─────────────── Тогтвортой төрлийн id ─────────────── */

describe("quizKindOf — stable kind ids", () => {
  it("keeps a known mode id unchanged", () => {
    expect(quizKindOf("vocab-jp-mn")).toBe("vocab-jp-mn");
    expect(quizKindOf("kanji-read")).toBe("kanji-read");
  });

  it("maps every Mongolian mode label back to its id", () => {
    for (const m of QUIZ_MODES) expect(quizKindOf(m.label), m.label).toBe(m.id);
  });

  it("maps every English mode label back to its id", () => {
    for (const m of QUIZ_MODES) expect(quizKindOf(m.labelEn), m.labelEn).toBe(m.id);
  });

  it("is idempotent — normalizing twice changes nothing", () => {
    for (const m of QUIZ_MODES) {
      const once = quizKindOf(m.label);
      expect(quizKindOf(once)).toBe(once);
    }
  });

  it("does not guess an unknown legacy kind", () => {
    // MockExam-ийн хуучин бичлэг нь «шалгалт · хэсэг» хэлбэрийн гарчигтай байсан.
    expect(quizKindOf("N5 жишиг шалгалт · Сонсгол")).toBe("N5 жишиг шалгалт · Сонсгол");
  });

  it("trims whitespace, falls back to «quiz» when empty, and caps length", () => {
    expect(quizKindOf("  kanji-read ")).toBe("kanji-read");
    expect(quizKindOf("")).toBe("quiz");
    expect(quizKindOf(undefined)).toBe("quiz");
    expect(quizKindOf("x".repeat(80))).toHaveLength(40);
  });
});

describe("isDrillKind", () => {
  it("accepts concrete practice modes", () => {
    expect(isDrillKind("kanji-read")).toBe(true);
    expect(isDrillKind("reading")).toBe(true);
  });

  it("rejects aggregate modes", () => {
    for (const k of ["weak", "mixed", "mistakes"]) expect(isDrillKind(k), k).toBe(false);
  });

  it("rejects legacy labels and unknown strings", () => {
    expect(isDrillKind("Ханзны уншлага")).toBe(false);
    expect(isDrillKind("N5 жишиг шалгалт · Сонсгол")).toBe(false);
  });
});

/* ─────────────── Аль зам quiz түүхэд бичих вэ ─────────────── */

describe("quizLogTarget — exams never log a practice quiz", () => {
  it("logs nothing when the caller gives no target (mock exam path)", () => {
    expect(quizLogTarget(undefined)).toBeNull();
  });

  it("returns the stable kind and level for a practice quiz", () => {
    expect(quizLogTarget({ kind: "kanji-read", level: "N3" })).toEqual({ kind: "kanji-read", level: "N3" });
  });

  it("normalizes a legacy label target instead of storing the label", () => {
    expect(quizLogTarget({ kind: "Ханзны уншлага", level: "N5" })).toEqual({ kind: "kanji-read", level: "N5" });
  });
});
