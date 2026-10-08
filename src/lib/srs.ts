/**
 * SRS — ДАВТАН СУРАХ ХӨДӨЛГҮҮР
 * ------------------------------------------------------------------
 * Суурь нь FSRS/Anki-гийн зарчим: карт бүр тогтвортой байдал (stability),
 * хүндрэл (difficulty), сэргээх магадлал (retrievability) гэсэн 3
 * параметртэй. Интервалыг тэдгээрээс бодож гаргана.
 *
 *   Again (0) → алдсан    → 10 мин, тогтвортой байдал огцом буурна
 *   Hard  (1) → хүнд      → ~1 өдөр, бага зэрэг өснө
 *   Good  (2) → хэвийн    → хуваарь ёсоор (эхэндээ 4 өдөр)
 *   Easy  (3) → амархан   → огцом урт (эхэндээ 12 өдөр)
 *
 * Зөвхөн интервал хадгалахаас гадна retention / accuracy / confidence /
 * forgetting rate-ыг тооцоолж, сул үгсийг автоматаар илрүүлнэ.
 */

export type Grade = 0 | 1 | 2 | 3;

export const GRADES: { g: Grade; mn: string; jp: string; tone: string }[] = [
  { g: 0, mn: "Дахин", jp: "もう一度", tone: "shu" },
  { g: 1, mn: "Хүнд", jp: "難しい", tone: "kin" },
  { g: 2, mn: "Хэвийн", jp: "できた", tone: "matcha" },
  { g: 3, mn: "Амархан", jp: "簡単", tone: "ai" },
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

export const newCard = (): Card => ({
  due: 0, st: 0, df: 5, n: 0, l: 0, last: 0, ph: "new", streak: 0, h: [],
});

/** Хугацаа дууссан эсэх. */
export const isDue = (c: Card) => c.due <= Date.now();

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
export function schedule(prev: Card | undefined, g: Grade): Card {
  const c = prev ? { ...prev } : newCard();
  const now = Date.now();
  const wasNew = c.ph === "new";

  c.n += 1;
  c.last = now;
  c.h = [...c.h, g].slice(-12);

  // ── хүндрэл ────────────────────────────────────────────────
  const dfDelta = { 0: 1.35, 1: 0.35, 2: -0.15, 3: -0.7 }[g];
  c.df = Math.min(10, Math.max(1, c.df + dfDelta));

  // ── тогтвортой байдал ──────────────────────────────────────
  if (wasNew || c.ph === "learning" || c.ph === "relearn" || c.st < 0.5) {
    c.st = { 0: 0.15, 1: 0.6, 2: 1.4, 3: 3.2 }[g];
  } else if (g === 0) {
    c.l += 1;
    c.streak = 0;
    c.st = Math.max(0.15, c.st * 0.35);
  } else {
    const boost = { 1: 1.18, 2: 2.35, 3: 3.6 }[g];
    const hardPenalty = 1 - (c.df - 1) * 0.035;
    c.st = Math.max(0.6, c.st * boost * hardPenalty);
  }

  // ── төлөв ба интервал ──────────────────────────────────────
  if (g === 0) {
    c.ph = c.n > 1 ? "relearn" : "learning";
    c.streak = 0;
    c.due = now + 10 * MIN;
  } else {
    c.streak = (c.streak ?? 0) + 1;
    c.ph = "review";
    // Анхны суралцах үед Anki шиг богино алхмууд
    if (c.n === 1 && g === 1) c.due = now + 10 * MIN;
    else if (c.n <= 2 && g === 1) c.due = now + DAY;
    else c.due = now + Math.max(1, Math.round(c.st)) * DAY;
  }

  // Fuzz: нэг өдөрт хэт олон карт хуримтлагдахаас сэргийлнэ (±5%)
  if (c.st > 3) {
    const fuzz = 1 + (Math.random() - 0.5) * 0.1;
    c.due = now + Math.max(1, Math.round(c.st * fuzz)) * DAY;
  }

  return c;
}

/** Хүний ойлгох хэлбэрээр дараагийн давталт. */
export function intervalLabel(c: Card) {
  const ms = c.due - Date.now();
  if (ms <= 0) return "одоо";
  const min = ms / MIN;
  if (min < 60) return `${Math.round(min)} мин`;
  const d = ms / DAY;
  if (d < 1) return `${Math.round(d * 24)} цаг`;
  if (d < 30) return `${Math.round(d)} өдөр`;
  if (d < 365) return `${(d / 30).toFixed(1)} сар`;
  return `${(d / 365).toFixed(1)} жил`;
}

/** Хэрэглэгчид дараагийн үнэлгээ бүрт ямар интервал гарахыг урьдчилан харуулна. */
export function previewIntervals(prev: Card | undefined) {
  return ([0, 1, 2, 3] as Grade[]).map((g) => ({ g, label: intervalLabel(schedule(prev, g)) }));
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

  const mastered = cards.filter((c) => c.st >= 21 && c.streak >= 3).length;
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
export function cardStage(c: Card | undefined): { id: string; mn: string; tone: string; pct: number } {
  if (!c || c.ph === "new") return { id: "new", mn: "Шинэ", tone: "sumi", pct: 8 };
  if (c.ph === "learning" || c.ph === "relearn") return { id: "learning", mn: "Суралцаж байна", tone: "kin", pct: 35 };
  if (c.st >= 21 && c.streak >= 3) return { id: "mastered", mn: "Эзэмшсэн", tone: "matcha", pct: 100 };
  return { id: "review", mn: "Давталт", tone: "ai", pct: 68 };
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
