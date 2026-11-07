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
/**
 * Нэг Gemini дуудлагын дээд хугацаа.
 * Phase 9B-ийн бодит хэмжилт (`gemini-3.5-flash`, N2, 10 асуулт):
 * vocabulary 27.6 с, grammar 34.1 с, reading 42.0 с, listening 37.6 с.
 * Өмнөх 22 с нь бүх хэсгийг 504 болгодог байсан тул хамгийн удаан
 * хэмжсэн утга (42.0 с) дээр ~43% маржин нэмэв.
 */
export const UPSTREAM_TIMEOUT_MS = 60_000;

export type RawGenerator = (args: { prompt: string; model: string }) => Promise<string>;

export interface GenerateDeps {
  apiKey?: string;
  model?: string;
  /** Тестэд солих боломжтой генератор. */
  generate?: RawGenerator;
  attempts?: number;
  /** Upstream timeout-ыг тестэд богиносгох. */
  timeoutMs?: number;
}

export interface GenerateOk {
  ok: true;
  questions: AiQuestion[];
  requested: number;
  rejected: number;
  attempts: number;
  model: string;
}

export type UpstreamCode = "bad_key" | "quota" | "unavailable" | "blocked" | "model_unavailable" | "upstream";

export interface GenerateErr {
  ok: false;
  status: number;
  code: "no_key" | "invalid_output" | "quality_failed" | "timeout" | UpstreamCode;
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
    "- explanationMn must be written in Mongolian Cyrillic and must quote the exact text of the correct option.",
    "- explanationMn must say why the correct option is right and, in one short clause each, why the other three are wrong. Never call a different option correct.",
    "- For listening questions: put each utterance on its own line in passage, prefixed with 男性： or 女性：, and do not repeat the question sentence inside the passage.",
    "- explanationJa is a short Japanese explanation.",
    "- passage is REQUIRED for reading and listening questions: it holds the Japanese text the question asks about.",
    "- passage is null for vocabulary, grammar and kanji questions.",
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

/**
 * Гаралтын дээд хэмжээ.
 * Google-ийн албан ёсны баримтаар `gemini-3.8-flash` нь 65,536 гаралтын
 * токен дэмждэг ч **нэг non-streaming HTTP хүсэлтэд 32,768** байна
 * (docs.cloud.google.com › models/gemini/3-8-flash, reference/models/inference).
 * 20 уншлагын асуултын багц 8,192-т багтахгүй (thinking токенууд ч
 * гаралтын хязгаарт тооцогдоно) тул дээд хязгаарт ойрхон утга авна.
 */
export const MAX_OUTPUT_TOKENS = 32_768;

/**
 * Gemini-д илгээх generationConfig.
 * · `responseMimeType` + `responseSchema` хосыг заавал хамт илгээнэ — зөвхөн
 *   MIME төрөл нь JSON-ыг батлахгүй (албан ёсны reference-ийн анхааруулга).
 * · `temperature`/`topP`/`topK` нь Gemini 3.6 Flash ба түүнээс хойшхи
 *   модельд дэмжигдэхгүй, илгээвэл үл хэрэгсэгдэнэ — тиймээс илгээхгүй.
 */
export const GENERATION_CONFIG = {
  responseMimeType: "application/json",
  responseSchema: QUESTION_SCHEMA,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
} as const;

/** Провайдерын хариултаас текст гаргана; блоклогдсон/хоосон бол шалтгааныг шиднэ. */
export function providerText(res: {
  text?: string | null;
  promptFeedback?: { blockReason?: string | null } | null;
  candidates?: Array<{ finishReason?: string | null }> | null;
}): string {
  const finish = res.candidates?.find((c) => c.finishReason && c.finishReason !== "STOP")?.finishReason;
  const reason = res.promptFeedback?.blockReason || finish || "";
  const text = res.text ?? "";
  if (!text.trim() && reason) throw new Error(`${reason}: provider returned no text`);
  return text;
}

/**
 * Провайдерын алдааг хэрэглэгчид ойлгомжтой, богино мессеж болгоно.
 * Түүхий JSON, URL, key ХЭЗЭЭ Ч буцаахгүй — зөвхөн кодыг нь ялгана.
 */
export function classifyUpstream(err: unknown): { code: UpstreamCode; status: number; message: string } {
  const probe = (err instanceof Error ? err.message : String(err)).toUpperCase();
  if (/API_KEY_INVALID|API KEY NOT VALID|INVALID_API_KEY|UNAUTHENTICATED|API_KEY_EXPIRED/.test(probe)) {
    return {
      code: "bad_key",
      status: 502,
      message: "Серверийн AI түлхүүр хүчингүй эсвэл хугацаа дууссан байна. Админ GEMINI_API_KEY-г шинэчилнэ үү.",
    };
  }
  if (/RESOURCE_EXHAUSTED|QUOTA|RATE LIMIT|TOO MANY REQUESTS|\b429\b/.test(probe)) {
    return {
      code: "quota",
      status: 503,
      message: "AI үйлчилгээний хязгаар дүүрлээ. Хэсэг хүлээгээд дахин оролдоно уу.",
    };
  }
  if (/PERMISSION_DENIED|SERVICE_DISABLED|BILLING|\b403\b/.test(probe)) {
    return {
      code: "upstream",
      status: 502,
      message: "AI түлхүүрт шаардлагатай эрх байхгүй байна. Админ тохиргоог шалгана уу.",
    };
  }
  if (/NOT_FOUND|NOT FOUND|UNSUPPORTED|DOES NOT EXIST|\b404\b/.test(probe)) {
    return {
      code: "model_unavailable",
      status: 502,
      message: "Тохируулсан AI модель боломжгүй байна. GEMINI_MODEL-ийг шалгана уу.",
    };
  }
  /* Провайдерын түр ачаалал — timeout, quota, ерөнхий алдаанаас ТУСДАА. */
  if (/UNAVAILABLE|HIGH DEMAND|OVERLOADED|SERVICE UNAVAILABLE|\b503\b/.test(probe)) {
    return {
      code: "unavailable",
      status: 503,
      message: "AI үйлчилгээ түр ачаалалтай байна. Хэдэн минут хүлээгээд дахин оролдоно уу.",
    };
  }
  if (/SAFETY|PROHIBITED_CONTENT|RECITATION|BLOCKED/.test(probe)) {
    return {
      code: "blocked",
      status: 502,
      message: "AI хариултыг аюулгүй байдлын дүрмээр блоклолоо. Өөр хэсгээр оролдоно уу.",
    };
  }
  return {
    code: "upstream",
    status: 502,
    message: "AI үйлчилгээний алдаа гарлаа. Дараа дахин оролдоно уу.",
  };
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
      config: GENERATION_CONFIG,
    });
    return providerText(res);
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
  const timeoutMs = deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS;

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
  /** Аль нэг оролдлого уншигдах JSON өгсөн эсэх — шалтгааныг ялгахад. */
  let sawJson = false;
  let lastError: string | null = null;

  while (attempts < attemptsAllowed && accepted.length < req.count) {
    attempts++;
    let text: string;
    try {
      text = await withTimeout(generate({ prompt, model }), timeoutMs);
    } catch (err) {
      if (err instanceof Error && err.message === "__timeout__") {
        return {
          ok: false,
          status: 504,
          code: "timeout",
          message: "AI хариу өгөх хугацаа хэтэрлээ. Дараа дахин оролдоно уу.",
        };
      }
      /* Түүхий провайдерын текстийг хэрэглэгчид харуулахгүй — зөвхөн ангилал. */
      return { ok: false, ...classifyUpstream(err) };
    }

    const parsed = extractJson(text);
    if (parsed !== null) sawJson = true;
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
    /* Хоёр өөр шалтгааныг ялгана: уншигдахгүй гаралт vs шалгалтад тэнцээгүй гаралт. */
    return {
      ok: false,
      status: 502,
      code: sawJson ? "quality_failed" : "invalid_output",
      message: sawJson
        ? "AI-аас шалгалтад тэнцсэн асуулт үүсээгүй. Дахин оролдоно уу."
        : (lastError ?? "AI-аас хүчинтэй асуулт үүсээгүй. Дахин оролдоно уу."),
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
