/**
 * Фонт бэлтгэх — Google Fonts CDN-ээс салж, өөрөө байршуулна.
 * ------------------------------------------------------------------
 * Яагаад: офлайн горимд CDN-ээс фонт татах боломжгүй тул япон үсэг
 * tofu (▯) болж харагддаг байсан. Мөн CDN нь нэмэлт DNS/TLS хүлээлт үүсгэдэг.
 *
 * Юу хийдэг (B7 — жинхэнэ подсет + unicode-range):
 *  1. `public/data/**`-д бодитоор хэрэглэгдсэн бүх тэмдэгтийг цуглуулна
 *     (+ кана, латин, монгол кирилл, цэг таслал, `src/**`-ийн хатуу текст),
 *  2. япон фонтуудыг хэсэгт таслана — эхний ачаалалд зөвхөн жижиг `core`
 *     татагдана, бусад нь unicode-range-аар хэрэгтэй үедээ ирнэ:
 *       Noto Sans JP:  core = латин + кирилл + кана + N5/N4 ханз + UI хатуу текст
 *                      n4/n3/n2/n1 = түвшин бүрийн ханз, rest = ховор тэмдэгт
 *       Noto Serif JP: core = **зөвхөн font-mincho элементэд гарч болох тэмдэгт*
 *                      (static текст + icon-энум: 語漢復題… ~82) + латин
 *                      n4 = N5+N4, n3/n2/n1, rest = кана + ховор тэмдэгт
 *     Яагаад serif-ийг тусад нь жижигчилсэн: UI-ийн гарчиг/иконууд mincho-д
 *     байдаг ч тэд **хэдхэн арав** тэмдэгт — бүх N5/N4-ийг core-д оруулбал
 *     эхний ачаалал 246 kB serif нэмээд 480 kB болдог. Одоо эхний ачааллын
 *     фонт < 300 kB. Өгөгдөлдээс ирдэг (ханзан тэмдэг, толийн үг) mincho
 *     текст тухайн хуудсандаа level chunk-аа татна — «lazily, where used».
 *     Хэсгүүд бие биеэсээ ТЭНЦЭЛГҮЙ (нийлэлдэггүй) — ижил тэмдэгт
 *     хоёр хэсэгт орохгүй тул browser ямар face-ийг сонгохоо мэднэ.
 *  3. Manrope / JetBrains Mono жинхэнэ дээжнээр үлдэнэ (жижиг, латин),
 *  4. `src/fonts.css`-ийг үүсгэнэ (font-display: swap + unicode-range).
 *
 * Дараа шалгалт: `node scripts/check-font-coverage.mjs` — өгөгдөлд байгаа
 * БҮХ тэмдэгт ямар нэг хэсгийн unicode-range-д байгаа эсэхийг баталгаажуулна.
 *
 * Шаардлага: python3 + fonttools + brotli (`pip install fonttools brotli`).
 * Эх фонт `.cache/fontsrc/`-д кэшлэгдэнэ (gitignored) — дахин татахгүй.
 *
 *   node scripts/build-fonts.mjs           # фонт үүсгэх
 *   node scripts/build-fonts.mjs --check   # дутуу эх фонт байвал л татна
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DATA = "public/data";
const SRC = ".cache/fontsrc";
const OUT = "src/assets/fonts";

const SOURCES = {
  manrope: {
    file: "Manrope[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf",
    family: "Manrope",
    weight: "200 800",
    sets: ["latin", "cyrillic"],
  },
  "noto-sans-jp": {
    file: "NotoSansJP[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf",
    family: "Noto Sans JP",
    weight: "100 900",
    sets: ["latin", "cyrillic", "kana", "kanji"],
    chunked: true,
  },
  "noto-serif-jp": {
    file: "NotoSerifJP[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf",
    family: "Noto Serif JP",
    weight: "200 900",
    sets: ["latin", "kana", "kanji"],
    chunked: true,
  },
  "jetbrains-mono": {
    file: "JetBrainsMono[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
    family: "JetBrains Mono",
    weight: "100 800",
    sets: ["latin"],
  },
};

/** Япон хэсгийн эрэмбэ — өмнөх нь давамгайлна (disjoint үлдээнэ).
 * `n4` зөвхөн Serif-д ашиглагдана (N5+N4 → Sans-д core-д ордог). */
