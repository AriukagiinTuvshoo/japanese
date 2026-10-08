import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { passageById } from "../lib/data";
import { stripFurigana } from "../lib/text";
import { XRayText } from "../components/XRayText";
import { Bar, Button, Card, Chip, Empty, LevelBadge, SectionTitle, SpeakButton, Tabs } from "../components/ui";

export default function ReadingDetail({ id }: { id: string }) {
  const { doc, actions } = useStore();
  const passage = passageById(id);
  const [tab, setTab] = useState<"text" | "questions" | "vocab">("text");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [showMn, setShowMn] = useState(true);
  const startRef = useRef(Date.now());

  useEffect(() => { setAnswers((passage?.questions ?? []).map(() => null)); setRevealed(false); }, [passage]);

  const correct = useMemo(
    () => (passage?.questions ?? []).reduce((a, q, i) => a + (answers[i] === q.a ? 1 : 0), 0),
    [passage, answers],
  );

  if (!passage) {
    return <Empty icon="読" title="Хичээл олдсонгүй" sub={id} action={<Button onClick={() => navigate("reading")}>← Уншлага</Button>} />;
  }

  const isDone = doc.readingDone.includes(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(`reading?level=${passage.level}`)}>← Уншлага</Button>
        <LevelBadge level={passage.level} size="sm" />
        <Chip tone="sumi">{passage.topic}</Chip>
        <span className="text-[12px] text-sumi-400">{passage.minutes} мин</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowMn((v) => !v)}>{showMn ? "Монгол нуух" : "Монгол харуулах"}</Button>
          {isDone
            ? <Button size="sm" variant="soft">✓ Дуусгасан</Button>
            : <Button size="sm" onClick={() => actions.markReading(id)}>✓ Дуусгах</Button>}
        </div>
      </div>

      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">読解 · {passage.level}</p>
        <h1 className="mt-1 font-jp text-[1.9rem] font-extrabold leading-tight tracking-tight">{passage.titleJp}</h1>
        <p className="mt-1.5 text-[14px] font-semibold text-sumi-600">{passage.title}</p>
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { id: "text", label: "Текст", icon: "文" },
        { id: "questions", label: "Асуулт", icon: "問", badge: passage.questions.length || undefined },
        { id: "vocab", label: "Үгийн сан", icon: "語", badge: passage.glossary.length || undefined },
      ]} />

      {tab === "text" && (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-sumi-900/8 px-5 py-3">
            <p className="text-[12px] font-bold text-sumi-500">
              Үг дээр дарж утгыг харна уу · «SRS-д нэмэх» товчоор давталтад оруулна
            </p>
            <SpeakButton text={passage.body.map(stripFurigana).join("。")} className="!h-8 !w-8" />
          </div>
          <div className="prose-jp p-6 sm:p-9">
            {passage.body.map((para, i) => (
              <p key={i} className="font-jp text-[17px] leading-[2.15] text-sumi-900">
                <XRayText text={para} showFurigana={doc.profile.furigana} />
              </p>
            ))}
          </div>
          {passage.source && (
            <p className="border-t border-sumi-900/8 px-6 py-3 text-[11.5px] text-sumi-400">Эх сурвалж: {passage.source}</p>
          )}
        </Card>
      )}

      {tab === "questions" && (
        <Card>
          <SectionTitle jp="質問" title="Асуултууд" sub="Текстийг дахин уншиж болно — «Текст» таб руу буцна уу." />
          <div className="space-y-5">
            {passage.questions.map((q, qi) => (
              <div key={qi} className="rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
                <p className="text-[14.5px] font-bold text-sumi-900">
                  <span className="mr-2 font-mono text-sumi-400">{qi + 1}.</span>{q.q}
                </p>
                {q.mn && <p className="mt-1 text-[12.5px] text-sumi-500">{q.mn}</p>}
                <div className="mt-3 space-y-2">
                  {q.opts.map((o, oi) => {
                    const picked = answers[qi] === oi;
                    const isRight = oi === q.a;
                    return (
                      <button key={oi} onClick={() => !revealed && setAnswers((a) => { const n = a.slice(); n[qi] = oi; return n; })}
                        className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition",
                          revealed && isRight ? "border-matcha-400 bg-matcha-50"
                            : revealed && picked ? "border-shu-400 bg-shu-50"
                              : picked ? "border-ai-400 bg-ai-50" : "border-sumi-900/10 bg-white/70 hover:border-ai-300")}>
                        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold",
                          revealed && isRight ? "bg-matcha-500 text-white" : picked ? "bg-ai-500 text-white" : "bg-sumi-900/6 text-sumi-500")}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {o}
                      </button>
                    );
                  })}
                </div>
                {revealed && q.why && (
                  <p className="mt-3 rounded-xl bg-sumi-900/[0.045] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-sumi-600">
                    {q.why}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!revealed ? (
              <Button onClick={() => setRevealed(true)} disabled={answers.every((a) => a === null)}>✓ Хариултаа шалгах</Button>
            ) : (
              <>
                <Chip tone={correct === passage.questions.length ? "matcha" : correct / passage.questions.length > 0.6 ? "kin" : "shu"}>
                  {correct} / {passage.questions.length} зөв
                </Chip>
                <Button variant="outline" onClick={() => { setAnswers(passage.questions.map(() => null)); setRevealed(false); }}>↺ Дахин</Button>
                {!isDone && <Button onClick={() => actions.markReading(id)}>✓ Хичээл дуусгах</Button>}
              </>
            )}
          </div>
          {revealed && (
            <div className="mt-4">
              <Bar value={correct / passage.questions.length} tone={correct / passage.questions.length > 0.6 ? "matcha" : "kin"} />
              <p className="mt-2 text-[11.5px] text-sumi-400">
                Зарцуулсан хугацаа: {Math.max(1, Math.round((Date.now() - startRef.current) / 60000))} мин
              </p>
            </div>
          )}
        </Card>
      )}

      {tab === "vocab" && (
        <Card>
          <SectionTitle jp="語彙" title="Энэ хичээлийн үгс" sub="Дарж SRS-д нэмээрэй." />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {passage.glossary.map((g, i) => (
              <div key={i} className="card-flat flex items-center gap-3 px-3.5 py-3">
                <span className="font-jp text-[16px] font-bold">{g.w}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-sumi-700">{g.mn}</span>
                  <span className="block font-jp text-[10.5px] text-sumi-400">{g.r}</span>
                </span>
                <SpeakButton text={g.w} className="!h-7 !w-7" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
