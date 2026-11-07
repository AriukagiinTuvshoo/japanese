import { describe, expect, it } from "vitest";
import { AI_ERROR_KINDS, AI_ERROR_TEXT, aiErrorMessage, isRetryable, type AiErrorKind } from "./aiErrors";

const CYRILLIC = /[\u0400-\u04FF]/;

describe("AI error taxonomy", () => {
  it("covers every kind in both languages", () => {
    for (const kind of AI_ERROR_KINDS) {
      expect(AI_ERROR_TEXT[kind].mn.trim().length, `${kind}.mn`).toBeGreaterThan(10);
      expect(AI_ERROR_TEXT[kind].en.trim().length, `${kind}.en`).toBeGreaterThan(10);
    }
    expect(Object.keys(AI_ERROR_TEXT).sort()).toEqual([...AI_ERROR_KINDS].sort());
  });

  it("writes Mongolian in Cyrillic and English without Cyrillic", () => {
    for (const kind of AI_ERROR_KINDS) {
      expect(aiErrorMessage("mn", kind)).toMatch(CYRILLIC);
      expect(aiErrorMessage("en", kind)).not.toMatch(CYRILLIC);
    }
  });

  it("keeps missing key, quota and overload as three different messages", () => {
    const mn = new Set([aiErrorMessage("mn", "no_key"), aiErrorMessage("mn", "quota"), aiErrorMessage("mn", "unavailable")]);
    expect(mn.size).toBe(3);
    expect(aiErrorMessage("mn", "no_key")).toContain("GEMINI_API_KEY");
    expect(aiErrorMessage("mn", "quota")).not.toContain("GEMINI_API_KEY");
    expect(aiErrorMessage("mn", "timeout")).not.toContain("GEMINI_API_KEY");
  });

  it("falls back to a generic server message for an unknown kind", () => {
    expect(aiErrorMessage("en", "not_a_kind" as AiErrorKind)).toBe(AI_ERROR_TEXT.server.en);
    expect(aiErrorMessage("mn", "not_a_kind" as AiErrorKind)).toBe(AI_ERROR_TEXT.server.mn);
  });

  it("marks configuration errors as not worth retrying", () => {
    for (const kind of ["no_key", "bad_key", "model_unavailable", "invalid_request"] as AiErrorKind[]) {
      expect(isRetryable(kind), kind).toBe(false);
    }
  });

  it("marks transient failures as retryable", () => {
    for (const kind of [
      "rate_limited", "quota", "unavailable", "timeout", "network",
      "invalid_response", "quality_failed", "blocked", "server",
    ] as AiErrorKind[]) {
      expect(isRetryable(kind), kind).toBe(true);
    }
  });
});
