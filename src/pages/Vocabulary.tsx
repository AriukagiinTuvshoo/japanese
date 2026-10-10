import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadVocab } from "../lib/data";
import type { Level, PosType, Vocab } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL, MQ_LABEL, TYPE_LABEL, toRomaji } from "../lib/text";
import { ui, vocabMeaning } from "../lib/i18n";
import { topicLabel, entryTopics, type Topic } from "../lib/categories";
import { cardStage, dueCards, retrievability } from "../lib/srs";
import {
  Bar, Button, Card, Chip, Empty, ErrorBox, Input, Pager, Select, SpeakButton, Spinner, Tabs,
} from "../components/ui";
import { SessionSetup } from "../components/Session";
import { WordNetwork } from "../components/WordNetwork";

const PER_PAGE = 60;

export default function Vocabulary() {
  const { query, set } = useQuery();
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const level = (query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);
  const tab = (query.tab as string) || "browse";

  const [words, setWords] = useState<Vocab[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState<PosType | "all">("all");
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [state, setState] = useState<"all" | "new" | "learning" | "review" | "mastered" | "fav">("all");
  const [sort, setSort] = useState<"level" | "freq" | "kana" | "random">("level");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setWords(null);
    setError(null);
    loadVocab(level).then(value => { if (active) setWords(value); })
      .catch(err => { if (active) setError(err); });
    setPage(1);
    return () => { active = false; };
  }, [level, attempt]);

  const filtered = useMemo(() => {
    if (!words) return [];
    let out = words;
    const needle = q.trim().toLowerCase();
    if (needle) {
      const kana = needle;
      out = out.filter((v) =>
        v.w.includes(needle) || v.r.includes(kana) || v.rm.includes(needle) ||
        v.en.some((e) => e.toLowerCase().includes(needle)) ||
        v.mn?.some((m) => m.toLowerCase().includes(needle)) ||
        toRomaji(v.r).includes(needle),
      );
    }
    if (type !== "all") out = out.filter((v) => v.t === type);
    if (topic !== "all") out = out.filter((v) => (topic === "unclassified" ? entryTopics(v).length === 0 : entryTopics(v).includes(topic)));
    if (state !== "all") {
      out = out.filter((v) => {
        if (state === "fav") return doc.favorites.includes(v.id);
        const c = doc.srs[v.id];
        if (state === "new") return !c || c.ph === "new";
        if (state === "learning") return c && (c.ph === "learning" || c.ph === "relearn");
        if (state === "review") return c && c.ph === "review";
        return c && c.st >= 21;
      });
    }
    if (sort === "random") out = out.slice().sort(() => Math.random() - 0.5);
    else if (sort === "kana") out = out.slice().sort((a, b) => a.r.localeCompare(b.r, "ja"));
    return out;
  }, [words, q, type, topic, state, sort, doc.srs, doc.favorites]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const levelDue = useMemo(
    () => (words ? dueCards(doc.srs).filter(([id]) => words.some((w) => w.id === id)).length : 0),
    [words, doc.srs],
  );

  const typeCounts = useMemo(() => {
    if (!words) return {};
    const m: Record<string, number> = {};
    for (const w of words) m[w.t] = (m[w.t] ?? 0) + 1;
    return m;
  }, [words]);
  const topicCounts = useMemo(() => {
    const m: Partial<Record<Topic, number>> = {};
    for (const w of words ?? []) for (const key of entryTopics(w)) m[key] = (m[key] ?? 0) + 1;
    return m;
  }, [words]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">単語帳</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.vocab}</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            {LEVEL_LABEL[language][level]} ({level}) · {words ? `${words.length.toLocaleString()} ${t.wordsUnit}` : "…"}
            {levelDue > 0 && <> · <span className="font-bold text-shu-600">{levelDue} {t.toReview}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`review?level=${level}`)}>復 {t.reviewBtn}</Button>
          <Button onClick={() => set({ tab: "learn" })}>語 {t.learnBtn}</Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={(v) => set({ tab: v })}
        items={[
          { id: "browse", label: t.listTab, icon: "一", badge: filtered.length || undefined },
          { id: "learn", label: t.learnTab, icon: "学" },
          { id: "network", label: t.networkTab, icon: "網" },
          { id: "stats", label: t.statsTab, icon: "統" },
        ]}
      />

      {tab === "learn" && <SessionSetup kind="vocab" level={level} />}

      {tab === "network" && <WordNetwork level={level} />}

      {tab === "stats" && words && <LevelStats words={words} />}

      {tab === "browse" && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t.searchIn} icon="🔎" className="min-w-[220px] flex-1" />
              <Select
                value={sort}
                onChange={(v) => setSort(v)}
                options={[
                  { id: "level", label: t.sortSource },
                  { id: "kana", label: t.sortKana },
                  { id: "random", label: t.sortRandom },
                ]}
              />
              <Select
                value={state}
                onChange={(v) => { setState(v); setPage(1); }}
                options={[
                  { id: "all", label: t.stateAll },
                  { id: "new", label: t.stateNew },
                  { id: "learning", label: t.stateLearning },
                  { id: "review", label: t.stateReview },
                  { id: "mastered", label: t.stateMastered },
                  { id: "fav", label: t.stateFav },
                ]}
              />
            </div>

            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => { setType("all"); setPage(1); }}
                className={cn("min-h-11 sm:min-h-0 shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                  type === "all" ? "bg-sumi-900 text-washi-50" : "bg-sumi-900/5 text-sumi-600 hover:text-sumi-900")}
              >
                {t.all} {words?.length ?? 0}
              </button>
              {(Object.keys(TYPE_LABEL[language]) as PosType[]).filter((k) => typeCounts[k]).map((k) => (
                <button
                  key={k}
                  onClick={() => { setType(k); setPage(1); }}
                  className={cn("min-h-11 sm:min-h-0 shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                    type === k ? "bg-sumi-900 text-washi-50" : "bg-sumi-900/5 text-sumi-600 hover:text-sumi-900")}
                >
                  {TYPE_LABEL[language][k]} <span className="tabnum opacity-60">{typeCounts[k]}</span>
                </button>
              ))}
            </div>
            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto border-t border-sumi-900/8 pt-3" aria-label={t.filterByTopic}>
              <button onClick={() => { setTopic("all"); setPage(1); }}
                className={cn("min-h-11 sm:min-h-0 shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition", topic === "all" ? "bg-shu-500 text-white" : "bg-shu-50 text-shu-700")}>
                {t.allTopics}
              </button>
              {(words ?? []).some(e => entryTopics(e).length === 0) && (
                <button aria-pressed={topic === "unclassified"} onClick={() => { setTopic("unclassified"); setPage(1); }} className="min-h-11 sm:min-h-0 shrink-0 rounded-lg bg-kin-50 px-3 py-2 text-xs font-bold text-kin-700">
                  {t.unclassifiedTopic} {(words ?? []).filter(e => entryTopics(e).length === 0).length}
                </button>
              )}
              {(Object.keys(topicLabel[language]) as Topic[]).filter((key) => topicCounts[key]).map((key) => (
                <button key={key} aria-pressed={topic === key} onClick={() => { setTopic(key); setPage(1); }}
                  className={cn("min-h-11 sm:min-h-0 shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition", topic === key ? "bg-shu-500 text-white" : "bg-sumi-900/5 text-sumi-600 hover:text-sumi-900")}>
                  {topicLabel[language][key]} <span className="tabnum opacity-60">{topicCounts[key]}</span>
                </button>
              ))}
            </div>
          </Card>

          {error != null && <ErrorBox error={error} lang={language} retry={() => setAttempt(n => n + 1)} />}
          {!error && !words && <Spinner label={t.loadingVocab} />}

          {words && shown.length === 0 && (
            <Empty icon="無" title={t.noResults} sub={t.noResultsSub} />
          )}

          {shown.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((v) => <WordRow key={v.id} v={v} />)}
            </div>
          )}

          <Pager page={page} pages={pages} onPage={setPage} />
          {pages > 1 && <p className="text-center text-[12px] text-sumi-400">{t.totalWords(filtered.length.toLocaleString())}</p>}
        </>
      )}
    </div>
  );
}

