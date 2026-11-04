/**
 * Ижил эх сурвалжийн (same-origin) шалгалт.
 * ------------------------------------------------------------------
 * CSRF-ээс хамгаалах зорилготой: хөтчөөс ирсэн `Origin` нь хүсэлтийн
 * host-той таарах ёстой. Порт өөр байж болно — Vite dev proxy нь Host-ыг
 * API серверийн порт руу сольдог (`changeOrigin`), production-д порт
 * хэзээ ч өөр байхгүй тул хамгаалалт сулрахгүй.
 */

/** `Origin` байхгүй (curl, SSR) бол зөвшөөрнө; буруу хэлбэр бол хориглоно. */
export function sameOrigin(origin: string, host: string, forwardedHost = ""): boolean {
  if (!origin) return true;
  const allowHost = host || forwardedHost;
  if (!allowHost) return false;
  try {
    const o = new URL(origin);
    if (o.protocol !== "http:" && o.protocol !== "https:") return false;
    const hostName = allowHost.split(":")[0].toLowerCase();
    return o.hostname.toLowerCase() === hostName;
  } catch {
    return false;
  }
}
