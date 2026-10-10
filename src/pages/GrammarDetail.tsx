import { useEffect, useMemo, useState } from "react";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadGrammar } from "../lib/data";
import type { Grammar, Level } from "../lib/types";
import { grammarLabel, LEVEL_LABEL, stripFurigana } from "../lib/text";
import { Button, Card, Chip, Empty, Furigana, LevelBadge, SectionTitle, SpeakButton, Spinner, Tabs } from "../components/ui";
import { MN_PENDING, grammarEn, grammarMnMissing, ui } from "../lib/i18n";

// Хэлбэр, хэрэглээний ялгааг нь жишээгээр нягталсан ойролцоо дүрмүүд.
const VERIFIED_RELATED_GRAMMAR: Record<string, string[]> = {
  "ni-saishite": ["ni-atatte", "ni-sakidatte"],
  "ni-atatte": ["ni-saishite", "ni-sakidatte"],
  "ni-sakidatte": ["ni-saishite", "ni-atatte"],
};

function grammarFurigana(text: string, grammar: Grammar): string {
  const readings = new Map<string, string>();
  for (const example of grammar.ex) {
    for (const match of (example.fg ?? "").matchAll(/\{([^|{}]+)\|([^{}]+)\}/g)) {
      if (!match[2].startsWith("#") && !readings.has(match[1])) readings.set(match[1], match[2]);
    }
  }
  const alternatives = [...readings.entries()].sort(([a], [b]) => b.length - a.length);
  return text.split(/(\{[^{}]+\})/g).map((part) => {
    if (part.startsWith("{") && part.endsWith("}")) return part;
    let result = "";
    for (let i = 0; i < part.length;) {
      const match = alternatives.find(([base]) => part.startsWith(base, i));
      if (match) {
        const [base, reading] = match;
        result += "{" + base + "|" + reading + "}";
        i += base.length;
      } else {
        result += part[i];
        i += 1;
      }
    }
    return result;
  }).join("");
}

function conciseMeaning(value: string): string {
  // Олон MN мөрийн `:`-ийн дараах хэсэг нь өмнөх утгаа placeholder-оор давтан хэлдэг.
  return value.split(":", 1)[0].trim() || value;
}

