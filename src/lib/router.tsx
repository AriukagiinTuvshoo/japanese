/** Хөнгөн hash router: `#/vocab/ada066edfd?level=N5&tab=examples` */
import { useCallback, useEffect, useMemo, useState } from "react";
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

/** Дарах товчлуур (a href) — шинэ цонхонд нээхийг дэмжинэ. */
export function useGo() {
  return useCallback((to: string) => navigate(to), []);
}

export const titleFor = (r: Route, language: "mn" | "en" = "mn"): { title: string; sub?: string } => {
  const map: Record<"mn" | "en", Record<string, string>> = {
    mn: {
      home: "Нүүр", vocab: "Үгийн сан", review: "Давталт", kanji: "Ханз", write: "Бичих дасгал",
      grammar: "Дүрэм", reading: "Уншлага", listening: "Сонсгол", quiz: "Дасгал", mock: "Жишиг шалгалт",
      exam: "Шалгалтын үр дүн", dict: "Толь бичиг", plan: "Төлөвлөгөө", placement: "Түвшин тогтоох",
      progress: "Ахиц", achievements: "Амжилт", account: "Аккаунт", admin: "Удирдлага", kana: "Кана",
      about: "Тухай",
    },
    en: {
      home: "Dashboard", vocab: "Vocabulary", review: "Review", kanji: "Kanji", write: "Writing practice",
      grammar: "Grammar", reading: "Reading", listening: "Listening", quiz: "Practice tests", mock: "JLPT mock exam",
      exam: "Exam results", dict: "Dictionary", plan: "My plan", placement: "Placement test",
      progress: "Progress", achievements: "Achievements", account: "Account", admin: "Content management", kana: "Kana",
      about: "About",
    },
  };
  return { title: map[language][r.name] ?? "Nihongo Dōjō" };
};

export function useIsActive() {
  const route = useRoute();
  return useMemo(() => (name: string) => route.name === name, [route.name]);
}