const CHUNKS = ["core", "n4", "n3", "n2", "n1", "rest"];

function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync("curl", ["-sSL", "-o", dest, url], { stdio: "inherit" });
  return true;
}

/* ─────────── тэмдэгтийн багц ─────────── */

const BASE_SETS = {
  latin: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?'\"()[]{}<>/\\|@#$%^&*-_=+~`→←↑↓↔×÷±°№",
  // монгол кирилл + орос кирилл + түгээмэл тэмдэг
  cyrillic:
    "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя" +
    "ӨөҮүҮү" +
    "«»„“”‘’–—…·•†‡§¶©®™±≤≥≠≈∞",
  kana:
    "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ" +
    "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ・ー〜「」『』（）［］｛｝【】〈〉《》〔〕・、。，．：；？！",
};

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** public/data дахь бүх string-ийн тэмдэгтүүд (канжи + жишээ өгүүлбэр г.м.). */
function dataChars() {
  const set = new Set();
  for (const f of walk(DATA)) {
    const raw = fs.readFileSync(f, "utf8");
    for (const ch of raw) set.add(ch);
  }
  return set;
}

/** Япон текст агуулсан UI файлуудын хатуу тэмдэгт (模擬試験, 結果発表 г.м.). */
function uiChars() {
  const set = new Set();
  const files = [];
  const walkSrc = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "assets" || e.name === "fonts") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkSrc(p);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walkSrc("src");
  for (const f of files) {
    const raw = fs.readFileSync(f, "utf8");
    for (const ch of raw) {
      const cp = ch.codePointAt(0);
      // кана + CJK + тэмдэг (латин/кириллийг япон фонтод шаардлагагүй)
      if ((cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef)) {
        set.add(ch);
      }
    }
  }
  return set;
}

const isJapaneseChar = (ch) => {
  const cp = ch.codePointAt(0);
  return (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef);
};

function tsxFiles() {
  const out = [];
  const walkSrc = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "assets" || e.name === "fonts") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkSrc(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
  };
  walkSrc("src");
  return out;
}

/**
 * ЯПОН үсэг гарч болох `font-mincho` элементүүдийн тэмдэгт (Serif `core`).
 *   1) JSX-ийн font-mincho элементийн статик текст (近無完設…)
 *   2) icon-энум утгууд: `k: "…"` (nav/tab/session), `icon: "…"` (achievement),
 *      `jp: "…"` (түвшний нэр, шалгалтын хэсэг) — эдгээрийг динамикаар
 *      {tab.k} / {o.k} / {rank.jp} хэлбэрээр mincho руу оруулдаг.
 * Өгөгдөлдээс ирдэг mincho текст (ханзан тэмдэг, толийн төв үг, хайлтын үр дүн)
 * энд орохгүй — тэд өөрийн level chunk-аа татна (lazily, «where used»).
 */
function minchoCoreChars() {
  const set = new Set();
  const add = (s) => {
    for (const ch of String(s)) if (isJapaneseChar(ch)) set.add(ch);
  };
  for (const f of tsxFiles()) {
    const raw = fs.readFileSync(f, "utf8");
    let idx = 0;
    while ((idx = raw.indexOf("font-mincho", idx)) !== -1) {
      const start = raw.lastIndexOf("<", idx);
      const open = raw.indexOf(">", idx);
      if (start < 0 || open < 0) {
        idx += 10;
        continue;
      }
      const tag = /^<(\w+)/.exec(raw.slice(start))?.[1] ?? "span";
      const end = raw.indexOf(`</${tag}>`, open);
      const body = raw.slice(open + 1, end > 0 ? end : open + 500);
      let depth = 0;
      let lit = "";
      for (const ch of body) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        else if (depth === 0) lit += ch;
      }
      add(lit);
      idx += 10;
    }
    // icon-энум утгууд: объект (`k: "語"`, `jp: "入門"`) + JSX attribute
    // (`icon="空"` — `<Empty icon="空"/>` шиг). `k=`/`jp=`-ийг оруулахгүй:
    // тэд "session"/"level" гэх мэт АНГЛИ үгийг ч тэгж авч core 40 kB-аар томроно.
    for (const m of raw.matchAll(/\b(?:k|jp):\s*"([^"\\\n]+)"/g)) add(m[1]);
    for (const m of raw.matchAll(/\bicon\s*[:=]\s*"([^"\\\n]+)"/g)) add(m[1]);
  }
  return set;
}

