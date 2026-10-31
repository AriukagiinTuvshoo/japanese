#!/usr/bin/env node
/**
 * Эх өгөгдлийг татах.
 * ------------------------------------------------------------------
 * Nihongo Dōjō нь контентоо өөрөө зохиодоггүй — бүх мэдээлэл нь
 * лицензтэй, эх сурвалжтай (provenance) нээлттэй сангуудаас импортлогддог.
 *
 *   OpenJLPT          JLPT N5–N1 үг / ханз / дүрэм + жишээ өгүүлбэр
 *   kanji-data        Ханзны бүрэн шинж чанар (Jōyō, зурлага, давтамж)
 *   KanjiVG           Ханз бичих дарааллын вектор зураг
 *   JMdict (jamdict)  Япон–Англи толь (өргөтгөсөн үгийн сан)
 *
 * Монгол хэлний давхарга (content/mn-*.json) нь энэ скриптоос хамааралгүй,
 * гараар хянагдсан контент юм.
 *
 * Ажиллуулах:  npm run data:fetch
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".cache", "sources");
const LOG = path.join(CACHE, "sources.lock.json");

/** Татах зүйлсийн бүртгэл. `sha` хоосон бол эхний таталтад бөглөгдөнө. */
const SOURCES = [
  {
    id: "openjlpt",
    name: "OpenJLPT",
    url: "https://codeload.github.com/evanclan/OpenJLPT/tar.gz/refs/heads/main",
    archive: "openjlpt.tar.gz",
    dir: "openjlpt",
    license: "CC-BY-SA-4.0",
    homepage: "https://github.com/evanclan/OpenJLPT",
    note: "JLPT N5–N1 үгийн сан, ханз, дүрэм. Дотоод эх: tanos.co.uk (CC BY), JMdict, KANJIDIC2, Tatoeba (CC BY 2.0 FR).",
  },
  {
    id: "kanji-data",
    name: "kanji-data",
    url: "https://codeload.github.com/davidluzgouveia/kanji-data/tar.gz/refs/heads/master",
    archive: "kanji-data.tar.gz",
    dir: "kanji-data",
    license: "MIT",
    homepage: "https://github.com/davidluzgouveia/kanji-data",
    note: "13,108 ханзны зурлага, зэрэг, давтамж, он/кун уншлага, JLPT түвшин.",
  },
  {
    id: "kanjivg",
    name: "KanjiVG",
    url: "https://codeload.github.com/KanjiVG/kanjivg/tar.gz/refs/heads/master",
    archive: "kanjivg.tar.gz",
    dir: "kanjivg",
    license: "CC-BY-SA-3.0",
    homepage: "https://kanjivg.tagaini.net/",
    note: "Ханз бүрийн зурлагын вектор зам — бичих дараалал ба чиглэлийн мэдээлэл.",
  },
  {
    id: "jmdict",
    name: "JMdict (jamdict-data)",
    url: "https://files.pythonhosted.org/packages/source/j/jamdict-data/jamdict_data-1.5.tar.gz",
    archive: "jamdict-data.tar.gz",
    dir: "jamdict-data",
    license: "MIT (багц) / CC-BY-SA-4.0 (JMdict өгөгдөл)",
    homepage: "https://www.edrdg.org/jmdict/j_jmdict.html",
    note: "Япон–Англи толь. JLPT-д хамрагдаагүй ч өндөр давтамжтай үгсийг «өргөтгөсөн сан» болгон авахад ашиглана.",
    extra: async (dir) => {
      // .xz-ээс SQLite рүү задална (нэг удаа).
      const db = path.join(dir, "jamdict.db");
      if (!(await exists(db))) {
        const xz = await findFile(dir, "jamdict.db.xz");
        if (!xz) throw new Error("jamdict.db.xz олдсонгүй");
        console.log("      jamdict.db.xz → jamdict.db задалж байна…");
        const { stdout } = await run("python3", [
          "-c",
          `import lzma,shutil\nwith lzma.open(${JSON.stringify(xz)}) as f, open(${JSON.stringify(db)},'wb') as o:\n    shutil.copyfileobj(f,o,1<<20)\n`,
        ]);
        if (stdout) process.stdout.write(stdout);
      }
      // db-аас хамааралтай гаралтууд — build-data.mjs (кандидат үгс,
      // KANJIDIC2 классик зурлага) эдгээргүйгээр дутуу JSON үүсгэнэ.
      await exportIfStale(dir, "candidates.json", "jmdict_export.py");
      await exportIfStale(dir, "kanji-radicals.json", "kanjidic_export.py");
    },
  },
];

