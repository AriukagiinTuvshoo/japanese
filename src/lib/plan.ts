/**
 * СУРАЛЦАХ ТӨЛӨВЛӨГӨӨНИЙ ЦЭВЭР ЛОГИК (React-гүй).
 * ------------------------------------------------------------------
 * Plan хуудас ба Home-ийн өдрийн зорилго хоёулаа энэ файлыг ашиглана —
 * ингэснээр ижил өгөгдлөөс ижил тоо гарч, хоёр дэлгэц зөрөхгүй.
 *
 * Бүх тоо нь БОДИТ контентын хэмжээ (тухайн түвшний үг/ханз/дүрэм/эх/хичээл)
 * болон хэрэглэгчийн бодит ахицаас (SRS карт, бичсэн ханз, grammarDone…)
 * бодогдоно. Хиймэл curriculum үүсгэхгүй.
 */
import type { ActivityDay, Doc } from "./doc";
import type { Level } from "./types";

export type PlanType = "vocab" | "kanji" | "grammar" | "reading" | "listening";

export interface PlanContent {
  vocab: number;
  kanji: number;
  grammar: number;
  reading: number;
  listening: number;
}

export type PlanQuota = Record<PlanType, number>;
export type PlanIds = Record<PlanType, string[]>;

export interface PlanMissionItem {
  id: PlanType;
  target: number;
  done: number;
  to: string;
}

export interface PlanDay {
  day: number;
  target: PlanQuota;
  cumulative: PlanQuota;
  done: boolean;
  current: boolean;
}

export const PLAN_TYPES: PlanType[] = ["vocab", "kanji", "grammar", "reading", "listening"];
export const PLAN_MIN_DAYS = 14;
export const PLAN_MAX_DAYS = 365;
export const DEFAULT_PLAN_DAYS = 120;

/** Нэгж ажилд шаардагдах ойролцоо минут — зөвхөн тооцоолол, баталгаа биш. */
const MIN_PER_UNIT: PlanQuota = { vocab: 0.4, kanji: 1.1, grammar: 1.4, reading: 10, listening: 8 };

const DAY_MS = 86_400_000;

export const zeroQuota = (): PlanQuota => ({ vocab: 0, kanji: 0, grammar: 0, reading: 0, listening: 0 });

/** 0 эсвэл тэнэг утга нь 14–365 хоногийн хязгаарт орно. */
export function clampPlanDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_PLAN_DAYS;
  return Math.min(PLAN_MAX_DAYS, Math.max(PLAN_MIN_DAYS, Math.round(days)));
}

/** Тухайн түвшний контентыг өдрүүдэд жигд хуваана. 0 контент → 0 (даалгавар үүсэхгүй). */
export function dailyQuota(content: PlanContent, days: number): PlanQuota {
  const d = clampPlanDays(days);
  const q = (n: number) => (Number.isFinite(n) && n > 0 ? Math.ceil(n / d) : 0);
  return {
    vocab: q(content.vocab),
    kanji: q(content.kanji),
    grammar: q(content.grammar),
    reading: q(content.reading),
    listening: q(content.listening),
  };
}

/** ALP-ийн цаг тооцооноос гарсан анхдагч хугацаа (хэрэглэгч өөрөө өөрчилж болно). */
export function suggestPlanDays(minutesPerDay: number, hours: [number, number]): number {
  const per = Number.isFinite(minutesPerDay) && minutesPerDay > 0 ? minutesPerDay : 30;
  const targetMinutes = ((hours[0] + hours[1]) / 2) * 60;
  return clampPlanDays(Math.ceil(targetMinutes / per));
}

/** 1-ээс эхэлсэн өдөр; startedAt хүчингүй бол 1. */
export function currentPlanDay(startedAt: number, days: number, now = Date.now()): number {
  const d = clampPlanDays(days);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return 1;
  const raw = Math.floor((now - startedAt) / DAY_MS) + 1;
  return Math.min(d, Math.max(1, raw));
}

/**
 * Хамрагдсан (coverage) тоо — зөвхөн тухайн түвшний ID-уудыг тоолно.
 * Дараа нь дахин төлөвлөхгүйн тулд давхардлыг үгүй болгож, нэг удаа тоолно.
 */
/** Үгийн SRS ID нь `v-jm-<id>` гэх мэт угтвартай тул шууд түлхүүгээр хайж болохгүй. */
const VOCAB_PREFIXES = ["v-jm-", "v-mj-", "v-rd-", "v-ls-", "v-fb-"];

function vocabTouched(srs: Set<string>, id: string): boolean {
  if (srs.has(id)) return true;
  for (const prefix of VOCAB_PREFIXES) if (srs.has(prefix + id)) return true;
  return false;
}

export function planCoverage(
  doc: Pick<Doc, "srs" | "writing" | "grammarDone" | "readingDone" | "listeningDone">,
  ids: PlanIds,
): PlanQuota {
  const srs = new Set(Object.keys(doc.srs));
  const writing = new Set(Object.keys(doc.writing));
  const grammar = new Set(doc.grammarDone);
  const reading = new Set(doc.readingDone);
  const listening = new Set(doc.listeningDone);
  const out = zeroQuota();

  const seenVocab = new Set<string>();
  for (const id of ids.vocab) {
    if (!seenVocab.has(id) && vocabTouched(srs, id)) seenVocab.add(id);
  }
  out.vocab = seenVocab.size;
  out.kanji = new Set(ids.kanji.filter((id) => writing.has(id))).size;
  out.grammar = new Set(ids.grammar.filter((id) => grammar.has(id))).size;
  out.reading = new Set(ids.reading.filter((id) => reading.has(id))).size;
  out.listening = new Set(ids.listening.filter((id) => listening.has(id))).size;
  return out;
}

