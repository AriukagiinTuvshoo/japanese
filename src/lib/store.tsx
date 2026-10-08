/**
 * ГЛОБАЛ ТӨЛӨВ — хэрэглэгчийн бүх ахиц.
 * ------------------------------------------------------------------
 * · Документ нь нэг JSON — ингэснээр cloud sync энгийн бөгөөд найдвартай.
 * · Аккаунт бүр өөрийн түлхүүртэй (`nd:doc:<uid>`), зочноор ашиглахад
 *   `nd:doc:local` ашиглана.
 * · Сүлжээ байхгүй ч бүрэн ажиллана; сэргэхэд автоматаар sync хийнэ.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { api, setToken, type Account } from "./api";
import { ACHIEVEMENTS, XP, xpLevel, type AchievementInput } from "./gamification";
import { schedule, type Card, type Grade } from "./srs";
import { dayOffset, todayKey } from "./text";
import type { Level } from "./types";
import type { Language } from "./i18n";

/* ─────────────── Төрлүүд ─────────────── */

export interface ExamRecord {
  id: string;
  level: Level;
  at: number;
  sections: { name: string; correct: number; total: number; score: number; max: number }[];
  total: number;
  max: number;
  passed: boolean;
  minutes: number;
  mock: boolean;
}

export interface QuizRecord {
  at: number;
  kind: string;
  level: Level;
  correct: number;
  total: number;
  minutes: number;
}

export interface Mistake {
  id: string;
  kind: string;
  level: Level;
  prompt: string;
  answer: string;
  given: string;
  note?: string;
  at: number;
  count: number;
}

export interface Profile {
  name: string;
  current: Level | "zero";
  target: Level;
  examDate: string;
  dailyGoal: number;
  newPerDay: number;
  furigana: boolean;
  rate: number;
  onboarded: boolean;
  theme: "light" | "sepia";
  romaji: boolean;
  /** UI and learning-content language. Stored with the profile and synced. */
  language: Language;
}

export interface ActivityDay {
  xp: number;
  min: number;
  newCards: number;
  reviews: number;
  correct: number;
  total: number;
}

export interface CurriculumState {
  level: Level;
  days: number;
  startedAt: number;
  /** day → дууссан эсэх */
  done: Record<number, { at: number; vocab: number; kanji: number; grammar: number; reading: number; listening: number }>;
}

export interface Doc {
  v: 3;
  profile: Profile;
  srs: Record<string, Card>;
  /** ханз бичих дасгалын үр дүн */
  writing: Record<string, { best: number; tries: number; at: number }>;
  /** хэрэглэгчийн өөрийн мнемоник */
  mnemonics: Record<string, string>;
  /** таалагдсан үг/ханз/дүрэм */
  favorites: string[];
  grammarDone: string[];
  readingDone: string[];
  listeningDone: string[];
  kanaBest: number;
  exams: ExamRecord[];
  quizzes: QuizRecord[];
  placement?: { level: Level | "zero"; at: number; detail: Record<string, Level> };
  mistakes: Mistake[];
  activity: Record<string, ActivityDay>;
  xp: number;
  achievements: Record<string, number>;
  curriculum?: CurriculumState;
  createdAt: number;
  updatedAt: number;
}

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

function freshDoc(name = ""): Doc {
  return {
    v: 3,
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

/* ─────────────── Хадгалалт ─────────────── */

const keyFor = (uid: string) => `nd:doc:${uid}`;
const SESSION_KEY = "nd:session";
const GUEST = "local";

function readDoc(uid: string): Doc | null {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Doc>;
    const base = freshDoc();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      srs: parsed.srs ?? {},
      activity: parsed.activity ?? {},
    } as Doc;
  } catch {
    return null;
  }
}

function writeDoc(uid: string, doc: Doc) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(doc));
  } catch {
    /* санах ой дүүрсэн — туршилтын горимд алгасна */
  }
}

/* ─────────────── Контекст ─────────────── */

interface Ctx {
  doc: Doc;
  account: Account | null;
  offline: boolean;
  syncing: "idle" | "syncing" | "error" | "ok";
  lastSync: number | null;
  serverAvailable: boolean;
  today: ActivityDay;
  streak: number;
  levelInfo: ReturnType<typeof xpLevel>;
  inputs: AchievementInput;
  unlocked: { id: string; at: number }[];
  nextAchievement: { id: string; title: string; desc: string; icon: string; pct: number } | null;
  actions: Actions;
}

