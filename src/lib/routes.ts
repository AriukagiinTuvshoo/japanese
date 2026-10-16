/**
 * Хөнгөн hash router-ийн цэвэр (React-гүй) логик.
 * Энд байгаа функцуудыг тестээс шууд ашиглана (scripts/test-routes.mjs).
 *
 * Хэлбэр: `#/<name>/<arg>?<query>`, жишээ: `#/grammar/ni-saishite?level=N2`
 *   - `name`   → хуудасны нэр (grammar, vocab, kanji, ...)
 *   - `arg`    → params[0]: жагсаалтаас детал руу очих id / тэмдэгт / tab
 *   - `query`  → level, mode, q гэх мэт нэмэлт параметр
 */
import type { Level } from "./types";

export interface Route {
  name: string;
  params: string[];
  query: Record<string, string>;
  hash: string;
}

export function parseHash(hash = window.location.hash): Route {
  // Хуучин линкүүд бүхэл query-г кодлосон байж магадгүй (жишээ: `#/grammar%3Flevel%3DN2`).
  // `?` эсвэл `%3F`-ээр path/query-г тусгаарлаад, query-г бүтнээр нь декодлоно.
  const raw = hash.replace(/^#\/?/, "");
  const sep = raw.match(/\?|%3F/i);
  let pathPart = raw;
  let queryPart: string | undefined;
  if (sep && sep.index !== undefined) {
    pathPart = raw.slice(0, sep.index);
    queryPart = raw.slice(sep.index + sep[0].length);
    try { queryPart = decodeURIComponent(queryPart); } catch { /* хэвээр нь */ }
  }
  const segments = pathPart.split("/").filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  const query: Record<string, string> = {};
  new URLSearchParams(queryPart ?? "").forEach((v, k) => { query[k] = v; });
  return { name: segments[0] ?? "home", params: segments.slice(1), query, hash };
}

/**
 * `href("vocab?level=N2")` → `#/vocab?level=N2`.
 * `href("grammar?level=N2", "ni-saishite")` → `#/grammar/ni-saishite?level=N2`.
 * Нэрийн `?query` хэсгийг кодлохгүй — өмнө нь `%3F` болж хуудас олдохгүй болдог байсан.
 */
export function href(name: string, ...rest: (string | number | undefined)[]) {
  const qIdx = name.indexOf("?");
  const path = qIdx >= 0 ? name.slice(0, qIdx) : name;
  const query = qIdx >= 0 ? name.slice(qIdx + 1) : "";
  const parts = [path, ...rest.filter((x) => x !== undefined && x !== "")].map((s) => encodeURIComponent(String(s)));
  return `#/${parts.join("/")}${query ? `?${query}` : ""}`;
}

/**
 * Детал/жагсаалтыг ялгах аргумент: `#/grammar/<id>` → `<id>`.
 * ВАЖНО: эхний параметр (params[0]) нь аргумент. Өмнө нь `params[1]`-г уншдаг
 * байсан тул бүх детал хуудас жагсаалт руу унадаг байсан (PR #10 дээр тогтоогдсон).
 */
export function routeArg(route: Route): string | undefined {
  return route.params[0] || undefined;
}

const LEVEL_RE = /^N[1-5]$/;

/** `?level=n2` → `"N2"`. Буруу утга бол undefined. */
export function routeLevel(route: Route): Level | undefined {
  const v = route.query.level?.toUpperCase();
  return v && LEVEL_RE.test(v) ? (v as Level) : undefined;
}
