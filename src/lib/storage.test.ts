import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, SCHEMA_VERSION, type Doc, type ExamRecord, type QuizRecord } from "./doc";
import { backupKeyOf, decodeDoc, docKeyOf, mergeDocs, readDoc, writeDoc, type KV } from "./storage";

/* ─────────────── туслах ─────────────── */

class MemoryKV implements KV {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const DAY = 86_400_000;
const UID = "local";

function makeDoc(over: Partial<Doc> = {}): Doc {
  return {
    v: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE, name: "Төвшин", onboarded: true },
    srs: {},
    writing: {},
    mnemonics: {},
    favorites: [],
    grammarDone: [],
    readingDone: [],
    listeningDone: [],
    kanaBest: 0,
    exams: [],
    quizzes: [],
    mistakes: [],
    activity: {},
    xp: 0,
    achievements: {},
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...over,
  };
}

const card = (n: number, last: number) => ({
  due: last, st: n, df: 5, n, l: 0, last, ph: "review" as const, streak: 1, h: [2 as const],
});

/* ─────────────── P0-5: schema version ─────────────── */

describe("decode contract", () => {
  it("is idempotent — decoding twice gives the same document", () => {
    const doc = makeDoc({
      xp: 120,
      activity: { "2026-01-01": { xp: 10, min: 5, newCards: 2, reviews: 3, correct: 2, total: 3, grammar: 1, reading: 0, listening: 0, newByLevel: { N5: 2 } } },
      srs: { w1: card(3, 500) },
      grammarDone: ["g1"],
    });
    const once = decodeDoc(JSON.stringify(doc));
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = decodeDoc(JSON.stringify(once.doc));
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.doc).toEqual(once.doc);
  });

  it("rejects corrupt JSON without throwing", () => {
    expect(decodeDoc("not-json").ok).toBe(false);
    expect(decodeDoc("[]").ok).toBe(false);
    expect(decodeDoc(JSON.stringify({ hello: "world" })).ok).toBe(false);
  });

  it("drops fields outside the schema (documented contract)", () => {
    const doc = { ...makeDoc({ xp: 10 }), unknownTop: { a: 1 } } as unknown as Doc;
    const res = decodeDoc(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((res.doc as unknown as Record<string, unknown>).unknownTop).toBeUndefined();
    expect(res.doc.xp).toBe(10);
  });
});

describe("schema versioning", () => {
  it("upgrades a v3 document (saved before profile.language existed) to the current version", () => {
    const legacy = { ...makeDoc(), v: 3, profile: { ...DEFAULT_PROFILE, name: "Төвшин" } as Record<string, unknown> };
    delete legacy.profile.language;

    const res = decodeDoc(JSON.stringify(legacy));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromVersion).toBe(3);
    expect(res.migrated).toBe(true);
    expect(res.doc.v).toBe(SCHEMA_VERSION);
    expect(res.doc.profile.language).toBe("mn");
    expect(res.doc.profile.name).toBe("Төвшин");
  });

  it("keeps an existing language choice during migration", () => {
    const legacy = { ...makeDoc(), v: 3, profile: { ...DEFAULT_PROFILE, language: "en" as const } };
    const res = decodeDoc(JSON.stringify(legacy));
    expect(res.ok && res.doc.profile.language).toBe("en");
  });

  it("is idempotent: migrating an already-migrated document changes nothing", () => {
    const once = decodeDoc(JSON.stringify({ ...makeDoc(), v: 3 }));
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = decodeDoc(JSON.stringify(once.doc));
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.migrated).toBe(false);
    expect(twice.doc).toEqual(once.doc);
  });

  it("refuses a document from a newer app version instead of guessing", () => {
    const res = decodeDoc(JSON.stringify({ ...makeDoc(), v: SCHEMA_VERSION + 1 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("future");
    expect(res.futureVersion).toBe(SCHEMA_VERSION + 1);
  });

  it("a document with no version field is treated as the oldest schema and upgraded", () => {
    const legacy = { ...makeDoc() } as Record<string, unknown>;
    delete legacy.v;
    const res = decodeDoc(JSON.stringify(legacy));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromVersion).toBe(0);
    expect(res.migrated).toBe(true);
    expect(res.doc.profile.language).toBe("mn");
  });
});

/* ─────────────── P0-5: corrupted data ─────────────── */