/** `level` (жишээ: `#/grammar/ni-saishite?level=N2`) байвал эхлээд тэр түвшинг хайна. */
export default function GrammarDetail({ id, level }: { id: string; level?: Level }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [items, setItems] = useState<Grammar[] | null>(null);
  const [tab, setTab] = useState<"detail" | "compare" | "examples">("detail");
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setTab("detail");
    (async () => {
      const order: Level[] = ["N5", "N4", "N3", "N2", "N1"];
      const hinted = level ? [level, ...order.filter((l) => l !== level)] : order;
      for (const l of hinted) {
        const list = await loadGrammar(l);
        if (cancelled) return;
        if (list.some((g) => g.id === id)) { setItems(list); return; }
      }
      if (!cancelled) setItems([]);
    })();
    return () => { cancelled = true; };
  }, [id, level]);

  const g = items?.find((x) => x.id === id);
  const done = doc.grammarDone.includes(id);
  const currentIndex = items?.findIndex((item) => item.id === id) ?? -1;
  const previous = currentIndex > 0 ? items?.[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 && currentIndex < (items?.length ?? 0) - 1 ? items?.[currentIndex + 1] : undefined;

  const similar = useMemo(() => {
    if (!g || !items) return [];
    const ids = [...g.related, ...(VERIFIED_RELATED_GRAMMAR[g.id] ?? [])];
    return [...new Set(ids)]
      .map((relatedId) => items.find((item) => item.id === relatedId))
      .filter((item): item is Grammar => Boolean(item && item.id !== g.id))
      .slice(0, 6);
  }, [g, items]);

  if (!items) return <Spinner label={t.loadingGrammar} lang={language} />;
  if (!g) return <Empty icon="無" title={t.grammarNotFound} sub={id} action={<Button onClick={() => navigate("grammar")}>← {t.grammar}</Button>} />;

  const en = Array.isArray(g.en) ? g.en.join("; ") : String(g.en ?? "");
  const meaning = language === "mn" && g.mn ? conciseMeaning(g.mn) : en;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(`grammar?level=${g.lvl}`)}>← {t.grammar}</Button>
        <span className="text-[12px] text-sumi-400">{LEVEL_LABEL[language][g.lvl]} ({g.lvl})</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={done ? "soft" : "outline"} onClick={() => actions.toggleGrammar(g.id, g.lvl)}>
            {done ? t.seenBtn : t.markSeen}
          </Button>
          <Button size="sm" onClick={() => navigate(`quiz?mode=grammar-use&level=${g.lvl}`)}>{t.practiceBtn}</Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-sumi-900/8 bg-white/65 px-3 py-2">
        {previous ? (
          <a href={href(`grammar?level=${previous.lvl}`, previous.id)} className="inline-flex h-8 items-center rounded-lg border border-sumi-900/12 px-3 text-[12px] font-bold text-sumi-700 hover:bg-sumi-900/5">
            ← {language === "mn" ? "Өмнөх дүрэм" : "Previous grammar"}
          </a>
        ) : <Button size="sm" variant="outline" disabled>← {language === "mn" ? "Өмнөх дүрэм" : "Previous grammar"}</Button>}
        <span className="shrink-0 text-[12px] font-semibold tabnum text-sumi-500">{currentIndex + 1} / {items.length}</span>
        {next ? (
          <a href={href(`grammar?level=${next.lvl}`, next.id)} className="inline-flex h-8 items-center rounded-lg border border-sumi-900/12 px-3 text-[12px] font-bold text-sumi-700 hover:bg-sumi-900/5">
            {language === "mn" ? "Дараагийн дүрэм" : "Next grammar"} →
          </a>
        ) : <Button size="sm" variant="outline" disabled>{language === "mn" ? "Дараагийн дүрэм" : "Next grammar"} →</Button>}
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge level={g.lvl} />
          <Chip tone="murasaki">{t.grammarChip}</Chip>
          {g.jlpt !== g.lvl && <Chip tone="sumi">JLPT {g.jlpt}</Chip>}
        </div>
        <h1 className="mt-4 font-jp text-[2.1rem] font-extrabold leading-tight">
          <Furigana text={grammarFurigana(grammarLabel(g.p, language), g)} show />
        </h1>
        {language === "en" || g.mn ? (
          <p className="mt-4 text-[1.15rem] font-bold leading-relaxed text-sumi-900">{meaning}</p>
        ) : (
          <p className="mt-4 text-[1.1rem] font-semibold text-sumi-500">
            <span className="italic">{MN_PENDING}</span>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`quiz?mode=grammar-mn&level=${g.lvl}`)}>{t.meaningDrill}</Button>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={[
        { id: "detail", label: t.usageTab, icon: "用" },
        { id: "examples", label: t.examplesTab2, icon: "例", badge: g.ex.length || undefined },
        { id: "compare", label: t.compareTab, icon: "比", badge: similar.length || undefined },
      ]} />

      {tab === "detail" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle jp="形" title={t.structure} />
            {g.form ? (
              <p className="rounded-xl bg-sumi-900/[0.045] px-4 py-3 font-jp text-[14px] leading-relaxed">
                <Furigana text={grammarFurigana(language === "mn" && g.form_mn ? g.form_mn : g.form, g)} show />
              </p>
            ) : (
              <p className="text-[13px] text-sumi-500">{t.structureMissing}</p>
            )}
            <div className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between border-b border-sumi-900/6 pb-2.5">
                <span className="font-bold text-sumi-500">{t.levelRow}</span>
                <span className="font-semibold">{g.lvl} — {LEVEL_LABEL[language][g.lvl]}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "examples" && (
        <Card>
          <SectionTitle jp="例文" title={t.examplesTitle} />
          {g.ex.length === 0 ? <Empty icon="例" title={t.noExamples} /> : (
            <ul className="space-y-3">
              {g.ex.map((e, i) => (
                <li key={i} className="rounded-xl border border-sumi-900/8 bg-white/60 p-4">
                  <div className="flex items-start gap-3">
                    <Furigana text={e.fg ?? e.ja ?? ""} show className="flex-1 text-[16px] font-semibold leading-relaxed" />
                    {e.ja && <SpeakButton text={stripFurigana(e.ja)} />}
                  </div>
                  {language === "mn" && e.mn && <p className="mt-2 text-[13.5px] font-semibold text-sumi-800">{t.mnColon} {e.mn}</p>}
                  {e.en && <p className="mt-1 text-[12.5px] text-sumi-500">{language === "mn" ? <>{t.enLabel} {e.en}</> : e.en}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "compare" && (
        <Card>
          <SectionTitle jp="比較" title={t.compareTitle} sub={t.compareSub} />
          {similar.length === 0 ? <Empty icon="比" title={t.compareNotFound} /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {similar.map((s) => (
                <a key={s.id} href={href(`grammar?level=${s.lvl}`, s.id)} className="card-flat p-4 transition hover:-translate-y-0.5 hover:border-shu-300">
                  <div className="flex items-center gap-2">
                    <Furigana text={grammarFurigana(s.p, s)} show className="text-[15px] font-bold" />
                    <LevelBadge level={s.lvl} size="sm" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-sumi-700">
                    {language === "en"
                      ? (grammarEn(s) || s.mn || MN_PENDING)
                      : (s.mn ? conciseMeaning(s.mn) : <span className="italic text-sumi-400">{MN_PENDING}</span>)}
                  </p>
                  {language === "mn" && grammarMnMissing(s) && grammarEn(s) && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-sumi-400">
                      {t.enLabel} {grammarEn(s)}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
