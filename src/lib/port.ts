/**
 * B3 — импорт/экспорт (JSON импорт + preview + undo, Anki CSV).
 * ------------------------------------------------------------------
 * Цэвэр логик + утга шалгалт: `parseImport` storage.ts-ийн **адилхан**
 * schema/шилжүүллэгээгээр (validateDoc → parseStoredDoc) ашиглана, ямар ч
 * тохиолдолд хэрэглэгчийн одоогийн ахицыг устгахгүй.
 *
 * Анхааруулга: Anki CSV эхэндээ **UTF-8 BOM** (`\uFEFF`)-тай гарна — Anki
 * импортын үед кодлолыг зөв танихын тулд. Бусад CSV уншигч BOM-г алгасдаг.
 */
import type { Kanji, Vocab } from "./types";
import type { Doc } from "./store";
import { SCHEMA_VERSION, validateDoc } from "./storage";
import { computeStreak } from "./text";
import { mergeDocs } from "./merge";

/** Файлын дээд хэмжээ — 5 МБ-аас дээшийг уншихаас ӨМНӨ татгалзана. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface ImportPreview {
  version: number;
  xp: number;
  cards: number;
  reviews: number;
  streak: number;
  days: number;
  favorites: number;
  mistakes: number;
  achievements: number;
  updatedAt: number;
}

export type ImportErrorCode = "tooLarge" | "badJson" | "badDoc" | "newerVersion";
export type ImportResult =
  | { ok: true; doc: Doc; preview: ImportPreview }
  | { ok: false; error: ImportErrorCode; detail?: string };

export type ImportMode = "merge" | "replace";

/* ─────────────── прототип бохирдохоос хамгаалах ─────────────── */

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function findUnsafeKey(v: unknown, depth = 0): string | null {
  if (v === null || typeof v !== "object" || depth > 10) return null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const hit = findUnsafeKey(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  for (const k of Object.keys(v as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(k)) return k;
    const hit = findUnsafeKey((v as Record<string, unknown>)[k], depth + 1);
    if (hit) return hit;
  }
  return null;
}

/* ─────────────── импорт ─────────────── */

/** Импортын preview — юу импортлохоо батлахаас ӨМНӨ харуулна. */
export function previewOf(doc: Doc): ImportPreview {
  return {
    version: doc.v,
    xp: doc.xp,
    cards: Object.keys(doc.srs).length,
    reviews: Object.values(doc.srs).reduce((a, c) => a + c.n, 0),
    streak: computeStreak(doc.activity),
    days: Object.values(doc.activity).filter((d) => d.xp > 0).length,
    favorites: doc.favorites.length,
    mistakes: doc.mistakes.length,
    achievements: Object.keys(doc.achievements).length,
    updatedAt: doc.updatedAt,
  };
}

/**
 * JSON файлыг шалгаж, хүчинтэй бол doc + preview буцаана.
 * АЛДАА төрөлүүд: `tooLarge` (5MB), `badJson`, `badDoc` (schema зөрсөн эсвэл
 * аюултай түлхүүр), `newerVersion` (шинэ хувилбараас ирсэн — алдаа алдана).
 */
export function parseImport(raw: string): ImportResult {
  if (typeof raw !== "string" || raw.length > MAX_IMPORT_BYTES) return { ok: false, error: "tooLarge" };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "badJson" };
  }

  const unsafe = findUnsafeKey(value);
  if (unsafe) return { ok: false, error: "badDoc", detail: `unsafe-key:${unsafe}` };

  const version = value && typeof value === "object" ? (value as { v?: unknown }).v : undefined;
  if (typeof version === "number" && Number.isFinite(version) && version > SCHEMA_VERSION) {
    return { ok: false, error: "newerVersion", detail: `v=${version}` };
  }

  const checked = validateDoc(value);
  if (!checked.ok) return { ok: false, error: "badDoc", detail: checked.reason };

  // validateDoc дотроо parseStoredDoc (шилжүүлэг + цэвэрлэгээ) аль хэдийн гүйцэтгэсэн.
  return { ok: true, doc: checked.doc, preview: previewOf(checked.doc) };
}

