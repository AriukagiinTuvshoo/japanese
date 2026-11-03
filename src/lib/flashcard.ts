/**
 * FLASHCARD — 2 төлөвт үнэлгээ ба нэг картын бүртгэл
 * ------------------------------------------------------------------
 * Шинэ SRS алгоритм биш: «мэднэ / мэдэхгүй» гэсэн хоёр товчийг одоогийн
 * `schedule()`-ийн Good (2) ба Again (0) руу буулгана. Ингэснээр ханз, үг
 * хоёулаа ижил `doc.srs` цөм, ижил XP, ижил өдрийн бүртгэлтэй ажиллана.
 *
 * `applyGrade()` нь store-ийн `grade()` action-ыг React-гүйгээр тестлэх
 * боломжтой болгохын тулд салангид, цэвэр функц байна.
 */
import { emptyDay, type ActivityDay, type Doc } from "./doc";
import { XP } from "./gamification";
import { schedule, type Card, type Grade } from "./srs";
import { todayKey } from "./text";

/** Хоёр товчны утга — Again (0) ба Good (2). */
export const BINARY_GRADE = { unknown: 0, know: 2 } as const;

export type BinaryAnswer = keyof typeof BINARY_GRADE;

export const binaryToGrade = (a: BinaryAnswer): Grade => BINARY_GRADE[a];

/** Берен үнэлгээний XP — шинэ картын урамшуулал нэг л удаа нэмэгдэнэ. */
export function reviewXP(g: Grade, isNew = false): number {
  return [XP.reviewAgain, XP.reviewHard, XP.reviewGood, XP.reviewEasy][g] + (isNew ? XP.newCard : 0);
}

export interface GradeOptions {
  /** Энэ карт өмнө нь хийгдээгүй бол `true`. */
  isNew?: boolean;
  /** Тестэд цагийг тогтмол болгох. */
  now?: number;
}

/**
 * Давхар үнэлгээг таних цонх (мс).
 * Дэлгэрэнгүй хуудас, нүүр хуудасны товчийг давхар дарахад нэг карт
 * хоёр удаа үнэлэгдэж, SRS интервал ба XP хоёулаа буруу өсдөг байв.
 * `Session` дээр `makeOnce()` байсан ч бусад урсгал хамгаалалтгүй байсан тул
 * хамгаалалтыг домэйн түвшинд (энэ функц) төвлөрүүлэв.
 */
export const GRADE_REPEAT_WINDOW_MS = 1000;

/**
 * Энэ карт саяхан (цонх дотор) үнэлэгдсэн үү — өөрөөр хэлбэл дараагийн
 * дуудалт нь давхар даралт уу. Хадгалсан картын `last`-аас л шийднэ.
 */
export function isRepeatGrade(card: Card | undefined, now = Date.now()): boolean {
  if (!card || !card.n || !card.last) return false;
  const delta = now - card.last;
  return delta >= 0 && delta < GRADE_REPEAT_WINDOW_MS;
}

/**
 * Нэг картын үнэлгээг бүртгэнэ: SRS төлөв, нийт XP, өдрийн үзүүлэлт.
 * Функц нь цэвэр — ижил оролтод ижил гаралт буцаана. Давхар даралтыг
 * `isRepeatGrade`-ээр шүүж, ижил баримтыг буцаана (юу ч нэмэгдэхгүй).
 */
export function applyGrade(doc: Doc, id: string, g: Grade, opts: GradeOptions = {}): Doc {
  const now = opts.now ?? Date.now();
  if (isRepeatGrade(doc.srs[id], now)) return doc;
  const gain = reviewXP(g, opts.isNew);
  const day = todayKey(new Date(now));
  const cur = doc.activity[day] ?? emptyDay();
  const next: ActivityDay = {
    xp: cur.xp + gain,
    min: cur.min,
    newCards: cur.newCards + (opts.isNew ? 1 : 0),
    reviews: cur.reviews + 1,
    correct: cur.correct + (g > 0 ? 1 : 0),
    total: cur.total + 1,
  };
  return {
    ...doc,
    srs: { ...doc.srs, [id]: schedule(doc.srs[id], g, { now }) },
    xp: doc.xp + gain,
    activity: { ...doc.activity, [day]: next },
  };
}

/**
 * Нэг картыг нэг л удаа үнэлэх session-ийн хамгаалалт.
 * Товчийг давхар дарах эсвэл `Z`/`X`-ийг давтан хүргэхэд SRS ба XP
 * давхар бүртгэгдэхээс сэргийлнэ. Домэйн тал дээр `isRepeatGrade`
 * нэмэлт хамгаалалт болно.
 */
export function makeOnce() {
  const seen = new Set<string>();
  return (key: string): boolean => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}
