/**
 * RATE LIMIT STORE — нэг instance ба олон instance
 * ------------------------------------------------------------------
 * `rateLimit()` нь цэвэр функц; хадгалалтыг энэ модуль шийднэ.
 *
 * · MemoryRateStore — анхдагч. Instance тус бүрд тусдаа, тиймээс олон
 *   instance-тэй production-д квот нь instance-ийн тоогоор үржинэ.
 * · HttpRateStore — Redis-ийн REST протоколоор (Upstash-тай нийцтэй)
 *   атом `INCR` + `EXPIRE ... NX` (`/multi-exec`) ашиглана. Нэмэлт SDK
 *   шаардлагагүй, зөвхөн `fetch`. `RATE_LIMIT_REDIS_URL` +
 *   `RATE_LIMIT_REDIS_TOKEN` хоёулаа байвал идэвхжинэ — тэгэхгүй бол memory.
 * · ResilientRateStore — shared store алдаа гарвал instance-local
 *   limiter руу буулгана. Яагаад fail-open (хязгааргүй) ч, fail-closed
 *   (бүх хэрэглэгч 429) ч биш: shared store унасан ч per-instance
 *   хязгаар хэвээр ажиллаж, хэрэглэгч бүрэн блоклогдохгүй.
 *
 * Shared store нь fixed-window (INCR + TTL) ашигладаг бол memory store нь
 * sliding-window. Хязгаар ба цонхны урт ижил; зөвхөн цонхны хил дээр
 * хэдхэн секундын ялгаа гарна.
 */

import { rateLimit, type RateRule, type RateVerdict } from "./rateLimit.ts";

export interface RateStore {
  hit(key: string, now: number, rule: RateRule): Promise<RateVerdict>;
}

/** Sliding-window, instance-local. Хуучирсан түлхүүрүүдийг цэвэрлэнэ. */
export class MemoryRateStore implements RateStore {
  private buckets = new Map<string, number[]>();
  private readonly maxKeys: number;

  constructor(maxKeys = 500) {
    this.maxKeys = maxKeys;
  }

  get size(): number {
    return this.buckets.size;
  }

  async hit(key: string, now: number, rule: RateRule): Promise<RateVerdict> {
    const verdict = rateLimit(this.buckets.get(key) ?? [], now, rule);
    this.buckets.set(key, verdict.hits);
    if (this.buckets.size > this.maxKeys) this.prune(now, rule.windowMs);
    return verdict;
  }

  private prune(now: number, windowMs: number): void {
    const from = now - windowMs;
    for (const [key, hits] of this.buckets) {
      const kept = hits.filter((t) => t > from);
      if (kept.length) this.buckets.set(key, kept);
      else this.buckets.delete(key);
    }
  }
}

export interface RedisRestConfig {
  url: string;
  token: string;
  /** Түлхүүрийн namespace — preview/production нэг Redis хуваалцвал заавал ялгана. */
  prefix?: string;
  /** Тестэд орлуулах боломжтой. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class RateStoreError extends Error {
  constructor(message: string) {
    /* Токен, URL зэрэг мэдээлэл мессежид хэзээ ч орохгүй. */
    super(message);
    this.name = "RateStoreError";
  }
}

type RestEntry = { result?: unknown; error?: unknown };

/**
 * Redis REST (Upstash-compatible) дээр суурилсан shared store.
 *
 * Атом чанар: `INCR` ба `EXPIRE` нь нэг `/multi-exec` (Redis MULTI/EXEC)
 * дотор явна. `/pipeline` нь зөвхөн дараалал баталгаажуулдаг, атом бус
 * тул ашиглахгүй. Хоёр тусдаа дуудлага байсан бол хооронд нь процесс
 * унахад TTL-гүй түлхүүр үлдэж, тухайн IP бүрмөсөн блоклогдох байсан.
 */
export class HttpRateStore implements RateStore {
  private readonly url: string;
  private readonly token: string;
  private readonly prefix: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(cfg: RedisRestConfig) {
    this.url = cfg.url.replace(/\/+$/, "");
    this.token = cfg.token;
    this.prefix = cfg.prefix ?? "ratelimit:";
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.timeoutMs = cfg.timeoutMs ?? 1500;
  }

