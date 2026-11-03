import { describe, expect, it } from "vitest";
import { matchesExplorerState } from "./explorer";
import { memoryStats, type Card } from "./srs";

const card = (over: Partial<Card> = {}): Card => ({
  due: 0, st: 0, df: 5, n: 0, l: 0, last: 0, ph: "new", streak: 0, h: [],
  ...over,
});

/**
 * Нэг л SRS төлөв. «mastered» нь st≥21 БА streak≥3 — зөвхөн st≥21 биш.
 * `nearMaster` нь яг аудитад илэрсэн зөрчлийн жишээ (st=25, streak=1).
 */
const srs: Record<string, Card> = {
  mastered: card({ ph: "review", st: 25, streak: 3, n: 6 }),
  nearMaster: card({ ph: "review", st: 25, streak: 1, n: 6 }),
  review: card({ ph: "review", st: 12, streak: 2, n: 4 }),
  learning: card({ ph: "learning", st: 0.6, streak: 0, n: 1 }),
  relearn: card({ ph: "relearn", st: 0.2, streak: 0, n: 3, l: 1 }),
  fresh: card({ ph: "new" }),
};
const favorites = ["nearMaster", "fresh", "unknown-id"];

describe("matchesExplorerState — Vocabulary and Kanji share one state source", () => {
  it("'all' matches everything, including ids without a card", () => {
    for (const id of [...Object.keys(srs), "unknown-id"]) {
      expect(matchesExplorerState(id, srs, favorites, "all")).toBe(true);
    }
  });

  it("'new' only matches unseen or untouched cards", () => {
    expect(matchesExplorerState("unknown-id", srs, favorites, "new")).toBe(true);
    expect(matchesExplorerState("fresh", srs, favorites, "new")).toBe(true);
    expect(matchesExplorerState("learning", srs, favorites, "new")).toBe(false);
    expect(matchesExplorerState("mastered", srs, favorites, "new")).toBe(false);
  });

  it("'learning' covers both learning and relearning", () => {
    expect(matchesExplorerState("learning", srs, favorites, "learning")).toBe(true);
    expect(matchesExplorerState("relearn", srs, favorites, "learning")).toBe(true);
    expect(matchesExplorerState("review", srs, favorites, "learning")).toBe(false);
    expect(matchesExplorerState("mastered", srs, favorites, "learning")).toBe(false);
  });

  it("'review' excludes mastered cards (regression: review used to include them)", () => {
    expect(matchesExplorerState("review", srs, favorites, "review")).toBe(true);
    expect(matchesExplorerState("nearMaster", srs, favorites, "review")).toBe(true);
    expect(matchesExplorerState("mastered", srs, favorites, "review")).toBe(false);
    expect(matchesExplorerState("learning", srs, favorites, "review")).toBe(false);
  });

  it("'mastered' requires stability AND streak, never stability alone", () => {
    expect(matchesExplorerState("mastered", srs, favorites, "mastered")).toBe(true);
    // st=25 but streak=1 — the audit's exact inconsistency case.
    expect(matchesExplorerState("nearMaster", srs, favorites, "mastered")).toBe(false);
    expect(matchesExplorerState("review", srs, favorites, "mastered")).toBe(false);
    expect(matchesExplorerState("unknown-id", srs, favorites, "mastered")).toBe(false);
  });

  it("'fav' follows the favorites list regardless of SRS stage", () => {
    expect(matchesExplorerState("nearMaster", srs, favorites, "fav")).toBe(true);
    expect(matchesExplorerState("fresh", srs, favorites, "fav")).toBe(true);
    expect(matchesExplorerState("unknown-id", srs, favorites, "fav")).toBe(true);
    expect(matchesExplorerState("mastered", srs, favorites, "fav")).toBe(false);
  });

  it("the filtered mastered count equals memoryStats.mastered", () => {
    const ids = [...Object.keys(srs), "unknown-id"];
    const filtered = ids.filter((id) => matchesExplorerState(id, srs, favorites, "mastered"));
    expect(filtered).toEqual(["mastered"]);
    expect(filtered.length).toBe(memoryStats(srs).mastered);
  });

  it("new + learning + review + mastered partitions every card exactly once", () => {
    const ids = Object.keys(srs);
    const buckets = (["new", "learning", "review", "mastered"] as const)
      .map((state) => ids.filter((id) => matchesExplorerState(id, srs, favorites, state)));
    expect(buckets.flat().sort()).toEqual([...ids].sort());
    expect(new Set(buckets.flat()).size).toBe(ids.length);
  });
});
