# Recovery and continuation validation — 2026-10-09

**Not a release approval.** Branch `arena/b35ad51c-japanese`, PR #12 draft/open.
Starting reconciled head: `cac78c79587f6fb6d5f93a158790258c24b351e8`.

## Recovery (before edits)

The restored checkout initially reported baseline `6cf8ca1` with dirty files.
A recoverable snapshot was created at `/home/user/japanese-recovery-20261009`
before mutation: tracked/untracked file tar, Git object/index recovery tar,
SHA-256 manifest (322 workspace files), staged/unstaged binary patches,
status/untracked lists, refs/branches/ancestry. Credential/config material was
excluded. The snapshot is outside the repo and was not overwritten.

Fetched only the exact remote PR branch and compared every workspace file
byte-for-byte with remote `cac78c7`: identical, no missing/extra files. Verified
baseline ancestry. Reconciled index with `git read-tree` without `-u`, then
compare-and-swap `git update-ref` on the fixed session branch. No working-file
writes, reset, clean, force-push, branch switch or duplicate commits. Details:
`reconciliation.txt` in the snapshot. New changes were made only afterward.

## Dependency and content changes

- Fixed the trailing EOF whitespace in `src/lib/i18n.ts`.
- `npm ci` reproducibly restored dependencies. Initial audit found Vite/esbuild
  advisories. Updated Vite to exact 7.3.7 and the locked esbuild dependency;
  a fresh `npm ci` reports **0 vulnerabilities**.
- Four exact-source reuse batches: 40/40/40/1 sentences. Japanese AND retained
  English match; source headword/reading/English guarded. Earlier translation
  origin retained in each `reusedFrom`, independently tested against source
  sentences/provenance. Folding ambiguity and disputed headword excluded.
- Four N4 topic batches: 40/40/40/24 entries. Explicit reviewed-by-AI assignments,
  exact headword/reading/English guards, multi-topic evidence manifest. N4 vocab
  unclassified count 144 → 104 → 64 → 24 → 0; overall 1,995 → 1,851.
- Two N5 example batches: 40/40 sentences. Natural MN draft text, stable IDs and
  exact JA/EN source guards. Not independent human approval.
- Every content batch received application, coverage report, typecheck, data,
  regression/source retention and build checks (exit 0). Standalone strict gate
  after each returned exit 1; nothing was marked complete to bypass it.
- Latest measured blockers: **62 meanings / 12,774 examples / 1,851 unclassified /
  10 source-review issues**. Forms, invalid categories, missing new provenance,
  and mislabeled MN: zero. Measures overlap; do not sum into unique records.
- All 13,673 original entries, JA/EN/readings/examples/strokes/legacy drafts are
  retained. 五十 = тавь; 萬 = арван мянга regressions pass. All 6,503 legacy records
  retain honest unknown authorship/unreviewed status.

## Reference adjudication

`2026-10-09-independent-reference-checks.json` records exact URLs, retrieval
scope/date, publisher and copyright/version limitations for ten source flags.
Kotobank's Daijisen independently lists form/foam, fan/fun and 悪い/にくい;
Seisenban records a historical temperature sense for 熱量. Therefore old blanket
mismatch claims were too strong. Active notes now reflect this evidence while
retaining **all ten unresolved flags**, original lexical fields and original
warning text in historical audits/batch `previousSourceNote`. Zero lexical
corrections and zero warning clearances. Missing meaning count unchanged.

The dynamic pages do not establish exact revision identifiers. No open reuse
license was established and no dictionary definitions were imported as app
content. Factual reference checking is distinct from republication permission.
Source/sense/register adjudication and human linguistic approval remain pending.

## Frontend verification scope

- Three learning libraries now handle loading, errors and retry without stale
  responses replacing current-level data.
- Shared speech labels follow the selected language; listening/reading controls
  use existing MN/EN strings; mock section score text is localized.
- Removed endless loading spinner from the synchronously empty reading library.
- Fixed measured 25px mobile Home overflow (390px viewport): single-column grid
  and wrapping section headings, without hiding overflow or removing content.
- Word details now show the pinned dictionary CC-BY-SA-3.0 / package MIT license,
  and missing related MN content no longer falls back to unlabeled English.
- Added site browser tests to CI: real static route headings/English text checks,
  empty/offline states, controlled data loading/error/retry, all 201 new example
  translations, pinned word license, language-switch persistence and mobile
  layout checks. Controlled faults are not real backend/auth tests.

## Outstanding whole-product work

Reading and listening libraries plus listening fallback are empty. No populated
lesson-detail bilingual/browser approval is claimed. The missing backend was
confirmed in the working tree, available Git history, bundled project ZIP and
GitHub main's `/server` (404). `npm run server` still points to a missing file.
No API implementation, deployed auth/sync/admin service or Vercel API routing
was verified. A real backend deployment and its secure environment/storage
configuration are needed; do not put credentials in chat or tracked files.

Content authoring remains unfinished independently of those external/review
requirements. No merge, production deployment or actual production MN/EN
verification is claimed. Exact-head CI must be inspected after push; prior-head
results are not approval of this work.

## Final checks

Final frozen-build browser results and exact-head GitHub checks are recorded
below when actually observed. One earlier in-progress grammar matrix was stopped
after MN N4 to incorporate the word-detail license fix before rebuilding; it is
not counted as a pass. Initial site-test failures identified a test locator
assumption (empty detail views have no heading) and the real mobile overflow;
both were corrected, then the stronger tests were rerun.

### Final bounded release review

The latest frozen-build runner reported `GRAMMAR_EXIT=0 ADMIN_EXIT=0 SITE_EXIT=1`.
The site failure was exactly a timeout waiting for the visible `EN` switcher at
390px: the mobile navigation drawer was closed. `Shell.tsx` places that switcher
inside the drawer. Only the test interaction was changed to open the menu and
close it using the selected language, including after reload. No app behavior,
content batch, assertion, or timeout was relaxed.

The site test was rerun **once** after this fix. Complete before/after output,
standalone strict coverage, separate diff check and final type/data/regression/
build output are retained in `2026-10-09-release-review/`.

| Final check | Exit |
|---|---:|
| `npm run test:site-browser` | 0 |
| `npm run coverage:validate` | 1 |
| `git diff --check` | 0 |
| `npm run typecheck` | 0 |
| `npm run data:validate` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |

The grammar matrix passed all 526 details/formations and 1,526 examples in EACH
of MN/EN. Admin controlled-state tests passed both languages; these are not
real backend/auth tests. The site rerun additionally covers all 201 new
vocabulary examples per language, library error/retry, mobile layout and actual
language-switch persistence. Final build ran afterward with no intervening
application/content changes; the only browser-failure fix was in the test.

Strict blockers remain **62 meanings, 12,774 examples, 1,851 unclassified entries,
10 unresolved source issues**. Forms, invalid categories, missing new provenance
and mislabeled MN are zero. Strict exit 1 is a real release blocker. Empty
reading/listening libraries, missing backend and linguistic review remain
additional whole-product requirements. No production approval is claimed.

The commit containing this audit will be pushed only to the existing PR #12
branch. Exact resulting-head GitHub checks and Vercel Preview observations are
recorded in a timestamped PR #12 comment (durable remote audit), rather than
creating another commit and incorrectly reusing previous-head CI results.
PR remains draft; no merge or production deploy command is authorized while
the strict gate fails.