export interface Actions {
  patchProfile: (p: Partial<Profile>) => void;

  grade: (id: string, g: Grade, meta?: { isNew?: boolean; level?: Level }) => void;
  gradeMany: (items: { id: string; g: Grade; isNew?: boolean }[]) => void;
  addXP: (n: number) => void;
  addMinutes: (n: number) => void;
  logQuiz: (r: Omit<QuizRecord, "at">) => void;
  recordExam: (r: ExamRecord) => void;

  toggleGrammar: (id: string, level: Level, on?: boolean) => void;
  markReading: (id: string) => void;
  markListening: (id: string) => void;
  recordWriting: (kanji: string, score: number) => void;
  setMnemonic: (kanji: string, text: string) => void;
  toggleFavorite: (id: string) => void;
  setKanaBest: (n: number) => void;

  addMistakes: (list: Omit<Mistake, "at" | "count">[]) => void;
  resolveMistake: (id: string) => void;
  clearMistakes: () => void;

  setPlacement: (level: Level | "zero", detail: Record<string, Level>) => void;
  startCurriculum: (level: Level, days: number) => void;
  completeCurriculumDay: (day: number, counts: Partial<{ vocab: number; kanji: number; grammar: number; reading: number; listening: number }>) => void;

  /* аккаунт */
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  guestMode: () => void;
  redeemCode: (code: string) => Promise<void>;
  syncNow: () => Promise<void>;

  exportJSON: () => string;
  importJSON: (json: string) => boolean;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string>(() => localStorage.getItem(SESSION_KEY) ?? GUEST);
  const [account, setAccount] = useState<Account | null>(null);
  const [doc, setDoc] = useState<Doc>(() => readDoc(localStorage.getItem(SESSION_KEY) ?? GUEST) ?? freshDoc());
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [syncing, setSyncing] = useState<"idle" | "syncing" | "error" | "ok">("idle");
  const [lastSync, setLastSync] = useState<number | null>(null);

  const rev = useRef(0);
  const lastAct = useRef(Date.now());
  const dirty = useRef(false);

  /* ── сүлжээний төлөв ── */
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* ── токен сэргээх ── */
  useEffect(() => {
    const t = localStorage.getItem("nd:token");
    if (t) setToken(t);
  }, []);

