/* Nihongo Dōjō service worker — офлайн-first.
   ------------------------------------------------------------------
   · `VERSION` нь build бүрт `vite.config.ts`-ээр солигдоно (asset hash),
     тиймээс шинэ deploy хуучин кэшийг заавал цэвэрлэнэ.
   · install: app shell + N5 контент (vocab/kanji/grammar/strokes/index) +
     build-ийн JS/CSS/фонтыг урьдчилан кэшилнэ → эхний ачааллын дараа
     интернэтгүй ч бүрэн ажиллана.
   · Бусад түвшний JSON: cache-first (нэг л удаа татна).
   · /api/**: кэшлэхгүй (апп өөрөө офлайн синк хийдэг). */

const VERSION = "__BUILD__";
const SHELL = `nd-shell-${VERSION}`;
const DATA = `nd-data-${VERSION}`;
const BASE = new URL("./", self.location).pathname;

const STATIC = [
  BASE,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/apple-touch-icon.png`,
];

/* N5 нь эхлэгчдэд хамгийн чухал — суулгах үед бүрэн татагдана.
   N4–N1 нь ашиглах үедээ кэшлэгдэнэ. */
const FIRST_LEVEL = [
  "data/index/meta.json",
  "data/index/search.json",
  "data/vocab/n5.json",
  "data/kanji/n5.json",
  "data/grammar/n5.json",
  "data/strokes/n5.json",
].map((p) => BASE + p);

/** Нэг ч холбоос унавал бүх суулгалтыг унагахгүй — аль болохыг нь кэшилнэ. */
async function addAllSafe(cache, urls) {
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { cache: "reload" });
        if (res.ok) await cache.put(u, res);
      } catch {
        /* сүлжээгүй / 404 — дараагийн ачаалалтад дахин оролдоно */
      }
    }),
  );
}

/** index.html ба CSS-ээс build-ийн asset (js/css/woff2) хаягуудыг олно. */
async function discoverAssets() {
  // Build үед vite.config.ts `dist/precache.json` бичдэг — бүх JS/CSS/фонт,
  // lazy route chunk-уудыг оролцуулан.
  try {
    const res = await fetch(`${BASE}precache.json`, { cache: "reload" });
    if (res.ok) {
      const body = await res.json();
      if (Array.isArray(body?.assets) && body.assets.length) {
        return body.assets.map((u) => new URL(u, self.location.href).href);
      }
    }
  } catch {
    /* уналт — доорх fallback */
  }

  const urls = new Set();
  try {
    const html = await fetch(BASE, { cache: "reload" }).then((r) => r.text());
    for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|woff2))"/g)) {
      urls.add(new URL(m[1], self.location.href).href);
    }
  } catch {
    return [];
  }
  const cssUrls = [...urls].filter((u) => u.endsWith(".css"));
  for (const css of cssUrls) {
    try {
      const text = await fetch(css, { cache: "reload" }).then((r) => r.text());
      for (const m of text.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)) {
        urls.add(new URL(m[1], css).href);
      }
    } catch {
      /* css уншиж чадсангүй */
    }
  }
  return [...urls];
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const [shell, data] = await Promise.all([caches.open(SHELL), caches.open(DATA)]);
      await addAllSafe(shell, [...STATIC, ...(await discoverAssets())]);
      await addAllSafe(data, FIRST_LEVEL);
      // Хэрэглэгч "Шинэчлэх" дарж байж идэвхждэг (main.tsx-ээс зурвас ирнэ).
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("nd-") && k !== SHELL && k !== DATA)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (path.startsWith(`${BASE}api/`)) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(BASE, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(BASE)) ?? (await caches.match(req)) ?? Response.error()),
    );
    return;
  }

  const isData = path.startsWith(`${BASE}data/`);
  e.respondWith(
    caches.open(isData ? DATA : SHELL).then(async (c) => {
      const hit = await c.match(req);
      // Кэшэд байвал сүлжээнд хүрэхгүй (data: cache-first, бусад: SWR).
      // Модуль скриптийн хүсэлтийг давхар `fetch(req)`-ээр дахин нээх нь
      // Chrome дээр ERR_FAILED өгдөг тул зөвхөн miss үед татна.
      if (hit) {
        if (!isData) {
          fetch(req)
            .then((res) => { if (res.ok) return c.put(req, res.clone()); })
            .catch(() => {});
        }
        return hit;
      }
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone()).catch(() => {});
        return res;
      } catch {
        return Response.error();
      }
    }),
  );
});
