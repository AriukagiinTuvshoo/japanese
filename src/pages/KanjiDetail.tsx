import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData, loadStrokes } from "../lib/data";
import type { Kanji, StrokeMap } from "../lib/types";
import { LEVEL_LABEL, MQ_LABEL } from "../lib/text";
import { GRADES, cardStage, previewIntervals } from "../lib/srs";
import { Bar, Button, Card, Chip, Empty, LevelBadge, SectionTitle, SpeakButton, Spinner, Tabs } from "../components/ui";
import { ui, MN_PENDING, vocabMeaning } from "../lib/i18n";
import { StrokePad } from "../components/StrokePad";

const TABS = [
  { id: "overview", label: "Тойм", icon: "要" },
  { id: "write", label: "Бичих дасгал", icon: "筆" },
  { id: "words", label: "Үгс", icon: "語" },
  { id: "source", label: "Эх сурвалж", icon: "元" },
] as const;

const TAB_KEYS = { overview: "overviewTab", write: "writeTab", words: "wordsTab", source: "sourceTab" } as const;

export default function KanjiDetail({ char }: { char: string }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [data, setData] = useState<Awaited<ReturnType<typeof loadFullData>> | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [mnemonic, setMnemonic] = useState("");

  const k: Kanji | undefined = data?.kanjiByChar.get(char);
  const [paths, setPaths] = useState<string[] | null>(null);

  useEffect(() => {
    loadFullData().then(setData);
  }, [char]);

  useEffect(() => {
    if (!k) return;
    loadStrokes(k.lvl).then((m: StrokeMap) => setPaths(m[char] ?? null));
  }, [k, char]);

  useEffect(() => { setMnemonic(doc.mnemonics[char] ?? ""); }, [char, doc.mnemonics]);

  const card = doc.srs[char];
  const stage = cardStage(card);
  const previews = useMemo(() => previewIntervals(card, language), [card, language]);
  const words = useMemo(() => data?.wordsByKanji.get(char) ?? [], [data, char]);

  if (!data) return <Spinner label={t.loadingKanji} />;
  if (!k) {
    return <Empty icon="無" title={t.kanjiNotFound} sub={char}
      action={<Button onClick={() => navigate("kanji")}>{t.backToKanjiList}</Button>} />;
  }
  const mq = MQ_LABEL[language][k.mq];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(`kanji?level=${k.lvl}`)}>← {t.kanji}</Button>
        <span className="text-[12px] text-sumi-400">{LEVEL_LABEL[language][k.lvl]} ({k.lvl})</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTab("write")}>{t.writeBtn}</Button>
          <Button size="sm" onClick={() => actions.grade(char, 2, { isNew: !card, level: k.lvl })}>
            {card ? t.reviewKanjiBtn : t.addSrsBtn}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[380px_1fr]">
          <div className="grid-paper flex items-center justify-center border-b border-sumi-900/8 p-8 lg:border-b-0 lg:border-r">
            <div className="text-center">
              <span className="font-mincho text-[9rem] font-bold leading-none text-sumi-900">{char}</span>
              <p className="mt-4 font-mono text-[12.5px] text-sumi-500">
                U+{(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")} · {t.strokesN(k.s ?? "?")}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={k.lvl} />
              {k.g && <Chip tone="ai">{t.joyouGrade(k.g)}</Chip>}
              {k.f && <Chip tone="sumi">{t.freqN(k.f)}</Chip>}
              {k.lvlSrc === "derived" && <Chip tone="kin">{t.levelFromKanjiChip}</Chip>}
              <Chip tone={mq.tone}>{mq.text}</Chip>
            </div>

            <h1 className="mt-4 text-[1.5rem] font-extrabold leading-snug">
              {language === "en" ? (k.en.join(", ") || k.mn.join(", ")) : (k.mn.join(", ") || MN_PENDING)}
            </h1>
            {language === "mn" && k.mn.length > 0 && <p className="mt-1 text-[13px] text-sumi-500">{t.enLabel} {k.en.join(", ")}</p>}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sumi-400">音読み · On</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {k.on.length ? k.on.map((r) => <Chip key={r} tone="shu" className="!text-[12px]">{r}</Chip>) : <span className="text-[13px] text-sumi-400">—</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sumi-400">{t.kunLabel}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {k.kun.length ? k.kun.map((r) => <Chip key={r} tone="ai" className="!text-[12px]">{r}</Chip>) : <span className="text-[13px] text-sumi-400">—</span>}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <SpeakButton text={char} rate={doc.profile.rate} className="!h-10 !w-10" />
              {k.on[0] && <SpeakButton text={k.on[0]} rate={doc.profile.rate} className="!h-10 !w-auto !px-3" label={`🔊 ${k.on[0]}`} />}
              {k.kun[0] && <SpeakButton text={k.kun[0].replace(/[.()]/g, "")} rate={doc.profile.rate} className="!h-10 !w-auto !px-3" label={`🔊 ${k.kun[0].replace(/[.()]/g, "")}`} />}
              {k.rad && <Chip tone="murasaki">{t.radicalLabel} <span className="font-mincho text-[14px]">{k.rad}</span></Chip>}
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={TABS.map((tb) => ({ ...tb, label: t[TAB_KEYS[tb.id]], badge: tb.id === "words" ? words.length || undefined : undefined }))} />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <SectionTitle jp="書き順" title={t.strokeOrderTitle} sub={t.strokeOrderSub} />
            {paths ? (
              <StrokeOrderDiagram paths={paths} />
            ) : (
              <Empty icon="筆" title={t.strokeOrderMissing} sub={t.strokeOrderMissingSub} />
            )}
          </Card>

          <div className="space-y-5">
            <Card>
              <p className="text-[13px] font-extrabold">{t.srsStatus}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className={cn("text-[13px] font-extrabold",
                  stage.tone === "matcha" ? "text-matcha-600" : stage.tone === "ai" ? "text-ai-600" : stage.tone === "kin" ? "text-kin-600" : "text-sumi-500")}>
                  {language === "en" ? stage.en : stage.mn}
                </span>
                <span className="font-mono text-[12px] text-sumi-500">{card ? t.stableDaysN(card.st.toFixed(1)) : "—"}</span>
              </div>
              <Bar value={stage.pct / 100} tone={stage.tone as "matcha"} className="mt-2.5" height={6} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {GRADES.map((g, i) => (
                  <button key={g.g} onClick={() => actions.grade(char, g.g, { isNew: !card, level: k.lvl })}
                    className={cn("rounded-xl border px-2 py-2 text-center transition hover:-translate-y-0.5",
                      g.tone === "shu" ? "border-shu-100 bg-shu-50" : g.tone === "kin" ? "border-kin-100 bg-kin-50"
                        : g.tone === "matcha" ? "border-matcha-100 bg-matcha-50" : "border-ai-100 bg-ai-50")}>
                    <span className="block text-[12px] font-extrabold">{language === "en" ? g.en : g.mn}</span>
                    <span className="block font-mono text-[10px] text-sumi-500">{previews[i]?.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-[13px] font-extrabold">{t.mnemonicTitle}</p>
              {language === "mn" && k.mn_mem && (
                <p className="mt-2 rounded-xl bg-kin-50 px-3.5 py-3 text-[13px] leading-relaxed text-kin-700">{k.mn_mem}</p>
              )}
              <textarea value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} onBlur={() => actions.setMnemonic(char, mnemonic)}
                rows={3} placeholder={t.mnemonicPh2}
                className="mt-2.5 w-full resize-none rounded-xl border border-sumi-900/12 bg-white px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-shu-400" />
              <p className="mt-1.5 text-[11px] text-sumi-400">{t.autoSaved}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === "write" && (
        <Card>
          <SectionTitle jp="書き取り" title={t.writePracticeTitle} sub={t.writePracticeSub} />
          <StrokePad kanji={char} paths={paths ?? []} onResult={(r) => actions.recordWriting(char, r.score)} />
        </Card>
      )}

      {tab === "words" && (
        <Card>
          <SectionTitle jp="この漢字の単語" title={t.wordsWithTitle(char)} sub={t.wordsWithSub(words.length)} />
          {words.length === 0 ? <Empty icon="語" title={t.noWords} /> : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {words.map((w) => (
                <a key={w.id} href={href("vocab", w.id)} className="card-flat flex items-center gap-3 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-shu-300">
                  <span className="font-jp text-[15.5px] font-bold">{w.w}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-sumi-700">{vocabMeaning(w, language)}</span>
                    <span className="block font-jp text-[10.5px] text-sumi-400">{w.r}</span>
                  </span>
                  <LevelBadge level={w.lvl} size="sm" />
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "source" && (
        <Card>
          <SectionTitle jp="出典" title={t.sourceTab} />
          <div className="space-y-3 text-[13.5px]">
            <Row l={t.srcLib} v={k.src} />
            <Row l={t.levelDetBy} v={k.lvlSrc === "jlpt" ? t.levelByOpenjlpt : t.levelByKanjiData} />
            <Row l={t.licenseRow} v="MIT (kanji-data) · CC-BY-SA-4.0 (OpenJLPT) · CC-BY-SA-3.0 (KanjiVG)" />
            <Row l={t.strokeDataRow} v={paths ? t.strokesData(paths.length) : "—"} />
            <Row l={t.mqStatus} v={mq.text} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={href("about")} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">{t.allSourcesLink}</a>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sumi-900/6 pb-3 last:border-0">
      <span className="shrink-0 text-[12.5px] font-bold text-sumi-500">{l}</span>
      <span className="text-right font-semibold text-sumi-900">{v}</span>
    </div>
  );
}

/** Зурлагын дарааллын диаграм — зурлага бүрийг тусад нь тоогоор. */
export function StrokeOrderDiagram({ paths }: { paths: string[] }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {paths.map((d, i) => (
        <div key={i} className="rounded-xl border border-sumi-900/10 bg-white p-1">
          <svg viewBox="0 0 109 109" className="h-[68px] w-[68px]">
            <g fill="none" stroke="rgba(28,27,24,0.10)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
              {paths.slice(0, i).map((p, j) => <path key={j} d={p} />)}
            </g>
            <path d={d} fill="none" stroke="#cc4630" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="pb-0.5 text-center font-mono text-[10px] font-bold text-sumi-400">{i + 1}</p>
        </div>
      ))}
    </div>
  );
}
