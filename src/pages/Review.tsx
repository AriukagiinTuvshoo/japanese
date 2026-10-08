import { useEffect, useMemo, useState } from "react";
import { useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData, shuffle } from "../lib/data";
import type { Kanji, Level, Vocab } from "../lib/types";
import { dueCards, memoryStats } from "../lib/srs";
import { Empty, Spinner, Tabs } from "../components/ui";
import { Session, vocabToItem, kanjiToItem, type SessionItem } from "../components/Session";

type Mode = "due" | "weak" | "new" | "fav" | "mistakes";

export default function Review() {
  const { doc } = useStore();
  const { query, set } = useQuery();
  const mode = (query.mode as Mode) || "due";
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [limit, setLimit] = useState(25);

  const due = useMemo(() => dueCards(doc.srs), [doc.srs]);
  const mem = useMemo(() => memoryStats(doc.srs), [doc.srs]);

  useEffect(() => {
    setItems(null);
    let alive = true;
    loadFullData().then((data) => {
      if (!alive) return;
      const out: SessionItem[] = [];
      const pushVocab = (v: Vocab) => out.push(vocabToItem(v, "jp-mn"));
      const pushKanji = (k: Kanji) => out.push(kanjiToItem(k, "jp-mn"));

      if (mode === "due") {
        for (const [id] of due) {
          const v = data.byId.get(id);
          if (v) { pushVocab(v); continue; }
          const k = data.kanjiByChar.get(id);
          if (k) pushKanji(k);
        }
      } else if (mode === "weak") {
        const weak = Object.entries(doc.srs)
          .filter(([, c]) => (c.st < 6 && c.n > 0) || c.l > 1)
          .sort((a, b) => a[1].st - b[1].st)
          .slice(0, 60);
        for (const [id] of weak) {
          const v = data.byId.get(id);
          if (v) { pushVocab(v); continue; }
          const k = data.kanjiByChar.get(id);
          if (k) pushKanji(k);
        }
      } else if (mode === "new") {
        const lvl = (query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);
        const pool = shuffle(data.vocabByLevel[lvl].filter((v) => !doc.srs[v.id])).slice(0, limit);
        pool.forEach(pushVocab);
      } else if (mode === "fav") {
        for (const id of doc.favorites) {
          const v = data.byId.get(id);
          if (v) { pushVocab(v); continue; }
          const k = data.kanjiByChar.get(id);
          if (k) pushKanji(k);
        }
      } else if (mode === "mistakes") {
        for (const m of doc.mistakes.slice(0, 60)) {
          const v = data.byId.get(m.id);
          if (v) { pushVocab(v); continue; }
          const k = data.kanjiByChar.get(m.id);
          if (k) pushKanji(k);
        }
      }
      setItems(out.slice(0, limit));
    });
    return () => { alive = false; };
  }, [mode, due, doc.srs, doc.favorites, doc.mistakes, limit, query.level, doc.profile.current, doc.profile.target]);

  const modes: { id: Mode; label: string; badge?: number }[] = [
    { id: "due", label: "Хугацаа хэтэрсэн", badge: due.length },
    { id: "weak", label: "Сул карт" },
    { id: "new", label: "Шинэ үг" },
    { id: "fav", label: "Дуртай", badge: doc.favorites.length },
    { id: "mistakes", label: "Алдааны дэвтэр", badge: doc.mistakes.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">間隔反復</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Давталт (SRS)</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            FSRS-д суурилсан хуваарь · {due.length} карт хугацаа хэтэрсэн · нийт {Object.keys(doc.srs).length.toLocaleString()} карт
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Хугацаа хэтэрсэн", v: due.length, tone: "shu" as const },
          { l: "Өнөөдөр давтсан", v: Object.values(doc.srs).filter((c) => c.last >= new Date().setHours(0, 0, 0, 0)).length, tone: "matcha" as const },
          { l: "Эзэмшсэн", v: mem.mastered, tone: "ai" as const },
          { l: "Нийт давталт", v: mem.reviews, tone: "kin" as const },
        ].map((x) => (
          <div key={x.l} className="card-flat px-4 py-3.5">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
            <p className="mt-1 font-mono text-[1.35rem] font-extrabold tabnum leading-none"
              style={{ color: `var(--color-${x.tone}-600)` }}>{x.v.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <Tabs value={mode} onChange={(m) => set({ mode: m })} items={modes} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 text-[12.5px] font-bold text-sumi-600">
          Сессийн хязгаар
          <input type="range" min={10} max={100} step={5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-40" />
          <span className="font-mono tabnum">{limit}</span>
        </label>
      </div>

      {!items && <Spinner label="Картуудыг бэлтгэж байна…" />}

      {items && items.length === 0 && (
        <Empty
          icon="空"
          title={mode === "due" ? "Одоогоор давтах карт алга 🎉" : "Карт олдсонгүй"}
          sub={mode === "due"
            ? "Бүх карт хуваарийн дагуу байна. Шинэ үг сурч эхлэхэд тохиромжтой."
            : mode === "fav" ? "Үг эсвэл ханз дээр ★ дарж дуртайд нэмээрэй."
            : mode === "mistakes" ? "Дасгал хийж эхлэхэд алдаанууд энд хуримтлагдана."
            : "Энэ горимд карт үүсээгүй байна."}
        />
      )}

      {items && items.length > 0 && <Session items={items} onExit={() => set({ mode: "" })} />}
    </div>
  );
}
