/**
 * СТАТИСТИК — бүх тоо нэг эх сурвалжаас, нэг дүрмээр.
 * ------------------------------------------------------------------
 * UI болон Progress хуудас өөр өөрөөр бодож "зөрчилдсөн статистик"
 * үүсгэхээс сэргийлж, бүх тооцоог энд цуглуулав. Бүгд цэвэр функц.
 */
import type { ActivityDay, ExamRecord, QuizRecord } from "./doc";

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
 * "Сул тал" нэгдсэн жагсаалт — дасгал ба шалгалтын хэсгүүдийг хамт,
 * хамгийн сулаас эхлэн. 3-аас цөөн асуулттай бүлэг санамсаргүй байдлаар
 * дээгүүр гарахаас сэргийлж шүүнэ.
 */
export function weakestAreas(
  quizzes: QuizRecord[],
  exams: ExamRecord[],
  minQuestions = 3,
): GroupAccuracy[] {
  const merged = new Map<string, { correct: number; total: number }>();
  for (const g of [...kindAccuracy(quizzes), ...examSectionAccuracy(exams)]) {
    const cur = merged.get(g.kind) ?? { correct: 0, total: 0 };
    cur.correct += g.correct;
    cur.total += g.total;
    merged.set(g.kind, cur);
  }
  return [...merged.entries()]
    .filter(([, v]) => v.total >= minQuestions)
    .map(([kind, v]) => ({ kind, correct: v.correct, total: v.total, accuracy: accuracy(v.correct, v.total) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}
