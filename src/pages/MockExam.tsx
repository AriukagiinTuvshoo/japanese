import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { navigate, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { READING, loadFullData } from "../lib/data";
import { EXAM_BLUEPRINTS, buildExam, scoreExam, sectionPassMark, type Question } from "../lib/study";
import {
  DRAFT_VERSION, clearExamDraft, readExamDraft, saveExamDraft, type DraftResult, type DraftSection,
} from "../lib/examSession";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { LEVEL_META } from "../data/levels";
import { Button, Card, Chip, LevelBadge, Ring, SectionTitle, Spinner } from "../components/ui";
import { QuizRunner, type QuizResult } from "../components/QuizRunner";
import { AiExamPanel } from "../components/AiExamPanel";
import { ui } from "../lib/i18n";

type Stage = "pick" | "running" | "sectionResult" | "final" | "ai";

export default function MockExam() {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const { query } = useQuery();
  const [level, setLevel] = useState<Level>((query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current));
  const [stage, setStage] = useState<Stage>("pick");
  const [secIdx, setSecIdx] = useState(0);
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [results, setResults] = useState<DraftResult[]>([]);
  const [answersBySec, setAnswersBySec] = useState<(number | null)[][]>([]);
  const [idxBySec, setIdxBySec] = useState<number[]>([]);
  const [resumed, setResumed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finishedMinutes, setFinishedMinutes] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  /** AI-аар үүсгэсэн дасгалын асуултууд (шалгалтын түүхэнд орохгүй). */
  const [aiQuestions, setAiQuestions] = useState<Question[]>([]);
  /** Өмнө үүсгэсэн асуултууд — дараагийн AI дасгал эдгээрийг давтахгүй. */
  const aiSeenRef = useRef<string[]>([]);
  const mountedRef = useRef(false);
  /** Зурваснаас сэргээсний дараагийн түвшний эффектийг алгасах. */
  const restoredRef = useRef(false);
  /** Шалгалтын үр дүнг нэг л удаа бүртгэх. */
  const recordedRef = useRef(false);

  const bp = EXAM_BLUEPRINTS[level];
  const meta = LEVEL_META[level];

  /* `#/mock?level=N2` гүн холбоос нь аль хэдийн нээлттэй байсан ч түвшинг сольж өгнө. */
  useEffect(() => {
    const wanted = query.level as Level | undefined;
    if (!wanted || !(LEVELS as string[]).includes(wanted)) return;
    if (stage !== "pick") return;
    setLevel((cur) => (cur === wanted ? cur : wanted));
  }, [query.level, stage]);

  /* Түвшин солиход өмнөх шалгалтын зурвас хүчингүй болно. */
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (restoredRef.current) { restoredRef.current = false; return; }
    setStage("pick");
    setSecIdx(0);
    setResults([]);
    setAnswersBySec([]);
    setIdxBySec([]);
    setResumed(false);
    clearExamDraft(sessionStorage);
  }, [level]);

  /* Refresh хийсэн бол дуусаагүй шалгалтыг (хариулт, хэсэг, цаг) сэргээнэ. */
  useEffect(() => {
    const draft = readExamDraft(sessionStorage);
    if (!draft) return;
    restoredRef.current = true;
    setLevel(draft.level);
    setStage(draft.stage);
    setSecIdx(draft.secIdx);
    setSections(draft.sections);
    setResults(draft.results);
    setAnswersBySec(draft.answers);
    setIdxBySec(draft.index);
    setStartedAt(draft.startedAt);
    setResumed(true);
  }, []);

  /* Шалгалтын явцыг тогтмол хадгална — refresh хийхэд алдагдахгүй. */
  useEffect(() => {
    if (stage !== "running" && stage !== "sectionResult") return;
    if (!sections.length) return;
    saveExamDraft(sessionStorage, {
      v: DRAFT_VERSION, level, stage: stage as "running" | "sectionResult", secIdx, startedAt,
      updatedAt: Date.now(), sections, results, answers: answersBySec, index: idxBySec,
    });
  }, [stage, level, secIdx, startedAt, sections, results, answersBySec, idxBySec]);

  const start = async () => {
    setLoading(true);
    const data = await loadFullData();
    const built = buildExam(bp, { vocab: data.vocab, kanji: data.kanji, grammar: data.grammar, reading: READING }, language);
    clearExamDraft(sessionStorage);
    setSections(built);
    setSecIdx(0);
    setResults([]);
    setAnswersBySec(built.map((s) => s.questions.map(() => null)));
    setIdxBySec(built.map(() => 0));
    setStartedAt(Date.now());
    setFinishedMinutes(null);
    setResumed(false);
    recordedRef.current = false;
    setStage("running");
    setLoading(false);
  };

  const current = sections[secIdx];

  const onFinishSection = (r: QuizResult) => {
    if (!current) return;
    const next = [...results, { section: current.section, correct: r.correct, total: r.total, timedOut: r.timedOut }];
    setResults(next);

    if (next.length < sections.length) {
      setStage("sectionResult");
      return;
    }

    /* Бүх хэсэг дууссан үед л түүхэнд бүртгэнэ — хагас шалгалт дүн гэж хадгалахгүй.
       Таймер ба товч зэрэг дуудсан ч давхар бүртгэхгүй. */
    if (recordedRef.current) return;
    recordedRef.current = true;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const scored = scoreExam(bp, next, minutes);
    setFinishedMinutes(minutes);
    actions.recordExam({
      id: `ex-${Date.now()}`,
      level,
      at: Date.now(),
      sections: scored.sections,
      total: scored.total,
      max: scored.max,
      passed: scored.passed,
      minutes,
      mock: true,
    });
    clearExamDraft(sessionStorage);
    setStage("final");
  };

  /* ── эцсийн үр дүн ── */
  if (stage === "final") {
    const minutesTaken = finishedMinutes ?? Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const scored = scoreExam(bp, results, minutesTaken);
    const weakest = [...scored.sections].sort((a, b) => a.score / a.max - b.score / b.max)[0];
    const verdict = scored.total >= bp.passTotal
      ? t.verdictPass
      : scored.total >= bp.passTotal * 0.85 ? t.verdictBorder : t.verdictFail;

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
                <p className="mt-1 text-[9.5px] font-bold leading-tight text-sumi-400">{t.examEstLabel}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <Chip tone={scored.passed ? "matcha" : "shu"}>{verdict}</Chip>
              <p className="mt-2 font-mono text-[12.5px] font-bold tabnum text-sumi-700">
                {t.examRaw(scored.raw.correct, scored.raw.total, Math.round(scored.raw.accuracy * 100))}
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-sumi-600">
                {t.examNote}
              </p>
              <p className="mt-2 text-[12.5px] text-sumi-500">
                {t.spentPre(minutesTaken, bp.passTotal, scored.max)}
              </p>
              {scored.failed.length > 0 && (
                <div className="mt-3 rounded-xl border border-shu-200 bg-shu-50 p-3">
                  <p className="text-[12.5px] font-extrabold text-shu-700">{t.sectionFloorTitle}</p>
                  <ul className="mt-1 space-y-0.5">
                    {scored.failed.map((f) => (
                      <li key={f.name} className="text-[12.5px] text-shu-700">{t.sectionFloor(f.name, f.score, f.mark)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {scored.sections.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-bold text-sumi-800">{s.name}</span>
                  <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">
                    {s.correct}/{s.total} · {s.score}/{s.max} ({t.examEstShort})
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-sumi-900/8">
                  <div className={cn("h-full rounded-full", s.score / s.max >= 0.6 ? "bg-matcha-500" : "bg-shu-500")}
                    style={{ width: `${(s.score / s.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-sumi-400">{t.examEstNote}</p>

          <div className="mt-6 rounded-2xl border border-kin-200 bg-kin-50 p-4">
            <p className="text-[13.5px] font-extrabold text-kin-700">{t.weakestPre}{weakest.name}</p>
            <p className="mt-1 text-[12.5px] text-sumi-600">{t.nextStep}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`quiz?mode=mixed&level=${level}`)}>{t.mixedDrill}</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("review")}>{t.srsReviewBtn}</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`reading?level=${level}`)}>{t.readingBtn}</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`listening?level=${level}`)}>{t.listeningBtn}</Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => { clearExamDraft(sessionStorage); setStage("pick"); setResults([]); setSecIdx(0); setAnswersBySec([]); setIdxBySec([]); setResumed(false); }}>{t.retakeBtn}</Button>
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
          {last.timedOut && (
            <p className="mt-2 rounded-xl border border-kin-200 bg-kin-50 px-4 py-2 text-[12px] font-bold text-kin-700">
              {t.examAutoSubmitted}
            </p>
          )}
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

  /* ── AI дасгал (шалгалтын оноонд орохгүй, тайлбартай сургалтын горим) ── */
  if (stage === "ai" && aiQuestions.length) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <LevelBadge level={level} size="sm" />
          <Chip tone="ai">AI</Chip>
          <span className="text-[12.5px] text-sumi-500">
            {language === "en"
              ? "AI-generated practice — not an official JLPT exam"
              : "AI үүсгэсэн дасгал — албан ёсны JLPT шалгалт биш"}
          </span>
        </div>
        <QuizRunner
          questions={aiQuestions}
          options={{ reveal: true, title: `${level} · AI`, sectionLabel: (q) => q.section }}
          onClose={() => { setStage("pick"); setAiQuestions([]); }}
        />
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
            {t.spentN(Math.round((Date.now() - startedAt) / 60000))}
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
            initialAnswers: answersBySec[secIdx],
            initialIndex: idxBySec[secIdx],
            onProgress: (p) => {
              setAnswersBySec((prev) => { const next = prev.slice(); next[secIdx] = p.answers; return next; });
              setIdxBySec((prev) => { const next = prev.slice(); next[secIdx] = p.index; return next; });
            },
            onFinish: (r) => onFinishSection(r),
          }}
          onClose={() => {
            clearExamDraft(sessionStorage);
            setStage("pick");
            setResults([]);
            setSecIdx(0);
            setResumed(false);
          }}
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
        <p className="mt-2 text-[12px] leading-relaxed text-sumi-500">{t.examListeningTts}</p>
        {resumed && (
          <p className="mt-3 rounded-xl border border-ai-200 bg-ai-50 px-4 py-3 text-[12.5px] font-bold text-ai-700">
            {t.examResumed}
          </p>
        )}
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
                  {s.count} {t.qUnit} · {s.minutes} {t.minutes} · {t.maxScore} {s.max} · {t.sectionMin} {sectionPassMark(s.max)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-sumi-500">{language === "en" ? bp.noteEn : bp.note}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" onClick={start} disabled={loading}>{loading ? t.preparing : t.startExam}</Button>
          <Button variant="outline" size="lg" onClick={() => navigate(`quiz?level=${level}`)}>{t.practiceFirst}</Button>
        </div>
      </Card>

      <AiExamPanel
        level={level}
        language={language}
        mistakes={doc.mistakes.slice(0, 10).map((m) => m.prompt)}
        avoid={aiSeenRef.current}
        onStart={(qs) => {
          aiSeenRef.current = [...aiSeenRef.current, ...qs.map((q) => q.prompt)].slice(-40);
          setAiQuestions(qs);
          setStage("ai");
        }}
      />

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

