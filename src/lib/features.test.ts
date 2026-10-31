import { afterEach, describe, expect, it, vi } from "vitest";
import { enabledFeatures, featureEnabled, type FeatureName } from "./features";

/**
 * B6: уншлага/сонсгол өгөгдөлгүй (content/*.json = 0) тул навигациас нууна.
 * Кодыг устгахгүй — зөвхөн тэмдэг (default OFF)оор хаана.
 */
function fakeStorage(map: Record<string, string>) {
  const m = new Map(Object.entries(map));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("B6: feature flags", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reading and listening are OFF by default (no override present)", () => {
    vi.stubGlobal("localStorage", fakeStorage({}));
    expect(featureEnabled("reading")).toBe(false);
    expect(featureEnabled("listening")).toBe(false);
    expect(enabledFeatures()).toEqual([]);
  });

  it("works when localStorage is unavailable (private mode / SSR)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(featureEnabled("reading")).toBe(false);
    expect(featureEnabled("listening")).toBe(false);
  });

  it("a dev/test override can turn a feature on without code changes", () => {
    vi.stubGlobal("localStorage", fakeStorage({ "nd:features": '{"reading":true}' }));
    expect(featureEnabled("reading")).toBe(true);
    expect(featureEnabled("listening")).toBe(false);
    expect(enabledFeatures()).toEqual(["reading"]);
  });

  it("corrupted override JSON falls back to the safe default (hidden)", () => {
    vi.stubGlobal("localStorage", fakeStorage({ "nd:features": "{NOT JSON" }));
    expect(featureEnabled("reading")).toBe(false);
  });

  it("ignores unknown keys and non-boolean values", () => {
    vi.stubGlobal("localStorage", fakeStorage({ "nd:features": '{"reading":1,"admin":true,"listening":true}' }));
    expect(featureEnabled("reading")).toBe(false);
    expect(featureEnabled("listening")).toBe(true);
    const names: FeatureName[] = enabledFeatures();
    expect(names).toEqual(["listening"]);
  });
});
