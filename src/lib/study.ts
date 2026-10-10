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
  refGrammar?: string;
  /** Stable answer ordering; changing UI language never regenerates a question. */
  presentation?: Record<Language, QuestionPresentation>;
  options: string[];
  answer: number;
  /** Зөв хариултын тайлбар (монгол). */
  explain?: string;
  example?: { ja: string; mn?: string; en?: string };
  audio?: string;
  section: string;
}

export type QuestionPresentation = Pick<Question, "prompt" | "promptSub" | "options" | "explain" | "section">;

export function presentQuestion(question: Question, language: Language): Question {
  return { ...question, ...question.presentation?.[language] };
}

function bilingual(question: Question, presentation: Record<Language, QuestionPresentation>, language: Language): Question {
  return presentQuestion({ ...question, presentation }, language);
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
  { id: "grammar-use", label: "Дүрэм хэрэглээ", desc: "Өгүүлбэрт орсон илэрхийллийг тань", labelEn: "Grammar recognition", descEn: "Identify an expression in a source sentence", icon: "用", tone: "matcha" },
  { id: "mixed", label: "Холимог", desc: "Бүх төрлөөс хольж", labelEn: "Mixed", descEn: "All kinds combined", icon: "混", tone: "shu" },
  { id: "weak", label: "Сул тал", desc: "Алдаж буй зүйлсээ давт", labelEn: "Weak points", descEn: "Drill what you miss", icon: "弱", tone: "shu" },
  { id: "mistakes", label: "Алдааны дэвтэр", desc: "Алдсан асуултуудаа", labelEn: "Mistake log", descEn: "The ones you got wrong", icon: "誤", tone: "kin" },
];

const rnd = Math.random;
const plain = (text: string) => text.replace(/\{([^|{}]+)\|[^{}]+\}/g, "$1");
const normalized = (text: string) => plain(text).normalize("NFKC").replace(/\s/g, "");
const vocabMeaning = (v: Vocab, language: Language) => language === "en" ? v.en.join("; ") : v.mn?.join(", ") || MN_PENDING;
const kanjiMeaning = (k: Kanji, language: Language) => language === "en" ? k.en.join(", ") : k.mn.join(", ") || MN_PENDING;
const grammarMeaning = (g: Grammar, language: Language) => language === "en" ? grammarEn(g) : g.mn || MN_PENDING;

