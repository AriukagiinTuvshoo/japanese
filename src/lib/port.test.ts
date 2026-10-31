import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_IMPORT_BYTES, ankiCsv, applyImport, clearUndo, csvCell, exportRows, isWeak,
  loadUndo, parseImport, previewOf, saveUndo,
} from "./port";
import { freshDoc, SCHEMA_VERSION } from "./storage";
import { todayKey } from "./text";
import type { Doc } from "./store";
import type { Kanji, Vocab } from "./types";

const NOW = 1_700_500_000_000;

function docWith(patch: Partial<Doc>): Doc {
  const base = freshDoc("u");
  return { ...base, ...patch, profile: { ...base.profile, ...(patch.profile ?? {}) } };
}

const valid = docWith({
  xp: 320, updatedAt: NOW, createdAt: NOW - 1000,
  srs: {
    w1: { due: NOW - 1000, st: 4, df: 6, n: 5, l: 2, last: NOW - 2000, ph: "review", streak: 0, h: [2, 0, 1] },
    w2: { due: NOW + 999_999, st: 20, df: 3, n: 9, l: 0, last: NOW - 500, ph: "review", streak: 6, h: [3, 3, 3] },
  },
  activity: { [todayKey()]: { xp: 40, min: 10, newCards: 3, reviews: 20, correct: 15, total: 20 } },
  favorites: ["f1"],
});

afterEach(() => vi.unstubAllGlobals());

