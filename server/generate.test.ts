import { describe, expect, it, vi } from "vitest";
import { buildPrompt, generateAiExam, type RawGenerator } from "./generate";
import type { AiRequest } from "../src/lib/aiExam";

const req: AiRequest = { level: "N2", section: "vocabulary", count: 2 };

function q(n: number, over: Record<string, unknown> = {}) {
  return {
    level: "N2",
    section: "vocabulary",
    questionType: "reading",
    question: `第${n}問：彼は毎日（　）を続けている。`,
    passage: null,
    options: [
      { id: "A", text: `練習${n}` },
      { id: "B", text: `訓練${n}` },
      { id: "C", text: `運動${n}` },
      { id: "D", text: `活動${n}` },
    ],
    correctAnswer: "A",
    explanationMn: `「練習${n}」がこの文脈で最も自然です。`,
    explanationJa: "自然な表現です。",
    vocabulary: [],
    grammarPoints: [],
    ...over,
  };
}

const fake = (responses: string[]): RawGenerator & { calls: number } => {
  let i = 0;
  const fn = vi.fn(async () => responses[Math.min(i++, responses.length - 1)]);
  return Object.assign(fn as unknown as RawGenerator, { get calls() { return i; } });
};

describe("buildPrompt", () => {
  it("states the level, section, count and JSON requirement", () => {
    const p = buildPrompt({ ...req, count: 5 });
    expect(p).toContain("level N2");
    expect(p).toContain("Write 5 original Japanese practice questions");
    expect(p).toContain("vocabulary");
    expect(p).toContain("JSON only");
  });

  it("tells the model these are not official JLPT questions", () => {
    expect(buildPrompt(req)).toContain("NOT official JLPT questions");
  });

  it("includes the avoid list when provided", () => {
    const p = buildPrompt({ ...req, avoid: ["質問A"] });
    expect(p).toContain("質問A");
    expect(p).toContain("Do NOT repeat");
  });
});

describe("generateAiExam", () => {
  it("fails safely without an API key and never calls a generator", async () => {
    const gen = fake([JSON.stringify({ questions: [] })]);
    const out = await generateAiExam(req, { generate: undefined, apiKey: undefined, model: "m" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(503);
      expect(out.code).toBe("no_key");
      expect(out.message).not.toMatch(/AIza/);
    }
    expect((gen as unknown as { calls: number }).calls).toBe(0);
  });

  it("returns validated questions from a valid response", async () => {
    const gen = fake([JSON.stringify({ questions: [q(1), q(2)] })]);
    const out = await generateAiExam(req, { generate: gen, apiKey: "test" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.questions).toHaveLength(2);
      expect(out.attempts).toBe(1);
      expect(out.model).toBe("gemini-3.8-flash");
      expect(out.questions.every((x) => x.sourceType === "ai_generated")).toBe(true);
    }
  });

  it("fails with invalid_output when the model returns prose instead of JSON", async () => {
    const out = await generateAiExam(req, { generate: fake(["Sorry, I cannot help."]), apiKey: "test" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("invalid_output");
      expect(out.status).toBe(502);
    }
  });

  it("retries once and merges valid questions without duplicates", async () => {
    const gen = fake([
      JSON.stringify({ questions: [q(1), q(1)] }),
      JSON.stringify({ questions: [q(1), q(2)] }),
    ]);
    const out = await generateAiExam(req, { generate: gen, apiKey: "test", attempts: 2 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.attempts).toBe(2);
      expect(out.questions).toHaveLength(2);
      expect(new Set(out.questions.map((x) => x.question)).size).toBe(2);
    }
  });

  it("reports rejected questions but still returns the valid ones", async () => {
    const gen = fake([JSON.stringify({ questions: [q(1), q(2, { correctAnswer: "Z" })] })]);
    const out = await generateAiExam(req, { generate: gen, apiKey: "test", attempts: 1 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.questions).toHaveLength(1);
      expect(out.rejected).toBe(1);
    }
  });

  it("never returns questions whose declared level was ignored", async () => {
    const gen = fake([JSON.stringify({ questions: [q(1, { level: "N5" })] })]);
    const out = await generateAiExam(req, { generate: gen, apiKey: "test", attempts: 1 });
    expect(out.ok).toBe(false);
  });

  it("maps upstream failures to a safe 502 and hides secrets", async () => {
    const gen = vi.fn(async () => {
      throw new Error("API error: key=AIzaSECRET1234567890 rejected");
    }) as unknown as RawGenerator;
    const out = await generateAiExam(req, { generate: gen, apiKey: "test" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(502);
      expect(out.code).toBe("upstream");
      expect(out.message).not.toContain("AIzaSECRET");
    }
  });

  it("caps the returned questions at the requested count", async () => {
    const gen = fake([JSON.stringify({ questions: [q(1), q(2), q(3), q(4)] })]);
    const out = await generateAiExam({ ...req, count: 2 }, { generate: gen, apiKey: "test" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.questions).toHaveLength(2);
  });
});
