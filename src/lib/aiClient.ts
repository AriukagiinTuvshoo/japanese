/**
 * AI ДАСГАЛ — ХӨТЧИЙН КЛИЕНТ
 * ------------------------------------------------------------------
 * API key энд байхгүй: зөвхөн өөрийн origin-ийн `/api/exam/generate`
 * руу хүсэлт илгээнэ. Серверээс ирсэн асуулт аль хэдийн валидацид
 * орсон байдаг ч клиент дахин шалгаж, `Question` болгон хөрвүүлнэ.
 *
 * Алдаа бүр `kind`-тэй буцна — UI нь серверийн түүхий текст биш, өөрийн
 * хэлээр (MN/EN) ижил утгатай мессеж харуулна.
 */

import { aiToQuestion, validateAiBatch, type AiQuestion, type AiRequest } from "./aiExam";
import type { AiErrorKind } from "./aiErrors";
import type { Question } from "./study";

export interface AiExamSuccess {
  ok: true;
  questions: Question[];
  ai: AiQuestion[];
  model: string;
  rejected: number;
  note: string;
}

export interface AiExamFailure {
  ok: false;
  status: number;
  message: string;
  /** Тохиргооны асуудал (түлхүүр байхгүй/хүчингүй) эсэх. */
  needsSetup: boolean;
  /** UI-д хэлээр харуулах ангилал — `aiErrorMessage()`. */
  kind: AiErrorKind;
}

export type AiExamOutcome = AiExamSuccess | AiExamFailure;

/**
 * Хөтчийн дээд хүлээлт. Сервер нэг оролдлогыг 60 с, дээд тал нь 2 оролдлого
 * (нийт 120 с) ажиллуулж болох тул түүнээс урт байх ёстой — эс бөгөөс
 * хөтөч серверийн 504 хариуг хүлээхгүйгээр тасална.
 */
export const AI_CLIENT_TIMEOUT_MS = 135_000;

/** Серверийн `code` → UI-ийн ангилал. */
const CODE_KIND: Record<string, AiErrorKind> = {
  no_key: "no_key",
  bad_key: "bad_key",
  model_unavailable: "model_unavailable",
  quota: "quota",
  unavailable: "unavailable",
  timeout: "timeout",
  blocked: "blocked",
  quality_failed: "quality_failed",
  invalid_output: "invalid_response",
  invalid_request: "invalid_request",
  rate_limited: "rate_limited",
  internal: "server",
  upstream: "server",
};

/** Кодгүй хариултыг HTTP статусаар ангилна. */
function kindFromStatus(status: number): AiErrorKind {
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  if (status === 503) return "unavailable";
  if (status === 400 || status === 404 || status === 413 || status === 422) return "invalid_request";
  return "server";
}

function kindOf(status: number, code: unknown): AiErrorKind {
  const mapped = typeof code === "string" ? CODE_KIND[code] : undefined;
  return mapped ?? kindFromStatus(status);
}

export async function requestAiExam(req: AiRequest, signal?: AbortSignal): Promise<AiExamOutcome> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, AI_CLIENT_TIMEOUT_MS);
  /* Дуудагч (жишээ нь unmount) цуцалбал дотоод хүсэлтийг ч зогсооно. */
  const onCallerAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  try {
    const res = await fetch("/api/exam/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        status: res.status,
        message: "Серверийн хариулт JSON биш байна.",
        needsSetup: false,
        kind: "invalid_response",
      };
    }

    if (!res.ok) {
      /* Сервер/прокси мессежгүй бол «HTTP 500» гэх мэт англи код харуулахгүй. */
      const fallback =
        res.status >= 500
          ? `Серверийн алдаа (HTTP ${res.status}). Дараа дахин оролдоно уу.`
          : `Хүсэлт амжилтгүй (HTTP ${res.status}).`;
      const kind = kindOf(res.status, body.code);
      return {
        ok: false,
        status: res.status,
        message: (body.error as string) ?? fallback,
        /* 503 нь дандаа «түлхүүр байхгүй» гэсэн үг БИШ — зөвхөн `no_key`/`bad_key` код. */
        needsSetup: kind === "no_key" || kind === "bad_key",
        kind,
      };
    }

    /* Серверийн хариултыг дахин шалгана — сүлжээний замын алдаанаас хамгаалалт. */
    const batch = validateAiBatch({ questions: body.questions }, { level: req.level, section: req.section }, req.count);
    if (!batch.accepted.length) {
      return {
        ok: false,
        status: res.status,
        message: "AI-аас хүчинтэй асуулт ирсэнгүй.",
        needsSetup: false,
        kind: "invalid_response",
      };
    }

    const ai = batch.accepted.map((a) => a.question);
    return {
      ok: true,
      ai,
      questions: ai.map((q, i) => aiToQuestion(q, i)),
      model: (body.model as string) ?? "unknown",
      rejected: Number(body.rejected ?? 0) + batch.rejected.length,
      note: (body.note as string) ?? "AI үүсгэсэн асуулт — албан ёсны JLPT асуулт биш.",
    };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    if (timedOut) {
      return {
        ok: false,
        status: 504,
        message: "AI хариу өгөх хугацаа хэтэрлээ. Дараа дахин оролдоно уу.",
        needsSetup: false,
        kind: "timeout",
      };
    }
    if (aborted && signal?.aborted) {
      return { ok: false, status: 0, message: "Хүсэлт цуцлагдлаа.", needsSetup: false, kind: "cancelled" };
    }
    return {
      ok: false,
      status: 0,
      message: "Сервертэй холбогдож чадсангүй. Сүлжээ болон API серверийг шалгана уу.",
      needsSetup: false,
      kind: "network",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