  async hit(key: string, _now: number, rule: RateRule): Promise<RateVerdict> {
    const windowSec = Math.max(1, Math.ceil(rule.windowMs / 1000));
    const storeKey = `${this.prefix}${key}`;

    const [incrEntry, expireEntry] = await this.transaction([
      ["INCR", storeKey],
      /* NX: TTL байгаа бол хөндөхгүй — цонх сунахгүй. */
      ["EXPIRE", storeKey, windowSec, "NX"],
    ]);

    const count = toNumber(incrEntry, "invalid counter");
    if (!Number.isFinite(count)) throw new RateStoreError("rate store: invalid counter");

    /* Хуучин Redis NX дэмжихгүй бол зөвхөн эхний хүсэлтэд TTL тавина. */
    if (expireEntry.error) {
      if (count === 1) await this.command(["EXPIRE", storeKey, windowSec]);
    }

    if (count > rule.limit) {
      const ttl = Number(await this.command(["TTL", storeKey]));
      const retryAfterSec = Number.isFinite(ttl) && ttl > 0 ? ttl : windowSec;
      return { allowed: false, remaining: 0, retryAfterSec, hits: [] };
    }

    return { allowed: true, remaining: Math.max(0, rule.limit - count), retryAfterSec: 0, hits: [] };
  }

  /** Нэг HTTP хүсэлтээр атом transaction (Upstash `/multi-exec`). */
  private async transaction(args: (string | number)[][]): Promise<RestEntry[]> {
    const data = await this.request("/multi-exec", args);
    if (!Array.isArray(data)) throw new RateStoreError("rate store: invalid transaction response");
    return data as RestEntry[];
  }

  private async command(args: readonly (string | number)[]): Promise<unknown> {
    const data = (await this.request("", args)) as RestEntry | null;
    if (!data || typeof data !== "object") throw new RateStoreError("rate store: invalid response");
    if (data.error) throw new RateStoreError("rate store: command failed");
    return data.result;
  }

  private async request(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    /* Node-д process-ыг барихгүй; browser шиг орчинд байхгүй. */
    (timer as unknown as { unref?: () => void }).unref?.();
    try {
      const res = await this.fetchImpl(`${this.url}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new RateStoreError(`rate store: http ${res.status}`);
      return (await res.json()) as unknown;
    } catch (err) {
      if (err instanceof RateStoreError) throw err;
      throw new RateStoreError("rate store: unavailable");
    } finally {
      clearTimeout(timer);
    }
  }
}

function toNumber(entry: RestEntry | undefined, failure: string): number {
  if (!entry || entry.error) throw new RateStoreError(`rate store: ${failure}`);
  const n = Number(entry.result);
  if (!Number.isFinite(n)) throw new RateStoreError(`rate store: ${failure}`);
  return n;
}

/** Shared store унасан ч instance-local хязгаарыг хадгална. */
export class ResilientRateStore implements RateStore {
  /* Node-ийн strip-only TS горим parameter property дэмждэггүй — энгийн талбар. */
  private readonly primary: RateStore;
  private readonly fallback: RateStore;

  constructor(primary: RateStore, fallback: RateStore) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async hit(key: string, now: number, rule: RateRule): Promise<RateVerdict> {
    try {
      return await this.primary.hit(key, now, rule);
    } catch {
      return this.fallback.hit(key, now, rule);
    }
  }
}

export interface RateStoreEnv {
  RATE_LIMIT_REDIS_URL?: string;
  RATE_LIMIT_REDIS_TOKEN?: string;
  RATE_LIMIT_REDIS_PREFIX?: string;
}

/** Орчны хувьсагчид тулгуурлан store сонгоно. */
export function createRateStore(env: RateStoreEnv = process.env): RateStore {
  const url = env.RATE_LIMIT_REDIS_URL?.trim();
  const token = env.RATE_LIMIT_REDIS_TOKEN?.trim();
  if (!url || !token) return new MemoryRateStore();
  return new ResilientRateStore(
    new HttpRateStore({ url, token, prefix: prefixOf(env) }),
    new MemoryRateStore(),
  );
}

/** Одоогийн горим — health/оношилгоонд (нууц утга агуулахгүй). */
export function rateStoreKind(env: RateStoreEnv = process.env): "shared" | "memory" {
  return env.RATE_LIMIT_REDIS_URL?.trim() && env.RATE_LIMIT_REDIS_TOKEN?.trim() ? "shared" : "memory";
}

function prefixOf(env: RateStoreEnv): string {
  const raw = env.RATE_LIMIT_REDIS_PREFIX?.trim();
  return raw ? `${raw.replace(/:+$/, "")}:` : "ratelimit:";
}
