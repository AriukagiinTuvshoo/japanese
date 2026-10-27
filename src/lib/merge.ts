/**
 * mergeDocs — хоёр төхөөрөмжийн баримтыг нэгтгэх ТОГООЛГОО.
 * ------------------------------------------------------------------
 * Цэвэр функц: I/O үгүй, давтагдсан дуудалт (idempotent), эгчилж зэргэлзэхгүй
 * (commutative) — property тестүүд 500+ санамсаргүй тохиолдолоор баталгаажуулна.
 *
 * Дүрмийн бүрэн жагсаалт: docs/SYNC.md. Товч:
 *   · profile   → тал бүрээрх LWW (profileTs), тэгш бол canon() JSON-оор
 *   · srs карт  → `last` илүү их; тэгш бол `n` их; тэгш бол canon()
 *   · counters  → xp/activity төхөөрөмж бүрийн хувь нэмрийг НЭМНЭ (max биш!)
 *   · статик    → union (favorites, done lists, exams, achievements)
 *   · устгасан  → `tomb` тэмдэг нэгдсэн; устгасан зүйл дахин сэргэхгүй
 *   · цагийн зөрүү → now+24ц-ээс хойш цагийг now-руу шахна
 *   · хүчинтэй бус remote → local-ыг хэвээр үлдээнэ (sync ч мөн адил)
 */
import type { ActivityDay, Doc, ExamRecord, Mistake, Profile, QuizRecord } from "./store";
import type { Card } from "./srs";
import { DEFAULT_PROFILE, freshDoc, validateDoc } from "./storage";

export const SKEW_MS = 24 * 3600_000;
const HISTORY_CAP = 12;

export interface MergeOptions {
  now?: number;
}

export interface MergeResult {
  doc: Doc;
  /** аль талын баримт хүчинтэй байсаныг хэлнэ (мэдэгдэлд хэрэгтэй) */
  remoteOk: boolean;
  localOk: boolean;
  /** мөн үү? (бодит өөрчлөлтгүйгээр merge хийсэн үед) */
  changed: boolean;
}

/* ─────────────── туслах ─────────────── */

