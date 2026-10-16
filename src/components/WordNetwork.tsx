import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href } from "../lib/router";
import { loadFullData } from "../lib/data";
import type { Kanji, Level, Vocab } from "../lib/types";
import { LEVELS } from "../lib/types";
import { MQ_LABEL } from "../lib/text";
import { Card, Chip, ErrorBox, LevelBadge, SectionTitle, Spinner, SpeakButton } from "./ui";
import { useStore } from "../lib/store";
import { MN_PENDING, ui, vocabMeaning } from "../lib/i18n";

/**
 * WORD NETWORK / MEMORY MAP
 * Words are connected to their component kanji. The links mean "shares a kanji",
 * not "is a synonym". The learner's own mnemonic is stored with the existing
 * per-kanji memory notes and is also shown on the Kanji detail page and in SRS.
 */
export function WordNetwork({ level }: { level: Level }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [data, setData] = useState<Awaited<ReturnType<typeof loadFullData>> | null>(null);
  const [center, setCenter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [memoryNote, setMemoryNote] = useState("");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError(null);
    loadFullData().then((d) => {
      if (!active) return;
      setData(d);
      // Choose the most connected kanji deterministically; the map stays stable
      // across reloads so the learner can resume where they left off.
      const counts = new Map<string, number>();
      for (const v of d.vocabByLevel[level]) {
        for (const ch of v.kd) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      setCenter(best[0]?.[0] ?? "日");
    }).catch((error: unknown) => {
      if (active) {
        setData(null);
        setLoadError(error);
      }
    });
    return () => { active = false; };
  }, [level, loadAttempt]);

  useEffect(() => {
    setMemoryNote(center ? doc.mnemonics[center] ?? "" : "");
  }, [center, doc.mnemonics]);

  const model = useMemo(() => {
    if (!data || !center) return null;

    // Prefer words from the selected JLPT level, then keep a stable order.
    const words = [...(data.wordsByKanji.get(center) ?? [])]
      .sort((a, b) =>
        Number(b.lvl === level) - Number(a.lvl === level) ||
        LEVELS.indexOf(a.lvl) - LEVELS.indexOf(b.lvl) ||
        a.w.localeCompare(b.w),
      )
      .slice(0, 8);

    const neighbours = new Map<string, number>();
    for (const word of words) {
      for (const ch of word.kd) {
        if (ch === center) continue;
        neighbours.set(ch, (neighbours.get(ch) ?? 0) + 1);
      }
    }
    const ring = [...neighbours.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([ch, count]) => ({ ch, count }));

    return { words, ring, kanji: data.kanjiByChar.get(center) };
  }, [data, center, level]);

  const suggestions = useMemo(() => {
    if (!data) return [];
    const needle = query.trim();
    if (!needle) {
      const counts = new Map<string, number>();
      for (const word of data.vocabByLevel[level]) {
        for (const ch of word.kd) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 24)
        .map(([ch]) => ch);
    }

    const normalized = needle.toLocaleLowerCase();
    return [...data.kanjiByChar.keys()].filter((ch) => {
      const kanji = data.kanjiByChar.get(ch);
      if (ch === needle ||
        (kanji?.mn ?? []).some((meaning) => meaning.toLocaleLowerCase().includes(normalized)) ||
        (kanji?.en ?? []).some((meaning) => meaning.toLocaleLowerCase().includes(normalized))) return true;

      // Let learners find the kanji through a word, reading or translation too.
      return (data.wordsByKanji.get(ch) ?? []).some((word) =>
        word.w.includes(needle) ||
        word.r.includes(needle) ||
        word.rm.toLocaleLowerCase().includes(normalized) ||
        (word.mn ?? []).some((meaning) => meaning.toLocaleLowerCase().includes(normalized)) ||
        word.en.some((meaning) => meaning.toLocaleLowerCase().includes(normalized)),
      );
    }).slice(0, 24);
  }, [data, query, level]);

  const wordNodes = model
    ? model.words.map((word, index) => {
        const angle = (index / Math.max(model.words.length, 1)) * Math.PI * 2 - Math.PI / 2;
        return { word, x: 450 + Math.cos(angle) * 155, y: 280 + Math.sin(angle) * 112 };
      })
    : [];
  const kanjiNodes = model && data
    ? model.ring.map((node, index) => {
        const angle = (index / Math.max(model.ring.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.16;
        const kanji = data.kanjiByChar.get(node.ch);
        const meaning = language === "mn" ? (kanji?.mn?.[0] ?? "") : (kanji?.en?.[0] ?? "");
        return { ...node, x: 450 + Math.cos(angle) * 340, y: 280 + Math.sin(angle) * 205, meaning };
      })
    : [];

  if (loadError) {
    return <ErrorBox error={loadError} lang={language} retry={() => setLoadAttempt((attempt) => attempt + 1)} />;
  }
  if (!data) return <Spinner label={t.wordNetworkLoading} lang={language} />;

  const centerMeaning = model?.kanji
    ? (language === "mn" ? (model.kanji.mn?.[0] || MN_PENDING) : (model.kanji.en?.[0] ?? ""))
    : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-w-0 p-0">
        <div className="border-b border-sumi-900/8 px-5 py-4">
          <SectionTitle jp="単語ネットワーク" title={t.wordNetworkTitle} sub={t.wordNetworkSubtitle} />
        </div>

        {model && (
          <div className="grid-paper overflow-x-auto p-3 sm:p-4">
            <svg viewBox="0 0 900 560" role="img" aria-label={t.wordNetworkTitle} className="block h-auto w-full min-w-[740px]">
              <title>{t.wordNetworkTitle}</title>

              {/* Center-to-word links: the central kanji appears in each word. */}
              {wordNodes.map(({ word, x, y }) => (
                <line key={`center-${word.id}`} x1={450} y1={280} x2={x} y2={y}
                  stroke="rgba(204,70,48,0.34)" strokeWidth={2} />
              ))}

              {/* Word-to-kanji links expose the actual shared components, not just a star chart. */}
              {wordNodes.flatMap(({ word, x, y }) =>
                kanjiNodes.filter((node) => word.kd.includes(node.ch)).map((node) => (
                  <line key={`${word.id}-${node.ch}`} x1={x} y1={y} x2={node.x} y2={node.y}
                    stroke="rgba(28,27,24,0.16)" strokeWidth={1.4} strokeDasharray="4 4" />
                )),
              )}

              {/* Connected kanji */}
              {kanjiNodes.map((node) => {
                const accessibleName = `${node.ch} — ${node.count}`;
                return (
                  <a key={node.ch} href={href("kanji", node.ch)} aria-label={accessibleName}>
                    <title>{accessibleName}</title>
                    <circle cx={node.x} cy={node.y} r={30} fill="#fff" stroke="rgba(28,27,24,0.2)" strokeWidth={1.5} />
                    <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central"
                      fill="#1c1b18" fontSize={24} fontWeight={700}>{node.ch}</text>
                    <text x={node.x} y={node.y + 43} textAnchor="middle"
                      fill="#78736a" fontSize={11} fontWeight={600}>{node.meaning.slice(0, 10)}</text>
                    <text x={node.x} y={node.y + 57} textAnchor="middle"
                      fill="#78736a" fontSize={9.5}>{node.count}</text>
                  </a>
                );
              })}

              {/* Words in the middle ring */}
              {wordNodes.map(({ word, x, y }) => (
                <a key={word.id} href={href("vocab", word.id)} aria-label={`${word.w} — ${word.r}`}>
                  <title>{`${word.w}（${word.r}）: ${vocabMeaning(word, language)}`}</title>
                  <rect x={x - 48} y={y - 17} width={96} height={34} rx={9}
                    fill="#fff" stroke="rgba(204,70,48,0.48)" strokeWidth={1.5} />
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                    fill="#ac3622" fontSize={14} fontWeight={700}>
                    {word.w.length > 5 ? `${word.w.slice(0, 4)}…` : word.w}
                  </text>
                </a>
              ))}

              {/* Center kanji */}
              <circle cx={450} cy={280} r={52} fill="#1c1b18" />
              <text x={450} y={280} textAnchor="middle" dominantBaseline="central"
                fill="#fcfaf5" fontSize={46} fontWeight={700}>{center}</text>
              <text x={450} y={351} textAnchor="middle" fill="#78736a" fontSize={12} fontWeight={700}>
                {centerMeaning.slice(0, 18)}
              </text>
            </svg>
          </div>
        )}

        {model && (
          <div className="border-t border-sumi-900/8 p-4 sm:p-5">
            <p className="text-[12.5px] font-bold text-sumi-700">
              {center && t.wordsWithTitle2(center, model.words.length)}
            </p>
            <p className="mt-1 text-[11.5px] leading-5 text-sumi-500">{t.wordNetworkRelationNote}</p>
            {model.words.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {model.words.map((word) => {
                  const quality = MQ_LABEL[language][word.mq] ?? MQ_LABEL[language].none;
                  return (
                    <a key={word.id} href={href("vocab", word.id)}
                      className="card-flat flex min-w-0 items-center gap-3 px-3 py-2.5 transition hover:border-shu-300">
                      <span className="shrink-0 font-jp text-[15px] font-bold">{word.w}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-sumi-600">{vocabMeaning(word, language)}</span>
                        <span className="block truncate text-[10.5px] text-sumi-400">{word.r}</span>
                        {word.mq !== "curated" && (
                          <span className="mt-1 inline-flex"><Chip tone={quality.tone}>{quality.text}</Chip></span>
                        )}
                      </span>
                      <LevelBadge level={word.lvl} size="sm" />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-sumi-500">{t.noWords}</p>
            )}
          </div>
        )}
      </Card>

      <Card className="min-w-0">
        <p className="text-[13px] font-extrabold">{t.kanjiPickTitle}</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.kanjiOrMeaningPh}
          aria-label={t.kanjiPickTitle}
          className="mt-2.5 h-11 w-full rounded-xl border border-sumi-900/12 bg-white px-3 text-[13px] font-semibold outline-none focus:border-shu-400"
        />
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {suggestions.map((ch) => {
            const kanji = data.kanjiByChar.get(ch);
            const meaning = language === "mn"
              ? (kanji?.mn?.[0] ?? "")
              : (kanji?.en?.[0] ?? "");
            return (
              <button
                key={ch}
                type="button"
                title={meaning}
                aria-label={meaning ? `${ch}: ${meaning}` : ch}
                aria-pressed={ch === center}
                onClick={() => setCenter(ch)}
                className={cn(
                  "grid min-h-11 min-w-11 aspect-square place-items-center rounded-lg font-mincho text-[17px] font-bold transition",
                  ch === center ? "bg-shu-500 text-white" : "bg-white/70 text-sumi-700 hover:bg-white",
                )}
              >
                {ch}
              </button>
            );
          })}
        </div>

        {model?.kanji && center && (
          <>
            <div className="mt-5 border-t border-sumi-900/8 pt-4">
              <div className="flex items-center gap-3">
                <span className="font-mincho text-[2.4rem] font-bold leading-none">{center}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold">{language === "mn"
                    ? (model.kanji.mn.join(", ") || MN_PENDING)
                    : model.kanji.en.join(", ")}</p>
                  <p className="mt-0.5 text-[11.5px] text-sumi-500">
                    {t.strokesSub2(model.kanji.s ?? 0, "")} · {model.kanji.lvl}
                  </p>
                </div>
                <SpeakButton text={center} className="ml-auto" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {model.kanji.on.slice(0, 3).map((reading) => <Chip key={`on-${reading}`} tone="shu">音 {reading}</Chip>)}
                {model.kanji.kun.slice(0, 3).map((reading) => <Chip key={`kun-${reading}`} tone="ai">訓 {reading}</Chip>)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={href("kanji", center)} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">{t.kanjiDetailLink}</a>
                <a href={href("write", center)} className="text-[12.5px] font-bold text-shu-600 underline underline-offset-4">{t.writePracticeLink}</a>
              </div>
            </div>

            <div className="mt-5 border-t border-sumi-900/8 pt-4">
              <p className="text-[12.5px] font-extrabold">{t.mnemonicTitle}</p>
              <textarea
                value={memoryNote}
                onChange={(event) => setMemoryNote(event.target.value)}
                onBlur={() => actions.setMnemonic(center, memoryNote)}
                rows={3}
                aria-label={t.mnemonicTitle}
                placeholder={t.mnemonicPh2}
                className="mt-2.5 min-h-24 w-full resize-y rounded-xl border border-sumi-900/12 bg-white px-3 py-2.5 text-[12.5px] leading-5 outline-none focus:border-shu-400"
              />
              <p className="mt-1.5 text-[11px] leading-5 text-sumi-400">{t.mnemonicNote}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export type { Vocab, Kanji };
