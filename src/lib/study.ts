/**
 * LEARNING ENGINE — дасгал, шалгалт, төлөвлөгөө үүсгэгч.
 * ------------------------------------------------------------------
 * Бүх асуулт нь `public/data/**` доторх бодит контентоос үүснэ.
 * Хиймэл оюун ухаан контент зохиохгүй — зөвхөн эх сангаас сонгож,
 * буруу хариултыг мөн адил бодит өгөгдлөөс гаргана.
 */
import { LEVEL_META } from "../data/levels";
import type { Language } from "./i18n";
import { MN_PENDING, grammarEn } from "./i18n";
import type { Grammar, Kanji, Level, Vocab } from "./types";
import { LEVELS } from "./types";
import { pick, shuffle } from "./data";

export interface Question {
  id: string;
  kind: string;
  level: Level;
  /** Асуултын толгой хэсэг (япон). */
  prompt: string;
  promptSub?: string;
  /** Толь бичгийн popover-д. */
  refId?: string;
  refKanji?: string;
  options: string[];
  answer: number;
  /** Зөв хариултын тайлбар (монгол). */
  explain?: string;
  example?: { ja: string; mn?: string; en?: string };
  audio?: string;
  section: string;
}

export type QuizMode =
  | "vocab-jp-mn" | "vocab-mn-jp" | "vocab-read" | "vocab-listen" | "vocab-fill"
  | "kanji-mn" | "kanji-read" | "kanji-stroke"
  | "grammar-mn" | "grammar-use"
  | "reading" | "listening"
  | "mixed" | "weak" | "mistakes";

/** Асуултын хэсэг, дэд гарчгийн хоёр хэлний шошго (энгийн текст өгөгдөл дээр суурилна). */
export const SECTION_LABEL: Record<Language, Record<string, string>> = {
  mn: { "Үгийн сан": "Үгийн сан", "Уншлага": "Уншлага", "Сонсгол": "Сонсгол", "Өгүүлбэр бөглөх": "Өгүүлбэр бөглөх", "Ханз": "Ханз", "Дүрэм": "Дүрэм" },
  en: { "Үгийн сан": "Vocabulary", "Уншлага": "Reading", "Сонсгол": "Listening", "Өгүүлбэр бөглөх": "Fill the blank", "Ханз": "Kanji", "Дүрэм": "Grammar" },
};

export const PROMPT_SUB: Record<Language, Record<string, string>> = {
  mn: {
    "Энэ утгатай япон үг аль вэ?": "Энэ утгатай япон үг аль вэ?",
    "Хэрхэн унших вэ?": "Хэрхэн унших вэ?",
    "Дутуу үгийг бөглө": "Дутуу үгийг бөглө",
    "Хэдэн зурлагатай вэ?": "Хэдэн зурлагатай вэ?",
    "Уншлагыг сонго": "Уншлагыг сонго",
    "Утгыг сонго": "Утгыг сонго",
    "Энэ дүрмийн утга аль вэ?": "Энэ дүрмийн утга аль вэ?",
  },
  en: {
    "Энэ утгатай япон үг аль вэ?": "Which Japanese word has this meaning?",
    "Хэрхэн унших вэ?": "How is it read?",
    "Дутуу үгийг бөглө": "Fill in the missing word",
    "Хэдэн зурлагатай вэ?": "How many strokes?",
    "Уншлагыг сонго": "Choose the reading",
    "Утгыг сонго": "Choose the meaning",
    "Энэ дүрмийн утга аль вэ?": "What does this pattern mean?",
  },
};

