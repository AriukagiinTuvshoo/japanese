/** Япон хэлний текст, кана, фуриганатай ажиллах туслах функцууд. */

import type { Level } from "./types";
import type { Language } from "./i18n";

export const HIRA_START = 0x3041;
export const KATA_START = 0x30a1;

const GRAMMAR_LABELS: Record<string, string> = {
  subject: "өгүүлэгдэхүүн",
  time: "цаг хугацаа",
  destination: "очих газар",
  "place of existence": "оршин буй байрлал",
  "indirect object": "шууд бус тусагдахуун",
  frequency: "давтамж",
  "place of action": "үйлдэл болох газар",
  means: "арга хэрэгсэл",
  and: "холбоос",
  with: "хамт",
  or: "эсвэл",
  possessive: "эзэмшил",
  from: "эхлэл",
  until: "төгсгөл",
  question: "асуулт",
  named: "нэршил",
  "na-adjective": "な-тэмдэг нэр",
  approximately: "ойролцоо хэмжээ",
};

/** Дүрмийн pattern дотор үлдсэн англи тайлбар шошгыг монголоор харуулна (en горимд англиар нь үлдээнэ). */
export function grammarLabel(pattern: string, language: Language = "mn") {
  if (language === "en") return pattern;
  return pattern.replace(/[（(]([^）)]+)[）)]/g, (whole, label: string) => {
    const translated = GRAMMAR_LABELS[label.trim().toLowerCase()];
    return translated ? `（${translated}）` : whole;
  });
}

export function isKanji(ch: string) {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff);
}
export function isKana(ch: string) {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x3041 && c <= 0x309f) || (c >= 0x30a0 && c <= 0x30ff);
}
export function hasKanji(s: string) {
  return [...s].some(isKanji);
}

/** Катакана → хирагана (хайлт, уншилт харьцуулахад). */
export function toHiragana(s: string) {
  return [...s]
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      // ァ..ヶ мужийг ぁ..ゖ руу шилжүүлнэ
      if (c >= 0x30a1 && c <= 0x30f6) return String.fromCodePoint(c - 0x60);
      return ch;
    })
    .join("");
}

const ROMAJI: Record<string, string> = {};
(() => {
  const rows: [string, string][] = [
    ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
    ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
    ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
    ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
    ["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
    ["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"],
    ["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"],
    ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
    ["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"],
    ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
    ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
    ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
    ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
    ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
    ["わ", "wa"], ["を", "o"], ["ん", "n"],
    ["ぁ", "a"], ["ぃ", "i"], ["ぅ", "u"], ["ぇ", "e"], ["ぉ", "o"],
    ["ゃ", "ya"], ["ゅ", "yu"], ["ょ", "yo"], ["ー", "-"],
    ["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"],
    ["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"],
    ["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"],
    ["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"],
    ["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"],
    ["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"],
    ["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"],
    ["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"],
    ["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"],
    ["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"],
    ["ぴゃ", "pya"], ["ぴゅ", "pyu"], ["ぴょ", "pyo"],
    ["ふぁ", "fa"], ["ふぃ", "fi"], ["ふぇ", "fe"], ["ふぉ", "fo"],
    ["ゔ", "vu"], ["てぃ", "ti"], ["でぃ", "di"], ["うぇ", "we"],
  ];
  for (const [k, v] of rows) ROMAJI[k] = v;
})();

/** Хирагана → Хэпбёрн ромажи. */
export function toRomaji(kana: string): string {
  const s = toHiragana(kana);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (ROMAJI[two]) { out += ROMAJI[two]; i++; continue; }
    const ch = s[i];
    if (ch === "っ") {
      const next = s.slice(i + 1, i + 3);
      const nr = ROMAJI[next] ?? ROMAJI[s[i + 1]] ?? "";
      out += nr[0] ?? "";
      continue;
    }
    out += ROMAJI[ch] ?? ch;
  }
  return out;
}

/** Ромажи → хирагана (хайлтын оролтод). */
export function romajiToKana(input: string): string {
  const s = input.toLowerCase().replace(/[^a-z\-]/g, "");
  const entries = Object.entries(ROMAJI)
    .filter(([k]) => k !== "ー")
    .sort((a, b) => b[0].length - a[0].length || b[1].length - a[1].length);
  let out = "";
  let i = 0;
  while (i < s.length) {
    let matched = false;
    // っ (давхар гийгүүлэгч)
    if (i + 1 < s.length && s[i] === s[i + 1] && /[a-z]/.test(s[i]) && !"aeioun".includes(s[i])) {
      out += "っ";
      i++;
      continue;
    }
    for (const [kana, rom] of entries) {
      if (s.startsWith(rom, i)) { out += kana; i += rom.length; matched = true; break; }
    }
    if (!matched) { i++; }
  }
  return out;
}

