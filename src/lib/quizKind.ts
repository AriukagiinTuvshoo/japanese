/**
 * QUIZ ТӨРӨЛ — тогтвортой id ба хуучин шошгын буулгалт.
 * ------------------------------------------------------------------
 * Phase 2.2-оос өмнө `QuizRecord.kind`-д тухайн хэлний ХАРУУЛАХ шошго
 * бичигддэг байсан (жишээ нь «Япон → Монгол»). Хэл солиход нэг горим хоёр
 * бүлэг болж, `QUIZ_MODES`-оос хайх үед таарахгүй байв. Одооноос зөвхөн
 * `QUIZ_MODES`-ийн id хадгална; хуучин бичлэгийг энэ модуль унших үед
 * буулгана. Танихгүй утгыг ТААМАГЛАХГҮЙ — хэвээр үлдээнэ (40 тэмдэгт хүртэл).
 */
import type { Level } from "./types";

/** Хадгалагдах боломжтой бүх тогтвортой төрлийн id (`QUIZ_MODES`-той нийцнэ). */
export const QUIZ_KIND_IDS = [
  "vocab-jp-mn",
  "vocab-mn-jp",
  "vocab-read",
  "vocab-listen",
  "vocab-fill",
  "kanji-mn",
  "kanji-read",
  "kanji-stroke",
  "grammar-mn",
  "grammar-use",
  "reading",
  "mixed",
  "weak",
  "mistakes",
] as const;

export type QuizKindId = (typeof QUIZ_KIND_IDS)[number];

/** Төрөл тодорхойгүй үед хадгалах аюулгүй утга. */
export const QUIZ_KIND_FALLBACK = "quiz";

/** Хадгалалтын дээд урт (`storage.normalizeQuizzes`-той ижил). */
const MAX_KIND_LENGTH = 40;

/**
 * Хуучин (шошготой) бичлэгийн буулгалт. Түлхүүр нь өмнөх хувилбарт
 * `logQuiz`-д дамжуулж байсан яг тэр шошго.
 */
const LEGACY_LABELS: Record<string, QuizKindId> = {
  "Япон → Монгол": "vocab-jp-mn",
  "Japanese → English": "vocab-jp-mn",
  "Монгол → Япон": "vocab-mn-jp",
  "English → Japanese": "vocab-mn-jp",
  "Уншлага": "vocab-read",
  "Reading": "vocab-read",
  "Сонсгол": "vocab-listen",
  "Listening": "vocab-listen",
  "Өгүүлбэр бөглөх": "vocab-fill",
  "Fill the blank": "vocab-fill",
  "Ханзны утга": "kanji-mn",
  "Kanji meaning": "kanji-mn",
  "Ханзны уншлага": "kanji-read",
  "Kanji reading": "kanji-read",
  "Зурлагын тоо": "kanji-stroke",
  "Stroke count": "kanji-stroke",
  "Дүрмийн утга": "grammar-mn",
  "Grammar meaning": "grammar-mn",
  "Дүрэм хэрэглээ": "grammar-use",
  "Grammar usage": "grammar-use",
  "Уншиж ойлголт": "reading",
  "Reading comprehension": "reading",
  "Холимог": "mixed",
  "Mixed": "mixed",
  "Сул тал": "weak",
  "Weak points": "weak",
  "Алдааны дэвтэр": "mistakes",
  "Mistake log": "mistakes",
};

/** Нэгтгэсэн горимууд — эдгээрээр «сул тал» дасгал хийхгүй (рекурсиас сэргийлнэ). */
const AGGREGATE_KINDS: ReadonlySet<string> = new Set(["mixed", "weak", "mistakes"]);

/** Тогтвортой id мөн эсэх. */
export function isQuizKindId(value: string): value is QuizKindId {
  return (QUIZ_KIND_IDS as readonly string[]).includes(value);
}

/** `weak` горимд дасгал хийж болох тодорхой төрөл мөн эсэх. */
export function isDrillKind(value: string): boolean {
  return isQuizKindId(value) && !AGGREGATE_KINDS.has(value);
}

/**
 * Хадгалуулах төрлийн утгыг тогтвортой id болгоно. Мэдэгдэх шошгыг id руу
 * буулгаж, танихгүй утгыг хөндөхгүй (trim + 40 тэмдэгт). Idempotent.
 */
export function quizKindOf(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return QUIZ_KIND_FALLBACK;
  const id = LEGACY_LABELS[text] ?? text;
  return id.slice(0, MAX_KIND_LENGTH);
}

/** Ямар нэг зүйл quiz түүхэнд бичигдэх эсэх — зөвхөн тодорхой заасан үед. */
export function quizLogTarget(
  log: { kind: string; level: Level } | undefined,
): { kind: string; level: Level } | null {
  if (!log) return null;
  return { kind: quizKindOf(log.kind), level: log.level };
}
