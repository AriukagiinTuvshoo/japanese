import { describe, expect, it } from "vitest";
import { sameOrigin } from "./origin";

describe("sameOrigin", () => {
  it("accepts requests without an Origin header (curl, server-side)", () => {
    expect(sameOrigin("", "japanese.example")).toBe(true);
  });

  it("accepts the exact same host and port", () => {
    expect(sameOrigin("https://japanese.example", "japanese.example")).toBe(true);
  });

  it("accepts the same hostname on another port (dev proxy)", () => {
    expect(sameOrigin("http://127.0.0.1:5180", "127.0.0.1:8787")).toBe(true);
  });

  it("rejects a different site", () => {
    expect(sameOrigin("https://evil.example", "japanese.example")).toBe(false);
  });

  it("rejects look-alike subdomains", () => {
    expect(sameOrigin("https://evil-japanese.example", "japanese.example")).toBe(false);
    expect(sameOrigin("https://japanese.example.evil.com", "japanese.example")).toBe(false);
  });

  it("rejects non-http protocols and malformed origins", () => {
    expect(sameOrigin("file:///tmp/x", "japanese.example")).toBe(false);
    expect(sameOrigin("not a url", "japanese.example")).toBe(false);
  });

  it("falls back to x-forwarded-host when host is empty", () => {
    expect(sameOrigin("https://japanese.example", "", "japanese.example")).toBe(true);
    expect(sameOrigin("https://japanese.example", "")).toBe(false);
  });
});
