import { describe, expect, it } from "vitest";
import { canon, mergeDocs } from "./merge";
import { freshDoc, validateDoc } from "./storage";
import type { Doc } from "./store";

/* ─────────────── санамсаргүй үүсгэгч (гар бичсэн PRNG, номын сангүй) ─────────────── */

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length) % xs.length];
const int = (rand: () => number, max: number) => Math.floor(rand() * (max + 1));

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

function randomDoc(rand: () => number, seedTag: string): Doc {
  const base = freshDoc(`t-${seedTag}`);
  const now = 1_700_000_000_000 + int(rand, 100_000_000);

  const srs: Doc["srs"] = {};
  for (let i = 0; i < int(rand, 4); i++) {
    srs[`id${i}`] = {
      due: now + int(rand, 1_000_000),
      st: int(rand, 40),
      df: 1 + int(rand, 9),
      n: int(rand, 50),
      l: int(rand, 5),
      last: now + int(rand, 1_000_000),
      ph: pick(rand, ["new", "learning", "review", "relearn"] as const),
      streak: int(rand, 10),
      h: Array.from({ length: int(rand, 6) }, () => int(rand, 3)),
    };
  }

  const activity: Doc["activity"] = {};
  for (let i = 0; i < int(rand, 3); i++) {
    const day = `2026-10-${String(10 + i).padStart(2, "0")}`;
    const counts = {
      xp: int(rand, 200), min: int(rand, 60), newCards: int(rand, 30),
      reviews: int(rand, 120), correct: int(rand, 90), total: int(rand, 120),
    };
    activity[day] = rand() < 0.5
      ? { ...counts, parts: { [seedTag]: counts } }
      : { ...counts };
  }

  const profile = {
    ...base.profile,
    name: rand() < 0.5 ? `t-${seedTag}` : "",
    target: pick(rand, LEVELS),
    dailyGoal: pick(rand, [10, 20, 30, 60]),
    furigana: rand() < 0.5,
    theme: pick(rand, ["light", "sepia"] as const),
    language: pick(rand, ["mn", "en"] as const),
    romaji: rand() < 0.5,
  };

  return {
    ...base,
    profile,
    profileTs: {
      target: now - int(rand, 100_000),
      dailyGoal: now - int(rand, 100_000),
      furigana: now - int(rand, 100_000),
      theme: now - int(rand, 100_000),
    },
    srs,
    activity,
    xp: int(rand, 5000),
    xpParts: rand() < 0.7 ? { [seedTag]: int(rand, 5000) } : undefined,
    favorites: Array.from({ length: int(rand, 5) }, (_, i) => `fav${i}`),
    grammarDone: Array.from({ length: int(rand, 4) }, (_, i) => `g${i}`),
    mistakes: Array.from({ length: int(rand, 3) }, (_, i) => ({
      id: `m${i}`, kind: "vocab", level: pick(rand, LEVELS), prompt: "p", answer: "a", given: "g",
      at: now + int(rand, 1000), count: 1 + int(rand, 3),
    })),
    exams: Array.from({ length: int(rand, 2) }, (_, i) => ({
      id: `e${i}`, level: pick(rand, LEVELS), at: now + int(rand, 1000),
      sections: [], total: 30, max: 60, passed: rand() < 0.5, minutes: 60, mock: true,
    })),
    achievements: { a1: now, ...(rand() < 0.4 ? { a2: now } : {}) },
    tomb: rand() < 0.3 ? { "fav:old": now } : undefined,
    kanaBest: int(rand, 100),
    updatedAt: now,
    createdAt: now - 1_000_000,
  };
}

/* ─────────────── property тестүүд ─────────────── */

const CASES = 500;

