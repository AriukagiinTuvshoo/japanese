import { useEffect, useMemo, useState } from "react";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadGrammar } from "../lib/data";
import type { Grammar, Level } from "../lib/types";
import { LEVEL_LABEL, stripFurigana } from "../lib/text";
import { Button, Card, Chip, Empty, Furigana, LevelBadge, SectionTitle, SpeakButton, Spinner, Tabs } from "../components/ui";

export default function GrammarDetail({ id }: { id: string }) {
  const { doc, actions } = useStore();
  const [items, setItems] = useState<Grammar[] | null>(null);
  const [tab, setTab] = useState<"detail" | "compare" | "examples">("detail");
  const [, setLevel] = useState<Level | null>(null);

  useEffect(() => {
    (async () => {
      for (const l of ["N5", "N4", "N3", "N2", "N1"] as Level[]) {
        const list = await loadGrammar(l);
        if (list.some((g) => g.id === id)) { setItems(list); setLevel(l); return; }
      }
      setItems([]);
    })();
  }, [id]);

  const g = items?.find((x) => x.id === id);
  const done = doc.grammarDone.includes(id);

  const similar = useMemo(() => {
    if (!g || !items) return [];
    const core = g.p.replace(/[〜~]/g, "");
    const head = core.slice(0, Math.max(1, Math.ceil(core.length / 2)));
    return items.filter((x) => x.id !== g.id && (x.p.includes(head) || x.p.replace(/[〜~]/g, "").includes(head))).slice(0, 6);
  }, [g, items]);

  if (!items) return <Spinner label="Дүрэм ачаалж байна…" />;
  if (!g) return <Empty icon="無" title="Дүрэм олдсонгүй" sub={id} action={<Button onClick={() => navigate("grammar")}>← Дүрэм</Button>} />;

  const en = Array.isArray(g.en) ? g.en.join("; ") : String(g.en ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(`grammar?level=${g.lvl}`)}>← Дүрэм</Button>
        <span className="text-[12px] text-sumi-400">{LEVEL_LABEL[g.lvl]} ({g.lvl})</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={done ? "soft" : "outline"} onClick={() => actions.toggleGrammar(g.id, g.lvl)}>
            {done ? "✓ Үзсэн" : "Үзсэн гэж тэмдэглэх"}
          </Button>
          <Button size="sm" onClick={() => navigate(`quiz?mode=grammar-mn&level=${g.lvl}`)}>文 Дасгал</Button>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge level={g.lvl} />
          <Chip tone="murasaki">Дүрэм</Chip>
          {g.jlpt !== g.lvl && <Chip tone="sumi">JLPT {g.jlpt}</Chip>}
        </div>
        <h1 className="mt-4 font-jp text-[2.1rem] font-extrabold leading-tight">{g.p}</h1>
        {g.mn ? (
          <p className="mt-4 text-[1.15rem] font-bold leading-relaxed text-sumi-900">{g.mn}</p>
        ) : (
          <p className="mt-4 text-[1.1rem] font-semibold text-sumi-500">
            {en || "Монгол тайлбар хараахан хянагдаагүй."}
          </p>
        )}
        {g.note && (
          <div className="mt-4 rounded-2xl border border-ai-100 bg-ai-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ai-600">Ялгаа · нюанс</p>
            <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ai-700">{g.note}</p>
          </div>
        )}
        {!g.mn && en && (
          <p className="mt-3 text-[13px] text-sumi-500">Англи эх сурвалж: {en}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`quiz?mode=grammar-mn&level=${g.lvl}`)}>Утгын дасгал</Button>
          <a href={href("admin")} className="inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-bold text-sumi-500 hover:bg-sumi-900/6">Тайлбар сайжруулах →</a>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={[
        { id: "detail", label: "Хэрэглээ", icon: "用" },
        { id: "examples", label: "Жишээ", icon: "例", badge: g.ex.length || undefined },
        { id: "compare", label: "Харьцуулалт", icon: "比", badge: similar.length || undefined },
      ]} />

      {tab === "detail" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle jp="形" title="Бүтэц" />
            {g.form ? (
              <p className="rounded-xl bg-sumi-900/[0.045] px-4 py-3 font-jp text-[14px] leading-relaxed">{g.form}</p>
            ) : (
              <p className="text-[13px] text-sumi-500">Бүтцийн мэдээлэл хараахан байхгүй.</p>
            )}
            <div className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between border-b border-sumi-900/6 pb-2.5">
                <span className="font-bold text-sumi-500">Түвшин</span>
                <span className="font-semibold">{g.lvl} — {LEVEL_LABEL[g.lvl]}</span>
              </div>
              <div className="flex justify-between border-b border-sumi-900/6 pb-2.5">
                <span className="font-bold text-sumi-500">Холбоотой дүрэм</span>
                <span className="font-semibold">{g.related.length || similar.length || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-sumi-500">Эх сурвалж</span>
                <span className="font-semibold">OpenJLPT (CC-BY-SA-4.0)</span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle jp="よくある間違い" title="Түгээмэл алдаа" />
            {g.note ? (
              <p className="text-[13.5px] leading-relaxed text-sumi-700">{g.note}</p>
            ) : (
              <p className="text-[13px] text-sumi-500">
                Энэ дүрмийн түгээмэл алдааны тайлбар хараахан нэмэгдээгүй. Та
                <a href={href("admin")} className="mx-1 font-bold text-ai-600 underline underline-offset-4">контент удирдлага</a>
                хэсгээс нэмж болно.
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === "examples" && (
        <Card>
          <SectionTitle jp="例文" title="Жишээ өгүүлбэр" />
          {g.ex.length === 0 ? <Empty icon="例" title="Жишээ байхгүй" /> : (
            <ul className="space-y-3">
              {g.ex.map((e, i) => (
                <li key={i} className="rounded-xl border border-sumi-900/8 bg-white/60 p-4">
                  <div className="flex items-start gap-3">
                    <Furigana text={e.fg ?? e.ja ?? ""} show={doc.profile.furigana} className="flex-1 text-[16px] font-semibold leading-relaxed" />
                    {e.ja && <SpeakButton text={stripFurigana(e.ja)} />}
                  </div>
                  {e.mn && <p className="mt-2 text-[13.5px] font-semibold text-sumi-800">Монгол: {e.mn}</p>}
                  {e.en && <p className="mt-1 text-[12.5px] text-sumi-500">{e.en}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "compare" && (
        <Card>
          <SectionTitle jp="比較" title="Төстэй дүрмүүд" sub="Ижил төгсгөлтэй дүрмүүдийг харьцуулж үзвэл ялгаа нь тодрох болно." />
          {similar.length === 0 ? <Empty icon="比" title="Төстэй дүрэм олдсонгүй" /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {similar.map((s) => (
                <a key={s.id} href={href("grammar", s.id)} className="card-flat p-4 transition hover:-translate-y-0.5 hover:border-shu-300">
                  <div className="flex items-center gap-2">
                    <span className="font-jp text-[15px] font-bold">{s.p}</span>
                    <LevelBadge level={s.lvl} size="sm" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-sumi-700">
                    {s.mn ?? (Array.isArray(s.en) ? s.en.join("; ") : String(s.en ?? ""))}
                  </p>
                </a>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
