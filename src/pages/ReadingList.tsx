import { useMemo, useState } from "react";
import { href, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { READING } from "../lib/data";
import type { Level } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { Button, Card, Chip, Empty, Input, LevelBadge } from "../components/ui";
import { ui } from "../lib/i18n";

export default function ReadingList() {
  const { query, set } = useQuery();
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const level = (query.level as Level) || "N3";
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let out = READING;
    if (query.all !== "1") out = out.filter((r) => r.level === level);
    const n = q.trim().toLowerCase();
    if (n) out = out.filter((r) => r.title.toLowerCase().includes(n) || r.titleJp.includes(n) ||
      r.body.join("").includes(n) || r.topic.toLowerCase().includes(n));
    return out;
  }, [level, q, query.all]);

  const done = doc.readingDone;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">読解</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.readingStudio}</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            {LEVEL_LABEL[language][level]} ({level}) · {list.length} {t.lessonsUnit} · {done.filter((id) => list.some((r) => r.id === id)).length} {t.doneUnit}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={query.all === "1" ? "primary" : "outline"} onClick={() => set({ all: query.all === "1" ? "" : "1" })}>
            {query.all === "1" ? t.allLevelsBtn : t.thisLevelBtn}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <Input value={q} onChange={setQ} placeholder={t.readingSearchPh} icon="🔎" className="max-w-md" />
      </Card>

      {list.length === 0 && (
        <Empty icon="読" title={t.noLessons}
          sub={t.noLessonsSub} />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const isDone = done.includes(r.id);
          return (
            <a key={r.id} href={href("reading", r.id)}
              className="card flex flex-col p-5 transition hover:-translate-y-1 hover:border-shu-300">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ai-50 font-mincho text-[19px] font-bold text-ai-600">読</span>
                <div className="flex flex-col items-end gap-1.5">
                  <LevelBadge level={r.level} size="sm" />
                  {isDone && <Chip tone="matcha">✓</Chip>}
                </div>
              </div>
              <h3 className="mt-3.5 font-jp text-[17px] font-bold leading-snug text-sumi-900">{r.titleJp}</h3>
              <p className="mt-1 text-[13px] font-semibold text-sumi-600">{r.title}</p>
              <p className="mt-2.5 line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-sumi-500">
                {r.body[0]?.replace(/\{([^|{}]+)\|([^}]+)\}/g, "$1").slice(0, 110)}…
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sumi-900/8 pt-3 text-[11.5px] text-sumi-400">
                <Chip tone="sumi">{r.topic}</Chip>
                <span>{r.minutes} {t.minutes}</span>
                <span className="ml-auto">{t.questionsN(r.questions.length)}</span>
              </div>
            </a>
          );
        })}
      </div>

    </div>
  );
}
