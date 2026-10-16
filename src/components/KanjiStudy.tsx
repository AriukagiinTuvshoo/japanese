import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { pick } from "../lib/data";
import type { Kanji, Level, StrokeMap } from "../lib/types";
import { Session, kanjiToItem } from "./Session";
import { Button, Card, SectionTitle } from "./ui";

/** Ханзны SRS сесс — ханз + бичих дасгалыг хослуулна. */
export function KanjiStudy({ level, items, strokes }: { level: Level; items: Kanji[]; strokes: StrokeMap }) {
  const { doc } = useStore();
  const [count, setCount] = useState(15);
  const [run, setRun] = useState(false);

  const session = useMemo(() => {
    if (!run) return [];
    const known = new Set(Object.keys(doc.srs));
    const fresh = pick(items.filter((k) => !known.has(k.k)), Math.ceil(count / 2));
    const review = pick(items.filter((k) => known.has(k.k)), Math.ceil(count / 2));
    return [...fresh, ...review].slice(0, count).map((k) => kanjiToItem(k, "jp-mn"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, count, items]);

  if (run) return <Session items={session} onExit={() => setRun(false)} direction="jp-mn" />;

  const studied = items.filter((k) => doc.srs[k.k]).length;
  const withStrokes = items.filter((k) => strokes[k.k]).length;

  return (
    <Card>
      <SectionTitle jp="漢字セッション" title="Ханзны суралцах сесс"
        sub={`${level} түвшний ${items.length} ханз — ${studied} судалсан, ${withStrokes} бичих дараалалтай.`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12.5px] font-bold text-sumi-700">Ханзны тоо: <span className="font-mono tabnum">{count}</span></span>
          <input type="range" min={5} max={40} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-2 w-full" />
        </label>
        <div className="flex items-end">
          <Button size="lg" className="w-full" onClick={() => setRun(true)} disabled={items.length === 0}>▶ Эхлэх</Button>
        </div>
      </div>
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
          <p className="mt-1 font-mono text-[18px] font-extrabold tabnum">{items.filter((k) => (doc.srs[k.k]?.st ?? 0) >= 21).length}</p>
        </div>
      </div>
    </Card>
  );
}