/**
 * `{漢字|かんじ}` markup-г Ruby компонент болгон задална.
 * OpenJLPT-ийн жишээ өгүүлбэр энэ хэлбэрээр ирдэг.
 */
export interface RubyPart {
  base: string;
  ruby?: string;
}

export function parseFurigana(text: string): RubyPart[] {
  const parts: RubyPart[] = [];
  const re = /\{([^|{}]+)\|([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ base: text.slice(last, m.index) });
    parts.push({ base: m[1], ruby: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ base: text.slice(last) });
  return parts;
}

/** markup-гүй цэвэр текст. */
export function stripFurigana(text: string) {
  return text.replace(/\{([^|{}]+)\|([^}]+)\}/g, "$1");
}

/** Огнооны түлхүүр (орон нутгийн цагаар) — YYYY-MM-DD. */
export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayOffset(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

/** Хүн уншихад ойлгомжтой хугацаа. */
export function relTime(ts: number, language: Language = "mn") {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (language === "en") {
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const he = Math.round(min / 60);
    if (he < 24) return `${he} h ago`;
    const de = Math.round(he / 24);
    if (de < 30) return `${de} d ago`;
    return new Date(ts).toLocaleDateString("en-US");
  }
  if (min < 1) return "сая";
  if (min < 60) return `${min} мин өмнө`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} цаг өмнө`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} өдөр өмнө`;
  return new Date(ts).toLocaleDateString("mn-MN");
}

export function fmtDate(ts: number, language: Language = "mn") {
  return new Date(ts).toLocaleDateString(language === "en" ? "en-US" : "mn-MN", { year: "numeric", month: "long", day: "numeric" });
}

export const LEVEL_LABEL: Record<Language, Record<Level, string>> = {
  mn: {
    N5: "Суурь",
    N4: "Дунд-суурь",
    N3: "Дунд",
    N2: "Дунд-дээд",
    N1: "Дээд",
  },
  en: {
    N5: "Beginner",
    N4: "Elementary",
    N3: "Intermediate",
    N2: "Upper intermediate",
    N1: "Advanced",
  },
};

export const LEVEL_JP: Record<Level, string> = { N5: "入門", N4: "基礎", N3: "中級", N2: "上級", N1: "最上級" };

export const TYPE_LABEL: Record<Language, Record<string, string>> = {
  mn: {
    v: "Үйл үг",
    i: "и-тэмдэг",
    na: "на-тэмдэг",
    adj: "Тэмдэг үг",
    adv: "Дайвар",
    exp: "Хэллэг",
    pn: "Төлөөний үг",
    ctr: "Тоолуур",
    n: "Нэр үг",
    other: "—",
  },
  en: {
    v: "Verb",
    i: "i-adjective",
    na: "na-adjective",
    adj: "Adjective",
    adv: "Adverb",
    exp: "Expression",
    pn: "Pronoun",
    ctr: "Counter",
    n: "Noun",
    other: "—",
  },
};

export const MQ_LABEL: Record<Language, Record<string, { text: string; tone: "matcha" | "kin" | "ai" | "sumi" }>> = {
  mn: {
    curated: { text: "Хянасан", tone: "matcha" },
    draft: { text: "Драфт · хянагдаагүй", tone: "kin" },
    auto: { text: "Авто санал", tone: "kin" },
    derived: { text: "Ханзнаас", tone: "kin" },
    none: { text: "Орчуулга хүлээгдэж байна", tone: "sumi" },
  },
  en: {
    curated: { text: "Reviewed", tone: "matcha" },
    draft: { text: "Draft · unreviewed", tone: "kin" },
    auto: { text: "Auto suggestion", tone: "kin" },
    derived: { text: "From kanji", tone: "kin" },
    none: { text: "Translation pending", tone: "sumi" },
  },
};

/** Түвшний тохирох POS / төрөл. */
export function typeTone(t: string): "ai" | "matcha" | "kin" | "murasaki" | "shu" {
  return ({ v: "shu", i: "ai", na: "murasaki", adj: "ai", adv: "matcha", exp: "kin", n: "sumi", pn: "murasaki", ctr: "kin", other: "sumi" } as const)[
    t as "v"
  ] ?? "sumi";
}
