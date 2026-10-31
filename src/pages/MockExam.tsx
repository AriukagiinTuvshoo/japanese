import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { navigate, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData } from "../lib/data";
import { EXAM_BLUEPRINTS, buildExam, scoreExam, sectionMin, type ExamPassMode, type ExamSection } from "../lib/study";
import type { Question } from "../lib/study";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { LEVEL_META } from "../data/levels";
import { Button, Card, Chip, LevelBadge, Ring, SectionTitle, Spinner } from "../components/ui";
import { QuizRunner } from "../components/QuizRunner";
import { ui } from "../lib/i18n";
import { featureEnabled } from "../lib/features";

type Stage = "pick" | "running" | "sectionResult" | "final";

export default function MockExam() {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const { query } = useQuery();
  const [level, setLevel] = useState<Level>((query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current));
  const [stage, setStage] = useState<Stage>("pick");
  const [secIdx, setSecIdx] = useState(0);
  const [sections, setSections] = useState<{ section: ExamSection; questions: Question[] }[]>([]);
  const [results, setResults] = useState<{ section: ExamSection; correct: number; total: number }[]>([]);
  const [, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const startAt = useMemo(() => Date.now(), [sections]);
  /** B5: тэнцэх хязгаарын горим — default = албаны JLPT схем (19/60). */
  const [passMode, setPassMode] = useState<ExamPassMode>("official");
  /** Энэ шалгалтын үр дүнг нэг л удаа баримтанд бичнэ (StrictMode давхар дуудалтаас сэргийлнэ). */
  const recorded = useRef(false);

  const bp = EXAM_BLUEPRINTS[level];
  const meta = LEVEL_META[level];

  useEffect(() => { setStage("pick"); setSecIdx(0); setResults([]); setAnswers([]); recorded.current = false; }, [level]);

  /* Эцсийн үр дүн гармагц нэг удаа баримтлана — ингээд "Өмнөх шалгалт"-д
   * хэсэг бүрийн оноо, тэнцсэн/тэнцээгүй харагдана (хуучин recordExam ашиглалтгүй
   * байсан — үр дүн хэзээ ч хадгалагдаагүй байв). */
  useEffect(() => {
    if (stage !== "final" || recorded.current || results.length === 0) return;
    recorded.current = true;
    const scored = scoreExam(bp, results, Math.round((Date.now() - startAt) / 60000), passMode);
    actions.recordExam({
      id: `e${Date.now()}`,
      level,
      at: Date.now(),
      sections: scored.sections,
      total: scored.total,
      max: scored.max,
      passed: scored.passed,
      minutes: Math.max(1, Math.round((Date.now() - startAt) / 60000)),
      mock: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, results]);

  const start = async () => {
    setLoading(true);
    const data = await loadFullData();
    const built = buildExam(bp, { vocab: data.vocab, kanji: data.kanji, grammar: data.grammar }, language);
    setSections(built);
    setSecIdx(0);
    setResults([]);
    setStage("running");
    setLoading(false);
  };

  const current = sections[secIdx];

  const onFinishSection = (r: { correct: number; total: number }) => {
    const next = [...results, { section: current.section, correct: r.correct, total: r.total }];
    setResults(next);
    if (secIdx + 1 < sections.length) setStage("sectionResult");
    else setStage("final");
  };

  /* ── эцсийн үр дүн ── */
  if (stage === "final") {
    const scored = scoreExam(bp, results, Math.round((Date.now() - startAt) / 60000), passMode);
    const weakest = [...scored.sections].sort((a, b) => a.score / a.max - b.score / b.max)[0];
    // Тэнцэх = нийт оноо хангалттай **БАРИУЛГҮЙ** бүх хэсэг доод оноонд хүрсэн.
    const verdict = scored.passed
      ? t.verdictPass
      : !scored.sectionsPassed
        ? t.verdictFail
        : scored.total >= scored.passTotal * 0.85 ? t.verdictBorder : t.verdictFail;

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">結果発表</p>
          <h1 className="mt-1 text-[1.8rem] font-extrabold">{t.resultOf2(language === "en" ? bp.titleEn : bp.title)}</h1>
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <Ring value={scored.total / scored.max} size={118} stroke={10} tone={scored.passed ? "matcha" : "shu"}>
              <div className="text-center">
                <p className="font-mono text-[1.7rem] font-extrabold leading-none tabnum">{scored.total}</p>
                <p className="mt-0.5 text-[10px] font-bold text-sumi-400">/ {scored.max}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <Chip tone={scored.passed ? "matcha" : "shu"}>{verdict}</Chip>
              <p className="mt-3 text-[13.5px] leading-relaxed text-sumi-600">
                {t.examNote}
              </p>
              <p className="mt-2 text-[12.5px] text-sumi-500">
                {t.spentPre(Math.round((Date.now() - startAt) / 60000), scored.passTotal, scored.max)}
              </p>
              <p className="mt-1 text-[11.5px] text-sumi-400">
                {t.passModeLabel} {passMode === "official" ? t.passModeOfficial : t.passModeStrict}
              </p>
              {!scored.sectionsPassed && (
                <p className="mt-2 rounded-xl bg-shu-50 px-3 py-2 text-[12px] font-bold text-shu-600">
                  {weakest.name}: {t.sectionLow} ({t.sectionMinPre(sectionMin(weakest.max, passMode))})
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {scored.sections.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-bold text-sumi-800">{s.name}</span>
                  <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">
                    {s.correct}/{s.total} · {s.score}/{s.max} · {t.sectionMinPre(s.min)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-sumi-900/8">
                    <div className={cn("h-full rounded-full", s.passedSection ? "bg-matcha-500" : "bg-shu-500")}
                      style={{ width: `${(s.score / s.max) * 100}%` }} />
                  </div>
                  <Chip tone={s.passedSection ? "matcha" : "shu"}>{s.passedSection ? t.sectionOk : t.sectionLow}</Chip>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-kin-200 bg-kin-50 p-4">
            <p className="text-[13.5px] font-extrabold text-kin-700">{t.weakestPre}{weakest.name}</p>
            <p className="mt-1 text-[12.5px] text-sumi-600">{t.nextStep}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`quiz?mode=mixed&level=${level}`)}>{t.mixedDrill}</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("review")}>{t.srsReviewBtn}</Button>
              {featureEnabled("reading") && <Button size="sm" variant="outline" onClick={() => navigate(`reading?level=${level}`)}>{t.readingBtn}</Button>}
              {featureEnabled("listening") && <Button size="sm" variant="outline" onClick={() => navigate(`listening?level=${level}`)}>{t.listeningBtn}</Button>}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => { setStage("pick"); setResults([]); setSecIdx(0); }}>{t.retakeBtn}</Button>
            <Button variant="ghost" onClick={() => navigate("progress")}>{t.analysisLink}</Button>
          </div>
        </Card>

        <Card>
          <SectionTitle jp="統計" title={t.timingTitle} />
          <div className="space-y-2.5 text-[13px]">
            {meta.minutes.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-32 shrink-0 font-bold text-sumi-600">{language === "en" ? (meta.minuteLabelsEn?.[i] ?? meta.minuteLabels[i]) : meta.minuteLabels[i]}</span>
                <span className="font-mono font-bold tabnum">{m} {t.minutes}</span>
                <span className="text-[11.5px] text-sumi-400">{t.officialNote}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-sumi-400">
            {t.timingFoot}
          </p>
        </Card>
      </div>
    );
  }

  /* ── хэсэг хоорондын завсарлага ── */
  if (stage === "sectionResult") {
    const last = results[results.length - 1];
    return (
      <div className="mx-auto max-w-xl">
        <Card className="text-center">
          <span className="font-mincho text-[2.6rem] font-bold text-ai-500">区</span>
          <h2 className="mt-2 text-[1.4rem] font-extrabold">{t.sectionDone(language === "en" ? last.section.nameEn ?? last.section.name : last.section.name)}</h2>
          <p className="mt-2 text-[13.5px] text-sumi-600">
            {last.correct} / {last.total} зөв · {Math.round((last.correct / last.total) * 100)}%
          </p>
          <p className="mt-4 rounded-xl bg-sumi-900/[0.045] px-4 py-3 text-[12.5px] leading-relaxed text-sumi-500">
            {t.afterExamNote}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => { setSecIdx(secIdx + 1); setStage("running"); }}>
              {t.nextSection(sections[secIdx + 1] ? (language === "en" ? sections[secIdx + 1].section.nameEn ?? sections[secIdx + 1].section.name : sections[secIdx + 1].section.name) : "")}
            </Button>
            <Button variant="ghost" onClick={() => setStage("final")}>{t.finishAll}</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (stage === "running" && current) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <LevelBadge level={level} size="sm" />
          <Chip tone="shu">{bp.title}</Chip>
          <span className="text-[12.5px] text-sumi-500">
            {t.sectionN(secIdx + 1, sections.length, language === "en" ? current.section.nameEn ?? current.section.name : current.section.name, current.section.jp)}
          </span>
          <span className="ml-auto text-[12px] text-sumi-400">
            {t.spentN(Math.round((Date.now() - startAt) / 60000))}
          </span>
        </div>
        <QuizRunner
          key={secIdx}
          questions={current.questions}
          options={{
            timed: current.section.minutes,
            reveal: false,
            title: `${language === "en" ? bp.titleEn : bp.title} · ${language === "en" ? current.section.nameEn ?? current.section.name : current.section.name}`,
            sectionLabel: () => (language === "en" ? current.section.nameEn ?? current.section.name : current.section.name),
            onFinish: (r) => onFinishSection(r),
          }}
          onClose={() => setStage("pick")}
        />
      </div>
    );
  }

  /* ── эхлэх дэлгэц ── */
  return (
    <div className="space-y-6">
      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">模擬試験</p>
        <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.mockHero}</h1>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-sumi-500">
          {t.mockHeroSub}
        </p>
        <p className="mt-3 rounded-xl bg-kin-50 px-4 py-3 text-[12.5px] leading-relaxed text-kin-700">
          {t.mockWarn}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {LEVELS.map((l) => {
          const m = LEVEL_META[l];
          const on = l === level;
          return (
            <button key={l} onClick={() => setLevel(l)}
              className={cn("card p-4 text-left transition hover:-translate-y-0.5",
                on ? "border-shu-400 bg-shu-50/60 ring-2 ring-shu-500/15" : "")}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[1.5rem] font-extrabold">{l}</span>
                {on && <Chip tone="shu">{t.selected}</Chip>}
              </div>
              <p className="mt-1 text-[12px] font-bold text-sumi-600">{LEVEL_LABEL[language][l]}</p>
              <p className="mt-2 text-[11px] text-sumi-400">{t.kanjiNWords(m.kanji, m.vocab)}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <SectionTitle jp="試験構成" title={t.structureOf(language === "en" ? bp.titleEn : bp.title)} sub={t.totalQ(bp.sections.reduce((a, s2) => a + s2.count, 0), bp.minutes)} />
        <div className="space-y-3">
          {bp.sections.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-sumi-900/8 bg-white/60 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sumi-900 font-mono text-[13px] font-bold text-washi-50">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-extrabold">{language === "en" ? s.nameEn ?? s.name : s.name} <span className="font-jp text-sumi-400">{s.jp}</span></p>
                <p className="mt-0.5 text-[12px] text-sumi-500">
                  {s.count} {t.qUnit} · {s.minutes} {t.minutes} · {t.maxScore} {s.max} · {t.sectionMinPre(sectionMin(s.max, passMode))}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-sumi-500">{language === "en" ? bp.noteEn : bp.note}</p>
        <p className="mt-2 rounded-xl bg-ai-50/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-ai-700">
          {t.mockSectionNote}
        </p>

        {/* B5: тэнцэх хязгаарын горим — албаны JLPT (default) эсвэл чанга 60% */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-sumi-500">{t.passModeLabel}</span>
          <div className="flex rounded-lg border border-sumi-900/10 bg-white/70 p-0.5">
            {(["official", "strict"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setPassMode(m)}
                className={cn("rounded-md px-3 py-1.5 text-[12px] font-bold transition",
                  passMode === m ? "bg-shu-500 text-white" : "text-sumi-500 hover:text-sumi-800")}>
                {m === "official" ? t.passModeOfficial : t.passModeStrict}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" onClick={start} disabled={loading}>{loading ? t.preparing : t.startExam}</Button>
          <Button variant="outline" size="lg" onClick={() => navigate(`quiz?level=${level}`)}>{t.practiceFirst}</Button>
        </div>
      </Card>

      {doc.exams.length > 0 && (
        <Card>
          <SectionTitle jp="受験履歴" title={t.pastExams} />
          <ul className="divide-y divide-sumi-900/8">
            {doc.exams.slice(0, 8).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <LevelBadge level={e.level} size="sm" />
                <span className="text-[13px] font-bold">{e.total}/{e.max}</span>
                <Chip tone={e.passed ? "matcha" : "shu"}>{e.passed ? t.passedC : t.failedC}</Chip>
                <span className="text-[11.5px] text-sumi-400">
                  {new Date(e.at).toLocaleDateString(language === "en" ? "en-US" : "mn-MN")} · {e.minutes} {t.minutes}
                </span>
                <span className="ml-auto text-[11.5px] text-sumi-400">
                  {e.sections.map((s) => `${s.name.slice(0, 6)} ${Math.round((s.score / s.max) * 100)}%`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loading && <Spinner label={t.genQ} lang={language} />}
    </div>
  );
}

