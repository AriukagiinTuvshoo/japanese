import { describe, expect, it } from "vitest";
import {
  AI_LIMITS,
  aiToQuestion,
  extractJson,
  normText,
  normalizeAiRequest,
  validateAiBatch,
  validateQuestion,
  type AiQuestion,
} from "./aiExam";

const expected = { level: "N2", section: "vocabulary" } as const;

function good(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    level: "N2",
    section: "vocabulary",
    questionType: "reading",
    question: "次の文の（　）に入れるのに最もよいものを一つ選びなさい。彼は毎日（　）を続けている。",
    passage: null,
    options: [
      { id: "A", text: "練習" },
      { id: "B", text: "訓練" },
      { id: "C", text: "運動" },
      { id: "D", text: "活動" },
    ],
    correctAnswer: "A",
    explanationMn: "「練習」は上手になるために繰り返し行うこと。文脈では「練習を続ける」が自然です。",
    explanationJa: "「練習」は上達のために繰り返すこと。",
    vocabulary: ["練習"],
    grammarPoints: [],
    sourceType: "official_jlpt",
    qualityStatus: "validated",
    ...over,
  };
}

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips a markdown fence", () => {
    expect(extractJson('```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] });
  });

  it("finds an object inside surrounding prose", () => {
    expect(extractJson('Here you go: {"questions":[]} — done')).toEqual({ questions: [] });
  });

  it("returns null for malformed output instead of throwing", () => {
    expect(extractJson("not json at all")).toBeNull();
    expect(extractJson('{"a": }')).toBeNull();
  });
});

describe("normText", () => {
  it("collapses whitespace and normalises width", () => {
    expect(normText("  Ａ  B\u200B ")).toBe("A B");
  });
});

