import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Endpoint-ийн түвшний шалгалт: IP тодорхойлох ба rate limit.
 * `generateAiExam` сүлжээнд гарахгүй — key хоосон үед шууд 503 буцаана.
 */

interface FakeRes {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function makeRes(): FakeRes {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body ?? "";
    },
  };
}

interface ReqOver {
  forwardedFor?: string;
  realIp?: string;
  remoteAddress?: string;
  origin?: string | null;
}

function makeReq(over: ReqOver = {}) {
  const headers: Record<string, string> = {
    host: "japanese.example",
    "content-type": "application/json",
  };
  if (over.origin !== null) headers.origin = over.origin ?? "https://japanese.example";
  if (over.forwardedFor) headers["x-forwarded-for"] = over.forwardedFor;
  if (over.realIp) headers["x-real-ip"] = over.realIp;
  return {
    method: "POST",
    headers,
    body: JSON.stringify({ level: "N2", section: "vocabulary", count: 5 }),
    socket: { remoteAddress: over.remoteAddress ?? "198.51.100.7" },
  };
}

async function loadHandler() {
  vi.resetModules();
  const mod = await import("./generate");
  return mod.default;
}

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  saved.TRUSTED_PROXY_HOPS = process.env.TRUSTED_PROXY_HOPS;
  /* Сүлжээнд гарахгүй: key байхгүй → no_key 503. */
  process.env.GEMINI_API_KEY = "";
});

afterEach(() => {
  for (const key of ["GEMINI_API_KEY", "TRUSTED_PROXY_HOPS"] as const) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("POST /api/exam/generate — IP ба rate limit", () => {
  it("a spoofed X-Forwarded-For cannot reset the quota", async () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    const handler = await loadHandler();

    for (let i = 0; i < 8; i++) {
      const res = makeRes();
      await handler(makeReq({ forwardedFor: `203.0.113.${i + 1}` }) as never, res as never);
      expect(res.statusCode).not.toBe(429);
    }

    const blocked = makeRes();
    await handler(makeReq({ forwardedFor: "203.0.113.200" }) as never, blocked as never);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("trusts the client address appended by one configured proxy", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const handler = await loadHandler();

    for (let i = 0; i < 8; i++) {
      await handler(makeReq({ forwardedFor: "198.51.100.10", remoteAddress: "10.0.0.5" }) as never, makeRes() as never);
    }

    /* Нэг клиент квотоо дуусгасан ч өөр клиент (өөр XFF) саадгүй. */
    const other = makeRes();
    await handler(makeReq({ forwardedFor: "198.51.100.11", remoteAddress: "10.0.0.5" }) as never, other as never);
    expect(other.statusCode).not.toBe(429);
  });

  it("blocks the same client behind a trusted proxy regardless of the socket address", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const handler = await loadHandler();

    for (let i = 0; i < 8; i++) {
      await handler(makeReq({ forwardedFor: "198.51.100.10", remoteAddress: "10.0.0.5" }) as never, makeRes() as never);
    }

    const blocked = makeRes();
    await handler(makeReq({ forwardedFor: "198.51.100.10", remoteAddress: "10.0.0.99" }) as never, blocked as never);
    expect(blocked.statusCode).toBe(429);
  });

  it("keeps the other guard rails intact", async () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    const handler = await loadHandler();

    const wrongMethod = makeRes();
    await handler({ ...makeReq(), method: "GET" } as never, wrongMethod as never);
    expect(wrongMethod.statusCode).toBe(405);

    const foreign = makeRes();
    await handler(makeReq({ origin: "https://evil.example" }) as never, foreign as never);
    expect(foreign.statusCode).toBe(403);

    const oversized = makeRes();
    await handler(
      { ...makeReq(), body: "x".repeat(9000) } as never,
      oversized as never,
    );
    expect(oversized.statusCode).toBe(413);
  });
});
