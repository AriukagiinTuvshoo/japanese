import { useCallback, useEffect, useState } from "react";
import { api, apiBase, type AdminOverview, type QueueItem } from "../lib/api";
import { navigate } from "../lib/router";
import { Button, Card, Chip, ErrorBox, Input, PageHeader, Select, SectionTitle, Spinner, Stat, Tabs } from "../components/ui";
import { ui } from "../lib/i18n";
import { useStore } from "../lib/store";

type Tab = "overview" | "queue" | "import";

const ORIGIN_LABEL: Record<QueueItem["origin"], { text: string; tone: "matcha" | "kin" | "ai" | "sumi" }> = {
  human: { text: "Хүний бичсэн", tone: "matcha" },
  auto: { text: "Авто санал", tone: "kin" },
  derived: { text: "Ханзнаас", tone: "kin" },
  ai: { text: "AI санал · pending", tone: "ai" },
};

/**
 * Backend байхгүй үед гардаг самбар.
 *
 * Одоогийн UI-ийн ажиллагаа (C4-ийн судалгаа):
 *  · Тойм/Дараалал/Импорт гурвын аль нь ч `/api/admin/*` руу fetch хийдэг.
 *  · `server/` энэ репод байхгүй тул бүх дуудалт `ApiError` буцна → ErrorBox.
 *  · Товчнууд хэзээ ч амжилттай болсон дүр эсгээгүй, гэхдээ хуучин дэд
 *    гарчиг "Approve хийвэл нийтлэгдэнэ" гэж амлаж байсан — одоо тодорхой
 *    тайлбарлаагүй байна.
 *  · Шийдвэрийг үнэхээр хадгалдаг зүйл: `scripts/review.mjs` (файл → Git →
 *    content:qa). Тэр урсгалыг доор харуулна.
 */
