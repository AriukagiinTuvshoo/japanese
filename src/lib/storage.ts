/**
 * ХАДГАЛАЛТЫН АЮУЛГҮЙ ДАВХАРГА
 * ------------------------------------------------------------------
 * localStorage-д байгаа JSON нь хэрэглэгчийн бүх ахиц. Тиймээс:
 *  · схем шалгана (гараар бичсэн, номын сангүй),
 *  · хувилбар шилжүүлнэ (v2 → v3),
 *  · эвдэрсэн утгыг **устгахгүй**, `nd:doc:<uid>:corrupt:<ts>`-д нөөцөлнө,
 *  · буцаах боломжтой хэсгийг нь сэргээнэ.
 */
import type { ActivityCounts, ActivityDay, Doc, Profile } from "./store";
import { backupKeepFor, bytesOf } from "./quota";

export const SCHEMA_VERSION = 3 as const;

export const docKey = (uid: string) => `nd:doc:${uid}`;
export const backupKey = (uid: string, at = Date.now()) => `nd:doc:${uid}:corrupt:${at}`;
export const BACKUP_PREFIX = (uid: string) => `nd:doc:${uid}:corrupt:`;

export const DEFAULT_PROFILE: Profile = {
  name: "",
  current: "zero",
  target: "N5",
  examDate: "",
  dailyGoal: 30,
  newPerDay: 12,
  furigana: true,
  rate: 0.95,
  onboarded: false,
  theme: "light",
  romaji: false,
  language: "mn",
};

const emptyDay = (): ActivityDay => ({ xp: 0, min: 0, newCards: 0, reviews: 0, correct: 0, total: 0 });

export function freshDoc(name = ""): Doc {
  return {
    v: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE, name },
    srs: {},
    writing: {},
    mnemonics: {},
    favorites: [],
    grammarDone: [],
    readingDone: [],
    listeningDone: [],
    kanaBest: 0,
    exams: [],
    quizzes: [],
    mistakes: [],
    activity: {},
    xp: 0,
    achievements: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* ─────────────── жижиг шалгуурууд ─────────────── */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const isLevel = (v: unknown): v is (typeof LEVELS)[number] => isStr(v) && (LEVELS as readonly string[]).includes(v);

const PHASES = ["new", "learning", "review", "relearn"] as const;

/** Тооны газар (хувь нэмэр/тэмдэг) — зөвхөн эерэг, хязгааргүй утгыг үлдээнэ. */
function cleanNumberMap(v: unknown): Record<string, number> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (isNum(n)) out[k] = n;
  return Object.keys(out).length ? out : undefined;
}

const ACTIVITY_KEYS = ["xp", "min", "newCards", "reviews", "correct", "total"] as const;

/** өдрийн хувь нэмрийг шүүнэ (зөвхөн 6 тоон утгатай талбарыг үлдээнэ). */
function cleanParts(v: unknown): Record<string, ActivityCounts> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, ActivityCounts> = {};
  for (const [dev, counts] of Object.entries(v)) {
    if (!isObj(counts)) continue;
    const clean = { xp: 0, min: 0, newCards: 0, reviews: 0, correct: 0, total: 0 } as ActivityCounts;
    let any = false;
    for (const k of ACTIVITY_KEYS) {
      const n = (counts as Record<string, unknown>)[k];
      if (isNum(n)) { (clean[k] as number) = n; any = true; }
    }
    if (any) out[dev] = clean;
  }
  return Object.keys(out).length ? out : undefined;
}

/** SRS карт бүтэн эсэх. */
function isCard(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (!isNum(v.due) || !isNum(v.st) || !isNum(v.df) || !isNum(v.n) || !isNum(v.l) || !isNum(v.last)) return false;
  if (!isStr(v.ph) || !(PHASES as readonly string[]).includes(v.ph)) return false;
  if (!isNum(v.streak)) return false;
  return Array.isArray(v.h) && v.h.every(isNum);
}

