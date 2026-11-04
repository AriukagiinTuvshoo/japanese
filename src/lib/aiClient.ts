/**
 * AI ДАСГАЛ — ХӨТЧИЙН КЛИЕНТ
 * ------------------------------------------------------------------
 * API key энд байхгүй: зөвхөн өөрийн origin-ийн `/api/exam/generate`
 * руу хүсэлт илгээнэ. Серверээс ирсэн асуулт аль хэдийн валидацид
 * орсон байдаг ч клиент дахин шалгаж, `Question` болгон хөрвүүлнэ.
 */

import { aiToQuestion, validateAiBatch, type AiQuestion, type AiRequest } from "./aiExam";
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
  /** Тохиргооны асуудал (GEMINI_API_KEY байхгүй) эсэх. */
  needsSetup: boolean;
}

export type AiExamOutcome = AiExamSuccess | AiExamFailure;

const TIMEOUT_MS = 40_000;

export async function requestAiExam(req: AiRequest): Promise<AiExamOutcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
      return { ok: false, status: res.status, message: "Серверийн хариулт JSON биш байна.", needsSetup: false };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: (body.error as string) ?? `HTTP ${res.status}`,
        needsSetup: res.status === 503,
      };
    }

    /* Серверийн хариултыг дахин шалгана — сүлжээний замын алдаанаас хамгаалалт. */
    const batch = validateAiBatch({ questions: body.questions }, { level: req.level, section: req.section }, req.count);
    if (!batch.accepted.length) {
      return { ok: false, status: res.status, message: "AI-аас хүчинтэй асуулт ирсэнгүй.", needsSetup: false };
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
    return {
      ok: false,
      status: aborted ? 504 : 0,
      message: aborted
        ? "AI хариу өгөх хугацаа хэтэрлээ. Дараа дахин оролдоно уу."
        : "Сервертэй холбогдож чадсангүй. Сүлжээ болон API серверийг шалгана уу.",
      needsSetup: false,
    };
  } finally {
    clearTimeout(timer);
  }
}