function distractors<T>(pool: T[], exclude: (x: T) => boolean, n: number, keys: (x: T) => string[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of shuffle(pool.filter((p) => !exclude(p)), rnd)) {
    const values = keys(x).map(normalized);
    if (values.some((key) => !key || seen.has(key))) continue;
    values.forEach((key) => seen.add(key));
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

/** No adjacent-level backfill: sparse or conflicted pools remain visibly sparse. */
function poolFor<T extends { lvl: Level; source_issue?: string }>(all: T[], lvl: Level): T[] {
  return all.filter((x) => x.lvl === lvl && !x.source_issue);
}

function vocabQuestion(v: Vocab, pool: Vocab[], mode: QuizMode, language: Language): Question | null {
  const meaningMode = mode === "vocab-jp-mn" || mode === "vocab-mn-jp" || mode === "vocab-listen";
  if (meaningMode && (!v.mn?.length || !v.en.length)) return null;
  if (mode === "vocab-read" && (!v.kd.length || !v.r || normalized(v.w) === normalized(v.r))) return null;
  if (mode === "vocab-fill") return null; // Random dictionary words do not establish a unique sentence completion.
  const keys = (x: Vocab) => mode === "vocab-read" ? [x.r]
    : mode === "vocab-mn-jp" || mode === "listening" ? [x.w] : [vocabMeaning(x, "mn"), vocabMeaning(x, "en")];
  const correctKeys = keys(v).map(normalized);
  // Exclude homographs and all readings of the same written form, not just the record ID.
  const validReadings = new Set(pool.filter((x) => x.w === v.w).map((x) => normalized(x.r)));
  const others = distractors(pool, (x) => x.id === v.id || x.w === v.w ||
    (meaningMode && (!x.mn?.length || !x.en.length)) ||
    keys(x).some((key, i) => normalized(key) === correctKeys[i]) ||
    (mode === "vocab-read" && validReadings.has(normalized(x.r))) ||
    (mode === "listening" && normalized(x.r) === normalized(v.r)), 3, keys);
  if (others.length !== 3) return null;
  const opts = shuffle([v, ...others], rnd);
  const section = mode === "vocab-read" ? "Уншлага" : mode === "vocab-listen" || mode === "listening" ? "Сонсгол" : "Үгийн сан";
  const presentation = Object.fromEntries((["mn", "en"] as Language[]).map((lang) => [lang, {
    section: SECTION_LABEL[lang][section],
    prompt: mode === "vocab-mn-jp" ? vocabMeaning(v, lang) : mode === "vocab-listen" || mode === "listening" ? "🔊" : v.w,
    promptSub: mode === "vocab-mn-jp" ? PROMPT_SUB[lang]["Энэ утгатай япон үг аль вэ?"]
      : mode === "vocab-read" ? PROMPT_SUB[lang]["Хэрхэн унших вэ?"]
      : mode === "listening" ? (lang === "en" ? "Listen and choose the written word." : "Сонсоод япон үгийг сонго.")
      : mode === "vocab-listen" ? PROMPT_SUB[lang]["Утгыг сонго"] : v.r,
    options: opts.map((x) => mode === "vocab-read" ? x.r : mode === "vocab-mn-jp" || mode === "listening" ? x.w : vocabMeaning(x, lang)),
    explain: `${v.w}（${v.r}） = ${vocabMeaning(v, lang)}`,
  }])) as Record<Language, QuestionPresentation>;
  return bilingual({
    id: `v-${mode}-${v.id}`, kind: "vocab", level: v.lvl, section: "", prompt: "", options: [],
    refId: v.id, answer: opts.indexOf(v), audio: mode === "vocab-listen" || mode === "listening" ? v.w : undefined,
    example: v.ex[0] ? { ja: v.ex[0].fg ?? v.ex[0].ja, mn: v.ex[0].mn ?? undefined, en: v.ex[0].en } : undefined,
  }, presentation, language);
}

function kanjiQuestion(k: Kanji, pool: Kanji[], mode: QuizMode, language: Language): Question | null {
  const reading = (x: Kanji) => x.on[0] ?? x.kun[0] ?? "";
  let options: Kanji[] = [];
  let strokes: number[] = [];
  if (mode === "kanji-stroke") {
    if (!k.s) return null;
    const values = new Set([k.s]);
    for (const x of shuffle(pool, rnd)) if (x.s && values.size < 4) values.add(x.s);
    if (values.size !== 4) return null;
    strokes = shuffle([...values], rnd);
  } else {
    if (mode === "kanji-mn" && (!k.mn.length || !k.en.length)) return null;
    if (mode === "kanji-read" && !reading(k)) return null;
    const keys = (x: Kanji) => mode === "kanji-read" ? [reading(x)] : [kanjiMeaning(x, "mn"), kanjiMeaning(x, "en")];
    const correctKeys = keys(k).map(normalized);
    const accepted = new Set([...k.on, ...k.kun].map(normalized));
    const others = distractors(pool, (x) => x.k === k.k ||
      (mode === "kanji-read" ? !reading(x) || accepted.has(normalized(reading(x))) : !x.mn.length || !x.en.length) ||
      keys(x).some((key, i) => normalized(key) === correctKeys[i]), 3, keys);
    if (others.length !== 3) return null;
    options = shuffle([k, ...others], rnd);
  }
  const presentation = Object.fromEntries((["mn", "en"] as Language[]).map((lang) => [lang, {
    section: SECTION_LABEL[lang]["Ханз"], prompt: k.k,
    promptSub: PROMPT_SUB[lang][mode === "kanji-stroke" ? "Хэдэн зурлагатай вэ?" : mode === "kanji-read" ? "Уншлагыг сонго" : "Утгыг сонго"],
    options: mode === "kanji-stroke" ? strokes.map(String) : options.map((x) => mode === "kanji-read" ? reading(x) : kanjiMeaning(x, lang)),
    explain: mode === "kanji-stroke" ? `${k.k} — ${k.s} ${lang === "en" ? "strokes" : "зурлага"} · ${kanjiMeaning(k, lang)}`
      : mode === "kanji-read" ? `${k.k} — 音: ${k.on.join("・") || "—"}　訓: ${k.kun.join("・") || "—"}` : `${k.k} = ${kanjiMeaning(k, lang)}`,
  }])) as Record<Language, QuestionPresentation>;
  return bilingual({ id: `k-${mode}-${k.k}`, kind: "kanji", level: k.lvl, refKanji: k.k,
    section: "", prompt: "", options: [], answer: mode === "kanji-stroke" ? strokes.indexOf(k.s!) : options.indexOf(k),
  }, presentation, language);
}

function grammarQuestion(g: Grammar, pool: Grammar[], language: Language): Question | null {
  if (!g.mn || !grammarEn(g)) return null;
  const keys = (x: Grammar) => [grammarMeaning(x, "mn"), grammarMeaning(x, "en")];
  const correct = keys(g).map(normalized);
  const others = distractors(pool, (x) => x.id === g.id || !x.mn || !grammarEn(x) || keys(x).some((key, i) => normalized(key) === correct[i]), 3, keys);
  if (others.length !== 3) return null;
  const opts = shuffle([g, ...others], rnd);
  const presentation = Object.fromEntries((["mn", "en"] as Language[]).map((lang) => [lang, {
    section: SECTION_LABEL[lang]["Дүрэм"], prompt: g.p, promptSub: PROMPT_SUB[lang]["Энэ дүрмийн утга аль вэ?"],
    options: opts.map((x) => grammarMeaning(x, lang)),
    explain: `${g.p} — ${grammarMeaning(g, lang)}${(lang === "en" ? g.note_en : g.note) ? `\n${lang === "en" ? g.note_en : g.note}` : ""}`,
  }])) as Record<Language, QuestionPresentation>;
  return bilingual({ id: `g-${g.id}`, kind: "grammar", level: g.lvl, refGrammar: g.id,
    section: "", prompt: "", options: [], answer: opts.indexOf(g),
    example: g.ex[0]?.ja ? { ja: g.ex[0].fg ?? g.ex[0].ja, mn: g.ex[0].mn ?? undefined, en: g.ex[0].en } : undefined,
  }, presentation, language);
}

/** Literal expression recognition, NOT an unreviewed multiple-choice grammar completion. */
function grammarUseQuestion(g: Grammar, pool: Grammar[], language: Language): Question | null {
  const variants = (item: Grammar) => item.p.split(/[\/／]/).map((part) => part.replace(/[〜~]/g, "").replace(/[（(][^）)]*[）)]/g, "").trim())
    .filter((part) => part.length >= 2 && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u.test(part));
  const occurrences = (item: Grammar) => item.ex.flatMap((example) => variants(item).filter((part) => example.ja?.includes(part)).map((target) => ({ example, target })));
  const match = occurrences(g)[0];
  if (!match?.example.ja) return null;
  const sentence = normalized(match.example.ja);
  const candidates = pool.filter((x) => x.id !== g.id).flatMap(occurrences);
  const others = distractors(candidates, (x) => sentence.includes(normalized(x.target)) || normalized(x.target).includes(normalized(match.target)), 3, (x) => [x.target]);
  if (others.length !== 3) return null;
  const options = shuffle([match, ...others], rnd);
  const presentation = Object.fromEntries((["mn", "en"] as Language[]).map((lang) => [lang, {
    section: SECTION_LABEL[lang]["Дүрэм"], prompt: match.example.fg ?? match.example.ja!,
    promptSub: lang === "en" ? "Which expression appears exactly as written in this sentence? (Recognition, not sentence completion.)" : "Энэ өгүүлбэрт яг энэ хэлбэрээр орсон илэрхийлэл аль вэ? (Таних дасгал; өгүүлбэр бөглөх биш.)",
    options: options.map((x) => x.target),
    explain: `${g.p} — ${grammarMeaning(g, lang)}${g.form ? `\n${lang === "mn" ? g.form_mn || MN_PENDING : g.form}` : ""}`,
  }])) as Record<Language, QuestionPresentation>;
  return bilingual({ id: `g-use-${g.id}`, kind: "grammar", level: g.lvl, refGrammar: g.id,
    section: "", prompt: "", options: [], answer: options.indexOf(match),
    example: { ja: match.example.fg ?? match.example.ja, mn: match.example.mn ?? undefined, en: match.example.en },
  }, presentation, language);
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

  const push = (q: Question | null) => { if (q && !out.some((x) => x.id === q.id)) out.push(q); };

  const pickVocab = (n: number) => {
    const source = req.restrictIds?.length ? vPool.filter((v) => req.restrictIds!.includes(v.id)) : vPool;
    return pick(source, n);
  };

  const realModes: QuizMode[] = mode === "mixed"
    ? ["vocab-jp-mn", "vocab-mn-jp", "vocab-read", "kanji-mn", "kanji-read", "grammar-mn"]
    : mode === "weak"
      ? ((data.weakKinds?.length ? data.weakKinds : ["vocab-jp-mn", "grammar-mn"]) as QuizMode[])
      : [mode];

  for (const [modeIndex, m] of realModes.entries()) {
    const per = Math.floor(count / realModes.length) + (modeIndex < count % realModes.length ? 1 : 0);
    if (!per) continue;
    const limit = out.length + per;
    switch (m) {
      case "vocab-jp-mn":
      case "vocab-mn-jp":
      case "vocab-read":
      case "vocab-listen":
      case "listening":
        for (const v of pickVocab(vPool.length)) {
          if (out.length >= limit) break;
          push(vocabQuestion(v, vPool, m, language));
        }
        break;
      case "vocab-fill":
        // Await a source-grounded, reviewed completion bank; do not invent distractors.
        break;
      case "kanji-mn":
      case "kanji-read":
      case "kanji-stroke":
        for (const k of pick(kPool, kPool.length)) {
          if (out.length >= limit) break;
          push(kanjiQuestion(k, kPool, m, language));
        }
        break;
      case "grammar-mn":
        for (const g of pick(gPool, gPool.length)) {
          if (out.length >= limit) break;
          push(grammarQuestion(g, gPool, language));
        }
        break;
      case "grammar-use":
        for (const g of pick(gPool, gPool.length)) {
          if (out.length >= limit) break;
          push(grammarUseQuestion(g, gPool, language));
        }
        break;
      default:
        break;
    }
  }

  // Алдааны дэвтэр / сул тал: SRS эсвэл алдаанаас тодорхой асуулт сонгоно
  if (mode === "mistakes" && data.mistakeIds?.length) {
    const byId = new Map(vPool.map((v) => [v.id, v]));
    const byKanji = new Map(kPool.map((k) => [k.k, k]));
    const byG = new Map(gPool.map((g) => [g.id, g]));
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
  /** Албан JLPT-ийн хэсгийн доод босго; UI дээр practice estimate гэж тайлбарлана. */
  min: number;
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
      { id: "lang", name: "Хэлний мэдлэг · Уншлага", nameEn: "Language Knowledge · Reading", jp: "言語知識・読解", count: 20, minutes: 20, modes: ["vocab-read", "kanji-read", "grammar-use"], max: 120, min: 38 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 10, minutes: 15, modes: ["listening"], max: 60, min: 19 },
    ],
    note: "800 үг, 100 ханз нь албан шаардлага биш, сургалтын ойролцоо баримжаа.",
    noteEn: "800 words and 100 kanji are study estimates, not official requirements.",
  },
  N4: {
    level: "N4", title: "N4 жишиг шалгалт", titleEn: "N4 mock exam", minutes: 50, passTotal: 90,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг · Уншлага", nameEn: "Language Knowledge · Reading", jp: "言語知識・読解", count: 24, minutes: 30, modes: ["vocab-read", "kanji-read", "grammar-use"], max: 120, min: 38 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 20, modes: ["listening"], max: 60, min: 19 },
    ],
    note: "1,500 үг, 300 ханз нь албан шаардлага биш, сургалтын ойролцоо баримжаа.",
    noteEn: "1,500 words and 300 kanji are study estimates, not official requirements.",
  },
  N3: {
    level: "N3", title: "N3 жишиг шалгалт", titleEn: "N3 mock exam", minutes: 70, passTotal: 95,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", nameEn: "Language Knowledge", jp: "言語知識", count: 18, minutes: 25, modes: ["vocab-read", "kanji-read", "grammar-use"], max: 60, min: 19 },
      { id: "read", name: "Уншлага", nameEn: "Reading", jp: "読解", count: 10, minutes: 25, modes: ["reading"], max: 60, min: 19 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 20, modes: ["listening"], max: 60, min: 19 },
    ],
    note: "3,750 үг, 650 ханз нь сургалтын ойролцоо баримжаа. Хэсэг бүрийн доод босго 19/60; нийт босго 95/180.",
    noteEn: "3,750 words and 650 kanji are study estimates. Each section minimum is 19/60; the total threshold is 95/180.",
  },
  N2: {
    level: "N2", title: "N2 жишиг шалгалт", titleEn: "N2 mock exam", minutes: 85, passTotal: 90,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", nameEn: "Language Knowledge", jp: "言語知識", count: 20, minutes: 30, modes: ["vocab-read", "kanji-read", "grammar-use"], max: 60, min: 19 },
      { id: "read", name: "Уншлага", nameEn: "Reading", jp: "読解", count: 12, minutes: 30, modes: ["reading"], max: 60, min: 19 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 25, modes: ["listening"], max: 60, min: 19 },
    ],
    note: "N2 бол Японы ихэнх компанид шаарддаг түвшин.",
    noteEn: "N2 is the level most companies in Japan require.",
  },
  N1: {
    level: "N1", title: "N1 жишиг шалгалт", titleEn: "N1 mock exam", minutes: 95, passTotal: 100,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", nameEn: "Language Knowledge", jp: "言語知識", count: 22, minutes: 35, modes: ["vocab-read", "kanji-read", "grammar-use"], max: 60, min: 19 },
      { id: "read", name: "Уншлага", nameEn: "Reading", jp: "読解", count: 14, minutes: 35, modes: ["reading"], max: 60, min: 19 },
      { id: "listen", name: "Сонсгол", nameEn: "Listening", jp: "聴解", count: 12, minutes: 25, modes: ["listening"], max: 60, min: 19 },
    ],
    note: "N1 нь сонин, эссэ, хийсвэр сэдвийн текстийг бүрэн ойлгох түвшин.",
    noteEn: "N1 means fully understanding newspapers, essays and abstract texts.",
  },
};

