/**
 * ХАДГАЛАЛТ — localStorage дээрх баримтыг унших, бичих, шилжүүлэх, нэгтгэх.
 * ------------------------------------------------------------------
 * Гурван зарчим:
 *  1. Хэзээ ч чимээгүй дарж бичихгүй. Гэмтсэн эсвэл шинэ хувилбарын өгөгдлийг
 *     хэрэглэгчийн зөвшөөрөлгүйгээр устгахгүй — эх хувийг нөөцөлж, мэдэгдэнэ.
 *  2. Хувилбар бүрийг шалгана. v < SCHEMA_VERSION → migrate (+ нөөц),
 *     v > SCHEMA_VERSION → зөвхөн уншина.
 *  3. React-гүй. Бүх функц `KV` интерфэйсээр ажиллах тул Node дээр тестлэгдэнэ.
 */
import {
  DEFAULT_PROFILE, QUIZ_COUNTS, SCHEMA_VERSION, emptyDay, freshDoc,
  type ActivityDay, type CurriculumState, type Doc, type ExamRecord, type Mistake, type Profile,
  type QuizRecord,
} from "./doc";
import { quizKindOf } from "./quizKind";
import type { Card } from "./srs";
import type { Level } from "./types";

/* ─────────────── Интерфэйс ─────────────── */

/** localStorage/Storage-ийн хэрэгтэй хэсэг — тестэд санах ойн хувилбар өгнө. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ReadStatus = "ok" | "empty" | "corrupt" | "future";

export interface ReadResult {
  status: ReadStatus;
  doc: Doc | null;
  /** Диск дээр байсан түүхий текст (одоогийн өгөгдлийг татахад). */
  raw?: string;
  fromVersion?: number;
  migrated?: boolean;
  /** Нөөц хуулбар хадгалсан түлхүүр. */
  backupKey?: string;
  futureVersion?: number;
}

export type DecodeFailReason = "invalid-json" | "not-object" | "future";

export type DecodeResult =
  | { ok: true; doc: Doc; fromVersion: number; migrated: boolean }
  | { ok: false; reason: DecodeFailReason; futureVersion?: number };

export type WriteFailReason = "blocked" | "quota" | "error";

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: WriteFailReason; message?: string };

/* ─────────────── Түлхүүрүүд ─────────────── */

export const docKeyOf = (uid: string) => `nd:doc:${uid}`;
export const backupKeyOf = (uid: string, tag: string) => `nd:doc:${uid}:backup:${tag}`;

/* ─────────────── Жижиг шалгалтууд ─────────────── */

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const isLevel = (x: unknown): x is Level => typeof x === "string" && (LEVELS as readonly string[]).includes(x);

const num = (x: unknown, fallback = 0): number =>
  typeof x === "number" && Number.isFinite(x) ? x : fallback;

const int = (x: unknown, fallback = 0): number => Math.round(num(x, fallback));

const str = (x: unknown, fallback = ""): string => (typeof x === "string" ? x : fallback);

const bool = (x: unknown, fallback = false): boolean => (typeof x === "boolean" ? x : fallback);

const strList = (x: unknown): string[] =>
  Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === "string"))] : [];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/* ─────────────── Шилжүүлэлт (migration) ─────────────── */

/**
 * v → v+1 алхмууд. Түүхэн бодит өөрчлөлт:
 * v3 → v4: `profile.language` нэмэгдсэн ч `Doc.v` 3 хэвээр үлдсэн тул хуучин
 *          хадгалалтад энэ талбар байхгүй. Монгол UI-аар ашиглаж байсан тул
 *          `mn` болгож бөглөнө (хэрэглэгч сонгосон бол хэвээр үлдэнэ).
 */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  3: (d) => {
    const profile = isRecord(d.profile) ? d.profile : {};
    return {
      ...d,
      profile: {
        ...profile,
        language: typeof profile.language === "string" ? profile.language : "mn",
        romaji: typeof profile.romaji === "boolean" ? profile.romaji : false,
      },
    };
  },
};

/* ─────────────── Хэвийн болгох ─────────────── */

