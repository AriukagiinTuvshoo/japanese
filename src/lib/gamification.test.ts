import { describe, expect, it } from "vitest";
import { XP } from "./gamification";

/**
 * B5: XP хүснэгтийн засвар.
 * Хуучин утга: reviewEasy (2) < reviewGood (3) — "Easy" хариулт "Good"-оос
 * ИЛҮҮ XP өгөх ёстой байтал бага өгч байв (сэтгэлзүүний ухагдахуунтай зөрчил).
 * Өмнөх XP-ийг дахин тооцохгүй (миграци байхгүй) — зөвхөн цаашид зөв байна.
 */
describe("B5: XP table ordering", () => {
  it("review grades are monotonically more rewarding: Again < Hard < Good < Easy", () => {
    // store.tsx grade() энэ эрэмбээр индекслэдэг: [Again, Hard, Good, Easy][g]
    expect(XP.reviewAgain).toBeLessThan(XP.reviewHard);
    expect(XP.reviewHard).toBeLessThan(XP.reviewGood);
    expect(XP.reviewGood).toBeLessThan(XP.reviewEasy);
  });

  it("every review grade is a positive integer", () => {
    for (const v of [XP.reviewAgain, XP.reviewHard, XP.reviewGood, XP.reviewEasy, XP.newCard]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("no XP action pays zero except the documented wrong-answer quiz", () => {
    expect(XP.quizWrong).toBe(0);
    const paid = [
      XP.newCard, XP.quizCorrect, XP.readingDone, XP.listeningDone,
      XP.grammarDone, XP.writing, XP.examQuestion, XP.examPass, XP.placement, XP.minute,
    ];
    for (const v of paid) expect(v).toBeGreaterThan(0);
  });

  it("passing an exam is worth more than any single question", () => {
    expect(XP.examPass).toBeGreaterThan(XP.examQuestion);
    expect(XP.examPass).toBeGreaterThan(XP.quizCorrect);
  });
});
