# 2026-10-10 UX / PWA / Mock / Placement / Reading / Listening audit

Status: audit at `fed7787` + implementation notes below. All findings verified in code
and/or prior browser suites at that head. Items marked DONE are implemented after this
audit in the same session (see PR #12 log for commit ids). Items marked NOT DONE are
explicitly out of this session's capacity and must not be reported as complete.

## 1. UX / mobile (320/375/390/430px, tablet, desktop; MN+EN)

- VERIFIED OK at fed7787: `test:ui-audit` (19 routes × MN+EN × 375+1280: overflow,
  placeholder localization, unnamed buttons, vocab/kanji search+filter, reading/listening
  answer→check→explanation flows, settings reload persistence), `test:site-browser`
  (routes + offline), `test:admin-browser`, `test:pwa-smoke` (widths, install, voice
  record/cancel/send, real offline launch). Touch targets ≥44px enforced on tutor voice
  controls; answer buttons are full-width rows (≥44px effective).
- VERIFIED OK: language switch (Header/Shell `patchProfile({language})`), level filters
  (URL `?level=`), account modal persistence (furigana/romaji/rate/goal) through reload.
- GAP (fixed this session): grammar-question instruction lines (`promptSub`) were MN/EN
  only — added **profile setting "question prompts in Japanese"** (`jaPrompts`) with
  Japanese JLPT-style instructions; explanations/rationales always follow the MN/EN UI
  choice separately.
- GAP (fixed this session): 320px + tablet widths were not in the automated suite —
  `test:ui-audit` extended to 320 and 820 widths on a reduced route set.
- NOT DONE (honest): exhaustive manual safe-area notch testing on physical iOS devices;
  full WCAG AA screen-reader pass. `npm run a11y:audit` (Lighthouse ≥90) remains the
  standing automated check on supported routes.

## 2. PWA

- VERIFIED OK: manifest + icons (maskable 512, badge), SW precache + `WARM_DATA`
  (15 corpora + meta) + BFS `warmAssets`, `{ignoreVary:true}` lookups, `/api` never
  cached, SKIP_WAITING update flow, install prompt + standalone display, real offline
  launch (`/?offline-launch=1`), voice-turn record/cancel/send in `test:pwa-smoke`.
- Cache/secret policy: SW caches only static assets + public study corpora; no
  credentials, no private API responses, no learner transcripts are cached.
- NOT DONE: app-store binary (not required; user directed none unless genuinely needed).

## 3. JLPT mock exam

- VERIFIED OK in code: intro/instructions + structure table + per-level blueprint;
  countdown timer per section (`QuizRunner timed: section.minutes`); distractor
  de-duplication (`distractors()` normalized-key set) + per-section question de-dup
  (`buildExam usedTargets`); answer-index integrity (`opts.indexOf(g)`, shuffled options);
  answer sheet with key hidden until submit (mock uses `reveal:false`, per-question
  key coloring suppressed until scoring); submit + `scoreExam` (section minima, pass
  verdict, border verdict at 85% of benchmark); per-question explanations + examples +
  deep links after reveal; retry (retake level / new build); state persistence
  (`doc.exams` — last 8 attempts shown on mock home).
- FIXED this session: result/history/instructions now carry an explicit
  **"practice score — not an official JLPT score"** disclaimer (was only implicit in
  code comments and one practice-title string).
- FIXED this session: `jaPrompts` setting (see §1) applies to mock grammar questions
  too (shared `QuizRunner`).
- NOT DONE: per-question review screen after timed section auto-submit (existing
  mistakes pipeline still receives wrong answers; full post-exam review UI not built).

## 4. Placement test

- VERIFIED OK in code: per-skill (vocab/kanji/grammar) placement with answer breakdown
  per level grid, starting-point links, retake button, `doc.placement` persistence.
- FIXED this session: internal **beginner/mid/advanced sublevels within each N level**
  (score-band based on per-skill accuracy), score explanation panel, skill-coverage
  summary, next-step guidance block, and explicit note that sublevels are internal and
  **not official JLPT sub-grades**.

## 5. Writing practice

- VERIFIED OK in code: kanji stroke practice (guided/practice/free) with canvas, stroke
  order data, per-kanji progress persistence (`doc.writing` best/tries/at).
- FIXED this session: per-level bank de-dup check + instructions/examples/self-check
  criteria panel + session progress summary on the writing page.

## 6. Reading

- VERIFIED OK in code: tap-to-lookup already implemented in `XRayText` (tap word →
  popover with meaning, save-to-vocab (`grade`), detail link; ruby furigana toggle).
  Answer sheet with key hidden before reveal (`revealed` gate), score + rationale
  (`why`/`whyEn`) after reveal, per-line/passage furigana.
- FIXED this session: popover now also shows reading (kana) + entry kind/level; desktop
  hover open (pointer:fine) alongside phone tap.
- Content counts at fed7787: **150 texts = 30/level**, 1 comprehension question per
  lesson; no status/provenance fields. Target per user: 100+ quality texts per level
  (short/medium/long real-use: ads, messages, emails, instructions, articles) — grown in
  quality batches only, never bulk filler.
- FIXED this session: quality batch **+15 original texts (3/level, mixed real-use
  genres, 2 questions each)** + `status`/`source` provenance fields registered on all
  reading lessons (`pending_review`, original AI-assisted; none marked human-reviewed).
  Totals/reviewed/pending are tracked in `docs/audits/2026-10-10-reading-inventory.json`.
- NOT DONE: reaching 100+/level (now 33/level). This is a multi-session content program;
  current texts remain `pending_review` (no linguist review available — stated honestly).

## 7. Listening

- VERIFIED OK in code: 150 drills (30/level, `status: pending_review`, `audioMode: tts`),
  per-line replay + slow playback + speed control through the shared TTS voice engine
  (natural/neutral voice preference with fallback chain), transcript with furigana +
  tap-lookup (XRayText), answer sheet with key hidden before reveal, rationale after
  reveal, retry (retake button), no-audio fallback (text transcript always present;
  `audioError` state shows "no-audio mode, read the transcript").
- FIXED this session: **replay policy** setting (free replay vs exam-style 2 listens)
  with visible per-line listen counters in exam mode.
- VERIFIED OK: audio/transcript/answer-key alignment (structure tests; content keys
  audited at fed7787 — 300 keys index-aligned).
- NOT DONE: human TTS/voice naturalness review on physical phones (AI review only);
  per-question post-listen review screen.

## 8. Rights / provenance

- No NHK/JLPT-official/YouTube text or audio is downloaded, re-hosted, or translated.
  All reading/listening cases are clearly original AI-assisted authoring; audio is
  generated (browser TTS / `audioMode: tts`). JLPT *format* is imitated for practice
  only; no official items are used and scores are never labeled official.
- All AI-assisted content is `pending_review`/unreviewed — never marked human-reviewed.
  Linguist review requirement (JA naturalness, MN/EN translations, answer keys) is
  open and documented in the reading inventory + PR body.

## Test-command honesty

Every result reported for this session is a real run at the stated HEAD. No failing
test was converted to a pass by editing the test. The learning-library validator change
(exact 30/level → floor + growth-allowed with added structural checks) implements the
user's explicit content-growth direction and strengthens per-lesson quality asserts;
the strict coverage gate (`coverage:validate`) is untouched and remains release-blocking.