describe("corrupted storage", () => {
  it("keeps the original bytes under a backup key and reports corruption", () => {
    const kv = new MemoryKV();
    const raw = "{CORRUPTED!!! not json";
    kv.setItem(docKeyOf(UID), raw);

    const res = readDoc(kv, UID);
    expect(res.status).toBe("corrupt");
    expect(res.raw).toBe(raw);
    expect(res.backupKey).toBeTruthy();
    expect(kv.getItem(res.backupKey!)).toBe(raw);
  });

  it("never overwrites the corrupted value during the read", () => {
    const kv = new MemoryKV();
    const raw = "not json at all";
    kv.setItem(docKeyOf(UID), raw);
    readDoc(kv, UID);
    expect(kv.getItem(docKeyOf(UID))).toBe(raw);
  });

  it("does not write over corrupt data, but writes once the user resolves it", () => {
    const kv = new MemoryKV();
    kv.setItem(docKeyOf(UID), "<<<broken>>>");
    expect(readDoc(kv, UID).status).toBe("corrupt");

    const blocked = writeDoc(kv, UID, makeDoc(), { allowOverwrite: false });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("blocked");
    expect(kv.getItem(docKeyOf(UID))).toBe("<<<broken>>>");

    const ok = writeDoc(kv, UID, makeDoc(), { allowOverwrite: true });
    expect(ok.ok).toBe(true);
    expect(readDoc(kv, UID).status).toBe("ok");
  });

  it("reports a future-version document without touching it", () => {
    const kv = new MemoryKV();
    const raw = JSON.stringify({ ...makeDoc(), v: SCHEMA_VERSION + 5 });
    kv.setItem(docKeyOf(UID), raw);
    const res = readDoc(kv, UID);
    expect(res.status).toBe("future");
    expect(res.futureVersion).toBe(SCHEMA_VERSION + 5);
    expect(kv.getItem(docKeyOf(UID))).toBe(raw);
  });

  it("backs up the raw document before migrating it", () => {
    const kv = new MemoryKV();
    const legacy = JSON.stringify({ ...makeDoc(), v: 3 });
    kv.setItem(docKeyOf(UID), legacy);
    const res = readDoc(kv, UID);
    expect(res.status).toBe("ok");
    expect(res.migrated).toBe(true);
    expect(res.backupKey).toBe(backupKeyOf(UID, "v3"));
    expect(kv.getItem(res.backupKey!)).toBe(legacy);
  });
});

/* ─────────────── P0-5: quota ─────────────── */

describe("quota errors", () => {
  it("surfaces QuotaExceededError instead of swallowing it", () => {
    const kv = new MemoryKV();
    kv.setItem = () => {
      const err = new Error("full") as Error & { name: string; code: number };
      err.name = "QuotaExceededError";
      err.code = 22;
      throw err;
    };
    const res = writeDoc(kv, UID, makeDoc());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("quota");
  });

  it("classifies other storage failures separately", () => {
    const kv = new MemoryKV();
    kv.setItem = () => {
      throw new Error("SecurityError");
    };
    const res = writeDoc(kv, UID, makeDoc());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("error");
  });
});

/* ─────────────── P0-5: import validation ─────────────── */