const exists = async (p) => !!(await stat(p).catch(() => null));

/**
 * jamdict.db-аас хамааралтай гаралтыг (candidates.json, kanji-radicals.json)
 * шаардлагатай бол дахин үүсгэнэ. Үгүй бол build мэдээлэлгүй JSON-аас
 * уншиж, хоосон мөрүүдийг «шүүхгүй» буюу дутуу үр дүн гаргана.
 */
async function exportIfStale(dir, out, script) {
  const db = path.join(dir, "jamdict.db");
  const outPath = path.join(dir, out);
  const [o, d] = await Promise.all([stat(outPath).catch(() => null), stat(db).catch(() => null)]);
  if (o && d && o.mtimeMs >= d.mtimeMs) {
    console.log(`      ${out} — бэлэн`);
    return;
  }
  console.log(`      ${out} үүсгэж байна (${script})…`);
  const { stdout } = await run("python3", [path.join(ROOT, "scripts/lib", script)], { cwd: ROOT });
  if (stdout) process.stdout.write(stdout);
}

/** Пакетийн дотоод хуваарилалт өөрчлөгддөг тул файлыг өөрөө хайна. */
async function findFile(dir, name, depth = 4) {
  if (depth < 0) return null;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === name) return p;
    if (e.isDirectory()) {
      const hit = await findFile(p, name, depth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

async function sha256(file) {
  const { createReadStream } = await import("node:fs");
  const h = createHash("sha256");
  await pipeline(createReadStream(file), h);
  return h.digest("hex");
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  if (!res.body) throw new Error(`${url} → хоосон хариу`);
  const tmp = `${dest}.part`;
  await pipeline(res.body, createWriteStream(tmp));
  await rename(tmp, dest);
}

/** tar.gz-г задлаад нэг дээд хавтсыг товчилно. */
async function extract(archive, dir) {
  const staging = `${dir}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  // Замуудыг ROOT-тай харьцатай, POSIX хэлбэрээр өгнө: Windows дээр
  // "C:\..." замыг GNU tar «host:path» гэж уншиж, `--force-local` нь бүх
  // хувилбарт байдаггүй. Хоосон двоеточтой relative зам аюулгүй.
  const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/") || ".";
  await run("tar", ["xzf", rel(archive), "-C", rel(staging)], { cwd: ROOT });
  const entries = await readdir(staging);
  const top = path.join(staging, entries[0]);
  await rm(dir, { recursive: true, force: true });
  await rename(top, dir);
  await rm(staging, { recursive: true, force: true });
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const lock = /** @type {Record<string, any>} */ (
    (await readFile(LOG, "utf8").then(JSON.parse).catch(() => ({})))
  );
  const force = process.argv.includes("--force");

  for (const s of SOURCES) {
    const dir = path.join(CACHE, s.dir);
    const archive = path.join(CACHE, s.archive);
    const ready = (await exists(dir)) && (await exists(path.join(dir, ".ok")));

    if (ready && !force) {
      console.log(`✓ ${s.name} — кэшэд бэлэн`);
    } else {
      console.log(`↓ ${s.name} татаж байна…`);
      if (!(await exists(archive)) || force) await download(s.url, archive);
      const sha = await sha256(archive);
      console.log(`  sha256 ${sha.slice(0, 16)}… (${((await stat(archive)).size / 1e6).toFixed(1)} MB)`);
      await extract(archive, dir);
      await writeFile(path.join(dir, ".ok"), sha);
      lock[s.id] = { ...s, extra: undefined, sha256: sha, retrievedAt: new Date().toISOString() };
    }

    if (typeof s.extra === "function") await s.extra(dir);

    const stamp = (await readFile(path.join(dir, ".ok"), "utf8").catch(() => lock[s.id]?.sha256 ?? ""));
    lock[s.id] = {
      id: s.id,
      name: s.name,
      url: s.url,
      license: s.license,
      homepage: s.homepage,
      note: s.note,
      sha256: stamp,
      retrievedAt: lock[s.id]?.retrievedAt ?? new Date().toISOString(),
    };
  }

  await writeFile(LOG, JSON.stringify(lock, null, 2));
  console.log(`\nЭх сурвалж бүртгэл: .cache/sources/sources.lock.json`);
}

main().catch((e) => {
  console.error("✗ Татахад алдаа:", e.message);
  process.exit(1);
});
