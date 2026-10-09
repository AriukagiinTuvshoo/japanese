// PWA registration + install/update signals.
// Policy: never touch /api from here; no credentials; nothing private is cached.

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstall: BIPEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    emit();
  });
}

export function subscribePwa(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function canInstall() {
  return deferredInstall !== null;
}

export async function installApp(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredInstall) return "unavailable";
  await deferredInstall.prompt();
  const choice = await deferredInstall.userChoice;
  deferredInstall = null;
  emit();
  return choice.outcome;
}

export function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

export function isIos() {
  return (
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent)
  );
}

export type SwState = "unsupported" | "registering" | "ready" | "update-ready" | "failed";

let swState: SwState = "unsupported";
let waitingWorker: ServiceWorker | null = null;

export function getSwState() {
  return swState;
}

export function subscribeSw(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setSwState(next: SwState) {
  swState = next;
  emit();
}

let updateReloadArmed = false;

export function refreshForUpdate() {
  if (waitingWorker) {
    // SW will activate -> controllerchange -> reload below.
    updateReloadArmed = true;
    waitingWorker.postMessage("SKIP_WAITING");
  } else {
    window.location.reload();
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // dev server has no built asset graph
  setSwState("registering");
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setSwState("ready");
        if (reg.waiting) {
          waitingWorker = reg.waiting;
          setSwState("update-ready");
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              setSwState("update-ready");
            }
          });
        });
        // Warm the study corpus into the SW cache for useful offline study.
        navigator.serviceWorker.ready.then(() => {
          navigator.serviceWorker.controller?.postMessage("WARM_DATA");
        });
      })
      .catch(() => setSwState("failed"));
    // Only reload for a confirmed update (SKIP_WAITING). The first install's
    // clients.claim() must NOT reload the page on its own.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!updateReloadArmed) return;
      window.location.reload();
    });
  });
}
