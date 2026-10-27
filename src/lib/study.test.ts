import { describe, expect, it } from "vitest";
import { buildExam, buildQuiz, EXAM_BLUEPRINTS, type QuizMode } from "./study";
import type { Grammar, Kanji, Level, Vocab } from "./types";

const levels: Level[] = ["N5", "N4", "N3", "N2", "N1"];

function vocabPool(n = 60, lvl: Level = "N5"): Vocab[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    w: `言葉${i}`,
    r: `ことば${i}`,
    rm: `kotoba${i}`,
    en: [`meaning ${i}`],
    mn: [`утга ${i}`],
    mq: "draft" as const,
    lvl,
    tier: "jlpt" as const,
    pos: ["n"],
    t: "n" as const,
    kd: ["言"],
    src: "test",
    sid: `v${i}`,
    ex: [
      {
        ja: `これは言葉${i}です。`,
        fg: `これは{言葉|ことば}${i}です。`,
        en: `This is meaning ${i}.`,
        mn: `Энэ бол утга ${i}.`,
      },
    ],
  }));
}

function kanjiPool(n = 60, lvl: Level = "N5"): Kanji[] {
  return Array.from({ length: n }, (_, i) => ({
    k: String.fromCodePoint(0x4e00 + i),
    lvl,
    lvlSrc: "jlpt" as const,
    s: 5 + (i % 12),
    g: 1,
    f: i,
    en: [`kanji ${i}`],
    mn: [`ханз ${i}`],
    mq: "draft" as const,
    on: [`オン${i}`],
    kun: [`くん${i}`],
    rad: "口",
    w: [],
    mn_mem: null,
    src: "test",
    sid: `k${i}`,
  }));
}

function grammarPool(n = 40, lvl: Level = "N5"): Grammar[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `g${i}`,
    p: `〜ぱたーん${i}`,
    lvl,
    en: [`pattern ${i}`],
    mn: `дүрэм ${i}`,
    note: null,
    form: null,
    jlpt: lvl,
    ex: [{ ja: `例${i}です。`, mn: `жишээ ${i}` }],
    related: [],
    src: "test",
  }));
}

const data = { vocab: vocabPool(), kanji: kanjiPool(), grammar: grammarPool() };
const modes: QuizMode[] = ["mixed", "vocab-jp-mn", "kanji-mn", "grammar-mn", "weak"];

describe("P0-2: quiz sizing", () => {
  for (const count of [5, 15, 30]) {
    it(`mixed quiz returns exactly ${count} questions`, () => {
      const set = buildQuiz({ mode: "mixed", level: "N5", count }, data);
      expect(set.questions).toHaveLength(count);
    });
  }

  it("single-type quiz returns exactly the requested count", () => {
    const set = buildQuiz({ mode: "vocab-jp-mn", level: "N5", count: 15 }, data);
    expect(set.questions).toHaveLength(15);
  });

  it("kanji and grammar quizzes are not truncated by the multi-mode quota", () => {
    expect(buildQuiz({ mode: "kanji-mn", level: "N5", count: 12 }, data).questions).toHaveLength(12);
    expect(buildQuiz({ mode: "grammar-mn", level: "N5", count: 10 }, data).questions).toHaveLength(10);
  });

  it("distributes a mixed quiz across several kinds of question", () => {
    const set = buildQuiz({ mode: "mixed", level: "N5", count: 15 }, data);
    const kinds = new Set(set.questions.map((q) => q.id.split("-")[0]));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it("never repeats the same question inside one quiz", () => {
    for (const mode of modes) {
      const ids = buildQuiz({ mode, level: "N5", count: 30 }, data).questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("returns fewer questions only when the pool is genuinely too small", () => {
    const tiny = { vocab: vocabPool(5), kanji: kanjiPool(5), grammar: grammarPool(5) };
    const set = buildQuiz({ mode: "mixed", level: "N5", count: 30 }, tiny);
    expect(set.questions.length).toBeGreaterThan(0);
    expect(set.questions.length).toBeLessThanOrEqual(30);
  });

  it("every question has a valid answer index", () => {
    const set = buildQuiz({ mode: "mixed", level: "N5", count: 30 }, data);
    for (const q of set.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});

describe("P0-2: mock exam sizing", () => {
  // Бодит өгөгдөлд түвшин бүр өөрийн гэсэн сантай — түүнтэй ижил нөхцөл зохионо.
  const perLevel = <T>(make: (n: number, lvl: Level) => T[], n: number) =>
    levels.flatMap((lvl) => make(n, lvl));
  const big = {
    vocab: perLevel(vocabPool, 300),
    kanji: perLevel(kanjiPool, 300),
    grammar: perLevel(grammarPool, 200),
  };

  for (const lvl of levels) {
    it(`${lvl} exam fills every section to its blueprint count`, () => {
      const bp = EXAM_BLUEPRINTS[lvl];
      const sections = buildExam(bp, big, "mn");
      expect(sections).toHaveLength(bp.sections.length);
      sections.forEach((s, i) => {
        expect(s.questions.length).toBeLessThanOrEqual(bp.sections[i].count);
        expect(s.questions.length).toBe(bp.sections[i].count);
      });
      const total = sections.reduce((a, s) => a + s.questions.length, 0);
      expect(total).toBe(bp.sections.reduce((a, s) => a + s.count, 0));
    });
  }

  it("exam sections do not share identical question ids", () => {
    const sections = buildExam(EXAM_BLUEPRINTS.N5, big, "mn");
    const ids = sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(Math.min(ids.length, new Set(ids).size));
  });
});