/* ─────────────── сэргээх ─────────────── */

export interface ParseResult {
  doc: Doc;
  /** ok = хэвээр, migrated = хувилбар/талбар зассан, recovered = эвдэрхийг сэргээсэн */
  status: "ok" | "migrated" | "recovered";
  /** Эвдэрсэн түүхий утга — нөөцлөхөд. */
  corruptRaw?: string;
  /** Техникийн шалтгаан (UI-д биш, лог/нөөцөд). */
  reason?: string;
}

function sanitizeProfile(v: unknown, issues: string[]): Profile {
  if (v === undefined) return { ...DEFAULT_PROFILE };
  if (!isObj(v)) {
    issues.push("profile");
    return { ...DEFAULT_PROFILE };
  }
  const p = v;
  const language = p.language === "en" ? "en" : p.language === "mn" || p.language === undefined ? "mn" : (issues.push("profile.language"), "mn");
  const current = p.current === "zero" || isLevel(p.current) ? p.current : (p.current === undefined ? DEFAULT_PROFILE.current : (issues.push("profile.current"), DEFAULT_PROFILE.current));
  const theme = p.theme === "sepia" || p.theme === "light" ? p.theme : DEFAULT_PROFILE.theme;
  return {
    name: isStr(p.name) ? p.name : "",
    current,
    target: isLevel(p.target) ? p.target : DEFAULT_PROFILE.target,
    examDate: isStr(p.examDate) ? p.examDate : "",
    dailyGoal: isNum(p.dailyGoal) && p.dailyGoal > 0 ? p.dailyGoal : DEFAULT_PROFILE.dailyGoal,
    newPerDay: isNum(p.newPerDay) && p.newPerDay >= 0 ? p.newPerDay : DEFAULT_PROFILE.newPerDay,
    furigana: isBool(p.furigana) ? p.furigana : DEFAULT_PROFILE.furigana,
    rate: isNum(p.rate) && p.rate > 0 && p.rate <= 1 ? p.rate : DEFAULT_PROFILE.rate,
    onboarded: isBool(p.onboarded) ? p.onboarded : false,
    theme,
    romaji: isBool(p.romaji) ? p.romaji : false,
    language,
  };
}

function record<T>(v: unknown, valid: (x: unknown) => boolean, issues: string[]): Record<string, T> {
  if (v === undefined) return {};
  if (!isObj(v)) {
    issues.push("record");
    return {};
  }
  const out: Record<string, T> = {};
  for (const [k, val] of Object.entries(v)) {
    if (valid(val)) out[k] = val as T;
    else issues.push(`record.${k}`);
  }
  return out;
}

function list<T>(v: unknown, valid: (x: unknown) => boolean, issues: string[], name: string): T[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    issues.push(name);
    return [];
  }
  const out = v.filter(valid) as T[];
  if (out.length !== v.length) issues.push(`${name}.items`);
  return out;
}

/**
 * Хадгалагдсан түүхий утгыг сэргээнэ. Хэзээ ч шидэхгүй.
 * `null` (документ байхгүй) нь шинэ, хүчинтэй документ болно.
 */
