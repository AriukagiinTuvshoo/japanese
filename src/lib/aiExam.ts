/**
 * AI-ААР ҮҮСГЭСЭН АСУУЛТ — СХЕМ, ХҮЧИНТЭЙ ВАЛИДАЦИ
 * ------------------------------------------------------------------
 * Gemini-ийн буцаасан JSON-ыг шууд хэрэглэгчид харуулахгүй. Энэ модуль
 * нь зөвхөн цэвэр функцтай (сүлжээ, DOM-гүй) тул тестээр бүрэн
 * хамгаалагдана, сервер ба клиент хоёр ижил дүрмээр шалгана.
 *
 * Чухал: AI-ийн асуулт нь `sourceType: "ai_generated"` байна. Хэзээ ч
 * «албан ёсны JLPT асуулт» гэж шошгогдохгүй.
 */

import type { Level } from "./types";
import type { Question } from "./study";

export const AI_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export const AI_SECTIONS = ["vocabulary", "grammar", "reading", "kanji", "listening"] as const;
export type AiSection = (typeof AI_SECTIONS)[number];

export type QualityStatus = "validated" | "pending_validation" | "needs_review" | "rejected";

export interface AiOption {
  id: string;
  text: string;
}

export interface AiQuestion {
  level: AiLevel;
  section: AiSection;
  questionType: string;
  question: string;
  passage: string | null;
  options: AiOption[];
  correctAnswer: string;
  explanationMn: string;
  explanationJa: string;
  vocabulary: string[];
  grammarPoints: string[];
  sourceType: "ai_generated";
  qualityStatus: QualityStatus;
}

export type IssueSeverity = "reject" | "warn";

export interface ValidationIssue {
  code: string;
  messageMn: string;
  severity: IssueSeverity;
}

export interface AcceptedQuestion {
  question: AiQuestion;
  issues: ValidationIssue[];
}

export interface RejectedQuestion {
  raw: unknown;
  issues: ValidationIssue[];
}

export interface BatchResult {
  accepted: AcceptedQuestion[];
  rejected: RejectedQuestion[];
}

const reject = (code: string, messageMn: string): ValidationIssue => ({ code, messageMn, severity: "reject" });
const warn = (code: string, messageMn: string): ValidationIssue => ({ code, messageMn, severity: "warn" });

const JP = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const PLACEHOLDERS = /\b(todo|tbd|lorem|placeholder|xxx)\b|\.\.\./i;

/** Текст харьцуулахын өмнөх хэвийн хэлбэр (NFKC, илүү зай, үл үзэгдэх тэмдэгт). */
export function normText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Олон догол мөр хадгалсан нормчлол — уншлагын эх текстэд. */
export function normBlock(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Монгол/япон текст хоосон эсэх. */
const blank = (s: string) => normText(s).length === 0;

/** LLM-ийн хариултаас JSON-ыг аюулгүй гаргаж авна (` ```json ` хашлага зэргийг арилгана). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* Эхний { ... } эсвэл [ ... ] блокыг оролдоно. */
  }
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

const asString = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const asStringArray = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => normText(x)).filter(Boolean).slice(0, max) : [];

function readOptions(raw: unknown): AiOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AiOption[] = [];
  raw.forEach((o, i) => {
    if (!o || typeof o !== "object") return;
    const rec = o as Record<string, unknown>;
    const id = asString(rec.id, 8) || String.fromCharCode(65 + i);
    const text = asString(rec.text, 500);
    if (!blank(text)) out.push({ id, text: normText(text) });
  });
  return out;
}

/**
 * Нэг асуултыг шалгана. `ok:false` бол хэрэглэгчид ХАРУУЛАХГҮЙ.
 * Асуудал нь зөвхөн `warn` бол `needs_review` төлөвтэйгээр харуулна.
 */
