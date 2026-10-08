import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";
import { lessonById } from "../lib/data";
import type { ListeningLesson } from "../lib/types";
import { FALLBACK_LESSONS } from "../data/listening-fallback";
import { stripFurigana } from "../lib/text";
import { Button, Card, Chip, Empty, LevelBadge, SectionTitle, SpeakButton, Tabs } from "../components/ui";
import { XRayText } from "../components/XRayText";

export default function ListeningDetail({ id }: { id: string }) {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const lesson: ListeningLesson | undefined = lessonById(id) ?? FALLBACK_LESSONS.find((l) => l.id === id);
  const [tab, setTab] = useState<"lesson" | "transcript" | "questions" | "shadow">("lesson");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [inView, setInView] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => { setAnswers((lesson?.questions ?? []).map(() => null)); setRevealed(false); }, [lesson]);

  useEffect(() => {
    // Видеог зөвхөн харагдах үед ачаална (хөнгөн, хурдан)
    const el = holder.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!lesson) {
    return <Empty icon="聴" title={t.lessonNotFound} sub={id} action={<Button onClick={() => navigate("listening")}>{t.backListening}</Button>} />;
  }

  const correct = lesson.questions.reduce((a, q, i) => a + (answers[i] === q.a ? 1 : 0), 0);
  const isDone = doc.listeningDone.includes(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(`listening?level=${lesson.level}`)}>{t.backListening}</Button>
        <LevelBadge level={lesson.level} size="sm" />
        <Chip tone="sumi">{lesson.topic}</Chip>
        <span className="text-[12px] text-sumi-400">{lesson.minutes} {t.minutes}</span>
        <div className="ml-auto flex gap-2">
          {isDone ? <Button size="sm" variant="soft">✓ Дуусгасан</Button>
            : <Button size="sm" onClick={() => actions.markListening(id)}>✓ Дуусгах</Button>}
        </div>
      </div>

      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">聴解 · {lesson.level}</p>
        <h1 className="mt-1 font-jp text-[1.8rem] font-extrabold leading-tight tracking-tight">{lesson.titleJp ?? lesson.title}</h1>
        <p className="mt-1.5 text-[14px] font-semibold text-sumi-600">{lesson.title}</p>
        <p className="mt-1 text-[12.5px] text-sumi-400">{lesson.channel}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="overflow-hidden p-0" >
            <div ref={holder} className="aspect-video w-full bg-sumi-900">
              {inView ? (
                <iframe
                  title={lesson.title}
                  src={`https://www.youtube.com/embed/${lesson.youtubeId}?rel=0&modestbranding=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full"
                />
              ) : (
                <div className="grid h-full place-items-center text-[13px] text-washi-300">{t.videoLoading}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-sumi-900/8 px-4 py-3">
              <div className="flex items-center gap-1 rounded-xl bg-sumi-900/5 p-1">
                {[0.75, 1, 1.25, 1.5].map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={cn("rounded-lg px-2.5 py-1.5 font-mono text-[11.5px] font-bold transition",
                      speed === s ? "bg-white text-sumi-900 shadow-sm" : "text-sumi-500 hover:text-sumi-800")}>
                    {s}×
                  </button>
                ))}
              </div>
              <span className="text-[11.5px] text-sumi-400">
                {t.speedNote}
              </span>
              <a href={`https://www.youtube.com/watch?v=${lesson.youtubeId}`} target="_blank" rel="noreferrer noopener"
                className="ml-auto text-[12px] font-bold text-ai-600 underline underline-offset-4">
                YouTube дээр нээх ↗
              </a>
            </div>
          </Card>

          <Tabs value={tab} onChange={setTab} items={[
            { id: "lesson", label: "Хичээл", icon: "学" },
            { id: "transcript", label: "Транскрипт", icon: "文", badge: lesson.transcript.length || undefined },
            { id: "questions", label: "Асуулт", icon: "問", badge: lesson.questions.length || undefined },
            { id: "shadow", label: "Дуу дагах", icon: "影" },
          ]} />

          {tab === "transcript" && (
            <Card>
              <SectionTitle jp="スクリプト" title="Транскрипт"
                sub="Үг дээр дарж утгыг хараад SRS-д нэмээрэй. Текст нь хичээлийн бодит агуулгаас." />
              <div className="space-y-3.5">
                {lesson.transcript.map((line, i) => (
                  <div key={i} className="flex items-start gap-3 border-b border-sumi-900/6 pb-3.5 last:border-0">
                    <button
                      onClick={() => {
                        const u = new SpeechSynthesisUtterance(stripFurigana(line.ja));
                        u.lang = "ja-JP";
                        u.rate = 0.9;
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                      }}
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-sumi-900/10 bg-white/70 text-[12px] text-sumi-500 hover:border-ai-400 hover:text-ai-600"
                      title={t.readAloud}>
                      🔊
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px] leading-relaxed">
                        <XRayText text={line.ja} showFurigana={doc.profile.furigana} />
                      </p>
                      {line.mn && <p className="mt-1 text-[13px] font-semibold text-sumi-700">{line.mn}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "questions" && (
            <Card>
              <SectionTitle jp="質問" title={t.compQuestions} />
              {lesson.questions.length === 0 ? <Empty icon="問" title={t.noQuestions} /> : (
                <>
                  <div className="space-y-5">
                    {lesson.questions.map((q, qi) => (
                      <div key={qi} className="rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
                        <p className="text-[14.5px] font-bold">
                          <span className="mr-2 font-mono text-sumi-400">{qi + 1}.</span>{q.q}
                        </p>
                        {q.mn && <p className="mt-1 text-[12.5px] text-sumi-500">{q.mn}</p>}
                        <div className="mt-3 space-y-2">
                          {q.opts.map((o, oi) => {
                            const picked = answers[qi] === oi;
                            const right = oi === q.a;
                            return (
                              <button key={oi}
                                onClick={() => !revealed && setAnswers((a) => { const n = a.slice(); n[qi] = oi; return n; })}
                                className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition",
                                  revealed && right ? "border-matcha-400 bg-matcha-50"
                                    : revealed && picked ? "border-shu-400 bg-shu-50"
                                      : picked ? "border-ai-400 bg-ai-50" : "border-sumi-900/10 bg-white/70 hover:border-ai-300")}>
                                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold",
                                  revealed && right ? "bg-matcha-500 text-white" : picked ? "bg-ai-500 text-white" : "bg-sumi-900/6 text-sumi-500")}>
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                {o}
                              </button>
                            );
                          })}
                        </div>
                        {revealed && q.why && <p className="mt-3 rounded-xl bg-sumi-900/[0.045] px-3.5 py-2.5 text-[12.5px] text-sumi-600">{q.why}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {!revealed ? (
                      <Button onClick={() => setRevealed(true)} disabled={answers.every((a) => a === null)}>{t.checkBtn}</Button>
                    ) : (
                      <>
                        <Chip tone={correct === lesson.questions.length ? "matcha" : "kin"}>{t.correctN(correct, lesson.questions.length)}</Chip>
                        <Button variant="outline" onClick={() => { setAnswers(lesson.questions.map(() => null)); setRevealed(false); }}>{t.retake}</Button>
                        {!isDone && <Button onClick={() => actions.markListening(id)}>{t.finishLesson}</Button>}
                      </>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "shadow" && (
            <Card>
              <SectionTitle jp="シャドーイング" title="Дуу дагах (shadowing)"
                sub="1. Сонсох → 2. Дагаж хэлэх → 3. Бичиж авах → 4. Харьцуулах" />
              <div className="space-y-3">
                {(lesson.shadowing?.length ? lesson.shadowing : lesson.transcript.slice(0, 6).map((t) => stripFurigana(t.ja))).map((line, i) => (
                  <ShadowRow key={i} text={line} index={i} />
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-ai-100 bg-ai-50/60 p-4 text-[12.5px] leading-relaxed text-ai-700">
                <p className="font-bold">{t.howToShadow}</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>Дээрх 🔊 товчоор мөр бүрийг сонсоод, дуугаа оруулах 💬 товчоор давтан хэл</li>
                  <li>Хөтөч микрофоныг асуух болно — зөвшөөрнө үү</li>
                  <li>Бичлэгээ эргүүлж сонсоод, эх дуудлагатай харьцуул</li>
                  <li>Тод дуудлага, урт гийгүүлэгчид (っ), удаан эгшигт анхаар</li>
                </ol>
              </div>
            </Card>
          )}

          {tab === "lesson" && (
            <Card>
              <SectionTitle jp="この動画について" title={t.aboutLesson} />
              <p className="text-[13.5px] leading-relaxed text-sumi-600">
                {lesson.channel} сувгийн видеог ашиглан {lesson.level} түвшний сонсголын дасгал.
                Транскрипт, үгийн сан, асуултууд нь бидний боловсруулсан нэмэлт сургалтын материал —
                видеоны эрх нь эзэндээ хадгалагдана.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { l: "Түвшин", v: lesson.level },
                  { l: "Сэдэв", v: lesson.topic },
                  { l: "Үргэлжлэх", v: `${lesson.minutes} мин` },
                ].map((x) => (
                  <div key={x.l} className="card-flat px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
                    <p className="mt-1 text-[14px] font-extrabold">{x.v}</p>
                  </div>
                ))}
              </div>
              {lesson.channelUrl && (
                <a href={lesson.channelUrl} target="_blank" rel="noreferrer noopener"
                  className="mt-4 inline-block text-[12.5px] font-bold text-ai-600 underline underline-offset-4">
                  {t.viewChannel}
                </a>
              )}
            </Card>
          )}
        </div>

        {/* ── хажуугийн самбар ── */}
        <div className="space-y-5">
          <Card>
            <p className="text-[13px] font-extrabold">{t.lessonWords}</p>
            <p className="mt-1 text-[11.5px] text-sumi-500">{t.tapToSrs}</p>
            <div className="mt-3 space-y-2">
              {lesson.vocab.map((v, i) => {
                const inSrs = Object.values(doc.srs).length > 0;
                void inSrs;
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl bg-sumi-900/[0.04] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-jp text-[14.5px] font-bold">{v.w}</p>
                      <p className="font-jp text-[11px] text-sumi-400">{v.r}</p>
                    </div>
                    <span className="max-w-[130px] truncate text-[12px] text-sumi-600">{v.mn}</span>
                    <SpeakButton text={v.w} className="!h-7 !w-7" />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <p className="text-[13px] font-extrabold">{t.nextSteps}</p>
            <div className="mt-3 space-y-2">
              <a href={href("quiz", { mode: "vocab-listen", level: lesson.level } as never)} className="block text-[12.5px] font-bold text-ai-600 underline underline-offset-4">
                {t.listeningDrillLink}
              </a>
              <a href={href("reading", undefined)} className="block text-[12.5px] font-bold text-ai-600 underline underline-offset-4">
                {t.readingLessonLink}
              </a>
              <a href={href("listening")} className="block text-[12.5px] font-bold text-ai-600 underline underline-offset-4">
                {t.moreListeningLink}
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ShadowRow({ text, index }: { text: string; index: number }) {
  const { doc } = useStore();
  const t = ui[doc.profile.language ?? "mn"];
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError(t.micDenied);
    }
  };

  const stop = () => { rec.current?.stop(); setRecording(false); };

  return (
    <div className="rounded-xl border border-sumi-900/10 bg-white/60 p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sumi-900/6 font-mono text-[11px] font-bold text-sumi-500">{index + 1}</span>
        <p className="min-w-0 flex-1 font-jp text-[14.5px] font-semibold">{text}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <SpeakButton text={text} className="!h-7 !w-auto !px-2.5" label={t.listen} />
        {!recording ? (
          <Button size="sm" variant="outline" onClick={start}>{t.recordBtn}</Button>
        ) : (
          <Button size="sm" variant="danger" onClick={stop} className="animate-pulse">{t.stopBtn}</Button>
        )}
        {audioUrl && <audio src={audioUrl} controls className="h-8 max-w-[190px]" />}
        {error && <span className="text-[11.5px] font-bold text-shu-600">{error}</span>}
      </div>
    </div>
  );
}
