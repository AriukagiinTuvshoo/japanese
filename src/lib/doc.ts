/**
 * БАРИМТЫН СХЕМ — хэрэглэгчийн бүх ахицын хэлбэр.
 * ------------------------------------------------------------------
 * Энэ файл зөвхөн төрөл, анхны утга, хувилбарын дугаарыг агуулна. Унших,
 * бичих, шилжүүлэх (migrate) логик `storage.ts`-д байна — ингэснээр React-гүй
 * тестлэх боломжтой хэвээр үлдэнэ.
 */
import type { Card } from "./srs";
import type { Language } from "./i18n";
import type { Level } from "./types";

/** Хадгалагдсан баримтын одоогийн схем хувилбар. */
export const SCHEMA_VERSION = 4;

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
  /** Схем хувилбар — `SCHEMA_VERSION`-той тулгана. */
  v: number;
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

export const emptyDay = (): ActivityDay => ({
  xp: 0, min: 0, newCards: 0, reviews: 0, correct: 0, total: 0,
});

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
