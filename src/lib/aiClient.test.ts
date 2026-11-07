import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_CLIENT_TIMEOUT_MS, requestAiExam } from "./aiClient";
import type { AiRequest } from "./aiExam";
import { MAX_ATTEMPTS, UPSTREAM_TIMEOUT_MS } from "../../server/generate";

const req: AiRequest = { level: "N2", section: "vocabulary", count: 1 };

function mockFetch(init: { status: number; body: string; headers?: Record<string, string> }) {
  const fn = vi.fn(async () => new Response(init.body, { status: init.status, headers: init.headers }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const validQuestion = (n: number) => ({
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestAiExam", () => {
  it("calls only the app's own origin endpoint", async () => {
    const fn = mockFetch({ status: 200, body: JSON.stringify({ questions: [validQuestion(1)], model: "m" }) });
    await requestAiExam(req);
    expect(fn).toHaveBeenCalledTimes(1);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/exam/generate");
    expect(init.method).toBe("POST");
  });

  it("returns validated questions on success", async () => {
    mockFetch({ status: 200, body: JSON.stringify({ questions: [validQuestion(1)], model: "gemini-3.8-flash", rejected: 0 }) });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.questions).toHaveLength(1);
      expect(out.model).toBe("gemini-3.8-flash");
    }
  });

  it("shows the server's Mongolian message and flags setup when the key is missing", async () => {
    mockFetch({
      status: 503,
      body: JSON.stringify({ error: "AI тохиргоо байхгүй: серверт GEMINI_API_KEY тохируулаагүй байна.", code: "no_key" }),
    });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.needsSetup).toBe(true);
      expect(out.message).toContain("GEMINI_API_KEY");
    }
  });

  it("waits longer than the server's whole retry budget", () => {
    expect(AI_CLIENT_TIMEOUT_MS).toBeGreaterThan(MAX_ATTEMPTS * UPSTREAM_TIMEOUT_MS);
  });

  it("does not call an overloaded provider a missing key", async () => {
    mockFetch({
      status: 503,
      body: JSON.stringify({ error: "AI үйлчилгээ түр ачаалалтай байна. Хэдэн минут хүлээгээд дахин оролдоно уу.", code: "unavailable" }),
    });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.needsSetup).toBe(false);
      expect(out.message).toMatch(/ачаалал/);
    }
  });

  it("never surfaces a bare HTTP code when a proxy fails without a JSON error", async () => {
    mockFetch({ status: 500, body: "{}" });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.message).not.toBe("HTTP 500");
      expect(out.message).toMatch(/Серверийн алдаа/);
    }
  });

  it("explains a non-JSON gateway response instead of crashing", async () => {
    mockFetch({ status: 502, body: "<html>Bad Gateway</html>", headers: { "Content-Type": "text/html" } });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toBe("Серверийн хариулт JSON биш байна.");
  });

  it("rejects a success response whose questions fail validation", async () => {
    mockFetch({ status: 200, body: JSON.stringify({ questions: [{ level: "N2", section: "vocabulary" }], model: "m" }) });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.message).toBe("AI-аас хүчинтэй асуулт ирсэнгүй.");
      expect(out.kind).toBe("invalid_response");
    }
  });

  it("classifies quota, overload and timeout separately", async () => {
    mockFetch({ status: 503, body: JSON.stringify({ error: "limit", code: "quota" }) });
    const quota = await requestAiExam(req);
    expect(quota.ok).toBe(false);
    if (!quota.ok) expect(quota.kind).toBe("quota");

    mockFetch({ status: 503, body: JSON.stringify({ error: "busy", code: "unavailable" }) });
    const busy = await requestAiExam(req);
    if (!busy.ok) expect(busy.kind).toBe("unavailable");

    mockFetch({ status: 504, body: JSON.stringify({ error: "slow", code: "timeout" }) });
    const slow = await requestAiExam(req);
    if (!slow.ok) {
      expect(slow.kind).toBe("timeout");
      expect(slow.needsSetup).toBe(false);
    }
  });

  it("classifies our own rate limit apart from a keyless 503", async () => {
    mockFetch({ status: 429, body: JSON.stringify({ error: "Хэт олон хүсэлт.", code: "rate_limited" }) });
    const limited = await requestAiExam(req);
    if (!limited.ok) {
      expect(limited.kind).toBe("rate_limited");
      expect(limited.needsSetup).toBe(false);
    }

    mockFetch({ status: 503, body: JSON.stringify({ error: "key", code: "no_key" }) });
    const key = await requestAiExam(req);
    if (!key.ok) {
      expect(key.kind).toBe("no_key");
      expect(key.needsSetup).toBe(true);
    }
  });

  it("calls a 503 without a code overloaded, never a missing key", async () => {
    mockFetch({ status: 503, body: "{}" });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe("unavailable");
      expect(out.needsSetup).toBe(false);
    }
  });

  it("classifies an unreadable gateway body as invalid_response", async () => {
    mockFetch({ status: 502, body: "<html>Bad Gateway</html>" });
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe("invalid_response");
  });

  it("classifies a broken connection as network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const out = await requestAiExam(req);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe("network");
      expect(out.status).toBe(0);
    }
  });

  it("lets the caller cancel an in-flight request", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const ctrl = new AbortController();
    const pending = requestAiExam(req, ctrl.signal);
    ctrl.abort();
    const out = await pending;
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe("cancelled");
  });
});