export const QUIZ_MODES: { id: QuizMode; label: string; desc: string; labelEn: string; descEn: string; icon: string; tone: "shu" | "ai" | "matcha" | "kin" | "murasaki" }[] = [
  { id: "vocab-jp-mn", label: "Япон → Монгол", desc: "Үгийн утгыг таа", labelEn: "Japanese → English", descEn: "Pick the word meaning", icon: "語", tone: "shu" },
  { id: "vocab-mn-jp", label: "Монгол → Япон", desc: "Утгаас үгийг сана", labelEn: "English → Japanese", descEn: "Recall the word from its meaning", icon: "蒙", tone: "ai" },
  { id: "vocab-read", label: "Уншлага", desc: "Ханзны уншлагыг сонго", labelEn: "Reading", descEn: "Choose the correct reading", icon: "音", tone: "kin" },
  { id: "vocab-listen", label: "Сонсгол", desc: "Дуудлагыг сонсоод таа", labelEn: "Listening", descEn: "Listen and pick the meaning", icon: "聴", tone: "murasaki" },
  { id: "vocab-fill", label: "Өгүүлбэр бөглөх", desc: "Жишээн дэх дутуу үг", labelEn: "Fill the blank", descEn: "Complete the example sentence", icon: "文", tone: "matcha" },
  { id: "kanji-mn", label: "Ханзны утга", desc: "Ханзны утгыг таа", labelEn: "Kanji meaning", descEn: "Pick the kanji meaning", icon: "漢", tone: "shu" },
  { id: "kanji-read", label: "Ханзны уншлага", desc: "Он/кун уншлага", labelEn: "Kanji reading", descEn: "On/kun reading", icon: "読", tone: "ai" },
  { id: "kanji-stroke", label: "Зурлагын тоо", desc: "Хэдэн зурлагатай вэ", labelEn: "Stroke count", descEn: "How many strokes", icon: "筆", tone: "kin" },
  { id: "grammar-mn", label: "Дүрмийн утга", desc: "Дүрмийн утгыг таа", labelEn: "Grammar meaning", descEn: "Pick the pattern meaning", icon: "文", tone: "murasaki" },
  { id: "grammar-use", label: "Дүрэм хэрэглээ", desc: "Зөв өгүүлбэрийг сонго", labelEn: "Grammar usage", descEn: "Pick the correct sentence", icon: "用", tone: "matcha" },
  { id: "mixed", label: "Холимог", desc: "Бүх төрлөөс хольж", labelEn: "Mixed", descEn: "All kinds combined", icon: "混", tone: "shu" },
  { id: "weak", label: "Сул тал", desc: "Алдаж буй зүйлсээ давт", labelEn: "Weak points", descEn: "Drill what you miss", icon: "弱", tone: "shu" },
  { id: "mistakes", label: "Алдааны дэвтэр", desc: "Алдсан асуултуудаа", labelEn: "Mistake log", descEn: "The ones you got wrong", icon: "誤", tone: "kin" },
];

const opt = (v: Vocab) => v.mn?.[0] ?? v.en[0];
const rnd = Math.random;

function distractors<T>(pool: T[], exclude: (x: T) => boolean, n: number, key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of shuffle(pool.filter((p) => !exclude(p)), rnd)) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

/** Түвшнээс хамаарч ижил түвшний үгсийг эхлээд авна. */
function poolFor<T extends { lvl: Level }>(all: T[], lvl: Level, span = 1): T[] {
  const idx = LEVELS.indexOf(lvl);
  const allowed = LEVELS.slice(Math.max(0, idx - span), Math.min(LEVELS.length, idx + span + 1));
  const strict = all.filter((x) => x.lvl === lvl);
  return strict.length >= 40 ? strict : all.filter((x) => allowed.includes(x.lvl));
}