export function WordRow({ v }: { v: Vocab }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const card = doc.srs[v.id];
  const stage = cardStage(card);
  const fav = doc.favorites.includes(v.id);
  const mq = MQ_LABEL[language][v.mq];

  return (
    <div className="card-flat group relative flex items-start gap-3 p-3.5 transition hover:-translate-y-0.5 hover:border-shu-300">
      <a href={href("vocab", v.id)} className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-jp text-[20px] font-bold leading-tight text-sumi-900">{v.w}</span>
          <span className="truncate font-jp text-[11.5px] text-sumi-500">{v.r !== v.w ? v.r : ""}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-sumi-700">
          <span className={!v.mn?.length && language === "mn" ? "text-kin-600" : undefined}>{vocabMeaning(v, language)}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip tone="sumi" className="!px-1.5 !py-0.5 !text-[10px]">{TYPE_LABEL[language][v.t]}</Chip>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            stage.tone === "matcha" ? "bg-matcha-50 text-matcha-600"
              : stage.tone === "ai" ? "bg-ai-50 text-ai-600"
                : stage.tone === "kin" ? "bg-kin-50 text-kin-600" : "bg-sumi-900/5 text-sumi-500")}>
            {language === "en" ? stage.en : stage.mn}
          </span>
          {v.tier !== "jlpt" && <Chip tone="kin" className="!px-1.5 !py-0.5 !text-[10px]" title={t.extendedTip}>{t.extended}</Chip>}
        </div>
      </a>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <SpeakButton text={v.w} className="!h-11 !w-11 sm:!h-7 sm:!w-7" lang={language} />
        <button
          onClick={() => actions.toggleFavorite(v.id)}
          className={cn("grid h-7 w-7 place-items-center rounded-lg border text-[13px] transition",
            fav ? "border-kin-200 bg-kin-50 text-kin-500" : "border-sumi-900/10 bg-white/70 text-sumi-300 hover:text-kin-500")}
          title={t.favAdd}
        >
          ★
        </button>
        {!card && (
          <button
            onClick={() => actions.grade(v.id, 2, { isNew: true })}
            className="grid h-7 w-7 place-items-center rounded-lg border border-sumi-900/10 bg-white/70 text-[13px] text-sumi-400 transition hover:border-matcha-400 hover:text-matcha-600"
            title={t.srsAdd}
          >
            +
          </button>
        )}
      </div>
      {mq.tone !== "matcha" && (
        <span
          className={cn("absolute right-0 top-0 h-1.5 w-1.5 rounded-full",
            mq.tone === "kin" ? "bg-kin-400" : "bg-sumi-300")}
          title={mq.text}
        />
      )}
    </div>
  );
}