describe("B1: mergeDocs property tests", () => {
  it(`commutative: merge(a,b) === merge(b,a) over ${CASES} random pairs`, () => {
    const rand = mulberry(1337);
    for (let i = 0; i < CASES; i++) {
      const a = randomDoc(rand, `a${i}`);
      const b = randomDoc(rand, `b${i}`);
      const now = a.updatedAt + 1;
      expect(canon(mergeDocs(a, b, { now }).doc)).toBe(canon(mergeDocs(b, a, { now }).doc));
    }
  });

  it(`associative: merge(merge(a,b),c) === merge(a,merge(b,c)) over ${CASES} triples`, () => {
    const rand = mulberry(4242);
    for (let i = 0; i < CASES; i++) {
      const a = randomDoc(rand, `a${i}`);
      const b = randomDoc(rand, `b${i}`);
      const c = randomDoc(rand, `c${i}`);
      const now = a.updatedAt + 1;
      const left = mergeDocs(mergeDocs(a, b, { now }).doc, c, { now }).doc;
      const right = mergeDocs(a, mergeDocs(b, c, { now }).doc, { now }).doc;
      expect(canon(left)).toBe(canon(right));
    }
  });

  it(`idempotent: re-merging either input changes nothing over ${CASES} cases`, () => {
    const rand = mulberry(77);
    for (let i = 0; i < CASES; i++) {
      const a = randomDoc(rand, `a${i}`);
      const b = randomDoc(rand, `b${i}`);
      const now = a.updatedAt + 1;
      const m = mergeDocs(a, b, { now }).doc;
      expect(canon(mergeDocs(m, a, { now }).doc)).toBe(canon(m));
      expect(canon(mergeDocs(a, m, { now }).doc)).toBe(canon(m));
    }
  });
});

/* ─────────────── сценарын тестүүд ─────────────── */

const NOW = 1_700_500_000_000;

function docWith(patch: Partial<Doc>): Doc {
  return { ...freshDoc("x"), ...patch, profile: { ...freshDoc("x").profile, ...(patch.profile ?? {}) } };
}

