import { describe, expect, it } from "vitest";
import { aiToQuestion, type AiQuestion } from "./aiExam";

/**
 * `needs_review` төлөвийн UI гэрээ: passage байгаа эсэхээс үл хамааран
 * `needsReview` флаг үүснэ; `validated` асуултад флаг гарахгүй.
 * (DOM тестийн орчин repo-д байхгүй тул QuizRunner-ийн уншдаг талбарыг шалгана.)
 */

const base: AiQuestion = {
  level: "N2",
  section: "reading",
  questionType: "reading",
  question: "本文の内容と合っているものはどれか。",
  passage: "日本語の文章です。\n二行目です。",
  options: [
    { id: "A", text: "ア" },
    { id: "B", text: "イ" },
    { id: "C", text: "ウ" },
    { id: "D", text: "エ" },
  ],
  correctAnswer: "B",
  explanationMn: "本文では「イ」が述べられています。",
  explanationJa: "本文では「イ」が述べられています。",
  vocabulary: [],
  grammarPoints: [],
  sourceType: "ai_generated",
  qualityStatus: "needs_review",
};

describe("needs_review badge", () => {
  it("shows on a reading question with a passage", () => {
    const q = aiToQuestion({ ...base, section: "reading" });
    expect(q.passage).toBeDefined();
    expect(q.needsReview).toBe(true);
  });

  it("shows on a listening question with a passage and audio", () => {
    const q = aiToQuestion({ ...base, section: "listening", passage: "男性：おはよう。\n女性：おはよう。" });
    expect(q.needsReview).toBe(true);
    expect(q.audio).toBeTruthy();
  });

  it("shows on a question without a passage", () => {
    const q = aiToQuestion({ ...base, section: "vocabulary", passage: null });
    expect(q.needsReview).toBe(true);
    expect(q.promptSub).toContain("хяналт шаардлагатай");
  });

  it("stays hidden for validated questions in every section", () => {
    for (const section of ["vocabulary", "grammar", "reading", "kanji", "listening"] as const) {
      const q = aiToQuestion({ ...base, section, qualityStatus: "validated" });
      expect(q.needsReview).toBeUndefined();
    }
    const plain = aiToQuestion({ ...base, section: "vocabulary", passage: null, qualityStatus: "validated" });
    expect(plain.promptSub).toContain("хянасан");
  });

  it("does not change the answer, options or passage of the quiz flow", () => {
    const q = aiToQuestion({ ...base, section: "reading" });
    expect(q.options).toEqual(["ア", "イ", "ウ", "エ"]);
    expect(q.answer).toBe(1);
    expect(q.passage).toEqual(["日本語の文章です。", "二行目です。"]);
    expect(q.kind).toBe("ai-reading");
  });

  it("does not add the flag to non-AI quiz questions", () => {
    const q = aiToQuestion({ ...base, qualityStatus: "validated" });
    expect("needsReview" in q).toBe(true); /* талбар байгаа ч undefined */
    expect(q.needsReview).toBeUndefined();
  });
});
