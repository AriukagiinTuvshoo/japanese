/**
 * LEARNING ENGINE — дасгал, шалгалт, төлөвлөгөө үүсгэгч.
 * ------------------------------------------------------------------
 * Бүх асуулт нь `public/data/**` доторх бодит контентоос үүснэ.
 * Хиймэл оюун ухаан контент зохиохгүй — зөвхөн эх сангаас сонгож,
 * буруу хариултыг мөн адил бодит өгөгдлөөс гаргана.
 */
import { LEVEL_META } from "../data/levels";
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

export const QUIZ_MODES: { id: QuizMode; label: string; desc: string; icon: string; tone: "shu" | "ai" | "matcha" | "kin" | "murasaki" }[] = [
  { id: "vocab-jp-mn", label: "Япон → Монгол", desc: "Үгийн утгыг таа", icon: "語", tone: "shu" },
  { id: "vocab-mn-jp", label: "Монгол → Япон", desc: "Утгаас үгийг сана", icon: "蒙", tone: "ai" },
  { id: "vocab-read", label: "Уншлага", desc: "Ханзны уншлагыг сонго", icon: "音", tone: "kin" },
  { id: "vocab-listen", label: "Сонсгол", desc: "Дуудлагыг сонсоод таа", icon: "聴", tone: "murasaki" },
  { id: "vocab-fill", label: "Өгүүлбэр бөглөх", desc: "Жишээн дэх дутуу үг", icon: "文", tone: "matcha" },
  { id: "kanji-mn", label: "Ханзны утга", desc: "Ханзны утгыг таа", icon: "漢", tone: "shu" },
  { id: "kanji-read", label: "Ханзны уншлага", desc: "Он/кун уншлага", icon: "読", tone: "ai" },
  { id: "kanji-stroke", label: "Зурлагын тоо", desc: "Хэдэн зурлагатай вэ", icon: "筆", tone: "kin" },
  { id: "grammar-mn", label: "Дүрмийн утга", desc: "Дүрмийн утгыг таа", icon: "文", tone: "murasaki" },
  { id: "grammar-use", label: "Дүрэм хэрэглээ", desc: "Зөв өгүүлбэрийг сонго", icon: "用", tone: "matcha" },
  { id: "mixed", label: "Холимог", desc: "Бүх төрлөөс хольж", icon: "混", tone: "shu" },
  { id: "weak", label: "Сул тал", desc: "Алдаж буй зүйлсээ давт", icon: "弱", tone: "shu" },
  { id: "mistakes", label: "Алдааны дэвтэр", desc: "Алдсан асуултуудаа", icon: "誤", tone: "kin" },
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
function vocabQuestion(v: Vocab, pool: Vocab[], mode: QuizMode): Question | null {
  const others = distractors(pool, (x) => x.id === v.id, 3, opt);
  if (others.length < 3) return null;
  const opts = shuffle([v, ...others], rnd);

  switch (mode) {
    case "vocab-jp-mn": {
      if (!v.mn?.[0] && !v.en[0]) return null;
      const answer = opts.indexOf(v);
      return {
        id: `v-jm-${v.id}`, kind: "vocab", level: v.lvl, section: "Үгийн сан",
        prompt: v.w, promptSub: v.r, refId: v.id,
        options: opts.map(opt), answer,
        explain: `${v.w}（${v.r}） = ${v.mn?.join(", ") ?? v.en.join("; ")}`,
        example: v.ex[0] ? { ja: v.ex[0].fg ?? v.ex[0].ja, en: v.ex[0].en, mn: v.ex[0].mn ?? undefined } : undefined,
      };
    }
    case "vocab-mn-jp": {
      const mn = opt(v);
      if (!mn) return null;
      return {
        id: `v-mj-${v.id}`, kind: "vocab", level: v.lvl, section: "Үгийн сан",
        prompt: mn, promptSub: "Энэ утгатай япон үг аль вэ?", refId: v.id,
        options: opts.map((o) => o.w), answer: opts.indexOf(v),
        explain: `${mn} → ${v.w}（${v.r}）`,
      };
    }
    case "vocab-read": {
      if (!v.kd.length) return null; // зөвхөн кана үгэнд уншлага таах нь утгагүй
      return {
        id: `v-rd-${v.id}`, kind: "vocab", level: v.lvl, section: "Уншлага",
        prompt: v.w, promptSub: "Хэрхэн унших вэ?", refId: v.id,
        options: opts.map((o) => o.r), answer: opts.indexOf(v),
        explain: `${v.w} → ${v.r}　（${opt(v)}）`,
      };
    }
    case "vocab-listen": {
      return {
        id: `v-ls-${v.id}`, kind: "vocab", level: v.lvl, section: "Сонсгол",
        prompt: "🔊", promptSub: v.r, refId: v.id, audio: v.w,
        options: opts.map(opt), answer: opts.indexOf(v),
        explain: `${v.w}（${v.r}） = ${v.mn?.join(", ") ?? v.en.join("; ")}`,
      };
    }
    default:
      return null;
  }
}

/** `{漢字|かんじ}` markup-д тулгуурлан өгүүлбэрээс үг хасна. */
function fillBlank(v: Vocab): Question | null {
  const ex = v.ex.find((e) => e.fg && e.fg.includes(v.w));
  const plain = v.ex.find((e) => e.ja.includes(v.w));
  const sentence = ex?.fg ?? plain?.ja;
  if (!sentence || !sentence.includes(v.w)) return null;
  const hidden = sentence.replaceAll(v.w, "＿＿＿");
  return {
    id: `v-fb-${v.id}`, kind: "vocab", level: v.lvl, section: "Өгүүлбэр бөглөх",
    prompt: hidden, promptSub: "Дутуу үгийг бөглө", refId: v.id,
    options: [], answer: 0,
    explain: `${v.w}（${v.r}） = ${v.mn?.join(", ") ?? v.en.join("; ")}`,
    example: { ja: sentence, en: ex?.en ?? plain?.en, mn: ex?.mn ?? plain?.mn ?? undefined },
  };
}

/* ─────────────── Ханз → асуулт ─────────────── */
function kanjiQuestion(k: Kanji, pool: Kanji[], mode: QuizMode): Question | null {
  if (mode === "kanji-stroke") {
    if (!k.s) return null;
    const values = new Set([k.s]);
    for (const x of shuffle(pool, rnd)) {
      if (x.s && values.size < 4) values.add(x.s);
    }
    if (values.size < 3) return null;
    const opts = shuffle([...values], rnd);
    return {
      id: `k-st-${k.k}`, kind: "kanji", level: k.lvl, section: "Ханз",
      prompt: k.k, promptSub: "Хэдэн зурлагатай вэ?", refKanji: k.k,
      options: opts.map((n) => `${n}`), answer: opts.indexOf(k.s),
      explain: `${k.k} — ${k.s} зурлага${k.mn[0] ? ` · ${k.mn[0]}` : ""}`,
    };
  }

  const others = distractors(pool, (x) => x.k === k.k, 3, (x) => mode === "kanji-read" ? (x.on[0] ?? x.kun[0] ?? x.k) : (x.mn[0] ?? x.en[0] ?? x.k));
  if (others.length < 3) return null;
  const opts = shuffle([k, ...others], rnd);
  const isRead = mode === "kanji-read";

  return {
    id: `k-${isRead ? "rd" : "mn"}-${k.k}`, kind: "kanji", level: k.lvl, section: "Ханз",
    prompt: k.k, promptSub: isRead ? "Уншлагыг сонго" : "Утгыг сонго", refKanji: k.k,
    options: opts.map((o) => isRead ? (o.on[0] ?? o.kun[0] ?? o.k) : (o.mn[0] ?? o.en[0] ?? o.k)),
    answer: opts.indexOf(k),
    explain: isRead
      ? `${k.k} — 音: ${k.on.join("・") || "—"}　訓: ${k.kun.join("・") || "—"}`
      : `${k.k} = ${k.mn.join(", ") || k.en.join(", ")}`,
  };
}

/* ─────────────── Дүрэм → асуулт ─────────────── */
function grammarQuestion(g: Grammar, pool: Grammar[]): Question | null {
  const clean = (s: string) => s.replace(/[〜~]/g, "");
  const others = distractors(pool, (x) => x.id === g.id, 3, (x) => x.mn ?? (Array.isArray(x.en) ? x.en[0] : String(x.en ?? "")));
  if (others.length < 3) return null;

  const mnOf = (x: Grammar) => x.mn ?? (Array.isArray(x.en) ? x.en.join("; ") : String(x.en ?? ""));
  if (!mnOf(g)) return null;

  const opts = shuffle([g, ...others], rnd);
  return {
    id: `g-${g.id}`, kind: "grammar", level: g.lvl, section: "Дүрэм",
    prompt: g.p, promptSub: "Энэ дүрмийн утга аль вэ?",
    options: opts.map(mnOf), answer: opts.indexOf(g),
    explain: `${clean(g.p)} — ${mnOf(g)}${g.note ? `\n${g.note}` : ""}`,
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
          push(vocabQuestion(v, vPool, m));
          if (out.length >= per) break;
        }
        break;
      case "vocab-fill": {
        const withEx = vPool.filter((v) => v.ex.length && v.w.length > 1);
        for (const v of pick(withEx, per * 3)) {
          if (out.length >= per) break;
          const q = fillBlank(v);
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
          push(kanjiQuestion(k, kPool, m));
        }
        break;
      case "grammar-mn":
      case "grammar-use":
        for (const g of pick(gPool, per * 2)) {
          if (out.length >= per) break;
          push(grammarQuestion(g, gPool));
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
      if (v) { push(vocabQuestion(v, vPool, "vocab-jp-mn")); continue; }
      const k = byKanji.get(id);
      if (k) { push(kanjiQuestion(k, kPool, "kanji-mn")); continue; }
      const g = byG.get(id);
      if (g) push(grammarQuestion(g, gPool));
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
  jp: string;
  count: number;
  minutes: number;
  modes: QuizMode[];
  max: number;
}

export interface ExamBlueprint {
  level: Level;
  title: string;
  minutes: number;
  sections: ExamSection[];
  passTotal: number;
  note: string;
}

/**
 * JLPT-ийн бүтэц (jlpt.jp): N5–N4 нь 2 хэсэг, N3–N1 нь 3 хэсэг.
 * Энэ нь жинхэнэ шалгалтын БҮТЭЦ, ХУГАЦААНЫ хуулбар биш —
 * үзэл баримтлалд нийцүүлсэн дасгалын симуляц юм.
 */
export const EXAM_BLUEPRINTS: Record<Level, ExamBlueprint> = {
  N5: {
    level: "N5", title: "N5 жишиг шалгалт", minutes: 35, passTotal: 80,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг · Уншлага", jp: "言語知識・読解", count: 20, minutes: 20, modes: ["vocab-jp-mn", "vocab-read", "kanji-mn", "grammar-mn"], max: 120 },
      { id: "listen", name: "Сонсгол", jp: "聴解", count: 10, minutes: 15, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N5-д 800 орчим үг, 100 ханз шаардлагатай.",
  },
  N4: {
    level: "N4", title: "N4 жишиг шалгалт", minutes: 50, passTotal: 90,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг · Уншлага", jp: "言語知識・読解", count: 24, minutes: 30, modes: ["vocab-jp-mn", "vocab-read", "vocab-fill", "grammar-mn"], max: 120 },
      { id: "listen", name: "Сонсгол", jp: "聴解", count: 12, minutes: 20, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N4-д 1,500 орчим үг, 300 ханз шаардлагатай.",
  },
  N3: {
    level: "N3", title: "N3 жишиг шалгалт", minutes: 70, passTotal: 95,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", jp: "言語知識", count: 18, minutes: 25, modes: ["vocab-jp-mn", "vocab-read", "kanji-read", "grammar-mn"], max: 60 },
      { id: "read", name: "Уншлага", jp: "読解", count: 10, minutes: 25, modes: ["vocab-fill", "grammar-mn"], max: 60 },
      { id: "listen", name: "Сонсгол", jp: "聴解", count: 12, minutes: 20, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N3-д 3,750 орчим үг, 650 ханз шаардлагатай. Оноо бүр 60-аас дээш байх ёстой.",
  },
  N2: {
    level: "N2", title: "N2 жишиг шалгалт", minutes: 85, passTotal: 90,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", jp: "言語知識", count: 20, minutes: 30, modes: ["vocab-jp-mn", "vocab-read", "kanji-read", "grammar-mn"], max: 60 },
      { id: "read", name: "Уншлага", jp: "読解", count: 12, minutes: 30, modes: ["vocab-fill", "grammar-mn"], max: 60 },
      { id: "listen", name: "Сонсгол", jp: "聴解", count: 12, minutes: 25, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N2 бол Японы ихэнх компанид шаарддаг түвшин.",
  },
  N1: {
    level: "N1", title: "N1 жишиг шалгалт", minutes: 95, passTotal: 100,
    sections: [
      { id: "lang", name: "Хэлний мэдлэг", jp: "言語知識", count: 22, minutes: 35, modes: ["vocab-jp-mn", "vocab-read", "kanji-read", "grammar-mn"], max: 60 },
      { id: "read", name: "Уншлага", jp: "読解", count: 14, minutes: 35, modes: ["vocab-fill", "grammar-mn"], max: 60 },
      { id: "listen", name: "Сонсгол", jp: "聴解", count: 12, minutes: 25, modes: ["vocab-listen"], max: 60 },
    ],
    note: "N1 нь сонин, эссэ, хийсвэр сэдвийн текстийг бүрэн ойлгох түвшин.",
  },
};

export function buildExam(bp: ExamBlueprint, data: { vocab: Vocab[]; kanji: Kanji[]; grammar: Grammar[] }) {
  return bp.sections.map((sec) => {
    const per = Math.ceil(sec.count / sec.modes.length);
    const questions: Question[] = [];
    for (const m of sec.modes) {
      const set = buildQuiz({ mode: m, level: bp.level, count: per }, data);
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
