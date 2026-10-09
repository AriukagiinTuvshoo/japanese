import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData, CURRICULUM, LISTENING, READING } from "../lib/data";
import type { DataMeta, Level } from "../lib/types";
import { LEVEL_LABEL, todayKey, dayOffset } from "../lib/text";
import { dueCards, memoryStats, reviewHistory, type Card as SrsCard } from "../lib/srs";
import { Bar, Button, Card, Chip, LevelBadge, Ring, SectionTitle, Spinner, Stat } from "../components/ui";
import { ui, type Language } from "../lib/i18n";

export default function Home() {
  const { doc, today, streak, levelInfo, nextAchievement } = useStore();
  const language: Language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [data, setData] = useState<DataMeta | null>(null);
  const level: Level = doc.profile.current === "zero" ? doc.profile.target : doc.profile.current;

  useEffect(() => {
    loadFullData().then((d) => setData(d.meta));
  }, []);

  const due = useMemo(() => dueCards(doc.srs), [doc.srs]);
  const mem = useMemo(() => memoryStats(doc.srs), [doc.srs]);
  const history = useMemo(() => reviewHistory(doc.srs, 35), [doc.srs]);

  /* ── өнөөдрийн даалгавар ── */
  const goal = doc.profile.dailyGoal;
  const mission = useMemo(() => {
    const scale = goal / 30;
    return [
      { id: "vocab", icon: "語", label: t.wordSg, jp: "単語", target: Math.max(5, Math.round(20 * scale)), unit: t.wordSg.toLowerCase(), done: today.newCards, to: `vocab?level=${level}&tab=learn` },
      { id: "review", icon: "復", label: t.reviewN, jp: "復習", target: Math.max(5, Math.round(15 * scale)), unit: t.cardUnit, done: today.reviews, to: "review", urgent: due.length },
      { id: "kanji", icon: "漢", label: t.kanji, jp: "漢字", target: Math.max(3, Math.round(10 * scale)), unit: t.kanji.toLowerCase(), done: Object.values(doc.writing).filter((w) => todayKey(new Date(w.at)) === todayKey()).length, to: `kanji?level=${level}` },
      { id: "grammar", icon: "文", label: t.grammar, jp: "文法", target: Math.max(2, Math.round(4 * scale)), unit: t.grammar.toLowerCase(), done: doc.grammarDone.length, to: `grammar?level=${level}` },
      { id: "reading", icon: "読", label: t.reading, jp: "読解", target: 1, unit: t.lessonUnit, done: doc.readingDone.length, to: `reading?level=${level}` },
      { id: "listening", icon: "聴", label: t.listening, jp: "聴解", target: 1, unit: t.lessonUnit, done: doc.listeningDone.length, to: `listening?level=${level}` },
    ];
  }, [goal, today, due.length, doc.writing, doc.grammarDone, doc.readingDone, doc.listeningDone, level, language]);

  const missionTotal = mission.reduce((a, m) => a + m.target, 0);
  const missionDone = mission.reduce((a, m) => a + Math.min(m.target, m.done), 0);
  const estimated = Math.max(8, Math.round(goal * (1 - missionDone / Math.max(1, missionTotal))));

  /* ── сул тал ── */
  const weak = useMemo(() => {
    const byKind = new Map<string, { correct: number; total: number }>();
    for (const q of doc.quizzes.slice(0, 20)) {
      const cur = byKind.get(q.kind) ?? { correct: 0, total: 0 };
      cur.correct += q.correct;
      cur.total += q.total;
      byKind.set(q.kind, cur);
    }
    const rows = [...byKind.entries()]
      .filter(([, v]) => v.total >= 5)
      .map(([k, v]) => ({ kind: k, pct: v.correct / v.total, total: v.total }));
    return rows.sort((a, b) => a.pct - b.pct).slice(0, 3);
  }, [doc.quizzes]);

  const heat = useMemo(() => {
    // 20 долоо хоног × 7 өдөр
    const cells: { key: string; xp: number }[] = [];
    const today0 = todayKey();
    for (let i = 139; i >= 0; i--) {
      const k = dayOffset(today0, -i);
      cells.push({ key: k, xp: doc.activity[k]?.xp ?? 0 });
    }
    return cells;
  }, [doc.activity]);

  const resume = useMemo(() => {
    const recent = Object.entries(doc.srs)
      .filter(([, c]) => c.last > 0)
      .sort((a, b) => b[1].last - a[1].last)[0];
    if (!recent) return null;
    return { id: recent[0], card: recent[1] as SrsCard };
  }, [doc.srs]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return t.greetNight;
    if (h < 12) return t.greetMorning;
    if (h < 18) return t.greetDay;
    return t.greetEvening;
  })();

  const nextLesson = useMemo(() => {
    const l = LISTENING.filter((x) => x.level === level && !doc.listeningDone.includes(x.id));
    return l[Math.floor(Math.random() * Math.max(1, l.length))] ?? LISTENING[0];
  }, [level, doc.listeningDone]);

  const nextReading = useMemo(() => {
    const r = READING.filter((x) => x.level === level && !doc.readingDone.includes(x.id));
    return r[Math.floor(Math.random() * Math.max(1, r.length))] ?? READING[0];
  }, [level, doc.readingDone]);

  const cur = doc.curriculum;
  const curPlan = cur ? CURRICULUM[cur.level] : null;
  const curDay = cur ? Math.min(cur.days, Math.floor((Date.now() - cur.startedAt) / 86_400_000) + 1) : 0;
  const curDone = cur ? Object.keys(cur.done).length : 0;
  const behind = cur ? Math.max(0, curDay - curDone) : 0;

  return (
    <div className="space-y-7">
      {/* ── толгой ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[12px] tracking-[0.32em] text-shu-500">おかえりなさい</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">
            {greeting}{doc.profile.name ? `, ${doc.profile.name}` : ""}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-sumi-500">
            <span>{LEVEL_LABEL[language][level]} ({level}) · {LEVEL_JP_LABEL(level)}</span>
            <span className="h-1 w-1 rounded-full bg-sumi-300" />
            <span>{t.streakN(streak)}</span>
            <span className="h-1 w-1 rounded-full bg-sumi-300" />
            <span className="tabnum">{t.level} {levelInfo.level} · {doc.xp.toLocaleString()} {t.pointsUnit2}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={() => navigate("placement")}>測 {t.q3}</Button>
          <Button size="md" onClick={() => navigate(due.length ? "review" : `vocab?level=${level}&tab=learn`)}>
            {due.length ? t.reviewNBtn(due.length) : t.startLearning}
          </Button>
        </div>
      </div>

      {/* ── анхны зочин: нэвтрэлт, тохиргоогүйгээр шууд эхлэх ── */}
      {doc.xp === 0 && doc.activity && Object.keys(doc.activity).length === 0 && (
        <Card className="p-6">
          <p className="font-jp text-[10.5px] tracking-[0.28em] text-sumi-400">はじめよう</p>
          <h2 className="mt-0.5 text-[1.2rem] font-extrabold">{t.firstMinutes}</h2>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">{t.noLoginNeeded}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { k: "語", t: t.q1, d: t.q1d, to: "quiz?mode=vocab-jp-mn&level=N5" },
              { k: "漢", t: t.q2, d: t.q2d, to: "write?level=N5" },
              { k: "測", t: t.q3, d: t.q3d, to: "placement" },
            ].map((o) => (
              <button
                key={o.to}
                onClick={() => navigate(o.to)}
                className="flex items-center gap-3 rounded-xl border border-sumi-900/10 bg-white/70 p-4 text-left transition hover:border-shu-400 hover:bg-white"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sumi-900 font-mincho text-[18px] font-bold text-washi-50">{o.k}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-extrabold text-sumi-900">{o.t}</span>
                  <span className="block text-[12px] text-sumi-500">{o.d}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── өнөөдрийн эрхэм зорилго ── */}
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
          <div className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-jp text-[10.5px] tracking-[0.28em] text-sumi-400">今日のミッション</p>
                <h2 className="mt-0.5 text-[1.25rem] font-extrabold">{t.missionTitle}</h2>
              </div>
              <Chip tone={missionDone >= missionTotal ? "matcha" : "kin"}>
                {missionDone >= missionTotal ? t.missionDone : t.missionLeft(estimated)}
              </Chip>
            </div>

            <div className="mt-5 space-y-3.5">
              {mission.map((m) => {
                const pct = Math.min(1, m.done / m.target);
                return (
                  <a key={m.id} href={href(m.to)} className="block rounded-xl px-2 py-1 transition hover:bg-sumi-900/4">
                    <div className="flex items-center gap-3">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mincho text-[15px] font-bold",
                        pct >= 1 ? "bg-matcha-500 text-white" : "bg-sumi-900/6 text-sumi-600")}>
                        {pct >= 1 ? "✓" : m.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-[13.5px] font-bold text-sumi-800">{m.label}</span>
                          <span className="font-jp text-[10.5px] text-sumi-400">{m.jp}</span>
                          {m.urgent ? <Chip tone="shu" className="ml-1">{t.overdueChip(m.urgent)}</Chip> : null}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[12.5px] font-bold tabnum text-sumi-500">
                        {Math.min(m.done, m.target)}/{m.target}
                      </span>
                    </div>
                    <Bar value={pct} tone={pct >= 1 ? "matcha" : "shu"} className="ml-11 mt-2 w-[calc(100%-2.75rem)]" height={5} />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="border-t border-sumi-900/8 bg-sumi-900 p-6 text-washi-50 lg:border-l lg:border-t-0">
            <p className="font-jp text-[10.5px] tracking-[0.28em] text-washi-400">進捗</p>
            <div className="mt-4 flex items-center gap-4">
              <Ring value={missionTotal ? missionDone / missionTotal : 0} size={88} stroke={7} tone="shu" track="rgba(255,255,255,0.1)">
                <div className="text-center">
                  <p className="font-mono text-[1.15rem] font-extrabold leading-none tabnum">
                    {Math.round((missionTotal ? missionDone / missionTotal : 0) * 100)}%
                  </p>
                </div>
              </Ring>
              <div className="min-w-0">
                <p className="text-[13px] font-bold">{missionDone}/{missionTotal} {t.taskCardN(0).replace("0 ", "")}</p>
                <p className="mt-1 text-[11.5px] text-washi-400">{t.todayStat(today.min, today.xp)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4">
              {[
                { l: t.masteredStat, v: mem.mastered, tone: "matcha" },
                { l: t.dueStat, v: due.length, tone: "shu" },
                { l: t.learningStat, v: mem.learning, tone: "kin" },
              ].map((x) => (
                <div key={x.l} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-washi-300">{x.l}</span>
                  <span className="font-mono font-bold tabnum text-washi-50">{x.v.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {nextAchievement && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-kin-500 font-mincho text-[15px] font-bold text-white">{nextAchievement.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold">{nextAchievement.title}</p>
                    <p className="truncate text-[10.5px] text-washi-400">{nextAchievement.desc}</p>
                  </div>
                </div>
                <Bar value={nextAchievement.pct} tone="kin" className="mt-2.5" height={4} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── үргэлжлүүлэх ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            jp="続きから"
            title={t.continueTitle}
            right={<a href={href("review")} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">{t.srsLink}</a>}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {resume && <ResumeCard id={resume.id} />}
            {nextReading && (
              <TaskCard
                to={`reading/${nextReading.id}`}
                k="読"
                tone="ai"
                title={nextReading.titleJp}
                sub={`${language === "en" ? (nextReading.titleEn ?? nextReading.title) : nextReading.title} · ${nextReading.minutes} ${t.minutes}`}
                badge={nextReading.level}
              />
            )}
            {nextLesson && (
              <TaskCard
                to={`listening/${nextLesson.id}`}
                k="聴"
                tone="murasaki"
                title={nextLesson.titleJp ?? nextLesson.title}
                sub={`${language === "en" ? (nextLesson.titleEn ?? nextLesson.title) : nextLesson.title} · ${nextLesson.minutes} ${t.minutes}`}
                badge={nextLesson.level}
              />
            )}
            <TaskCard
              to="write"
              k="筆"
              tone="shu"
              title={t.writeTask}
              sub={t.writeTaskSub(Object.keys(doc.writing).length)}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle jp="分析" title={t.styleTitle} />
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-sumi-700">{t.memoryStability}</span>
                <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">{Math.round(mem.retention * 100)}%</span>
              </div>
              <Bar value={mem.retention} tone="ai" className="mt-2" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-sumi-700">{t.reviewAccuracy}</span>
                <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">{Math.round(mem.accuracy * 100)}%</span>
              </div>
              <Bar value={mem.accuracy} tone="matcha" className="mt-2" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-sumi-700">{t.confidenceRow}</span>
                <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">{Math.round(mem.confidence * 100)}%</span>
              </div>
              <Bar value={mem.confidence} tone="murasaki" className="mt-2" />
            </div>
          </div>
          <p className="mt-4 border-t border-sumi-900/8 pt-3 text-[11.5px] leading-relaxed text-sumi-500">
            {due.length > 0
              ? t.dueWarn(due.length)
              : mem.reviews > 0
                ? t.noDue
                : t.getStarted}
          </p>
        </Card>
      </div>

      {/* ── сул тал ба хүчтэй тал ── */}
      {weak.length > 0 && (
        <Card>
          <SectionTitle
            jp="弱点"
            title={t.weakTitle}
            sub={t.weakSub}
            right={<a href={href("progress")} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">{t.detailsLink}</a>}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {weak.map((w) => (
              <div key={w.kind} className="card-flat p-4">
                <p className="truncate text-[13px] font-bold text-sumi-800">{w.kind}</p>
                <p className="mt-1.5 font-mono text-[1.5rem] font-extrabold tabnum leading-none" style={{ color: w.pct < 0.5 ? "#cc4630" : w.pct < 0.7 ? "#b88a2d" : "#688c45" }}>
                  {Math.round(w.pct * 100)}%
                </p>
                <Bar value={w.pct} tone={w.pct < 0.5 ? "shu" : w.pct < 0.7 ? "kin" : "matcha"} className="mt-2.5" height={5} />
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => navigate("quiz?mode=weak")}>{t.drillBtn}</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── төлөвлөгөө ── */}
      {cur && curPlan ? (
        <Card>
          <SectionTitle
            jp="学習計画"
            title={t.planTitle(cur.level, cur.days)}
            sub={curPlan.summary}
            right={<a href={href("plan")} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">{t.planLink}</a>}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t.today} value={t.dayN(curDay)} sub={`/ ${cur.days}`} icon="日" />
            <Stat label={t.doneStat} value={curDone} sub={`${Math.round((curDone / cur.days) * 100)}%`} icon="✓" tone="matcha" />
            <Stat label={t.behindStat} value={behind > 0 ? `${behind} ${t.days}` : t.none2} sub={behind > 0 ? t.replanSub : t.onTrackSub} icon="⚡" tone={behind > 0 ? "shu" : "matcha"} />
          </div>
          <Bar value={curDone / cur.days} tone="shu" className="mt-4" height={8} />
          {behind > 0 && (
            <p className="mt-3 rounded-xl bg-shu-50 px-3.5 py-2.5 text-[12.5px] font-bold text-shu-700">
              {t.behindWarnPre(behind, Math.min(180, 30 + behind * 12))}
              <a href={href("plan")} className="underline underline-offset-4">{t.behindWarnLink}</a>.
            </p>
          )}
        </Card>
      ) : (
        <Card className="bg-sumi-900 text-washi-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-jp text-[10.5px] tracking-[0.28em] text-washi-400">学習計画</p>
              <h3 className="mt-1 text-[1.25rem] font-extrabold">{t.planCta}</h3>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-washi-300">
                {t.planCtaBody}
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => navigate("plan")}>{t.createPlanBtn}</Button>
          </div>
        </Card>
      )}

      {/* ── идэвхийн зураг ── */}
      <Card>
        <SectionTitle
          jp="学習記録"
          title={t.heatmapTitle}
          sub={t.heatmapSub(Object.values(doc.activity).filter((d) => d.xp > 0).length)}
        />
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {Array.from({ length: 20 }, (_, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {heat.slice(w * 7, w * 7 + 7).map((c) => (
                <span
                  key={c.key}
                  title={`${c.key} · ${c.xp} ${t.pointsUnit2}`}
                  className={cn("h-[13px] w-[13px] shrink-0 rounded-[3px]",
                    c.xp === 0 ? "bg-sumi-900/8"
                      : c.xp < 40 ? "bg-matcha-200"
                        : c.xp < 120 ? "bg-matcha-400"
                          : c.xp < 260 ? "bg-matcha-500"
                            : "bg-matcha-600")}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-sumi-400">
          <span>{t.less}</span>
          {["bg-sumi-900/8", "bg-matcha-200", "bg-matcha-400", "bg-matcha-500", "bg-matcha-600"].map((c) => (
            <span key={c} className={cn("h-3 w-3 rounded-[3px]", c)} />
          ))}
          <span>{t.more}</span>
          <span className="ml-auto tabnum">{t.reviewsFromHistory(history.reduce((a, h) => a + h.n, 0).toLocaleString())}</span>
        </div>
      </Card>

      {/* ── эх сурвалж ── */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label={t.vocab} value={data.counts.vocab.toLocaleString()} sub="N5 → N1" icon="語" tone="shu" />
          <Stat label={t.kanji} value={data.counts.kanji.toLocaleString()} sub={t.strokesSubStat(data.counts.strokes.toLocaleString())} icon="漢" tone="ai" />
          <Stat label={t.grammar} value={data.counts.grammar} sub={t.mnTranslated} icon="文" tone="murasaki" />
          <Stat label={t.readingListeningStat} value={`${READING.length} · ${LISTENING.length}`} sub={t.inMongolian} icon="読" tone="matcha" />
        </div>
      )}

      {!data && <Spinner label={t.dataLoading} lang={language} />}
    </div>
  );
}

const LEVEL_JP_LABEL = (l: Level) => ({ N5: "入門", N4: "基礎", N3: "中級", N2: "上級", N1: "最上級" })[l];

function ResumeCard({ id }: { id: string }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [word, setWord] = useState<{ w: string; r: string; mn: string[] | null; en: string[] } | null>(null);

  useEffect(() => {
    loadFullData().then((d) => {
      const v = d.byId.get(id);
      const k = d.kanjiByChar.get(id);
      if (v) setWord({ w: v.w, r: v.r, mn: v.mn, en: v.en });
      else if (k) setWord({ w: k.k, r: k.on[0] ?? "", mn: k.mn, en: k.en });
    });
  }, [id]);

  const card = doc.srs[id];
  if (!word) return <Spinner />;

  return (
    <div className="card-flat flex flex-col justify-between p-4">
      <div>
        <div className="flex items-center gap-2">
          <Chip tone="kin">{t.recentlyViewed}</Chip>
          {card && <Chip tone="sumi">{t.stableDaysChip(Math.round(card.st))}</Chip>}
        </div>
        <p className="mt-3 font-jp text-[2rem] font-bold leading-none text-sumi-900">{word.w}</p>
        <p className="mt-1.5 font-jp text-[13px] text-sumi-500">{word.r}</p>
        <p className="mt-2 line-clamp-2 text-[13px] text-sumi-700">{language === "en" ? (word.en.join("; ") || word.mn?.join(", ")) : (word.mn?.join(", ") || word.en.join("; "))}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => actions.grade(id, 2)}>{t.knowBtn}</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => actions.grade(id, 0)}>{t.againBtn}</Button>
      </div>
    </div>
  );
}

function TaskCard({
  to, k, tone, title, sub, badge,
}: { to: string; k: string; tone: "shu" | "ai" | "matcha" | "murasaki" | "kin"; title: string; sub: string; badge?: string }) {
  const tones: Record<string, string> = {
    shu: "bg-shu-50 text-shu-600", ai: "bg-ai-50 text-ai-600",
    matcha: "bg-matcha-50 text-matcha-600", murasaki: "bg-murasaki-50 text-murasaki-600", kin: "bg-kin-50 text-kin-600",
  };
  return (
    <a href={href(to)} className="card-flat flex min-w-0 items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-shu-300">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mincho text-[18px] font-bold", tones[tone])}>{k}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold text-sumi-900">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-sumi-500">{sub}</span>
      </span>
      {badge && <LevelBadge level={badge as Level} size="sm" />}
    </a>
  );
}