function normalizeProfile(raw: unknown): Profile {
  if (!isRecord(raw)) return { ...DEFAULT_PROFILE };
  const theme = raw.theme === "sepia" || raw.theme === "light" ? raw.theme : DEFAULT_PROFILE.theme;
  return {
    name: str(raw.name, DEFAULT_PROFILE.name).slice(0, 80),
    current: raw.current === "zero" || isLevel(raw.current) ? raw.current : DEFAULT_PROFILE.current,
    target: isLevel(raw.target) ? raw.target : DEFAULT_PROFILE.target,
    examDate: str(raw.examDate, DEFAULT_PROFILE.examDate).slice(0, 20),
    dailyGoal: clamp(int(raw.dailyGoal, DEFAULT_PROFILE.dailyGoal), 1, 2000),
    newPerDay: clamp(int(raw.newPerDay, DEFAULT_PROFILE.newPerDay), 1, 200),
    furigana: bool(raw.furigana, DEFAULT_PROFILE.furigana),
    rate: clamp(num(raw.rate, DEFAULT_PROFILE.rate), 0.5, 1.5),
    onboarded: bool(raw.onboarded, false),
    theme,
    romaji: bool(raw.romaji, DEFAULT_PROFILE.romaji),
    language: raw.language === "en" ? "en" : "mn",
    session: normalizeSession(raw.session),
    quiz: normalizeQuizPrefs(raw.quiz),
  };
}

/** Quiz тохиргоо — санал болгож буй тоонд хамгийн ойрыг сонгоно. */
function normalizeQuizPrefs(raw: unknown): Profile["quiz"] {
  if (!isRecord(raw)) return { ...DEFAULT_PROFILE.quiz };
  const value = int(raw.count, DEFAULT_PROFILE.quiz.count);
  const count = QUIZ_COUNTS.reduce(
    (best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best),
    QUIZ_COUNTS[0],
  );
  return { count };
}

/** Flashcard сессийн тохиргоо — танихгүй утгыг анхны утгаар солино. */
function normalizeSession(raw: unknown): Profile["session"] {
  if (!isRecord(raw)) return { ...DEFAULT_PROFILE.session };
  const direction = raw.direction;
  return {
    grading: raw.grading === "binary" ? "binary" : "srs",
    direction:
      direction === "mn-jp" || direction === "listen" || direction === "write" ? direction : "jp-mn",
    count: clamp(int(raw.count, DEFAULT_PROFILE.session.count), 5, 80),
    onlyDue: bool(raw.onlyDue, false),
  };
}

function normalizeCard(raw: unknown): Card | null {
  if (!isRecord(raw)) return null;
  const due = num(raw.due, NaN);
  const st = num(raw.st, NaN);
  if (!Number.isFinite(due) || !Number.isFinite(st)) return null;
  const ph = raw.ph;
  const phase: Card["ph"] =
    ph === "new" || ph === "learning" || ph === "relearn" || ph === "review" ? ph : "review";
  return {
    due,
    st: Math.max(0, st),
    df: clamp(num(raw.df, 5), 1, 10),
    n: Math.max(0, int(raw.n, 0)),
    l: Math.max(0, int(raw.l, 0)),
    last: num(raw.last, due),
    ph: phase,
    streak: Math.max(0, int(raw.streak, 0)),
    h: Array.isArray(raw.h) ? raw.h.filter((g) => g === 0 || g === 1 || g === 2 || g === 3).slice(-12) as Card["h"] : [],
  };
}

function normalizeActivity(raw: unknown): Record<string, ActivityDay> {
  if (!isRecord(raw)) return {};
  const out: Record<string, ActivityDay> = {};
  for (const [day, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isRecord(v)) continue;
    const base = emptyDay();
    out[day] = {
      xp: Math.max(0, int(v.xp, base.xp)),
      min: Math.max(0, num(v.min, base.min)),
      newCards: Math.max(0, int(v.newCards, base.newCards)),
      reviews: Math.max(0, int(v.reviews, base.reviews)),
      correct: Math.max(0, int(v.correct, base.correct)),
      total: Math.max(0, int(v.total, base.total)),
    };
  }
  return out;
}

function normalizeWriting(raw: unknown): Doc["writing"] {
  if (!isRecord(raw)) return {};
  const out: Doc["writing"] = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    out[id] = { best: clamp(int(v.best, 0), 0, 100), tries: Math.max(0, int(v.tries, 0)), at: num(v.at, 0) };
  }
  return out;
}

function normalizeStringMap(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[k] = v.slice(0, 2000);
  return out;
}

function normalizeNumberMap(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
}