function NoBackendPanel({ language }: { language: "mn" | "en" }) {
  const t = ui[language];
  const steps: { label: string; cmd: string }[] = [
    { label: t.adminFileStep1, cmd: "npm run review:queue" },
    { label: t.adminFileStep2, cmd: 'npm run review:mark -- terms particle --action=approve --reviewer="<нэр>"' },
    { label: t.adminFileStep3, cmd: "git diff content/review/" },
    { label: t.adminFileStep4, cmd: "npm run content:qa" },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader jp="管理" title="Админ · Агуулгын удирдлага" sub={t.adminNoBackendTitle} />
      <Card>
        <SectionTitle title={t.adminNoBackendTitle} sub="server/ — Phase 5" />
        <p className="text-[13.5px] leading-relaxed text-sumi-700">{t.adminNoBackendBody}</p>
      </Card>
      <Card>
        <SectionTitle title={t.adminFileReviewTitle} sub={t.adminFileReviewBody} />
        <ol className="space-y-2.5">
          {steps.map((s) => (
            <li key={s.cmd} className="rounded-xl border border-sumi-900/10 bg-sumi-50/50 p-3">
              <p className="text-[13px] font-bold text-sumi-700">{s.label}</p>
              <code className="mt-1 block overflow-x-auto font-mono text-[12px] text-ai-700">{s.cmd}</code>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12.5px] text-sumi-500">Дэлгэрэнгүй: content/review/README.md</p>
      </Card>
    </div>
  );
}

export default function Admin({ tab = "overview" }: { tab?: string }) {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const current: Tab = tab === "queue" || tab === "import" ? tab : "overview";
  const setTab = (t: Tab) => navigate(`admin/${t}`, { keepScroll: true });

  /* C4: backend байхгүй үед (apiBase() === null → статик build, GitHub Pages)
   * функцүүдийг дуудаж үзээд ErrorBox харуулахын оронд шударга тайлбар +
   * одоо ажиллаж буй ФАЙЛД суурилсан workflow-г харуулна. Approve/Reject
   * амжилттай мэт харагдах UI-г үлдээхгүй. */
  if (apiBase() === null) return <NoBackendPanel language={language} />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        jp="管理"
        title="Админ · Агуулгын удирдлага"
        sub="Үг, ханз, дүрэм, видео хичээл болон орчуулгын дараалал. AI-ийн санал бүр pending_review төлөвөөр орж, эзэмшигч баталгаажуулснаар л нийтлэгдэнэ."
      />
      <div className="mb-6">
        <Tabs<Tab>
          value={current}
          onChange={setTab}
          items={[
            { id: "overview", label: "Тойм", icon: "概" },
            { id: "queue", label: "Орчуулгын дараалал", icon: "訳" },
            { id: "import", label: "Импорт", icon: "入" },
          ]}
        />
      </div>
      {current === "overview" && <Overview />}
      {current === "queue" && <Queue />}
      {current === "import" && <Import />}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    setError(null);
    api.adminOverview().then(setData).catch(setError);
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBox error={error} retry={load} />;
  if (!data) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Аккаунт" value={data.accounts.toLocaleString()} />
        <Stat label="Өнөөдөр идэвхтэй" value={data.activeToday.toLocaleString()} />
        <Stat label="Өнөөдрийн давтлага" value={data.reviewsToday.toLocaleString()} />
        <Stat label="Хүлээгдэж буй" value={data.queue.pending.toLocaleString()} tone="kin" />
      </div>
      <Card>
        <SectionTitle title="Агуулгын тоо" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.entries(data.content) as [string, number][]).map(([k, v]) => (
            <Stat key={k} label={k} value={v.toLocaleString()} />
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle title="Хамгийн их алдсан үгс" sub="Бүх хэрэглэгчдийн алдааны нийлбэр" />
        {data.top.length === 0 ? (
          <p className="text-[13px] text-sumi-500">Одоогоор өгөгдөл алга.</p>
        ) : (
          <ul className="divide-y divide-sumi-900/8">
            {data.top.map((t) => (
              <li key={t.word} className="flex items-center justify-between py-2.5 text-[13.5px]">
                <span className="font-jp font-bold">{t.word}</span>
                <span className="text-sumi-500">{t.mn}</span>
                <span className="font-mono text-[12px] tabnum text-shu-600">{t.misses}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {data.errors.length > 0 && (
        <Card>
          <SectionTitle title="QC анхааруулга" />
          <ul className="space-y-1.5 text-[13px] text-shu-700">
            {data.errors.map((e, i) => <li key={i}>· {e}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Queue() {
  const [kind, setKind] = useState<string>("all");
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.adminQueue(kind === "all" ? undefined : kind).then((r) => setItems(r.items)).catch(setError);
  }, [kind]);
  useEffect(load, [load]);

  const act = async (item: QueueItem, action: "approve" | "reject") => {
    setBusy(item.id);
    try {
      const mn = editing[item.id];
      await api.adminReview(item.id, action, mn !== undefined ? { mn } : undefined);
      setItems((list) => (list ?? []).filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={kind}
          onChange={setKind}
          options={[
            { id: "all", label: "Бүгд" },
            { id: "vocab", label: "Үг" },
            { id: "kanji", label: "Ханз" },
            { id: "grammar", label: "Дүрэм" },
            { id: "listening", label: "Сонсгол" },
            { id: "reading", label: "Унших" },
          ]}
        />
        <span className="text-[12.5px] text-sumi-500">Төлөв: pending_review · Approve эсвэл Edit хийснээр нийтлэгдэнэ</span>
      </div>
      {error ? <ErrorBox error={error} retry={load} /> : !items ? <Spinner /> : items.length === 0 ? (
        <Card><p className="py-8 text-center text-[13.5px] text-sumi-500">Хүлээгдэж буй зүйл алга.</p></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const q = ORIGIN_LABEL[it.origin];
            return (
              <Card key={it.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="ai">{it.kind}</Chip>
                  <Chip tone={q.tone}>{q.text}</Chip>
                  <span className="font-mono text-[11.5px] text-sumi-500">{it.ref} · {it.level}</span>
                </div>
                <p className="mt-2.5 text-[14px] text-sumi-700">EN: {it.en}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={editing[it.id] ?? it.mn}
                    onChange={(v) => setEditing((e) => ({ ...e, [it.id]: v }))}
                    placeholder="Монгол орчуулга"
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="soft" disabled={busy === it.id} onClick={() => act(it, "reject")}>Татгалзах</Button>
                    <Button size="sm" disabled={busy === it.id} onClick={() => act(it, "approve")}>Батлах</Button>
                  </div>
                </div>
                {it.note && <p className="mt-2 text-[12px] text-sumi-500">{it.note}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Import() {
  const [kind, setKind] = useState<string>("vocab");
  const [note, setNote] = useState("");
  const [json, setJson] = useState("");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setResult("");
    let entries: unknown[];
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error("JSON нь массив байх ёстой");
      entries = parsed;
    } catch (e) {
      setError(e);
      return;
    }
    setBusy(true);
    try {
      const r = await api.adminImport({ kind, entries, note });
      setResult(`Нэмэгдсэн: ${r.added} · Алгассан: ${r.skipped}. Бүх мөр pending_review төлөвөөр орсон.`);
      setJson("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Агуулга импорт" sub="JSON массив оруулна. Эх сурвалжийн ID, лиценз, хувилбар заавал байх ёстой." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={kind}
          onChange={setKind}
          options={[
            { id: "vocab", label: "Үг" },
            { id: "kanji", label: "Ханз" },
            { id: "grammar", label: "Дүрэм" },
            { id: "listening", label: "Сонсгол (YouTube)" },
            { id: "reading", label: "Унших эссэ" },
          ]}
        />
        <Input value={note} onChange={setNote} placeholder="Импортын тэмдэглэл (жнь. JMdict 2026-09)" />
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={12}
        spellCheck={false}
        placeholder='[ { "w": "...", "r": "...", "source": "jmdict", "sourceId": "..." } ]'
        className="mt-3 w-full rounded-xl border border-sumi-900/12 bg-white/80 p-3.5 font-mono text-[12.5px] text-sumi-800 outline-none focus:border-shu-400 focus:ring-4 focus:ring-shu-500/10"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={submit} disabled={busy || !json.trim()}>{busy ? "Илгээж байна…" : "Импортлох"}</Button>
        {result && <p className="text-[13px] font-semibold text-matcha-600">{result}</p>}
      </div>
      {error ? <div className="mt-3"><ErrorBox error={error} /></div> : null}
    </Card>
  );
}
