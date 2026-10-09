import { useMemo, useState } from "react";
import { href, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";
import { LISTENING } from "../lib/data";
import type { Level } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { Button, Card, Chip, Empty, Furigana, Input, LevelBadge } from "../components/ui";

export default function ListeningList() {
  const { query, set } = useQuery();
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const level = (query.level as Level) || "N5";
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let out = LISTENING;
    if (query.all !== "1") out = out.filter((l) => l.level === level);
    const n = q.trim().toLowerCase();
    if (n) out = out.filter((l) => l.title.toLowerCase().includes(n) || (l.titleEn ?? "").toLowerCase().includes(n) || (l.titleJp ?? "").includes(n) ||
      l.channel.toLowerCase().includes(n) || l.topic.toLowerCase().includes(n) || (l.topicEn ?? "").toLowerCase().includes(n) ||
      l.transcript.some((line) => line.ja.includes(n) || (line.mn ?? "").toLowerCase().includes(n) || (line.en ?? "").toLowerCase().includes(n)));
    return out;
  }, [level, q, query.all]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">聴解</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.listeningLib}</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            {LEVEL_LABEL[language][level]} ({level}) · {list.length} {t.lessonsUnit} · {doc.listeningDone.filter((id) => list.some((lesson) => lesson.id === id)).length} {t.doneUnit}
          </p>
        </div>
        <Button variant={query.all === "1" ? "primary" : "outline"} onClick={() => set({ all: query.all === "1" ? "" : "1" })}>
          {t.allLevelsShow}
        </Button>
      </div>

      <Card className="p-4">
        <Input value={q} onChange={setQ} placeholder={t.listenSearchPh} icon="🔎" className="max-w-md" />
        {list.some((lesson) => lesson.audioMode === "youtube") && (
          <p className="mt-3 rounded-xl bg-ai-50/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-ai-700">{t.ytNote}</p>
        )}
      </Card>

      {list.length === 0 && (
        <Empty icon="聴" title={t.lessonNotFound}
          sub={t.noLessonsThisLevel} />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((l) => {
          const isDone = doc.listeningDone.includes(l.id);
          return (
            <a key={l.id} href={href("listening", l.id)}
              className="card group flex flex-col overflow-hidden p-0 transition hover:-translate-y-1 hover:border-shu-300">
              <div className={`relative grid aspect-video place-items-center overflow-hidden ${l.youtubeId ? "bg-sumi-900" : "bg-ai-50"}`}>
                {l.youtubeId ? (
                  <img
                    src={`https://i.ytimg.com/vi/${l.youtubeId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-90 transition group-hover:scale-105 group-hover:opacity-100"
                  />
                ) : (
                  <span className="font-mincho text-5xl text-ai-500">聴</span>
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className={`grid h-12 w-12 place-items-center rounded-full text-[18px] text-white shadow-lg ${l.youtubeId ? "bg-shu-500/95" : "bg-ai-500/95"}`}>▶</span>
                </span>
                <span className="absolute bottom-2 right-2 rounded-md bg-sumi-950/80 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">
                  {l.minutes} {t.minutes}
                </span>
                {isDone && <span className="absolute left-2 top-2 rounded-md bg-matcha-500 px-1.5 py-0.5 text-[10.5px] font-bold text-white">✓</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-jp text-[15px] font-bold leading-snug">
                    <Furigana text={l.titleJpFuri ?? l.titleJp ?? l.title} show={doc.profile.furigana} />
                  </h3>
                  <LevelBadge level={l.level} size="sm" />
                </div>
                  <p className="mt-1 text-[12.5px] font-semibold text-sumi-600">{language === "en" ? (l.titleEn ?? l.title) : l.title}</p>
                <p className="mt-1.5 text-[11.5px] text-sumi-400">{l.audioMode === "tts" ? (language === "en" ? "Japanese speech practice" : "Япон ярианы дасгал") : l.channel}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-sumi-900/8 pt-3">
                  <Chip tone="sumi">{language === "en" ? (l.topicEn ?? l.topic) : l.topic}</Chip>
                  <Chip tone="ai">語 {l.vocab.length}</Chip>
                  <Chip tone="kin">問 {l.questions.length}</Chip>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
