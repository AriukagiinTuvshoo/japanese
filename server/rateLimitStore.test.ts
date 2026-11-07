import { describe, expect, it } from "vitest";
import type { RateRule } from "./rateLimit";
import {
  createRateStore,
  HttpRateStore,
  MemoryRateStore,
  RateStoreError,
  rateStoreKind,
  ResilientRateStore,
} from "./rateLimitStore";

const rule: RateRule = { limit: 3, windowMs: 60_000 };
const T0 = 1_700_000_000_000;

/**
 * Upstash REST-ийн хамгийн бага дуураймал:
 *  · POST /            → нэг команд, {result}
 *  · POST /multi-exec  → атом transaction, [{result},{result}]
 *  · EXPIRE ... NX     → TTL байгаа бол хөндөхгүй
 */
function fakeRedis() {
  const data = new Map<string, { count: number; expiresAt: number }>();
  const state = { fail: false, calls: [] as string[][], transactions: 0 };

  const run = ([name, key, ...rest]: (string | number)[]) => {
    const cmd = String(name).toUpperCase();
    const k = String(key);
    const entry = data.get(k);
    if (cmd === "INCR") {
      const e = entry ?? { count: 0, expiresAt: 0 };
      e.count += 1;
      data.set(k, e);
      return { result: e.count };
    }
    if (cmd === "EXPIRE") {
      if (!entry) return { result: 0 };
      const nx = rest.some((a) => String(a).toUpperCase() === "NX");
      if (nx && entry.expiresAt) return { result: 0 };
      entry.expiresAt = Date.now() + Number(rest[0]) * 1000;
      return { result: 1 };
    }
    if (cmd === "TTL") {
      if (!entry) return { result: -2 };
      if (!entry.expiresAt) return { result: -1 };
      return { result: Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)) };
    }
    return { error: `ERR unknown '${cmd}'` };
  };

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "[]")) as (string | number)[] | (string | number)[][];
    const path = String(url);
    if (path.endsWith("/multi-exec")) {
      state.transactions += 1;
      const cmds = body as (string | number)[][];
      state.calls.push(...cmds.map((c) => c.map(String)));
      if (state.fail) return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
      return { ok: true, status: 200, json: async () => cmds.map(run) } as unknown as Response;
    }
    const cmd = (body as (string | number)[]).map(String);
    state.calls.push(cmd);
    if (state.fail) return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
    return { ok: true, status: 200, json: async () => run(cmd) } as unknown as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, data, state };
}

describe("MemoryRateStore", () => {
  it("enforces the sliding window per key", async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) {
      expect((await store.hit("a", T0 + i, rule)).allowed).toBe(true);
    }
    expect((await store.hit("a", T0 + 10, rule)).allowed).toBe(false);
    expect((await store.hit("b", T0 + 10, rule)).allowed).toBe(true);
  });

  it("prunes expired keys instead of growing forever", async () => {
    const store = new MemoryRateStore(2);
    await store.hit("a", T0, rule);
    await store.hit("b", T0, rule);
    await store.hit("c", T0, rule);
    expect(store.size).toBeLessThanOrEqual(3);
    await store.hit("d", T0 + rule.windowMs + 1, rule);
    expect(store.size).toBe(1);
  });
});

