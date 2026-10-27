/**
 * Фонт бэлтгэх — Google Fonts CDN-ээс салж, өөрөө байршуулна.
 * ------------------------------------------------------------------
 * Яагаад: офлайн горимд CDN-ээс фонт татах боломжгүй тул япон үсэг
 * tofu (▯) болж харагддаг байсан. Мөн CDN нь нэмэлт DNS/TLS хүлээлт үүсгэдэг.
 *
 * Юу хийдэг:
 *  1. `public/data/**`-д бодитоор хэрэглэгдсэн бүх тэмдэгтийг цуглуулна
 *     (+ кана, латин, монгол кирилл, цэг таслал),
 *  2. тэр тэмдэгтийн багцаар variable фонтуудыг таслана (pyftsubset → woff2),
 *  3. `src/fonts.css`-ийг үүсгэнэ (font-display: swap, unicode-range-гүй нэг файл).
 *
 * Шаардлага: python3 + fonttools + brotli (`pip install fonttools brotli`).
 * Эх фонт `.cache/fontsrc/`-д кэшлэгдэнэ (gitignored) — дахин татахгүй.
 *
 *   node scripts/build-fonts.mjs           # фонт үүсгэх
 *   node scripts/build-fonts.mjs --check    # дутуу эх фонт байвал л татна
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
  },
  "noto-serif-jp": {
    file: "NotoSerifJP[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf",
    family: "Noto Serif JP",
    weight: "200 900",
    sets: ["latin", "kana", "kanji"],
  },
  "jetbrains-mono": {
    file: "JetBrainsMono[wght].ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
    family: "JetBrains Mono",
    weight: "100 800",
    sets: ["latin"],
  },
};

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

function charsetFor(sets) {
  const chars = new Set();
  for (const s of sets) {
    if (s === "kanji") continue;
    for (const ch of BASE_SETS[s] ?? "") chars.add(ch);
  }
  if (sets.includes("kanji")) {
    // Өгөгдөлд байгаа бүх тэмдэгт; ASCII/JSON тэмдэгт нь хор хөнөөлгүй.
    for (const ch of dataChars()) if (ch.codePointAt(0) > 0x2e7f) chars.add(ch);
    for (const ch of BASE_SETS.latin) chars.add(ch);
  }
  return [...chars].filter((c) => c.trim() !== "" || c === " ").join("");
}

/* ─────────── таслах ─────────── */

function subset(src, dest, text) {
  const textFile = path.join(SRC, "chars.txt");
  fs.writeFileSync(textFile, text);
  execFileSync(
    "pyftsubset",
    [
      src,
      `--text-file=${textFile}`,
      "--flavor=woff2",
      "--layout-features=kern,liga,calt,locl,vert,vrt2,palt,ccmp,mark,mkmk",
      "--no-hinting",
      "--desubroutinize",
      `--output-file=${dest}`,
    ],
    { stdio: "inherit", env: { ...process.env, PYTHONPATH: path.join(process.cwd(), ".cache/pylibs") } },
  );
}

/* ─────────── үндсэн ─────────── */

fs.mkdirSync(SRC, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const faces = [];
let total = 0;

for (const [slug, cfg] of Object.entries(SOURCES)) {
  const src = path.join(SRC, cfg.file);
  const fetched = download(cfg.url, src);
  const text = charsetFor(cfg.sets);
  const dest = path.join(OUT, `${slug}.woff2`);
  subset(src, dest, text);
  const kb = Math.round(fs.statSync(dest).size / 1024);
  total += kb;
  console.log(`${fetched ? "татсан" : "кэш"}  ${slug}.woff2  ${kb} kB  (${text.length} тэмдэгт)`);

  faces.push(
    `@font-face {\n` +
      `  font-family: "${cfg.family}";\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${cfg.weight};\n` +
      `  font-display: swap;\n` +
      `  src: url("./assets/fonts/${slug}.woff2") format("woff2");\n` +
      `}`,
  );
}

const css =
  `/* AUTO-GENERATED by scripts/build-fonts.mjs — бүү гараар засварла.\n` +
  `   Локал woff2 (variable), Google Fonts CDN-гүй → офлайн ч зөв харагдана. */\n\n` +
  faces.join("\n\n") +
  "\n";

fs.writeFileSync("src/fonts.css", css);

const license =
  `# Фонтын лиценз\n\n` +
  `Бүх фонт SIL Open Font License 1.1-тэй бөгөөд \`scripts/build-fonts.mjs\`-ээр\n` +
  `өгөгдлийн тэмдэгтийн багцад таслагдсан (woff2).\n\n` +
  `| Фонт | Лиценз | Эх сурвалж |\n|---|---|---|\n` +
  `| Manrope | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/manrope |\n` +
  `| Noto Sans JP | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/notosansjp |\n` +
  `| Noto Serif JP | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/notoserifjp |\n` +
  `| JetBrains Mono | OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/jetbrainsmono |\n`;
fs.writeFileSync("src/assets/fonts/README.md", license);

console.log(`\nнийт ${total} kB · src/fonts.css бичигдлээ`);
