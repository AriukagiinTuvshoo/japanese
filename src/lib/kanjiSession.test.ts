import { describe, expect, it } from "vitest";
import { selectKanjiSession } from "./kanjiSession";
import type { Card } from "./srs";
import type { Kanji } from "./types";

const MIN = 60_000;
const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

const kanji = (k: string): Kanji => ({
  k, lvl: "N5", lvlSrc: "jlpt", s: 4, g: 1, f: 100,
  en: [], mn: [], mq: "none", on: [], kun: [], rad: null, w: [], mn_mem: null,
  src: "test", sid: k,
});

const card = (over: Partial<Card> = {}): Card => ({
  due: 0, st: 0, df: 5, n: 0, l: 0, last: 0, ph: "new", streak: 0, h: [],
  ...over,
});

/** Ил тод дараалал — shuffle-ийг тестэд тогтмол болгоно. */
const identity = <T,>(list: T[]): T[] => list;

const items = ["a", "b", "c", "d", "e", "f", "g"].map(kanji);

const srs: Record<string, Card> = {
  a: card({ ph: "review", st: 20, streak: 4, n: 8, due: NOW - DAY }),
  b: card({ ph: "review", st: 12, streak: 2, n: 5, due: NOW - MIN }),
  c: card({ ph: "relearn", st: 0.3, streak: 0, n: 6, l: 1, due: NOW - 2 * DAY }),
  d: card({ ph: "review", st: 40, streak: 6, n: 10, due: NOW + 5 * DAY }),
  e: card({ ph: "review", st: 8, streak: 1, n: 3, due: NOW + DAY }),
};

const ids = (list: Kanji[]) => list.map((k) => k.k);

describe("selectKanjiSession — due cards first, never early reviews", () => {
  it("picks due cards before fresh ones", () => {
    const picked = ids(selectKanjiSession(items, srs, 4, false, { now: NOW, shuffle: identity }));
    expect(picked.slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(picked.slice(3)).toEqual(["f"]);
  });

  it("never schedules a known card that is not due (regression: early Good inflated intervals)", () => {
    const picked = ids(selectKanjiSession(items, srs, 20, false, { now: NOW, shuffle: identity }));
    expect(picked).not.toContain("d");
    expect(picked).not.toContain("e");
    expect(picked.sort()).toEqual(["a", "b", "c", "f", "g"]);
  });

  it("onlyDue returns due cards only — no fresh fill", () => {
    const picked = ids(selectKanjiSession(items, srs, 20, true, { now: NOW, shuffle: identity }));
    expect(picked).toEqual(["a", "b", "c"]);
  });

  it("onlyDue with nothing due returns an empty session instead of fresh cards", () => {
    const picked = selectKanjiSession(items, {}, 15, true, { now: NOW, shuffle: identity });
    expect(picked).toEqual([]);
  });

  it("falls back to fresh cards when the due queue is empty", () => {
    // Цорын ганц мэдэгдэж байгаа карт нь хараахан хугацаа болоогүй.
    const notYetDue: Record<string, Card> = {
      d: card({ ph: "review", st: 40, streak: 6, n: 10, due: NOW + 5 * DAY }),
    };
    const picked = ids(selectKanjiSession(items, notYetDue, 3, false, { now: NOW, shuffle: identity }));
    expect(picked).toEqual(["a", "b", "c"]);
  });

  it("respects the requested count and does not duplicate cards", () => {
    const picked = ids(selectKanjiSession(items, srs, 2, false, { now: NOW, shuffle: identity }));
    expect(picked).toEqual(["a", "b"]);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("a card that has never been graded counts as fresh", () => {
    const untouched: Record<string, Card> = { a: card({ ph: "new" }) };
    const picked = ids(selectKanjiSession(items.slice(0, 3), untouched, 5, false, { now: NOW, shuffle: identity }));
    expect(picked.sort()).toEqual(["a", "b", "c"]);
  });

  it("empty item list yields an empty session", () => {
    expect(selectKanjiSession([], srs, 15, false, { now: NOW, shuffle: identity })).toEqual([]);
  });

  it("is deterministic once the shuffle is fixed", () => {
    const a = ids(selectKanjiSession(items, srs, 5, false, { now: NOW, shuffle: identity }));
    const b = ids(selectKanjiSession(items, srs, 5, false, { now: NOW, shuffle: identity }));
    expect(b).toEqual(a);
  });
});