/** Япон фонтод зориулсан түвшин бүрийн ханз (public/data/kanji/*.json).
 *  Sans: N5+N4 → `core`. Serif: N5+N4 → тусгай `n4` (serif core жижиг байх ёстой). */
function kanjiByLevel(n5n4Target) {
  const out = { [n5n4Target]: new Set(), n3: new Set(), n2: new Set(), n1: new Set() };
  const map = { n5: n5n4Target, n4: n5n4Target, n3: "n3", n2: "n2", n1: "n1" };
  for (const [file, chunk] of Object.entries(map)) {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA, "kanji", `${file}.json`), "utf8"));
    const list = Array.isArray(raw) ? raw : Object.values(raw);
    for (const k of list) if (typeof k?.k === "string") for (const ch of k.k) out[chunk].add(ch);
  }
  return out;
}

/**
 * Бүх тэмдэгтийг хэсэгт хуваана (disjoint — эхэнд нь дарсан хэсэг ялна).
 * @param {string} slug  "noto-sans-jp" | "noto-serif-jp"
 * @returns {Record<string, Set<string>>}
 */
function splitChunks(sets, slug) {
  const serif = slug === "noto-serif-jp";
  const levels = kanjiByLevel(serif ? "n4" : "core");
  const has = (set, ch) => set.has(ch);
  const buckets = Object.fromEntries(CHUNKS.map((c) => [c, new Set()]));
  const kanjiLevelOf = (ch) => {
    for (const c of ["core", "n4", "n3", "n2", "n1"]) if (levels[c] && has(levels[c], ch)) return c;
    return "rest";
  };
  // 1) баз (латин/кирилл/кана) → core.
  //    Serif-д кана-г core-д ОРУУЛДАГГҮЙ: бүх кана (≈34 kB) core-д орвол
  //    хэмжээ буцаад өснө — `rest`-д үлдэнэ (mincho-д ховор).
  for (const s of sets) {
    if (serif && s === "kana") continue;
    for (const ch of BASE_SETS[s] ?? "") buckets.core.add(ch);
  }
  // 2) UI хатуу текст → ДАВУУЛЖ core-д (навигацийн иконууд 賞・辞・管 зэрэг
  //    ховор ханз байсан ч эхний хуудас тэдгээрийг татаж нэмэлт chunk
  //    татахгүй — үгүйгээр нэг хуудас 4-5 chunk нэгэн зэрэг татагдана).
  //    Serif: **зөвхөн font-mincho-д гарч болох** тэмдэгт (~82 → 36 kB) —
  //    бүх UI-ийг авбал serif core 133 kB болж эхний ачаалал 480 kB болно (B7).
  const uiSet = serif ? minchoCoreChars() : uiChars();
  for (const ch of uiSet) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x3000) buckets.core.add(ch);
  }
  // Serif: UI-ийн үлдсэн JP тэмдэгт (mincho-д гардаггүй хэдий ч кодад байгаа
  // жишээ тэмдэгт г.м.) → `rest`. Хамгаалалтын шалгалт (check-font-coverage)
  // бүх src тэмдэгтэд serif-ийг шаарддаг тул энд үлдээнэ — гэхдээ core-д БИШ
  // (эхний ачааллыг жижиг байлгана), хэрэгтэй үедээ л татагдана.
  if (serif) {
    for (const ch of uiChars()) if (!buckets.core.has(ch)) buckets.rest.add(ch);
  }
  // 3) өгөгдлийн бүх тэмдэгт — **зөвхөн нэг хэсэгт** (disjoint).
  //    Ижил тэмдэгт хоёр range-д байвал Chrome бүх тухай face-ийг татдаг
  //    тул core-д аль хэдийн орсон тэмдэгтийг level-хэсэгт ДАХИН нэмэхгүй.
  for (const ch of dataChars()) {
    if (buckets.core.has(ch)) continue;
    const cp = ch.codePointAt(0);
    if (cp <= 0x2e7f) {
      buckets.core.add(ch); // ASCII/JSON тэмдэгт — ямар ч япон фонтод байх ёстой
      continue;
    }
    buckets[kanjiLevelOf(ch)].add(ch);
  }
  // 4) базын кана — Sans: core-д баталгаажуулна. Serif: `rest`-д (core жижиг үлдээнэ).
  if (sets.includes("kana")) {
    for (const ch of BASE_SETS.kana) buckets[serif ? "rest" : "core"].add(ch);
  }
  // 5) хэсгүүд хоорондоо НИЙЛЭЛДЭГГҮЙ (disjoint) эсэхийг баталгаажуулна
  const seen = new Set();
  for (const c of CHUNKS) {
    for (const ch of buckets[c]) {
      if (seen.has(ch)) buckets[c].delete(ch);
      else seen.add(ch);
    }
  }
  return buckets;
}

