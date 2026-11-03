/**
 * SRS — ДАВТАН СУРАХ ХӨДӨЛГҮҮР
 * ------------------------------------------------------------------
 * Суурь нь FSRS/Anki-гийн зарчим: карт бүр тогтвортой байдал (stability),
 * хүндрэл (difficulty), сэргээх магадлал (retrievability) гэсэн 3
 * параметртэй. Интервалыг тэдгээрээс бодож гаргана.
 *
 *   Again (0) → алдсан    → 10 мин (relearning), тогтвортой байдал огцом буурна
 *   Hard  (1) → хүнд      → шинэ картад 10 мин, дараа нь ~1 өдөр
 *   Good  (2) → хэвийн    → хуваарь ёсоор (шинэ картад 1 өдөр)
 *   Easy  (3) → амархан   → огцом урт (шинэ картад ~3 өдөр)
 *
 * Дээд хязгаар: MAX_INTERVAL_DAYS (365 хоног). Fuzz нь зөвхөн 3+ хоногийн
 * интервалд, зөвхөн зөв хариултад, карт бүрд тогтмол (deterministic) байна —
 * ингэснээр урьдчилсан харуулсан хугацаа бодит хуваарьтайгаа яг таарна.
 *
 * Зөвхөн интервал хадгалахаас гадна retention / accuracy / confidence /
 * forgetting rate-ыг тооцоолж, сул үгсийг автоматаар илрүүлнэ.
 */

export type Grade = 0 | 1 | 2 | 3;

export const GRADES: { g: Grade; mn: string; en: string; jp: string; tone: string }[] = [
  { g: 0, mn: "Дахин", en: "Again", jp: "もう一度", tone: "shu" },
  { g: 1, mn: "Хүнд", en: "Hard", jp: "難しい", tone: "kin" },
  { g: 2, mn: "Хэвийн", en: "Good", jp: "できた", tone: "matcha" },
  { g: 3, mn: "Амархан", en: "Easy", jp: "簡単", tone: "ai" },
];

export interface Card {
  /** Дараагийн давталтын цаг (epoch ms). */
  due: number;
  /** Тогтвортой байдал — өдрөөр. Хэдий их байх тусам мартах нь удаан. */
  st: number;
  /** Хүндрэл 1..10. */
  df: number;
  /** Нийт давталт. */
  n: number;
  /** Алдсан тоо. */
  l: number;
  /** Сүүлийн давталтын цаг. */
  last: number;
  /** SRS төлөв. */
  ph: "new" | "learning" | "review" | "relearn";
  /** Дараалсан зөв хариулт. */
  streak: number;
  /** Сүүлийн үнэлгээний түүх (хамгийн ихдээ 12). */
  h: number[];
}

const MIN = 60_000;
const DAY = 86_400_000;

/** Давталтын интервалын дээд хязгаар (хоног). */
export const MAX_INTERVAL_DAYS = 365;
/** «Again» дарахад буцах богино алхам (минут). */
export const RELEARN_MIN = 10;
/** Fuzz зөвхөн энэ хэмжээнээс урт интервалд хэрэглэгдэнэ (хоног). */
const FUZZ_MIN_DAYS = 3;

const DF_DELTA: Record<Grade, number> = { 0: 1.35, 1: 0.35, 2: -0.15, 3: -0.7 };
const ST_FIRST: Record<Grade, number> = { 0: 0.15, 1: 0.6, 2: 1.4, 3: 3.2 };
const ST_BOOST: Record<Grade, number> = { 0: 1, 1: 1.18, 2: 2.35, 3: 3.6 };

export interface ScheduleOptions {
  /** Цаг (тест болон preview-д тогтмол болгоход). */
  now?: number;
}

