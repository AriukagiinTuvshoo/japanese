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
import { clampPlanDays } from "./plan";
import {
  SCHEMA_VERSION, emptyDay, freshDoc,
  type ActivityDay, type Doc, type ExamRecord, type Mistake, type Profile, type QuizRecord,
} from "./doc";
import { ACHIEVEMENTS, XP, xpLevel, type AchievementInput } from "./gamification";
import { applyGrade } from "./flashcard";
import { recordWritingResult } from "./writing";
import { isMastered, schedule, type Grade } from "./srs";
import { examTotals } from "./study";
import {
  backupKeyOf, decodeDoc, docKeyOf, docsEqual, mergeDocs, normalizeDocValue, readDoc, writeDoc, type WriteResult,
} from "./storage";
import { clearTodayState } from "./today";
import { addMistakes as addMistakesToDoc, dropAllMistakes, resolveMistake as resolveMistakeDoc, setFavorite, toggleGrammarDone } from "./deletions";
import { dayOffset, todayKey } from "./text";
import type { Level } from "./types";

/* ─────────────── Төрлүүд ─────────────── */

export type { ActivityDay, CurriculumState, Doc, ExamRecord, Mistake, Profile, QuizRecord } from "./doc";

/** Хадгалалтын ноцтой байдал — хэрэглэгчид мэдэгдэх зорилготой. */
export interface StorageIssue {
  kind: "corrupt" | "future" | "quota" | "error";
  raw?: string;
  backupKey?: string;
  futureVersion?: number;
  detail?: string;
}

const SESSION_KEY = "nd:session";
const GUEST = "local";

/** Анхны уншилт — гэмтсэн/шинэ хувилбарын өгөгдлийг хэзээ ч дарж бичихгүй. */
function loadInitial(uid: string): { doc: Doc; issue: StorageIssue | null } {
  const res = readDoc(localStorage, uid);
  if (res.status === "ok" && res.doc) return { doc: res.doc, issue: null };
  if (res.status === "future") {
    return { doc: freshDoc(), issue: { kind: "future", raw: res.raw, futureVersion: res.futureVersion } };
  }
  if (res.status === "corrupt") {
    return { doc: freshDoc(), issue: { kind: "corrupt", raw: res.raw, backupKey: res.backupKey } };
  }
  return { doc: freshDoc(), issue: null };
}

/* ─────────────── Контекст ─────────────── */

interface Ctx {
  doc: Doc;
  /** Одоогийн хадгалалтын uid (`local` = зочин) — өдрийн UI төлөвийг тусгаарлана. */
  uid: string;
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
  /** Хадгалалтын асуудал (гэмтсэн/шинэ хувилбар/дүүрсэн) — байхгүй бол null. */
  storageIssue: StorageIssue | null;
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
  cancelCurriculum: () => void;
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

  /* хадгалалт */
  downloadBackup: () => void;
  startFresh: () => void;
  dismissIssue: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string>(() => localStorage.getItem(SESSION_KEY) ?? GUEST);
  const [account, setAccount] = useState<Account | null>(null);
  const bootRef = useRef<{ doc: Doc; issue: StorageIssue | null } | null>(null);
  if (!bootRef.current) bootRef.current = loadInitial(localStorage.getItem(SESSION_KEY) ?? GUEST);
  const boot = bootRef.current;
  const [doc, setDoc] = useState<Doc>(boot.doc);
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(boot.issue);
  // Actions-ийн identity-г тогтвортой барихын тулд хамгийн сүүлийн баримтыг ref-д хадгална.
  const docRef = useRef(doc);
  docRef.current = doc;
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

