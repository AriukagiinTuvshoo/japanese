import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, freshDoc, type Doc, type Mistake } from "./doc";
import { decodeDoc, docsEqual, mergeDocs, readDoc } from "./storage";
import {
  addMistakes, dropAllMistakes, dropMistake, mistakeCounts, mistakeDeleted, mistakeRemaining, resolveMistake,
  setFavorite, setGrammarDone, toggleGrammarDone,
} from "./deletions";

/* ─────────────── Бодит өгөгдлийн жишээ ─────────────── */

const mistake = (over: Partial<Mistake> = {}): Mistake => ({
  id: "q-日", kind: "kanji-read", level: "N5", prompt: "日", answer: "にち", given: "ひ", at: 1_000, count: 1, ...over,
});

const withFavorites = (ids: string[]) => ({ ...freshDoc(), favorites: ids } as Doc);

describe("favorite deletion vs stale snapshot", () => {
  it("does not resurrect a favorite removed in another tab", () => {
    const added = setFavorite(freshDoc(), "日", true, 1_000);
    const stale = added; // tab B-ийн хуучин snapshot
    const removed = setFavorite(added, "日", false, 2_000);

    expect(mergeDocs(removed, stale).favorites).toEqual([]);
    // commutative — дараалал үр дүнг өөрчлөхгүй
    expect(mergeDocs(stale, removed).favorites).toEqual([]);
    // idempotent — дахин merge хийхэд тогтвортой
    const once = mergeDocs(removed, stale);
    expect(mergeDocs(once, stale).favorites).toEqual([]);
    expect(mergeDocs(once, once).favorites).toEqual([]);
  });

  it("keeps an unrelated favorite and a deletion at the same time", () => {
    const doc = setFavorite(setFavorite(freshDoc(), "日", true, 1_000), "月", true, 1_100);
    const removed = setFavorite(doc, "日", false, 2_000);
    const stale = withFavorites(["日"]); // зөвхөн 日-тэй хуучин snapshot
    const merged = mergeDocs(removed, stale);
    expect(merged.favorites).toEqual(["月"]);
  });

  it("keeps a favorite that was re-added after the deletion", () => {
    const removed = setFavorite(setFavorite(freshDoc(), "日", true, 1_000), "日", false, 2_000);
    const readded = setFavorite(removed, "日", true, 3_000);
    expect(mergeDocs(removed, readded).favorites).toEqual(["日"]);
    expect(mergeDocs(readded, removed).favorites).toEqual(["日"]);
  });

  it("does not let an older re-add beat a newer deletion", () => {
    const removed = setFavorite(setFavorite(freshDoc(), "日", true, 3_000), "日", false, 4_000);
    const oldAdd = setFavorite(freshDoc(), "日", true, 1_000); // устгалаас өмнөх нэмэлт
    expect(mergeDocs(removed, oldAdd).favorites).toEqual([]);
  });

  it("is deterministic on equal timestamps (deletion wins)", () => {
    const added = setFavorite(freshDoc(), "日", true, 5_000);
    const removed = setFavorite(added, "日", false, 5_000);
    const a = mergeDocs(removed, added).favorites;
    const b = mergeDocs(added, removed).favorites;
    expect(a).toEqual([]);
    expect(b).toEqual(a);
  });

  it("keeps legacy favorites that have no tombstone", () => {
    const legacy = withFavorites(["日", "月"]);
    expect(mergeDocs(legacy, freshDoc()).favorites).toEqual(["日", "月"]);
  });
});

describe("grammar deletion vs stale snapshot", () => {
  it("does not resurrect a grammar item marked undone in another tab", () => {
    const done = setGrammarDone(freshDoc(), "g-1", true, 1_000);
    const undone = setGrammarDone(done, "g-1", false, 2_000);
    expect(mergeDocs(undone, done).grammarDone).toEqual([]);
    expect(mergeDocs(done, undone).grammarDone).toEqual([]);
  });

  it("keeps a grammar item completed again later", () => {
    const undone = setGrammarDone(setGrammarDone(freshDoc(), "g-1", true, 1_000), "g-1", false, 2_000);
    const again = setGrammarDone(undone, "g-1", true, 2_500);
    expect(mergeDocs(undone, again).grammarDone).toEqual(["g-1"]);
  });
});

