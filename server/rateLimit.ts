/**
 * Энгийн sliding-window rate limiter — цэвэр функц.
 * ------------------------------------------------------------------
 * Сервер нь IP тус бүрээр цагийн тэмдэглэгээний жагсаалт хадгалж,
 * цонхны гаднахыг хаяна. Vercel-ийн serverless орчинд энэ нь instance
 * тус бүрд ажиллана — олон instance-тэй production-д гадаад store
 * (жишээ нь Redis) хэрэгтэй гэдгийг README-д тэмдэглэсэн.
 */

export interface RateRule {
  /** Цонхны дотор зөвшөөрөх хүсэлтийн дээд тоо. */
  limit: number;
  /** Цонхны урт (мс). */
  windowMs: number;
}

export interface RateVerdict {
  allowed: boolean;
  remaining: number;
  /** Хэтэрсэн үед хэдэн секундын дараа дахин оролдох. */
  retryAfterSec: number;
  /** Цонхны доторх одоогийн тэмдэглэгээнүүд (хадгалахад). */
  hits: number[];
}

/** Нэг түлхүүрийн түүхийг шалгаж, шинэчлэгдсэн түүхийг буцаана. */
export function rateLimit(hits: readonly number[], now: number, rule: RateRule): RateVerdict {
  const from = now - rule.windowMs;
  const recent = hits.filter((t) => t > from && t <= now).sort((a, b) => a - b);

  if (recent.length >= rule.limit) {
    const oldest = recent[recent.length - rule.limit] ?? recent[0];
    const retryAfterMs = Math.max(0, oldest + rule.windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      hits: recent,
    };
  }

  const next = [...recent, now];
  return {
    allowed: true,
    remaining: rule.limit - next.length,
    retryAfterSec: 0,
    hits: next,
  };
}

/** Хуучирсан түлхүүрүүдийг санах ойгоос цэвэрлэхэд. */
export function pruneHits(hits: readonly number[], now: number, windowMs: number): number[] {
  const from = now - windowMs;
  return hits.filter((t) => t > from);
}
