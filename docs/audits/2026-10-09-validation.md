# Continuation validation — 2026-10-09

PR #12 remains draft/open/unmerged/unreleased. Local working revision based on
`02af15725ba2ea8b08a899fcd5afa063396157c0`; new-head CI is tracked separately.

## Structural checks

- Typecheck, data validator, route/coverage tests, source-retention tests and frontend build: exit 0 after every new example batch, and after final code changes.
- Retention: all 13,673 baseline entries, Japanese/English/readings/examples/strokes/legacy drafts preserved. 五十 = тавь and 萬 = арван мянга assertions pass.
- Coverage: 62 meanings, 12,975 examples, 1,995 unclassified, ten source warnings; forms/invalid categories/missing new provenance/mislabeled MN = zero.
- Standalone `npm run coverage:validate`: actual exit **1**, intentionally release-blocking. Not combined with diff check or masked.
- Separate `git diff --check`: exit **0**. Repeat after final documentation updates before commit.
- Read-only external dictionary audit: exit 0, pinned archive and decompressed DB SHA-256 checked, 62 withheld meanings and ten warnings across 67 entries; zero corrections. This is NOT independent modern semantic verification.

## Full N5–N1 grammar browser output — actual exit 0

Both languages ran to completion against an unchanged build. Full command output:

```text

> nihongo-dojo@3.0.0 test:browser
> node scripts/test-browser.mjs

mn/n5: 81 grammar details/forms and 242 examples checked
mn/n4: 98 grammar details/forms and 292 examples checked
mn/n3: 101 grammar details/forms and 303 examples checked
mn/n2: 123 grammar details/forms and 323 examples checked
mn/n1: 123 grammar details/forms and 366 examples checked
mn: 526 N5–N1 grammar details/forms and 1526 example translations plus vocabulary/kanji topic filters passed
en/n5: 81 grammar details/forms and 242 examples checked
en/n4: 98 grammar details/forms and 292 examples checked
en/n3: 101 grammar details/forms and 303 examples checked
en/n2: 123 grammar details/forms and 323 examples checked
en/n1: 123 grammar details/forms and 366 examples checked
en: 526 N5–N1 grammar details/forms and 1526 example translations plus vocabulary/kanji topic filters passed
BROWSER_EXIT=0
```

This exhaustively checks grammar detail/forms and supplied example translations,
plus vocabulary/kanji topic controls. It does not check every vocabulary/kanji
record, every app page/state, human accuracy, browser audio playback or live auth.
One earlier expanded run returned exit 1 at the kanji topic locator after the MN
matrix: `dist` had been rebuilt during that run. A frozen-build rerun passed
without weakening assertions or increasing timeouts. The earlier failure is not
reported as a pass. Avoid rebuilding while browser tests consume lazy assets.

## Focused Admin/About output — actual exit 0

```text

> nihongo-dojo@3.0.0 test:admin-browser
> ADMIN_TEST_START_SERVER=1 node scripts/test-admin-browser.mjs

About mn: all 5 source descriptions and pinned dictionary attribution passed (real static metadata).
Admin mn: overview/queue loading/error/retry/empty/populated, import validation/error/busy/success passed (mock API).
About en: all 5 source descriptions and pinned dictionary attribution passed (real static metadata).
Admin en: overview/queue loading/error/retry/empty/populated, import validation/error/busy/success passed (mock API).
ADMIN_EXIT=0
```

Admin endpoints are intercepted fixtures (not production/API authorization or
real mutations). About populated source descriptions/attribution use real static
metadata; its delayed/error requests are controlled state fixtures. Full app
MN/EN matrix and independent human review remain outstanding.

## GitHub checks at starting head

For exact `02af15725ba2ea8b08a899fcd5afa063396157c0`, runs 37811798309 and
37811792492 completed: regression SUCCESS; complete-content FAILURE at the
`npm run coverage:validate` step. Vercel preview SUCCESS. Metadata was retrieved
via GitHub API; full log downloads failed EOF on a restricted results-receiver
host (earlier blob host also blocked). Local standalone strict output is evidence
of current content gaps, not a fabricated copy of the CI job's unavailable log.
No prior-head CI approval is attributed to the continuation commit.