describe("grammar completion XP", () => {
  it("awards only on the first completion", () => {
    const first = toggleGrammarDone(freshDoc(), "g-1", true, 1_000);
    expect(first.awarded).toBe(true);
    expect(first.doc.grammarDone).toEqual(["g-1"]);
  });

  it("does not award again after toggle off and on", () => {
    const first = toggleGrammarDone(freshDoc(), "g-1", true, 1_000);
    const off = toggleGrammarDone(first.doc, "g-1", false, 2_000);
    expect(off.awarded).toBe(false);
    expect(off.doc.grammarDone).toEqual([]);
    expect(off.doc.deleted).toEqual({ "g:g-1": 2_000 });

    const again = toggleGrammarDone(off.doc, "g-1", true, 3_000);
    expect(again.awarded).toBe(false);
    expect(again.doc.grammarDone).toEqual(["g-1"]);
  });

  it("does not award again after reload", () => {
    const first = toggleGrammarDone(freshDoc(), "g-1", true, 1_000);
    const decoded = decodeDoc(JSON.stringify(first.doc));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(toggleGrammarDone(decoded.doc, "g-1", true).awarded).toBe(false);
  });

  it("keeps completion and XP stable across a stale merge", () => {
    const first = toggleGrammarDone(freshDoc(), "g-1", true, 1_000);
    const done: Doc = { ...first.doc, xp: 12 };
    const stale: Doc = { ...freshDoc(), xp: 0 };
    expect(mergeDocs(done, stale).grammarDone).toEqual(["g-1"]);
    expect(mergeDocs(done, stale).xp).toBe(12);
    expect(mergeDocs(stale, done).xp).toBe(12);
  });
});

describe("mistake counts", () => {
  it("keeps records and remaining reviews distinct", () => {
    expect(mistakeCounts([mistake({ count: 5, resolved: 1 })])).toEqual({ records: 1, remaining: 4 });
  });

  it("updates remaining after a resolve and reaches zero after clear", () => {
    const doc: Doc = { ...freshDoc(), mistakes: [mistake({ count: 3 })] };
    const resolved = resolveMistake(doc, "q-日", 2_000);
    expect(mistakeCounts(resolved.mistakes)).toEqual({ records: 1, remaining: 2 });
    const cleared = dropAllMistakes(doc, 3_000);
    expect(mistakeCounts(cleared.mistakes)).toEqual({ records: 0, remaining: 0 });
  });

  it("does not inflate on a stale merge", () => {
    const newer: Doc = { ...freshDoc(), mistakes: [mistake({ count: 5, resolved: 2, at: 3_000 })] };
    const stale: Doc = { ...freshDoc(), mistakes: [mistake({ count: 3, at: 1_000 })] };
    expect(mistakeCounts(mergeDocs(newer, stale).mistakes)).toEqual({ records: 1, remaining: 3 });
    expect(mistakeCounts(mergeDocs(stale, newer).mistakes)).toEqual({ records: 1, remaining: 3 });
  });
});

describe("mistake deletion vs stale snapshot", () => {
  it("drops a mistake that was resolved in another tab", () => {
    const stale: Doc = { ...freshDoc(), mistakes: [mistake()] };
    const resolved = dropMistake(stale, "q-日", 2_000);
    expect(mergeDocs(resolved, stale).mistakes).toEqual([]);
    expect(mergeDocs(stale, resolved).mistakes).toEqual([]);
  });

  it("clears every mistake with tombstones so none come back", () => {
    const doc: Doc = {
      ...freshDoc(),
      mistakes: [mistake({ id: "a", at: 1_000 }), mistake({ id: "b", at: 1_200 })],
    };
    const cleared = dropAllMistakes(doc, 2_000);
    expect(mergeDocs(cleared, doc).mistakes).toEqual([]);
    expect(cleared.deleted).toEqual({ "m:a": 2_000, "m:b": 2_000 });
  });

  it("keeps a mistake that happened again after it was resolved", () => {
    const cleared = dropAllMistakes({ ...freshDoc(), mistakes: [mistake()] } as Doc, 2_000);
    const readded: Doc = { ...cleared, mistakes: [mistake({ at: 3_000, count: 2 })] };
    expect(mergeDocs(cleared, readded).mistakes).toEqual([mistake({ at: 3_000, count: 2 })]);
  });

  it("keeps legacy mistakes without a tombstone and merges their counts", () => {
    const a: Doc = { ...freshDoc(), mistakes: [mistake({ count: 1 })] };
    const b: Doc = { ...freshDoc(), mistakes: [mistake({ count: 3 })] };
    const merged = mergeDocs(a, b);
    expect(merged.mistakes).toHaveLength(1);
    expect(merged.mistakes[0].count).toBe(3);
    expect(mistakeDeleted(merged.mistakes[0], merged.deleted)).toBe(false);
  });
});

