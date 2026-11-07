#!/usr/bin/env node
/**
 * Машин тусламжтай (EN→MN) орчуулга — ДРАФТ, хүн хянаагүй.
 *
 * Энэ скрипт зөвхөн `content/mn/machine/<task>.json` үүсгэнэ.
 * Түүнийг нь `scripts/apply-machine-mn.mjs` public/data-д `mq: "auto"`
 * (“Авто санал”) төлөвтэйгээр тавина. **`curated` болгодоггүй.**
 * Эх өгөгдөл (уншлага, түвшин, бичээс) өөрчлөгдөхгүй — зөвхөн EN→MN утга нэмэгдэнэ.
 *
 * Ашиглах:
 *   node scripts/machine-translate.mjs <vocab|kanji|grammar|vex|gex> [level]
 *     vocab   → үгийн сангийн түвшин бүрийн үгийн утга  (индексээр)
 *     kanji   → ханзны монгол утга                        (индексээр)
 *     grammar → дүрмийн монгол тайлбар                   (id-гаар)
 *     vex     → үгийн жишээ өгүүлбэрийн орчуулга         (ja-гаар)
 *     gex     → дүрмийн жишээ өгүүлбэрийн орчуулга       (ja-гаар)
 *
 * Түүх: үргэлжлүүлж болно — аль хэдийн орчуулсан түлхүүрийг дахин хүрэхгүй.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data");
const OUT = path.join(ROOT, "content/mn/machine");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const DELIM = "\n␟\n"; // U+241F — орчуулгад орохгүй тусгай тэмдэгт

const task = process.argv[2];
const onlyLevel = process.argv[3]?.toLowerCase();
if (!["vocab", "kanji", "grammar", "vex", "gex"].includes(task ?? "")) {
  console.error("Ашиглах: node scripts/machine-translate.mjs <vocab|kanji|grammar|vex|gex> [level]");
  process.exit(1);
}

const readJson = async (p, fb) => {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fb;
  }
};

/* ------------------------------------------------------------------ */
/* эх бичлэгүүдийг цуглуулах                                           */
/* ------------------------------------------------------------------ */
/** [{ key, src }] — key = хадгалах түлхүүр, src = орчуулах EN текст */
async function collectSources() {
  const items = [];
  const levels = onlyLevel ? [onlyLevel] : LEVELS;

  if (task === "vocab" || task === "vex") {
    for (const lv of levels) {
      const list = await readJson(path.join(DATA, "vocab", `${lv}.json`), []);
      list.forEach((v, i) => {
        if (task === "vocab") {
          if (v.mq === "none" || !v.mn) {
            const src = (v.en ?? []).filter(Boolean).join("; ");
            if (src) items.push({ key: `${lv}:${i}`, src });
          }
        } else {
          for (const e of v.ex ?? []) {
            if (!e.mn && e.en && e.ja) items.push({ key: e.ja, src: e.en });
          }
        }
      });
    }
  }

  if (task === "kanji") {
    for (const lv of levels) {
      const list = await readJson(path.join(DATA, "kanji", `${lv}.json`), []);
      list.forEach((k, i) => {
        if (k.mq === "none" || !k.mn) {
          const src = (k.en ?? []).filter(Boolean).join("; ");
          if (src) items.push({ key: `${lv}:${i}`, src });
        }
      });
    }
  }

  if (task === "grammar" || task === "gex") {
    for (const lv of levels) {
      const list = await readJson(path.join(DATA, "grammar", `${lv}.json`), []);
      for (const g of list) {
        if (task === "grammar") {
          if (!g.mn) {
            const src = Array.isArray(g.en) ? g.en.filter(Boolean).join("; ") : (g.en ?? "");
            if (src) items.push({ key: g.id, src });
          }
        } else {
          for (const e of g.ex ?? []) {
            if (!e.mn && e.en && e.ja) items.push({ key: e.ja, src: e.en });
          }
        }
      }
    }
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* орчуулга                                                            */
/* ------------------------------------------------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(texts) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mn&dt=t&q=" +
    encodeURIComponent(texts.join(DELIM));
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const out = (json[0] ?? []).map((s) => s[0] ?? "").join("");
  return out.split(DELIM);
}

/** Бүх багийг тэнцүүлэн баталгаажуулна: тоо нь таарахгүй бол нэг нэгээр нь. */
async function translateAll(texts, onProgress) {
  const results = new Array(texts.length).fill(null);
  const batches = [];
  let cur = [], curLen = 0;
  for (let i = 0; i < texts.length; i++) {
    const add = texts[i].length + DELIM.length;
    if (cur.length && (cur.length >= 40 || curLen + add > 3500)) {
      batches.push(cur); cur = []; curLen = 0;
    }
    cur.push(i); curLen += add;
  }
  if (cur.length) batches.push(cur);

  let done = 0;
  const WORKERS = 4;
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      const textsIn = batch.map((i) => texts[i]);
      try {
        const parts = await translateBatch(textsIn);
        if (parts.length === batch.length) {
          batch.forEach((idx, j) => (results[idx] = parts[j].trim()));
        } else {
          // багийн тоо зөрвөл нэг нэгээр
          for (const idx of batch) {
            const [one] = await translateBatch([texts[idx]]);
            results[idx] = (one ?? "").trim();
            await sleep(60);
          }
        }
      } catch (err) {
        for (const idx of batch) {
          try {
            const [one] = await translateBatch([texts[idx]]);
            results[idx] = (one ?? "").trim();
          } catch {
            results[idx] = null;
          }
          await sleep(80);
        }
      }
      done += batch.length;
      onProgress?.(done, texts.length);
      await sleep(120);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  return results;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
const file = path.join(OUT, `${task}.json`);
const store = await readJson(file, {});
const items = await collectSources();

// аль хэдийн орчуулсныг алгасна
const todo = items.filter((it) => {
  if (task === "vocab" || task === "kanji") {
    const [lv, i] = it.key.split(":");
    return store[lv]?.[i] === undefined;
  }
  return store[it.key] === undefined;
});

console.log(`[${task}] нийт ${items.length}, хийхдээ ${todo.length} (өмнө хийсэн ${items.length - todo.length})`);
if (!todo.length) {
  console.log("Шинэ зүйл алга — дууссан.");
  process.exit(0);
}

const texts = todo.map((t) => t.src);
const out = await translateAll(texts, (done, total) => {
  if (done % 400 < 40) process.stdout.write(`  ${done}/${total}\r`);
});

let ok = 0, fail = 0;
todo.forEach((it, j) => {
  const val = out[j];
  if (!val) { fail++; return; }
  ok++;
  if (task === "vocab" || task === "kanji") {
    const [lv, i] = it.key.split(":");
    (store[lv] ??= {})[i] = val;
  } else {
    store[it.key] = val;
  }
});

await mkdir(OUT, { recursive: true });
await writeFile(file, JSON.stringify(store, null, 1), "utf8");
console.log(`[${task}] амжилттай ${ok}, амжилтгүй ${fail} → ${path.relative(ROOT, file)}`);
if (fail) process.exitCode = 2;