describe("validateQuestion", () => {
  it("accepts a well-formed N2 vocabulary question as validated", () => {
    const r = validateQuestion(good(), expected);
    expect(r.ok).toBe(true);
    expect(r.accepted?.question.qualityStatus).toBe("validated");
    expect(r.accepted?.question.options).toHaveLength(4);
  });

  it("never lets AI claim official JLPT provenance", () => {
    const r = validateQuestion(good(), expected);
    expect(r.accepted?.question.sourceType).toBe("ai_generated");
  });

  it("rejects a question for the wrong level", () => {
    const r = validateQuestion(good({ level: "N5" }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("level_mismatch");
  });

  it("rejects a question from the wrong section", () => {
    const r = validateQuestion(good({ section: "grammar" }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("section_mismatch");
  });

  it("rejects a question with three options", () => {
    const r = validateQuestion(good({ options: [{ id: "A", text: "練習" }, { id: "B", text: "訓練" }, { id: "C", text: "運動" }] }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("option_count");
  });

  it("rejects duplicate option texts", () => {
    const r = validateQuestion(good({
      options: [{ id: "A", text: "練習" }, { id: "B", text: "練習" }, { id: "C", text: "運動" }, { id: "D", text: "活動" }],
    }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("duplicate_options");
  });

  it("rejects when the correct answer is not among the options", () => {
    const r = validateQuestion(good({ correctAnswer: "Z" }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("answer_not_in_options");
  });

  it("rejects an empty question", () => {
    expect(validateQuestion(good({ question: "  " }), expected).ok).toBe(false);
  });

  it("rejects non-Japanese content", () => {
    const r = validateQuestion(good({ question: "Which word fits the blank best?", passage: null }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("not_japanese");
  });

  it("accepts Japanese supplied only by the passage (reading questions)", () => {
    const r = validateQuestion(good({
      question: "この文章の内容と合っているものを選びなさい。",
      passage: "田中さんは毎朝六時に起きて、近くの公園を散歩する。",
    }), { level: "N2", section: "vocabulary" });
    expect(r.ok).toBe(true);
  });

  it("rejects a missing explanation", () => {
    const r = validateQuestion(good({ explanationMn: "зөв" }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("explanation_missing");
  });

  it("flags an explanation that does not mention the answer for review", () => {
    const r = validateQuestion(good({ explanationMn: "Энэ өгүүлбэрт дээрх дөрвөн үгийн аль нэг нь тохирно гэж бодож байна." }), expected);
    expect(r.ok).toBe(true);
    expect(r.accepted?.question.qualityStatus).toBe("needs_review");
    expect(r.issues.map((i) => i.code)).toContain("explanation_no_answer");
  });

  it("rejects placeholder text", () => {
    const r = validateQuestion(good({ question: "次の（　）に入る語を選べ。TODO" }), expected);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("placeholder");
  });

  it("rejects non-object entries", () => {
    expect(validateQuestion(null, expected).ok).toBe(false);
    expect(validateQuestion("question", expected).ok).toBe(false);
    expect(validateQuestion([], expected).ok).toBe(false);
  });

  it("marks a missing question type for review instead of rejecting", () => {
    const r = validateQuestion(good({ questionType: "" }), expected);
    expect(r.ok).toBe(true);
    expect(r.accepted?.question.qualityStatus).toBe("needs_review");
  });

  it("sanitises vocabulary/grammarPoints arrays", () => {
    const r = validateQuestion(good({ vocabulary: ["練習", 5, null, "  "], grammarPoints: "not-array" }), expected);
    expect(r.accepted?.question.vocabulary).toEqual(["練習"]);
    expect(r.accepted?.question.grammarPoints).toEqual([]);
  });
});

describe("validateAiBatch", () => {
  it("accepts a wrapped list and drops duplicates", () => {
    const r = validateAiBatch({ questions: [good(), good()] }, expected);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0].issues.map((i) => i.code)).toContain("duplicate_question");
  });

  it("keeps good questions when others in the batch are broken", () => {
    const r = validateAiBatch([good(), good({ question: "bad" }), good({ question: "全く別の質問です。これは有効な日本語です。" })], expected);
    expect(r.accepted).toHaveLength(2);
    expect(r.rejected).toHaveLength(1);
  });

  it("reports an empty batch instead of returning success", () => {
    const r = validateAiBatch({ questions: [] }, expected);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].issues[0].code).toBe("empty_batch");
    expect(validateAiBatch("nonsense", expected).accepted).toHaveLength(0);
  });

  it("caps the batch at the requested maximum", () => {
    const many = Array.from({ length: 10 }, (_, i) => good({ question: `第${i + 1}問：彼は毎日（　）を続けている。` }));
    expect(validateAiBatch(many, expected, 3).accepted).toHaveLength(3);
  });
});

describe("aiToQuestion", () => {
  it("maps an accepted AI question into the runner's Question", () => {
    const accepted = validateQuestion(good({ passage: "田中さんは毎朝散歩する。\n\n雨の日は休む。" }), expected).accepted!;
    const q = aiToQuestion(accepted.question as AiQuestion, 2);
    expect(q.options).toHaveLength(4);
    expect(q.options[q.answer]).toBe("練習");
    expect(q.level).toBe("N2");
    expect(q.kind).toBe("ai-vocabulary");
    expect(q.section).toBe("Үгийн сан");
    expect(q.passage).toHaveLength(2);
    expect(q.explain).toContain("練習");
    expect(q.id).toMatch(/^ai-vocabulary-2-/);
  });

  it("produces stable ids for the same question", () => {
    const a = validateQuestion(good(), expected).accepted!;
    const b = validateQuestion(good(), { level: "N2", section: "vocabulary" }).accepted!;
    expect(aiToQuestion(a.question, 0).id).toBe(aiToQuestion(b.question, 0).id);
  });
});

describe("normalizeAiRequest", () => {
  it("clamps the requested count", () => {
    expect(normalizeAiRequest({ level: "n2", section: "vocabulary", count: 999 })?.count).toBe(AI_LIMITS.maxCount);
    expect(normalizeAiRequest({ level: "N2", section: "vocabulary", count: 0 })?.count).toBe(AI_LIMITS.minCount);
  });

  it("rejects unknown levels, sections and non-numeric counts", () => {
    expect(normalizeAiRequest({ level: "N9", section: "vocabulary", count: 5 })).toBeNull();
    expect(normalizeAiRequest({ level: "N2", section: "poetry", count: 5 })).toBeNull();
    expect(normalizeAiRequest({ level: "N2", section: "vocabulary", count: "many" })).toBeNull();
    expect(normalizeAiRequest(null)).toBeNull();
  });

  it("limits the avoid list", () => {
    const avoid = Array.from({ length: 100 }, (_, i) => `q${i}`);
    expect(normalizeAiRequest({ level: "N2", section: "grammar", count: 5, avoid })?.avoid).toHaveLength(AI_LIMITS.maxAvoid);
  });
});
