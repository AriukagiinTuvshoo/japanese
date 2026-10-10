import { useRef, useState } from "react";
import { Card, PageHeader, SectionTitle } from "../components/ui";
import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";
import {
  askTutor,
  mediaRecorderSupported,
  speechSupported,
  ttsSupported,
  type TutorAudio,
  type TutorError,
  type TutorTurn,
} from "../lib/tutor";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

function makeRecognizer(): SpeechRec | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// NOTE: transcripts live in React state ONLY — never localStorage/sessionStorage,
// never sent anywhere except /api/gemini-tutor after the learner presses send/mic.
export default function Tutor() {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const level = doc.profile.current ?? "N5";

  const [consented, setConsented] = useState(false);
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TutorError | null>(null);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRecRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSpeak = speechSupported();
  const canPlay = ttsSupported();
  const canRecord = mediaRecorderSupported();

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    const next: TutorTurn[] = [...turns, { role: "user", text: trimmed }];
    setTurns(next);
    setInput("");
    setBusy(true);
    const r = await askTutor(next, level, language);
    setBusy(false);
    if (r.ok) setTurns([...next, r.reply]);
    else setError(r.error);
  }

  // Voice turn: the recorded clip itself is the message — Gemini hears the
  // actual speech (not browser text). The clip is read once and discarded.
  async function sendVoice(audio: TutorAudio) {
    if (busy) return;
    setError(null);
    setMicDenied(false);
    const next: TutorTurn[] = [...turns, { role: "user", text: t.tutorVoiceLabel }];
    setTurns(next);
    setBusy(true);
    const r = await askTutor(next.slice(0, -1), level, language, audio);
    setBusy(false);
    if (r.ok) {
      const heard = r.reply.heard ?? null;
      setTurns([
        ...next.map((turn, i) => (i === next.length - 1 ? { ...turn, heard } : turn)),
        { ...r.reply, heard: null },
      ]);
    } else {
      setError(r.error);
    }
  }

  async function toggleVoice() {
    if (!canRecord) return;
    if (recording) {
      mediaRecRef.current?.stop(); // stop & send
      return;
    }
    setMicDenied(false);
    try {
      // Permission is requested only on this explicit user action.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelRecRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const cancelled = cancelRecRef.current;
        cancelRecRef.current = false;
        const parts = chunksRef.current;
        chunksRef.current = [];
        if (cancelled) return;
        const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setError("audio_unsupported");
          return;
        }
        void blob.arrayBuffer().then((buf) => {
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          void sendVoice({ mimeType: blob.type || "audio/webm", data: btoa(bin) });
        });
      };
      rec.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch {
      setMicDenied(true);
      setRecording(false);
    }
  }

  function cancelVoice() {
    cancelRecRef.current = true;
    mediaRecRef.current?.stop();
  }

  function toggleMic() {
    if (!canSpeak) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    // Permission is requested only on this explicit user action.
    const rec = makeRecognizer();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const said = e.results[e.results.length - 1][0].transcript.trim();
      if (said) setInput(said); // lands in the box; send is the user's next explicit action
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  }

  function speak(turn: TutorTurn) {
    if (!canPlay || !turn.text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(turn.text);
    u.lang = language === "en" ? "en-US" : "mn-MN";
    window.speechSynthesis.speak(u);
  }

  function clearChat() {
    setTurns([]);
    setError(null);
    setInput("");
    window.speechSynthesis?.cancel();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader jp="話す" title={t.tutorTitle} sub={t.tutorSub} />

      {!consented ? (
        <Card>
          <SectionTitle jp="同意" title={t.tutorConsentTitle} />
          <div className="space-y-3 text-[14px] leading-relaxed text-sumi-700">
            <p>{t.tutorConsentBody}</p>
            <p className="rounded-xl bg-sumi-900/5 px-3.5 py-2.5 text-[12.5px] text-sumi-600">{t.tutorPrivacyNote}</p>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setConsented(true)}
                className="min-h-[44px] rounded-xl bg-shu-500 px-5 py-2.5 text-[13.5px] font-bold text-white"
              >
                {t.tutorConsentAgree}
              </button>
              <a
                href="#/home"
                className="grid min-h-[44px] place-items-center rounded-xl border border-sumi-900/15 px-5 py-2.5 text-[13.5px] font-bold"
              >
                {t.back}
              </a>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle jp="会話" title={t.tutorChat} sub={level} />
              <button
                onClick={clearChat}
                className="min-h-[44px] rounded-xl border border-sumi-900/15 px-3.5 py-2 text-[12.5px] font-bold"
              >
                {t.tutorClear}
              </button>
            </div>

            {error === "config_needed" ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                <p className="font-bold">{t.tutorConfigNeeded}</p>
                <p className="mt-1">{t.tutorConfigHint}</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-shu-500/40 bg-shu-500/10 px-4 py-3 text-[13px]">
                {error === "rate_limited"
                  ? t.tutorRateLimited
                  : error === "audio_too_large" || error === "audio_unsupported"
                    ? t.tutorAudioError
                    : t.tutorError}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {turns.length === 0 ? <p className="text-[13.5px] text-sumi-500">{t.tutorEmpty}</p> : null}
              {turns.map((turn, i) => (
                <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      turn.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-ai-600 px-4 py-2.5 text-[13.5px] text-white"
                        : "max-w-[85%] rounded-2xl rounded-bl-md bg-sumi-900/6 px-4 py-2.5 text-[13.5px]"
                    }
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
                    {turn.role === "user" && turn.heard ? (
                      <p className="mt-1.5 text-[12px] opacity-80">
                        <span className="font-bold">{t.tutorVoiceHeard} </span>
                        {turn.heard}
                      </p>
                    ) : null}
                    {turn.correction ? (
                      <p className="mt-2 rounded-lg bg-shu-500/10 px-2.5 py-1.5 text-[12px]">
                        <span className="font-bold">{t.tutorCorrectionLabel} </span>
                        {turn.correction}
                      </p>
                    ) : null}
                    {turn.tip ? (
                      <p className="mt-1.5 text-[12px] opacity-80">
                        <span className="font-bold">{t.tutorTipLabel} </span>
                        {turn.tip}
                      </p>
                    ) : null}
                    {turn.role === "tutor" && canPlay ? (
                      <button
                        onClick={() => speak(turn)}
                        aria-label={t.tutorPlay}
                        className="mt-2 min-h-[32px] rounded-lg border border-sumi-900/15 px-2.5 py-1 text-[11.5px]"
                      >
                        🔊 {t.tutorPlay}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {busy ? <p className="text-[12.5px] text-sumi-500">{t.loadingVocab}</p> : null}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {recording ? (
                <>
                  <p role="status" className="flex-1 text-[13px] font-bold text-shu-600">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-shu-500 align-middle" />
                    {t.tutorVoiceRec}
                  </p>
                  <button
                    onClick={cancelVoice}
                    className="min-h-[44px] rounded-xl border border-sumi-900/15 px-4 py-2.5 text-[13px] font-bold"
                  >
                    {t.tutorVoiceCancel}
                  </button>
                  <button
                    onClick={() => void toggleVoice()}
                    className="min-h-[44px] rounded-xl bg-shu-500 px-4 py-2.5 text-[13px] font-bold text-white"
                  >
                    ⏹ {t.tutorVoiceStop}
                  </button>
                </>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void send(input);
                    }}
                    placeholder={t.tutorInputPlaceholder}
                    className="min-h-[44px] flex-1 rounded-xl border border-sumi-900/15 px-3.5 text-[14px] outline-none focus:border-ai-600"
                  />
                  {canRecord ? (
                    <button
                      onClick={() => void toggleVoice()}
                      aria-label={t.tutorMic}
                      className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-sumi-900/15 text-[16px]"
                    >
                      🎤
                    </button>
                  ) : canSpeak ? (
                    <button
                      onClick={toggleMic}
                      aria-label={t.tutorMic}
                      className={`grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border text-[16px] ${
                        listening ? "border-shu-500 bg-shu-500 text-white" : "border-sumi-900/15"
                      }`}
                    >
                      {listening ? "⏹" : "🎤"}
                    </button>
                  ) : null}
                  <button
                    onClick={() => void send(input)}
                    disabled={busy || !input.trim()}
                    className="min-h-[44px] rounded-xl bg-shu-500 px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
                  >
                    {t.tutorSend}
                  </button>
                </>
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-sumi-500">
              {micDenied
                ? t.tutorMicDenied
                : canRecord
                  ? t.tutorVoiceNote
                  : canSpeak
                    ? t.tutorDictateNote
                    : t.tutorMicUnsupported}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