describe("HttpRateStore", () => {
  it("shares one quota across two instances using the same storage", async () => {
    const { fetchImpl } = fakeRedis();
    const a = new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl });
    const b = new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl });

    for (let i = 0; i < 3; i++) {
      expect((await a.hit("203.0.113.5", T0 + i, rule)).allowed).toBe(true);
    }
    const blocked = await b.hit("203.0.113.5", T0 + 10, rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts INCR and EXPIRE in one atomic transaction", async () => {
    const { fetchImpl, state } = fakeRedis();
    const store = new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl });
    await store.hit("a", T0, rule);
    /* Нэг хүсэлт = нэг /multi-exec; INCR, EXPIRE хоёул дотор нь. */
    expect(state.transactions).toBe(1);
    expect(state.calls.map(([c]) => c)).toEqual(["INCR", "EXPIRE"]);
  });

  it("never extends an existing TTL (EXPIRE NX)", async () => {
    const { fetchImpl, data } = fakeRedis();
    const store = new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl });
    await store.hit("a", T0, rule);
    const first = data.get("ratelimit:a")!.expiresAt;
    await store.hit("a", T0 + 1, rule);
    await store.hit("a", T0 + 2, rule);
    expect(data.get("ratelimit:a")!.expiresAt).toBe(first);
    expect(data.get("ratelimit:a")!.count).toBe(3);
  });

  it("repairs a key that was left without a TTL", async () => {
    const { fetchImpl, data } = fakeRedis();
    data.set("ratelimit:a", { count: 5, expiresAt: 0 });
    const store = new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl });
    const v = await store.hit("a", T0, { limit: 10, windowMs: 60_000 });
    expect(v.allowed).toBe(true);
    expect(data.get("ratelimit:a")!.expiresAt).toBeGreaterThan(0);
  });

  it("keeps separate counters per key and namespaces them", async () => {
    const { fetchImpl, data } = fakeRedis();
    const store = new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl });
    for (let i = 0; i < 3; i++) await store.hit("a", T0 + i, rule);
    expect((await store.hit("a", T0 + 4, rule)).allowed).toBe(false);
    expect((await store.hit("b", T0 + 4, rule)).allowed).toBe(true);
    expect([...data.keys()].sort()).toEqual(["ratelimit:a", "ratelimit:b"]);
  });

  it("supports a custom namespace prefix", async () => {
    const { fetchImpl, data } = fakeRedis();
    const store = new HttpRateStore({ url: "https://redis.example", token: "t", prefix: "preview:", fetchImpl });
    await store.hit("a", T0, rule);
    expect([...data.keys()]).toEqual(["preview:a"]);
  });

  it("reports a storage error without leaking the token", async () => {
    const { fetchImpl, state } = fakeRedis();
    state.fail = true;
    const store = new HttpRateStore({ url: "https://redis.example", token: "super-secret", fetchImpl });
    let message = "";
    try {
      await store.hit("a", T0, rule);
    } catch (err) {
      expect(err).toBeInstanceOf(RateStoreError);
      message = (err as Error).message;
    }
    expect(message).toContain("http 503");
    expect(message).not.toContain("super-secret");
  });
});

describe("ResilientRateStore", () => {
  it("degrades to the instance-local limiter instead of failing open", async () => {
    const fallback = new MemoryRateStore();
    const store = new ResilientRateStore(
      {
        hit: async () => {
          throw new RateStoreError("rate store: unavailable");
        },
      },
      fallback,
    );

    for (let i = 0; i < 3; i++) {
      expect((await store.hit("ip", T0 + i, rule)).allowed).toBe(true);
    }
    expect((await store.hit("ip", T0 + 4, rule)).allowed).toBe(false);
  });

  it("uses the shared store once it recovers", async () => {
    const { fetchImpl, state } = fakeRedis();
    const memory = new MemoryRateStore();
    const store = new ResilientRateStore(
      new HttpRateStore({ url: "https://redis.example", token: "t", fetchImpl }),
      memory,
    );

    state.fail = true;
    for (let i = 0; i < 3; i++) await store.hit("ip", T0 + i, rule);
    expect((await store.hit("ip", T0 + 4, rule)).allowed).toBe(false);

    state.fail = false;
    expect((await store.hit("other", T0 + 5, rule)).allowed).toBe(true);
  });
});

describe("createRateStore", () => {
  it("uses the shared store only when both url and token exist", () => {
    expect(rateStoreKind({})).toBe("memory");
    expect(rateStoreKind({ RATE_LIMIT_REDIS_URL: "https://redis.example" })).toBe("memory");
    expect(rateStoreKind({ RATE_LIMIT_REDIS_TOKEN: "token" })).toBe("memory");
    expect(rateStoreKind({ RATE_LIMIT_REDIS_URL: "https://redis.example", RATE_LIMIT_REDIS_TOKEN: "token" })).toBe(
      "shared",
    );
    expect(createRateStore({})).toBeInstanceOf(MemoryRateStore);
  });
});