/** Нэгтгэх (default) эсвэл бүрэн солих. */
export function applyImport(current: Doc, incoming: Doc, mode: ImportMode, now = Date.now()): Doc {
  if (mode === "replace") return { ...incoming, updatedAt: Math.max(incoming.updatedAt, now) };
  return mergeDocs(current, incoming, { now }).doc;
}

/* ─────────────── Undo (сүүлийн импорт) ─────────────── */

export const importUndoKey = (uid: string) => `nd:doc:${uid}:importundo`;

/** Импортлахаас ӨМНӨХ баримтыг хадгална (нэг л үед). Устгах боломжгүй бол зүгээр алгасна. */
export function saveUndo(uid: string, doc: Doc): boolean {
  try {
    localStorage.setItem(importUndoKey(uid), JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function loadUndo(uid: string): Doc | null {
  try {
    const raw = localStorage.getItem(importUndoKey(uid));
    if (!raw) return null;
    const checked = validateDoc(JSON.parse(raw));
    return checked.ok ? checked.doc : null;
  } catch {
    return null;
  }
}

export function clearUndo(uid: string): void {
  try {
    localStorage.removeItem(importUndoKey(uid));
  } catch {
    /* private mode */
  }
}

/* ─────────────── Anki CSV (давталт/сул картууд) ─────────────── */

export interface ExportRow {
  id: string;
  front: string;
  back: string;
  tags: string[];
  due: boolean;
  weak: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 3);

/** Сул карт: алдсан (lapse) байсан, дахин суралцах төлөвт, эсвэл олон удаа буруудсан. */
export function isWeak(c: { l: number; ph: string; n: number; h: number[] }): boolean {
  if (c.l >= 1) return true;
  if (c.ph === "relearn") return true;
  return c.n >= 3 && avg(c.h) < 2;
}

/**
 * Давталтанд орсон (due) эсвэл сул (weak) картууд — Anki руу дамжуулах жагсаалт.
 * id: үгийн сан бол `v.id`, ханз бол тэмдэгт (`k.k`).
 */
export function exportRows(doc: Doc, vocab: Vocab[], kanji: Kanji[], at = Date.now()): ExportRow[] {
  const vMap = new Map(vocab.map((v) => [v.id, v]));
  const kMap = new Map(kanji.map((k) => [k.k, k]));
  const rows: ExportRow[] = [];

  for (const [id, c] of Object.entries(doc.srs)) {
    const due = c.due <= at;
    const weak = isWeak(c);
    if (!due && !weak) continue;

    const v = vMap.get(id);
    const k = kMap.get(id);
    const front = v ? `${v.w}（${v.r}）` : id;
    const back = v
      ? v.mn?.[0] ?? v.en[0] ?? ""
      : k
        ? `${k.on[0] ?? ""} / ${k.kun[0] ?? ""} — ${k.mn[0] ?? k.en[0] ?? ""}`
        : "";
    const level = v?.lvl ?? k?.lvl ?? "";
    const tags = [
      ...(level ? [level] : []),
      v ? "vocab" : k ? "kanji" : "unknown",
      ...(due ? ["due"] : []),
      ...(weak ? ["weak"] : []),
    ];
    rows.push({ id, front, back, tags, due, weak });
  }
  // Хариуцлагатай дараалал: эхлээд сул, дараа нь due.
  return rows.sort((a, b) => Number(b.weak) - Number(a.weak) || Number(b.due) - Number(a.due) || a.id.localeCompare(b.id));
}

/** CSV нүх:`,` ба `"` болон шинэ мөрийг онцолж хаана. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Anki-д импортлоход бэлэн CSV: `front,back,tags`.
 * BOM (`\uFEFF`) эхэнд нэмэгдэнэ — Anki UTF-8-ийг зөв танихын тулд
 * (бусад CSV уншигч BOM-г алгасдаг; docs/PROGRESS.md B3 тэмдэглэл).
 */
export function ankiCsv(doc: Doc, vocab: Vocab[], kanji: Kanji[], at = Date.now()): string {
  const rows = exportRows(doc, vocab, kanji, at);
  const lines = ["front,back,tags", ...rows.map((r) => [r.front, r.back, r.tags.join(" ")].map(csvCell).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
