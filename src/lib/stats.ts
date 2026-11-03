/**
 * СТАТИСТИК — бүх тоо нэг эх сурвалжаас, нэг дүрмээр.
 * ------------------------------------------------------------------
 * UI болон Progress хуудас өөр өөрөөр бодож "зөрчилдсөн статистик"
 * үүсгэхээс сэргийлж, бүх тооцоог энд цуглуулав. Бүгд цэвэр функц.
 */
import type { ActivityDay, ExamRecord, QuizRecord } from "./doc";
import { isDrillKind, isLegacyExamKind } from "./quizKind";

/** «Сул тал» бодох нэгдсэн цонх — бүх дуудагч ижил дүрэм ашиглана. */
export const WEAK_WINDOW = 30;
/** Бүлэг «сул» гэж тооцогдох хамгийн бага асуултын тоо. */
export const WEAK_MIN_QUESTIONS = 5;
/** Үүнээс дээш нарийвчлалтай бүлэг «сул тал»-д орохгүй (70%). */
export const WEAK_MAX_ACCURACY = 0.7;

export interface WeakOptions {
  /** Хамгийн сүүлийн хэдэн бичлэгийг тоолох (0 = бүгд). */
  window?: number;
  /** Бүлэгт шаардах хамгийн бага асуулт. */
  minQuestions?: number;
  /** Хэдэн мөр буцаах (0/undefined = бүгд). */
  limit?: number;
  /** «Сул» гэж үзэх дээд нарийвчлал (зөвхөн `weakKinds`). */
  maxAccuracy?: number;
}

/** 0..1 нарийвчлал. `total` 0 бол 0; `correct > total` бол 100%-д хязгаарлана. */
export function accuracy(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, correct) / total);
}

/** Өдрийн нарийвчлал — өгөгдөл байхгүй бол `null` (0% биш). */
export function dayAccuracy(day: ActivityDay | undefined): number | null {
  if (!day || day.total <= 0) return null;
  return accuracy(day.correct, day.total);
}

export interface GroupAccuracy {
  /** Дасгалын төрөл эсвэл шалгалтын хэсгийн нэр. */
  kind: string;
  correct: number;
  total: number;
  accuracy: number;
}

function group(rows: { kind: string; correct: number; total: number }[]): GroupAccuracy[] {
  const map = new Map<string, { correct: number; total: number }>();
  for (const r of rows) {
    if (!r || r.total <= 0) continue;
    const cur = map.get(r.kind) ?? { correct: 0, total: 0 };
    cur.correct += Math.min(Math.max(0, r.correct), r.total);
    cur.total += r.total;
    map.set(r.kind, cur);
  }
  return [...map.entries()]
    .map(([kind, v]) => ({ kind, correct: v.correct, total: v.total, accuracy: accuracy(v.correct, v.total) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

/** Дасгалын төрлөөр (vocab-jp-mn, kanji-read, reading …) сул тал. */
export function kindAccuracy(quizzes: QuizRecord[]): GroupAccuracy[] {
  return group(quizzes.map((q) => ({ kind: q.kind, correct: q.correct, total: q.total })));
}

/** Шалгалтын хэсгээр (Хэлний мэдлэг, Уншлага, Сонсгол) сул тал. */
export function examSectionAccuracy(exams: ExamRecord[]): GroupAccuracy[] {
  return group(exams.flatMap((e) => (e.sections ?? []).map((s) => ({ kind: s.name, correct: s.correct, total: s.total }))));
}

/**
 * "Сул төрөл" — ЗӨВХӨН дасгалын бичлэгээс, дасгал хийж болох тодорхой
 * горимоор. Home, Quiz болон «сул талаар дасгал» НЭГ энэ тооцоог ашиглана.
 * Нэгтгэсэн горим (mixed/weak/mistakes) болон хуучин шошготой мөрүүд
 * (жишээ нь шалгалтын гарчиг) энд орохгүй — тэдгээрээр дасгал хийх боломжгүй.
 */
export function weakKinds(quizzes: QuizRecord[], opts: WeakOptions = {}): GroupAccuracy[] {
  const window = opts.window ?? WEAK_WINDOW;
  const minQuestions = opts.minQuestions ?? WEAK_MIN_QUESTIONS;
  const maxAccuracy = opts.maxAccuracy ?? WEAK_MAX_ACCURACY;
  const recent = window > 0 ? quizzes.slice(0, window) : quizzes;
  const rows = kindAccuracy(recent).filter(
    (r) => isDrillKind(r.kind) && r.total >= minQuestions && r.accuracy < maxAccuracy,
  );
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

/**
 * "Сул тал" нэгдсэн жагсаалт — дасгал ба шалгалтын хэсгүүдийг хамт,
 * хамгийн сулаас эхлэн. Цонх болон доод хязгаар нь `weakKinds`-тэй ижил
 * (`WEAK_WINDOW`, `WEAK_MIN_QUESTIONS`) тул Home, Quiz, Progress нийцнэ.
 */
export function weakestAreas(
  quizzes: QuizRecord[],
  exams: ExamRecord[],
  opts: WeakOptions = {},
): GroupAccuracy[] {
  const window = opts.window ?? WEAK_WINDOW;
  const minQuestions = opts.minQuestions ?? WEAK_MIN_QUESTIONS;
  const recent = window > 0 ? quizzes.slice(0, window) : quizzes;
  // Хуучин MockExam-ийн quiz мөр нь `doc.exams`-ийн хэсгийн хуулбар — давхар бүү тоол.
  const drillRows = kindAccuracy(recent).filter((g) => !isLegacyExamKind(g.kind));
  const merged = new Map<string, { correct: number; total: number }>();
  for (const g of [...drillRows, ...examSectionAccuracy(exams)]) {
    const cur = merged.get(g.kind) ?? { correct: 0, total: 0 };
    cur.correct += g.correct;
    cur.total += g.total;
    merged.set(g.kind, cur);
  }
  const rows = [...merged.entries()]
    .filter(([, v]) => v.total >= minQuestions)
    .map(([kind, v]) => ({ kind, correct: v.correct, total: v.total, accuracy: accuracy(v.correct, v.total) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}