/* ─────────────── Үг → асуулт ─────────────── */
function vocabQuestion(v: Vocab, pool: Vocab[], mode: QuizMode, language: Language = "mn"): Question | null {
  const meaning = (x: Vocab) => (language === "en" ? x.en.join("; ") : x.mn?.length ? x.mn.join(", ") : MN_PENDING);
  const sect = (m: string) => SECTION_LABEL[language][m] ?? m;
  const sub = (m: string) => PROMPT_SUB[language][m] ?? m;
  const others = distractors(pool, (x) => x.id === v.id, 3, opt);
  if (others.length < 3) return null;
  const opts = shuffle([v, ...others], rnd);

  switch (mode) {
    case "vocab-jp-mn": {
      if (!v.mn?.[0] && !v.en[0]) return null;
      const answer = opts.indexOf(v);
      return {
        id: `v-jm-${v.id}`, kind: "vocab", level: v.lvl, section: sect("Үгийн сан"),
        prompt: v.w, promptSub: v.r, refId: v.id,
        options: opts.map(language === "en" ? (o) => o.en.join("; ") : opt), answer,
        explain: `${v.w}（${v.r}） = ${meaning(v)}`,
        example: v.ex[0] ? { ja: v.ex[0].fg ?? v.ex[0].ja, en: v.ex[0].en, mn: v.ex[0].mn ?? undefined } : undefined,
      };
    }
    case "vocab-mn-jp": {
      const mn = opt(v);
      if (!mn) return null;
      return {
        id: `v-mj-${v.id}`, kind: "vocab", level: v.lvl, section: sect("Үгийн сан"),
        prompt: mn, promptSub: sub("Энэ утгатай япон үг аль вэ?"), refId: v.id,
        options: opts.map((o) => o.w), answer: opts.indexOf(v),
        explain: `${mn} → ${v.w}（${v.r}）`,
      };
    }
    case "vocab-read": {
      if (!v.kd.length) return null; // зөвхөн кана үгэнд уншлага таах нь утгагүй
      return {
        id: `v-rd-${v.id}`, kind: "vocab", level: v.lvl, section: sect("Уншлага"),
        prompt: v.w, promptSub: sub("Хэрхэн унших вэ?"), refId: v.id,
        options: opts.map((o) => o.r), answer: opts.indexOf(v),
        explain: `${v.w} → ${v.r}　（${language === "en" ? v.en.join("; ") : opt(v)}）`,
      };
    }
    case "vocab-listen": {
      return {
        id: `v-ls-${v.id}`, kind: "vocab", level: v.lvl, section: sect("Сонсгол"),
        prompt: "🔊", promptSub: v.r, refId: v.id, audio: v.w,
        options: opts.map(language === "en" ? (o) => o.en.join("; ") : opt), answer: opts.indexOf(v),
        explain: `${v.w}（${v.r}） = ${meaning(v)}`,
      };
    }
    default:
      return null;
  }
}

/** `{漢字|かんじ}` markup-д тулгуурлан өгүүлбэрээс үг хасна. */
function fillBlank(v: Vocab, language: Language = "mn"): Question | null {
  const ex = v.ex.find((e) => e.fg && e.fg.includes(v.w));
  const plain = v.ex.find((e) => e.ja.includes(v.w));
  const sentence = ex?.fg ?? plain?.ja;
  if (!sentence || !sentence.includes(v.w)) return null;
  const hidden = sentence.replaceAll(v.w, "＿＿＿");
  return {
    id: `v-fb-${v.id}`, kind: "vocab", level: v.lvl, section: SECTION_LABEL[language]["Өгүүлбэр бөглөх"] ?? "Өгүүлбэр бөглөх",
    prompt: hidden, promptSub: PROMPT_SUB[language]["Дутуу үгийг бөглө"] ?? "Дутуу үгийг бөглө", refId: v.id,
    options: [], answer: 0,
    explain: `${v.w}（${v.r}） = ${language === "en" ? v.en.join("; ") : v.mn?.join(", ") ?? v.en.join("; ")}`,
    example: { ja: sentence, en: ex?.en ?? plain?.en, mn: ex?.mn ?? plain?.mn ?? undefined },
  };
}

/* ─────────────── Ханз → асуулт ─────────────── */
function kanjiQuestion(k: Kanji, pool: Kanji[], mode: QuizMode, language: Language = "mn"): Question | null {
  if (mode === "kanji-stroke") {
    if (!k.s) return null;
    const values = new Set([k.s]);
    for (const x of shuffle(pool, rnd)) {
      if (x.s && values.size < 4) values.add(x.s);
    }
    if (values.size < 3) return null;
    const opts = shuffle([...values], rnd);
    return {
      id: `k-st-${k.k}`, kind: "kanji", level: k.lvl, section: SECTION_LABEL[language]["Ханз"] ?? "Ханз",
      prompt: k.k, promptSub: PROMPT_SUB[language]["Хэдэн зурлагатай вэ?"] ?? "Хэдэн зурлагатай вэ?", refKanji: k.k,
      options: opts.map((n) => `${n}`), answer: opts.indexOf(k.s),
      explain: `${k.k} — ${k.s} зурлага${k.mn[0] ? ` · ${k.mn[0]}` : ""}`,
    };
  }

  const kMeaning = (x: Kanji) => (language === "en" ? (x.en[0] ?? x.mn[0] ?? x.k) : (x.mn[0] ?? x.en[0] ?? x.k));
  const others = distractors(pool, (x) => x.k === k.k, 3, (x) => mode === "kanji-read" ? (x.on[0] ?? x.kun[0] ?? x.k) : kMeaning(x));
  if (others.length < 3) return null;
  const opts = shuffle([k, ...others], rnd);
  const isRead = mode === "kanji-read";

  return {
    id: `k-${isRead ? "rd" : "mn"}-${k.k}`, kind: "kanji", level: k.lvl, section: SECTION_LABEL[language]["Ханз"] ?? "Ханз",
    prompt: k.k, promptSub: isRead ? (PROMPT_SUB[language]["Уншлагыг сонго"] ?? "Уншлагыг сонго") : (PROMPT_SUB[language]["Утгыг сонго"] ?? "Утгыг сонго"), refKanji: k.k,
    options: opts.map((o) => isRead ? (o.on[0] ?? o.kun[0] ?? o.k) : kMeaning(o)),
    answer: opts.indexOf(k),
    explain: isRead
      ? `${k.k} — 音: ${k.on.join("・") || "—"}　訓: ${k.kun.join("・") || "—"}`
      : `${k.k} = ${language === "en" ? (k.en.join(", ") || k.mn.join(", ")) : (k.mn.join(", ") || k.en.join(", "))}`,
  };
}