function LevelStats({ words }: { words: Vocab[] }) {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const stats = useMemo(() => {
    let fresh = 0, learning = 0, review = 0, mastered = 0, mature = 0;
    let mnCurated = 0, mnAuto = 0, mnNone = 0;
    let retSum = 0, retN = 0;
    for (const v of words) {
      const c = doc.srs[v.id];
      if (v.mq === "curated") mnCurated++;
      else if (v.mq === "none") mnNone++;
      else mnAuto++;
      if (!c || c.ph === "new") fresh++;
      else if (c.ph === "learning" || c.ph === "relearn") learning++;
      else if (c.st >= 21) { mastered++; mature++; }
      else review++;
      if (c && c.n > 0) { retSum += retrievability(c); retN++; }
    }
    return { fresh, learning, review, mastered, mature, mnCurated, mnAuto, mnNone, retention: retN ? retSum / retN : 0 };
  }, [words, doc.srs]);

  const total = words.length;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <p className="text-[13.5px] font-extrabold">{t.studyStatus}</p>
        <div className="mt-4 space-y-3.5">
          {[
            { l: t.freshRow, v: stats.fresh, tone: "sumi" as const },
            { l: t.learningRow, v: stats.learning, tone: "kin" as const },
            { l: t.reviewRow, v: stats.review, tone: "ai" as const },
            { l: t.masteredRow, v: stats.mastered, tone: "matcha" as const },
          ].map((r) => (
            <div key={r.l}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-sumi-700">{r.l}</span>
                <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">{r.v.toLocaleString()} · {Math.round((r.v / total) * 100)}%</span>
              </div>
              <Bar value={r.v / total} tone={r.tone} className="mt-1.5" height={7} />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-sumi-900/4 px-3.5 py-3 text-[12.5px] text-sumi-600">
          {t.avgRet} <strong className="font-mono tabnum">{Math.round(stats.retention * 100)}%</strong>
        </div>
      </Card>

      <Card>
        <p className="text-[13.5px] font-extrabold">{t.mnStatusTitle}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sumi-500">
          {t.mnPolicy}
        </p>
        <div className="mt-4 space-y-3">
          {[
            { l: t.rowCurated, v: stats.mnCurated, tone: "matcha" as const },
            { l: t.rowAuto, v: stats.mnAuto, tone: "kin" as const },
            { l: t.rowNone, v: stats.mnNone, tone: "sumi" as const },
          ].map((r) => (
            <div key={r.l}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-sumi-700">{r.l}</span>
                <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">{r.v.toLocaleString()}</span>
              </div>
              <Bar value={r.v / total} tone={r.tone} className="mt-1.5" height={7} />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-ai-100 bg-ai-50/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-ai-700">
          {t.improvePre}<a href={href("admin")} className="font-bold underline underline-offset-4">{t.improveLink}</a>{t.improvePost}
        </div>
      </Card>
    </div>
  );
}

/** Түвшний бүх үгийг SRS-д бөөнөөр нэмэх. */
export function BulkAdd({ words, level }: { words: Vocab[]; level: Level }) {
  const { actions, doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const missing = words.filter((w) => !doc.srs[w.id]);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!missing.length}
      onClick={() => {
        const first = missing.slice(0, doc.profile.newPerDay * 3);
        first.forEach((w) => actions.grade(w.id, 2, { isNew: true }));
        navigate(`review?level=${level}`);
      }}
    >
      {t.bulkAdd(Math.min(missing.length, doc.profile.newPerDay * 3))}
    </Button>
  );
}

export { LEVELS };