export function validateQuestion(
  raw: unknown,
  expected: { level: AiLevel; section: AiSection },
  seen: Set<string> = new Set(),
): { ok: boolean; accepted?: AcceptedQuestion; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, issues: [reject("not_object", "Асуулт объект биш байна.")] };
  }
  const rec = raw as Record<string, unknown>;

  const level = asString(rec.level, 4).toUpperCase();
  if (level !== expected.level) {
    issues.push(reject("level_mismatch", `Түвшин тохирохгүй (${level || "?"} ≠ ${expected.level}).`));
  }
  const section = asString(rec.section, 20).toLowerCase();
  if (section !== expected.section) {
    issues.push(reject("section_mismatch", `Хэсэг тохирохгүй (${section || "?"} ≠ ${expected.section}).`));
  }

  const question = normText(asString(rec.question, 2000));
  if (question.length < 3) issues.push(reject("question_short", "Асуултын текст хэт богино."));

  const passageRaw = rec.passage;
  const passage = passageRaw === null || passageRaw === undefined ? null : normBlock(asString(passageRaw, 8000));
  const maybePassage = passage && passage.length ? passage : null;

  if (!JP.test(question) && !(maybePassage && JP.test(maybePassage))) {
    issues.push(reject("not_japanese", "Асуулт эсвэл эх текст япон хэл дээр байх ёстой."));
  }
  if (PLACEHOLDERS.test(question)) issues.push(reject("placeholder", "Асуултад орлуулагч/хоосон текст байна."));

  const options = readOptions(rec.options);
  if (!options || options.length !== 4) {
    issues.push(reject("option_count", `Яг 4 сонголт байх ёстой (одоо ${options?.length ?? 0}).`));
  }
  let cleanOptions = options ?? [];

  if (cleanOptions.length) {
    const texts = cleanOptions.map((o) => normText(o.text).toLowerCase());
    if (new Set(texts).size !== texts.length) issues.push(reject("duplicate_options", "Сонголтууд давхардсан байна."));
    const ids = cleanOptions.map((o) => o.id);
    if (new Set(ids).size !== ids.length) issues.push(reject("duplicate_ids", "Сонголтын ID давхардсан байна."));
    if (cleanOptions.some((o) => o.text.length > 200)) issues.push(warn("option_long", "Сонголтын текст хэт урт байна."));
    if (cleanOptions.some((o) => PLACEHOLDERS.test(o.text))) issues.push(reject("placeholder_option", "Сонголтад орлуулагч текст байна."));
  }

  const correctAnswer = asString(rec.correctAnswer, 8).trim();
  const correctOption = cleanOptions.find((o) => o.id === correctAnswer);
  if (!correctOption) {
    issues.push(reject("answer_not_in_options", "Зөв хариулт сонголтуудын дотор байхгүй."));
  }

  const explanationMn = normText(asString(rec.explanationMn, 2000));
  const explanationJa = normText(asString(rec.explanationJa, 1000));
  if (explanationMn.length < 15) {
    issues.push(reject("explanation_missing", "Монгол тайлбар хэт богино/байхгүй."));
  } else if (correctOption && !normText(explanationMn).toLowerCase().includes(correctOption.text.toLowerCase())) {
    // Тайлбар нь зөв хариултыг дурдаагүй — боломжтой, гэхдээ хянах шаардлагатай.
    issues.push(warn("explanation_no_answer", "Тайлбар зөв хариултыг шууд дурдаагүй — хянах."));
  }
  if (explanationMn && !JP.test(explanationMn) && !JP.test(question)) {
    issues.push(warn("explanation_no_japanese", "Тайлбарт япон текст байхгүй."));
  }

  const hasReject = issues.some((i) => i.severity === "reject");
  if (hasReject) return { ok: false, issues };

  /* Давхардсан асуулт — ижил асуулт нэг багцад хоёр удаа гарч болохгүй. */
  const signature = `${expected.level}|${expected.section}|${question.toLowerCase()}|${cleanOptions.map((o) => o.text.toLowerCase()).sort().join("~")}`;
  if (seen.has(signature)) {
    return { ok: false, issues: [reject("duplicate_question", "Ижил асуулт багцад давхардсан байна.")] };
  }
  seen.add(signature);

  const questionType = normText(asString(rec.questionType, 40)) || "unknown";
  if (questionType === "unknown") issues.push(warn("question_type_missing", "Асуултын төрөл тодорхойгүй."));

  const ai: AiQuestion = {
    level: expected.level,
    section: expected.section,
    questionType,
    question,
    passage: maybePassage,
    options: cleanOptions,
    correctAnswer,
    explanationMn,
    explanationJa,
    vocabulary: asStringArray(rec.vocabulary),
    grammarPoints: asStringArray(rec.grammarPoints),
    // AI-ийн өгсөн утгыг үл хайхран тогтооно — «албан ёсны» гэж хуурамчаар шошгохыг хориглоно.
    sourceType: "ai_generated",
    qualityStatus: issues.length ? "needs_review" : "validated",
  };
  return { ok: true, accepted: { question: ai, issues }, issues };
}