  /*
   * Бичих: диск дээр илүү шинэ баримт байвал дарахгүй — оронд нь нэгтгэж,
   * дараагийн эффект нэгтгэсэн төлөвийг бичнэ. Ингэснээр хуучин табын
   * state өөр табын шинэ ахицыг (XP, SRS, plan) устгахаас сэргийлнэ.
   */
  const persist = useCallback((next: Doc): WriteResult | null => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(docKeyOf(uid));
    } catch {
      raw = null;
    }
    if (raw) {
      const disk = decodeDoc(raw);
      if (disk.ok && disk.doc && disk.doc.updatedAt > next.updatedAt) {
        const merged = mergeDocs(next, disk.doc);
        setDoc((prev) => (docsEqual(merged, prev) ? prev : merged));
        /* Диск дээрх хуучин snapshot merge-ийн дараа ч tombstone-гүй байж
           болно (жишээ нь хуучин tab устгалыг мэдэхгүй бичсэн) — reload-д
           устсан бичлэг сэргэхээс сэргийлж, зөв нэгтгэлээр засна. */
        if (!docsEqual(merged, disk.doc)) writeDoc(localStorage, uid, merged);
        return null;
      }
    }
    return writeDoc(localStorage, uid, next);
  }, [uid]);

  /* ── localStorage-д хадгалах (debounce) ── */
  useEffect(() => {
    dirty.current = true;
    const t = window.setTimeout(() => {
      const res = persist(doc);
      // null = диск дээрх шинэ өгөгдөлтэй нэгтгэж байна — дараагийн бичилт.
      if (!res) return;
      if (res.ok) {
        setStorageIssue((cur) => (cur && (cur.kind === "quota" || cur.kind === "error") ? null : cur));
        return;
      }
      // «blocked» = диск дээр гэмтсэн/шинэ хувилбарын өгөгдөл байна.
      // Түүнийг анхны уншилтад аль хэдийн мэдэгдсэн тул дахин дарж бичихгүй.
      if (res.reason === "blocked") return;
      setStorageIssue({ kind: res.reason === "quota" ? "quota" : "error", detail: res.message });
    }, 350);
    return () => window.clearTimeout(t);
  }, [doc, uid, persist]);

  /* ── tab хаагдах/нуугдахын өмнө хүлээгдэж буй бичилтийг албадан хийх ── */
  useEffect(() => {
    const flush = () => { persist(docRef.current); };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [persist]);

  /* ── бусад таб өгөгдөл бичсэн бол нэгтгэх (одоогийн табыг хэзээ ч дарж бичихгүй) ── */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== docKeyOf(uid) || !e.newValue) return;
      const res = decodeDoc(e.newValue);
      if (!res.ok) {
        setStorageIssue(
          res.reason === "future"
            ? { kind: "future", raw: e.newValue, futureVersion: res.futureVersion }
            : { kind: "corrupt", raw: e.newValue },
        );
        return;
      }
      const merged = mergeDocs(docRef.current, res.doc);
      /* Диск дээр tombstone-гүй хуучин snapshot үлдсэн бол заавал засна —
         эс бөгөөс reload хийхэд устсан бичлэг буцаж сэргэнэ. */
      if (!docsEqual(merged, res.doc)) writeDoc(localStorage, uid, merged);
      if (!docsEqual(merged, docRef.current)) setDoc(merged);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [uid]);

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
    const mastered = cards.filter(isMastered).length;
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
        // Серверээс ирсэн баримтыг ч гэсэн схемээр шалгаж, хувилбарыг шилжүүлнэ.
        const incoming = normalizeDocValue(remote.doc);
        if (incoming && incoming.updatedAt > doc.updatedAt) setDoc(incoming);
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
    writeDoc(localStorage, uid, doc);
    setUid(nextUid);
    setAccount(nextAccount);
    localStorage.setItem(SESSION_KEY, nextUid);
    rev.current = 0;
    const next = loadInitial(nextUid);
    // Шинэ (бөглөгдөөгүй) баримтад бүртгэлийн нэрийг онооно.
    const name = next.doc.profile.name || nextAccount?.name || "";
    setDoc(next.doc.profile.name === name ? next.doc : { ...next.doc, profile: { ...next.doc.profile, name } });
    setStorageIssue(next.issue);
  }, [uid, doc]);

  const patch = useCallback((fn: (d: Doc) => Doc) => setDoc((d) => ({ ...fn(d), updatedAt: Date.now() })), []);

  /* ─────────── actions ─────────── */
  const actions = useMemo<Actions>(() => ({
    patchProfile: (p) => patch((d) => ({ ...d, profile: { ...d.profile, ...p } })),

    grade: (id, g, meta) => patch((d) => {
      return applyGrade(d, id, g, { isNew: meta?.isNew, level: meta?.level });
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

    recordExam: (r) => {
      // Өдрийн нарийвчлалыг АСУУЛТЫН тоогоор бодно — оноо (max 180) биш.
      const counts = examTotals(r.sections);
      patch((d) => ({
        ...d,
        exams: [r, ...d.exams].slice(0, 60),
        ...bumpDayInto(d, {
          xp: counts.total * XP.examQuestion + (r.passed ? XP.examPass : 0),
          min: r.minutes,
          ...counts,
        }),
      }));
    },

    toggleGrammar: (id, _level, on) => patch((d) => {
      const res = toggleGrammarDone(d, id, on);
      if (res.doc === d) return d;
      return res.awarded
        ? { ...res.doc, ...bumpDayInto(res.doc, { xp: XP.grammarDone, grammar: 1 }) }
        : res.doc;
    }),

    markReading: (id) => patch((d) => (d.readingDone.includes(id) ? d : {
      ...d,
      readingDone: [...d.readingDone, id],
      ...bumpDayInto(d, { xp: XP.readingDone, reading: 1 }),
    })),

    markListening: (id) => patch((d) => (d.listeningDone.includes(id) ? d : {
      ...d,
      listeningDone: [...d.listeningDone, id],
      ...bumpDayInto(d, { xp: XP.listeningDone, listening: 1 }),
    })),

    recordWriting: (kanji, score) => patch((d) => recordWritingResult(d, kanji, score)),

    setMnemonic: (kanji, text) => patch((d) => ({ ...d, mnemonics: { ...d.mnemonics, [kanji]: text } })),

    toggleFavorite: (id) => patch((d) => setFavorite(d, id, !d.favorites.includes(id))),

    setKanaBest: (n) => patch((d) => ({ ...d, kanaBest: Math.max(d.kanaBest, n) })),

    addMistakes: (list) => patch((d) => addMistakesToDoc(d, list)),

    /* `resolved` monotonic — хуучин snapshot count-ыг буцааж өсгөхгүй. */
    resolveMistake: (id) => patch((d) => resolveMistakeDoc(d, id)),
    clearMistakes: () => patch((d) => dropAllMistakes(d)),

    setPlacement: (level, detail) => patch((d) => ({
      ...d,
      placement: { level, at: Date.now(), detail },
      profile: { ...d.profile, current: level },
      ...bumpDayInto(d, { xp: XP.placement }),
    })),

    startCurriculum: (level, days) => patch((d) => ({
      ...d,
      curriculum: { level, days: clampPlanDays(days), startedAt: Date.now(), done: {} },
      profile: { ...d.profile, target: level },
    })),

    /** Төлөвлөгөөг бүрэн устгана — 0 хоногийн «хоосон» план үлдээхгүй. */
    cancelCurriculum: () => patch((d) => {
      const { curriculum: _drop, ...rest } = d;
      return rest;
    }),

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

    exportJSON: () => JSON.stringify({ ...docRef.current, v: SCHEMA_VERSION }, null, 2),

    importJSON: (raw) => {
      // Зөвхөн баталгаажсан баримт хүлээж авна; одоогийнхыг нөөцөлж хадгална.
      const res = decodeDoc(raw);
      if (!res.ok) return false;
      try {
        localStorage.setItem(backupKeyOf(uid, `pre-import-${Date.now()}`), JSON.stringify(docRef.current));
      } catch {
        /* нөөц хадгалагдахгүй бол ч урьдчилсан баталгаажуулалт хамгаална */
      }
      const next = { ...res.doc, updatedAt: Date.now() };
      writeDoc(localStorage, uid, next, { allowOverwrite: true });
      setDoc(next);
      setStorageIssue(null);
      return true;
    },

    reset: () => {
      const next = freshDoc(docRef.current.profile.name);
      writeDoc(localStorage, uid, next, { allowOverwrite: true });
      /* Өдрийн эхэлсэн/хойшлуулсан UI төлөв ч хамт цэвэрлэгдэнэ. */
      clearTodayState(localStorage, todayKey(), uid);
      setDoc(next);
      setStorageIssue(null);
    },

    /* ── хадгалалтын мэдэгдэл ── */
    downloadBackup: () => {
      const raw = storageIssue?.raw;
      if (!raw) return;
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nihongo-dojo-backup-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    startFresh: () => {
      const next = freshDoc(docRef.current.profile.name);
      const res = writeDoc(localStorage, uid, next, { allowOverwrite: true });
      if (!res.ok) {
        setStorageIssue({ kind: res.reason === "quota" ? "quota" : "error", detail: res.message });
        return;
      }
      clearTodayState(localStorage, todayKey(), uid);
      setDoc(next);
      setStorageIssue(null);
    },

    dismissIssue: () => setStorageIssue(null),
  }), [patch, push, pull, switchUser, uid, storageIssue]);

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
    doc, uid, account, offline, syncing, lastSync, serverAvailable,
    today, streak, levelInfo, inputs,
    unlocked: Object.entries(doc.achievements).map(([id, at]) => ({ id, at })).sort((a, b) => b.at - a.at),
    nextAchievement,
    storageIssue,
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
  /* `updatedAt`-ыг ч шинэчилнэ — минут тутмын ахиц ч merge/шинэ эсэхэд тооцогдоно. */
  return { ...d, ...bumpDayInto(d, delta), updatedAt: Date.now() };
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
        grammar: cur.grammar + (delta.grammar ?? 0),
        reading: cur.reading + (delta.reading ?? 0),
        listening: cur.listening + (delta.listening ?? 0),
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