describe("import validation", () => {
  it("rejects non-JSON and non-object payloads", () => {
    expect(decodeDoc("{nope").ok).toBe(false);
    expect(decodeDoc("42").ok).toBe(false);
    expect(decodeDoc("[]").ok).toBe(false);
    expect(decodeDoc("null").ok).toBe(false);
  });

  it("rejects an object that is not a study document", () => {
    const res = decodeDoc(JSON.stringify({ hello: "world" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-object");
  });

  it("accepts a real exported document", () => {
    expect(decodeDoc(JSON.stringify(makeDoc())).ok).toBe(true);
  });
});

/* ─────────────── P0-5: cross-tab merge ─────────────── */

describe("mergeDocs", () => {
  const base = makeDoc();

  it("never loses cards or favourites from either tab", () => {
    const a = makeDoc({ srs: { w1: card(2, 100) }, favorites: ["w1"], xp: 30 });
    const b = makeDoc({ srs: { w2: card(5, 500) }, favorites: ["w2"], xp: 70 });
    const m = mergeDocs(a, b);
    expect(Object.keys(m.srs).sort()).toEqual(["w1", "w2"]);
    expect([...m.favorites].sort()).toEqual(["w1", "w2"]);
    expect(m.xp).toBe(70);
  });

  it("takes the more recently reviewed card for the same id", () => {
    const a = makeDoc({ srs: { w1: card(2, 100) } });
    const b = makeDoc({ srs: { w1: card(7, 900) } });
    expect(mergeDocs(a, b).srs.w1.n).toBe(7);
    expect(mergeDocs(b, a).srs.w1.n).toBe(7);
  });

  it("is commutative and idempotent (two tabs converge without ping-pong)", () => {
    const a = makeDoc({
      srs: { w1: card(2, 100) },
      grammarDone: ["g1"],
      activity: { "2026-01-01": { xp: 10, min: 5, newCards: 2, reviews: 3, correct: 2, total: 3, grammar: 0, reading: 0, listening: 0 } },
      achievements: { first: 10 },
      mistakes: [{ id: "m1", kind: "vocab", level: "N5", prompt: "p", answer: "a", given: "g", at: 5, count: 2 }],
    });
    const b = makeDoc({
      srs: { w2: card(5, 500) },
      grammarDone: ["g2"],
      activity: { "2026-01-01": { xp: 4, min: 9, newCards: 0, reviews: 7, correct: 5, total: 5, grammar: 0, reading: 0, listening: 0 } },
      achievements: { first: 7 },
      mistakes: [{ id: "m1", kind: "vocab", level: "N5", prompt: "p", answer: "a", given: "g", at: 9, count: 3 }],
    });

    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
    const once = mergeDocs(a, b);
    expect(mergeDocs(once, b)).toEqual(once);
    expect(mergeDocs(once, once)).toEqual(once);

    expect(once.activity["2026-01-01"]).toEqual({ xp: 10, min: 9, newCards: 2, reviews: 7, correct: 5, total: 5, grammar: 0, reading: 0, listening: 0 });
    expect(once.mistakes[0].count).toBe(3);
    expect(once.achievements.first).toBe(7);
  });

  it("keeps newCards consistent with the per-level breakdown", () => {
    const a = makeDoc({
      activity: { "2026-01-01": { xp: 5, min: 1, newCards: 1, reviews: 1, correct: 1, total: 1, grammar: 0, reading: 0, listening: 0, newByLevel: { N5: 1 } } },
    });
    const b = makeDoc({
      activity: { "2026-01-01": { xp: 5, min: 1, newCards: 1, reviews: 1, correct: 1, total: 1, grammar: 0, reading: 0, listening: 0, newByLevel: { N2: 1 } } },
    });
    const merged = mergeDocs(a, b).activity["2026-01-01"];
    expect(merged.newByLevel).toEqual({ N5: 1, N2: 1 });
    expect(merged.newCards).toBe(2);
  });

  it("never lowers xp or a card's review count during merge", () => {
    const a = makeDoc({ xp: 90, srs: { w1: card(2, 100) } });
    const b = makeDoc({ xp: 40, srs: { w1: card(7, 900) } });
    const merged = mergeDocs(a, b);
    expect(merged.xp).toBe(90);
    expect(merged.srs.w1.n).toBe(7);
    expect(Object.keys(merged.srs)).toEqual(["w1"]);
  });

  it("merges per-level new card counters with max", () => {
    const day = (newByLevel: Record<string, number>) => ({
      ...{ xp: 10, min: 5, newCards: 3, reviews: 4, correct: 3, total: 4, grammar: 0, reading: 0, listening: 0 },
      newByLevel,
    });
    const a = makeDoc({ activity: { "2026-01-01": day({ N5: 2, N2: 1 }) } });
    const b = makeDoc({ activity: { "2026-01-01": day({ N5: 1, N2: 4 }) } });
    expect(mergeDocs(a, b).activity["2026-01-01"].newByLevel).toEqual({ N5: 2, N2: 4 });
    expect(mergeDocs(b, a).activity["2026-01-01"].newByLevel).toEqual({ N5: 2, N2: 4 });
  });

  it("prefers the newer profile and keeps the newest updatedAt", () => {
    const older = makeDoc({ updatedAt: base.updatedAt - DAY, profile: { ...DEFAULT_PROFILE, name: "Old", dailyGoal: 10 } });
    const newer = makeDoc({ updatedAt: base.updatedAt, profile: { ...DEFAULT_PROFILE, name: "New", dailyGoal: 50 } });
    const m = mergeDocs(older, newer);
    expect(m.profile.name).toBe("New");
    expect(m.profile.dailyGoal).toBe(50);
    expect(m.updatedAt).toBe(newer.updatedAt);
    expect(mergeDocs(newer, older).profile.name).toBe("New");
  });

  it("unions exams and quizzes without duplicating them", () => {
    const exam = {
      id: "e1", level: "N5" as const, at: 1, sections: [], total: 10, max: 20, passed: false, minutes: 3, mock: false,
    };
    const quiz = { at: 5, kind: "vocab", level: "N5" as const, correct: 4, total: 5, minutes: 2 };
    const a = makeDoc({ exams: [exam], quizzes: [quiz] });
    const b = makeDoc({ exams: [exam], quizzes: [quiz] });
    const m = mergeDocs(a, b);
    expect(m.exams).toHaveLength(1);
    expect(m.quizzes).toHaveLength(1);
    expect(m.exams).toEqual(mergeDocs(b, a).exams);
  });
});

/* ─────────────── Phase 2.2: quiz төрөл ба тохиргоо ─────────────── */

describe("quiz kind normalization", () => {
  it("maps legacy Mongolian and English labels to stable ids", () => {
    const raw = {
      ...makeDoc(),
      quizzes: [
        { at: 3, kind: "Япон → Монгол", level: "N5", correct: 8, total: 10, minutes: 2 },
        { at: 2, kind: "Japanese → English", level: "N5", correct: 7, total: 10, minutes: 2 },
        { at: 1, kind: "Ханзны уншлага", level: "N4", correct: 5, total: 10, minutes: 2 },
      ],
    };
    const res = decodeDoc(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.quizzes.map((q) => q.kind)).toEqual(["vocab-jp-mn", "vocab-jp-mn", "kanji-read"]);
  });

  it("is idempotent — loading a normalized document changes nothing", () => {
    const raw = {
      ...makeDoc(),
      quizzes: [{ at: 1, kind: "Сонсгол", level: "N5", correct: 1, total: 4, minutes: 1 }],
    };
    const first = decodeDoc(JSON.stringify(raw));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = decodeDoc(JSON.stringify(first.doc));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.doc.quizzes).toEqual(first.doc.quizzes);
  });

  it("keeps an unknown legacy exam title verbatim instead of guessing", () => {
    const raw = {
      ...makeDoc(),
      quizzes: [{ at: 1, kind: "N5 жишиг шалгалт · Сонсгол", level: "N5", correct: 1, total: 4, minutes: 1 }],
    };
    const res = decodeDoc(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.quizzes[0].kind).toBe("N5 жишиг шалгалт · Сонсгол");
  });
});

describe("per-level new card counters in stored activity", () => {
  it("keeps only known levels and non-negative counts", () => {
    const doc = makeDoc({
      activity: {
        "2026-11-07": {
          xp: 5, min: 1, newCards: 3, reviews: 0, correct: 0, total: 0, grammar: 0, reading: 0, listening: 0,
          newByLevel: { N2: 2, N9: 5, N5: "x", N1: -3 } as never,
        },
      },
    });
    const res = decodeDoc(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.activity["2026-11-07"].newByLevel).toEqual({ N2: 2 });
    expect(res.doc.activity["2026-11-07"].newCards).toBe(3);
  });

  it("raises a newCards total that is below its per-level sum", () => {
    const doc = makeDoc({
      activity: {
        "2026-11-07": {
          xp: 5, min: 1, newCards: 1, reviews: 2, correct: 1, total: 2, grammar: 0, reading: 0, listening: 0,
          newByLevel: { N5: 1, N2: 1 },
        },
      },
    });
    const res = decodeDoc(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.activity["2026-11-07"].newCards).toBe(2);
    expect(res.doc.activity["2026-11-07"].newByLevel).toEqual({ N5: 1, N2: 1 });
  });

  it("leaves legacy activity without a breakdown unchanged", () => {
    const doc = makeDoc({
      activity: {
        "2026-11-07": { xp: 5, min: 1, newCards: 3, reviews: 0, correct: 0, total: 0, grammar: 0, reading: 0, listening: 0 },
      },
    });
    const res = decodeDoc(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.activity["2026-11-07"].newByLevel).toBeUndefined();
  });
});

describe("quiz count preference", () => {
  it("fills the default for an older profile without a schema bump", () => {
    const doc = makeDoc();
    const profile = { ...doc.profile } as Record<string, unknown>;
    delete profile.quiz;
    const res = decodeDoc(JSON.stringify({ ...doc, profile }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.migrated).toBe(false);
    expect(res.doc.v).toBe(SCHEMA_VERSION);
    expect(res.doc.profile.quiz).toEqual(DEFAULT_PROFILE.quiz);
  });

  it("keeps srs, xp, activity and mistakes untouched while adding the preference", () => {
    const doc = makeDoc({
      srs: { "日": card(7, 1000) },
      xp: 4242,
      activity: { "2026-01-01": { xp: 10, min: 5, newCards: 1, reviews: 4, correct: 3, total: 4, grammar: 0, reading: 0, listening: 0 } },
      mistakes: [
        { id: "v-1", kind: "vocab", level: "N5", prompt: "水", answer: "ус", given: "гал", at: 5, count: 2 },
      ],
    });
    const profile = { ...doc.profile } as Record<string, unknown>;
    delete profile.quiz;
    const before = JSON.parse(JSON.stringify(doc)) as Doc;
    const res = decodeDoc(JSON.stringify({ ...before, profile }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.srs).toEqual(before.srs);
    expect(res.doc.xp).toBe(4242);
    expect(res.doc.activity).toEqual(before.activity);
    expect(res.doc.mistakes).toEqual(before.mistakes);
    expect(res.doc.profile.quiz).toEqual(DEFAULT_PROFILE.quiz);
  });

  it("round-trips a stored count and snaps an unsupported one to an offered option", () => {
    const stored = { ...makeDoc(), profile: { ...DEFAULT_PROFILE, quiz: { count: 30 } } };
    const ok = decodeDoc(JSON.stringify(stored));
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.doc.profile.quiz.count).toBe(30);

    const odd = { ...makeDoc(), profile: { ...DEFAULT_PROFILE, quiz: { count: 17 } } };
    const snapped = decodeDoc(JSON.stringify(odd));
    expect(snapped.ok).toBe(true);
    if (!snapped.ok) return;
    expect(snapped.doc.profile.quiz.count).toBe(15);
  });
});

/* ─────────────── Merge: шинэ→хуучин дараалал ба legаци мөр ─────────────── */

describe("mergeDocs — newest-first order", () => {
  const q = (kind: string, at: number, total = 10): QuizRecord => ({ at, kind, level: "N5", correct: 1, total, minutes: 1 });
  const e = (id: string, at: number): ExamRecord => ({
    id, level: "N5", at, sections: [], total: 0, max: 0, passed: false, minutes: 1, mock: true,
  });

  it("returns quizzes newest-first regardless of argument order", () => {
    const a = makeDoc({ quizzes: [q("kanji-read", 1000)] });
    const b = makeDoc({ quizzes: [q("vocab-jp-mn", 9000)] });
    expect(mergeDocs(a, b).quizzes.map((x) => x.at)).toEqual([9000, 1000]);
    expect(mergeDocs(b, a).quizzes.map((x) => x.at)).toEqual([9000, 1000]);
  });

  it("breaks equal timestamps deterministically, not by argument order", () => {
    const a = makeDoc({ quizzes: [q("kanji-read", 500), q("reading", 500)] });
    const b = makeDoc({ quizzes: [q("reading", 500), q("kanji-read", 500)] });
    expect(mergeDocs(a, b).quizzes.map((x) => x.kind)).toEqual(["kanji-read", "reading"]);
    expect(mergeDocs(a, b).quizzes).toEqual(mergeDocs(b, a).quizzes);
  });

  it("returns exams newest-first too", () => {
    const a = makeDoc({ exams: [e("a", 100)] });
    const b = makeDoc({ exams: [e("b", 200)] });
    expect(mergeDocs(a, b).exams.map((x) => x.id)).toEqual(["b", "a"]);
    expect(mergeDocs(b, a).exams.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("collapses a legacy label and a stable id of one attempt", () => {
    const a = decodeDoc(JSON.stringify({ ...makeDoc(), quizzes: [q("kanji-read", 1000)] }));
    const b = decodeDoc(JSON.stringify({ ...makeDoc(), quizzes: [q("Ханзны уншлага", 1000)] }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.doc.quizzes[0].kind).toBe("kanji-read");
    expect(mergeDocs(a.doc, b.doc).quizzes).toHaveLength(1);
  });

  it("keeps legacy exam records without doubling xp or activity", () => {
    const day = { xp: 30, min: 5, newCards: 1, reviews: 20, correct: 1, total: 20, grammar: 0, reading: 0, listening: 0 };
    const legacy = makeDoc({ quizzes: [q("N5 жишиг шалгалт · Сонсгол", 42, 20)], xp: 30, activity: { "2026-01-01": day } });
    const other = makeDoc({ quizzes: [q("N5 жишиг шалгалт · Сонсгол", 42, 20)], xp: 30, activity: { "2026-01-01": day } });
    const once = mergeDocs(legacy, other);
    expect(once.quizzes).toHaveLength(1);
    expect(once.quizzes[0].kind).toBe("N5 жишиг шалгалт · Сонсгол");
    expect(once.xp).toBe(30);
    expect(once.activity["2026-01-01"]).toEqual(day);
    expect(mergeDocs(once, other)).toEqual(once);
    expect(mergeDocs(once, once)).toEqual(once);
  });
});