/* ─────────────── Дүрэм → асуулт ─────────────── */
function grammarQuestion(g: Grammar, pool: Grammar[], language: Language = "mn"): Question | null {
  const clean = (s: string) => s.replace(/[〜~]/g, "");
  /** Active-language meaning: EN → English; MN → Mongolian (skip items with no MN). */
  const meaning = (x: Grammar): string =>
    language === "en" ? grammarEn(x) : (x.mn ?? "");
  // In MN mode, skip grammar items that have no MN translation
  if (language === "mn" && !g.mn) return null;
  if (!meaning(g)) return null;

  // Distractor pool: only items with the needed translation
  const distractorPool = language === "mn"
    ? pool.filter((x) => x.mn)
    : pool;
  const others = distractors(distractorPool, (x) => x.id === g.id, 3, meaning);
  if (others.length < 3) return null;

  const opts = shuffle([g, ...others], rnd);
  const meaningOf = (x: Grammar) => meaning(x);
  return {
    id: `g-${g.id}`, kind: "grammar", level: g.lvl, section: SECTION_LABEL[language]["Дүрэм"] ?? "Дүрэм",
    prompt: g.p, promptSub: PROMPT_SUB[language]["Энэ дүрмийн утга аль вэ?"] ?? "Энэ дүрмийн утга аль вэ?",
    options: opts.map(meaningOf), answer: opts.indexOf(g),
    explain: `${clean(g.p)} — ${meaningOf(g)}${g.note ? `\n${g.note}` : ""}`,
    example: g.ex[0]?.ja ? { ja: g.ex[0].fg ?? g.ex[0].ja, en: g.ex[0].en, mn: g.ex[0].mn ?? undefined } : undefined,
  };
}

/* ─────────────── Композит үүсгэгч ─────────────── */
export interface QuizRequest {
  mode: QuizMode;
  level: Level;
  count: number;
  /** Сонгосон нэгжүүд (жишээ нь зөвхөн 1-р бүлэг). */
  restrictIds?: string[];
  /** Сул төрлүүд — жин нэмэгдэнэ. */
  weights?: Partial<Record<string, number>>;
  /** Асуултын текстийн хэл (UI хэлтэй таарна). */
  lang?: Language;
}

export interface QuizSet {
  questions: Question[];
  mode: QuizMode;
  level: Level;
}