/** Эгчилж зэргэлзэхгүй JSON (key-г эрэмбэлж бичнэ) — тэгш зэрэгцээд тогтооно. */
export function canon(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

const cmp = (a: unknown, b: unknown) => (canon(a) < canon(b) ? -1 : canon(a) > canon(b) ? 1 : 0);

function clampTs(t: unknown, now: number): number {
  return typeof t === "number" && Number.isFinite(t) && t <= now + SKEW_MS ? t : now;
}

/** `a` ба `b`-ээс илүү их цагтайг (тэгш бол canon-аар ихийг) авна. */
function pickLater<T>(a: T, b: T, ts: (x: T) => number, now: number): T {
  const ta = clampTs(ts(a), now);
  const tb = clampTs(ts(b), now);
  if (ta !== tb) return ta > tb ? a : b;
  return cmp(a, b) >= 0 ? a : b;
}

/* ─────────────── дүрмүүд ─────────────── */

interface Part { xp: number; min: number; newCards: number; reviews: number; correct: number; total: number }

const emptyPart = (): Part => ({ xp: 0, min: 0, newCards: 0, reviews: 0, correct: 0, total: 0 });

const maxPart = (a: Part, b: Part): Part => ({
  xp: Math.max(a.xp, b.xp), min: Math.max(a.min, b.min), newCards: Math.max(a.newCards, b.newCards),
  reviews: Math.max(a.reviews, b.reviews), correct: Math.max(a.correct, b.correct), total: Math.max(a.total, b.total),
});

const addPart = (a: Part, b: Part): Part => ({
  xp: a.xp + b.xp, min: a.min + b.min, newCards: a.newCards + b.newCards,
  reviews: a.reviews + b.reviews, correct: a.correct + b.correct, total: a.total + b.total,
});

const sumParts = (parts: Record<string, Part>): Part =>
  Object.values(parts).reduce((acc, p) => addPart(acc, p), emptyPart());

/** Төхөөрөмж бүрийн хувь нэмрийг нэгтгэх: тэгш max, legacy нь хоёр талын max. */
function mergeParts(
  a: Record<string, Part>, legacyA: Part | null,
  b: Record<string, Part>, legacyB: Part | null,
): { parts: Record<string, Part>; legacy: Part | null } {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const parts: Record<string, Part> = {};
  for (const k of keys) {
    const inA = a[k];
    const inB = b[k];
    parts[k] = inA && inB ? maxPart(inA, inB) : (inA ?? inB);
  }
  let legacy: Part | null = null;
  if (legacyA && legacyB) legacy = maxPart(legacyA, legacyB);
  else legacy = legacyA ?? legacyB;
  return { parts, legacy };
}

function splitSide(doc: Doc) {
  const xpParts = (doc.xpParts ?? {}) as Record<string, number>;
  const legacyXp = Object.keys(xpParts).length ? Math.max(0, doc.xp - Object.values(xpParts).reduce((a, b) => a + b, 0)) : doc.xp;
  return { xpParts, legacyXp };
}

function mergeXp(a: Doc, b: Doc): { xp: number; xpParts: Record<string, number> } {
  const A = splitSide(a);
  const B = splitSide(b);
  const parts: Record<string, number> = {};
  for (const k of new Set([...Object.keys(A.xpParts), ...Object.keys(B.xpParts)])) {
    parts[k] = Math.max(A.xpParts[k] ?? 0, B.xpParts[k] ?? 0);
  }
  const legacy = Math.max(A.legacyXp, B.legacyXp);
  return { xp: Object.values(parts).reduce((s, n) => s + n, 0) + legacy, xpParts: parts };
}

function unionSorted(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

function mergeProfile(a: Doc, b: Doc, now: number): { profile: Profile; profileTs: Partial<Record<keyof Profile, number>> } {
  const profile = { ...a.profile } as Profile;
  const profileTs: Partial<Record<keyof Profile, number>> = { ...(a.profileTs ?? {}) };
  const keys = [...new Set([...Object.keys(a.profile), ...Object.keys(b.profile)])].sort() as (keyof Profile)[];
  for (const key of keys) {
    const valA = (a.profile[key] ?? DEFAULT_PROFILE[key]) as Profile[keyof Profile];
    const valB = (b.profile[key] ?? DEFAULT_PROFILE[key]) as Profile[keyof Profile];
    const tsA = clampTs((a.profileTs?.[key] ?? a.updatedAt), now);
    const tsB = clampTs((b.profileTs?.[key] ?? b.updatedAt), now);
    let winner: Profile[keyof Profile];
    if (tsA !== tsB) winner = tsA > tsB ? valA : valB;
    else winner = cmp(valA, valB) >= 0 ? valA : valB;
    (profile as unknown as Record<string, unknown>)[key] = winner;
    profileTs[key] = Math.max(tsA, tsB);
  }
  // тал бүр байна гэж үзэн шинэчилнэ
  return { profile, profileTs };
}

function mergeCards(a: Doc["srs"], b: Doc["srs"], now: number): Doc["srs"] {
  /**
   * Хожиогүй талбаруудаас бүрдэх тогтоох түлхүүр: max-аар нэгтгэдэг нь
   * (`n`/`l`/`st`) түүнийг өөрчилдөггүй тул дараагийн merge-д эрэмбэ хэвээр
   * үлдэнэ (property тестэд associativity-г хадгална).
   */
  const proj = (c: Card) => canon({ due: c.due, df: c.df, ph: c.ph, streak: c.streak, h: c.h });
  const out: Doc["srs"] = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ca = a[id];
    const cb = b[id];
    if (!ca) { out[id] = cb; continue; }
    if (!cb) { out[id] = ca; continue; }

    // Эрэмбэ: `last` илүү их → `n` илүү их → proj canon их (симметрик, тогтмол).
    const order = (x: Card, y: Card): number =>
      clampTs(x.last, now) - clampTs(y.last, now) || x.n - y.n || (proj(x) > proj(y) ? 1 : proj(x) < proj(y) ? -1 : 0);
    const winner = order(ca, cb) >= 0 ? ca : cb;

    out[id] = {
      ...winner,
      // дүн хэзээ ч буурахгүй (ажил алдахгүй)
      n: Math.max(ca.n, cb.n),
      l: Math.max(ca.l, cb.l),
      st: Math.max(ca.st, cb.st),
      // түүх: цагийн мөргүй тул хожсон талынх (docs/SYNC.md §2)
      h: winner.h.slice(0, HISTORY_CAP),
    };
  }
  return out;
}

function mergeMistakes(a: Mistake[], b: Mistake[], tomb: Record<string, number>, now: number): Mistake[] {
  const byId = new Map<string, Mistake>();
  for (const m of [...a, ...b]) {
    const prev = byId.get(m.id);
    if (!prev) { byId.set(m.id, { ...m }); continue; }
    const winner = pickLater(prev, m, (x) => x.at, now);
    byId.set(m.id, { ...winner, count: Math.max(prev.count, m.count) });
  }
  return [...byId.values()]
    .filter((m) => !isTombstoned(tomb, `mistake:${m.id}`, m.at))
    .sort((x, y) => (x.at === y.at ? cmp(x.id, y.id) : y.at - x.at));
}

function mergeExams(a: ExamRecord[], b: ExamRecord[], now: number): ExamRecord[] {
  const byKey = new Map<string, ExamRecord>();
  for (const e of [...a, ...b]) {
    const key = e.id || String(e.at);
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, { ...e }); continue; }
    byKey.set(key, pickLater(prev, e, (x) => x.at, now));
  }
  return [...byKey.values()].sort((x, y) => y.at - x.at);
}

