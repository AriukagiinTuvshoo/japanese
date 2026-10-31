import { describe, expect, it } from "vitest";
import { buildExam, buildQuiz, EXAM_BLUEPRINTS, officialSectionMin, scoreExam, sectionMin, strictSectionMin, type ExamPassMode, type QuizMode } from "./study";
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

/* ───────────── B5: жишиг шалгалтын тэнцэх хязгаар ─────────────
 * Албан ёсны эх сурвалж: jlpt.jp → “Determination of pass/fail”
 *   · Нийт: N1 100, N2 90, N3 95, N4 90, N5 80 (180-аас)
 *   · Хэсэг бүр: 19/60 (N4–N5 нэгтгэсэн хэсэгт 38/120) — нэг ч хэсэг
 *     доод оноонд хүрээгүй бол өндөр нийт оноотой ч ТЭНЦЭЭГҮЙ.
 * “Strict” горим: хэсэг бүр 60% (хүсэлтээр, default биш).
 */
describe("B5: section thresholds", () => {
  const modes: ExamPassMode[] = ["official", "strict"];

  /** `total` оноог хэсгүүдэд хуваана: бүгд доод оноо дээш, нийт нь `total`. */
  const scoresFor = (total: number, maxs: number[], mins: number[]): number[] => {
    const out: number[] = [];
    let left = total;
    for (let i = 0; i < maxs.length; i++) {
      const restMin = mins.slice(i + 1).reduce((a, b) => a + b, 0);
      const v = Math.max(mins[i], Math.min(maxs[i], left - restMin));
      out.push(v);
      left -= v;
    }
    return out;
  };

  const run = (lvl: (typeof levels)[number], scores: number[], mode: ExamPassMode) =>
    scoreExam(
      EXAM_BLUEPRINTS[lvl],
      EXAM_BLUEPRINTS[lvl].sections.map((s, i) => ({ section: s, correct: scores[i], total: s.max })),
      30,
      mode,
    );

  for (const mode of modes) {
    for (const lvl of levels) {
      const bp = EXAM_BLUEPRINTS[lvl];
      const maxs = bp.sections.map((s) => s.max);
      const mins = maxs.map((m) => sectionMin(m, mode));

      it(`${lvl} (${mode}): every section at exactly the minimum passes`, () => {
        const scored = run(lvl, mins, mode);
        expect(scored.sections.map((s) => s.score)).toEqual(mins);
        expect(scored.sections.every((s) => s.passedSection)).toBe(true);
        expect(scored.sectionsPassed).toBe(true);
        expect(scored.total).toBe(mins.reduce((a, b) => a + b, 0));
        // Нийт дүн: минимум хэсгүүд нь бүгдийн босгыг дамжуулна уу?
        expect(scored.passed).toBe(scored.total >= bp.passTotal);
      });

      for (let i = 0; i < bp.sections.length; i++) {
        const label = `${lvl} (${mode}) section ${bp.sections[i].id}`;
        it(`${label}: min−1 fails even when the total is high`, () => {
          // Бусад хэсгүүдийг БҮРЭН авч, зөвхөн нэгийг нь min−1 болгоно.
          const scores = [...maxs];
          scores[i] = mins[i] - 1;
          const others = maxs.reduce((a, b) => a + b, 0) - maxs[i];
          const total = others + scores[i];
          const scored = run(lvl, scores, mode);
          expect(scored.sections[i].score).toBe(mins[i] - 1);
          expect(scored.sections[i].passedSection).toBe(false);
          expect(scored.sectionsPassed).toBe(false);
          expect(scored.passed).toBe(false);
          // Нийт оноо 100%-д ойр байсан ч ХЭСЭГЛЭЭР унасан.
          expect(scored.total).toBeGreaterThanOrEqual(bp.passTotal);
          expect(scored.total).toBe(total);
        });

        it(`${label}: min passes, min+1 passes`, () => {
          const at = [...mins];
          at[i] = mins[i];
          const plus = [...mins];
          plus[i] = mins[i] + 1;
          expect(run(lvl, at, mode).sections[i].passedSection).toBe(true);
          expect(run(lvl, plus, mode).sections[i].passedSection).toBe(true);
        });
      }

      it(`${lvl} (${mode}): total pass/fail boundary (passTotal−1 fails, passTotal passes)`, () => {
        const minSum = mins.reduce((a, b) => a + b, 0);
        if (minSum > bp.passTotal - 1) {
          // Доод оноонуудын нийт нь босгыг аль хэдийн давчихсан — ийм нөхцөлд
          // "нийтээр унах" бараг боломжгүй (хэсэг бүр тэнцсэн л бол тэнцнэ).
          expect(run(lvl, mins, mode).total).toBe(minSum);
          expect(minSum).toBeGreaterThanOrEqual(bp.passTotal);
          return;
        }
        const below = run(lvl, scoresFor(bp.passTotal - 1, maxs, mins), mode);
        expect(below.sectionsPassed).toBe(true); // бүх хэсэг дээш
        expect(below.total).toBe(bp.passTotal - 1);
        expect(below.passed).toBe(false);

        const at = run(lvl, scoresFor(bp.passTotal, maxs, mins), mode);
        expect(at.sectionsPassed).toBe(true);
        expect(at.total).toBe(bp.passTotal);
        expect(at.passed).toBe(true);
      });

      it(`${lvl} (${mode}): all correct passes, all wrong fails`, () => {
        const perfect = run(lvl, maxs, mode);
        expect(perfect.total).toBe(180);
        expect(perfect.passed).toBe(true);
        const zero = run(lvl, maxs.map(() => 0), mode);
        expect(zero.total).toBe(0);
        expect(zero.sectionsPassed).toBe(false);
        expect(zero.passed).toBe(false);
      });
    }
  }

  it("official thresholds match jlpt.jp: 19/60 and 38/120", () => {
    expect(officialSectionMin(60)).toBe(19);
    expect(officialSectionMin(120)).toBe(38);
    expect(sectionMin(60, "official")).toBe(19);
    expect(sectionMin(120, "official")).toBe(38);
  });

  it("strict mode is 60% per section and stricter than official", () => {
    expect(strictSectionMin(60)).toBe(36);
    expect(strictSectionMin(120)).toBe(72);
    for (const max of [60, 120]) {
      expect(strictSectionMin(max)).toBeGreaterThan(officialSectionMin(max));
    }
  });

  it("official pass totals per level match the published marks", () => {
    expect(EXAM_BLUEPRINTS.N1.passTotal).toBe(100);
    expect(EXAM_BLUEPRINTS.N2.passTotal).toBe(90);
    expect(EXAM_BLUEPRINTS.N3.passTotal).toBe(95);
    expect(EXAM_BLUEPRINTS.N4.passTotal).toBe(90);
    expect(EXAM_BLUEPRINTS.N5.passTotal).toBe(80);
    for (const lvl of levels) {
      const bp = EXAM_BLUEPRINTS[lvl];
      expect(bp.sections.reduce((a, s) => a + s.max, 0)).toBe(180);
    }
  });
});
