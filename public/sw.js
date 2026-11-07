/* Nihongo Dōjō service worker: офлайн-first.
   - /data/** JSON: cache-first (10MB контент нэг л удаа татагдана)
   - бусад GET: stale-while-revalidate
   - навигаци: сүлжээ байхгүй үед кэшлэгдсэн index.html
   - /api/**: кэшлэхгүй (апп өөрөө офлайн синк хийдэг) */
const VERSION = "v1";
const SHELL = `nd-shell-${VERSION}`;
const DATA = `nd-data-${VERSION}`;
const BASE = new URL("./", self.location).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, `${BASE}manifest.webmanifest`])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${BASE}api/`)) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(BASE)));
    return;
  }

  if (url.pathname.startsWith(`${BASE}data/`)) {
    e.respondWith(
      caches.open(DATA).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  e.respondWith(
    caches.open(SHELL).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
