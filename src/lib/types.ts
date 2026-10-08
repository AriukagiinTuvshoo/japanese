/** ────────────────────────────────────────────────────────────────
 *  Өгөгдлийн төрлүүд.
 *  public/data/** дотор байгаа JSON-ийн бүтэцтэй яг тохирно.
 *  ──────────────────────────────────────────────────────────────── */

export type Level = "N5" | "N4" | "N3" | "N2" | "N1";
export const LEVELS: Level[] = ["N5", "N4", "N3", "N2", "N1"];

/** Монгол орчуулгын чанарын төлөв (content policy). */
export type MnQuality =
  | "draft"     // authored, not independently reviewed
  | "curated"   // хүн хянасан, батлагдсан
  | "auto"      // EN→MN нэр томьёоны сангаас автоматаар
  | "derived"   // ханзны утгуудаас зөвлөмж
  | "none";     // байхгүй — эх сурвалжийн англи утга харуулна

export type VocabTier = "jlpt" | "ext-example" | "ext-frequency";
export type PosType = "v" | "i" | "na" | "adj" | "adv" | "exp" | "pn" | "ctr" | "n" | "other";

export interface Example {
  ja: string;
  fg?: string;
  en?: string;
  mn?: string | null;
  ts?: number;
}

export interface Vocab {
  source_issue?: string;
  id: string;
  w: string;
  r: string;
  rm: string;
  en: string[];
  mn: string[] | null;
  mq: MnQuality;
  lvl: Level;
  tier: VocabTier;
  pos: string[];
  t: PosType;
  kd: string[];
  src: string;
  sid: string;
  ex: Example[];
}

export interface KanjiWord {
  w: string;
  r: string;
  mn: string | null;
  en: string;
  lvl: Level;
}

export interface Kanji {
  source_issue?: string;
  k: string;
  lvl: Level;
  lvlSrc: "jlpt" | "derived";
  s: number | null;
  g: number | null;
  f: number | null;
  en: string[];
  mn: string[];
  mq: MnQuality;
  on: string[];
  kun: string[];
  rad: string | null;
  w: KanjiWord[];
  mn_mem: string | null;
  src: string;
  sid: string;
}

export interface GrammarExample {
  ja?: string;
  fg?: string;
  en?: string;
  mn?: string | null;
}

export interface Grammar {
  id: string;
  p: string;
  lvl: Level;
  en: string[] | string;
  mn: string | null;
  note: string | null;
  note_en?: string | null;
  form: string | null;
  form_mn?: string | null;
  jlpt: Level;
  ex: GrammarExample[];
  related: string[];
  src: string;
}

export interface StrokeMap {
  [kanji: string]: string[];
}

export interface SearchIndex {
  v: [string, string, string, Level, number, string][]; // word, reading, mn, level, tier, id
  k: [string, string, string, Level, number][];         // kanji, on, mn, level, strokes
  g: [string, string, Level, string][];                 // pattern, mn, level, id
}

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  license: string;
  note: string;
  retrievedAt: string;
}

export interface DataMeta {
  version: string;
  builtAt: string;
  levels: Level[];
  counts: {
    vocab: number;
    kanji: number;
    grammar: number;
    strokes: number;
    vocabMnCurated: number;
    byLevel: {
      vocab: Record<Level, number>;
      kanji: Record<Level, number>;
      grammar: Record<Level, number>;
      vocabMn: Record<Level, number>;
    };
  };
  content: {
    listeningLessons: number;
    readingPassages: number;
    kanjiMnemonics: number;
    grammarExplained: number;
    glossaryTerms: number;
  };
  sources: SourceRecord[];
  openjlpt: Record<string, unknown>;
}

/* ─────────────── Контентын бусад сангууд ─────────────── */

export interface ListeningLesson {
  id: string;
  title: string;
  titleJp?: string;
  channel: string;
  channelUrl?: string;
  youtubeId: string;
  level: Level;
  topic: string;
  minutes: number;
  /** Эзэн нь зөвшөөрсөн эсэх — зөвхөн approved нь нийтэд харагдана. */
  status?: "approved" | "pending_review";
  transcript: { ja: string; mn?: string; at?: number }[];
  vocab: { w: string; r: string; mn: string }[];
  questions: { q: string; mn?: string; opts: string[]; a: number; why?: string }[];
  shadowing?: string[];
}

export interface ReadingPassage {
  id: string;
  title: string;
  titleJp: string;
  level: Level;
  topic: string;
  minutes: number;
  source?: string;
  /** Текст дэх мөрүүд. `{漢字|かんじ}` хэлбэрийн фуригана дэмжинэ. */
  body: string[];
  glossary: { w: string; r: string; mn: string }[];
  questions: { q: string; mn?: string; opts: string[]; a: number; why?: string }[];
}

export interface CurriculumPlan {
  level: Level;
  days: number;
  hoursPerDay: number;
  title: string;
  summary: string;
}
