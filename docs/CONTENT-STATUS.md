# MN/EN completion status — 2026-10-08

**Incomplete. Do not merge or claim production completion.**

Baseline `6cf8ca1` (current main at session start) matches the supplied audit: 7,170 missing meanings. This batch adds 100 N5 vocabulary meanings, 100 N1 kanji meanings, 98 N4 grammar meanings and 28 grammar example translations. These are AI-authored, independently unreviewed translations, not human-curated content.

Remaining meanings:

| Level | Vocabulary | Kanji | Grammar |
|---|---:|---:|---:|
| N5 | 259 | 0 | 0 |
| N4 | 450 | 0 | 0 |
| N3 | 620 | 0 | 101 |
| N2 | 560 | 0 | 123 |
| N1 | 3,090 | 1,546 | 123 |
| Total | 4,979 | 1,546 | 347 |

Additional release gaps: 15,216 untranslated examples (13,718 vocabulary + 1,498 grammar), 522 untranslated formation explanations, 5,389 entries unclassified by topic, and 6,503 existing translations without maintained per-entry provenance. These measures overlap; do not sum them as distinct entries. Topic rules are multi-label suggestions and need semantic review; unmatched entries deliberately receive no catch-all. Every existing draft also needs accuracy review. Page-wide localization audit is not complete (notably Admin remains hardcoded Mongolian).

## Validators

- `npm run data:validate`: legacy structural validator, preserved.
- `npm run coverage:report`: writes maintained summary `content/coverage-report.json` and ignored detailed `.cache/coverage-issues.json`.
- `npm run coverage:validate`: exits nonzero for any missing meaning/example/formation, unclassified entry, invalid category, missing provenance or mislabeled MN.
- `npm test`: route and coverage-validator regression tests.
- `npm run test:browser`: real Chromium bilingual grammar/category smoke test; not a comprehensive page audit.
- CI `complete-content` deliberately fails until the product meets coverage requirements. Do not weaken the check to merge this draft.

## Concrete verification blockers

Local Chromium could not start: `/tmp/chromium: error while loading shared libraries: libnspr4.so`. Sandbox outbound network allows GitHub/npm/PyPI only, preventing normal OS package installation and access to Vercel production. HTTPS to the current production deployment returned curl error 35 (`SSL_ERROR_SYSCALL`). No actual live-site MN/EN verification has passed. GitHub deployment status reports the existing main deployment completed successfully; that is not a browser verification of these changes.

Typecheck, structural data validation, production frontend build, and route/coverage regression checks pass locally. The source-data rebuild was not executed: cached upstream source archives are absent. The batch application is wired after upstream data builds to prevent loss of new translations.

Remaining content authoring is unfinished, not blocked by a technical translation API. Do not represent this batch as the full requested scope. Merge and production deployment remain intentionally withheld because completeness and browser checks have not passed.
