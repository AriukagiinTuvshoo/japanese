import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData } from "../lib/data";
import type { Vocab } from "../lib/types";
import { MQ_LABEL, TYPE_LABEL, LEVEL_LABEL, stripFurigana, toRomaji } from "../lib/text";
import { GRADES, cardStage, previewIntervals, retrievability } from "../lib/srs";
import { MN_PENDING, ui } from "../lib/i18n";
import {
  Bar, Button, Card, Chip, Empty, Furigana, LevelBadge, SectionTitle, SpeakButton, Spinner, Tabs, speak,
} from "../components/ui";

export default function WordDetail({ id }: { id: string }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [data, setData] = useState<Awaited<ReturnType<typeof loadFullData>> | null>(null);
  const [tab, setTab] = useState<"overview" | "examples" | "network" | "source">("overview");
  const [mnemonic, setMnemonic] = useState("");

  useEffect(() => {
    loadFullData().then(setData);
  }, [id]);

  useEffect(() => {
    setMnemonic(doc.mnemonics[id] ?? "");
  }, [id, doc.mnemonics]);

  const v: Vocab | undefined = data?.byId.get(id);
  const card = doc.srs[id];
  const stage = cardStage(card);
  const previews = useMemo(() => previewIntervals(card, language), [card, language]);
  const mq = v ? MQ_LABEL[language][v.mq] : null;
  const fav = doc.favorites.includes(id);

  const related = useMemo(() => {
    if (!data || !v) return [];
    const out = new Map<string, Vocab>();
    for (const ch of v.kd) {
      for (const w of data.wordsByKanji.get(ch) ?? []) {
        if (w.id !== v.id && out.size < 18) out.set(w.id, w);
      }
    }
    return [...out.values()].sort((a, b) => a.lvl.localeCompare(b.lvl)).slice(0, 12);
  }, [data, v]);

  if (!data) return <Spinner label={t.loadingVocab} lang={language} />;
  if (!v) {
    return (
      <Empty
        icon="無"
        title={t.wordNotFound}
        sub={`ID: ${id}`}
        action={<Button onClick={() => navigate("vocab")}>{t.backToVocab}</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(`vocab?level=${v.lvl}`)}>{t.backToVocab}</Button>
        <span className="text-[12px] text-sumi-400">{LEVEL_LABEL[language][v.lvl]} ({v.lvl})</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant={fav ? "soft" : "outline"} onClick={() => actions.toggleFavorite(v.id)}>
            {fav ? t.favIn : t.favAdd2}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`write?level=${v.lvl}`)}>{t.writePractice}</Button>
          <Button size="sm" onClick={() => navigate(`review?level=${v.lvl}`)}>{t.review2}</Button>
        </div>
      </div>

      {v.source_issue && <p role="alert" className="rounded-xl bg-kin-50 p-4 text-sm text-kin-700">{t.sourceReviewWarning}</p>}

      {/* ── үндсэн карт ── */}
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={v.lvl} />
              <Chip tone="sumi">{TYPE_LABEL[language][v.t]}</Chip>
              {v.tier !== "jlpt" && <Chip tone="kin">{t.extChip}</Chip>}
              {v.pos.includes("vt") && <Chip tone="shu">{t.vtChip}</Chip>}
              {v.pos.includes("vi") && <Chip tone="ai">{t.viChip}</Chip>}
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-5">
              <div>
                <h1 className="font-jp text-[3.4rem] font-bold leading-none tracking-tight text-sumi-900">{v.w}</h1>
                <p className="mt-2.5 font-jp text-[17px] text-sumi-500">{v.r}</p>
                <p className="mt-1 font-mono text-[12.5px] text-sumi-400">{v.rm || toRomaji(v.r)}</p>
              </div>
              <div className="flex gap-2">
                <SpeakButton text={v.w} rate={doc.profile.rate} className="!h-11 !w-11 !text-[18px]" />
                <Button
                  variant="outline" size="md"
                  onClick={() => speak(v.w, Math.max(0.5, doc.profile.rate - 0.3))}
                >
                  {t.slow}
                </Button>
              </div>
            </div>

            <div className="mt-6 border-t border-sumi-900/8 pt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sumi-400">{t.meaningLabel}</p>
              {language === "en" ? (
                <p className="mt-2 text-[1.1rem] font-bold text-sumi-900">{v.en.join("; ")}</p>
              ) : v.mn?.length ? (
                <ul className="mt-2 space-y-1.5">
                  {v.mn.map((m, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[1.15rem] font-bold leading-snug text-sumi-900">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-shu-500" />{m}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-[1.1rem] font-bold text-kin-600">{MN_PENDING}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip tone={mq?.tone ?? "sumi"}>{mq?.text}</Chip>
                {v.mn?.length ? (
                  <span className="text-[12px] text-sumi-500">{t.enSrcRow} {v.en.join("; ")}</span>
                ) : (
                  <span className="text-[12px] text-sumi-500">
                    {t.mnPendingAdmin}
                    <a href={href("admin")} className="font-bold text-ai-600 underline underline-offset-4">{t.translateLink}</a>
                  </span>
                )}
              </div>
            </div>

            {v.kd.length > 0 && (
              <div className="mt-6 border-t border-sumi-900/8 pt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sumi-400">{t.composingKanji}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {v.kd.map((ch) => {
                    const k = data.kanjiByChar.get(ch);
                    return (
                      <a key={ch} href={href("kanji", ch)} className="card-flat flex items-center gap-3 px-3.5 py-2.5 transition hover:border-shu-300">
                        <span className="font-mincho text-[26px] font-bold leading-none text-sumi-900">{ch}</span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-bold text-sumi-800">
                            {language === "en" ? (k?.en.join(", ") || k?.mn?.join(", ") || "—") : (k?.mn?.join(", ") || k?.en.join(", ") || "—")}
                          </span>
                          <span className="block text-[10.5px] text-sumi-400">
                            音 {k?.on.slice(0, 2).join("・") || "—"} · 訓 {k?.kun.slice(0, 2).join("・") || "—"}
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── SRS самбар ── */}
          <div className="border-t border-sumi-900/8 bg-sumi-900/[0.03] p-6 lg:border-l lg:border-t-0">
            <p className="font-jp text-[10.5px] tracking-[0.28em] text-sumi-400">記憶</p>
            <h3 className="mt-1 text-[1.05rem] font-extrabold">{t.memoryState}</h3>

            <div className="mt-4 rounded-xl border border-sumi-900/10 bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <span className={cn("text-[13px] font-extrabold",
                  stage.tone === "matcha" ? "text-matcha-600" : stage.tone === "ai" ? "text-ai-600" : stage.tone === "kin" ? "text-kin-600" : "text-sumi-500")}>
                  {language === "en" ? stage.en : stage.mn}
                </span>
                <span className="font-mono text-[12px] font-bold tabnum text-sumi-500">
                  {card ? `${Math.round(retrievability(card) * 100)}%` : "—"}
                </span>
              </div>
              <Bar value={stage.pct / 100} tone={stage.tone as "matcha"} className="mt-2.5" height={6} />

              <div className="mt-3.5 grid grid-cols-2 gap-2 text-[11.5px]">
                {[
                  { l: t.reviewsStat, v: card?.n ?? 0 },
                  { l: t.lapsesStat, v: card?.l ?? 0 },
                  { l: t.stabilityStat, v: card ? `${card.st.toFixed(1)} ${t.daysUnit2}` : "—" },
                  { l: t.difficultyStat, v: card ? card.df.toFixed(1) : "—" },
                ].map((x) => (
                  <div key={x.l} className="rounded-lg bg-sumi-900/4 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
                    <p className="mt-0.5 font-mono text-[13px] font-extrabold tabnum">{x.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[11.5px] font-bold uppercase tracking-wide text-sumi-400">
              {card ? t.rateAgain : t.addSrs2}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {GRADES.map((g, i) => (
                <button
                  key={g.g}
                  onClick={() => actions.grade(v.id, g.g, { isNew: !card, level: v.lvl })}
                  className={cn("rounded-xl border px-2 py-2.5 text-center transition hover:-translate-y-0.5",
                    g.tone === "shu" ? "border-shu-100 bg-shu-50 hover:border-shu-400"
                      : g.tone === "kin" ? "border-kin-100 bg-kin-50 hover:border-kin-400"
                        : g.tone === "matcha" ? "border-matcha-100 bg-matcha-50 hover:border-matcha-400"
                          : "border-ai-100 bg-ai-50 hover:border-ai-400")}
                >
                  <span className="block text-[12.5px] font-extrabold">{language === "en" ? g.en : g.mn}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-sumi-500">{previews[i]?.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-sumi-900/8 pt-4">
              <p className="text-[11.5px] font-bold text-sumi-600">{t.myMnemonic}</p>
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                onBlur={() => actions.setMnemonic(v.id, mnemonic)}
                rows={3}
                placeholder={t.mnemonicPlaceholder}
                className="mt-2 w-full resize-none rounded-xl border border-sumi-900/12 bg-white px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-shu-400"
              />
              <p className="mt-1.5 text-[11px] text-sumi-400">{t.mnemonicNote}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── табууд ── */}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: t.overviewTab, icon: "要" },
          { id: "examples", label: t.examplesTab, icon: "例", badge: v.ex.length || undefined },
          { id: "network", label: t.relatedTab, icon: "網", badge: related.length || undefined },
          { id: "source", label: t.sourceTab, icon: "元" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle jp="使い方" title={t.usage} />
            <div className="space-y-4">
              <Info l={t.posType} v={TYPE_LABEL[language][v.t]} />
              <Info l={t.posJmdict} v={v.pos.join(", ") || "—"} />
              <Info l={t.levelRow} v={`${v.lvl} — ${LEVEL_LABEL[language][v.lvl]}`} />
              <Info l={t.tierRow} v={v.tier === "jlpt" ? t.tierJlpt : v.tier === "ext-example" ? t.tierExample : t.tierFreq} />
              <Info l={t.kanjiCount} v={`${v.kd.length}`} />
            </div>
          </Card>
          <Card>
            <SectionTitle jp="発音" title={t.pronunciation} />
            <div className="space-y-3">
              <Info l={t.hiraganaRow} v={v.r} />
              <Info l={t.romajiRow} v={v.rm || toRomaji(v.r)} />
              <Info l={t.katakanaRow} v={v.r.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => speak(v.w, 1)}>{t.normal}</Button>
              <Button size="sm" variant="outline" onClick={() => speak(v.w, 0.6)}>{t.slow}</Button>
              <Button size="sm" variant="outline" onClick={() => speak(v.w, 1.2)}>{t.fast}</Button>
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-sumi-400">{t.ttsNote}</p>
          </Card>
        </div>
      )}

      {tab === "examples" && (
        <Card>
          <SectionTitle jp="例文" title={t.examplesTab} sub={t.examplesSource} />
          {v.ex.length === 0 ? (
            <Empty icon="例" title={t.noExamples} sub={t.noExamplesSub} />
          ) : (
            <ul className="space-y-3">
              {v.ex.map((e, i) => (
                <li key={i} className="rounded-xl border border-sumi-900/8 bg-white/60 p-4">
                  <div className="flex items-start gap-3">
                    <Furigana text={e.fg ?? e.ja} show={doc.profile.furigana} className="flex-1 text-[16px] font-semibold leading-relaxed text-sumi-900" />
                    <SpeakButton text={stripFurigana(e.ja)} />
                  </div>
                  {language === "mn" && e.mn && <p className="mt-2 text-[13px] text-sumi-600">{e.mn}</p>}
                  {e.en && <p className="mt-2 text-[13px] text-sumi-600">{e.en}</p>}
                  <p className="mt-2 text-[11px] text-sumi-400">
                    {language === "mn"
                      ? (e.mn
                        ? <>{t.mnLabel}: {e.mn}</>
                        : <>{t.mnMissing}<a href={href("admin")} className="font-bold text-ai-600 underline underline-offset-4">{t.add}</a></>)
                      : null}
                    {e.ts ? ` · Tatoeba #${e.ts}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "network" && (
        <Card>
          <SectionTitle
            jp="関連語"
            title={t.relatedTab}
            sub={v.kd.length ? t.relatedSub(v.kd.join("」「")) : t.noKanjiWord}
          />
          {related.length === 0 ? (
            <Empty icon="網" title={t.relatedNotFound} />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((w) => (
                <a key={w.id} href={href("vocab", w.id)} className="card-flat flex items-center gap-3 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-shu-300">
                  <span className="font-jp text-[15.5px] font-bold text-sumi-900">{w.w}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-sumi-700">{language === "en" ? (w.en.join("; ") || w.mn?.join(", ")) : (w.mn?.join(", ") || w.en.join("; "))}</span>
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
          <SectionTitle jp="出典" title={t.sourceLicense} sub={t.sourceLicenseSub} />
          <div className="space-y-3">
            <Info l={t.srcPool} v={v.src === "openjlpt" ? "OpenJLPT (JLPT N5–N1)" : "JMdict (jamdict-data)"} />
            <Info l={t.srcId} v={v.sid} />
            <Info l={t.license} v={v.src === "openjlpt" ? "CC-BY-SA-4.0" : "CC-BY-SA-4.0 (JMdict)"} />
            <Info l={t.levelBy} v={v.tier === "jlpt" ? t.levelByJlpt : t.levelByDerived} />
            <Info l={t.transStatus} v={mq?.text ?? "—"} />
            <Info l={t.examplesRow} v={v.ex.length ? "Tatoeba (CC BY 2.0 FR)" : "—"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={href("about")} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">{t.viewAllSources}</a>
            <a href={href("admin")} className="text-[12.5px] font-bold text-shu-600 underline underline-offset-4">{t.fixTranslation}</a>
          </div>
        </Card>
      )}
    </div>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sumi-900/6 pb-3 last:border-0 last:pb-0">
      <span className="shrink-0 text-[12.5px] font-bold text-sumi-500">{l}</span>
      <span className="text-right text-[13.5px] font-semibold text-sumi-900">{v}</span>
    </div>
  );
}
