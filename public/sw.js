// Nihongo Dōjō service worker — offline app shell + study corpus.
// Hard policy: NEVER cache /api/* (auth, Gemini tutor calls, user transcripts),
// never cache request bodies, never cache non-GET. Vocab/kanji/grammar JSON is
// cached for offline study; it is public learning content, not private data.
// Update strategy: versioned caches; new SW waits, UI shows "update ready"
// banner, user confirms -> SKIP_WAITING -> controllerchange -> reload.

const VERSION = "nd-sw-v1";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const FONTS = `${VERSION}-fonts`;

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // Precache individually: a single miss must not fail the install.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => ![SHELL, DATA, FONTS].includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "WARM_DATA") {
    event.waitUntil(warmData());
  }
});

// Public study corpus (never /api).
const DATA_RE = /^\/data\/.*\.json$/;

async function warmData() {
  const cache = await caches.open(DATA);
  for (const level of ["n5", "n4", "n3", "n2", "n1"]) {
    for (const kind of ["vocab", "kanji", "grammar"]) {
      const url = `/data/${kind}/${level}.json`;
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(url, res.clone());
      } catch {
        /* offline warm-up is best-effort */
      }
    }
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // NEVER cache API traffic (accounts, Gemini tutor, transcripts, secrets).
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Navigations: network-first with SPA shell fallback (offline route launch).
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(SHELL);
          cache.put("/index.html", res.clone());
          return res;
        } catch {
          const cache = await caches.open(SHELL);
          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    // Google Fonts stylesheets + font files: cache-first, long-lived.
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
      event.respondWith(cacheFirst(request, FONTS));
    }
    return;
  }

  // Vite hashed assets are immutable -> cache-first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }

  // Study corpus -> stale-while-revalidate (useful offline, still fresh online).
  if (DATA_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }

  // Icons/manifest/other same-origin static -> SWR on shell cache.
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});