describe("B3: import validation (same schema as storage.ts)", () => {
  it("rejects malformed JSON with a typed error", () => {
    const r = parseImport("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("badJson");
  });

  it("rejects wrong types (srs as string, favorites as number)", () => {
    const r = parseImport(JSON.stringify({ v: 3, xp: 1, srs: "boom", favorites: 42, activity: {}, createdAt: 1, updatedAt: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("badDoc");
  });

  it("accepts an old schema version and migrates it to the current one", () => {
    const old = JSON.stringify({ ...valid, v: 1, profileTs: undefined });
    const r = parseImport(old);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.v).toBe(SCHEMA_VERSION);
  });

  it("rejects a file from a NEWER version instead of dropping its fields", () => {
    const r = parseImport(JSON.stringify({ ...valid, v: SCHEMA_VERSION + 5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("newerVersion");
  });

  it("rejects files over 5 MB before parsing them", () => {
    const huge = `{"xp":0,"pad":"${"x".repeat(MAX_IMPORT_BYTES)}"}`;
    expect(huge.length).toBeGreaterThan(MAX_IMPORT_BYTES);
    const r = parseImport(huge);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("tooLarge");
  });

  it("rejects prototype-pollution keys and never pollutes Object.prototype", () => {
    const evil = `{"v":3,"xp":1,"createdAt":1,"updatedAt":1,"srs":{"__proto__":{"polluted":1},"w1":{"due":1,"st":1,"df":1,"n":1,"l":0,"last":1,"ph":"review","streak":0,"h":[]}},"activity":{}}`;
    const r = parseImport(evil);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("__proto__");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it("also blocks constructor/prototype keys nested in a list", () => {
    const evil = JSON.stringify({ v: 3, xp: 1, createdAt: 1, activity: {}, srs: {}, favorites: [], mistakes: [{ constructor: 1 }] });
    const r = parseImport(evil);
    expect(r.ok).toBe(false);
  });

  it("preview reports cards, xp, streak, days and version", () => {
    const r = parseImport(JSON.stringify(valid));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.preview.cards).toBe(2);
      expect(r.preview.xp).toBe(320);
      expect(r.preview.version).toBe(SCHEMA_VERSION);
      expect(r.preview.days).toBe(1);
      expect(r.preview.streak).toBeGreaterThanOrEqual(1);
    }
    expect(previewOf(valid).favorites).toBe(1);
  });
});

describe("B3: apply / undo", () => {
  it("merge mode keeps current progress and adds the import (default)", () => {
    const current = docWith({ xp: 100, xpParts: { a: 100 }, updatedAt: NOW });
    const incoming = docWith({ xp: 50, xpParts: { b: 50 }, updatedAt: NOW - 10 });
    expect(applyImport(current, incoming, "merge", NOW).xp).toBe(150);
  });

  it("replace mode takes the imported doc as-is", () => {
    const current = docWith({ xp: 100, updatedAt: NOW });
    const incoming = docWith({ xp: 50, updatedAt: NOW - 10 });
    expect(applyImport(current, incoming, "replace", NOW).xp).toBe(50);
  });

  it("importing the same file twice is idempotent in merge mode", () => {
    const current = docWith({ xp: 100, xpParts: { a: 100 }, updatedAt: NOW });
    const incoming = docWith({ xp: 50, xpParts: { b: 50 }, updatedAt: NOW - 10, srs: valid.srs });
    const once = applyImport(current, incoming, "merge", NOW);
    const twice = applyImport(once, incoming, "merge", NOW);
    expect(twice.xp).toBe(once.xp);
    expect(Object.keys(twice.srs)).toEqual(Object.keys(once.srs));
  });

  it("one-click undo restores the exact pre-import document", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      key: () => null, length: 0,
    });

    const before = docWith({ xp: 100, updatedAt: NOW });
    expect(saveUndo("u", before)).toBe(true);
    expect(loadUndo("u")?.xp).toBe(100);

    const imported = applyImport(before, docWith({ xp: 999, xpParts: { b: 999 }, updatedAt: NOW + 1 }), "merge", NOW + 1);
    expect(imported.xp).toBe(1099);

    const restored = loadUndo("u");
    expect(restored?.xp).toBe(100);          // буцаах нь үнэн зөв баримт
    clearUndo("u");
    expect(loadUndo("u")).toBeNull();
  });
});

describe("B3: Anki CSV export", () => {
  const vocab: Vocab[] = [{
    id: "w1", w: "食べる", r: "たべる", rm: "taberu", en: ["to eat"], mn: ["идэх"],
    mq: "curated", lvl: "N5", tier: "jlpt", pos: ["v"], t: "v", kd: [], src: "test", sid: "1",
    ex: [],
  }];
  const kanji: Kanji[] = [{
    k: "食", lvl: "N5", lvlSrc: "jlpt", s: 9, g: null, f: null, en: ["eat"], mn: ["идэх"],
    mq: "curated", on: ["ショク"], kun: ["た.べる"], rad: null, w: [], mn_mem: null, src: "test", sid: "2",
  }];

  it("picks due and weak cards only", () => {
    const rows = exportRows(valid, vocab, kanji, NOW);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("w1");   // due + lapse-тай (сул)
    expect(ids).not.toContain("w2"); // ирээдүйн due, сул биш
  });

  it("isWeak flags lapses, relearning and repeated failures", () => {
    expect(isWeak({ l: 1, ph: "review", n: 4, h: [2, 2] })).toBe(true);
    expect(isWeak({ l: 0, ph: "relearn", n: 4, h: [0] })).toBe(true);
    expect(isWeak({ l: 0, ph: "review", n: 5, h: [0, 1, 1] })).toBe(true);
    expect(isWeak({ l: 0, ph: "review", n: 5, h: [3, 3, 3] })).toBe(false);
  });

  it("front/back carry the word and meaning, tags carry level and type", () => {
    const row = exportRows(valid, vocab, kanji, NOW).find((r) => r.id === "w1");
    expect(row?.front).toBe("食べる（たべる）");
    expect(row?.back).toBe("идэх");
    expect(row?.tags).toEqual(expect.arrayContaining(["N5", "vocab", "due", "weak"]));
  });

  it("escapes commas, quotes and newlines per RFC-style CSV", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("writes a BOM, a header and one line per row", () => {
    const csv = ankiCsv(valid, vocab, kanji, NOW);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("front,back,tags");
    expect(lines.length).toBe(2);
    // хоосон бол зөвхөн header
    const empty = ankiCsv(docWith({ srs: {} }), vocab, kanji, NOW);
    expect(empty.trim().split("\r\n").length).toBe(1);
  });
});
