import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadGrammar } from "../lib/data";
import type { Grammar, Level } from "../lib/types";
import { grammarLabel, LEVEL_LABEL } from "../lib/text";
import { Bar, Card, Chip, Empty, Input, LevelBadge, Pager, Select, Spinner } from "../components/ui";
import { MN_PENDING, ui } from "../lib/i18n";

const PER_PAGE = 40;

export default function GrammarList() {
  const { query } = useQuery();
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const level = (query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);
  const [items, setItems] = useState<Grammar[] | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"all" | "todo" | "done">("all");
  const [sort, setSort] = useState<"default" | "pattern">("default");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setItems(null);
    loadGrammar(level).then(setItems);
    setPage(1);
  }, [level]);

  const filtered = useMemo(() => {
    if (!items) return [];
    let out = items;
    const n = q.trim().toLowerCase();
    if (n) out = out.filter((g) => g.p.toLowerCase().includes(n) ||
      (g.mn ?? "").toLowerCase().includes(n) || g.note?.toLowerCase().includes(n) ||
      (Array.isArray(g.en) ? g.en.join(" ") : String(g.en ?? "")).toLowerCase().includes(n) ||
      g.ex.some((e) => (e.ja ?? "").includes(n)));
    if (state === "done") out = out.filter((g) => doc.grammarDone.includes(g.id));
    if (state === "todo") out = out.filter((g) => !doc.grammarDone.includes(g.id));
    if (sort === "pattern") out = out.slice().sort((a, b) => a.p.localeCompare(b.p, "ja"));
    return out;
  }, [items, q, state, sort, doc.grammarDone]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const doneCount = items?.filter((g) => doc.grammarDone.includes(g.id)).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">文法</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.grammar}</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            {LEVEL_LABEL[language][level]} ({level}) · {items ? t.grammarCountN(items.length) : "…"} · {doneCount} {t.seenUnit}
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t.grammarSearchPh} icon="🔎" className="min-w-[200px] flex-1" />
          <Select value={state} onChange={(v) => { setState(v); setPage(1); }}
            options={[{ id: "all", label: t.allF }, { id: "todo", label: t.unseen }, { id: "done", label: t.seen }]} />
          <Select value={sort} onChange={setSort}
            options={[{ id: "default", label: t.defaultOrder }, { id: "pattern", label: t.sortByKana }]} />
        </div>
        {items && (
          <div className="mt-4">
            <div className="flex justify-between text-[12.5px] font-bold text-sumi-600">
              <span>{t.levelProgress}</span>
              <span className="font-mono tabnum">{doneCount}/{items.length}</span>
            </div>
            <Bar value={doneCount / Math.max(1, items.length)} tone="murasaki" className="mt-2" />
          </div>
        )}
      </Card>

      {!items && <Spinner label={t.loadingGrammar} lang={language} />}
      {items && filtered.length === 0 && <Empty icon="無" title={t.grammarNotFound} />}

      {filtered.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((g) => (
            <GrammarCard key={g.id} g={g} done={doc.grammarDone.includes(g.id)} onToggle={() => actions.toggleGrammar(g.id, g.lvl)} />
          ))}
        </div>
      )}

      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}

function GrammarCard({ g, done, onToggle }: { g: Grammar; done: boolean; onToggle: () => void }) {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const en = Array.isArray(g.en) ? g.en.join("; ") : String(g.en ?? "");
  return (
    <div className={cn("card-flat p-4 transition hover:-translate-y-0.5 hover:border-shu-300", done && "border-matcha-200 bg-matcha-50/40")}>
      <div className="flex items-start gap-3">
        <a href={href("grammar", g.id)} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-jp text-[1.15rem] font-bold text-sumi-900">{grammarLabel(g.p)}</span>
            <LevelBadge level={g.lvl} size="sm" />
            {done && <Chip tone="matcha">{t.seenChip}</Chip>}
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-relaxed text-sumi-800">
            {language === "en"
              ? (en || <span className="text-sumi-400">{MN_PENDING}</span>)
              : (g.mn ?? <span className="text-sumi-400">{en || MN_PENDING}</span>)}
          </p>
          {g.ex[0]?.ja && (
            <p className="mt-2 line-clamp-1 font-jp text-[12.5px] text-sumi-500">{g.ex[0].ja}</p>
          )}
        </a>
        <button onClick={onToggle}
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[13px] transition",
            done ? "border-matcha-300 bg-matcha-500 text-white" : "border-sumi-900/12 bg-white/70 text-sumi-400 hover:border-matcha-400")}
          title={done ? t.unmarkSeen : t.markSeen}>
          ✓
        </button>
      </div>
    </div>
  );
}
