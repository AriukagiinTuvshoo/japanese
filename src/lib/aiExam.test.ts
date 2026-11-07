import { describe, expect, it } from "vitest";
import {
  AI_LIMITS,
  aiToQuestion,
  extractJson,
  listeningPassage,
  listeningScript,
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

describe("passage requirements", () => {
  const reading = { level: "N2", section: "reading" } as const;
  const listening = { level: "N2", section: "listening" } as const;

  it("rejects a reading question without a passage", () => {
    const r = validateQuestion(good({ section: "reading", question: "この文章の内容と合っているものを選びなさい。", passage: null }), reading);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("passage_missing");
  });

  it("rejects a listening question without a passage", () => {
    const r = validateQuestion(good({ section: "listening", question: "男の人は何をしますか。", passage: "   " }), listening);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("passage_missing");
  });

  it("rejects a passage that is too short to answer from", () => {
    const r = validateQuestion(good({ section: "reading", question: "この文章の内容と合っているものを選びなさい。", passage: "短い。" }), reading);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("passage_short");
  });

  it("accepts a reading question with a real passage and keeps it in the runner", () => {
    const r = validateQuestion(
      good({
        section: "reading",
        question: "この文章の内容と合っているものを選びなさい。",
        passage: "田中さんは毎朝六時に起きて、近くの公園を散歩する。雨の日は家で本を読む。",
      }),
      reading,
    );
    expect(r.ok).toBe(true);
    expect(aiToQuestion(r.accepted!.question).passage).toHaveLength(1);
  });

  it("still accepts vocabulary questions without a passage", () => {
    expect(validateQuestion(good(), expected).ok).toBe(true);
  });
});

const aiq = (over: Partial<AiQuestion> = {}): AiQuestion => ({
  level: "N2",
  section: "listening",
  questionType: "課題理解",
  question: "男の人はこの後まず何をしなければなりませんか。",
  passage: [
    "会社で男の人と女の人が話しています。",
    "男の人はこの後まず何をしなければなりませんか。",
    "男：明日の会議の資料ですが、印刷が終わりました。",
    "女：まず山田さんに電話して確認してくれる?",
  ].join("\n"),
  options: [
    { id: "A", text: "資料を印刷する" },
    { id: "B", text: "山田さんに電話する" },
    { id: "C", text: "会議室を準備する" },
    { id: "D", text: "資料を確認する" },
  ],
  correctAnswer: "B",
  explanationMn: "女性が「まず山田さんに電話して」と指示しているため、Bが正しい。",
  explanationJa: "女性の指示が根拠です。",
  vocabulary: [],
  grammarPoints: [],
  sourceType: "ai_generated",
  qualityStatus: "validated",
  ...over,
});

describe("listeningScript", () => {
  it("removes speaker labels but keeps the sentences", () => {
    const script = listeningScript("男：こんにちは。\n女性: よろしくお願いします。\n女：失礼します。", null);
    expect(script).not.toMatch(/男|女/);
    expect(script).toContain("こんにちは");
    expect(script).toContain("よろしくお願いします");
    expect(script).toContain("失礼します");
  });

  it("is safe for null, undefined and empty input", () => {
    expect(listeningScript(null)).toBe("");
    expect(listeningScript(undefined)).toBe("");
    expect(listeningScript("")).toBe("");
    expect(listeningScript("   \n\n ", "質問")).toBe("");
  });

  it("joins lines without producing a double full stop", () => {
    const script = listeningScript("男：はい。\n女：わかりました。", null);
    expect(script).toBe("はい。わかりました。");
    expect(script).not.toContain("。。");
  });

  it("keeps an exactly duplicated question sentence only once", () => {
    const q = "男の人はこの後まず何をしなければなりませんか。";
    const script = listeningScript(`男：${q}\n女：${q}\n男：すぐ行きます。`, q);
    expect(script.split(q).length - 1).toBe(1);
    expect(script).toContain("すぐ行きます");
  });

  it("does not drop a similar but not identical sentence", () => {
    const q = "男の人はこの後まず何をしなければなりませんか。";
    const similar = "男の人はこの後まず何をしますか。";
    const script = listeningScript(`女：${similar}\n男：はい。`, q);
    expect(script).toContain(similar);
  });
});

describe("listeningPassage (UI display)", () => {
  it("never shows a raw speaker label on screen", () => {
    const lines = listeningPassage("男：こんにちは。\n女: よろしく。\n男性：はい。\n女性：どうぞ。", null);
    const joined = lines.join("\n");
    expect(joined).not.toMatch(/^男[:：]/m);
    expect(joined).not.toMatch(/^女[:：]/m);
    expect(joined).toContain("男性：こんにちは。");
    expect(joined).toContain("女性：よろしく。");
    expect(joined).toContain("男性：はい。");
    expect(joined).toContain("女性：どうぞ。");
  });

  it("keeps the speaker order and every sentence", () => {
    const lines = listeningPassage("女：先に席を取ります。\n男：すぐ行きます。\n女：お願いします。", null);
    expect(lines).toEqual(["女性：先に席を取ります。", "男性：すぐ行きます。", "女性：お願いします。"]);
  });

  it("drops an exact duplicate question sentence and keeps the rest", () => {
    const q = "男の人はこの後まず何をしなければなりませんか。";
    const lines = listeningPassage(`男：${q}\n女：まず山田さんに電話して。`, q);
    expect(lines.join("")).not.toContain(q);
    expect(lines.join("")).toContain("山田さんに電話");
  });

  it("is safe for empty input", () => {
    expect(listeningPassage(null)).toEqual([]);
    expect(listeningPassage(undefined)).toEqual([]);
    expect(listeningPassage(" \n ")).toEqual([]);
  });
});

describe("explanation – answer consistency", () => {
  it("does not flag an explanation that names the correct option", () => {
    const r = validateQuestion(good(), expected);
    expect(r.accepted!.issues.map((i) => i.code)).not.toContain("explanation_no_answer");
    expect(r.accepted!.question.qualityStatus).toBe("validated");
  });

  it("flags an explanation that calls another option correct", () => {
    const r = validateQuestion(good({ explanationMn: "Зөв хариулт нь B. 「訓練」 нь энэ өгүүлбэрт тохирно." }), expected);
    expect(r.ok).toBe(true);
    expect(r.accepted!.issues.map((i) => i.code)).toContain("explanation_wrong_answer");
    expect(r.accepted!.question.qualityStatus).toBe("needs_review");
  });
});

describe("aiToQuestion listening audio", () => {
  it("gives listening questions a TTS script and a cleaned display passage", () => {
    const ai = aiq();
    const q = aiToQuestion(ai);
    expect(typeof q.audio).toBe("string");
    expect(q.audio!.length).toBeGreaterThan(0);
    expect(q.audio).not.toMatch(/^男[:：]/m);
    expect(q.audio).toContain("山田さんに電話");
    /* Дэлгэцэн дээр түүхий шошго, давхардсан асуулт байхгүй. */
    expect(q.passage!.join("\n")).not.toMatch(/^男[:：]/m);
    expect(q.passage!.join("\n")).toContain("男性：");
    expect(q.passage).not.toContain(ai.question);
    expect(ai.passage).toContain("男："); /* эх өгөгдөл хөндөгдөөгүй */
  });

  it("drops an exact duplicate of the question but keeps a similar sentence", () => {
    const q = aiq({ question: "男の人は何をしますか。" });
    q.passage = ["男：男の人は何をしますか。", "女：男の人は何をしますか。", "男：まず電話します。"].join("\n");
    const out = aiToQuestion(q);
    expect((out.passage!.join("").match(/男の人は何をしますか。/g) || []).length).toBe(0);
    expect(out.passage!.join("")).toContain("まず電話します");
  });

  it("keeps reading passages exactly as before", () => {
    const passage = "本文の一行目です。\n二行目です。";
    expect(aiToQuestion(aiq({ section: "reading", passage })).passage).toEqual(passage.split(/\n{2,}|\r?\n/));
  });

  it("adds no audio outside the listening section", () => {
    for (const section of ["vocabulary", "grammar", "reading", "kanji"] as const) {
      expect(aiToQuestion(aiq({ section, passage: section === "reading" ? "短い本文です。" : null })).audio).toBeUndefined();
    }
  });
});

describe("quality labels", () => {
  it("does not call a needs_review question reviewed", () => {
    /* Тайлбар нь зөв хариултыг дурдаагүй → warn → needs_review. */
    const r = validateQuestion(
      good({ explanationMn: "Энэ өгүүлбэрт тохирох үйл үгийг сонгоно уу гэсэн утгатай." }),
      expected,
    );
    expect(r.ok).toBe(true);
    expect(r.accepted!.question.qualityStatus).toBe("needs_review");
    expect(aiToQuestion(r.accepted!.question).promptSub).toContain("хяналт шаардлагатай");
  });

  it("marks a clean question as validated and labelled reviewed", () => {
    const r = validateQuestion(good(), expected);
    expect(r.accepted!.question.qualityStatus).toBe("validated");
    expect(aiToQuestion(r.accepted!.question).promptSub).toContain("хянасан");
  });
});
