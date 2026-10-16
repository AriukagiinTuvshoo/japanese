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
 * тусдаа хадгалагдсан контент юм; шинэ AI орчуулгууд хараат бус хяналтад ороогүй.
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
    license: "MIT (багц) / CC-BY-SA-3.0 (jamdict-data 1.5 дахь толь)",
    homepage: "https://www.edrdg.org/jmdict/j_jmdict.html",
    note: "Япон–Англи толь. JLPT-д хамрагдаагүй ч өндөр давтамжтай үгсийг «өргөтгөсөн сан» болгон авахад ашиглана.",
    extra: async (dir) => {
      // .xz-ээс SQLite рүү задална (нэг удаа).
      const db = path.join(dir, "jamdict.db");
      const xz = path.join(dir, "jamdict_data-1.5", "jamdict_data", "jamdict.db.xz");
      if (await exists(db)) return;
      if (!(await exists(xz))) throw new Error("jamdict.db.xz олдсонгүй");
      console.log("      jamdict.db.xz → jamdict.db задалж байна…");
      const { stdout } = await run("python3", [
        "-c",
        `import lzma,shutil\nwith lzma.open(${JSON.stringify(xz)}) as f, open(${JSON.stringify(db)},'wb') as o:\n    shutil.copyfileobj(f,o,1<<20)\n`,
      ]);
      if (stdout) process.stdout.write(stdout);
    },
  },
];

const exists = async (p) => !!(await stat(p).catch(() => null));

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
  await run("tar", ["xzf", archive, "-C", staging]);
  const entries = await readdir(staging);
  const top = path.join(staging, entries[0]);
  await rm(dir, { recursive: true, force: true });
  await rename(top, dir);
  await rm(staging, { recursive: true, force: true });
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const lock = (await readFile(LOG, "utf8").then(JSON.parse).catch(() => ({}))) as Record<string, unknown>;
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
      retrievedAt: (lock[s.id] as { retrievedAt?: string })?.retrievedAt ?? new Date().toISOString(),
    };
  }

  await writeFile(LOG, JSON.stringify(lock, null, 2));
  console.log(`\nЭх сурвалж бүртгэл: .cache/sources/sources.lock.json`);
}

main().catch((e) => {
  console.error("✗ Татахад алдаа:", e.message);
  process.exit(1);
});
