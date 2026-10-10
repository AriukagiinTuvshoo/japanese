import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { loadSearchIndex } from "../lib/data";
import { navigate } from "../lib/router";
import { romajiToKana, toHiragana } from "../lib/text";
import type { SearchIndex } from "../lib/types";
import { Chip, LevelBadge, Spinner } from "./ui";
import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";

type Kind = "v" | "k" | "g";
interface Hit { kind: Kind; main: string; sub: string; mn: string; lvl: string; id: string; score: number }

const KIND_KEY: Record<Kind, "wordSg" | "kanji" | "grammar"> = { v: "wordSg", k: "kanji", g: "grammar" };

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSearchIndex().then(setIndex).catch(() => setIndex({ v: [], k: [], g: [] }));
    inputRef.current?.focus();
  }, []);

  const hits = useMemo<Hit[]>(() => {
    if (!index) return [];
    const raw = q.trim();
    if (!raw) return [];
    const lower = raw.toLowerCase();
    const kana = romajiToKana(lower);
    const hira = toHiragana(raw);
    const needles = [...new Set([raw, lower, kana, hira, toHiragana(kana)].filter(Boolean))];

    const out: Hit[] = [];
    const score = (text: string, mn: string, en: string) => {
      for (const n of needles) {
        if (text === n) return 100;
        if (text.startsWith(n)) return 70;
        if (text.includes(n)) return 45;
        if (mn.toLowerCase().startsWith(n)) return 34;
        if (mn.toLowerCase().includes(n)) return 22;
        if (en.toLowerCase().startsWith(n)) return 16;
        if (en.toLowerCase().includes(n)) return 10;
      }
      return 0;
    };

    for (const [w, r, mn, lvl, tier, id] of index.v) {
      const s = score(w, mn, w) || score(r, mn, w) * 0.9 || score(toHiragana(r), mn, w) * 0.85;
      if (s > 0) out.push({ kind: "v", main: w, sub: r, mn, lvl, id, score: s + (tier === 0 ? 6 : 0) });
    }
    for (const [ch, on, mn, lvl, strokes] of index.k) {
      const s = score(ch, mn, ch);
      if (s > 0) out.push({ kind: "k", main: ch, sub: t.strokesSub2(strokes, on), mn, lvl, id: ch, score: s + 8 });
    }
    for (const [p, mn, lvl, id] of index.g) {
      const p2 = p.replace(/[〜~]/g, "");
      const s = score(p2, mn, p2) || score(p, mn, p);
      if (s > 0) out.push({ kind: "g", main: p, sub: t.grammarSub, mn, lvl, id, score: s + 4 });
    }

    const filtered = filter === "all" ? out : out.filter((h) => h.kind === filter);
    return filtered.sort((a, b) => b.score - a.score || a.main.length - b.main.length).slice(0, 40);
  }, [index, q, filter]);

  useEffect(() => setCursor(0), [q, filter]);

  const open = (h: Hit) => {
    // Дүрмийн хайлтаас орохдоо түвшинг (level) дамжуулна.
    const to = h.kind === "g"
      ? `grammar/${h.id}?level=${h.lvl}`
      : `${h.kind === "v" ? "vocab" : "kanji"}/${h.id}`;
    navigate(to);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    if (e.key === "Enter" && hits[cursor]) open(hits[cursor]);
    if (e.key === "Escape") onClose();
  };

  const grouped = useMemo(() => {
    const g: Record<string, Hit[]> = { v: [], k: [], g: [] };
    for (const h of hits) g[h.kind].push(h);
    return g;
  }, [hits]);

  let flat = -1;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-sumi-950/60 p-4 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="washi w-full max-w-2xl animate-pop overflow-hidden rounded-2xl border border-sumi-900/12 shadow-2xl"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-sumi-900/10 bg-white/70 px-4 py-3">
          <span className="text-[16px] text-sumi-400">🔎</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t.searchPh}
            className="h-8 min-h-11 sm:min-h-0 w-full flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-sumi-400"
          />
          <div className="flex gap-1">
            {(["all", "v", "k", "g"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-11 min-h-11 min-w-11 sm:h-7 sm:min-h-0 sm:min-w-0 rounded-lg px-3 sm:px-2 text-[11.5px] font-bold transition",
                  filter === f ? "bg-sumi-900 text-washi-50" : "bg-sumi-900/6 text-sumi-500 hover:text-sumi-800",
                )}
              >
                {f === "all" ? t.allF : t[KIND_KEY[f]]}
              </button>
            ))}
          </div>
          <kbd className="hidden rounded-md border sm:inline border-sumi-900/12 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-sumi-400">ESC</kbd>
        </div>

        <div className="max-h-[58vh] overflow-y-auto">
          {!index && <Spinner label={t.loadingSearch} lang={language} />}
          {index && !q && (
            <div className="px-5 py-6">
              <p className="text-[12px] font-bold uppercase tracking-wider text-sumi-400">{t.quickJump}</p>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {[
                  { to: "vocab", k: "語", t: t.vocab },
                  { to: "kanji", k: "漢", t: t.kanji },
                  { to: "write", k: "筆", t: t.writeTab },
                  { to: "grammar", k: "文", t: t.grammar },
                  { to: "reading", k: "読", t: t.readingShort },
                  { to: "listening", k: "聴", t: t.listeningShort },
                  { to: "review", k: "復", t: t.reviewShort },
                  { to: "mock", k: "試", t: t.mockShort },
                ].map((s) => (
                  <button
                    key={s.to}
                    onClick={() => { navigate(s.to); onClose(); }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-sumi-900/5"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-sumi-900/6 font-mincho text-[14px] font-bold text-sumi-700">{s.k}</span>
                    <span className="text-[13px] font-bold text-sumi-700">{s.t}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {index && q && hits.length === 0 && (
            <div className="grid place-items-center px-6 py-14 text-center">
              <span className="font-mincho text-[2.2rem] font-bold text-sumi-900/12">無</span>
              <p className="mt-2 text-[14px] font-extrabold text-sumi-700">{t.noHits}</p>
              <p className="mt-1 text-[12.5px] text-sumi-500">{t.noHitsSub} <span className="font-mono">tabemono</span></p>
            </div>
          )}

          {(["v", "k", "g"] as Kind[]).map((kind) =>
            grouped[kind]?.length ? (
              <div key={kind} className="border-b border-sumi-900/6 last:border-0">
                <p className="sticky top-0 z-10 bg-washi-100/90 px-5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sumi-400 backdrop-blur">
                  {t[KIND_KEY[kind]]} · {grouped[kind].length}
                </p>
                <ul>
                  {grouped[kind].map((h) => {
                    flat += 1;
                    const active = flat === cursor;
                    return (
                      <li key={`${h.kind}${h.id}`}>
                        <button
                          onMouseEnter={() => setCursor(flat)}
                          onClick={() => open(h)}
                          className={cn("flex w-full items-center gap-3 px-5 py-2.5 text-left transition", active ? "bg-shu-50" : "hover:bg-sumi-900/4")}
                        >
                          <span className={cn(
                            "shrink-0 font-mincho font-bold text-sumi-900",
                            kind === "k" ? "text-[26px] leading-none" : "w-[7.5rem] truncate text-[16px]",
                          )}>
                            {h.main}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-sumi-800">{h.mn || h.sub}</span>
                            <span className="block truncate font-jp text-[11.5px] text-sumi-400">{h.sub}</span>
                          </span>
                          <LevelBadge level={h.lvl as never} size="sm" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null,
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-sumi-900/10 bg-white/50 px-5 py-2.5 text-[11px] text-sumi-400">
          <span><kbd className="font-mono">↑↓</kbd> {t.choose}</span>
          <span><kbd className="font-mono">↵</kbd> {t.open2}</span>
          <Chip tone="sumi" className="ml-auto">
            {index ? t.indexCounts(index.v.length.toLocaleString(), index.k.length.toLocaleString(), index.g.length.toLocaleString()) : "…"}
          </Chip>
        </div>
      </div>
    </div>
  );
}
