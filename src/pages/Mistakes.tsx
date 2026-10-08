import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { LEVELS, type Level } from "../lib/types";
import { LEVEL_LABEL, stripFurigana } from "../lib/text";
import { navigate } from "../lib/router";
import { Button, Card, Chip, Empty, LevelBadge, PageHeader, Select } from "../components/ui";
import { XRayText } from "../components/XRayText";

export default function Mistakes() {
  const { doc, actions } = useStore();
  const [lv, setLv] = useState<Level | "all">("all");
  const [kind, setKind] = useState<string>("all");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const all = doc.mistakes;
  const kinds = useMemo(() => Array.from(new Set(all.map((m) => m.kind))), [all]);
  const list = all
    .filter((m) => (lv === "all" || m.level === lv) && (kind === "all" || m.kind === kind))
    .sort((a, b) => b.at - a.at);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        jp="誤答"
        title="Алдааны дэвтэр"
        sub="Буруу хариулсан бүх асуулт автоматаар энд хадгалагдана. Хариултаа нуугаад өөрөө санаж үзээд, ойлгосон бол «Ойлголоо» дарна уу."
        actions={
          all.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => navigate("quiz?mode=mistakes")}>Алдаануудаас дасгал хийх</Button>
              <Button variant="ghost" onClick={() => { if (confirm("Бүх алдааг устгах уу?")) actions.clearMistakes(); }}>Бүгдийг устгах</Button>
            </>
          ) : undefined
        }
      />

      {all.length === 0 ? (
        <Empty icon="誤" title="Алдаа бүртгэгдээгүй байна" sub="Дасгал хийх явцад буруу хариулсан асуулт энд гарч ирнэ." action={<Button onClick={() => navigate("quiz")}>Дасгал эхлүүлэх</Button>} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Select<Level | "all">
              value={lv}
              onChange={setLv}
              options={[{ id: "all", label: "Бүх түвшин" }, ...LEVELS.map((l) => ({ id: l, label: `${l} · ${LEVEL_LABEL[l]}` }))]}
            />
            <Select<string>
              value={kind}
              onChange={setKind}
              options={[{ id: "all", label: "Бүх төрөл" }, ...kinds.map((k) => ({ id: k, label: k }))]}
            />
            <span className="ml-auto text-[12.5px] text-sumi-500 tabnum">{list.length} бичлэг</span>
          </div>

          <div className="space-y-3">
            {list.map((m) => {
              const open = !!reveal[m.id];
              return (
                <Card key={m.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={m.level} size="sm" />
                    <Chip tone="sumi">{m.kind}</Chip>
                    {m.count > 1 && <Chip tone="shu">{m.count} удаа</Chip>}
                    <span className="ml-auto font-mono text-[11.5px] text-sumi-400 tabnum">{new Date(m.at).toLocaleDateString("mn-MN")}</span>
                  </div>
                  <div className="mt-3 text-[15px] font-bold text-sumi-900">
                    <XRayText text={m.prompt} showFurigana={false} />
                  </div>
                  <div className="mt-3">
                    {open ? (
                      <div className="space-y-1.5 rounded-xl bg-matcha-50/60 px-4 py-3 text-[14px]">
                        <p className="text-sumi-600">Таны хариулт: <span className="font-semibold text-shu-700">{stripFurigana(m.given)}</span></p>
                        <p className="text-sumi-900">Зөв: <span className="font-bold text-matcha-600">{stripFurigana(m.answer)}</span></p>
                        {m.note && <p className="pt-1 text-[13px] text-sumi-600">{m.note}</p>}
                      </div>
                    ) : (
                      <button
                        onClick={() => setReveal((r) => ({ ...r, [m.id]: true }))}
                        className="rounded-xl border border-dashed border-sumi-900/20 px-4 py-2.5 text-[13px] font-bold text-sumi-500 hover:border-shu-300 hover:text-shu-700"
                      >
                        Хариултыг харах
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="soft" onClick={() => actions.resolveMistake(m.id)}>Ойлголоо</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