describe("simultaneous updates and merge properties", () => {
  it("keeps both tabs' independent changes", () => {
    const a = setFavorite(freshDoc(), "日", true, 1_000);
    const b = setFavorite(freshDoc(), "月", true, 1_200);
    const merged = mergeDocs(a, b);
    expect(merged.favorites.sort()).toEqual(["月", "日"].sort());
  });

  it("merges tombstones commutatively with max timestamps", () => {
    const a = setFavorite(setFavorite(freshDoc(), "日", true, 1_000), "日", false, 2_000);
    const b = setGrammarDone(freshDoc(), "g-1", true, 1_500);
    const ab = mergeDocs(a, b);
    const ba = mergeDocs(b, a);
    expect(ab.deleted).toEqual(ba.deleted);
    expect(ab.favorites).toEqual(ba.favorites);
    expect(ab.grammarDone).toEqual(ba.grammarDone);
    expect(ab.marked).toEqual(ba.marked);
  });

  it("survives encode → decode → merge (tombstones persist)", () => {
    const removed = setFavorite(setFavorite(freshDoc(), "日", true, 1_000), "日", false, 2_000);
    const decoded = decodeDoc(JSON.stringify(removed));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.doc.deleted).toEqual({ "f:日": 2_000 });
    const stale = setFavorite(freshDoc(), "日", true, 1_000);
    expect(mergeDocs(decoded.doc, stale).favorites).toEqual([]);
  });

  it("compares docs regardless of key order", () => {
    const a = setFavorite(freshDoc(), "日", true, 1_000);
    const b = JSON.parse(JSON.stringify(a)) as Doc;
    expect(docsEqual(a, b)).toBe(true);
    expect(docsEqual(a, { ...b, favorites: [] })).toBe(false);
    expect(docsEqual(a, b)).toBe(true);
  });

  it("keeps old tombstones (no automatic time-based purge)", () => {
    const old = Date.UTC(2016, 0, 1);
    const doc = { ...freshDoc(), deleted: { "f:日": old }, favorites: [] } as Doc;
    const res = decodeDoc(JSON.stringify({ ...doc, v: SCHEMA_VERSION }));
    expect(res.ok && res.doc!.deleted).toEqual({ "f:日": old });
    const stale = setFavorite(freshDoc(), "日", true, old - 1_000);
    expect(mergeDocs(doc, stale).favorites).toEqual([]);
  });
});

