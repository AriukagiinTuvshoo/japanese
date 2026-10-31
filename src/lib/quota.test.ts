import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NEAR_FULL_RATIO,
  backupKeepFor,
  bytesOf,
  getEstimate,
  isNearFull,
  requestPersistenceOnce,
  usageRatio,
} from "./quota";
import { snapshotDoc, syncBackupPrefix } from "./storage";

describe("B4: quota helpers", () => {
  it("usageRatio returns null when quota is unknown (old browsers)", () => {
    expect(usageRatio(null)).toBeNull();
    expect(usageRatio({})).toBeNull();
    expect(usageRatio({ quota: 0, usage: 0 })).toBeNull();
    expect(usageRatio({ quota: NaN, usage: 1 })).toBeNull();
    expect(usageRatio({ quota: 100, usage: -1 })).toBeNull();
  });

  it("usageRatio caps at 1 and is exact below it", () => {
    expect(usageRatio({ quota: 100, usage: 40 })).toBeCloseTo(0.4);
    expect(usageRatio({ quota: 100, usage: 400 })).toBe(1);
  });

  it("isNearFull warns at 80% and below (mocked small quota)", () => {
    // Жижиг quota: 1 MB, ашиглалт 790 kB → дүүрээгүй, 810 kB → дүүрэх гэж байна.
    expect(isNearFull({ quota: 1_000_000, usage: 790_000 })).toBe(false);
    expect(isNearFull({ quota: 1_000_000, usage: 810_000 })).toBe(true);
    expect(isNearFull({ quota: 1_000_000, usage: 1_000_000 })).toBe(true);
    expect(NEAR_FULL_RATIO).toBe(0.8);
  });

  it("bytesOf counts UTF-8 bytes, not JS string length", () => {
    expect(bytesOf("abcd")).toBe(4);
    expect(bytesOf("こんにちは")).toBe(15); // 5 мөр × 3 байт
    expect(bytesOf("")).toBe(0);
  });

  it("backupKeepFor scales backups down as the doc grows", () => {
    expect(backupKeepFor(10_000)).toBe(3); // жижиг — бүрэн хамгаалалт
    expect(backupKeepFor(300 * 1024)).toBe(1); // 1 МБ-аас доош — нэг нөөц
    expect(backupKeepFor(2 * 1024 * 1024)).toBe(0); // хүнд — копигоор quota дүүргэхгүй
  });
});

/* localStorage-ийн хамгийн бага дуураймал (node environment — бодит зүйл байхгүй). */
function fakeStorage(opts: { failWrites?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
}

function keysOf(store: ReturnType<typeof fakeStorage>): string[] {
  return [...store.map.keys()].filter((k) => k.startsWith(syncBackupPrefix("quota")));
}

describe("B4: snapshotDoc never fills the disk with copies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const doc = (n: number) => ({ v: 3, srs: Object.fromEntries(Array.from({ length: n }, (_, i) => [`v${i}`, i])) }) as never;

  it("keeps 3 backups for a small doc (explicit keep still wins)", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    // Нэг мс дотор 5 удаа → нэг л түлхүүр болохын тулд цагийг явуулна.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 5; i++) {
      snapshotDoc("quota", doc(10), 3);
      vi.setSystemTime(Date.now() + 1000);
    }
    expect(keysOf(store).length).toBe(3);
  });

  it("prunes to 1 backup automatically for a large doc (mocked quota pressure)", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    // 256 kB–1 МБ баримт → backupKeepFor = 1
    const big = { v: 3, srs: {}, note: "x".repeat(300 * 1024) } as never;
    for (let i = 0; i < 4; i++) {
      snapshotDoc("quota", big);
      vi.setSystemTime(Date.now() + 1000);
    }
    expect(keysOf(store).length).toBe(1);
  });

  it("keeps no sync copy for a >1 MB doc so copies cannot eat the quota", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const huge = { v: 3, srs: {}, note: "x".repeat(1024 * 1024) } as never;
    expect(snapshotDoc("quota", huge)).toBeNull();
    expect(keysOf(store).length).toBe(0);
  });

  it("a failed write surfaces null instead of throwing", () => {
    vi.stubGlobal("localStorage", fakeStorage({ failWrites: true }));
    expect(snapshotDoc("quota", doc(1))).toBeNull();
  });
});

describe("B4: navigator.storage bridge", () => {
  it("getEstimate returns null when the API is missing", async () => {
    vi.stubGlobal("navigator", {});
    expect(await getEstimate()).toBeNull();
  });

  it("getEstimate forwards a mocked estimate", async () => {
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ usage: 10, quota: 20 }) } });
    expect(await getEstimate()).toEqual({ usage: 10, quota: 20 });
  });

  it("getEstimate swallows a throwing estimate()", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: () => Promise.reject(new Error("nope")),
      },
    });
    expect(await getEstimate()).toBeNull();
  });

  it("requestPersistenceOnce asks exactly once (flag persisted)", async () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", { storage: { persist } });
    expect(await requestPersistenceOnce()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(store.getItem("nd:storage-persist-asked")).toBe("1");
    // Second call: already asked → no new browser prompt.
    expect(await requestPersistenceOnce()).toBeNull();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("requestPersistenceOnce never throws when persist() rejects", async () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("navigator", {
      storage: { persist: () => Promise.reject(new Error("denied")) },
    });
    expect(await requestPersistenceOnce()).toBeNull();
  });

  it("still asks once when the asked-flag cannot be written (private mode)", async () => {
    vi.stubGlobal("localStorage", fakeStorage({ failWrites: true }));
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", { storage: { persist } });
    expect(await requestPersistenceOnce()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
