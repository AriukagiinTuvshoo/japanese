import { describe, expect, it } from "vitest";
import { freshDoc } from "./doc";
import { XP } from "./gamification";
import { recordWritingResult } from "./writing";
import { todayKey } from "./text";

const NOW = new Date(2026, 10, 7, 10, 0, 0).getTime();
const DAY = 86_400_000;

describe("writing completion XP", () => {
  it("awards completion XP once for the first record of a kanji", () => {
    const doc = recordWritingResult(freshDoc(), "日", 82, NOW);
    expect(doc.xp).toBe(XP.writing);
    expect(doc.writing["日"]).toEqual({ best: 82, tries: 1, at: NOW });
    expect(doc.activity[todayKey(new Date(NOW))].xp).toBe(XP.writing);
  });

  it("does not award XP again when the same kanji is checked repeatedly", () => {
    let doc = recordWritingResult(freshDoc(), "日", 60, NOW);
    doc = recordWritingResult(doc, "日", 75, NOW + 5_000);
    doc = recordWritingResult(doc, "日", 55, NOW + 9_000);
    expect(doc.xp).toBe(XP.writing);
    expect(doc.activity[todayKey(new Date(NOW))].xp).toBe(XP.writing);
    expect(doc.writing["日"]).toMatchObject({ best: 75, tries: 3, at: NOW + 9_000 });
  });

  it("keeps the best score when a later attempt is worse", () => {
    let doc = recordWritingResult(freshDoc(), "月", 95, NOW);
    doc = recordWritingResult(doc, "月", 40, NOW + 1_000);
    expect(doc.writing["月"].best).toBe(95);
  });

  it("counts a repeat on a later day for daily progress but not XP", () => {
    let doc = recordWritingResult(freshDoc(), "火", 80, NOW);
    doc = recordWritingResult(doc, "火", 88, NOW + DAY);
    expect(doc.xp).toBe(XP.writing);
    expect(doc.writing["火"]).toMatchObject({ best: 88, tries: 2, at: NOW + DAY });
    expect(doc.activity[todayKey(new Date(NOW + DAY))]?.xp ?? 0).toBe(0);
  });

  it("awards XP separately for each distinct kanji", () => {
    let doc = recordWritingResult(freshDoc(), "水", 70, NOW);
    doc = recordWritingResult(doc, "木", 70, NOW);
    expect(doc.xp).toBe(XP.writing * 2);
    expect(doc.activity[todayKey(new Date(NOW))].xp).toBe(XP.writing * 2);
  });

  it("preserves unrelated progress fields", () => {
    const base = freshDoc();
    const doc = recordWritingResult(
      { ...base, grammarDone: ["g1"], readingDone: ["r1"], xp: 50 },
      "金",
      90,
      NOW,
    );
    expect(doc.xp).toBe(50 + XP.writing);
    expect(doc.grammarDone).toEqual(["g1"]);
    expect(doc.readingDone).toEqual(["r1"]);
  });
});
