import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { navigate, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData } from "../lib/data";
import { EXAM_BLUEPRINTS, buildExam, scoreExam, type ExamSection } from "../lib/study";
import type { Question } from "../lib/study";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { LEVEL_META } from "../data/levels";
import { Button, Card, Chip, LevelBadge, Ring, SectionTitle, Spinner } from "../components/ui";
import { QuizRunner } from "../components/QuizRunner";

type Stage = "pick" | "running" | "sectionResult" | "final";

export default function MockExam() {
  const { doc } = useStore();
  const { query } = useQuery();
  const [level, setLevel] = useState<Level>((query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current));
  const [stage, setStage] = useState<Stage>("pick");
  const [secIdx, setSecIdx] = useState(0);
  const [sections, setSections] = useState<{ section: ExamSection; questions: Question[] }[]>([]);
  const [results, setResults] = useState<{ section: ExamSection; correct: number; total: number }[]>([]);
  const [, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const startAt = useMemo(() => Date.now(), [sections]);

  const bp = EXAM_BLUEPRINTS[level];
  const meta = LEVEL_META[level];

  useEffect(() => { setStage("pick"); setSecIdx(0); setResults([]); setAnswers([]); }, [level]);

  const start = async () => {
    setLoading(true);
    const data = await loadFullData();
    const built = buildExam(bp, { vocab: data.vocab, kanji: data.kanji, grammar: data.grammar });
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
    const scored = scoreExam(bp, results, Math.round((Date.now() - startAt) / 60000));
    const weakest = [...scored.sections].sort((a, b) => a.score / a.max - b.score / b.max)[0];
    const verdict = scored.total >= bp.passTotal
      ? "Тэнцэх магадлалтай"
      : scored.total >= bp.passTotal * 0.85 ? "Хилийн дээр — сайжруулах шаардлагатай" : "Одоогоор тэнцэхгүй";

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">結果発表</p>
          <h1 className="mt-1 text-[1.8rem] font-extrabold">{bp.title} — үр дүн</h1>
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
                Энэ бол <strong>дасгалын үнэлгээ</strong> — JLPT-ийн албан ёсны оноо биш.
                Жинхэнэ шалгалтад хэсэг бүр 60%-иас доошгүй байх шаардлагатай.
              </p>
              <p className="mt-2 text-[12.5px] text-sumi-500">
                Зарцуулсан хугацаа: {Math.round((Date.now() - startAt) / 60000)} мин · тэнцэх босго (жишиг): {bp.passTotal}/{scored.max}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {scored.sections.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-bold text-sumi-800">{s.name}</span>
                  <span className="font-mono text-[12.5px] font-bold tabnum text-sumi-500">
                    {s.correct}/{s.total} · {s.score}/{s.max}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-sumi-900/8">
                  <div className={cn("h-full rounded-full", s.score / s.max >= 0.6 ? "bg-matcha-500" : "bg-shu-500")}
                    style={{ width: `${(s.score / s.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-kin-200 bg-kin-50 p-4">
            <p className="text-[13.5px] font-extrabold text-kin-700">Хамгийн сул: {weakest.name}</p>
            <p className="mt-1 text-[12.5px] text-sumi-600">Санал болгож буй дараагийн алхам:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`quiz?mode=mixed&level=${level}`)}>Холимог дасгал</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("review")}>SRS давталт</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`reading?level=${level}`)}>Уншлага</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`listening?level=${level}`)}>Сонсгол</Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => { setStage("pick"); setResults([]); setSecIdx(0); }}>↺ Дахин өгөх</Button>
            <Button variant="ghost" onClick={() => navigate("progress")}>Ахицын шинжилгээ →</Button>
          </div>
        </Card>

        <Card>
          <SectionTitle jp="統計" title="Хугацааны хуваарилалт (жишиг)" />
          <div className="space-y-2.5 text-[13px]">
            {meta.minutes.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-32 shrink-0 font-bold text-sumi-600">{meta.minuteLabels[i]}</span>
                <span className="font-mono font-bold tabnum">{m} мин</span>
                <span className="text-[11.5px] text-sumi-400">— албан журамд</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-sumi-400">
            Хугацаа, бүтэц нь jlpt.jp дээрх албан мэдээлэлд тулгуурласан. Асуултын тоо
            нь дасгалын зориулалтаар багасгасан.
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
          <h2 className="mt-2 text-[1.4rem] font-extrabold">«{last.section.name}» хэсэг дууслаа</h2>
          <p className="mt-2 text-[13.5px] text-sumi-600">
            {last.correct} / {last.total} зөв · {Math.round((last.correct / last.total) * 100)}%
          </p>
          <p className="mt-4 rounded-xl bg-sumi-900/[0.045] px-4 py-3 text-[12.5px] leading-relaxed text-sumi-500">
            Тайлбар, зөв хариултыг шалгалтын дараа бүрэн харна. Одоо дараагийн хэсэг
            рүү шилжинэ үү.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => { setSecIdx(secIdx + 1); setStage("running"); }}>
              Дараагийн хэсэг: {sections[secIdx + 1]?.section.name} →
            </Button>
            <Button variant="ghost" onClick={() => setStage("final")}>Бүгдийг дуусгах</Button>
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
            Хэсэг {secIdx + 1}/{sections.length}: {current.section.name} ({current.section.jp})
          </span>
          <span className="ml-auto text-[12px] text-sumi-400">
            Зарцуулсан: {Math.round((Date.now() - startAt) / 60000)} мин
          </span>
        </div>
        <QuizRunner
          key={secIdx}
          questions={current.questions}
          options={{
            timed: current.section.minutes,
            reveal: false,
            title: `${bp.title} · ${current.section.name}`,
            sectionLabel: () => current.section.name,
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
        <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Жишиг JLPT шалгалт</h1>
        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-sumi-500">
          Жинхэнэ шалгалтын бүтэц, хэсгийн дараалал, таймертай. Асуулт бүр бодит
          өгөгдлийн сангаас үүснэ. Дуусахад хэсэг тус бүрийн оноо, сул тал,
          тэнцэх магадлалыг тооцоолно.
        </p>
        <p className="mt-3 rounded-xl bg-kin-50 px-4 py-3 text-[12.5px] leading-relaxed text-kin-700">
          ⚠️ Энэ нь <strong>дасгалын симуляц</strong> — JLPT-ийн албан ёсны оноо биш. Бодит
          шалгалтын асуулт, оноог бид гаргах эрхгүй. Жишиг шалгалт нь таны бэлэн
          байдлыг үнэлэх хэрэгсэл юм.
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
                {on && <Chip tone="shu">сонгосон</Chip>}
              </div>
              <p className="mt-1 text-[12px] font-bold text-sumi-600">{LEVEL_LABEL[l]}</p>
              <p className="mt-2 text-[11px] text-sumi-400">{m.kanji} ханз · {m.vocab} үг</p>
            </button>
          );
        })}
      </div>

      <Card>
        <SectionTitle jp="試験構成" title={`${bp.title} — бүтэц`} sub={`Нийт ${bp.sections.reduce((a, s) => a + s.count, 0)} асуулт · ${bp.minutes} минут`} />
        <div className="space-y-3">
          {bp.sections.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-sumi-900/8 bg-white/60 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sumi-900 font-mono text-[13px] font-bold text-washi-50">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-extrabold">{s.name} <span className="font-jp text-sumi-400">{s.jp}</span></p>
                <p className="mt-0.5 text-[12px] text-sumi-500">
                  {s.count} асуулт · {s.minutes} минут · дээд оноо {s.max}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-sumi-500">{bp.note}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" onClick={start} disabled={loading}>{loading ? "Бэлтгэж байна…" : "▶ Шалгалт эхлэх"}</Button>
          <Button variant="outline" size="lg" onClick={() => navigate(`quiz?level=${level}`)}>Эхлээд дасгал хийх</Button>
        </div>
      </Card>

      {doc.exams.length > 0 && (
        <Card>
          <SectionTitle jp="受験履歴" title="Өмнөх шалгалтууд" />
          <ul className="divide-y divide-sumi-900/8">
            {doc.exams.slice(0, 8).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <LevelBadge level={e.level} size="sm" />
                <span className="text-[13px] font-bold">{e.total}/{e.max}</span>
                <Chip tone={e.passed ? "matcha" : "shu"}>{e.passed ? "тэнцсэн" : "тэнцээгүй"}</Chip>
                <span className="text-[11.5px] text-sumi-400">
                  {new Date(e.at).toLocaleDateString("mn-MN")} · {e.minutes} мин
                </span>
                <span className="ml-auto text-[11.5px] text-sumi-400">
                  {e.sections.map((s) => `${s.name.slice(0, 6)} ${Math.round((s.score / s.max) * 100)}%`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loading && <Spinner label="Асуултууд үүсгэж байна…" />}
    </div>
  );
}