export function buildQuiz(
  req: QuizRequest,
  data: { vocab: Vocab[]; kanji: Kanji[]; grammar: Grammar[]; weakKinds?: string[]; mistakeIds?: string[] },
): QuizSet {
  const { mode, level, count } = req;
  const language: Language = req.lang ?? "mn";
  const vPool = poolFor(data.vocab, level);
  const kPool = poolFor(data.kanji, level);
  const gPool = poolFor(data.grammar, level);

  let out: Question[] = [];

  const push = (q: Question | null) => { if (q) out.push(q); };

  const pickVocab = (n: number) => {
    const source = req.restrictIds?.length ? vPool.filter((v) => req.restrictIds!.includes(v.id)) : vPool;
    return pick(source.length ? source : vPool, n);
  };

  const realModes: QuizMode[] = mode === "mixed"
    ? ["vocab-jp-mn", "vocab-mn-jp", "vocab-read", "kanji-mn", "kanji-read", "grammar-mn"]
    : mode === "weak"
      ? ((data.weakKinds?.length ? data.weakKinds : ["vocab-jp-mn", "grammar-mn"]) as QuizMode[])
      : [mode];

  const per = Math.max(1, Math.ceil(count / realModes.length));

  for (const m of realModes) {
    switch (m) {
      case "vocab-jp-mn":
      case "vocab-mn-jp":
      case "vocab-read":
      case "vocab-listen":
        for (const v of pickVocab(per * 2)) {
          if (out.filter((q) => q.kind === "vocab").length >= per + out.length - out.filter((q) => q.kind === "vocab").length) break;
          push(vocabQuestion(v, vPool, m, language));
          if (out.length >= per) break;
        }
        break;
      case "vocab-fill": {
        const withEx = vPool.filter((v) => v.ex.length && v.w.length > 1);
        for (const v of pick(withEx, per * 3)) {
          if (out.length >= per) break;
          const q = fillBlank(v, language);
          if (q) q.options = shuffle([v.w, ...distractors(vPool, (x) => x.id === v.id, 3, (x) => x.w).map((x) => x.w)], rnd);
          if (q) { q.answer = q.options.indexOf(v.w); push(q); }
        }
        break;
      }
      case "kanji-mn":
      case "kanji-read":
      case "kanji-stroke":
        for (const k of pick(kPool, per * 2)) {
          if (out.length >= per) break;
          push(kanjiQuestion(k, kPool, m, language));
        }
        break;
      case "grammar-mn":
      case "grammar-use":
        for (const g of pick(gPool, per * 2)) {
          if (out.length >= per) break;
          push(grammarQuestion(g, gPool, language));
        }
        break;
      default:
        break;
    }
  }

  // Алдааны дэвтэр / сул тал: SRS эсвэл алдаанаас тодорхой асуулт сонгоно
  if (mode === "mistakes" && data.mistakeIds?.length) {
    const byId = new Map(data.vocab.map((v) => [v.id, v]));
    const byKanji = new Map(data.kanji.map((k) => [k.k, k]));
    const byG = new Map(data.grammar.map((g) => [g.id, g]));
    out = [];
    for (const id of data.mistakeIds.slice(0, count)) {
      const v = byId.get(id);
      if (v) { push(vocabQuestion(v, vPool, "vocab-jp-mn", language)); continue; }
      const k = byKanji.get(id);
      if (k) { push(kanjiQuestion(k, kPool, "kanji-mn", language)); continue; }
      const g = byG.get(id);
      if (g) push(grammarQuestion(g, gPool, language));
    }
  }

  if (mode === "weak" && data.weakKinds?.length) {
    out = out.filter((q) => q);
  }

  return { questions: shuffle(out, rnd).slice(0, count), mode, level };
}

/* ─────────────── Жишиг JLPT шалгалт ─────────────── */

export interface ExamSection {
  id: string;
  name: string;
  nameEn: string;
  jp: string;
  count: number;
  minutes: number;
  modes: QuizMode[];
  max: number;
}

export interface ExamBlueprint {
  level: Level;
  title: string;
  titleEn: string;
  minutes: number;
  sections: ExamSection[];
  passTotal: number;
  note: string;
  noteEn: string;
}

/**
 * JLPT-ийн бүтэц (jlpt.jp): N5–N4 нь 2 хэсэг, N3–N1 нь 3 хэсэг.
 * Энэ нь жинхэнэ шалгалтын БҮТЭЦ, ХУГАЦААНЫ хуулбар биш —
 * үзэл баримтлалд нийцүүлсэн дасгалын симуляц юм.
 */
