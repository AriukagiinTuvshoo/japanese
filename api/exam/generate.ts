/**
 * POST /api/exam/generate — AI асуулт үүсгэх цор ганц endpoint.
 * ------------------------------------------------------------------
 * · API key зөвхөн серверт (GEMINI_API_KEY).
 * · Хүсэлтийн хэмжээ, тоо, төрөл хатуу хязгаарлагдсан.
 * · IP тус бүрээр rate limit — хэтрэхэд 429.
 * · Алдааны мессежээр key/дотоод стек задруулахгүй.
 *
 * Vercel-ийн Node runtime (req, res) болон локал dev сервер хоёулаа
 * ижил signature-аар ажиллана.
 */

import { AI_LIMITS, normalizeAiRequest } from "../../src/lib/aiExam.ts";
import { generateAiExam } from "../../server/generate.ts";
import { pruneHits, rateLimit } from "../../server/rateLimit.ts";
import { sameOrigin } from "../../server/origin.ts";

/** Vercel/Node-ийн хамгийн бага хэрэгтэй интерфейс. */
interface ApiReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}
interface ApiRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

const RULE = { limit: 8, windowMs: 10 * 60 * 1000 } as const;
const buckets = new Map<string, number[]>();

function header(req: ApiReq, name: string): string {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function clientIp(req: ApiReq): string {
  const fwd = header(req, "x-forwarded-for").split(",")[0]?.trim();
  return fwd || header(req, "x-real-ip") || req.socket?.remoteAddress || "unknown";
}


function send(res: ApiRes, status: number, payload: unknown, extra: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
}

export default async function handler(req: ApiReq, res: ApiRes) {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    return send(res, 405, { error: "Зөвхөн POST хүсэлт зөвшөөрөгдөнө." }, { Allow: "POST" });
  }
  /* Өөр сайтаас хийсэн дуудлагыг хориглоно (CSRF). */
  if (!sameOrigin(header(req, "origin"), header(req, "host"), header(req, "x-forwarded-host"))) {
    return send(res, 403, { error: "Өөр эх сурвалжаас хийсэн хүсэлт хориотой." });
  }

  const now = Date.now();
  const ip = clientIp(req);
  const verdict = rateLimit(buckets.get(ip) ?? [], now, RULE);
  buckets.set(ip, verdict.hits);
  /* Санах ойг хязгаарлах: хуучирсан түлхүүрүүдийг үе үе цэвэрлэнэ. */
  if (buckets.size > 500) {
    for (const [key, hits] of buckets) {
      const kept = pruneHits(hits, now, RULE.windowMs);
      if (kept.length) buckets.set(key, kept);
      else buckets.delete(key);
    }
  }
  if (!verdict.allowed) {
    return send(
      res,
      429,
      { error: `Хэт олон хүсэлт. ${verdict.retryAfterSec} секундын дараа дахин оролдоно уу.` },
      { "Retry-After": String(verdict.retryAfterSec) },
    );
  }

  let raw: unknown = req.body;
  if (typeof raw === "string") {
    if (raw.length > AI_LIMITS.maxBodyBytes) {
      return send(res, 413, { error: "Хүсэлтийн хэмжээ хэт том." });
    }
    try {
      raw = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: "Хүсэлтийн JSON буруу байна." });
    }
  }
  if (raw && typeof raw === "object" && JSON.stringify(raw).length > AI_LIMITS.maxBodyBytes) {
    return send(res, 413, { error: "Хүсэлтийн хэмжээ хэт том." });
  }

  const input = normalizeAiRequest(raw);
  if (!input) {
    return send(res, 400, { error: "Түвшин, хэсэг эсвэл асуултын тоо буруу байна." });
  }

  try {
    const out = await generateAiExam(input);
    if (!out.ok) return send(res, out.status, { error: out.message, code: out.code });
    return send(res, 200, {
      questions: out.questions,
      model: out.model,
      requested: out.requested,
      rejected: out.rejected,
      attempts: out.attempts,
      note: "AI үүсгэсэн асуулт — албан ёсны JLPT асуулт биш.",
    });
  } catch (err) {
    /* Ямар ч тохиолдолд дотоод деталь задруулахгүй. */
    const msg = err instanceof Error ? err.message.slice(0, 120) : "Тодорхойгүй алдаа";
    return send(res, 500, { error: `Серверийн алдаа: ${msg}` });
  }
}