/** Кодпойнтоос CSS unicode-range (U+0041-005A хэлбэр). */
function unicodeRange(chars) {
  const cps = [...new Set([...chars].map((c) => c.codePointAt(0)))].filter((c) => Number.isFinite(c)).sort((a, b) => a - b);
  if (!cps.length) return "";
  const parts = [];
  let start = cps[0];
  let prev = cps[0];
  const push = (a, b) => parts.push(a === b ? `U+${a.toString(16).toUpperCase()}` : `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`);
  for (let i = 1; i < cps.length; i++) {
    const cp = cps[i];
    if (cp === prev + 1) {
      prev = cp;
      continue;
    }
    push(start, prev);
    start = cp;
    prev = cp;
  }
  push(start, prev);
  return parts.join(", ");
}

function charsetFor(sets, slug = "") {
  const chars = new Set();
  for (const s of sets) {
    if (s === "kanji") continue;
    for (const ch of BASE_SETS[s] ?? "") chars.add(ch);
  }
  if (sets.includes("kanji")) {
    const buckets = splitChunks(sets, slug);
    for (const set of Object.values(buckets)) for (const ch of set) chars.add(ch);
  }
  return [...chars].filter((c) => c.trim() !== "" || c === " ").join("");
}

/* ─────────── таслах ─────────── */

