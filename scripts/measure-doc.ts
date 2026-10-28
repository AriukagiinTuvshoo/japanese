/**
 * B4 — Докийн хэмжээг хэмжих (мергөжүүлэл, docs/PROGRESS.md B4-д бичнэ).
 *
 * Нэг `Doc` нь localStorage-д нэг JSON бичлэгээр (`nd:doc:<uid>`) бичигдэнэ.
 * Тиймээс хэмжээ нь бичлэг бүрийн бодит хэмжээтэй тэнцэнэ.
 *
 * Run: npx vite-node scripts/measure-doc.ts
 */
import { freshDoc } from "../src/lib/storage";
import type { Doc, ActivityDay } from "../src/lib/store";
import type { Card } from "../src/lib/srs";

const DAY = 86_400_000;
const now = Date.now();

function card(i: number, heavy: boolean): Card {
  return {
    due: now + (i % 90) * DAY,
    st: (i % 40) + 1,
    df: (i % 10) + 1,
    n: i % 60,
    l: i % 4,
    last: now - (i % 30) * DAY,
    ph: (["new", "learning", "review", "relearn"] as const)[i % 4],
    streak: i % 12,
    // 12 градүүдийн түүх — бодит дээд хязгаар (sync.ts HISTORY_CAP)
    h: Array.from({ length: heavy ? 12 : 6 }, (_, k) => k % 4),
  };
}

function day(i: number): ActivityDay {
  const base = { xp: (i * 7) % 300, min: (i % 60) + 1, newCards: i % 15, reviews: i % 120, correct: i % 90, total: i % 130 };
  return { ...base, parts: { "dev-a": base, "dev-b": base } };
}

function build(spec: {
  cards: number; days: number; mistakes: number; exams: number; quizzes: number;
  mnemonics: number; favorites: number; devices: number;
}): Doc {
  const d = freshDoc("Төвшин");
  d.xp = 12_500;
  d.xpParts = Object.fromEntries(Array.from({ length: spec.devices }, (_, i) => [`dev-${i}`, Math.round(12_500 / spec.devices)]));
  for (let i = 0; i < spec.cards; i++) d.srs[`v${i}`] = card(i, true);
  for (let i = 0; i < spec.days; i++) {
    const t = new Date(now - i * DAY);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    d.activity[key] = day(i);
  }
  d.mistakes = Array.from({ length: spec.mistakes }, (_, i) => ({
    id: `m${i}`, kind: "vocab", level: "N5", prompt: "шилжүүлэг", answer: "хариу", given: "буруу",
    at: now - i * 60_000, count: (i % 3) + 1,
  }));
  d.exams = Array.from({ length: spec.exams }, (_, i) => ({
    id: `e${i}`, level: "N5", at: now - i * DAY, sections: [], total: 40, max: 60,
    passed: i % 2 === 0, minutes: 105, mock: true,
  }));
  d.quizzes = Array.from({ length: spec.quizzes }, (_, i) => ({
    at: now - i * DAY, kind: "mixed", level: "N4", correct: i % 20, total: 20, minutes: 5,
  }));
  d.mnemonics = Object.fromEntries(Array.from({ length: spec.mnemonics }, (_, i) => [`漢${i}`, "санах ойн тэмдэглэл урттай текст жишээ" ]));
  d.favorites = Array.from({ length: spec.favorites }, (_, i) => `v${i}`);
  return d;
}

function report(label: string, doc: Doc) {
  const raw = JSON.stringify(doc);
  const bytes = Buffer.byteLength(raw, "utf8");
  const kb = (bytes / 1024).toFixed(1);
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  console.log(
    `${label.padEnd(22)} cards=${String(Object.keys(doc.srs).length).padStart(5)}` +
      ` days=${String(Object.keys(doc.activity).length).padStart(5)}` +
      ` mistakes=${String(doc.mistakes.length).padStart(4)}` +
      ` → ${kb.padStart(9)} kB (${mb} MB)`,
  );
  return bytes;
}

const light = build({ cards: 0, days: 0, mistakes: 0, exams: 0, quizzes: 0, mnemonics: 0, favorites: 0, devices: 1 });
const typical = build({ cards: 600, days: 180, mistakes: 30, exams: 5, quizzes: 20, mnemonics: 20, favorites: 40, devices: 2 });
const heavy = build({ cards: 10_461, days: 1_095, mistakes: 500, exams: 120, quizzes: 300, mnemonics: 200, favorites: 400, devices: 3 });
const worst = build({ cards: 20_000, days: 2_000, mistakes: 2_000, exams: 500, quizzes: 1_000, mnemonics: 1_000, favorites: 2_000, devices: 5 });

report("Анхны (хоосон)", light);
report("Типик (6 сар)", typical);
report("Хүнд (3 жил, бүх үг)", heavy);
report("Хэт хүнд (стресс)", worst);

// localStorage-ийн бодит заавал баримт: 5 нөөц + 3 sync нөөц + бусад түлхүүр
const perBackup = typical;
console.log(`\nТипик бичлэг × (1 основ + 3 sync нөөц + 1 импорт undo + 1 коррупт нөөц) ≈ ${((Buffer.byteLength(JSON.stringify(perBackup)) * 6) / (1024 * 1024)).toFixed(2)} MB`);