export function parseStoredDoc(raw: string | null): ParseResult {
  if (raw === null || raw === "") return { doc: freshDoc(), status: "ok" };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { doc: freshDoc(), status: "recovered", corruptRaw: raw, reason: "json" };
  }
  if (!isObj(value)) {
    return { doc: freshDoc(), status: "recovered", corruptRaw: raw, reason: "not-an-object" };
  }

  const issues: string[] = [];
  const base = freshDoc();
  const v = value;
  const version = isNum(v.v) ? v.v : 0;

  const doc: Doc = {
    v: SCHEMA_VERSION,
    profile: sanitizeProfile(v.profile, issues),
    srs: record(v.srs, isCard, issues) as Doc["srs"],
    writing: record<{ best: number; tries: number; at: number }>(
      v.writing,
      (x) => isObj(x) && isNum(x.best) && isNum(x.tries),
      issues,
    ),
    mnemonics: record<string>(v.mnemonics, isStr, issues),
    favorites: list<string>(v.favorites, isStr, issues, "favorites"),
    grammarDone: list<string>(v.grammarDone, isStr, issues, "grammarDone"),
    readingDone: list<string>(v.readingDone, isStr, issues, "readingDone"),
    listeningDone: list<string>(v.listeningDone, isStr, issues, "listeningDone"),
    kanaBest: isNum(v.kanaBest) ? v.kanaBest : 0,
    exams: list(v.exams, (x) => isObj(x) && isStr(x.id) && isNum(x.at), issues, "exams"),
    quizzes: list(v.quizzes, (x) => isObj(x) && isNum(x.at) && isNum(x.total), issues, "quizzes"),
    mistakes: list(v.mistakes, (x) => isObj(x) && isStr(x.id) && isNum(x.count), issues, "mistakes"),
    activity: record(v.activity, (x) => isObj(x) && isNum(x.xp), issues) as Record<string, ActivityDay>,
    xp: isNum(v.xp) && v.xp >= 0 ? v.xp : 0,
    achievements: record<number>(v.achievements, isNum, issues),
    createdAt: isNum(v.createdAt) ? v.createdAt : base.createdAt,
    updatedAt: isNum(v.updatedAt) ? v.updatedAt : base.updatedAt,
  };

  // Бүтэн бус activity бичлэгүүдийг бөглөнө (хуучин хувилбарт дутуу байж болно).
  // merge-ийн `parts` хэсэг нь тоо биш, тулд шүүнэ (docs/SYNC.md §2).
  for (const [k, day] of Object.entries(doc.activity)) {
    const raw = day as Partial<ActivityDay> & { parts?: unknown };
    doc.activity[k] = { ...emptyDay(), ...raw, parts: cleanParts(raw.parts) };
  }

  // merge-ийн нэмэлт сонголттой талбарууд — байвал хадгална, үгүй бол алгасна.
  const profileTs = cleanNumberMap(v.profileTs);
  if (profileTs) doc.profileTs = profileTs as Doc["profileTs"];
  const xpParts = cleanNumberMap(v.xpParts);
  if (xpParts) doc.xpParts = xpParts;
  const tomb = cleanNumberMap(v.tomb);
  if (tomb) doc.tomb = tomb;

  if (isObj(v.curriculum) && isStr(v.curriculum.level) && isNum(v.curriculum.days)) {
    doc.curriculum = v.curriculum as unknown as Doc["curriculum"];
  }
  if (isObj(v.placement) && isNum(v.placement.at) && isStr(v.placement.level)) doc.placement = v.placement as unknown as Doc["placement"];

  if (issues.length) {
    return { doc, status: "recovered", corruptRaw: raw, reason: [...new Set(issues)].join(",") };
  }
  if (version !== SCHEMA_VERSION) return { doc, status: "migrated" };
  return { doc, status: "ok" };
}

/**
 * Импорт/гадаад өгөгдлийн **хатуу** шалгалт.
 * Сэргээх боломжгүй, зөвхөн "энэ бол ахицын документ мөн үү" гэдгийг хэлнэ.
 */
export function validateDoc(value: unknown): { ok: true; doc: Doc } | { ok: false; reason: string } {
  if (!isObj(value)) return { ok: false, reason: "not-an-object" };
  const known = ["profile", "srs", "activity", "favorites", "mistakes", "xp", "createdAt"];
  if (!known.some((k) => k in value)) return { ok: false, reason: "not-a-progress-doc" };
  if ("srs" in value && !isObj(value.srs)) return { ok: false, reason: "srs" };
  if ("profile" in value && !isObj(value.profile)) return { ok: false, reason: "profile" };
  if ("activity" in value && !isObj(value.activity)) return { ok: false, reason: "activity" };
  if ("favorites" in value && !Array.isArray(value.favorites)) return { ok: false, reason: "favorites" };
  if ("mistakes" in value && !Array.isArray(value.mistakes)) return { ok: false, reason: "mistakes" };
  const parsed = parseStoredDoc(JSON.stringify(value));
  if (parsed.status === "recovered") return { ok: false, reason: parsed.reason ?? "corrupt" };
  return { ok: true, doc: parsed.doc };
}

