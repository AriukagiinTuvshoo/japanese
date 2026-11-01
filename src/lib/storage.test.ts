import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, SCHEMA_VERSION, type Doc } from "./doc";
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
      activity: { "2026-01-01": { xp: 10, min: 5, newCards: 2, reviews: 3, correct: 2, total: 3 } },
      achievements: { first: 10 },
      mistakes: [{ id: "m1", kind: "vocab", level: "N5", prompt: "p", answer: "a", given: "g", at: 5, count: 2 }],
    });
    const b = makeDoc({
      srs: { w2: card(5, 500) },
      grammarDone: ["g2"],
      activity: { "2026-01-01": { xp: 4, min: 9, newCards: 0, reviews: 7, correct: 5, total: 5 } },
      achievements: { first: 7 },
      mistakes: [{ id: "m1", kind: "vocab", level: "N5", prompt: "p", answer: "a", given: "g", at: 9, count: 3 }],
    });

    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
    const once = mergeDocs(a, b);
    expect(mergeDocs(once, b)).toEqual(once);
    expect(mergeDocs(once, once)).toEqual(once);

    expect(once.activity["2026-01-01"]).toEqual({ xp: 10, min: 9, newCards: 2, reviews: 7, correct: 5, total: 5 });
    expect(once.mistakes[0].count).toBe(3);
    expect(once.achievements.first).toBe(7);
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
