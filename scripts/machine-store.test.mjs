/**
 * Machine орчуулгын стор нь **текст түлхүүртэй** байх ёстой.
 *
 * Түүх: `content/mn/machine/{vocab,kanji}.json` нь өмнө `{ n5: { "0": "..." } }`
 * хэлбэртэй, `public/data` дахь массивын **индексээр** тулгагддаг байв. Эрэмбэ
 * (жишээ: ханзны freq тэнцэх бүлэг) өөрчлөгдөхөд орчуулга өөр үг/ханз дээр
 * наалдаж, контентыг чимээгүй эвддэг. Одоо түлхүүр нь үгийн хувьд
 * `<бичлэг>|<уншлага>`, ханзны хувьд ханз өөрөө.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

const vocabStore = read("content/mn/machine/vocab.json");
const kanjiStore = read("content/mn/machine/kanji.json");
const vocab = LEVELS.flatMap((lv) => read(`public/data/vocab/${lv}.json`));
const kanji = LEVELS.flatMap((lv) => read(`public/data/kanji/${lv}.json`));

describe("machine store — текст түлхүүр", () => {
  it("түвшний түлхүүр (хуучин индекс формат) байхгүй", () => {
    for (const store of [vocabStore, kanjiStore]) {
      expect(LEVELS.filter((lv) => store[lv] !== undefined)).toEqual([]);
    }
  });

  it("үгийн сторын түлхүүр бүр `<бичлэг>|<уншлага>` бөгөөд өгөгдөлд байна", () => {
    const keys = Object.keys(vocabStore);
    expect(keys.length).toBeGreaterThan(3000);
    const present = new Set(vocab.map((v) => `${v.w}|${v.r}`));
    const orphan = keys.filter((k) => !k.includes("|") || !present.has(k));
    expect(orphan.slice(0, 5)).toEqual([]);
  });

  it("ханзны сторын түлхүүр бүр нэг ханз бөгөөд өгөгдөлд байна", () => {
    const keys = Object.keys(kanjiStore);
    expect(keys.length).toBeGreaterThan(1000);
    const present = new Set(kanji.map((k) => k.k));
    const orphan = keys.filter((k) => [...k].length !== 1 || !present.has(k));
    expect(orphan.slice(0, 5)).toEqual([]);
  });

  it("түлхүүртэй орчуулга нь өгөгдлийн `mn`-тэй давхцана (алдагдалгүй)", () => {
    const byKey = new Map(vocab.map((v) => [`${v.w}|${v.r}`, v]));
    const mismatched = Object.keys(vocabStore).filter((k) => {
      const v = byKey.get(k);
      return v && v.mq === "auto" && v.mn?.[0] !== vocabStore[k];
    });
    expect(mismatched.slice(0, 5)).toEqual([]);
  });
});