/** A blocked comprehension section is never replaced with a dictionary drill. */
export function examSectionBlocker(section: ExamSection, language: Language): string | null {
  const reading = section.id === "read" || section.id === "lang" && section.max === 120;
  const listening = section.id === "listen";
  if (!reading && !listening) return null;
  return language === "en"
    ? `${reading ? "Reading" : "Listening"}: a reviewed Japanese comprehension question/choice bank is not available. Dictionary recognition does not substitute for this section.`
    : `${reading ? "Уншлага" : "Сонсгол"}: япон асуулт, сонголттой ойлгох чадварын хянагдсан сан бэлэн биш. Толь бичгийн таних дасгалаар энэ хэсгийг орлуулахгүй.`;
}

export function buildExam(bp: ExamBlueprint, data: { vocab: Vocab[]; kanji: Kanji[]; grammar: Grammar[] }, language: Language = "mn") {
  return bp.sections.map((sec) => {
    if (examSectionBlocker(sec, language)) return { section: sec, questions: [] as Question[] };
    const per = Math.ceil(sec.count / sec.modes.length);
    const generated: Question[][] = [];
    for (const m of sec.modes) {
      const set = buildQuiz({ mode: m, level: bp.level, count: sec.count, lang: language }, data);
      generated.push(set.questions);
    }
    // Keep each exam section balanced across its configured question types.
    // Then backfill from unused questions if one generator has a sparse pool.
    const questions: Question[] = [];
    const usedTargets = new Set<string>();
    const append = (question: Question) => {
      const target = question.refId ? `v:${question.refId}` : question.refKanji ? `k:${question.refKanji}` : `q:${question.id}`;
      if (usedTargets.has(target) || questions.length >= sec.count) return false;
      usedTargets.add(target);
      questions.push(question);
      return true;
    };
    generated.forEach((pool) => {
      let added = 0;
      for (const question of shuffle(pool, rnd)) {
        if (added >= per || questions.length >= sec.count) break;
        if (append(question)) added++;
      }
    });
    for (const question of shuffle(generated.flat(), rnd)) {
      if (questions.length >= sec.count) break;
      append(question);
    }
    return { section: sec, questions: shuffle(questions, rnd) };
  });
}

