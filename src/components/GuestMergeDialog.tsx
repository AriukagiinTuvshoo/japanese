import { useStore } from "../lib/store";
import { guestStats } from "../lib/guest";
import { ui } from "../lib/i18n";
import { Button, Modal } from "./ui";

/**
 * B2 — зочин ахицыг аккаунт руу нэгтгэх санал.
 * Default = НЭГТГЭХ; "Тусад нь үлдээх" сонговол зочин баримт өөрийн түлхүүртээ
 * хэвээр хадгалагдана (юу ч устгагдахгүй). Нэгтгэхээс ӨМНӨ аккаунтын нөөц авна.
 */
export default function GuestMergeDialog() {
  const { doc, pendingGuest, actions } = useStore();
  if (!pendingGuest) return null;

  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const s = guestStats(pendingGuest);

  return (
    <Modal onClose={() => actions.resolveGuestMerge(false)} title={t.guestMergeTitle} lang={language} z="z-[85]">
      <div className="space-y-5 px-6 py-6">
        <p className="text-[13.5px] leading-relaxed text-sumi-700">{t.guestMergeBody}</p>
        <p className="rounded-xl bg-matcha-50 px-4 py-3 font-mono text-[13px] font-extrabold text-matcha-600">
          {t.guestMergeStats(s.xp, s.cards, s.days)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => actions.resolveGuestMerge(true)}>
            {t.guestMergeYes}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => actions.resolveGuestMerge(false)}>
            {t.guestMergeNo}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
