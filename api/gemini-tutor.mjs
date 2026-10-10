// Vercel function: POST /api/gemini-tutor
// GEMINI_API_KEY is read from the server-side environment only.
// Learner transcripts and voice clips are processed per-request and never
// persisted or logged (the log line carries only the byte count).
import { handleTutorRequest, scrub } from "./_tutor-core.mjs";

export default async function handler(req, res) {
  let raw = "";
  if (typeof req.body === "string") raw = req.body;
  else if (req.body && typeof req.body === "object") raw = JSON.stringify(req.body);
  else {
    for await (const chunk of req) raw += chunk;
  }
  const result = await handleTutorRequest({ method: req.method, body: raw });
  // Log shape only — never the payload, never env values.
  console.log(`[gemini-tutor] ${req.method} -> ${result.status} (${scrub(String(raw.length))}b)`);
  for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  res.status(result.status).json(result.body);
}
