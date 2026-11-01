import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, SCHEMA_VERSION, freshDoc, type Doc } from "./doc";
import { applyGrade, binaryToGrade, makeOnce, reviewXP } from "./flashcard";
import { XP } from "./gamification";
import { schedule, type Card } from "./srs";
import { backupKeyOf, decodeDoc, docKeyOf, readDoc, type KV } from "./storage";

const MIN = 60_000;
const DAY = 86_400_000;
const NOW = Date.now();
const UID = "local";

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

const matureCard = (over: Partial<Card> = {}): Card => ({
  due: NOW - DAY,
  st: 21,
  df: 5,
  n: 10,
  l: 0,
  last: NOW - 21 * DAY,
  ph: "review",
  streak: 4,
  h: [2, 2, 2],
  ...over,
});

const cardFrom = (doc: Doc, id: string) => doc.srs[id];

/** v4 баримт — флашкартын тохиргоо хараахан байхгүй хувилбар. */
function legacyV4(): Record<string, unknown> {
  const doc = freshDoc();
  const { session: _drop, ...profile } = doc.profile;
  return {
    ...doc,
    v: 4,
    profile: { ...profile, name: "Төвшин", onboarded: true },
    srs: { "日": matureCard() },
    xp: 120,
    activity: { "2026-10-31": { xp: 30, min: 12, newCards: 3, reviews: 9, correct: 7, total: 9 } },
    mistakes: [
      { id: "q1", kind: "kanji-read", level: "N4", prompt: "日", answer: "にち", given: "ひ", at: NOW, count: 2 },
    ],
  };
}

/* ─────────────── 2 товч → одоогийн SRS ─────────────── */

describe("binary grading maps onto the existing SRS core", () => {
  it("«мэдэхгүй» is Again → 10 minute relearning step", () => {
    const doc = applyGrade(freshDoc(), "日", binaryToGrade("unknown"), { now: NOW });
    const c = cardFrom(doc, "日");
    expect(c.ph).toBe("learning");
    expect(c.due - NOW).toBe(10 * MIN);
    expect(c.l).toBe(0);
  });

  it("«мэднэ» is Good → one day for a new card", () => {
    const doc = applyGrade(freshDoc(), "日", binaryToGrade("know"), { now: NOW });
    const c = cardFrom(doc, "日");
    expect(c.ph).toBe("review");
    expect(c.due - NOW).toBe(DAY);
  });

  it("«мэднэ» on a mature card schedules days ahead", () => {
    const doc = applyGrade(freshDoc(), "日", binaryToGrade("know"), { now: NOW });
    const again = applyGrade(freshDoc(), "日", binaryToGrade("know"), { now: NOW });
    const fresh = cardFrom(doc, "日");
    const second = applyGrade({ ...doc, srs: { ...doc.srs, "日": matureCard() } }, "日", binaryToGrade("know"), { now: NOW });
    expect(cardFrom(second, "日").due - NOW).toBeGreaterThan(DAY);
    expect(cardFrom(again, "日").due).toBe(cardFrom(doc, "日").due);
    expect(fresh.streak).toBe(1);
  });

  it("«мэдэхгүй» on a graduated card lapses it exactly as Again does", () => {
    const start = { ...freshDoc(), srs: { "日": matureCard() } };
    const viaBinary = applyGrade(start, "日", binaryToGrade("unknown"), { now: NOW });
    const viaSrs = { ...start, srs: { "日": schedule(matureCard(), 0, { now: NOW }) } };
    expect(cardFrom(viaBinary, "日")).toEqual(cardFrom(viaSrs, "日"));
    expect(cardFrom(viaBinary, "日").l).toBe(1);
    expect(cardFrom(viaBinary, "日").due - NOW).toBe(10 * MIN);
  });

  it("binary grades are byte-identical to the SRS grades they map to", () => {
    const start = freshDoc();
    for (const answer of ["know", "unknown"] as const) {
      const g = binaryToGrade(answer);
      const binary = applyGrade(start, "v1", g, { now: NOW });
      const reference = { ...start, srs: { v1: schedule(undefined, g, { now: NOW }) }, xp: reviewXP(g) };
      expect(cardFrom(binary, "v1")).toEqual(cardFrom(reference, "v1"));
      expect(binary.xp).toBe(reference.xp);
    }
  });
});

/* ─────────────── Нэг карт — нэг бүртгэл ─────────────── */