function mergeQuizzes(a: QuizRecord[], b: QuizRecord[], now: number): QuizRecord[] {
  const byKey = new Map<string, QuizRecord>();
  for (const q of [...a, ...b]) {
    const key = `${q.at}|${q.kind}|${q.level}|${q.correct}|${q.total}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, { ...q }); continue; }
    byKey.set(key, pickLater(prev, q, (x) => x.at, now));
  }
  return [...byKey.values()].sort((x, y) => y.at - x.at);
}

/** Томбстоунд байгаа зүйл: устгасан цаг > эх талын сүүлийн цаг бол сэргэхгүй. */
export function isTombstoned(tomb: Record<string, number>, key: string, itemTs: number): boolean {
  const t = tomb[key];
  return typeof t === "number" && t >= itemTs;
}

/* ─────────────── гол функц ─────────────── */

export function mergeDocs(localRaw: unknown, remoteRaw: unknown, opts: MergeOptions = {}): MergeResult {
  const now = opts.now ?? Date.now();

  const local = validateDoc(localRaw);
  const remote = validateDoc(remoteRaw);
  const L = local.ok ? local.doc : null;
  const R = remote.ok ? remote.doc : null;

  // 1) хүчинтэй бус талыг шүүнэ — хэзээ ч устгахгүй.
  if (!L && !R) {
    return { doc: freshDoc(), remoteOk: false, localOk: false, changed: false };
  }
  if (!L && R) {
    return { doc: { ...R, updatedAt: now }, remoteOk: true, localOk: false, changed: true };
  }
  if (L && !R) {
    return { doc: { ...L, updatedAt: Math.max(L.updatedAt, now - SKEW_MS) }, remoteOk: false, localOk: true, changed: false };
  }

  const A = L!;
  const B = R!;
  const nowA = clampTs(A.updatedAt, now);
  const nowB = clampTs(B.updatedAt, now);

  const tomb: Record<string, number> = { ...(A.tomb ?? {}), ...(B.tomb ?? {}) };
  for (const k of new Set([...Object.keys(A.tomb ?? {}), ...Object.keys(B.tomb ?? {})])) {
    tomb[k] = Math.max(A.tomb?.[k] ?? 0, B.tomb?.[k] ?? 0);
  }

  const { profile, profileTs } = mergeProfile(A, B, now);
  const { xp, xpParts } = mergeXp(A, B);

  // өдрийн хувь нэмэр: тал бүрээс parts салгана → нэгтгэнэ → дүнг дахин бодно
  const activity: Record<string, ActivityDay> = {};
  const days = new Set([...Object.keys(A.activity ?? {}), ...Object.keys(B.activity ?? {})]);
  for (const day of days) {
    const da = A.activity?.[day];
    const db = B.activity?.[day];
    if (!da) { activity[day] = keepDay(db); continue; }
    if (!db) { activity[day] = keepDay(da); continue; }

    // Parts-ийн эхийг хадгалахын тулд тал бүрийн өгөгдлийг day-level-ээс салгана.
    const ca = dayContributions(da);
    const cb = dayContributions(db);
    const merged = mergeParts(ca.parts, ca.legacy, cb.parts, cb.legacy);
    const totals = addPart(sumParts(merged.parts), merged.legacy ?? emptyPart());
    activity[day] = { ...totals, parts: merged.parts };
  }

  const placement = pickLater(A.placement, B.placement, (p) => p?.at ?? 0, now);
  const curriculum = pickLater(A.curriculum, B.curriculum, (c) => c?.startedAt ?? 0, now);

  const doc: Doc = {
    v: 3,
    profile,
    profileTs,
    srs: mergeCards(A.srs ?? {}, B.srs ?? {}, now),
    writing: mergeWriting(A.writing ?? {}, B.writing ?? {}),
    mnemonics: mergeMnemonics(A.mnemonics ?? {}, B.mnemonics ?? {}),
    favorites: filteredUnion(A.favorites ?? [], B.favorites ?? [], tomb, "fav", A, B, now),
    grammarDone: filteredUnion(A.grammarDone ?? [], B.grammarDone ?? [], tomb, "grammar", A, B, now),
    readingDone: filteredUnion(A.readingDone ?? [], B.readingDone ?? [], tomb, "reading", A, B, now),
    listeningDone: filteredUnion(A.listeningDone ?? [], B.listeningDone ?? [], tomb, "listening", A, B, now),
    kanaBest: Math.max(A.kanaBest ?? 0, B.kanaBest ?? 0),
    exams: mergeExams(A.exams ?? [], B.exams ?? [], now),
    quizzes: mergeQuizzes(A.quizzes ?? [], B.quizzes ?? [], now),
    ...(placement ? { placement } : {}),
    mistakes: mergeMistakes(A.mistakes ?? [], B.mistakes ?? [], tomb, now),
    activity,
    xp,
    xpParts,
    tomb,
    achievements: mergeAchievements(A.achievements ?? {}, B.achievements ?? {}),
    ...(curriculum ? { curriculum } : {}),
    createdAt: Math.min(clampTs(A.createdAt, now) || now, clampTs(B.createdAt, now) || now),
    updatedAt: Math.max(nowA, nowB, now - SKEW_MS),
  };

  return { doc, remoteOk: true, localOk: true, changed: canon(A) !== canon(doc) };
}

/* ── дэд дүрмүүд ── */

/** Зөвхөн нэг талд байгаа өдөр: хэвээр нь үлдээнэ (түүний parts нь тэр талын хувь нэмэр). */
function keepDay(day: ActivityDay | undefined): ActivityDay {
  if (!day) return { ...emptyPart(), parts: {} };
  return { ...day, parts: day.parts ?? {} };
}

interface SideDay { parts: Record<string, Part>; legacy: Part | null }

/**
 * Өдрийн тоог тал бүрээс салгана: parts байвал тэр нь хувь нэмэр,
 * эс бөгөөс бүх дүн = legacy (хоёр талын legacy = max — давтан тоолохгүй).
 */
function dayContributions(day: ActivityDay): SideDay {
  const parts = (day.parts ?? {}) as Record<string, Part>;
  if (!Object.keys(parts).length) {
    return { parts: {}, legacy: { xp: day.xp, min: day.min, newCards: day.newCards, reviews: day.reviews, correct: day.correct, total: day.total } };
  }
  const sum = sumParts(parts);
  const legacy = {
    xp: Math.max(0, day.xp - sum.xp),
    min: Math.max(0, day.min - sum.min),
    newCards: Math.max(0, day.newCards - sum.newCards),
    reviews: Math.max(0, day.reviews - sum.reviews),
    correct: Math.max(0, day.correct - sum.correct),
    total: Math.max(0, day.total - sum.total),
  } satisfies Part;
  const has = Object.values(legacy).some((n) => n > 0);
  return { parts, legacy: has ? legacy : null };
}

function filteredUnion(a: string[], b: string[], tomb: Record<string, number>, kind: string, sideA: Doc, sideB: Doc, now: number): string[] {
  const tsOf = (side: Doc, id: string, list: string[]) => (list.includes(id) ? clampTs(side.updatedAt, now) : -1);
  return unionSorted(a, b).filter((id) => {
    const t = tomb[`${kind}:${id}`];
    if (typeof t !== "number") return true;
    const ts = Math.max(tsOf(sideA, id, a), tsOf(sideB, id, b));
    return t < ts;
  });
}

function mergeWriting(a: Doc["writing"], b: Doc["writing"]): Doc["writing"] {
  const out: Doc["writing"] = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k];
    const y = b[k];
    if (!x) { out[k] = y; continue; }
    if (!y) { out[k] = x; continue; }
    out[k] = { best: Math.max(x.best, y.best), tries: Math.max(x.tries, y.tries), at: Math.max(x.at, y.at) };
  }
  return out;
}

function mergeMnemonics(a: Record<string, string>, b: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? "";
    const y = b[k] ?? "";
    if (!x) { out[k] = y; continue; }
    if (!y) { out[k] = x; continue; }
    out[k] = x.trim().length > y.trim().length || (x.trim().length === y.trim().length && cmp(x, y) >= 0) ? x : y;
  }
  return out;
}

function mergeAchievements(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = k in out ? Math.min(out[k], v) : v;
  }
  return out;
}

/** өдрийн parts-ийг xpParts-тэй холбож шинэчлэнэ (legacy өдрүүдэд ашиглана). */
export function attachDayParts(day: ActivityDay, deviceId: string): ActivityDay {
  if (day.parts && day.parts[deviceId]) return day;
  return {
    ...day,
    parts: { ...(day.parts ?? {}), [deviceId]: { xp: day.xp, min: day.min, newCards: day.newCards, reviews: day.reviews, correct: day.correct, total: day.total } },
  };
}
