# MN/EN completion status — 2026-10-08

**Incomplete. PR #12 must remain draft and unmerged. No production completion is claimed.**

Baseline `6cf8ca1`: 7,170 missing meanings. Current batches add 4,614 meanings, all 526 grammar formation translations and 837 N5–N3 grammar example translations. AI-authored, independently unreviewed; coverage is not semantic approval.

| Level | Missing vocabulary meanings | Missing kanji meanings | Missing grammar meanings |
|---|---:|---:|---:|
| N5 | 0 | 0 | 0 |
| N4 | 0 | 0 | 0 |
| N3 | 0 | 0 | 0 |
| N2 | 0 | 0 | 0 |
| N1 | 1,590 | 966 | 0 |
| Total | 1,590 | 966 | 0 |

Remaining: **2,556 meanings, 14,407 examples** (13,718 vocabulary + 689 N2/N1 grammar), **0 formations, 3,375 unclassified entries, 0 missing new-batch provenance records; 6,503 unchanged legacy/unreviewed meanings of unknown authorship (documented, not release-blocking), 5 unresolved source issues**. Invalid categories and mislabeled MN: zero. Measures overlap; do not sum as distinct entries.

N5 vocabulary/kanji and N4 kanji are fully classified. Categories support multiple topics, including relationships. Explicit semantic override evidence is maintained in `content/categories/provenance.json`. Unmatched entries remain visibly filterable, not hidden in a catch-all. Source warnings retain original Japanese/English and block release. Existing drafts and new translations still need accuracy review. Page-wide bilingual localization audit remains incomplete, notably Admin.

## Validation

- `npm run data:validate`: preserved structural validator.
- `npm run coverage:report`: maintained summary and ignored detailed issues.
- `npm run coverage:validate`: intentionally nonzero until every required coverage measure is zero, including unresolved source issues. Never weaken to merge.
- `npm test`: routes, coverage, grammar helpers and source-retention regressions.
- Source-retention regression verifies all 13,673 baseline entries and original source fields/examples/strokes/drafts. Formatting-related deletion counts do not establish data loss. Vocabulary `j1693050` 五十 is correctly translated `тавь` with a persistent assertion.
- `npm run test:browser`: exhaustive MN/EN grammar detail/forms/examples plus topic controls. Prior N5/N4 run passed 179 rules and 534 examples in both languages. Expanded N5–N3 run passed: 280 rules/formations and 837 examples in each language, plus vocabulary/kanji topic filters.

Local typecheck, structural validation, tests and frontend build passed during continuation. Repeat after final changes. Full source rebuild has not run because source caches are absent; guarded batches reapply after upstream generation.

## Remaining work and blockers

Remaining content authoring is unfinished, not blocked by a translation API. Independent semantic review and full visible-page localization remain outstanding. Strict completeness deliberately blocks CI/release.

Chromium's missing NSS/NSPR libraries were resolved using bundled dependencies. Sandbox outbound access is restricted to GitHub/npm/PyPI. Production HTTPS previously returned curl error 35 (`SSL_ERROR_SYSCALL`); no actual live MN/EN verification has passed. A successful old deployment status is not verification of these continuation changes. Merge, Vercel Production READY confirmation, and live verification remain withheld until the actual completion gate passes.

Legacy exemption is guarded by `content/mn/legacy-baseline.json`, extracted from baseline Git source with unknown authorship explicitly recorded. Changed legacy meanings and new/changed examples/formations still require valid batch provenance. Do not fabricate author identities. Production network access is not a final completion blocker: after a complete passing release, the user can verify the production URL in the shared browser.

Continuation added five 60-entry stable-ID/source-guarded batches (N4/N3/N2 vocabulary, N1 vocabulary and N1 kanji). Typecheck, structural data validation, regression and original-source retention passed after both application rounds. Exhaustive browser matrix intentionally deferred until final coverage completion. Five source issues remain release-blocking.

Latest group: another five 60-entry guarded batches (300 meanings), 146 fewer unclassified entries. Coverage recalculated after the N4/N3/N2 group and again after the N1 vocabulary/kanji group. No catch-all assigned. Five existing source warnings preserved.

Another five 60-entry guarded batches applied and tested. A legitimate dictionary sense containing the placeholder-detection phrase was rewritten naturally without weakening the validator. Missing meanings 2,556; unclassified 3,375; all five source issues intact.

Sustained continuation: five additional 60-entry guarded meaning/topic batches; strict coverage recalculated after each individual batch. All five source issues preserved and blocking. Category evidence manifest refreshed for all overrides. Lightweight checks passed; browser/production deferred.

Larger round added 450 meanings in eight batches (seven of 60 and one final N4 batch of 30). All N4 vocabulary meanings now present; categories/examples still incomplete. Exact guards retained and coverage recalculated after every batch. Source issues still five; legacy unknown authorship unchanged.

Latest round completed all 320 N3 and 260 N2 missing vocabulary meanings with explicit topics: eleven guarded batches (nine of 60 and two of 20). Coverage recalculated after each. Existing untranslated topic assignments elsewhere remain unfinished. N1 additions deferred to next round, not claimed done. New translations independently unreviewed; all five existing source issues remain blocking.

N1-priority round added 180 meanings in three 60-entry guarded batches; coverage recalculated after each. This does not meet the requested 600-entry turn target. Typecheck/data/regression/retention passed. No independent review or complete coverage claimed.

Six-batch round added 300 N1 vocabulary and 60 N1 kanji meanings with explicit semantic topics. Coverage recalculated after every batch. Typecheck, data validation, regressions, source retention and build passed. Source blockers remain five.

Forward round added 360 N1 vocabulary meanings in six 60-entry guarded batches. Coverage recalculated after each batch. Auditable category evidence refreshed. All source issues remain blocking; new content independently unreviewed.

Another six guarded 60-entry N1 vocabulary batches added 360 meanings. Coverage recomputed after every batch. Category evidence refreshed; sources preserved; all five source issues still release-blocking.