describe("B1: scenarios", () => {
  it("two devices: each keeps its own work (no device loses XP or cards)", () => {
    const deviceA = docWith({
      xp: 100, xpParts: { A: 100 }, updatedAt: NOW,
      srs: { w1: { due: NOW, st: 12, df: 5, n: 8, l: 1, last: NOW - 1000, ph: "review", streak: 3, h: [2, 2] } },
      activity: { "2026-10-20": { xp: 100, min: 10, newCards: 5, reviews: 40, correct: 30, total: 40, parts: { A: { xp: 100, min: 10, newCards: 5, reviews: 40, correct: 30, total: 40 } } } },
    });
    const deviceB = docWith({
      xp: 60, xpParts: { B: 60 }, updatedAt: NOW + 5000,
      srs: { w2: { due: NOW, st: 3, df: 6, n: 2, l: 0, last: NOW - 500, ph: "learning", streak: 1, h: [3] } },
      activity: { "2026-10-21": { xp: 60, min: 6, newCards: 3, reviews: 20, correct: 15, total: 20, parts: { B: { xp: 60, min: 6, newCards: 3, reviews: 20, correct: 15, total: 20 } } } },
    });

    const m = mergeDocs(deviceA, deviceB, { now: NOW + 10_000 }).doc;
    expect(m.xp).toBe(160);                 // нэгтгэгдэнэ (max биш)
    expect(Object.keys(m.srs).sort()).toEqual(["w1", "w2"]);
    expect(m.activity["2026-10-20"].xp).toBe(100);
    expect(m.activity["2026-10-21"].xp).toBe(60);

    // эсрэг дараалал ч ижил
    expect(canon(mergeDocs(deviceB, deviceA, { now: NOW + 10_000 }).doc)).toBe(canon(m));
  });

  it("card with the later review wins, but counters never shrink", () => {
    const older = docWith({ srs: { c: { due: 1, st: 9, df: 4, n: 20, l: 3, last: NOW - 10_000, ph: "review", streak: 5, h: [0, 1] } }, updatedAt: NOW - 100 });
    const newer = docWith({ srs: { c: { due: 2, st: 7, df: 6, n: 15, l: 1, last: NOW - 1000, ph: "review", streak: 4, h: [2] } }, updatedAt: NOW });
    const m = mergeDocs(older, newer, { now: NOW }).doc;
    expect(m.srs.c.last).toBe(NOW - 1000);  // хожсон: сүүлийн давталт
    expect(m.srs.c.n).toBe(20);             // нийт давталт хэзээ ч буурахгүй
    expect(m.srs.c.l).toBe(3);
    expect(m.srs.c.h).toEqual([2]);         // түүх: хожсон талынх (docs/SYNC.md §2)
  });

  it("offline-then-online: local work survives a stale remote", () => {
    const staleRemote = docWith({ xp: 40, xpParts: { X: 40 }, updatedAt: NOW - 86_400_000 });
    const local = docWith({ xp: 70, xpParts: { Y: 70 }, updatedAt: NOW });
    const m = mergeDocs(local, staleRemote, { now: NOW }).doc;
    expect(m.xp).toBe(110);
    expect(m.updatedAt).toBe(NOW);
  });

  it("clock skew: timestamps up to a year in the future are clamped, merge stays safe", () => {
    const skewed = docWith({ updatedAt: NOW + 365 * 86_400_000, kanaBest: 99 });
    const sane = docWith({ updatedAt: NOW, kanaBest: 12 });
    const m = mergeDocs(sane, skewed, { now: NOW }).doc;
    expect(m.updatedAt).toBe(NOW);                       // ирээдүйн цаг шахагдана
    expect(m.kanaBest).toBe(99);                          // ажил алдахгүй
  });

  it("empty remote → local unchanged (except schema-preserving pass)", () => {
    const local = docWith({ xp: 123, updatedAt: NOW });
    const m = mergeDocs(local, {}, { now: NOW });
    expect(m.doc.xp).toBe(123);
    expect(m.remoteOk).toBe(false);
  });

  it("empty local → remote adopted", () => {
    const remote = docWith({ xp: 456, updatedAt: NOW });
    const m = mergeDocs({ hello: "world" }, remote, { now: NOW });
    expect(m.doc.xp).toBe(456);
    expect(m.localOk).toBe(false);
  });

  it("corrupted remote → local kept, no destruction, flagged", () => {
    const local = docWith({ xp: 500, updatedAt: NOW, favorites: ["keep"] });
    const m = mergeDocs(local, "not-json-at-all", { now: NOW });
    expect(m.remoteOk).toBe(false);
    expect(m.doc.xp).toBe(500);
    expect(m.doc.favorites).toEqual(["keep"]);
  });

  it("tombstone: a deleted favorite does not resurrect", () => {
    const withDelete = docWith({ favorites: [], tomb: { "fav:gone": NOW }, updatedAt: NOW });
    const stale = docWith({ favorites: ["gone", "stay"], updatedAt: NOW - 1000 });
    const m = mergeDocs(withDelete, stale, { now: NOW }).doc;
    expect(m.favorites).toEqual(["stay"]);
  });

  it("repeated sync does not duplicate exams or quizzes (idempotent union)", () => {
    const d = docWith({
      updatedAt: NOW,
      exams: [{ id: "e1", level: "N5", at: NOW, sections: [], total: 10, max: 20, passed: false, minutes: 30, mock: true }],
      quizzes: [{ at: NOW, kind: "mixed", level: "N5", correct: 7, total: 10, minutes: 5 }],
    });
    const once = mergeDocs(d, d, { now: NOW }).doc;
    const twice = mergeDocs(once, d, { now: NOW }).doc;
    expect(twice.exams).toHaveLength(1);
    expect(twice.quizzes).toHaveLength(1);
    expect(canon(mergeDocs(twice, d, { now: NOW }).doc)).toBe(canon(twice));
  });

  it("XP from legacy (parts-less) docs is never doubled when merged twice", () => {
    const legacyA = docWith({ xp: 300, updatedAt: NOW - 1000 });
    const legacyB = docWith({ xp: 120, updatedAt: NOW });
    const m1 = mergeDocs(legacyA, legacyB, { now: NOW }).doc;
    expect(m1.xp).toBe(300);                        // legacy-г бүрэн дээр нь max (нэмбэл 420 бол давтан)
    const m2 = mergeDocs(m1, legacyB, { now: NOW }).doc;
    expect(m2.xp).toBe(300);
  });

  it("mixed legacy + attributed XP keeps both contributions", () => {
    const attributed = docWith({ xp: 100, xpParts: { A: 100 }, updatedAt: NOW });
    const legacy = docWith({ xp: 250, updatedAt: NOW - 500 });
    const m = mergeDocs(attributed, legacy, { now: NOW }).doc;
    expect(m.xp).toBe(350);
  });

  it("both sides must be valid docs before merging", () => {
    const ok = validateDoc(docWith({ xp: 1, updatedAt: NOW }));
    expect(ok.ok).toBe(true);
    expect(mergeDocs(null, null, { now: NOW }).remoteOk).toBe(false);
    expect(mergeDocs(null, null, { now: NOW }).localOk).toBe(false);
  });
});
