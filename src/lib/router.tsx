/** Хөнгөн hash router: `#/vocab/ada066edfd?level=N5&tab=examples` */
import { useCallback, useEffect, useMemo, useState } from "react";

export interface Route {
  name: string;
  params: string[];
  query: Record<string, string>;
  hash: string;
}

export function parseHash(hash = window.location.hash): Route {
  const raw = hash.replace(/^#\/?/, "");
  const sep = raw.match(/\?|%3F/i);
  let pathPart = raw;
  let queryPart: string | undefined;
  if (sep && sep.index !== undefined) {
    pathPart = raw.slice(0, sep.index);
    queryPart = raw.slice(sep.index + sep[0].length);
    try { queryPart = decodeURIComponent(queryPart); } catch { /* хэвээр нь */ }
  }
  const segments = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const query: Record<string, string> = {};
  new URLSearchParams(queryPart ?? "").forEach((v, k) => { query[k] = v; });
  return { name: segments[0] ?? "home", params: segments.slice(1), query, hash };
}

export function href(name: string, ...rest: (string | number | undefined)[]) {
  const parts = [name, ...rest.filter((x) => x !== undefined && x !== "")].map((s) => encodeURIComponent(String(s)));
  return `#/${parts.join("/")}`;
}

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  const target = to.startsWith("#") ? to : `#/${to}`;
  if (opts.replace) window.history.replaceState(null, "", target);
  else window.location.hash = target.slice(1);
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash());
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/** Дэд хаягийн өөрчлөлтийг хянаж, `?query`-г шинэчилнэ. */
export function useQuery() {
  const route = useRoute();
  const set = useCallback((patch: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams(route.query);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") sp.delete(k);
      else sp.set(k, String(v));
    }
    const base = [route.name, ...route.params].filter(Boolean).join("/");
    navigate(`${base}?${sp.toString()}`.replace(/\?$/, ""), { keepScroll: true });
  }, [route]);
  return { query: route.query, set };
}

/** Дарах товчлуур (a href) — шинэ цонхонд нээхийг дэмжинэ. */
export function useGo() {
  return useCallback((to: string) => navigate(to), []);
}

export const titleFor = (r: Route): { title: string; sub?: string } => {
  const map: Record<string, string> = {
    home: "Нүүр", vocab: "Үгийн сан", review: "Давталт", kanji: "Ханз", write: "Бичих дасгал",
    grammar: "Дүрэм", reading: "Уншлага", listening: "Сонсгол", quiz: "Дасгал", mock: "Жишиг шалгалт",
    exam: "Шалгалтын үр дүн", dict: "Толь бичиг", plan: "Төлөвлөгөө", placement: "Түвшин тогтоох",
    progress: "Ахиц", achievements: "Амжилт", account: "Аккаунт", admin: "Удирдлага", kana: "Кана",
    about: "Тухай",
  };
  return { title: map[r.name] ?? "Nihongo Dōjō" };
};

export function useIsActive() {
  const route = useRoute();
  return useMemo(() => (name: string) => route.name === name, [route.name]);
}
