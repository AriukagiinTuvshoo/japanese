import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "./index.css";
import App from "./App";
import { warmOfflineData } from "./lib/warm";

// Nihongo Dōjō — япон хэлний N5→N1 сургалтын апп

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/*
 * PWA: офлайн ажиллах service worker (зөвхөн production build дээр).
 * · Шинэ хувилбар суусан бол React дотор "шинэчлэх" мэдэгдэл гарна
 *   (`nd:sw-update` үйл явдал) — хэрэглэгч дарж байж шилжинэ.
 * · Хуучин controller-той үед л дахин ачаална (эхний суулгалтад reload loop-гүй).
 */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(async (reg) => {
        // N4–N1 өгөгдлийг арын дэвсгэрт татна → дараа нь офлайн бүрэн ажиллана.
        // Хэрэглэгчийн эхний харилцан үйлдлийг удаашруулахгүйн тулд хүлээ.
        await navigator.serviceWorker.ready;
        window.setTimeout(() => { void warmOfflineData(); }, 2500);

        const announce = () => window.dispatchEvent(new CustomEvent("nd:sw-update"));
        // Аль хэдийн хүлээж байгаа шинэ хувилбар байвал шууд мэдэгдэнэ.
        if (reg.waiting && navigator.serviceWorker.controller) announce();
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          next?.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) announce();
          });
        });
      })
      .catch(() => {
        /* бүртгэл амжилтгүй бол апп хэвийн ажиллана */
      });
  });
}