/** Тогтмол 0..1 утга — ижил оролтод үргэлж ижил (Math.random биш). */
function hash32(parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h = (h ^ (p | 0)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/**
 * ±5% fuzz — карт бүрд тогтмол. Оролт нь зөвхөн тухайн картын өөрийн төлөв
 * тул preview болон бодит үнэлгээ ижил интервал гаргана.
 */
function fuzzFactor(prev: Card | undefined, g: Grade): number {
  const seed = hash32([
    (prev?.n ?? 0) * 7919,
    Math.floor((prev?.last ?? 0) / MIN),
    Math.round((prev?.st ?? 0) * 1000),
    g * 104_729,
  ]);
  return 0.95 + seed * 0.1;
}

export const newCard = (): Card => ({
  due: 0, st: 0, df: 5, n: 0, l: 0, last: 0, ph: "new", streak: 0, h: [],
});

/** Хугацаа дууссан эсэх. */
export const isDue = (c: Card) => c.due <= Date.now();

/**
 * «Эзэмшсэн» — SRS-ийн ЦОРЫН НЭГ тодорхойлолт.
 * Тогтвортой байдал (st ≥ 21) ба дараалсан зөв хариулт (streak ≥ 3) хоёулаа шаардлагатай.
 * cardStage, memoryStats, store-ийн амжилт, Vocabulary/Kanji шүүлт бүгд үүнийг ашиглана.
 */
export function isMastered(c: Card | undefined): boolean {
  return !!c && c.st >= 21 && c.streak >= 3;
}

/** Хугацаа дууссан картууд, хамгийн яаралтай нь эхэндээ. */
export function dueCards(srs: Record<string, Card>) {
  return Object.entries(srs)
    .filter(([, c]) => c.ph !== "new" && isDue(c))
    .sort((a, b) => a[1].due - b[1].due);
}

/**
 * Загварчилсан сэргээх магадлал: R = exp(-t / S).
 * t = сүүлийн давталтаас хойш өнгөрсөн өдөр, S = тогтвортой байдал.
 */
export function retrievability(c: Card, at = Date.now()) {
  if (!c.last || !c.st) return 0;
  const t = Math.max(0, (at - c.last) / DAY);
  return Math.exp(-t / c.st);
}

/**
 * Шинэ төлөв бодох.
 * @param prev өмнөх карт (байхгүй бол шинэ)
 * @param g үнэлгээ
 */
export function schedule(prev: Card | undefined, g: Grade, opts: ScheduleOptions = {}): Card {
  const now = opts.now ?? Date.now();
  const c: Card = prev ? { ...prev } : newCard();
  const prevPhase = c.ph;
  const wasNew = prevPhase === "new";
  const wasGraduated = prevPhase === "review";

  c.n += 1;
  c.last = now;
  c.h = [...c.h, g].slice(-12);
  c.df = Math.min(10, Math.max(1, c.df + DF_DELTA[g]));

  /* ── Again: үргэлж богино relearning алхам. Fuzz хэрэглэхгүй. ── */
  if (g === 0) {
    // Нэг удаагийн алдалт = нэг lapse. Relearning дотор дахин «Again»
    // дарахад lapse дахин нэмэгдэхгүй (Anki-гийн зан төлөв).
    if (wasGraduated) c.l += 1;
    c.streak = 0;
    c.st = wasNew ? ST_FIRST[0] : Math.max(0.15, c.st * 0.35);
    c.ph = wasNew || prevPhase === "learning" ? "learning" : "relearn";
    c.due = now + RELEARN_MIN * MIN;
    return c;
  }

  /* ── тогтвортой байдал ── */
  if (wasNew || prevPhase === "learning" || prevPhase === "relearn" || c.st < 0.5) {
    c.st = ST_FIRST[g];
  } else {
    const hardPenalty = 1 - (c.df - 1) * 0.035;
    // Дээд хязгаар: интервал 365 хоногоос хэтрэхгүй тул үүнээс том st-д утгагүй.
    c.st = Math.min(MAX_INTERVAL_DAYS, Math.max(0.6, c.st * ST_BOOST[g] * hardPenalty));
  }
  c.streak = (c.streak ?? 0) + 1;
  c.ph = "review";

  /* ── интервал ── */
  // Шинэ картын эхний «Хүнд» — Anki шиг богино алхам.
  if (c.n === 1 && g === 1) {
    c.due = now + 10 * MIN;
    return c;
  }

  let days = c.n <= 2 && g === 1 ? 1 : Math.max(1, Math.round(c.st));
  if (days >= FUZZ_MIN_DAYS) days = Math.max(1, Math.round(days * fuzzFactor(prev, g)));
  days = Math.min(MAX_INTERVAL_DAYS, days);
  c.due = now + days * DAY;
  return c;
}

/** Хүний ойлгох хэлбэрээр дараагийн давталт. */
export function intervalLabel(c: Card, language: "mn" | "en" = "mn") {
  const ms = c.due - Date.now();
  if (ms <= 0) return language === "en" ? "now" : "одоо";
  const min = ms / MIN;
  if (min < 60) return language === "en" ? `${Math.round(min)} min` : `${Math.round(min)} мин`;
  const d = ms / DAY;
  if (d < 1) return language === "en" ? `${Math.round(d * 24)} h` : `${Math.round(d * 24)} цаг`;
  if (d < 30) return language === "en" ? `${Math.round(d)} d` : `${Math.round(d)} өдөр`;
  if (d < 365) return language === "en" ? `${(d / 30).toFixed(1)} mo` : `${(d / 30).toFixed(1)} сар`;
  return language === "en" ? `${(d / 365).toFixed(1)} y` : `${(d / 365).toFixed(1)} жил`;
}

/** Хэрэглэгчид дараагийн үнэлгээ бүрт ямар интервал гарахыг урьдчилан харуулна. */
export function previewIntervals(
  prev: Card | undefined,
  language: "mn" | "en" = "mn",
  opts: ScheduleOptions = {},
) {
  const now = opts.now ?? Date.now();
  // Бүх үнэлгээг нэг цаг дээр бодно — render бүрд ижил хариу гарна.
  return ([0, 1, 2, 3] as Grade[]).map((g) => ({ g, label: intervalLabel(schedule(prev, g, { now }), language) }));
}

/* ─────────────── Санах ойн шинжилгээ ─────────────── */

export interface MemoryStats {
  reviews: number;
  lapses: number;
  accuracy: number;        // 0..1
  retention: number;       // 0..1 — одоогийн сэргээх дундаж магадлал
  forgettingRate: number;  // 0..1 — 7 хоногт алдсан хувь
  confidence: number;      // 0..1 — тогтвортой байдал ба цуваанаас
  mastered: number;
  learning: number;
  fresh: number;
  mature: number;
}

export function memoryStats(srs: Record<string, Card>): MemoryStats {
  const cards = Object.values(srs);
  const reviews = cards.reduce((a, c) => a + c.n, 0);
  const lapses = cards.reduce((a, c) => a + c.l, 0);
  const correct = cards.reduce((a, c) => a + c.h.filter((x) => x > 0).length, 0);
  const total = cards.reduce((a, c) => a + c.h.length, 0);
  const seen = cards.filter((c) => c.n > 0);
  const retention = seen.length ? seen.reduce((a, c) => a + retrievability(c), 0) / seen.length : 0;
  const recentLapses = cards.reduce((a, c) => a + c.h.filter((x) => x === 0).length, 0);

  const mastered = cards.filter(isMastered).length;
  const mature = cards.filter((c) => c.st >= 21).length;
  const learning = cards.filter((c) => c.ph === "learning" || c.ph === "relearn").length;
  const fresh = cards.filter((c) => c.ph === "new").length;

  const confRaw = seen.length
    ? seen.reduce((a, c) => a + Math.min(1, c.st / 30) * 0.7 + Math.min(1, c.streak / 5) * 0.3, 0) / seen.length
    : 0;

  return {
    reviews,
    lapses,
    accuracy: total ? correct / total : 0,
    retention,
    forgettingRate: total ? recentLapses / total : 0,
    confidence: confRaw,
    mastered,
    mature,
    learning,
    fresh,
  };
}

/** Сургалтын төлөв — SRS-ийн 4 шат. */
export function cardStage(c: Card | undefined): { id: string; mn: string; en: string; tone: string; pct: number } {
  if (!c || c.ph === "new") return { id: "new", mn: "Шинэ", en: "New", tone: "sumi", pct: 8 };
  if (c.ph === "learning" || c.ph === "relearn") return { id: "learning", mn: "Суралцаж байна", en: "Learning", tone: "kin", pct: 35 };
  if (isMastered(c)) return { id: "mastered", mn: "Эзэмшсэн", en: "Mastered", tone: "matcha", pct: 100 };
  return { id: "review", mn: "Давталт", en: "Review", tone: "ai", pct: 68 };
}

/** Хугацааны муж дахь давталтын тоо — графикт. */
export function reviewHistory(srs: Record<string, Card>, days = 30) {
  const out = Array.from({ length: days }, (_, i) => ({ day: days - 1 - i, n: 0, l: 0 }));
  const now = Date.now();
  for (const c of Object.values(srs)) {
    const d = Math.floor((now - c.last) / 86_400_000);
    if (d >= 0 && d < days) {
      out[days - 1 - d].n += c.n;
      out[days - 1 - d].l += c.l;
    }
  }
  return out;
}
