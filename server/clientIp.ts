/**
 * КЛИЕНТИЙН IP — proxy-д итгэх дүрэм
 * ------------------------------------------------------------------
 * `X-Forwarded-For`-ыг хэрэглэгч өөрөө зохиож болно — шууд итгэвэл
 * rate limit-ыг хүсэлт бүрд шинэ «IP» зохиож тойрч болно (Phase 14-д
 * бодитоор батлагдсан). Тиймээс:
 *
 * · `TRUSTED_PROXY_HOPS=0` (анхдагч) — XFF болон `X-Real-IP`-д ОГТ
 *   итгэхгүй, зөвхөн TCP socket-ийн хаягийг ашиглана. Локал dev болон
 *   proxy-гүй шууд Node серверт зөв.
 * · `TRUSTED_PROXY_HOPS=N` — шууд урд байгаа N proxy-г найдвартай гэж
 *   үзнэ. XFF-ийн баруун (хамгийн сүүлд нэмэгдсэн) талаас N дэх утга
 *   нь клиентийн IP; зүүн талын утгууд нь клиент өөрөө бичсэн байж
 *   болох тул ашиглагдахгүй.
 *
 * Vercel-ийн Node runtime нь edge proxy-гоор дамждаг; нэг proxy давхарга
 * үед `TRUSTED_PROXY_HOPS=1`. Платформын дотоод гинжийг таамгаар
 * тохируулахгүй — бодит deployment-ийн дараа лог/header-ээр баталж
 * тохируулна. Хэт том утга өгвөл клиент олдохгүй бөгөөд аюулгүй
 * fallback (socket хаяг) ажиллана.
 */

import { isIP } from "node:net";

export interface ClientIpInput {
  /** `x-forwarded-for` — нэг мөр эсвэл header массив. */
  forwardedFor?: string | readonly string[];
  /** `x-real-ip` — зөвхөн найдвартай proxy-той үед ашиглана. */
  realIp?: string | readonly string[];
  /** TCP холболтын хаяг (`req.socket.remoteAddress`). */
  remoteAddress?: string;
  /** Шууд урд байгаа найдвартай proxy-ийн тоо. */
  trustedProxyHops?: number;
}

/** Хамгийн их утга — буруу тохиргоогоор хязгааргүй гинж уншихаас сэргийлнэ. */
const MAX_HOPS = 16;

/** Юу ч олдохгүй үед бүх хүсэлт нэг bucket-т орно (хамгийн хатуу fallback). */
export const UNKNOWN_IP = "unknown";

function headerValue(v: string | readonly string[] | undefined): string {
  if (!v) return "";
  return (typeof v === "string" ? v : (v[0] ?? "")).trim();
}

/** XFF-ийг жагсаалт болгоно; header массив хэлбэрээр ирсэн ч зөв. */
function headerList(v: string | readonly string[] | undefined): string[] {
  if (!v) return [];
  const raw = typeof v === "string" ? v : v.join(",");
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * IP-г хэвийн хэлбэрт оруулна: `[::1]:443`, `1.2.3.4:5678`, `fe80::1%eth0`,
 * IPv4-mapped `::ffff:1.2.3.4` зэргийг цэвэрлэнэ. Буруу утга → `null`.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  if (s.startsWith("[")) {
    /* [IPv6]:port */
    const close = s.indexOf("]");
    if (close === -1) return null;
    const tail = s.slice(close + 1);
    if (tail && !tail.startsWith(":")) return null;
    s = s.slice(1, close);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(s)) {
    /* IPv4:port */
    s = s.slice(0, s.indexOf(":"));
  }

  /* Zone id (fe80::1%eth0) — линк-локал интерфэйсийн нэр. */
  s = s.split("%")[0].trim().toLowerCase();
  if (!s) return null;

  /* IPv4-mapped IPv6-г IPv4 болгож нэгтгэнэ. */
  if (s.startsWith("::ffff:") && isIP(s.slice(7)) === 4) s = s.slice(7);

  return isIP(s) ? s : null;
}

/** `TRUSTED_PROXY_HOPS` орчны хувьсагчийг аюулгүй тоо болгоно. */
export function parseTrustedProxyHops(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_HOPS, Math.trunc(n));
}

/**
 * Хүсэлтийн клиентийн IP-г тодорхойлно. Найдвартай эх сурвалж олдохгүй бол
 * socket хаяг, эсээс `UNKNOWN_IP` руу буулгана — хэзээ ч хоосон утга
 * буцаахгүй (rate limit түлхүүр хоосон болохгүй).
 */
export function clientIp(input: ClientIpInput): string {
  const remote = normalizeIp(input.remoteAddress) ?? UNKNOWN_IP;
  const hops = parseTrustedProxyHops(input.trustedProxyHops);
  if (hops === 0) return remote;

  const chain = headerList(input.forwardedFor)
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => entry !== null);

  /* [socket, ...XFF урвуу]; индекс `hops` = хамгийн ойрын итгэмжлэгдээгүй зангилаа. */
  const client = hops <= chain.length ? chain[chain.length - hops] : undefined;
  if (client) return client;

  /* XFF байхгүй/бүрэн бус: proxy-ийн өгсөн x-real-ip-д итгэж болно. */
  const real = normalizeIp(headerValue(input.realIp));
  if (real) return real;

  return remote;
}