function normalizeExams(raw: unknown): ExamRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ExamRecord[] = [];
  for (const e of raw) {
    if (!isRecord(e) || typeof e.id !== "string" || !isLevel(e.level)) continue;
    out.push({
      id: e.id.slice(0, 64),
      level: e.level,
      at: num(e.at, 0),
      sections: Array.isArray(e.sections)
        ? e.sections.filter(isRecord).map((s) => ({
            name: str(s.name, "").slice(0, 80),
            correct: Math.max(0, int(s.correct, 0)),
            total: Math.max(0, int(s.total, 0)),
            score: Math.max(0, num(s.score, 0)),
            max: Math.max(0, num(s.max, 0)),
          }))
        : [],
      total: Math.max(0, num(e.total, 0)),
      max: Math.max(0, num(e.max, 0)),
      passed: bool(e.passed, false),
      minutes: Math.max(0, num(e.minutes, 0)),
      mock: bool(e.mock, false),
    });
  }
  return out;
}

function normalizeQuizzes(raw: unknown): QuizRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizRecord[] = [];
  for (const q of raw) {
    if (!isRecord(q) || !isLevel(q.level)) continue;
    out.push({
      at: num(q.at, 0),
      kind: quizKindOf(q.kind),
      level: q.level,
      correct: Math.max(0, int(q.correct, 0)),
      total: Math.max(0, int(q.total, 0)),
      minutes: Math.max(0, num(q.minutes, 0)),
    });
  }
  return out;
}

function normalizeMistakes(raw: unknown): Mistake[] {
  if (!Array.isArray(raw)) return [];
  const out: Mistake[] = [];
  for (const m of raw) {
    if (!isRecord(m) || typeof m.id !== "string" || !isLevel(m.level)) continue;
    out.push({
      id: m.id.slice(0, 120),
      kind: str(m.kind, "quiz").slice(0, 40),
      level: m.level,
      prompt: str(m.prompt, "").slice(0, 500),
      answer: str(m.answer, "").slice(0, 500),
      given: str(m.given, "").slice(0, 500),
      note: typeof m.note === "string" ? m.note.slice(0, 500) : undefined,
      at: num(m.at, 0),
      count: Math.max(1, int(m.count, 1)),
    });
  }
  return out;
}

function normalizePlacement(raw: unknown): Doc["placement"] {
  if (!isRecord(raw)) return undefined;
  if (raw.level !== "zero" && !isLevel(raw.level)) return undefined;
  const detail: Record<string, Level> = {};
  if (isRecord(raw.detail)) {
    for (const [k, v] of Object.entries(raw.detail)) if (isLevel(v)) detail[k] = v;
  }
  return { level: raw.level, at: num(raw.at, 0), detail };
}

function normalizeCurriculum(raw: unknown): CurriculumState | undefined {
  if (!isRecord(raw) || !isLevel(raw.level)) return undefined;
  const done: CurriculumState["done"] = {};
  if (isRecord(raw.done)) {
    for (const [k, v] of Object.entries(raw.done)) {
      if (!isRecord(v)) continue;
      done[Number(k)] = {
        at: num(v.at, 0),
        vocab: Math.max(0, int(v.vocab, 0)),
        kanji: Math.max(0, int(v.kanji, 0)),
        grammar: Math.max(0, int(v.grammar, 0)),
        reading: Math.max(0, int(v.reading, 0)),
        listening: Math.max(0, int(v.listening, 0)),
      };
    }
  }
  return { level: raw.level, days: Math.max(0, int(raw.days, 0)), startedAt: num(raw.startedAt, 0), done };
}

/** Бүх мэдэгдэх талбарыг анхны утгаар дүүргэж, төрлийг шалгана. */
function normalizeDoc(raw: Record<string, unknown>): Doc {
  const base = freshDoc();
  const srs: Record<string, Card> = {};
  if (isRecord(raw.srs)) {
    for (const [id, v] of Object.entries(raw.srs)) {
      const card = normalizeCard(v);
      if (card) srs[id] = card;
    }
  }
  return {
    v: SCHEMA_VERSION,
    profile: normalizeProfile(raw.profile),
    srs,
    writing: normalizeWriting(raw.writing),
    mnemonics: normalizeStringMap(raw.mnemonics),
    favorites: strList(raw.favorites),
    grammarDone: strList(raw.grammarDone),
    readingDone: strList(raw.readingDone),
    listeningDone: strList(raw.listeningDone),
    kanaBest: clamp(num(raw.kanaBest, 0), 0, 100),
    exams: normalizeExams(raw.exams),
    quizzes: normalizeQuizzes(raw.quizzes),
    placement: normalizePlacement(raw.placement),
    mistakes: normalizeMistakes(raw.mistakes),
    activity: normalizeActivity(raw.activity),
    xp: Math.max(0, int(raw.xp, 0)),
    achievements: normalizeNumberMap(raw.achievements),
    curriculum: normalizeCurriculum(raw.curriculum),
    createdAt: num(raw.createdAt, base.createdAt),
    updatedAt: num(raw.updatedAt, base.updatedAt),
  };
}

