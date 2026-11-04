import { describe, expect, it } from "vitest";
import { pruneHits, rateLimit, type RateRule } from "./rateLimit";

const rule: RateRule = { limit: 3, windowMs: 60_000 };
const T0 = 1_700_000_000_000;

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    let hits: number[] = [];
    for (let i = 0; i < 3; i++) {
      const v = rateLimit(hits, T0 + i * 1000, rule);
      expect(v.allowed).toBe(true);
      expect(v.remaining).toBe(2 - i);
      hits = v.hits;
    }
  });

  it("blocks the request that exceeds the limit", () => {
    let hits: number[] = [];
    for (let i = 0; i < 3; i++) hits = rateLimit(hits, T0 + i * 1000, rule).hits;
    const v = rateLimit(hits, T0 + 4000, rule);
    expect(v.allowed).toBe(false);
    expect(v.remaining).toBe(0);
    expect(v.retryAfterSec).toBeGreaterThan(0);
    expect(v.hits).toHaveLength(3);
  });

  it("frees the slot after the window passes", () => {
    let hits: number[] = [];
    for (let i = 0; i < 3; i++) hits = rateLimit(hits, T0 + i * 1000, rule).hits;
    expect(rateLimit(hits, T0 + 30_000, rule).allowed).toBe(false);
    expect(rateLimit(hits, T0 + 62_000, rule).allowed).toBe(true);
  });

  it("reports a retry delay that matches the oldest hit", () => {
    const hits = [T0, T0 + 1000, T0 + 2000];
    const v = rateLimit(hits, T0 + 30_000, rule);
    expect(v.retryAfterSec).toBe(30);
  });

  it("ignores timestamps from outside the window", () => {
    const hits = [T0 - 120_000, T0 - 90_000, T0 - 61_000];
    expect(rateLimit(hits, T0, rule).allowed).toBe(true);
  });
});

describe("pruneHits", () => {
  it("drops expired entries", () => {
    expect(pruneHits([T0 - 120_000, T0 - 1000], T0, 60_000)).toEqual([T0 - 1000]);
  });
});
