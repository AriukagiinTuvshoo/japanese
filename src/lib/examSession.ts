/**
 * ШАЛГАЛТЫН ЗУРВАС — refresh хийсэн ч үргэлжлүүлэх боломж
 * ------------------------------------------------------------------
 * Шалгалтын явц (асуулт, өгсөн хариулт, хэсгийн байрлал, эхэлсэн цаг)
 * зөвхөн React-ийн state-д байвал хуудас дахин ачаалагмагц бүхэлдээ
 * арилдаг. Энэ модуль нь тэр төлөвийг sessionStorage-д хадгалж, дахин
 * нээхэд БАТАЛГААЖСАН хэлбэрээр буцаана.
 *
 * Дүрэм:
 *  · Зөвхөн `DRAFT_VERSION`-той таарсан зурвасыг уншина.
 *  · Гэмтсэн, дутуу, буруу хэлбэрийн зурвасыг ХЭЗЭЭ Ч таамаглахгүй —
 *    null буцааж, шалгалтыг шинээр эхлүүлнэ.
 *  · Хариултын индекс тухайн асуултын сонголтын хязгаараас гарвал
 *    тэр хариултыг `null` болгоно (буруу хариулт сэргээхээс сэргийлнэ).
 */

import type { Level } from "./types";
import { LEVELS } from "./types";
import type { ExamSection, Question } from "./study";

/** sessionStorage түлхүүр — нэг л шалгалтын зурвас байна. */
export const DRAFT_KEY = "nd:exam:draft";
export const DRAFT_VERSION = 1;

export interface DraftSection {
  section: ExamSection;
  questions: Question[];
}

/** Хэсгийн гүйцэтгэл — `ExamSection`-ийг бүтнээр хадгална (id-аар холбоно). */
export interface DraftResult {
  section: ExamSection;
  correct: number;
  total: number;
  /** Хугацаа дууссан тул автоматаар илгээгдсэн эсэх (зөвхөн тэмдэглэл). */
  timedOut?: boolean;
}

export interface ExamDraft {
  v: number;
  level: Level;
  stage: "running" | "sectionResult";
  /** Одоогийн хэсгийн индекс. */
  secIdx: number;
  /** Шалгалт эхэлсэн цаг — нийт зарцуулсан хугацааг үүнээс бодно. */
  startedAt: number;
  updatedAt: number;
  sections: DraftSection[];
  results: DraftResult[];
  /** Хэсэг бүрийн өгсөн хариулт (`null` = хариулаагүй). */
  answers: (number | null)[][];
  /** Хэсэг бүрийн одоогийн асуултын байрлал. */
  index: number[];
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;

function isSection(x: unknown): x is ExamSection {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return isStr(s.id) && isStr(s.name) && isStr(s.jp) && isNum(s.count) && isNum(s.minutes) && isNum(s.max)
    && Array.isArray(s.modes);
}

function isQuestion(x: unknown): x is Question {
  if (!x || typeof x !== "object") return false;
  const q = x as Record<string, unknown>;
  return isStr(q.id) && isStr(q.kind) && isStr(q.prompt) && Array.isArray(q.options)
    && q.options.every((o) => typeof o === "string")
    && isNum(q.answer) && q.answer >= 0 && q.answer < (q.options as unknown[]).length
    && isStr(q.section);
}

function isResult(x: unknown): x is DraftResult {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return isSection(r.section) && isNum(r.correct) && isNum(r.total) && r.correct >= 0 && r.total >= 0 && r.correct <= r.total;
}

/** Хариултын массивыг асуултын тоонд тааруулж, хязгаараас гарсныг null болгоно. */
function sanitizeAnswers(raw: unknown, sections: DraftSection[]): (number | null)[][] {
  const list = Array.isArray(raw) ? raw : [];
  return sections.map((s, i) => {
    const given = Array.isArray(list[i]) ? (list[i] as unknown[]) : [];
    return s.questions.map((q, qi) => {
      const v = given[qi];
      return isNum(v) && Number.isInteger(v) && v >= 0 && v < q.options.length ? v : null;
    });
  });
}

function sanitizeIndex(raw: unknown, sections: DraftSection[]): number[] {
  const list = Array.isArray(raw) ? raw : [];
  return sections.map((s, i) => {
    const v = list[i];
    return isNum(v) && Number.isInteger(v) && v >= 0 && v < s.questions.length ? v : 0;
  });
}

/** Зурвас бүтэн, уншихад аюулгүй эсэх. */
export function isValidExamDraft(value: unknown): value is ExamDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (d.v !== DRAFT_VERSION) return false;
  if (!isStr(d.level) || !(LEVELS as string[]).includes(d.level)) return false;
  if (d.stage !== "running" && d.stage !== "sectionResult") return false;
  if (!isNum(d.startedAt) || !isNum(d.updatedAt)) return false;
  if (!Array.isArray(d.sections) || d.sections.length === 0) return false;
  for (const s of d.sections) {
    if (!s || typeof s !== "object") return false;
    const sec = s as Record<string, unknown>;
    if (!isSection(sec.section)) return false;
    if (!Array.isArray(sec.questions) || sec.questions.length === 0) return false;
    if (!sec.questions.every(isQuestion)) return false;
  }
  const len = d.sections.length;
  if (!isNum(d.secIdx) || !Number.isInteger(d.secIdx) || d.secIdx < 0 || d.secIdx >= len) return false;
  if (!Array.isArray(d.results) || d.results.length > len || !d.results.every(isResult)) return false;
  if (d.results.length > d.secIdx) return false;
  return true;
}

/** Зурвасыг хадгална. Хадгалалт амжилтгүй бол `false` (алдаа шидэхгүй). */
export function saveExamDraft(store: DraftStorage, draft: ExamDraft): boolean {
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Зурвасыг баталгаажуулан уншина; байхгүй/гэмтсэн/хуучирсан бол `null`. */
export function readExamDraft(store: DraftStorage): ExamDraft | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isValidExamDraft(parsed)) return null;
  return {
    ...parsed,
    answers: sanitizeAnswers((parsed as unknown as Record<string, unknown>).answers, parsed.sections),
    index: sanitizeIndex((parsed as unknown as Record<string, unknown>).index, parsed.sections),
  };
}

export function clearExamDraft(store: DraftStorage): void {
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    /* storage хаагдсан — дараагийн бичилтэд дахин оролдоно */
  }
}