/** Мэдэгдэх баримт мөн эсэх — тохирохгүй бол чимээгүй «хоосон」 болгохгүй. */
function looksLikeDoc(raw: Record<string, unknown>): boolean {
  if (!isRecord(raw.profile)) return false;
  return "srs" in raw || "activity" in raw || "profile" in raw || "v" in raw;
}

/* ─────────────── Унших / decode ─────────────── */

function upgrade(raw: Record<string, unknown>): DecodeResult {
  const fromVersion = typeof raw.v === "number" && Number.isFinite(raw.v) ? Math.max(0, Math.floor(raw.v)) : 0;
  if (fromVersion > SCHEMA_VERSION) {
    return { ok: false, reason: "future", futureVersion: fromVersion };
  }

  let upgraded: Record<string, unknown> = { ...raw };
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) upgraded = step(upgraded);
  }

  return { ok: true, doc: normalizeDoc(upgraded), fromVersion, migrated: fromVersion !== SCHEMA_VERSION };
}

export function decodeDoc(text: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (!isRecord(parsed) || !looksLikeDoc(parsed)) return { ok: false, reason: "not-object" };
  return upgrade(parsed);
}

/** Объект хэлбэрээр ирсэн баримтыг (жишээ нь серверээс) шалгаж, хувилбарыг шилжүүлнэ. */
export function normalizeDocValue(raw: unknown): Doc | null {
  if (!isRecord(raw) || !looksLikeDoc(raw)) return null;
  const res = upgrade(raw);
  return res.ok ? res.doc : null;
}

export function readDoc(kv: KV, uid: string, now = Date.now()): ReadResult {
  let raw: string | null = null;
  try {
    raw = kv.getItem(docKeyOf(uid));
  } catch {
    return { status: "empty", doc: null };
  }
  if (!raw) return { status: "empty", doc: null };

  const res = decodeDoc(raw);
  if (!res.ok) {
    if (res.reason === "future") {
      return { status: "future", doc: null, raw, futureVersion: res.futureVersion };
    }
    // Гэмтсэн өгөгдлийг ХӨНДӨХГҮЙ — зөвхөн хуулбар хадгалж мэдэгдэнэ.
    const key = backupKeyOf(uid, `corrupt-${now}`);
    safeSet(kv, key, raw);
    return { status: "corrupt", doc: null, raw, backupKey: key };
  }

  if (res.migrated) {
    const key = backupKeyOf(uid, `v${res.fromVersion}`);
    safeSet(kv, key, raw);
    return { status: "ok", doc: res.doc, raw, fromVersion: res.fromVersion, migrated: true, backupKey: key };
  }
  return { status: "ok", doc: res.doc, raw, fromVersion: res.fromVersion, migrated: false };
}

/* ─────────────── Бичих ─────────────── */

