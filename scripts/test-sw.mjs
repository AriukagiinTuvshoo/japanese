/**
 * B7 — Service worker-ийн шинэчилсэн мөрийн шалгалт (нэг удаа ажиллуулна).
 * --------------------------------------------------------------------------
 *  1. install дээр зөвхөн **критик** asset-ууд кэшилдэг (бүх JP font биш),
 *  2. activate дээр ХУУЧИН build-ийн `nd-*` кэшүүд заавал устгагдана,
 *  3. үлдсэн (`warm`) chunk-ууд activate-ийн ДАРАА тайван кэшилдэг.
 *
 * sw.js-г жинхэнэ vm дээр mock CacheStorage/fetch-тэй ажиллуулна —
 * тест дотор бодит сүлжээ/хөтөч шаардлагагүй.
 *
 *   node scripts/test-sw.mjs   (npm run test:sw)
 */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const code = fs.readFileSync("public/sw.js", "utf8");

const DEFAULT_PRECACHE = {
  assets: ["/a.js"],
  critical: ["/a.js", "/core.woff2"],
  warm: ["/n1.woff2", "/n2.woff2"],
};

function makeWorld({ oldCaches = [], precache = DEFAULT_PRECACHE, connection } = {}) {
  const store = new Map();
  for (const name of oldCaches) store.set(name, new Map());
  const fetched = [];

  const makeCache = (name) => ({
    async put(url, res) {
      const m = store.get(name) ?? new Map();
      m.set(String(url), res);
      store.set(name, m);
    },
    async match(url) {
      return (store.get(name) ?? new Map()).get(String(url)) ?? undefined;
    },
  });

  const caches = {
    async keys() {
      return [...store.keys()];
    },
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      return makeCache(name);
    },
    async delete(name) {
      return store.delete(name);
    },
    async match(url) {
      for (const m of store.values()) {
        const hit = m.get(String(url));
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const listeners = {};
  const self = {
    location: new URL("https://example.test/sw.js"),
    clients: { claim: async () => {} },
    skipWaiting: () => {},
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };

  const fetchMock = async (url) => {
    const u = String(url);
    fetched.push(u);
    if (u.includes("precache.json")) {
      return { ok: true, json: async () => precache };
    }
    if (u.includes("index/") || u.endsWith(".json")) {
      return { ok: true, json: async () => ({}) };
    }
    return { ok: true, clone: () => ({ ok: true }), text: async () => "<html></html>" };
  };

  const ctx = vm.createContext({
    self,
    caches,
    fetch: fetchMock,
    console,
    URL,
    Promise,
    Map,
    Set,
    // 15 с-ийн хүлээлтийг устгаж, арын халалтыг шууд ажиллуулна.
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
    navigator: { connection },
  });
  vm.runInContext(code, ctx);

  return { listeners, store, fetched };
}

async function fire(world, type) {
  let pending = Promise.resolve();
  world.listeners[type]({ waitUntil: (p) => (pending = Promise.resolve(p)) });
  await pending;
}

/** SW рүү `ND_WARM` мессеж илгээнэ (main.tsx хийдэгээр). */
async function fireWarm(world, connection) {
  let pending = Promise.resolve();
  world.listeners.message({
    data: { type: "ND_WARM" },
    waitUntil: (p) => (pending = Promise.resolve(p)),
  });
  await pending;
  return connection;
}

/* ── 1. install: зөвхөн критик ── */
{
  const w = makeWorld({ oldCaches: ["nd-shell-OLDVERSION", "nd-data-OLDVERSION"] });
  await fire(w, "install");
  const shellName = [...w.store.keys()].find((k) => k.startsWith("nd-shell-") && !k.includes("OLDVERSION"));
  const shell = w.store.get(shellName) ?? new Map();
  assert(shell.has("https://example.test/a.js"), "критик JS кэшилээгүй");
  assert(shell.has("https://example.test/core.woff2"), "критик (JP core) фонт кэшилээгүй");
  assert(![...shell.keys()].some((k) => k.includes("n1.woff2")), "install-д хэрэггүй font chunk орж болохгүй");
  console.log("✅ install: зөвхөн критик asset (js + core font), бүх chunk биш");
}

/* ── 2. activate: хуучин кэш устгах (warm ЭЭР install-д БАГТДАГГҮЙ) ── */
{
  const w = makeWorld({ oldCaches: ["nd-shell-OLDVERSION", "nd-data-OLDVERSION", "nd-other-keepme"] });
  await fire(w, "install");
  await fire(w, "activate");

  const keys = [...w.store.keys()];
  assert(!keys.includes("nd-shell-OLDVERSION"), "хуучин shell кэш үлдлээ");
  assert(!keys.includes("nd-data-OLDVERSION"), "хуучин data кэш үлдлээ");
  const current = keys.filter((k) => k.startsWith("nd-shell-") || k.startsWith("nd-data-"));
  assert(current.length >= 2, "одоогийн кэшүүд устсан");

  const shellName = keys.find((k) => k.startsWith("nd-shell-") && !k.includes("OLDVERSION"));
  const shell = w.store.get(shellName) ?? new Map();
  assert(shell.has("https://example.test/core.woff2"), "критик фонт алга");
  assert(![...shell.keys()].some((k) => k.includes("n1.woff2")), "install/activate-д хэрэггүй font chunk орсон");
  console.log("✅ activate: хуучин build-ийн кэшүүд устгагдаж, warm chunk install-д ороогүй");
}

/* ── 3. `ND_WARM` мессеж → үлдсэн chunk-ууд SW кэшинэ ── */
{
  const w = makeWorld({ oldCaches: [] });
  await fire(w, "install");
  await fire(w, "activate");
  await fireWarm(w);
  const shellName = [...w.store.keys()].find((k) => k.startsWith("nd-shell-"));
  const shell = w.store.get(shellName) ?? new Map();
  assert(shell.has("https://example.test/n1.woff2"), "warm chunk кэшилээгүй");
  assert(shell.has("https://example.test/n2.woff2"), "warm chunk кэшилээгүй");
  console.log("✅ ND_WARM: main.tsx-ийн мессежээр бүх үлдсэн font chunk кэшилдэг");
}

/* ── 4. save-data / 2G үед арын таталтгүй ── */
{
  const w = makeWorld({ oldCaches: [], connection: { saveData: true, effectiveType: "4g" } });
  await fire(w, "install");
  await fire(w, "activate");
  await fireWarm(w);
  const shellName = [...w.store.keys()].find((k) => k.startsWith("nd-shell-"));
  const shell = w.store.get(shellName) ?? new Map();
  assert(![...shell.keys()].some((k) => k.includes("n1.woff2")), "save-data байхад warm татагдлаа");
  console.log("✅ warm: save-data/2G үед 1.7 MB татдаггүй");
}

/* ── 5. main.tsx warm-ийг хуудас амьд байхад л дууддаг ── */
{
  const src = fs.readFileSync("src/main.tsx", "utf8");
  assert(/ND_WARM/.test(src), "main.tsx ND_WARM илгээхгүй байна");
  assert(/60_000/.test(src), "warm эхний сессийн 60 с-аас өмнө дуудагдана");
  const sw = fs.readFileSync("public/sw.js", "utf8");
  assert(!/setTimeout\(r, \d+\)/.test(sw), "SW дотор удаан таймер үлдэж байна (SW уствал warm алдана)");
  console.log("✅ main.tsx: 60 с-ын дараа ND_WARM, SW дотор timerгүй");
}

console.log("\n✅ SW шалгалт амжилттай (B7).");