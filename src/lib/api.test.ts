import { describe, expect, it } from "vitest";
import { apiBase, backoffMs } from "./api";

describe("P0-4: no backend configured → never probe", () => {
  it("returns null for a static production build without VITE_API_URL", () => {
    expect(apiBase({ DEV: false })).toBeNull();
    expect(apiBase({})).toBeNull();
  });

  it("uses the dev proxy origin during development", () => {
    expect(apiBase({ DEV: true })).toBe("");
  });

  it("honours an explicit API URL in production and trims the trailing slash", () => {
    expect(apiBase({ DEV: false, VITE_API_URL: "https://api.example.com/" })).toBe("https://api.example.com");
    expect(apiBase({ DEV: true, VITE_API_URL: " https://api.example.com " })).toBe("https://api.example.com");
  });

  it("ignores a blank API URL", () => {
    expect(apiBase({ DEV: true, VITE_API_URL: "   " })).toBe("");
  });
});

describe("P0-4: health retry backs off exponentially and stays bounded", () => {
  it("starts at 30s and doubles", () => {
    expect(backoffMs(0)).toBe(30_000);
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
  });

  it("caps at 10 minutes and never returns NaN for odd input", () => {
    expect(backoffMs(4)).toBe(480_000);
    expect(backoffMs(5)).toBe(600_000);
    expect(backoffMs(50)).toBe(600_000);
    expect(backoffMs(-3)).toBe(30_000);
    expect(backoffMs(Number.NaN)).toBe(30_000);
  });
});
