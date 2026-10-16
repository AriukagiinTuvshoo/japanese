# Quality pass audit — 2026-10-09

Not a release approval. PR #12 stays draft/unmerged/unreleased; strict coverage fails.

**Current tested head: `0e7da606584042185673e9237835fc8d4d276968`.** CI at that exact
head completed: **regression SUCCESS, including `test:runner-browser`**; the strict
**complete-content job FAILED at `npm run coverage:validate`** (expected release
blocker; the gate was not weakened). Vercel Preview at that exact head:
`https://japanese-nosjvq2ji-enhtvbshin2-5342.vercel.app` (environment `Preview`,
`production_environment=false`). This audit update is a documentation/evidence-only
follow-up commit; its SHA is recorded in the PR body and its exact-head checks and
Preview were inspected once after push (no repeated polling).

## Remote/workspace reconciliation (historical starting point)
PR head at reconciliation time was `8529ee7ab8de767031cc16d72465a69e0fb89eae`.
Stale local checkout was byte-identical to ancestor `ec3d931` (no divergent unique
work); a recovery snapshot and git bundle were made at
`/home/user/japanese-quality-recovery-20261009` before updating only remote-changed
paths and the branch ref (no reset/clean/force). The quality pass itself was
committed and pushed as `0e7da60` on top of that reconciliation.

## Focused diagnostic recheck on `0e7da60` (after CI)
Focused run: `npm run test:runner-browser` — **exit 0**, zero uncaught page errors;
full output retained in `diagnostic-recheck.txt`.

- `actions.setProfile is not a function`: **stale / non-reproducible, and never an
  application defect.** The earlier message came from the first runner-test fixture
  calling a nonexistent store action; the fixture was corrected to the real
  `patchProfile` API before `0e7da60`. Recheck greps show no `setProfile` in the
  fixture, `src/lib/store.tsx` (which implements `patchProfile`), or run output, and
  the live toggle path exercised by the test completes with no page error. No code
  fix was invented.
- `/api/health` `ECONNREFUSED 127.0.0.1:8787`: **reproducible only as a Vite
  server-side proxy log** whenever the documented-absent backend is not running;
  it is not a browser page error, does not fail any test (runner exit 0), and the
  client degrades to its localized offline state. It remains a consequence of the
  missing-backend blocker below; no code fix was invented.

## Evidence-backed fixes (mock exams / grammar practice)
- Question objects now carry stable MN/EN presentation; switching language mid-quiz
  preserves the question, option order, answer key and selection. Previously
  changing language left stale wording and regenerated answers at first click.
- Keyboard answer shortcuts now ignore typing in inputs/buttons (real React test).
- Hidden correct option no longer gets an answer-colored border before reveal.
- Timer expiry now completes through the same once-only callback/log path as manual
  finish; previously it called `setDone(true)` without scoring/logging (section flow
  then stalled). Retry resets the deadline and selection.
- Mock practice means MN/EN in **MN/EN UI mode** now mean JP→MN/JP→EN and MN/EN→JP,
  not English labeled as Mongolian; MN mode never falls back to English for grammar.
- `grammar-mn` now uses the active language; `grammar-use` became explicit source
  sentence expression recognition (Japanese sentence + Japanese pattern choices)
  instead of inventing blank-fill completions; `vocab-fill` is withheld pending a
  reviewed completion bank (random dictionary distractors are not a reliable key).
- Duplicate/homograph distractors are excluded by full normalized meaning/reading
  keys; no adjacent-level backfill; restricted sessions no longer fall back outside
  their selected entries; sparse pools stay visibly sparse.
- N5–N1 full mock composition uses Japanese prompts/choices where source data is
  Japanese (reading, kanji reading, grammar recognition, TTS listening). Reading
  sections that lack a reviewed Japanese comprehension bank are **blocked**, never
  replaced with dictionary drills; start is disabled with a precise content-review
  reason. Available Japanese recognition drills run separately and are labeled
  "not a full exam". N3–N1 note corrected (19/60 section minimum, 95/180 total
  for N3) and "word/kanji counts are study estimates, not official requirements".
- Incomplete exam results can no longer receive a pass verdict; exact section IDs
  and per-section counts are validated before scoring.
- Reading/listening lessons render an explicit unreviewed-content status: the new
  libraries contain Japanese question text embedded in MN prompts and mixed
  choices (verified in data), so they are not mock-scoring or bilingual approval.

## Checks (actual exits; full outputs in this directory)
- typecheck 0 · data:validate 0 · npm test (routes+coverage+retention+grammar
  helpers+study engine+runner) 0 · coverage:report 0 · build 0
- test:browser 0 (526 grammar formations + 1526 examples each MN/EN)
- test:admin-browser 0 (mock API only — not real auth/backend)
- test:site-browser 0 (MN/EN routes desktop+mobile, libraries, live quiz switching,
  full-mock blocking, 201 added examples, error/retry, language persistence)
- test:runner-browser 0 (real React runner: focus guard, hidden-answer styling,
  live switch, timeout exactly-once, retry)
- standalone coverage:validate **1**; git diff --check 0

Strict totals remain: {
  missingMeanings: 62,
  missingExamples: 12774,
  missingForms: 0,
  unclassified: 1851,
  invalidCategories: 0,
  missingProvenance: 0,
  mislabeledMn: 0,
  unresolvedSourceIssues: 10
}

Source fields/provenance/licenses untouched. Remaining blockers: strict counts
above, 10 unresolved source issues, unreviewed/generated lesson/question banks,
full comprehension question bank, semantic review, real backend/auth, live MN+EN
production verification.

## Exact-head CI outcome recorded for `0e7da60` (verified, not re-polled)
- `regression`: **SUCCESS**, including the `test:runner-browser` step.
- `complete-content`: **FAILURE** at `npm run coverage:validate` — the standalone
  strict gate above, intentionally blocking.
- Vercel deployment for this exact SHA: Preview success at
  `https://japanese-nosjvq2ji-enhtvbshin2-5342.vercel.app`, `production_environment=false`.