/** Бүрэн хамрагдсан өдрийн тоо (бүх хэсэг өөрийн өдрийн квотыг гүйцсэн байх ёстой). */
export function completedPlanDays(coverage: PlanQuota, quota: PlanQuota): number {
  let days = Number.POSITIVE_INFINITY;
  for (const k of PLAN_TYPES) {
    if (quota[k] <= 0) continue;
    days = Math.min(days, Math.floor(coverage[k] / quota[k]));
  }
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

/**
 * Хоцролт — өнгөрсөн (дууссан байх ёстой) өдрүүдээс дууссан өдрүүдийг хасна.
 * Эхний өдөр 0 ажил хийсэн ч хоцролт 0 — өнөөдрийг «алдсан» гэж тооцохгүй.
 */
export function planLag(day: number, doneDays: number): number {
  const elapsed = Math.max(0, Math.round(day) - 1);
  return Math.max(0, elapsed - Math.max(0, Math.round(doneDays)));
}

/** Тухайн өдрийн эцэс гэхэд хамрагдах ёстой хуримтлагдсан хэмжээ. */
export function cumulativeTarget(quota: PlanQuota, content: PlanContent, day: number): PlanQuota {
  const d = Math.max(1, Math.round(day));
  const out = zeroQuota();
  for (const k of PLAN_TYPES) out[k] = Math.min(content[k], quota[k] * d);
  return out;
}

/**
 * Өнөөдрийн бодит гүйцэтгэл. SRS-ийн «давталт» (reviews) нь ШИНЭ карт
 * (newCards) биш тул давхар тооцохгүй.
 *
 * `level` өгөгдсөн бол зөвхөн тухайн түвшний шинэ картыг тоолно — N2 план
 * идэвхтэй үед N5/N3 карт N2-ийн өдрийн явцад орохгүй. Түвшин тус бүрийн
 * тоололт (`newByLevel`) байхгүй хуучин өдрийн өгөгдлийг ямар ч түвшинд
 * таамаглаж хамааруулахгүй.
 */
export function todayFromActivity(today: ActivityDay, writingToday = 0, level?: Level): PlanQuota {
  return {
    vocab: level ? Math.max(0, today.newByLevel?.[level] ?? 0) : Math.max(0, today.newCards || 0),
    kanji: Math.max(0, writingToday || 0),
    grammar: Math.max(0, today.grammar || 0),
    reading: Math.max(0, today.reading || 0),
    listening: Math.max(0, today.listening || 0),
  };
}

const ROUTES = (level: Level): Record<PlanType, string> => ({
  vocab: `vocab?level=${level}&tab=learn`,
  kanji: `kanji?level=${level}`,
  grammar: `grammar?level=${level}`,
  reading: `reading?level=${level}`,
  listening: `listening?level=${level}`,
});

/**
 * Өнөөдрийн даалгавар: квот ба үлдсэн контентын бага нь. Контент бүрэн
 * хамрагдсан бол тухайн төрөл огт гарч ирэхгүй (дахин төлөвлөхгүй).
 */
export function planMission(opts: {
  quota: PlanQuota;
  content: PlanContent;
  coverage: PlanQuota;
  done: PlanQuota;
  level: Level;
}): PlanMissionItem[] {
  const { quota, content, coverage, done, level } = opts;
  const routes = ROUTES(level);
  const out: PlanMissionItem[] = [];
  for (const k of PLAN_TYPES) {
    const remaining = Math.max(0, content[k] - coverage[k]);
    const target = Math.min(quota[k], remaining);
    if (target <= 0) continue;
    out.push({ id: k, target, done: Math.min(target, Math.max(0, done[k])), to: routes[k] });
  }
  return out;
}

export function isDayCovered(coverage: PlanQuota, planned: PlanQuota): boolean {
  return PLAN_TYPES.every((k) => planned[k] <= 0 || coverage[k] >= planned[k]);
}

/** Одоогийн өдрөөс хойш `span` хоногийн хуваарь — зөвхөн уншина, бичихгүй. */
export function planSchedule(opts: {
  quota: PlanQuota;
  content: PlanContent;
  coverage: PlanQuota;
  day: number;
  days: number;
  span?: number;
}): PlanDay[] {
  const { quota, content, coverage, days } = opts;
  const span = Math.max(1, opts.span ?? 7);
  const from = Math.max(1, Math.round(opts.day));
  const total = clampPlanDays(days);
  const out: PlanDay[] = [];
  for (let d = from; d <= Math.min(total, from + span - 1); d++) {
    const cumulative = cumulativeTarget(quota, content, d);
    out.push({
      day: d,
      target: quota,
      cumulative,
      done: isDayCovered(coverage, cumulative),
      current: d === from,
    });
  }
  return out;
}

/** Өдрийн ачааллын ойролцоо минут (UI-д «~»-тэй харуулна). */
export function estimateMinutes(quota: PlanQuota): number {
  let total = 0;
  for (const k of PLAN_TYPES) total += quota[k] * MIN_PER_UNIT[k];
  return Math.max(1, Math.round(total));
}
