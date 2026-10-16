import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData, shuffle } from "../lib/data";
import { GRADES, dueCards, memoryStats, previewIntervals, retrievability, type Grade } from "../lib/srs";
import { MQ_LABEL, TYPE_LABEL, stripFurigana } from "../lib/text";
import { MN_PENDING, ui, type Language } from "../lib/i18n";
import type { Kanji, Level, Vocab } from "../lib/types";
import {
  Bar, Button, Card, Chip, Furigana, LevelBadge, Ring, SectionTitle, SpeakButton, speak,
} from "./ui";

export type SessionKind = "vocab" | "kanji" | "mixed";
type Direction = "jp-mn" | "mn-jp" | "listen" | "write";

export interface SessionItem {
  id: string;
  front: string;
  reading: string;
  back: string[];
  extra?: string;
  kind: "vocab" | "kanji";
  level: Level;
  audio?: string;
  examples?: { ja: string; fg?: string; mn?: string | null; en?: string }[];
  word?: Vocab | Kanji;
}

/* ─────────────── Тохиргоо ─────────────── */
export function SessionSetup({ kind = "vocab", level }: { kind?: SessionKind; level: Level }) {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [direction, setDirection] = useState<Direction>("jp-mn");
  const [count, setCount] = useState(20);
  const [onlyDue, setOnlyDue] = useState(false);
  const [run, setRun] = useState<SessionItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    const data = await loadFullData();
    let items: SessionItem[] = [];

    const useVocab = kind === "vocab" || kind === "mixed";
    const useKanji = kind === "kanji" || kind === "mixed";

    const srsDue = new Set(dueCards(doc.srs).map(([id]) => id));
    const studied = doc.profile.newPerDay;

    if (useVocab) {
      const pool = data.vocabByLevel[level];
      const fresh = shuffle(pool.filter((v) => !doc.srs[v.id])).slice(0, onlyDue ? 0 : studied);
      const due = pool.filter((v) => srsDue.has(v.id)).slice(0, count);
      items.push(...due.map((v) => vocabToItem(v, "jp-mn", language)), ...fresh.map((v) => vocabToItem(v, "jp-mn", language)));
    }
    if (useKanji) {
      const pool = data.kanjiByLevel[level];
      const fresh = shuffle(pool.filter((k) => !doc.srs[k.k])).slice(0, onlyDue ? 0 : Math.max(3, Math.round(studied / 2)));
      const due = pool.filter((k) => srsDue.has(k.k)).slice(0, count);
      items.push(...due.map((k) => kanjiToItem(k, "jp-mn", language)), ...fresh.map((k) => kanjiToItem(k, "jp-mn", language)));
    }

    if (!items.length) {
      const pool = useVocab ? data.vocabByLevel[level] : data.kanjiByLevel[level];
      items = useVocab
        ? shuffle(pool as Vocab[]).slice(0, count).map((v) => vocabToItem(v, "jp-mn", language))
        : shuffle(pool as Kanji[]).slice(0, count).map((k) => kanjiToItem(k, "jp-mn", language));
    }

    items = shuffle(items).slice(0, count).map((it) => ({ ...it, ...flip(it, direction) }));
    setRun(items);
    setLoading(false);
  }, [kind, level, doc.srs, doc.profile.newPerDay, count, onlyDue, direction, language]);

  if (run) {
    return (
      <Session
        items={run}
        direction={direction}
        onExit={() => setRun(null)}
        onFinish={() => {}}
      />
    );
  }

  return (
    <Card>
      <SectionTitle
        jp="学習セッション"
        title={t.sessionTitle}
        sub={t.sessionSub}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div>
            <p className="text-[12.5px] font-bold text-sumi-700">{t.directionLabel}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([
                { id: "jp-mn", title: t.dirJpMn, d: t.dirJpMnD, k: "日蒙" },
                { id: "mn-jp", title: t.dirMnJp, d: t.dirMnJpD, k: "蒙日" },
                { id: "listen", title: t.dirListen, d: t.dirListenD, k: "聴" },
                { id: "write", title: t.dirRead, d: t.dirReadD, k: "読" },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setDirection(o.id)}
                  className={cn("flex items-center gap-3 rounded-xl border p-3.5 text-left transition",
                    direction === o.id ? "border-shu-400 bg-shu-50" : "border-sumi-900/10 bg-white/70 hover:border-sumi-900/25")}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sumi-900 font-mincho text-[14px] font-bold text-washi-50">{o.k}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-sumi-900">{o.title}</span>
                    <span className="block text-[11.5px] text-sumi-500">{o.d}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12.5px] font-bold text-sumi-700">{t.cardCount} <span className="font-mono tabnum">{count}</span></span>
              <input type="range" min={5} max={80} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full" />
            </label>
            <div className="flex items-end">
              <button
                onClick={() => setOnlyDue((v) => !v)}
                className={cn("flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition",
                  onlyDue ? "border-ai-400 bg-ai-50" : "border-sumi-900/10 bg-white/70")}
              >
                <span>
                  <span className="block text-[12.5px] font-bold text-sumi-800">{t.onlyDue}</span>
                  <span className="block text-[11px] text-sumi-500">{t.onlyDueSub}</span>
                </span>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", onlyDue ? "bg-ai-500" : "bg-sumi-900/20")}>
                  <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-all", onlyDue ? "left-5" : "left-1")} />
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
          <p className="text-[12.5px] font-bold text-sumi-700">{t.currentStatus}</p>
          <div className="mt-3 space-y-2 text-[12.5px] text-sumi-600">
            <Row l={t.overdueRow} v={dueCards(doc.srs).length} tone="shu" />
            <Row l={t.newCardsRow} v={Object.values(doc.srs).filter((c) => c.ph === "new").length} tone="sumi" />
            <Row l={t.stateLearning} v={Object.values(doc.srs).filter((c) => c.ph === "learning" || c.ph === "relearn").length} tone="kin" />
            <Row l={t.level} v={level} tone="ai" />
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={start} disabled={loading}>
            {loading ? t.preparing : t.startBtn}
          </Button>
          <p className="mt-3 text-[11px] leading-relaxed text-sumi-400">
            {t.intervalNote}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Row({ l, v, tone }: { l: string; v: number | string; tone: "shu" | "ai" | "kin" | "sumi" }) {
  return (
    <div className="flex items-center justify-between">
      <span>{l}</span>
      <span className={cn("font-mono font-bold tabnum",
        tone === "shu" ? "text-shu-600" : tone === "ai" ? "text-ai-600" : tone === "kin" ? "text-kin-600" : "text-sumi-700")}>
        {typeof v === "number" ? v.toLocaleString() : v}
      </span>
    </div>
  );
}

/* ─────────────── Сесс ─────────────── */
export function Session({
  items, direction = "jp-mn", onExit, onFinish,
}: {
  items: SessionItem[];
  direction?: Direction;
  onExit: () => void;
  onFinish?: (r: { total: number; again: number; minutes: number }) => void;
}) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [finished, setFinished] = useState(false);
  const started = useMemo(() => Date.now(), []);

  const item = items[idx];
  const card = item ? doc.srs[item.id] : undefined;
  const previews = useMemo(() => previewIntervals(card, language), [card, language]);

  const grade = useCallback((g: Grade) => {
    if (!item) return;
    actions.grade(item.id, g, { isNew: !card, level: item.level });
    setStats((s) => ({ ...s, [["again", "hard", "good", "easy"][g]]: (s as never as Record<string, number>)[["again", "hard", "good", "easy"][g]] + 1 } as typeof s));
    if (idx + 1 >= items.length) {
      setFinished(true);
      onFinish?.({ total: items.length, again: stats.again + (g === 0 ? 1 : 0), minutes: Math.max(1, Math.round((Date.now() - started) / 60000)) });
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  }, [item, card, actions, idx, items.length, onFinish, stats.again, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!revealed) setRevealed(true); else grade(2); }
      if (revealed && ["1", "2", "3", "4"].includes(e.key)) grade((Number(e.key) - 1) as Grade);
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, grade, onExit]);

  useEffect(() => {
    if (item?.audio && direction === "listen") {
      const timer = setTimeout(() => speak(item.audio!, doc.profile.rate), 300);
      return () => clearTimeout(timer);
    }
  }, [item, direction, doc.profile.rate]);

  if (!item) return <div />;

  if (finished) {
    const total = items.length;
    const acc = (stats.good + stats.easy) / Math.max(1, total);
    return (
      <Card className="mx-auto max-w-xl text-center">
        <span className="font-mincho text-[3rem] font-bold text-matcha-500">完</span>
        <h2 className="mt-2 text-[1.5rem] font-extrabold">{t.sessionDone}</h2>
        <p className="mt-1.5 text-[13.5px] text-sumi-500">{total} {t.cardsUnit} · {Math.max(1, Math.round((Date.now() - started) / 60000))} {t.minutes}</p>
        <div className="mt-5 flex justify-center">
          <Ring value={acc} size={96} stroke={8} tone={acc > 0.8 ? "matcha" : acc > 0.5 ? "kin" : "shu"}>
            <span className="font-mono text-[1.2rem] font-extrabold tabnum">{Math.round(acc * 100)}%</span>
          </Ring>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <div key={g.g} className="card-flat px-2 py-3">
              <p className="text-[11px] font-bold text-sumi-500">{language === "en" ? g.en : g.mn}</p>
              <p className="mt-1 font-mono text-[16px] font-extrabold tabnum">{stats[["again", "hard", "good", "easy"][g.g] as "again"]}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={onExit}>{t.retry2}</Button>
          <Button variant="outline" onClick={() => navigate("progress")}>{t.viewProgress}</Button>
          <Button variant="ghost" onClick={() => navigate("home")}>{t.homeShort}</Button>
        </div>
      </Card>
    );
  }

  const backText = item.back;
  const mq = item.word && "mq" in item.word ? MQ_LABEL[language][(item.word as Vocab).mq] : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onExit}>{t.exitBtn}</Button>
        <div className="min-w-0 flex-1">
          <Bar value={idx / items.length} tone="ai" height={5} />
        </div>
        <span className="font-mono text-[12px] font-bold tabnum text-sumi-500">{idx + 1}/{items.length}</span>
      </div>

      <Card className="min-h-[300px] p-7">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LevelBadge level={item.level} size="sm" />
            <Chip tone="sumi">{item.kind === "kanji" ? t.kanji : t.wordSg}</Chip>
            {item.word && "t" in item.word && <Chip tone="sumi">{TYPE_LABEL[language][(item.word as Vocab).t]}</Chip>}
          </div>
          {card && (
            <Chip tone={retrievability(card) > 0.8 ? "matcha" : retrievability(card) > 0.5 ? "kin" : "shu"}>
              {t.recallChip} {Math.round(retrievability(card) * 100)}%
            </Chip>
          )}
        </div>

        <div className="mt-6 grid place-items-center text-center">
          {direction === "listen" ? (
            <button
              onClick={() => speak(item.audio ?? item.front, doc.profile.rate)}
              className="grid h-24 w-24 place-items-center rounded-3xl bg-ai-50 text-[38px] text-ai-600 transition hover:bg-ai-100"
            >
              🔊
            </button>
          ) : frontIsJapanese(direction) ? (
            <p className="font-jp text-[3.4rem] font-bold leading-none text-sumi-900">{item.front}</p>
          ) : (
            <p className="text-[1.6rem] font-extrabold leading-tight text-sumi-900">{item.front}</p>
          )}

          {frontIsJapanese(direction) && item.reading && revealed && (
            <p className="mt-3 font-jp text-[15px] text-sumi-500">{item.reading}</p>
          )}
          {!frontIsJapanese(direction) && item.reading && (
            <p className="mt-3 font-jp text-[15px] text-sumi-500">{item.reading}</p>
          )}
        </div>

        {!revealed ? (
          <div className="mt-8 flex justify-center">
            <Button size="lg" onClick={() => setRevealed(true)} autoFocus>{t.revealBtn}</Button>
          </div>
        ) : (
          <div className="mt-6 animate-fade border-t border-sumi-900/8 pt-5">
            <p className="text-center text-[1.35rem] font-extrabold leading-snug text-sumi-900">
              {backText.join(" · ")}
            </p>
            {item.extra && <p className="mt-2 text-center text-[13px] text-sumi-500">{item.extra}</p>}
            {mq && mq.tone !== "matcha" && (
              <p className="mt-2 text-center text-[11.5px] font-bold text-kin-600">
                {mq.text} — <span className="text-sumi-400">{t.srcEnNote}</span>
              </p>
            )}

            {item.examples?.slice(0, 2).map((ex, i) => (
              <div key={i} className="mt-4 rounded-xl bg-sumi-900/[0.035] px-4 py-3">
                <div className="flex items-start gap-3">
                  <Furigana text={ex.fg ?? ex.ja} show={doc.profile.furigana} className="flex-1 text-[14.5px] font-semibold text-sumi-900" />
                  <SpeakButton text={stripFurigana(ex.ja)} lang={language} />
                </div>
                {(ex.mn || ex.en) && <p className="mt-1.5 text-[12.5px] text-sumi-600">{language === "en" ? ex.en ?? ex.mn : ex.mn ?? ex.en}</p>}
              </div>
            ))}

            {item.kind === "kanji" && (
              <div className="mt-4 text-center">
                <a href={href("write", item.id)} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">
                  {t.practiceKanji}
                </a>
              </div>
            )}

            <div className="mt-6 grid grid-cols-4 gap-2">
              {GRADES.map((g, i) => (
                <button
                  key={g.g}
                  onClick={() => grade(g.g)}
                  className={cn(
                    "rounded-xl border-2 px-2 py-3 text-center transition hover:-translate-y-0.5",
                    g.tone === "shu" ? "border-shu-100 bg-shu-50 hover:border-shu-400"
                      : g.tone === "kin" ? "border-kin-100 bg-kin-50 hover:border-kin-400"
                        : g.tone === "matcha" ? "border-matcha-100 bg-matcha-50 hover:border-matcha-400"
                          : "border-ai-100 bg-ai-50 hover:border-ai-400",
                  )}
                >
                  <span className={cn("block text-[13.5px] font-extrabold",
                    g.tone === "shu" ? "text-shu-700" : g.tone === "kin" ? "text-kin-600" : g.tone === "matcha" ? "text-matcha-600" : "text-ai-600")}>
                    {language === "en" ? g.en : g.mn}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] text-sumi-500">{previews[i]?.label}</span>
                  <span className="mt-0.5 block font-mono text-[9.5px] text-sumi-300">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <p className="mt-3 text-center text-[11.5px] text-sumi-400">
        <kbd className="font-mono">Space</kbd> {t.kbReveal} · <kbd className="font-mono">1–4</kbd> {t.kbRate} · <kbd className="font-mono">Esc</kbd> {t.kbExit}
      </p>
    </div>
  );
}

const frontIsJapanese = (d: Direction) => d === "jp-mn" || d === "listen";
const flip = (it: SessionItem, d: Direction): Partial<SessionItem> => {
  if (d === "mn-jp") return { front: it.back[0], back: [it.front], reading: it.reading };
  return {};
};

/* ─────────────── Хөрвүүлэлт ─────────────── */
export function vocabToItem(v: Vocab, _d: Direction, language: Language = "mn"): SessionItem {
  return {
    id: v.id,
    kind: "vocab",
    level: v.lvl,
    front: v.w,
    reading: v.r,
    back: language === "en"
      ? (v.en.length ? v.en : v.mn ?? [MN_PENDING])
      : (v.mn?.length ? v.mn : [MN_PENDING]),
    extra: language === "en" ? undefined : v.en.join("; "),
    audio: v.w,
    examples: v.ex.map((e) => ({ ja: e.ja, fg: e.fg, mn: e.mn ?? undefined, en: e.en })),
    word: v,
  };
}

export function kanjiToItem(k: Kanji, _d: Direction, language: Language = "mn"): SessionItem {
  const back = language === "en"
    ? (k.en.length ? k.en : k.mn)
    : (k.mn.length ? k.mn : (k.en.length ? k.en : [MN_PENDING]));
  return {
    id: k.k,
    kind: "kanji",
    level: k.lvl,
    front: k.k,
    reading: [...k.on.slice(0, 2), ...k.kun.slice(0, 2)].join("・"),
    back,
    extra: language === "en"
      ? `${k.s ?? "?"} ${"strokes"}${k.en.length ? ` · ${k.en.join(", ")}` : ""}`
      : `${k.s ?? "?"} зурлага${k.mn.length ? ` · ${k.en.join(", ")}` : ""}`,
    audio: k.k,
    word: k,
  };
}

/* ─────────────── Тойм самбар ─────────────── */
export function MemoryPanel() {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const mem = useMemo(() => memoryStats(doc.srs), [doc.srs]);
  return (
    <Card>
      <SectionTitle jp="記憶" title={t.memoryTitle} />
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { l: t.totalReviewsRow, v: mem.reviews.toLocaleString(), s: t.lapsesSub(mem.lapses) },
          { l: t.accuracyRow, v: `${Math.round(mem.accuracy * 100)}%`, s: t.accSub },
          { l: t.retentionRow, v: `${Math.round(mem.retention * 100)}%`, s: t.retSub },
          { l: t.forgettingRow, v: `${Math.round(mem.forgettingRate * 100)}%`, s: t.fSub },
        ].map((x) => (
          <div key={x.l} className="card-flat px-4 py-3.5">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
            <p className="mt-1 font-mono text-[1.3rem] font-extrabold tabnum leading-none">{x.v}</p>
            <p className="mt-1 text-[11.5px] text-sumi-500">{x.s}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-sumi-900/4 px-3.5 py-3 text-[12.5px] leading-relaxed text-sumi-600">
        {t.mistakesNote(doc.mistakes.length)}
      </p>
    </Card>
  );
}
