/** Хөнгөн hash router: `#/vocab/ada066edfd?level=N5&tab=examples` */
import { useCallback, useEffect, useState } from "react";
import { parseHash, type Route } from "./routes";

export { href, parseHash, routeArg, routeLevel } from "./routes";
export type { Route } from "./routes";

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