export const EXAM_BLUEPRINTS: Record<Level, ExamBlueprint> = {
  N5: {
    level: "N5", title: "N5 жишиг шалгалт", titleEn: "N5 mock exam", minutes: 35, passTotal: 80,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг · Уншлага", nameEn: "Language Knowledge · Reading", jp: "言語知識・読解", count: 20, minutes: 20, modes: ["vocab-jp-mn", "vocab-read", "kanji-mn", "grammar-mn"], max: 120 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 10, minutes: 15, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N5-д 800 орчим үг, 100 ханз шаардлагатай.",
    noteEn: "N5 requires about 800 words and 100 kanji.",
  },
  N4: {
    level: "N4", title: "N4 жишиг шалгалт", titleEn: "N4 mock exam", minutes: 50, passTotal: 90,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг · Уншлага", nameEn: "Language Knowledge · Reading", jp: "言語知識・読解", count: 24, minutes: 30, modes: ["vocab-jp-mn", "vocab-read", "vocab-fill", "grammar-mn"], max: 120 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 20, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N4-д 1,500 орчим үг, 300 ханз шаардлагатай.",
    noteEn: "N4 requires about 1,500 words and 300 kanji.",
  },
  N3: {
    level: "N3", title: "N3 жишиг шалгалт", titleEn: "N3 mock exam", minutes: 70, passTotal: 95,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", nameEn: "Language Knowledge", jp: "言語知識", count: 18, minutes: 25, modes: ["vocab-jp-mn", "vocab-read", "kanji-read", "grammar-mn"], max: 60 },
      { id: "read", name: "Уншлага", nameEn: "Reading", jp: "読解", count: 10, minutes: 25, modes: ["vocab-fill", "grammar-mn"], max: 60 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 20, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N3-д 3,750 орчим үг, 650 ханз шаардлагатай. Оноо бүр 60-аас дээш байх ёстой.",
    noteEn: "N3 requires about 3,750 words and 650 kanji. Every section needs 60+ points.",
  },
  N2: {
    level: "N2", title: "N2 жишиг шалгалт", titleEn: "N2 mock exam", minutes: 85, passTotal: 90,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", nameEn: "Language Knowledge", jp: "言語知識", count: 20, minutes: 30, modes: ["vocab-jp-mn", "vocab-read", "kanji-read", "grammar-mn"], max: 60 },
      { id: "read", name: "Уншлага", nameEn: "Reading", jp: "読解", count: 12, minutes: 30, modes: ["vocab-fill", "grammar-mn"], max: 60 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 25, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N2 бол Японы ихэнх компанид шаарддаг түвшин.",
    noteEn: "N2 is the level most companies in Japan require.",
  },
  N1: {
    level: "N1", title: "N1 жишиг шалгалт", titleEn: "N1 mock exam", minutes: 95, passTotal: 100,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", nameEn: "Language Knowledge", jp: "言語知識", count: 22, minutes: 35, modes: ["vocab-jp-mn", "vocab-read", "kanji-read", "grammar-mn"], max: 60 },
      { id: "read", name: "Уншлага", nameEn: "Reading", jp: "読解", count: 14, minutes: 35, modes: ["vocab-fill", "grammar-mn"], max: 60 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 25, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N1 нь сонин, эссэ, хийсвэр сэдвийн текстийг бүрэн ойлгох түвшин.",
    noteEn: "N1 means fully understanding newspapers, essays and abstract texts.",
  },
};

export function buildExam(bp: ExamBlueprint, data: { vocab: Vocab[]; kanji: Kanji[]; grammar: Grammar[] }, language: Language = "mn") {
  return bp.sections.map((sec) => {
    const per = Math.ceil(sec.count / sec.modes.length);
    const questions: Question[] = [];
    for (const m of sec.modes) {
      const set = buildQuiz({ mode: m, level: bp.level, count: per, lang: language }, data);
      questions.push(...set.questions);
    }
    return { section: sec, questions: shuffle(questions, rnd).slice(0, sec.count) };
  });
}

/** Оноог бодож, тэнцсэн эсэхийг тодорхойлно (албан ёсны оноо БИШ). */
export function scoreExam(
  bp: ExamBlueprint,
  results: { section: ExamSection; correct: number; total: number }[],
  minutes: number,
): { sections: { name: string; correct: number; total: number; score: number; max: number }[]; total: number; max: number; passed: boolean } {
  const sections = results.map((r) => ({
    name: r.section.name,
    correct: r.correct,
    total: r.total,
    score: Math.round((r.correct / Math.max(1, r.total)) * r.section.max),
    max: r.section.max,
  }));
  const total = sections.reduce((a, s) => a + s.score, 0);
  const max = sections.reduce((a, s) => a + s.max, 0);
  const passed = total >= bp.passTotal;
  void minutes;
  return { sections, total, max, passed };
}

export const levelFromScore = (detail: Record<string, number>): Level => {
  let best: Level = "N5";
  for (const l of LEVELS) {
    if ((detail[l] ?? 0) >= 0.6) best = l;
  }
  return best;
};

export { LEVEL_META };
