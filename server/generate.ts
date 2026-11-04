/**
 * AI АСУУЛТ ҮҮСГЭХ — СЕРВЕР ТАЛ
 * ------------------------------------------------------------------
 * Gemini-г зөвхөн серверт дуудна. API key нь хөтөч рүү хэзээ ч
 * орохгүй, лог руу ч бичигдэхгүй. Хариултыг `src/lib/aiExam.ts`-ийн
 * ижил валидатороор шалгаж, муу асуултыг хэрэглэгчид харуулахгүй.
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  AI_SECTIONS,
  extractJson,
  normText,
  validateAiBatch,
  type AiQuestion,
  type AiRequest,
  type AiSection,
} from "../src/lib/aiExam.ts";

export const DEFAULT_MODEL = "gemini-3.8-flash";
export const MAX_ATTEMPTS = 2;
export const UPSTREAM_TIMEOUT_MS = 22_000;

export type RawGenerator = (args: { prompt: string; model: string }) => Promise<string>;

export interface GenerateDeps {
  apiKey?: string;
  model?: string;
  /** Тестэд солих боломжтой генератор. */
  generate?: RawGenerator;
  attempts?: number;
}

export interface GenerateOk {
  ok: true;
  questions: AiQuestion[];
  requested: number;
  rejected: number;
  attempts: number;
  model: string;
}

export interface GenerateErr {
  ok: false;
  status: number;
  code: "no_key" | "upstream" | "invalid_output" | "timeout";
  message: string;
}

export type GenerateOutcome = GenerateOk | GenerateErr;

const SECTION_HINT: Record<AiSection, string> = {
  vocabulary: "語彙 — reading, meaning, contextual usage, or similar-meaning questions.",
  grammar: "文法 — sentence completion, sentence ordering, or contextual grammar.",
  reading: "読解 — short/medium passage with main idea, inference, or information retrieval.",
  kanji: "漢字 — reading, meaning, or correct kanji selection.",
  listening: "聴解 — write a short script in the passage field; the question targets comprehension of it.",
};

/** Gemini-д өгөх заавар. */
export function buildPrompt(req: AiRequest): string {
  const avoid = req.avoid?.length
    ? `\nDo NOT repeat or lightly reword any of these previously used questions:\n- ${req.avoid.slice(0, 20).join("\n- ")}`
    : "";
  const focus = req.focus?.length
    ? `\nThe learner recently answered these items incorrectly. Build the questions around them where it is natural:\n- ${req.focus.slice(0, 10).join("\n- ")}`
    : "";
  return [
    `You are a careful JLPT question writer. Write ${req.count} original Japanese practice questions for level ${req.level}.`,
    `Section: ${req.section} — ${SECTION_HINT[req.section]}`,
    "",
    "Hard requirements:",
    "- The Japanese must be natural and level-appropriate; distractors must be plausible but clearly wrong.",
    "- Exactly four options with ids A, B, C, D. Exactly one is correct, and correctAnswer holds its id.",
    "- explanationMn must be written in Mongolian Cyrillic and must name the correct option.",
    "- explanationJa is a short Japanese explanation.",
    "- passage is a string for reading/listening questions, otherwise null.",
    "- These are AI practice questions, NOT official JLPT questions. Never claim they are official.",
    "- No placeholders, no duplicated options, no duplicated questions.",
    avoid,
    focus,
    "",
    "Return JSON only, matching the provided schema.",
  ].join("\n");
}

const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          level: { type: Type.STRING },
          section: { type: Type.STRING },
          questionType: { type: Type.STRING },
          question: { type: Type.STRING },
          passage: { type: Type.STRING, nullable: true },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { id: { type: Type.STRING }, text: { type: Type.STRING } },
              required: ["id", "text"],
            },
          },
          correctAnswer: { type: Type.STRING },
          explanationMn: { type: Type.STRING },
          explanationJa: { type: Type.STRING },
          vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
          grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["level", "section", "question", "options", "correctAnswer", "explanationMn"],
      },
    },
  },
  required: ["questions"],
};

/** Сүлжээний алдааг аюулгүй, богино мессеж болгоно (key, URL параметр алдагдахгүй). */
function safeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const stripped = raw
    .replace(/key=[A-Za-z0-9_\-]+/gi, "key=***")
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, "***")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 200) || "Тодорхойгүй алдаа";
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, rej) => {
    timer = setTimeout(() => rej(new Error("__timeout__")), ms);
    // Node-д event loop-ыг барихгүй (тестүүд гацахгүй).
    (timer as unknown as { unref?: () => void }).unref?.();
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function sdkGenerator(apiKey: string): RawGenerator {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ prompt, model }) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.9,
        maxOutputTokens: 8192,
      },
    });
    return res.text ?? "";
  };
}

/**
 * Хүсэлтийг гүйцэтгэнэ: Gemini → JSON → валидаци → цэвэр асуултууд.
 * Хангалттай цэвэр асуулт гараагүй бол нэг удаа дахин оролдоно.
 */
export async function generateAiExam(req: AiRequest, deps: GenerateDeps = {}): Promise<GenerateOutcome> {
  const model = deps.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  const attemptsAllowed = Math.max(1, Math.min(MAX_ATTEMPTS, deps.attempts ?? MAX_ATTEMPTS));

  if (!deps.generate && !apiKey) {
    return {
      ok: false,
      status: 503,
      code: "no_key",
      message: "AI тохиргоо байхгүй: серверт GEMINI_API_KEY тохируулаагүй байна.",
    };
  }

  const generate = deps.generate ?? sdkGenerator(apiKey!);
  const prompt = buildPrompt(req);
  const accepted: AiQuestion[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let attempts = 0;
  let lastError: string | null = null;

  while (attempts < attemptsAllowed && accepted.length < req.count) {
    attempts++;
    let text: string;
    try {
      text = await withTimeout(generate({ prompt, model }), UPSTREAM_TIMEOUT_MS);
    } catch (err) {
      const timeout = err instanceof Error && err.message === "__timeout__";
      return {
        ok: false,
        status: timeout ? 504 : 502,
        code: timeout ? "timeout" : "upstream",
        message: timeout
          ? "AI хариу өгөх хугацаа хэтэрлээ. Дараа дахин оролдоно уу."
          : `AI үйлчилгээний алдаа: ${safeError(err)}`,
      };
    }

    const parsed = extractJson(text);
    const batch = validateAiBatch(parsed, { level: req.level, section: req.section }, req.count);
    rejected += batch.rejected.length;

    for (const a of batch.accepted) {
      const key = normText(a.question.question).toLowerCase();
      if (seen.has(key)) {
        rejected++;
        continue;
      }
      seen.add(key);
      accepted.push(a.question);
      if (accepted.length >= req.count) break;
    }
    lastError = parsed === null ? "AI-ийн хариулт JSON биш байна." : null;
  }

  if (!accepted.length) {
    return {
      ok: false,
      status: 502,
      code: "invalid_output",
      message: lastError ?? "AI-аас хүчинтэй асуулт үүсээгүй. Дахин оролдоно уу.",
    };
  }

  return {
    ok: true,
    questions: accepted.slice(0, req.count),
    requested: req.count,
    rejected,
    attempts,
    model,
  };
}

export { AI_SECTIONS };