function safeSet(kv: KV, key: string, value: string): boolean {
  try {
    kv.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function classifyWriteError(err: unknown): WriteFailReason {
  const e = err as { name?: string; code?: number } | null;
  if (
    e?.name === "QuotaExceededError" ||
    e?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e?.code === 22 ||
    e?.code === 1014
  ) {
    return "quota";
  }
  return "error";
}

/**
 * Баримтыг бичнэ. Диск дээр гэмтсэн эсвэл шинэ хувилбарын өгөгдөл байвал
 * `allowOverwrite: true` (хэрэглэгчийн зөвшөөрөл) хүртэл бичихгүй.
 */
export function writeDoc(
  kv: KV,
  uid: string,
  doc: Doc,
  opts: { allowOverwrite?: boolean } = {},
): WriteResult {
  try {
    const existing = kv.getItem(docKeyOf(uid));
    if (existing && !opts.allowOverwrite) {
      const check = decodeDoc(existing);
      if (!check.ok) return { ok: false, reason: "blocked" };
    }
    kv.setItem(docKeyOf(uid), JSON.stringify({ ...doc, v: SCHEMA_VERSION }));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: classifyWriteError(err), message: err instanceof Error ? err.message : undefined };
  }
}

/* ─────────────── Хоёр табын нэгтгэл ─────────────── */

/**
 * Нэгтгэлийн дүрэм (LWW биш):
 *   · srs            → сүүлд давтсан (`last`) карт ялна; тэнцвэл илүү `n`
 *   · activity       → өдөр бүрээр талбар тус бүрийн max
 *   · xp, kanaBest   → max (нэг талын ахиц бүү алдагдаарай)
 *   · favorites, grammarDone, readingDone, listeningDone → нэгдэл
 *   · exams, quizzes → нэгдэл (давхардалгүй), `at`-аар буурах дараалалтай
 *                       (тэнцвэл тогтвортой tie-break — аргументын дарааллаас хамаарахгүй)
 *   · mistakes       → id-аар нэгтгэж, count/at-ийн max
 *   · achievements   → түлхүүр бүрээр хамгийн эрт нээлт (min at)
 *   · profile, placement, curriculum, mnemonics, createdAt
 *                    → `updatedAt` шинэ тал ялна (тэнцвэл тогтвортой tie-break)
 * Функц нь commutative бөгөөд idempotent — хоёр таб хязгааргүй «цохилт»гүй
 * нэг төлөвт нийлнэ.
 */
export function mergeDocs(a: Doc, b: Doc): Doc {
  const winner = pickNewer(a, b);
  return {
    v: SCHEMA_VERSION,
    profile: { ...winner.profile },
    mnemonics: { ...winner.mnemonics },
    placement: winner.placement,
    curriculum: winner.curriculum,
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    srs: mergeCards(a.srs, b.srs),
    writing: mergeRecords(a.writing, b.writing, (x, y) => ({
      best: Math.max(x.best, y.best),
      tries: Math.max(x.tries, y.tries),
      at: Math.max(x.at, y.at),
    })),
    activity: mergeRecords(a.activity, b.activity, (x, y) => ({
      xp: Math.max(x.xp, y.xp),
      min: Math.max(x.min, y.min),
      newCards: Math.max(x.newCards, y.newCards),
      reviews: Math.max(x.reviews, y.reviews),
      correct: Math.max(x.correct, y.correct),
      total: Math.max(x.total, y.total),
    })),
    achievements: mergeRecords(a.achievements, b.achievements, (x, y) => Math.min(x, y)),
    favorites: union(a.favorites, b.favorites),
    grammarDone: union(a.grammarDone, b.grammarDone),
    readingDone: union(a.readingDone, b.readingDone),
    listeningDone: union(a.listeningDone, b.listeningDone),
    kanaBest: Math.max(a.kanaBest, b.kanaBest),
    xp: Math.max(a.xp, b.xp),
    exams: sortNewestFirst(
      unionBy(a.exams, b.exams, (e) => e.id, (x, y) => (JSON.stringify(x) >= JSON.stringify(y) ? x : y)),
    ),
    quizzes: sortNewestFirst(
      unionBy(
        a.quizzes,
        b.quizzes,
        (q) => `${q.at}|${q.kind}|${q.level}|${q.total}`,
        (x, y) => (JSON.stringify(x) >= JSON.stringify(y) ? x : y),
      ),
    ),
    mistakes: unionBy(
      a.mistakes,
      b.mistakes,
      (m) => m.id,
      (x, y) => ({
        ...(x.at >= y.at ? x : y),
        count: Math.max(x.count, y.count),
        at: Math.max(x.at, y.at),
      }),
    ),
  };
}

function pickNewer(a: Doc, b: Doc): Doc {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  // Тэнцсэн үед тогтвортой (commutative) сонголт.
  return JSON.stringify(a.profile) >= JSON.stringify(b.profile) ? a : b;
}

function mergeCards(a: Record<string, Card>, b: Record<string, Card>): Record<string, Card> {
  const out: Record<string, Card> = { ...a };
  for (const [id, card] of Object.entries(b)) {
    const mine = out[id];
    if (!mine) {
      out[id] = card;
      continue;
    }
    const win = card.last > mine.last || (card.last === mine.last && card.n > mine.n) ? card : mine;
    out[id] = win;
  }
  return out;
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

function unionBy<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const k = key(item);
    const existing = map.get(k);
    map.set(k, existing === undefined ? item : pick(existing, item));
  }
  return [...map.values()];
}

/**
 * `at`-аар буурах эрэмбэ; тэнцвэл агуулгын JSON-оор тогтвортой эрэмбэлнэ.
 * Ингэснээр merge-ийн үр дүн аргументын дарааллаас хамаарахгүй бөгөөд
 * «сүүлийн N» цонх (`stats.WEAK_WINDOW`, Progress-ийн түүх) зөв ажиллана.
 */
function sortNewestFirst<T extends { at: number }>(items: T[]): T[] {
  return [...items].sort((x, y) => {
    if (y.at !== x.at) return y.at - x.at;
    const jx = JSON.stringify(x);
    const jy = JSON.stringify(y);
    return jx < jy ? -1 : jx > jy ? 1 : 0;
  });
}