export function buildJapanesePractice(level: Level, count: number, data: { vocab: Vocab[]; kanji: Kanji[]; grammar: Grammar[] }, language: Language): QuizSet {
  return buildQuiz({ mode: "weak", level, count, lang: language }, { ...data, weakKinds: ["vocab-read", "kanji-read", "grammar-use"] });
}

/** Оноог бодож, тэнцсэн эсэхийг тодорхойлно (албан ёсны оноо БИШ). */
export function scoreExam(
  bp: ExamBlueprint,
  results: { section: ExamSection; correct: number; total: number }[],
  minutes: number,
) {
  let complete = results.length === bp.sections.length;
  const sections = bp.sections.map((section) => {
    const matches = results.filter((result) => result.section.id === section.id);
    const r = matches[0];
    const valid = matches.length === 1 && r.total === section.count && Number.isInteger(r.correct) && r.correct >= 0 && r.correct <= r.total;
    if (!valid) complete = false;
    return {
      id: section.id, name: section.name, nameEn: section.nameEn,
      correct: valid ? r.correct : 0, total: valid ? r.total : 0,
      score: valid ? Math.round((r.correct / section.count) * section.max) : 0,
      max: section.max, min: section.min, complete: valid,
    };
  });
  const total = sections.reduce((sum, section) => sum + section.score, 0);
  const max = bp.sections.reduce((sum, section) => sum + section.max, 0);
  const passed = complete && sections.every((section) => section.score >= section.min) && total >= bp.passTotal;
  void minutes;
  return { sections, total, max, passed, complete };
}

export const levelFromScore = (detail: Record<string, number>): Level => {
  let best: Level = "N5";
  for (const l of LEVELS) {
    if ((detail[l] ?? 0) >= 0.6) best = l;
  }
  return best;
};

export { LEVEL_META };