/** localStorage-аас уншина; эвдэрхийг нөөцөлж, сэргээсэн документыг буцаана. */
export function loadDoc(uid: string, now = Date.now()): { doc: Doc; status: ParseResult["status"] } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(docKey(uid));
  } catch {
    /* private mode — санах ойд үргэлжлүүлнэ */
  }
  const res = parseStoredDoc(raw);

  if (res.status === "recovered" && res.corruptRaw != null) {
    try {
      // Эвдэрсэн өгөгдлийг ХЭЗЭЭ Ч чимээгүй устгахгүй — нөөцөлнө.
      // Копи хэтрэхгүйн тулд хамгийн сүүлийн 2 үлдээнэ (B4 quota).
      localStorage.setItem(backupKey(uid, now), res.corruptRaw);
      const olds = backupKeys(BACKUP_PREFIX(uid)).filter((k) => k !== backupKey(uid, now));
      for (const old of olds.slice(0, Math.max(0, olds.length - 1))) localStorage.removeItem(old);
    } catch {
      /* нөөцлөх зай байхгүй */
    }
  }
  if (res.status !== "ok") saveDoc(uid, res.doc);
  return { doc: res.doc, status: res.status };
}

/** Документыг хадгална. Амжилтгүй бол `false` (quota/private mode). */
export function saveDoc(uid: string, doc: Doc): boolean {
  try {
    localStorage.setItem(docKey(uid), JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/* ─────────────── sync-ийн өмнөх нөөц (B1) ─────────────── */

export const syncBackupPrefix = (uid: string) => `nd:doc:${uid}:sync:`;
export const syncBackupKey = (uid: string, at: number) => `${syncBackupPrefix(uid)}${at}`;

/** Тэмдэглэгдсэн бүх нөөцийн түлхүүрүүд (хэмжээгээр эрэмбэлэгдсэн). */
function backupKeys(prefix: string): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch {
    /* private mode */
  }
  return keys.sort();
}

/**
 * Синхрончлолын өмнө локал нөөц үүсгэнэ.
 * Хэдэн нөөц үлдээхээ **баримтын хэмжээ** тогтооно (B4, quota.ts):
 * жижиг баримт 3, 1 МБ-аас дээш баримт 0 (основ + undo-г хадгална) —
 * ингэж хүнд хэрэглэгч quota-г копигоор дүүргэхгүй.
 * Нөөцлөх боломжгүй бол ч sync-ийг зогсоохгүй.
 */
export function snapshotDoc(uid: string, doc: Doc, keep?: number): string | null {
  try {
    const json = JSON.stringify(doc);
    const limit = keep ?? backupKeepFor(bytesOf(json));
    const prefix = syncBackupPrefix(uid);
    if (limit <= 0) {
      for (const old of backupKeys(prefix)) localStorage.removeItem(old);
      return null;
    }
    const key = syncBackupKey(uid, Date.now());
    localStorage.setItem(key, json);
    const keys = backupKeys(prefix);
    for (const old of keys.slice(0, Math.max(0, keys.length - limit))) localStorage.removeItem(old);
    return key;
  } catch {
    return null;
  }
}

/** Төхөөрөмжийн тогтмол ID — XP/өдрийн хувь нэмрийн түлхүүр (docs/SYNC.md). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem("nd:device");
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem("nd:device", id);
    }
    return id;
  } catch {
    return "local";
  }
}

