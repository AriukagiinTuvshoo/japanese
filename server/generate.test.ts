import { describe, expect, it, vi } from "vitest";
import {
  GENERATION_CONFIG,
  MAX_ATTEMPTS,
  MAX_OUTPUT_TOKENS,
  UPSTREAM_TIMEOUT_MS,
  buildPrompt,
  classifyUpstream,
  generateAiExam,
  providerText,
  type RawGenerator,
} from "./generate";
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

  it("asks for labelled listening scripts without repeating the question", () => {
    const p = buildPrompt({ ...req, section: "listening" });
    expect(p).toContain("男性：");
    expect(p).toContain("女性：");
    expect(p.toLowerCase()).toContain("do not repeat the question sentence");
  });

  it("requires the explanation to quote the correct option", () => {
    expect(buildPrompt(req)).toContain("quote the exact text of the correct option");
    expect(buildPrompt(req)).toContain("Never call a different option correct");
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
  it("fails safely without an API key", async () => {
    const out = await generateAiExam(req, { generate: undefined, apiKey: "", model: "m" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(503);
      expect(out.code).toBe("no_key");
      expect(out.message).toMatch(/GEMINI_API_KEY/);
      expect(out.message).not.toMatch(/AIza/);
    }
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

  it("reports a parsed batch that failed every check as quality_failed", async () => {
    const gen = fake([
      JSON.stringify({
        questions: [{
          level: "N2", section: "vocabulary", question: "x", passage: null, options: [],
          correctAnswer: "A", explanationMn: "", explanationJa: "", vocabulary: [], grammarPoints: [],
        }],
      }),
    ]);
    const out = await generateAiExam(req, { generate: gen, apiKey: "test", attempts: 1 });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("quality_failed");
      expect(out.status).toBe(502);
      expect(out.message).toMatch(/шалгалтад/);
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

  it("maps unknown upstream failures to a safe 502 and hides secrets", async () => {
    const gen = vi.fn(async () => {
      throw new Error("API error: key=AIzaSECRET1234567890 rejected");
    }) as unknown as RawGenerator;
    const out = await generateAiExam(req, { generate: gen, apiKey: "test" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(502);
      expect(out.code).toBe("upstream");
      expect(out.message).not.toContain("AIzaSECRET");
      expect(out.message).not.toContain("{");
    }
  });

  it("never forwards raw provider JSON to the user", async () => {
    const providerPayload = JSON.stringify({
      error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" },
    });
    const gen = vi.fn(async () => {
      throw new Error(providerPayload);
    }) as unknown as RawGenerator;
    const out = await generateAiExam(req, { generate: gen, apiKey: "test" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("bad_key");
      expect(out.message).not.toContain("INVALID_ARGUMENT");
      expect(out.message).not.toContain("{");
    }
  });

  it("times out a hanging provider with a 504", async () => {
    const gen = (() => new Promise<string>(() => {})) as unknown as RawGenerator;
    const out = await generateAiExam(req, { generate: gen, apiKey: "test", timeoutMs: 25, attempts: 1 });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(504);
      expect(out.code).toBe("timeout");
      expect(out.message).toMatch(/хугацаа/);
    }
  });

  it("reports a safety-blocked generation as blocked, not as an empty batch", async () => {
    const gen = (async () => providerText({ text: "", candidates: [{ finishReason: "SAFETY" }] })) as unknown as RawGenerator;
    const out = await generateAiExam(req, { generate: gen, apiKey: "test", attempts: 1 });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("blocked");
      expect(out.status).toBe(502);
      expect(out.message).toMatch(/блоклолоо/);
    }
  });

  it("uses GEMINI_MODEL from the environment when no model is passed", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-test-override");
    try {
      const out = await generateAiExam(req, { generate: fake([JSON.stringify({ questions: [q(1)] })]), apiKey: "test" });
      expect(out.ok).toBe(true);
      if (out.ok) expect(out.model).toBe("gemini-test-override");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("caps the returned questions at the requested count", async () => {
    const gen = fake([JSON.stringify({ questions: [q(1), q(2), q(3), q(4)] })]);
    const out = await generateAiExam({ ...req, count: 2 }, { generate: gen, apiKey: "test" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.questions).toHaveLength(2);
  });
});

describe("timeout budget", () => {
  it("allows more than the slowest measured 10-question generation (42.0s)", () => {
    expect(UPSTREAM_TIMEOUT_MS).toBeGreaterThanOrEqual(50_000);
  });

  it("stays inside a single serverless request (Vercel default 300s)", () => {
    expect(MAX_ATTEMPTS * UPSTREAM_TIMEOUT_MS).toBeLessThanOrEqual(300_000);
  });
});

describe("generationConfig", () => {
  it("sends both responseMimeType and responseSchema (strict JSON requires both)", () => {
    expect(GENERATION_CONFIG.responseMimeType).toBe("application/json");
    expect(GENERATION_CONFIG.responseSchema).toBeTruthy();
  });

  it("allows enough output tokens for a full 20-question batch", () => {
    /* 8,192 нь 20 уншлагын асуултад хүрэлцдэггүй байсан — албан ёсны дээд хязгаар 32,768. */
    expect(MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(16_384);
    expect(MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(32_768);
  });

  it("sends no sampling parameters that Gemini 3.6+ ignores or rejects", () => {
    const keys = Object.keys(GENERATION_CONFIG);
    for (const k of ["temperature", "topP", "topK", "frequencyPenalty", "presencePenalty"]) {
      expect(keys).not.toContain(k);
    }
  });
});

describe("providerText", () => {
  it("returns the candidate text", () => {
    expect(providerText({ text: '{"questions":[]}', candidates: [{ finishReason: "STOP" }] })).toBe('{"questions":[]}');
  });

  it("throws the block reason when prompt feedback blocked the request", () => {
    expect(() => providerText({ text: "", promptFeedback: { blockReason: "SAFETY" } })).toThrow(/SAFETY/);
  });

  it("throws the finish reason when a candidate was blocked with no text", () => {
    expect(() => providerText({ text: null, candidates: [{ finishReason: "PROHIBITED_CONTENT" }] })).toThrow(/SAFETY|PROHIBITED/);
  });

  it("returns empty text when nothing was generated and nothing was blocked", () => {
    expect(providerText({ text: null })).toBe("");
  });
});

describe("classifyUpstream", () => {
  it("recognises an invalid API key", () => {
    const c = classifyUpstream(new Error('{"error":{"code":400,"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}'));
    expect(c.code).toBe("bad_key");
    expect(c.message).toMatch(/түлхүүр/);
  });

  it("recognises exhausted quota", () => {
    expect(classifyUpstream(new Error("429 RESOURCE_EXHAUSTED: quota exceeded")).code).toBe("quota");
  });

  it("recognises a missing model", () => {
    const c = classifyUpstream(new Error("404 NOT_FOUND: models/gemini-0.0 is not found"));
    expect(c.code).toBe("model_unavailable");
    expect(c.message).toMatch(/GEMINI_MODEL/);
  });

  it("recognises a safety block", () => {
    expect(classifyUpstream(new Error("PROHIBITED_CONTENT: response blocked by safety filters")).code).toBe("blocked");
  });

  it("reports provider overload as its own 503, not as a generic upstream error", () => {
    const c = classifyUpstream(
      new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'),
    );
    expect(c.code).toBe("unavailable");
    expect(c.status).toBe(503);
    expect(c.message).toMatch(/ачаалал/);
    expect(c.message).not.toContain("UNAVAILABLE");
  });

  it("keeps quota and overload distinct", () => {
    expect(classifyUpstream(new Error("429 RESOURCE_EXHAUSTED: quota exceeded")).code).toBe("quota");
    expect(classifyUpstream(new Error("503 UNAVAILABLE: high demand")).code).toBe("unavailable");
  });

  it("falls back to a generic message with no provider text", () => {
    const c = classifyUpstream(new Error("socket hang up while calling https://example.test/?key=AIzaLEAK"));
    expect(c.code).toBe("upstream");
    expect(c.message).not.toContain("AIza");
    expect(c.message).not.toContain("example.test");
  });
});