describe("schema compatibility", () => {
  it("upgrades a v4 document and keeps its favorites/grammar/mistakes", () => {
    const v4 = {
      ...freshDoc(),
      v: 4,
      favorites: ["日"],
      grammarDone: ["g-1"],
      mistakes: [mistake()],
    } as Doc;
    const res = decodeDoc(JSON.stringify(v4));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromVersion).toBe(4);
    expect(res.migrated).toBe(true);
    expect(res.doc.favorites).toEqual(["日"]);
    expect(res.doc.grammarDone).toEqual(["g-1"]);
    expect(res.doc.mistakes).toHaveLength(1);
    expect(res.doc.deleted).toBeUndefined();
    expect(res.doc.marked).toBeUndefined();
  });

  it("backs up the v4 bytes before upgrading", () => {
    const map = new Map<string, string>();
    const kv = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); },
    };
    const raw = JSON.stringify({ ...freshDoc(), v: 4, favorites: ["日"] });
    map.set("nd:doc:u1", raw);
    const res = readDoc(kv, "u1");
    expect(res.status).toBe("ok");
    expect(res.migrated).toBe(true);
    expect(res.backupKey).toBe("nd:doc:u1:backup:v4");
    expect(kv.getItem("nd:doc:u1:backup:v4")).toBe(raw);
    expect(res.doc?.v).toBe(SCHEMA_VERSION);
    expect(res.doc?.favorites).toEqual(["日"]);
  });

  it("rejects a future document instead of dropping tombstones", () => {
    const res = decodeDoc(JSON.stringify({ ...freshDoc(), v: SCHEMA_VERSION + 1 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("future");
  });

  it("drops malformed tombstone values but keeps valid ones", () => {
    const raw = {
      ...freshDoc(),
      deleted: { "f:日": 123, "f:月": "bad", "": 5, "f:火": -1, "f:水": 0 },
      marked: { "f:日": 99 },
    };
    const res = decodeDoc(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.deleted).toEqual({ "f:日": 123 });
    expect(res.doc.marked).toEqual({ "f:日": 99 });
  });
});

/* ─────────────── Phase 24: mistake count integrity ─────────────── */

const mistakeDoc = (over: Partial<Mistake> = {}): Doc =>
  ({ ...freshDoc(), mistakes: [mistake(over)] } as Doc);

const remainingOf = (d: Doc, id: string): number => {
  const m = d.mistakes.find((x) => x.id === id);
  return m ? mistakeRemaining(m) : 0;
};

describe("mistake count integrity (monotonic resolved)", () => {
  it("does not restore a decremented count from a stale snapshot", () => {
    const stale = mistakeDoc({ count: 5 }); // tab B-ийн хуучин snapshot
    const resolved = resolveMistake(stale, "q-日", 2_000); // tab A: 4 үлдсэн
    expect(remainingOf(resolved, "q-日")).toBe(4);
    expect(resolved.mistakes[0].count).toBe(5); // нийт алдсан буурахгүй
    expect(resolved.mistakes[0].resolved).toBe(1);

    const merged = mergeDocs(resolved, stale);
    expect(remainingOf(merged, "q-日")).toBe(4);
    expect(mergeDocs(stale, resolved).mistakes[0]).toEqual(merged.mistakes[0]);
    expect(mergeDocs(merged, stale).mistakes[0]).toEqual(merged.mistakes[0]);
    expect(mergeDocs(merged, merged).mistakes[0]).toEqual(merged.mistakes[0]);
  });

  it("keeps a resolve and a simultaneous new mistake from another tab", () => {
    const base: Doc = {
      ...freshDoc(),
      mistakes: [mistake({ id: "a", count: 2 }), mistake({ id: "b" })],
    };
    const resolved = resolveMistake(base, "a", 2_000); // a: 1 үлдсэн
    const added: Doc = { ...base, mistakes: [mistake({ id: "c", at: 2_100 }), ...base.mistakes] };
    const merged = mergeDocs(resolved, added);
    expect(merged.mistakes.map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
    expect(remainingOf(merged, "a")).toBe(1);
    expect(remainingOf(merged, "b")).toBe(1);
    expect(remainingOf(merged, "c")).toBe(1);
  });

  it("drops the record only after the last remaining count", () => {
    let doc = mistakeDoc({ count: 3 });
    doc = resolveMistake(doc, "q-日", 2_000);
    doc = resolveMistake(doc, "q-日", 2_100);
    expect(remainingOf(doc, "q-日")).toBe(1);
    doc = resolveMistake(doc, "q-日", 2_200);
    expect(doc.mistakes).toEqual([]);
    expect(doc.deleted?.["m:q-日"]).toBe(2_200);
    expect(mergeDocs(doc, mistakeDoc({ count: 3 })).mistakes).toEqual([]);
  });

  it("ignores a resolve of an already gone record", () => {
    const empty = freshDoc();
    expect(resolveMistake(empty, "missing", 1)).toBe(empty);
    const resolved = resolveMistake(mistakeDoc(), "q-日", 2_000);
    expect(resolveMistake(resolved, "q-日", 2_100)).toBe(resolved);
  });

  it("shows the mistake again after a new wrong answer", () => {
    let doc = mistakeDoc();
    doc = resolveMistake(doc, "q-日", 2_000);
    const again: Doc = { ...doc, mistakes: [mistake({ at: 3_000 })] };
    const merged = mergeDocs(doc, again);
    expect(merged.mistakes).toHaveLength(1);
    expect(remainingOf(merged, "q-日")).toBe(1);
  });

  it("keeps the resolve counter when the same mistake happens again", () => {
    const entry = { id: "q-日", kind: "kanji-read", level: "N5" as const, prompt: "日", answer: "にち", given: "ひ" };
    let doc = freshDoc();
    for (let i = 1; i <= 4; i++) doc = addMistakes(doc, [entry], 1_000 * i);
    expect(remainingOf(doc, "q-日")).toBe(4);

    const resolved = resolveMistake(doc, "q-日", 5_000); // 3 үлдсэн
    const added = addMistakes(resolved, [entry], 6_000); // дахин алдсан
    expect(added.mistakes[0].count).toBe(5);
    expect(added.mistakes[0].resolved).toBe(1);
    expect(remainingOf(added, "q-日")).toBe(4);

    const merged = mergeDocs(resolved, added);
    expect(merged.mistakes[0].count).toBe(5);
    expect(merged.mistakes[0].resolved).toBe(1);
    expect(remainingOf(merged, "q-日")).toBe(4);
    expect(mergeDocs(added, resolved).mistakes[0]).toEqual(merged.mistakes[0]);
  });

  it("is deterministic on equal timestamps", () => {
    const a: Doc = { ...mistakeDoc(), mistakes: [mistake({ count: 4, at: 5_000, resolved: 1 })] };
    const b: Doc = { ...mistakeDoc(), mistakes: [mistake({ count: 4, at: 5_000 })] };
    expect(mergeDocs(a, b).mistakes).toEqual(mergeDocs(b, a).mistakes);
    expect(remainingOf(mergeDocs(b, a), "q-日")).toBe(3);
  });

  it("decodes legacy mistakes without a resolved counter", () => {
    const res = decodeDoc(JSON.stringify({ ...mistakeDoc({ count: 4 }), v: 5 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromVersion).toBe(5);
    expect(res.migrated).toBe(true);
    expect(res.doc.mistakes[0].resolved).toBeUndefined();
    expect(mistakeRemaining(res.doc.mistakes[0])).toBe(4);
  });

  it("clamps an impossible resolved counter on decode", () => {
    const raw = { ...mistakeDoc({ count: 2 }), v: SCHEMA_VERSION };
    raw.mistakes[0].resolved = 99;
    const res = decodeDoc(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.mistakes[0].resolved).toBe(2);
  });
});

/* ─────────────── Phase 24: tombstone cleanup safety ─────────────── */

describe("tombstone cleanup safety", () => {
  const bulk = (n: number): Record<string, number> => {
    const map: Record<string, number> = {};
    for (let i = 0; i < n; i++) map[`f:k${String(i).padStart(5, "0")}`] = 1_000 + i;
    return map;
  };

  it("preserves every tombstone beyond the old 20,000 ceiling", () => {
    const deleted = bulk(20_005);
    const res = decodeDoc(JSON.stringify({ ...freshDoc(), v: SCHEMA_VERSION, deleted }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const kept = res.doc.deleted!;
    expect(Object.keys(kept)).toHaveLength(20_005);
    expect(kept["f:k00000"]).toBe(1_000);
    expect(kept["f:k20004"]).toBe(21_004);
  });

  it("blocks resurrection for the oldest tombstone too", () => {
    const deleted = bulk(20_005);
    const res = decodeDoc(JSON.stringify({ ...freshDoc(), v: SCHEMA_VERSION, deleted }));
    if (!res.ok) throw new Error("decode failed");
    const stale: Doc = { ...freshDoc(), favorites: ["k00000"] }; // устгалаас өмнөх snapshot
    expect(mergeDocs(res.doc, stale).favorites).toEqual([]);
    expect(mergeDocs(stale, res.doc).favorites).toEqual([]);
  });

  it("survives a decode → merge → encode round-trip without loss", () => {
    const deleted = bulk(5_000);
    const first = decodeDoc(JSON.stringify({ ...freshDoc(), v: SCHEMA_VERSION, deleted }));
    if (!first.ok) throw new Error("decode failed");
    const merged = mergeDocs(first.doc, { ...freshDoc(), deleted } as Doc);
    const again = decodeDoc(JSON.stringify(merged));
    if (!again.ok) throw new Error("decode failed");
    expect(Object.keys(again.doc.deleted!)).toHaveLength(5_000);
    expect(docsEqual(merged, again.doc)).toBe(true);
  });
});