  /* ── серверийн бэлэн байдал ── */
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ok = await api.health().then(() => true).catch(() => false);
      if (alive) setServerAvailable(ok);
      if (ok && localStorage.getItem("nd:token")) {
        const me = await api.me().catch(() => null);
        if (alive && me) setAccount(me.account);
      }
    };
    check();
    const t = window.setInterval(check, 60_000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  /* ── localStorage-д хадгалах (debounce) ── */
  useEffect(() => {
    dirty.current = true;
    const t = window.setTimeout(() => writeDoc(uid, doc), 350);
    return () => window.clearTimeout(t);
  }, [doc, uid]);

  /* ── идэвхтэй минутыг тоолох ── */
  useEffect(() => {
    const mark = () => { lastAct.current = Date.now(); };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastAct.current < 90_000) {
        setDoc((d) => bumpDay(d, { min: 1, xp: XP.minute }));
      }
    }, 60_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(t);
    };
  }, []);

  /* ── амжилт шалгах ── */
  const inputs = useMemo<AchievementInput>(() => {
    const cards = Object.values(doc.srs);
    const mastered = cards.filter((c) => c.st >= 21 && c.streak >= 3).length;
    const minutes = Object.values(doc.activity).reduce((a, d) => a + d.min, 0);
    return {
      vocabLearned: cards.filter((c) => c.n > 0).length,
      mastered,
      kanjiStudied: Object.keys(doc.writing).length + Object.values(doc.srs).filter((c) => c.n > 0).length * 0,
      reviews: cards.reduce((a, c) => a + c.n, 0),
      streak: 0,
      days: Object.keys(doc.activity).filter((k) => doc.activity[k].xp > 0).length,
      minutes,
      grammarDone: doc.grammarDone.length,
      readingDone: doc.readingDone.length,
      listeningDone: doc.listeningDone.length,
      writingDone: Object.keys(doc.writing).length,
      exams: doc.exams.length,
      examsPassed: doc.exams.filter((e) => e.passed).length,
      level: doc.profile.current,
      kanaBest: doc.kanaBest,
      xp: doc.xp,
    };
  }, [doc]);

  const streak = useMemo(() => computeStreak(doc.activity), [doc.activity]);
  inputs.streak = streak;

  const unlockedIds = useMemo(
    () => ACHIEVEMENTS.filter((a) => a.progress(inputs) >= 1).map((a) => a.id),
    [inputs],
  );

  useEffect(() => {
    setDoc((d) => {
      const missing = unlockedIds.filter((id) => !d.achievements[id]);
      if (!missing.length) return d;
      const at = Date.now();
      return { ...d, achievements: { ...d.achievements, ...Object.fromEntries(missing.map((id) => [id, at])) } };
    });
  }, [unlockedIds]);

  /* ── Cloud sync ── */
  const push = useCallback(async (force = false) => {
    if (!account || !navigator.onLine) return;
    if (!force && !dirty.current) return;
    setSyncing("syncing");
    try {
      const res = await api.putSync(doc, rev.current);
      rev.current = res.rev;
      dirty.current = false;
      setLastSync(Date.now());
      setSyncing("ok");
      window.setTimeout(() => setSyncing("idle"), 1500);
    } catch {
      setSyncing("error");
    }
  }, [account, doc]);

  const pull = useCallback(async () => {
    if (!account) return;
    try {
      const remote = await api.getSync();
      if (remote.rev > rev.current) {
        rev.current = remote.rev;
        const incoming = remote.doc as Partial<Doc> | null;
        if (incoming && (incoming.updatedAt ?? 0) > doc.updatedAt) {
          setDoc({ ...freshDoc(), ...incoming, profile: { ...DEFAULT_PROFILE, ...(incoming.profile ?? {}) } } as Doc);
        }
      }
    } catch {
      /* офлайн — дараа дахин оролдоно */
    }
  }, [account, doc.updatedAt]);

  useEffect(() => {
    if (!account) return;
    pull().then(() => push(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  useEffect(() => {
    if (!account) return;
    const t = window.setInterval(() => push(), 25_000);
    return () => window.clearInterval(t);
  }, [account, push]);

  /* ── аккаунт солих үед документыг солих ── */
  const switchUser = useCallback((nextUid: string, nextAccount: Account | null) => {
    writeDoc(uid, doc);
    setUid(nextUid);
    setAccount(nextAccount);
    localStorage.setItem(SESSION_KEY, nextUid);
    rev.current = 0;
    setDoc(readDoc(nextUid) ?? freshDoc(nextAccount?.name ?? ""));
  }, [uid, doc]);

  const patch = useCallback((fn: (d: Doc) => Doc) => setDoc((d) => ({ ...fn(d), updatedAt: Date.now() })), []);

  /* ─────────── actions ─────────── */
  const actions = useMemo<Actions>(() => ({
    patchProfile: (p) => patch((d) => ({ ...d, profile: { ...d.profile, ...p } })),

    grade: (id, g, meta) => patch((d) => {
      const card = schedule(d.srs[id], g);
      const gain = [XP.reviewAgain, XP.reviewHard, XP.reviewGood, XP.reviewEasy][g] + (meta?.isNew ? XP.newCard : 0);
      return {
        ...d,
        srs: { ...d.srs, [id]: card },
        ...bumpDayInto(d, { xp: gain, reviews: 1, newCards: meta?.isNew ? 1 : 0, correct: g > 0 ? 1 : 0, total: 1 }),
      };
    }),

    gradeMany: (items) => patch((d) => {
      const srs = { ...d.srs };
      let xp = 0, newCards = 0;
      for (const it of items) {
        srs[it.id] = schedule(srs[it.id], it.g);
        xp += it.g > 0 ? 2 : 1;
        if (it.isNew) newCards++;
      }
      return { ...d, srs, ...bumpDayInto(d, { xp, reviews: items.length, newCards }) };
    }),

    addXP: (n) => patch((d) => ({ ...d, ...bumpDayInto(d, { xp: n }) })),
    addMinutes: (n) => patch((d) => ({ ...d, ...bumpDayInto(d, { min: n }) })),

    logQuiz: (r) => patch((d) => ({
      ...d,
      quizzes: [{ ...r, at: Date.now() }, ...d.quizzes].slice(0, 200),
      ...bumpDayInto(d, { correct: r.correct, total: r.total, xp: r.correct * XP.quizCorrect, min: r.minutes }),
    })),

    recordExam: (r) => patch((d) => ({
      ...d,
      exams: [r, ...d.exams].slice(0, 60),
      ...bumpDayInto(d, { xp: r.total * XP.examQuestion + (r.passed ? XP.examPass : 0), min: r.minutes, correct: r.total, total: r.max }),
    })),

    toggleGrammar: (id, _level, on) => patch((d) => {
      const has = d.grammarDone.includes(id);
      const want = on ?? !has;
      if (want === has) return d;
      return {
        ...d,
        grammarDone: want ? [...d.grammarDone, id] : d.grammarDone.filter((x) => x !== id),
        ...(want ? bumpDayInto(d, { xp: XP.grammarDone }) : {}),
      };
    }),

    markReading: (id) => patch((d) => (d.readingDone.includes(id) ? d : {
      ...d,
      readingDone: [...d.readingDone, id],
      ...bumpDayInto(d, { xp: XP.readingDone }),
    })),

    markListening: (id) => patch((d) => (d.listeningDone.includes(id) ? d : {
      ...d,
      listeningDone: [...d.listeningDone, id],
      ...bumpDayInto(d, { xp: XP.listeningDone }),
    })),

    recordWriting: (kanji, score) => patch((d) => {
      const prev = d.writing[kanji];
      const best = Math.max(prev?.best ?? 0, score);
      return {
        ...d,
        writing: { ...d.writing, [kanji]: { best, tries: (prev?.tries ?? 0) + 1, at: Date.now() } },
        ...bumpDayInto(d, { xp: XP.writing }),
      };
    }),

    setMnemonic: (kanji, text) => patch((d) => ({ ...d, mnemonics: { ...d.mnemonics, [kanji]: text } })),

    toggleFavorite: (id) => patch((d) => ({
      ...d,
      favorites: d.favorites.includes(id) ? d.favorites.filter((x) => x !== id) : [...d.favorites, id],
    })),

    setKanaBest: (n) => patch((d) => ({ ...d, kanaBest: Math.max(d.kanaBest, n) })),

    addMistakes: (list) => patch((d) => {
      const map = new Map(d.mistakes.map((m) => [m.id, m]));
      for (const m of list) {
        const prev = map.get(m.id);
        map.set(m.id, { ...m, at: Date.now(), count: (prev?.count ?? 0) + 1 });
      }
      return {
        ...d,
        mistakes: [...map.values()].filter((m) => m.count > 0).sort((a, b) => b.at - a.at).slice(0, 400),
      };
    }),

    resolveMistake: (id) => patch((d) => ({
      ...d,
      mistakes: d.mistakes
        .map((m) => (m.id === id ? { ...m, count: m.count - 1 } : m))
        .filter((m) => m.count > 0),
    })),
    clearMistakes: () => patch((d) => ({ ...d, mistakes: [] })),

    setPlacement: (level, detail) => patch((d) => ({
      ...d,
      placement: { level, at: Date.now(), detail },
      profile: { ...d.profile, current: level },
      ...bumpDayInto(d, { xp: XP.placement }),
    })),

    startCurriculum: (level, days) => patch((d) => ({
      ...d,
      curriculum: { level, days, startedAt: Date.now(), done: {} },
      profile: { ...d.profile, target: level },
    })),

    completeCurriculumDay: (day, counts) => patch((d) => {
      if (!d.curriculum) return d;
      const at = Date.now();
      return {
        ...d,
        curriculum: {
          ...d.curriculum,
          done: {
            ...d.curriculum.done,
            [day]: { at, vocab: 0, kanji: 0, grammar: 0, reading: 0, listening: 0, ...counts },
          },
        },
        ...bumpDayInto(d, { xp: 20 }),
      };
    }),

    /* ── аккаунт ── */
    signUp: async (email, password, name) => {
      const res = await api.register(email, password, name);
      setToken(res.token);
      localStorage.setItem("nd:token", res.token);
      switchUser(res.account.id, res.account);
      setDoc((d) => ({ ...d, profile: { ...d.profile, name: name || d.profile.name } }));
    },

    signIn: async (email, password) => {
      const res = await api.login(email, password);
      setToken(res.token);
      localStorage.setItem("nd:token", res.token);
      switchUser(res.account.id, res.account);
    },

    signOut: async () => {
      await api.logout().catch(() => null);
      setToken(null);
      localStorage.removeItem("nd:token");
      switchUser(GUEST, null);
    },

    guestMode: () => {
      setToken(null);
      localStorage.removeItem("nd:token");
      switchUser(GUEST, null);
    },

    redeemCode: async (code) => {
      const res = await api.redeemPairCode(code);
      setToken(res.token);
      localStorage.setItem("nd:token", res.token);
      switchUser(res.account.id, res.account);
      await pull();
    },

    syncNow: async () => { await push(true); await pull(); },

    exportJSON: () => JSON.stringify(doc, null, 2),

    importJSON: (raw) => {
      try {
        const parsed = JSON.parse(raw) as Partial<Doc>;
        if (!parsed || typeof parsed !== "object") return false;
        setDoc({ ...freshDoc(), ...parsed, profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) } } as Doc);
        return true;
      } catch {
        return false;
      }
    },

    reset: () => { setDoc(freshDoc(doc.profile.name)); },
  }), [patch, push, pull, switchUser, doc.profile.name]);

  const today = doc.activity[todayKey()] ?? emptyDay();
  const levelInfo = useMemo(() => xpLevel(doc.xp), [doc.xp]);

  const nextAchievement = useMemo(() => {
    let best: { id: string; title: string; desc: string; icon: string; pct: number } | null = null;
    for (const a of ACHIEVEMENTS) {
      if (doc.achievements[a.id]) continue;
      const p = a.progress(inputs);
      if (p <= 0 || p >= 1) continue;
      if (!best || p > best.pct) best = { id: a.id, title: a.title, desc: a.desc, icon: a.icon, pct: p };
    }
    return best;
  }, [inputs, doc.achievements]);

  const value: Ctx = {
    doc, account, offline, syncing, lastSync, serverAvailable,
    today, streak, levelInfo, inputs,
    unlocked: Object.entries(doc.achievements).map(([id, at]) => ({ id, at })).sort((a, b) => b.at - a.at),
    nextAchievement,
    actions,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider олдсонгүй");
  return c;
}

/* ─────────────── туслах ─────────────── */

function bumpDay(d: Doc, delta: Partial<ActivityDay>): Doc {
  return { ...d, ...bumpDayInto(d, delta) };
}

function bumpDayInto(d: Doc, delta: Partial<ActivityDay>): Partial<Doc> {
  const k = todayKey();
  const cur = d.activity[k] ?? emptyDay();
  const xp = delta.xp ?? 0;
  return {
    xp: d.xp + xp,
    activity: {
      ...d.activity,
      [k]: {
        xp: cur.xp + xp,
        min: cur.min + (delta.min ?? 0),
        newCards: cur.newCards + (delta.newCards ?? 0),
        reviews: cur.reviews + (delta.reviews ?? 0),
        correct: cur.correct + (delta.correct ?? 0),
        total: cur.total + (delta.total ?? 0),
      },
    },
  };
}

export function computeStreak(activity: Record<string, ActivityDay>) {
  let n = 0;
  let key = todayKey();
  if (!(activity[key]?.xp > 0)) key = dayOffset(key, -1);
  while (activity[key]?.xp > 0) {
    n++;
    key = dayOffset(key, -1);
  }
  return n;
}

/** Хамгийн урт цуваа (бүх түүхээс). */
export function longestStreak(activity: Record<string, ActivityDay>) {
  const days = Object.entries(activity).filter(([, d]) => d.xp > 0).map(([k]) => k).sort();
  let best = 0, run = 0, prev = "";
  for (const k of days) {
    run = prev && dayOffset(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}
