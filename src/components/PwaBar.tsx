import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";
import {
  canInstall,
  installApp,
  isStandalone,
  isIos,
  getSwState,
  refreshForUpdate,
  subscribePwa,
  subscribeSw,
  type SwState,
} from "../lib/pwa";

export default function PwaBar() {
  const { doc } = useStore();
  const t = ui[doc.profile.language ?? "mn"];
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const off1 = subscribePwa(() => force((n) => n + 1));
    const off2 = subscribeSw(() => force((n) => n + 1));
    return () => {
      off1();
      off2();
    };
  }, []);

  const sw: SwState = getSwState();
  const showUpdate = sw === "update-ready";
  const showInstall =
    !dismissed && !isStandalone() && (canInstall() || isIos());

  if (!showUpdate && !showInstall) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[420px] rounded-2xl border border-sumi-700/40 bg-sumi-900 px-4 py-3 text-[13px] text-white shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5"
    >
      {showUpdate ? (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">{t.updateReady}</p>
            <p className="text-[11.5px] text-white/70">{t.updateReadySub}</p>
          </div>
          <button
            onClick={() => refreshForUpdate()}
            className="shrink-0 rounded-xl bg-shu-500 px-3.5 py-2 text-[12.5px] font-bold text-white"
          >
            {t.updateRefresh}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">{t.installTitle}</p>
            <p className="text-[11.5px] text-white/70">
              {isIos() ? t.installIos : t.installAndroid}
            </p>
          </div>
          {canInstall() ? (
            <button
              onClick={() => void installApp()}
              className="shrink-0 rounded-xl bg-shu-500 px-3.5 py-2 text-[12.5px] font-bold text-white"
            >
              {t.installCta}
            </button>
          ) : null}
          <button
            aria-label={t.close}
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-xl border border-white/25 px-2.5 py-2 text-[12px] text-white/80"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