/** Бүхэл хариултыг (массив эсвэл `{questions: [...]}`) шалгаж, хүлээн авсан/татгалзсаныг ялгана. */
export function validateAiBatch(
  raw: unknown,
  expected: { level: AiLevel; section: AiSection },
  max = 20,
): BatchResult {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).questions)
      ? ((raw as Record<string, unknown>).questions as unknown[])
      : [];

  const accepted: AcceptedQuestion[] = [];
  const rejected: RejectedQuestion[] = [];
  const seen = new Set<string>();

  for (const item of list.slice(0, Math.max(0, max))) {
    const r = validateQuestion(item, expected, seen);
    if (r.ok && r.accepted) accepted.push(r.accepted);
    else rejected.push({ raw: item, issues: r.issues });
  }
  if (!list.length) {
    rejected.push({ raw, issues: [reject("empty_batch", "AI ямар ч асуулт буцаагаагүй.")] });
  }
  return { accepted, rejected };
}

/** AI асуултыг QuizRunner-ийн `Question` болгон хөрвүүлнэ. */
export function aiToQuestion(ai: AiQuestion, index = 0): Question {
  const answerIdx = Math.max(0, ai.options.findIndex((o) => o.id === ai.correctAnswer));
  const explain = [ai.explanationMn, ai.explanationJa].filter(Boolean).join("\n\n");
  return {
    id: `ai-${ai.section}-${index}-${hash(ai.question)}`,
    kind: `ai-${ai.section}`,
    level: ai.level as Level,
    prompt: ai.question,
    promptSub: ai.passage ? undefined : "AI үүсгэсэн · хянасан",
    options: ai.options.map((o) => o.text),
    answer: answerIdx,
    passage: ai.passage ? ai.passage.split(/\n{2,}|\r?\n/).filter(Boolean) : undefined,
    explain,
    section: SECTION_MN[ai.section],
  };
}

const SECTION_MN: Record<AiSection, string> = {
  vocabulary: "Үгийн сан",
  grammar: "Дүрэм",
  reading: "Уншлага",
  kanji: "Ханз",
  listening: "Сонсгол",
};

/** Тогтвортой, богино hash (id-д). */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Серверт илгээх хүсэлтийн хязгаар — клиент ба сервер хоёулаа ижил дүрмийг мөрдөнө. */
export const AI_LIMITS = {
  minCount: 1,
  maxCount: 20,
  maxBodyBytes: 8_000,
  maxAvoid: 40,
  maxFocus: 15,
} as const;

export interface AiRequest {
  level: AiLevel;
  section: AiSection;
  count: number;
  /** Аль хэдийн үзсэн асуултууд — давтахгүйн тулд. */
  avoid?: string[];
  /** Хэрэглэгчийн алдсан зүйлс — тэдгээрт төвлөрсөн асуулт үүсгэхэд. */
  focus?: string[];
}

/** Хүсэлтийг цэвэрлэж, хязгаарт оруулна. Буруу бол `null`. */
export function normalizeAiRequest(raw: unknown): AiRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const level = asString(rec.level, 4).toUpperCase() as AiLevel;
  const section = asString(rec.section, 20).toLowerCase() as AiSection;
  if (!AI_LEVELS.includes(level) || !AI_SECTIONS.includes(section)) return null;
  const countNum = typeof rec.count === "number" ? rec.count : Number(rec.count);
  if (!Number.isFinite(countNum)) return null;
  const count = Math.min(AI_LIMITS.maxCount, Math.max(AI_LIMITS.minCount, Math.round(countNum)));
  const avoid = asStringArray(rec.avoid, AI_LIMITS.maxAvoid);
  const focus = asStringArray(rec.focus, AI_LIMITS.maxFocus).map((s) => s.slice(0, 60));
  return { level, section, count, avoid, focus };
}
