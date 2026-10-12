import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { href } from "../lib/router";
import { useStore } from "../lib/store";
import { loadSearchIndex } from "../lib/data";
import { isKana, isKanji, parseFurigana, toHiragana } from "../lib/text";
import type { SearchIndex } from "../lib/types";
import { Button, Chip, LevelBadge, SpeakButton } from "./ui";
import { ui } from "../lib/i18n";

interface Token {
  text: string;
  ruby?: string;
  kind: "word" | "kana" | "punct";
  hit?: { mn: string; en?: string; lvl: string; id: string; reading: string; kind: "v" | "k" | "g" };
}

/**
 * X-RAY УНШИЛТ — текст дээрх үг бүрийг дарж, утгыг нь шууд харна.
 * Тайлбар: япон хэлний бодит морфологийн анализатор биш — толь бичгийн
 * индекс дээр суурилсан хамгийн урт таарлын (longest-match) арга.
 */
export function XRayText({ text, showFurigana = true }: { text: string; showFurigana?: boolean }) {
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [active, setActive] = useState<Token | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { doc, actions } = useStore();

  useEffect(() => { loadSearchIndex().then(setIndex); }, []);

  /** Урт таарлын хүснэгт. */
  const dict = useMemo(() => {
    if (!index) return null;
    const words = new Map<string, Token["hit"]>();
    const kanji = new Map<string, Token["hit"]>();
    const grammar = new Map<string, Token["hit"]>();
    for (const [w, r, mn, lvl, , id, en] of index.v) {
      if (!words.has(w)) words.set(w, { mn, en, lvl, id, reading: r, kind: "v" });
    }
    for (const [ch, on, mn, lvl] of index.k) {
      if (!kanji.has(ch)) kanji.set(ch, { mn, lvl, id: ch, reading: on, kind: "k" });
    }
    /** Дүрмийн хэлбэрийг текстээс тааруулна (〜/() хэсгийг хассан гол хэсэг). */
    for (const [pattern, mn, lvl, id] of index.g) {
      for (const part of pattern.split(/[\/／]/)) {
        const core = part.replace(/[〜~]/g, "").replace(/[（(][^）)]*[）)]/g, "").trim();
        if (core.length >= 2 && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u.test(core) && !grammar.has(core)) {
          grammar.set(core, { mn, lvl, id, reading: pattern, kind: "g" });
        }
      }
    }
    const maxLen = Math.max(1, ...[...words.keys()].map((w) => w.length), ...[...grammar.keys()].map((w) => w.length));
    return { words, kanji, grammar, maxLen: Math.min(8, maxLen) };
  }, [index]);

  const tokens = useMemo<Token[]>(() => {
    const parts = parseFurigana(text);
    const out: Token[] = [];
    for (const p of parts) {
      if (p.ruby) { out.push({ text: p.base, ruby: p.ruby, kind: "word" }); continue; }
      if (!dict) { out.push({ text: p.base, kind: "kana" }); continue; }
      let i = 0;
      while (i < p.base.length) {
        // 1) толь бичгийн хамгийн урт таарлыг хайна
        let matched = "";
        for (let len = Math.min(dict.maxLen, p.base.length - i); len >= 1; len--) {
          const cand = p.base.slice(i, i + len);
          if (dict.words.has(cand)) { matched = cand; break; }
        }
        if (matched) {
          out.push({ text: matched, kind: "word", hit: dict.words.get(matched) });
          i += matched.length;
          continue;
        }
        // 1b) дүрмийн хэлбэрийг тааруулна
        let matchedG = "";
        for (let len = Math.min(dict.maxLen, p.base.length - i); len >= 1; len--) {
          const cand = p.base.slice(i, i + len);
          if (dict.grammar.has(cand)) { matchedG = cand; break; }
        }
        if (matchedG) {
          out.push({ text: matchedG, kind: "word", hit: dict.grammar.get(matchedG) });
          i += matchedG.length;
          continue;
        }
        // 2) ханз эсвэл кана тусдаа
        const ch = p.base[i];
        if (isKanji(ch) && dict.kanji.has(ch)) {
          out.push({ text: ch, kind: "word", hit: dict.kanji.get(ch) });
        } else if (isKana(ch)) {
          // дараалсан кана-г нэгтгэнэ
          let j = i;
          while (j < p.base.length && isKana(p.base[j])) j++;
          out.push({ text: p.base.slice(i, j), kind: "kana" });
          i = j;
          continue;
        } else {
          out.push({ text: ch, kind: "punct" });
        }
        i += 1;
      }
    }
    return out;
  }, [text, dict]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setActive(null); setPos(null); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const open = (t: Token, e: React.MouseEvent) => {
    if (!t.hit) return;
    const r = (e.target as HTMLElement).getBoundingClientRect();
    setActive(t);
    setPos({ x: Math.min(window.innerWidth - 300, Math.max(12, r.left)), y: r.bottom + 8 });
  };

  const added = active?.hit ? !!doc.srs[active.hit.id] : false;
  const language = doc.profile.language ?? "mn";
  const tr = ui[language];
  /** Touch: tap opens; fine pointer: hover opens (requirement: phone tap + desktop hover). */
  const hoverCapable = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches;

  return (
    <div ref={wrapRef} className="relative">
      {tokens.map((t, i) =>
        t.hit ? (
          <button
            key={i}
            onClick={(e) => open(t, e)}
            onMouseEnter={(e) => { if (hoverCapable()) open(t, e); }}
            className={cn(
              "rounded-[3px] transition-colors",
              active === t ? "bg-shu-500 text-white" : "hover:bg-shu-100/70",
              t.hit.kind === "v" && doc.srs[t.hit.id] && "underline decoration-matcha-400 decoration-2 underline-offset-4",
            )}
          >
            {t.ruby && showFurigana ? <ruby>{t.text}<rt>{t.ruby}</rt></ruby> : t.text}
          </button>
        ) : (
          <span key={i}>{t.ruby && showFurigana ? <ruby>{t.text}<rt>{t.ruby}</rt></ruby> : t.text}</span>
        ),
      )}

      {active?.hit && pos && (
        <div
          className="fixed z-[75] w-[280px] animate-pop rounded-2xl border border-sumi-900/12 bg-white p-4 shadow-2xl"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-jp text-[1.35rem] font-bold leading-none">{active.text}</p>
              {active.hit.reading && <p className="mt-1 font-jp text-[12px] text-sumi-500">{active.hit.reading}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <LevelBadge level={active.hit.lvl as never} size="sm" />
              <Chip tone="sumi">{active.hit.kind === "k" ? tr.xrayKindKanji : active.hit.kind === "g" ? tr.xrayKindGrammar : tr.xrayKindWord}</Chip>
              <SpeakButton text={active.text} className="!h-11 !w-11 sm:!h-7 sm:!w-7" />
            </div>
          </div>

          <p className="mt-2.5 text-[13.5px] font-bold leading-snug text-sumi-800">
            {(language === "en" ? active.hit.en || active.hit.mn : active.hit.mn) || <span className="font-medium text-sumi-400">{tr.xrayPending}</span>}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {active.hit.kind !== "g" && (
              <Button size="sm" variant={added ? "soft" : "primary"} onClick={() => actions.grade(active.hit!.id, 2, { isNew: !added })}>
                {added ? tr.xrayInSrs : tr.xrayAddSrs}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { window.location.hash = href(active.hit!.kind === "k" ? "kanji" : active.hit!.kind === "g" ? "grammar" : "vocab", active.hit!.id).slice(1); setActive(null); }}>
              {tr.xrayDetail}
            </Button>
          </div>

          {active.hit.kind === "k" && (
            <p className="mt-2.5 border-t border-sumi-900/8 pt-2 text-[11px] text-sumi-400">{tr.xrayKanjiNote}</p>
          )}
          {active.hit.kind === "g" && (
            <p className="mt-2.5 border-t border-sumi-900/8 pt-2 text-[11px] text-sumi-400">{tr.xrayGrammarNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Энгийн текстийг фуриганатай харуулах. */
export function RubyText({ text, show = true, className }: { text: string; show?: boolean; className?: string }) {
  const parts = parseFurigana(text);
  return (
    <span className={cn("font-jp", className)}>
      {parts.map((p, i) =>
        p.ruby && show ? <ruby key={i}>{p.base}<rt>{p.ruby}</rt></ruby> : <span key={i}>{p.base}</span>,
      )}
    </span>
  );
}

/** Хирагана руу хөрвүүлж хайлт хийх товч (уншилтын тусламж). */
export function ReadingAid({ text }: { text: string }) {
  const kana = useMemo(() => toHiragana(text), [text]);
  return <Chip tone="sumi">{kana}</Chip>;
}
