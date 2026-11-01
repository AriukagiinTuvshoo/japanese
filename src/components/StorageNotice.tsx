/**
 * Хадгалалтын мэдэгдэл — гэмтсэн, шинэ хувилбарын эсвэл дүүрсэн өгөгдлийг
 * чимээгүй алгасахгүйгээр хэрэглэгчид харуулна.
 */
import { createPortal } from "react-dom";
import { useStore, type StorageIssue } from "../lib/store";
import { ui } from "../lib/i18n";
import { cn } from "../utils/cn";
import { Button } from "./ui";

export function StorageNotice() {
  const { doc, storageIssue, actions } = useStore();
  if (!storageIssue) return null;

  const t = ui[doc.profile.language ?? "mn"];
  const copy: Record<StorageIssue["kind"], { title: string; text: string }> = {
    corrupt: { title: t.storageCorruptTitle, text: t.storageCorruptText },
    future: { title: t.storageFutureTitle, text: t.storageFutureText },
    quota: { title: t.storageQuotaTitle, text: t.storageQuotaText },
    error: { title: t.storageErrorTitle, text: t.storageErrorText },
  };
  const { title, text } = copy[storageIssue.kind];
  // Гэмтсэн/шинэ өгөгдлийг хэрэглэгчийн зөвшөөрөлгүйгээр дарж болохгүй.
  const blocking = storageIssue.kind === "corrupt" || storageIssue.kind === "future";

  const card = (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 border border-shu-500/30 bg-shu-50/95 p-4 sm:flex-row sm:items-center sm:rounded-xl",
        // Хадгалалт блоклогдсон үед onboarding зэрэг бүх давхаргын дээр харагдана.
        blocking
          ? "fixed left-1/2 top-3 z-[90] w-[min(94vw,760px)] -translate-x-1/2 rounded-xl shadow-lg backdrop-blur"
          : "mb-4 rounded-xl",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-sumi-900">{title}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sumi-600">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {storageIssue.raw && (
          <Button size="sm" variant="outline" onClick={actions.downloadBackup}>
            {t.storageDownload}
          </Button>
        )}
        {blocking ? (
          <Button size="sm" variant="danger" onClick={actions.startFresh}>
            {t.storageStartFresh}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={actions.dismissIssue}>
            {t.storageDismiss}
          </Button>
        )}
      </div>
    </div>
  );

  // Блоклох мэдэгдэл нь `main`-ийн stacking context-д хоригдож болзошгүй тул
  // body дээр шууд гаргаж, onboarding зэрэг давхаргын дээр байлгана.
  return blocking ? createPortal(card, document.body) : card;
}
