import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Nihongo Dōjō — япон хэлний N5→N1 сургалтын апп

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// PWA: офлайн ажиллах service worker (зөвхөн production build дээр)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => { /* бүртгэл амжилтгүй бол апп хэвийн ажиллана */ });
  });
}