/** `pyftsubset` PATH-д байвал түүнийг, үгүй бол `python -m fontTools.subset`. */
function subsetCmd(args) {
  const hasBin = (() => {
    try {
      execFileSync(process.platform === "win32" ? "where" : "which", ["pyftsubset"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();
  const env = { ...process.env, PYTHONPATH: path.join(process.cwd(), ".cache/pylibs") };
  if (hasBin) execFileSync("pyftsubset", args, { stdio: "inherit", env });
  else execFileSync("python", ["-m", "fontTools.subset", ...args], { stdio: "inherit", env });
}

function subset(src, dest, text) {
  const textFile = path.join(SRC, `chars-${path.basename(dest, ".woff2")}.txt`);
  fs.writeFileSync(textFile, text);
  subsetCmd([
    src,
    `--text-file=${textFile}`,
    "--flavor=woff2",
    "--layout-features=kern,liga,calt,locl,vert,vrt2,palt,ccmp,mark,mkmk",
    "--no-hinting",
    "--desubroutinize",
    `--output-file=${dest}`,
  ]);
}

/* ─────────── үндсэн ─────────── */

fs.mkdirSync(SRC, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const faces = [];
const manifest = { generatedAt: new Date().toISOString(), chunks: {}, fonts: {} };
let total = 0;

for (const [slug, cfg] of Object.entries(SOURCES)) {
  const src = path.join(SRC, cfg.file);
  const fetched = download(cfg.url, src);
  const entries = [];

  if (cfg.chunked) {
    const buckets = splitChunks(cfg.sets, slug);
    for (const chunk of CHUNKS) {
      const chars = buckets[chunk];
      if (!chars.size) continue;
      const dest = path.join(OUT, `${slug}-${chunk}.woff2`);
      subset(src, dest, [...chars].join(""));
      const bytes = fs.statSync(dest).size;
      total += Math.round(bytes / 1024);
      entries.push({ chunk, file: `${slug}-${chunk}.woff2`, bytes, chars: chars.size, range: unicodeRange(chars) });
      faces.push(
        `@font-face {\n` +
          `  font-family: "${cfg.family}";\n` +
          `  font-style: normal;\n` +
          `  font-weight: ${cfg.weight};\n` +
          `  font-display: swap;\n` +
          `  src: url("./assets/fonts/${slug}-${chunk}.woff2") format("woff2");\n` +
          `  unicode-range: ${unicodeRange(chars)};\n` +
          `}`,
      );
      console.log(
        `${fetched ? "татсан" : "кэш"}  ${slug}-${chunk}.woff2  ${Math.round(bytes / 1024)} kB  (${chars.size} тэмдэгт)`,
      );
    }
  } else {
    const text = charsetFor(cfg.sets, slug);
    const dest = path.join(OUT, `${slug}.woff2`);
    subset(src, dest, text);
    const bytes = fs.statSync(dest).size;
    total += Math.round(bytes / 1024);
    entries.push({ chunk: "all", file: `${slug}.woff2`, bytes, chars: text.length, range: "" });
    faces.push(
      `@font-face {\n` +
        `  font-family: "${cfg.family}";\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${cfg.weight};\n` +
        `  font-display: swap;\n` +
        `  src: url("./assets/fonts/${slug}.woff2") format("woff2");\n` +
        `}`,
    );
    console.log(`${fetched ? "татсан" : "кэш"}  ${slug}.woff2  ${Math.round(bytes / 1024)} kB  (${text.length} тэмдэгт)`);
  }

  manifest.fonts[slug] = { family: cfg.family, chunked: !!cfg.chunked, entries };
}

// Эхний ачаалалд шаардлагатай жижиг файлууд (vite.config.ts preload + SW critical)
manifest.critical = ["manrope", "jetbrains-mono", "noto-sans-jp-core"].map((p) => {
  const e = Object.values(manifest.fonts).flatMap((f) => f.entries).find((x) => x.file.startsWith(p));
  return e?.file ?? null;
}).filter(Boolean);
manifest.warm = Object.values(manifest.fonts).flatMap((f) => f.entries).map((e) => e.file).filter((f) => !manifest.critical.includes(f));

const css =
  `/* AUTO-GENERATED by scripts/build-fonts.mjs — бүү гараар засварла.\n` +
  `   Локал woff2 (variable), Google Fonts CDN-гүй → офлайн ч зөв харагдана.\n` +
  `   Япон фонт 5 хэсэгт unicode-range-тай: эхний ачаалалд зөвхөн core\n` +
  `   татагдана, бусад нь хэрэгтэй тэмдэгт гарах үедээ ирнэ (B7). */\n\n` +
  faces.join("\n\n") +
  "\n";

fs.writeFileSync("src/fonts.css", css);
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

const license =
  `# Фонтын лиценз\n\n` +
  `Бүх фонт SIL Open Font License 1.1-тэй бөгөөд \`scripts/build-fonts.mjs\`-ээр\n` +
  `өгөгдлийн тэмдэгтийн багцад таслагдсан (woff2, unicode-range-тай хэсэгчилсэн).\n\n` +
  `| Фонт | Лиценз | Эх сурвалж |\n|---|---|---|\n` +
  `| Manrope | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/manrope |\n` +
  `| Noto Sans JP | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/notosansjp |\n` +
  `| Noto Serif JP | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/notoserifjp |\n` +
  `| JetBrains Mono | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/jetbrainsmono |\n`;
fs.writeFileSync(path.join(OUT, "README.md"), license);

const firstLoad = manifest.critical.reduce((a, f) => {
  const e = Object.values(manifest.fonts).flatMap((x) => x.entries).find((x) => x.file === f);
  return a + (e?.bytes ?? 0);
}, 0);

console.log(`\nнийт ${total} kB · эхний ачааллын критик фонт ${Math.round(firstLoad / 1024)} kB`);
console.log(`src/fonts.css + ${path.join(OUT, "manifest.json")} бичигдлээ`);
