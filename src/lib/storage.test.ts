import { afterEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, backupKey, docKey, loadDoc, parseStoredDoc, saveDoc, validateDoc } from "./storage";

const validDoc = {
  v: SCHEMA_VERSION,
  profile: {
    name: "Тест",
    current: "N5",
    target: "N3",
    examDate: "",
    dailyGoal: 30,
    newPerDay: 12,
    furigana: true,
    rate: 0.95,
    onboarded: true,
    theme: "light",
    romaji: false,
    language: "mn",
  },
  srs: {
    "v1": { due: 1, st: 2, df: 5, n: 1, l: 0, last: 0, ph: "review", streak: 1, h: [2] },
  },
  writing: {},
  mnemonics: {},
  favorites: ["v1"],
  grammarDone: [],
  readingDone: [],
  listeningDone: [],
  kanaBest: 0,
  exams: [],
  quizzes: [],
  mistakes: [],
  activity: {},
  xp: 10,
  achievements: {},
  createdAt: 1,
  updatedAt: 2,
};

describe("P0-3: corruption that used to white-screen the app", () => {
  it("recovers a doc whose srs is a string instead of crashing", () => {
    const raw = JSON.stringify({ ...validDoc, srs: "not-an-object", activity: 42, mistakes: "x" });
    const res = parseStoredDoc(raw);
    expect(res.status).toBe("recovered");
    expect(typeof res.doc.srs).toBe("object");
    expect(Array.isArray(res.doc.mistakes)).toBe(true);
    expect(typeof res.doc.activity).toBe("object");
    expect(res.corruptRaw).toBe(raw);
    expect(res.reason).toBeTruthy();
  });

  it("never throws on unparseable JSON and keeps the raw value for backup", () => {
    const raw = "{NOT JSON!!";
    const res = parseStoredDoc(raw);
    expect(res.status).toBe("recovered");
    expect(res.doc.v).toBe(SCHEMA_VERSION);
    expect(res.corruptRaw).toBe(raw);
  });

  it("drops only the broken srs cards, keeping the healthy ones", () => {
    const raw = JSON.stringify({
      ...validDoc,
      srs: { good: validDoc.srs.v1, bad: { due: "soon" }, alsoBad: null },
    });
    const res = parseStoredDoc(raw);
    expect(Object.keys(res.doc.srs)).toEqual(["good"]);
    expect(res.status).toBe("recovered");
  });

  it("repairs a wrong profile language instead of trusting it", () => {
    const raw = JSON.stringify({ ...validDoc, profile: { ...validDoc.profile, language: "kz" } });
    const res = parseStoredDoc(raw);
    expect(res.doc.profile.language).toBe("mn");
  });
});

describe("P0-3: migrations", () => {
  it("migrates a v2 document and adds the fields introduced in v3", () => {
    const legacy = {
      v: 2,
      profile: { name: "Хуучин", current: "N4", target: "N2", dailyGoal: 20, onboarded: true },
      srs: {},
      favorites: ["a"],
      xp: 5,
    };
    const res = parseStoredDoc(JSON.stringify(legacy));
    expect(res.status).toBe("migrated");
    expect(res.doc.v).toBe(SCHEMA_VERSION);
    expect(res.doc.profile.name).toBe("Хуучин");
    expect(res.doc.profile.language).toBe("mn");
    expect(Array.isArray(res.doc.mistakes)).toBe(true);
    expect(res.doc.writing).toEqual({});
    expect(res.doc.favorites).toEqual(["a"]);
    expect(res.doc.updatedAt).toBeGreaterThan(0);
  });

  it("is idempotent: a migrated doc parses as ok next time", () => {
    const once = parseStoredDoc(JSON.stringify({ v: 2, profile: {}, srs: {} }));
    const twice = parseStoredDoc(JSON.stringify(once.doc));
    expect(twice.status).toBe("ok");
    expect(twice.doc.v).toBe(SCHEMA_VERSION);
  });

  it("treats a missing document as a fresh, valid one", () => {
    const res = parseStoredDoc(null);
    expect(res.status).toBe("ok");
    expect(res.doc.v).toBe(SCHEMA_VERSION);
    expect(res.doc.profile.onboarded).toBe(false);
    expect(res.doc.srs).toEqual({});
  });

  it("keeps a valid document untouched", () => {
    const res = parseStoredDoc(JSON.stringify(validDoc));
    expect(res.status).toBe("ok");
    expect(res.doc.profile.name).toBe("Тест");
    expect(res.doc.favorites).toEqual(["v1"]);
    expect(res.doc.xp).toBe(10);
  });
});

describe("P0-3: import validation", () => {
  it("rejects non-objects and strings", () => {
    expect(validateDoc(null).ok).toBe(false);
    expect(validateDoc("nope").ok).toBe(false);
    expect(validateDoc([]).ok).toBe(false);
    expect(validateDoc(42).ok).toBe(false);
  });

  it("rejects payloads that are not progress documents", () => {
    expect(validateDoc({ hello: "world" }).ok).toBe(false);
    expect(validateDoc({ srs: "x", profile: {} }).ok).toBe(false);
  });

  it("accepts a real document", () => {
    const v = validateDoc(validDoc);
    expect(v.ok).toBe(true);
  });
});

describe("P0-3: backup keys", () => {
  it("produces a distinct, namespaced key per timestamp", () => {
    expect(backupKey("local", 1000)).toBe("nd:doc:local:corrupt:1000");
    expect(backupKey("u1", 1)).not.toBe(backupKey("u1", 2));
  });
});

/** localStorage-ийн хамгийн бага дуураймал — quota алдааг ч дуурайлгана. */
function fakeStorage(opts: { failWrites?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("P0-3: localStorage integration (backup + quota)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("backs the corrupt raw value up under its own key before recovering", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const bad = JSON.stringify({ v: 3, srs: "not-an-object" });
    store.setItem(docKey("local"), bad);

    const { doc, status } = loadDoc("local", 5000);
    expect(status).toBe("recovered");
    expect(store.getItem(backupKey("local", 5000))).toBe(bad);
    expect(typeof doc.srs).toBe("object");
    // сэргээсэн, хүчинтэй документыг бичиж үлдээнэ — дараагийн уншилт цэвэр
    expect(loadDoc("local").status).toBe("ok");
  });

  it("does not lose data when the store rejects writes (private mode / quota)", () => {
    const store = fakeStorage({ failWrites: true });
    vi.stubGlobal("localStorage", store);
    const { doc, status } = loadDoc("local");
    expect(status).toBe("ok");
    expect(doc.v).toBe(SCHEMA_VERSION);
    expect(saveDoc("local", doc)).toBe(false);
  });

  it("saveDoc reports success for a normal write", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const doc = parseStoredDoc(null).doc;
    expect(saveDoc("local", doc)).toBe(true);
    expect(store.getItem(docKey("local"))).toContain('"v":3');
  });
});
