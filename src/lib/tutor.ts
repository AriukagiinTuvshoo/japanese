// Client for POST /api/gemini-tutor. No keys here — server-side only.
// Transcripts are handled in-memory by the UI and never stored by this module.
// Voice clips are read once (MediaRecorder), sent with the next explicit send
// action, and discarded — never persisted anywhere.

export interface TutorTurn {
  role: "user" | "tutor";
  text: string;
  correction?: string | null;
  tip?: string | null;
  /** Japanese the tutor heard in a voice turn (null/absent for text turns). */
  heard?: string | null;
}

export interface TutorAudio {
  mimeType: string;
  data: string; // base64
}

export type TutorError =
  | "config_needed"
  | "rate_limited"
  | "upstream_unavailable"
  | "upstream_error"
  | "bad_request"
  | "audio_too_large"
  | "audio_unsupported"
  | "network";

export async function askTutor(
  messages: TutorTurn[],
  level: string,
  language: "mn" | "en",
  audio?: TutorAudio,
): Promise<{ ok: true; reply: TutorTurn } | { ok: false; error: TutorError }> {
  try {
    const res = await fetch("/api/gemini-tutor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, text: m.text })),
        level,
        language,
        ...(audio ? { audio } : {}),
      }),
    });
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error === "rate_limited" ? "rate_limited" : "config_needed" };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body.error as TutorError) ?? "upstream_error" };
    }
    const data = await res.json();
    return {
      ok: true,
      reply: {
        role: "tutor",
        text: data.reply ?? "",
        correction: data.correction ?? null,
        tip: data.tip ?? null,
        heard: data.heard ?? null,
      },
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function speechSupported() {
  return typeof window !== "undefined" &&
    !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

/** True when the browser can record a voice turn and upload it to the tutor. */
export function mediaRecorderSupported() {
  return typeof window !== "undefined" &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder === "function" &&
    !!navigator.mediaDevices?.getUserMedia;
}

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