describe("one grade per card", () => {
  it("submitting the same card twice records SRS and XP only once", () => {
    const once = makeOnce();
    let doc = freshDoc();
    for (let i = 0; i < 3; i++) {
      if (once("日")) doc = applyGrade(doc, "日", 2, { now: NOW });
    }
    const day = Object.values(doc.activity)[0];
    expect(doc.xp).toBe(XP.reviewGood);
    expect(cardFrom(doc, "日").n).toBe(1);
    expect(day.reviews).toBe(1);
    expect(day.correct).toBe(1);
    expect(day.total).toBe(1);
  });

  it("advances to the next card after a fresh guard key", () => {
    const once = makeOnce();
    expect(once("日")).toBe(true);
    expect(once("日")).toBe(false);
    expect(once("本")).toBe(true);
  });

  it("new-card bonus is granted once, on the first grade only", () => {
    const once = makeOnce();
    let doc = freshDoc();
    if (once("日")) doc = applyGrade(doc, "日", 2, { isNew: true, now: NOW });
    if (once("日")) doc = applyGrade(doc, "日", 2, { isNew: true, now: NOW });
    expect(doc.xp).toBe(XP.reviewGood + XP.newCard);
    expect(Object.values(doc.activity)[0].newCards).toBe(1);
  });
});

/* ─────────────── Ханз ба үг — нэг цөм ─────────────── */

describe("kanji and vocabulary share one SRS core", () => {
  it("both ids land in doc.srs with the same card shape", () => {
    let doc = freshDoc();
    doc = applyGrade(doc, "日", binaryToGrade("know"), { now: NOW });      // ханз
    doc = applyGrade(doc, "v-1234", binaryToGrade("unknown"), { now: NOW }); // үг
    const kanji = cardFrom(doc, "日");
    const vocab = cardFrom(doc, "v-1234");
    expect(Object.keys(kanji).sort()).toEqual(Object.keys(vocab).sort());
    expect(kanji.ph).toBe("review");
    expect(vocab.ph).toBe("learning");
    expect(doc.xp).toBe(XP.reviewGood + XP.reviewAgain);
    expect(Object.values(doc.activity)[0].reviews).toBe(2);
  });

  it("binary grading applies to both kinds", () => {
    const doc = applyGrade(freshDoc(), "水", binaryToGrade("unknown"), { now: NOW });
    expect(cardFrom(doc, "水").due - NOW).toBe(10 * MIN);
  });
});

/* ─────────────── Тохиргоо хадгалах ─────────────── */

describe("session preferences persist", () => {
  it("round-trips through storage after a reload", () => {
    const doc = freshDoc();
    doc.profile.session = { grading: "binary", direction: "mn-jp", count: 40, onlyDue: true };
    const res = decodeDoc(JSON.stringify(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.profile.session).toEqual({ grading: "binary", direction: "mn-jp", count: 40, onlyDue: true });
  });

  it("falls back to defaults for missing or invalid values", () => {
    const raw = { ...freshDoc(), profile: { ...DEFAULT_PROFILE, session: { grading: "weird", count: 999, onlyDue: "yes" } } };
    const res = decodeDoc(JSON.stringify(raw));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.doc.profile.session).toEqual({ ...DEFAULT_PROFILE.session, count: 80 });
  });
});

/* ─────────────── Хуучин өгөгдлийн нийцтэй байдал ─────────────── */

describe("v4 documents keep every existing progress field", () => {
  it("loads without a migration and fills the new session default", () => {
    const res = decodeDoc(JSON.stringify(legacyV4()));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromVersion).toBe(4);
    expect(res.migrated).toBe(false);
    expect(res.doc.v).toBe(SCHEMA_VERSION);
    expect(res.doc.profile.session).toEqual(DEFAULT_PROFILE.session);
    expect(res.doc.profile.name).toBe("Төвшин");
    expect(res.doc.srs["日"]).toEqual(matureCard());
    expect(res.doc.xp).toBe(120);
    expect(res.doc.activity["2026-10-31"]).toEqual({ xp: 30, min: 12, newCards: 3, reviews: 9, correct: 7, total: 9 });
    expect(res.doc.mistakes).toEqual([
      { id: "q1", kind: "kanji-read", level: "N4", prompt: "日", answer: "にち", given: "ひ", at: NOW, count: 2 },
    ]);
  });

  it("is idempotent: decoding the result again changes nothing", () => {
    const once = decodeDoc(JSON.stringify(legacyV4()));
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = decodeDoc(JSON.stringify(once.doc));
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.migrated).toBe(false);
    expect(twice.doc).toEqual(once.doc);
  });

  it("backs up the original bytes before an older document is upgraded", () => {
    const kv = new MemoryKV();
    const legacy = JSON.stringify({ ...legacyV4(), v: 3 });
    kv.setItem(docKeyOf(UID), legacy);
    const res = readDoc(kv, UID);
    expect(res.status).toBe("ok");
    expect(res.migrated).toBe(true);
    expect(res.backupKey).toBe(backupKeyOf(UID, "v3"));
    expect(kv.getItem(res.backupKey!)).toBe(legacy);
    if (!res.doc) return;
    expect(res.doc.srs["日"]).toEqual(matureCard());
    expect(res.doc.xp).toBe(120);
    expect(res.doc.mistakes).toHaveLength(1);
  });
});
