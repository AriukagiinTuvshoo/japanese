import { describe, expect, it } from "vitest";
import { QUIZ_KIND_IDS, isDrillKind, isLegacyExamKind, isQuizKindId, legacyExamLevel, quizKindOf, quizLogTarget } from "./quizKind";
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

/* ─────────────── Хуучин MockExam-ийн гарчиг ─────────────── */

describe("isLegacyExamKind — old mock-exam titles", () => {
  it("recognises Mongolian titles at every level, including already-truncated ones", () => {
    expect(isLegacyExamKind("N5 жишиг шалгалт · Сонсгол")).toBe(true);
    expect(isLegacyExamKind("N1 жишиг шалгалт · Уншлага")).toBe(true);
    // 42 тэмдэгт байсан гарчиг диск дээр 40 болж тасарсан — префикс бүтэн.
    expect(isLegacyExamKind("N5 жишиг шалгалт · Хэлний мэдлэг · Уншла")).toBe(true);
  });

  it("recognises English titles", () => {
    expect(isLegacyExamKind("N5 mock exam · Listening")).toBe(true);
    expect(isLegacyExamKind("N4 mock exam · Language Knowledge · Read")).toBe(true);
  });

  it("never claims stable ids, aggregate modes, section labels or junk", () => {
    for (const k of QUIZ_KIND_IDS) expect(isLegacyExamKind(k), k).toBe(false);
    for (const k of ["weak", "mixed", "mistakes"]) expect(isLegacyExamKind(k), k).toBe(false);
    expect(isLegacyExamKind("N6 жишиг шалгалт · Сонсгол")).toBe(false);
    expect(isLegacyExamKind("Шалгалтын хэсэг · N5")).toBe(false);
    expect(isLegacyExamKind("")).toBe(false);
    expect(isLegacyExamKind("quiz")).toBe(false);
  });

  it("extracts the level without inventing a section id", () => {
    expect(legacyExamLevel("N5 жишиг шалгалт · Сонсгол")).toBe("N5");
    expect(legacyExamLevel("N3 mock exam · Reading")).toBe("N3");
    expect(legacyExamLevel("kanji-read")).toBeNull();
    expect(legacyExamLevel("N7 жишиг шалгалт · Сонсгол")).toBeNull();
  });

  it("never turns a legacy title into a quiz mode id", () => {
    for (const k of ["N5 жишиг шалгалт · Сонсгол", "N5 mock exam · Listening", "N5 жишиг шалгалт · Хэлний мэдлэг · Уншла"]) {
      expect(isQuizKindId(quizKindOf(k))).toBe(false);
      expect(quizKindOf(k)).not.toBe("quiz");
    }
  });
});
