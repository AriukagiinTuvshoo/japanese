import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";
import { Button, Modal } from "./ui";

/**
 * B3 — импортын урьдчилсан харах: файл юу агуулж байгааг үзүүлээд,
 * НЭГТГЭХ (default) / БҮРЭН СОЛИХ / ЦУЦЛАХ сонголтыг авна.
 * Аль сонголт ч хийгдээгүй бол юу ч өөрчлөгдөхгүй.
 */
export default function ImportPreviewModal() {
  const { doc, pendingImport, actions } = useStore();
  if (!pendingImport) return null;

  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const p = pendingImport;

  const rows: [string, string | number][] = [
    [t.importPreviewRows(p.version, p.xp, p.cards, p.streak, p.days), ""],
    [t.srsCardsRow, p.cards],
    [t.reviewsRow, p.reviews],
    [t.favTab, p.favorites],
    [t.mistakesRow, p.mistakes],
    [t.achievements, p.achievements],
    [t.importUpdatedAt, new Date(p.updatedAt).toLocaleDateString(language === "en" ? "en-US" : "mn-MN")],
  ];

  return (
    <Modal onClose={() => actions.cancelImport()} title={t.importPreviewTitle} lang={language}>
      <div className="space-y-5 px-6 py-6">
        <p className="text-[13px] leading-relaxed text-sumi-600">{t.importPreviewHint}</p>
        <div className="grid gap-2">
          {rows.map(([label, value]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-xl bg-sumi-900/5 px-4 py-2.5">
              <span className="text-[12.5px] font-bold text-sumi-600">{label}</span>
              <span className="font-mono text-[13.5px] font-extrabold tabnum">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => actions.commitImport("merge")}>{t.importMergeBtn}</Button>
          <Button size="lg" variant="outline" onClick={() => actions.commitImport("replace")}>{t.importReplaceBtn}</Button>
          <Button size="lg" variant="ghost" onClick={() => actions.cancelImport()}>{t.importCancelBtn}</Button>
        </div>
      </div>
    </Modal>
  );
}
