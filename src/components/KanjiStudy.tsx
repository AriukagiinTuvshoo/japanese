import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../lib/store";
import type { Kanji, Level, StrokeMap } from "../lib/types";
import { isDue, isMastered } from "../lib/srs";
import { selectKanjiSession } from "../lib/kanjiSession";
import { Session, kanjiToItem, type SessionItem } from "./Session";
import { Button, Card, SectionTitle } from "./ui";

/**
 * Ханзны SRS сесс.
 * · Эхлээд хугацаа болсон (due) ханз.
 * · Хугацаа болоогүй ханзыг дахин үнэлэхгүй — эс бөгөөс интервал хиймлээр уртасна.
 * · Үлдсэн байрыг зөвхөн шинэ ханз нөхнө; «Зөвхөн due» горимд шинэ ханз орохгүй.
 */
export function KanjiStudy({ level, items, strokes }: { level: Level; items: Kanji[]; strokes: StrokeMap }) {
  const { doc } = useStore();
  const [count, setCount] = useState(15);
  const [onlyDue, setOnlyDue] = useState(false);
  const [run, setRun] = useState<SessionItem[] | null>(null);

  const dueCount = useMemo(
    () => items.filter((k) => {
      const c = doc.srs[k.k];
      return !!c && c.ph !== "new" && isDue(c);
    }).length,
    [items, doc.srs],
  );

  const studied = items.filter((k) => doc.srs[k.k]).length;
  const mastered = items.filter((k) => isMastered(doc.srs[k.k])).length;
  const withStrokes = items.filter((k) => strokes[k.k]).length;

  const start = () => {
    const picked = selectKanjiSession(items, doc.srs, count, onlyDue);
    if (!picked.length) return;
    setRun(picked.map((k) => kanjiToItem(k, "jp-mn")));
  };

  if (run) return <Session items={run} onExit={() => setRun(null)} direction="jp-mn" />;

  const canStart = items.length > 0 && (!onlyDue || dueCount > 0);

  return (
    <Card>
      <SectionTitle jp="漢字セッション" title="Ханзны суралцах сесс"
        sub={`${level} түвшний ${items.length} ханз — ${studied} судалсан, ${dueCount} давтах, ${withStrokes} бичих дараалалтай.`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12.5px] font-bold text-sumi-700">Ханзны тоо: <span className="font-mono tabnum">{count}</span></span>
          <input type="range" min={5} max={40} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full" />
        </label>
        <div className="flex items-end">
          <Button size="lg" className="w-full" onClick={start} disabled={!canStart}>▶ Эхлэх</Button>
        </div>
      </div>

      <button
        onClick={() => setOnlyDue((v) => !v)}
        aria-pressed={onlyDue}
        className={cn("mt-4 flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition",
          onlyDue ? "border-ai-400 bg-ai-50" : "border-sumi-900/10 bg-white/70 hover:border-sumi-900/25")}
      >
        <span>
          <span className="block text-[12.5px] font-bold text-sumi-800">Зөвхөн хугацаа болсон</span>
          <span className="block text-[11px] text-sumi-500">Шинэ ханз орохгүй — зөвхөн давталт</span>
        </span>
        <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", onlyDue ? "bg-ai-500" : "bg-sumi-900/20")}>
          <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-all", onlyDue ? "left-5" : "left-1")} />
        </span>
      </button>
      <p className="mt-2 text-[11.5px] leading-relaxed text-sumi-500">
        {onlyDue
          ? "Зөвхөн хугацаа болсон ханз давтагдана. Одоо 0 байвал сесс эхлэхгүй."
          : "Хугацаа болсон ханз эхэлж, үлдсэнийг нь шинэ ханз нөхнө. Хугацаа болоогүй ханз давтагдахгүй."}
      </p>

      <div className="mt-5 grid gap-2 text-[12.5px] text-sumi-600 sm:grid-cols-3">
        <div className="rounded-xl bg-sumi-900/4 px-3.5 py-3">
          <p className="font-bold">Суралцсан</p>
          <p className="mt-1 font-mono text-[18px] font-extrabold tabnum">{studied}</p>
        </div>
        <div className="rounded-xl bg-sumi-900/4 px-3.5 py-3">
          <p className="font-bold">Бичиж үзсэн</p>
          <p className="mt-1 font-mono text-[18px] font-extrabold tabnum">{Object.keys(doc.writing).filter((c) => items.some((k) => k.k === c)).length}</p>
        </div>
        <div className="rounded-xl bg-sumi-900/4 px-3.5 py-3">
          <p className="font-bold">Эзэмшсэн</p>
          <p className="mt-1 font-mono text-[18px] font-extrabold tabnum">{mastered}</p>
        </div>
      </div>
    </Card>
  );
}
