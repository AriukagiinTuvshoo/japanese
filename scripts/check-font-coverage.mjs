/**
 * Фонт хамгаалалтын шалгалт (B7): public/data + UI-ийн ЯПОН текстэд байгаа
 * БҮХ тэмдэгт ямар нэг font chunk-ийн unicode-range-д байгаа юу?
 * (Аль нэг тэмдэгт хүрээнээс гадуур байвал тухайн үсэг tofu (▯) болно.)
 *
 *   node scripts/check-font-coverage.mjs
 *
 * Алдаа гарвал exit 1 → CI/чанарын хаалга зогсооно.
 */
import fs from "node:fs";
import path from "node:path";

const CSS = "src/fonts.css";
const DATA = "public/data";

if (!fs.existsSync(CSS)) {
  console.error(`❌ ${CSS} байхгүй — эхлээд \`npm run fonts:build\` ажиллуулна уу.`);
  process.exit(1);
}

/* ── 1. fonts.css-ээс face бүрийн unicode-range уншина ── */
const css = fs.readFileSync(CSS, "utf8");
const faces = [];
for (const block of css.split("@font-face").slice(1)) {
  const family = /font-family:\s*"([^"]+)"/.exec(block)?.[1];
  const url = /url\("([^"]+)"\)/.exec(block)?.[1];
  const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
  if (!family || !url) continue;
  const spans = [];
  if (range) {
    for (const part of range.split(",")) {
      const m = /U\+([0-9a-fA-F]+)(?:-([0-9a-fA-F]+))?/.exec(part.trim());
      if (!m) continue;
      const a = parseInt(m[1], 16);
      const b = m[2] ? parseInt(m[2], 16) : a;
      spans.push([a, b]);
    }
  }
  faces.push({ family, file: path.basename(url), spans, len: spans.length });
}

const JP_FAMILIES = ["Noto Sans JP", "Noto Serif JP"];
for (const f of JP_FAMILIES) {
  if (!faces.some((x) => x.family === f)) {
    console.error(`❌ ${f} @font-face олдсонгүй — fonts.css дутуу байна.`);
    process.exit(1);
  }
}

const covers = (family, cp) =>
  faces.some((f) => f.family === family && f.spans.some(([a, b]) => cp >= a && cp <= b));

/* ── 3. хэсгүүд нийлэлдэхгүй (disjoint) эсэх ──
 * Нэг тэмдэгт хоёр range-д байвал Chrome уг тэмдэгтэд таарах БҮХ face-ийг
 * татдаг — нэг хуудас 12 файл (2+ MB) татдаг байсан. */
const overlap = [];
for (const family of JP_FAMILIES) {
  const mine = faces.filter((f) => f.family === family);
  for (let i = 0; i < mine.length; i++) {
    for (let j = i + 1; j < mine.length; j++) {
      for (const [a1, b1] of mine[i].spans) {
        for (const [a2, b2] of mine[j].spans) {
          const lo = Math.max(a1, a2);
          const hi = Math.min(b1, b2);
          if (lo <= hi) overlap.push(`${family}: ${mine[i].file} ∩ ${mine[j].file} @ U+${lo.toString(16).toUpperCase()}`);
        }
      }
    }
  }
}

/* ── 4. шалгах ёстой тэмдэгтүүд ── */
function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

const required = new Set(); // бүх тэмдэгт (Noto Sans JP — UI-ийн бүх текст)
const japanese = new Set(); // зөвхөн ЯПОН тэмдэгт (Noto Serif JP — mincho гарчиг)

const isJapanese = (ch) => {
  const cp = ch.codePointAt(0);
  return (cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef);
};

for (const f of walk(DATA, /\.json$/)) {
  for (const ch of fs.readFileSync(f, "utf8")) {
    required.add(ch);
    if (isJapanese(ch)) japanese.add(ch);
  }
}
for (const f of walk("src", /\.tsx?$/)) {
  for (const ch of fs.readFileSync(f, "utf8")) {
    if (isJapanese(ch)) {
      required.add(ch);
      japanese.add(ch);
    }
  }
}

/* ── 5. шалгалт ── */
const missingSans = [...required].filter((ch) => !covers("Noto Sans JP", ch.codePointAt(0)));
const missingSerif = [...japanese].filter((ch) => !covers("Noto Serif JP", ch.codePointAt(0)));

const show = (arr) => arr.slice(0, 40).map((c) => `${c}(U+${c.codePointAt(0).toString(16).toUpperCase()})`).join(" ");

console.log(`шалгасан: ${required.size} тэмдэгт (бүгд) · ${japanese.size} япон тэмдэгт`);
for (const f of faces) console.log(`  ${f.family.padEnd(16)} ${f.file.padEnd(34)} ${f.len} диапазон`);

let bad = false;
if (overlap.length) {
  bad = true;
  console.error(`\n❌ Нийлэлдэж буй unicode-range (${overlap.length}):`);
  for (const o of overlap.slice(0, 10)) console.error(`   ${o}`);
}
if (missingSans.length) {
  bad = true;
  console.error(`\n❌ Noto Sans JP-д дутуу тэмдэгт (${missingSans.length}): ${show(missingSans)}`);
}
if (missingSerif.length) {
  bad = true;
  console.error(`\n❌ Noto Serif JP-д дутуу япон тэмдэгт (${missingSerif.length}): ${show(missingSerif)}`);
}
if (bad) process.exit(1);

console.log(`\n✅ Бүх тэмдэгт ямар нэг chunk-ийн unicode-range-д байна (tofu эрсдэлгүй).`);
