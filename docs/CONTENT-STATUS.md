# MN/EN completion status — 2026-10-08

**Incomplete. PR #12 must remain draft and unmerged. No production completion is claimed.**

Baseline `6cf8ca1`: 7,170 missing meanings. Current batches add 7,108 net meanings, all 526 grammar formation translations and 837 N5–N3 grammar example translations and 514 vocabulary example translations plus 6 N2 grammar example translations. AI-authored, independently unreviewed; coverage is not semantic approval.

| Level | Missing vocabulary meanings | Missing kanji meanings | Missing grammar meanings |
|---|---:|---:|---:|
| N5 | 0 | 0 | 0 |
| N4 | 0 | 0 | 0 |
| N3 | 0 | 0 | 0 |
| N2 | 0 | 0 | 0 |
| N1 | 31 | 31 | 0 |
| Total | 31 | 31 | 0 |

Remaining: **62 meanings, 13,627 examples** (13,184 vocabulary + 443 N2/N1 grammar), **0 formations, 2,075 unclassified entries, 0 missing new-batch provenance records; 6,503 unchanged legacy/unreviewed meanings of unknown authorship (documented, not release-blocking), 10 unresolved source issues**. Invalid categories and mislabeled MN: zero. Measures overlap; do not sum as distinct entries.

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

Another five 60-entry guarded batches applied and tested. A legitimate dictionary sense containing the placeholder-detection phrase was rewritten naturally without weakening the validator. Missing meanings 1,057; unclassified 2,713; all five source issues intact.

Sustained continuation: five additional 60-entry guarded meaning/topic batches; strict coverage recalculated after each individual batch. All five source issues preserved and blocking. Category evidence manifest refreshed for all overrides. Lightweight checks passed; browser/production deferred.

Larger round added 450 meanings in eight batches (seven of 60 and one final N4 batch of 30). All N4 vocabulary meanings now present; categories/examples still incomplete. Exact guards retained and coverage recalculated after every batch. Source issues still five; legacy unknown authorship unchanged.

Latest round completed all 320 N3 and 260 N2 missing vocabulary meanings with explicit topics: eleven guarded batches (nine of 60 and two of 20). Coverage recalculated after each. Existing untranslated topic assignments elsewhere remain unfinished. N1 additions deferred to next round, not claimed done. New translations independently unreviewed; all five existing source issues remain blocking.

N1-priority round added 180 meanings in three 60-entry guarded batches; coverage recalculated after each. This does not meet the requested 600-entry turn target. Typecheck/data/regression/retention passed. No independent review or complete coverage claimed.

Six-batch round added 300 N1 vocabulary and 60 N1 kanji meanings with explicit semantic topics. Coverage recalculated after every batch. Typecheck, data validation, regressions, source retention and build passed. Source blockers remain five.

Forward round added 360 N1 vocabulary meanings in six 60-entry guarded batches. Coverage recalculated after each batch. Auditable category evidence refreshed. All source issues remain blocking; new content independently unreviewed.

Another six guarded 60-entry N1 vocabulary batches added 360 meanings. Coverage recomputed after every batch. Category evidence refreshed; sources preserved; all five source issues still release-blocking.


## Steady round — 420 additions and source audit

Six exact-source-guarded N1 vocabulary batches (360 entries), followed by a 60-entry N1 kanji batch asserting `k/on/kun/en`. Coverage recalculated after each: missing meanings 2496 → 2436 → 2376 → 2316 → 2256 → 2196 → 2136. All content AI-authored and independently unreviewed.

Withdrew the earlier 気品/きひん aroma translation: Japanese and retained English conflict. Original source unchanged; previous MN preserved in the batch's `withdrawnMn` audit field, excluded from active translation data, with a persistent source warning. This raises missing meanings to 2137 and unclassified to 3229. Withdrawal is reapplied by the batch applicator, not merely a one-off data edit.

Four additional unresolved source sense/reading issues (悪い/にくい, 熱量/temperature, ファン/fun, フォーム/foam) are withheld and explicitly blocking. Together with 気品 and the original five blockers, total source issues are now 10. Uncertainty is not a source correction or independent review. Several unusual records remain withheld for subsequent dictionary review; no comprehensive linguistic approval claimed.

The seven batches add 420 meanings; net reduction in missing meanings is 419 because one suspect older translation was withdrawn. N1 vocabulary missing 1231; N1 kanji missing 546. Examples, UI localization, human review and exhaustive browser checks remain unfinished. No merge or deploy.

Steady-round checks: typecheck, data validation, route/coverage/withdrawal regressions, all 13,673 source-record retention checks and frontend build passed. Strict completion still exits 1, as required. Legacy unknown-author count remains 6,503.


## Persist round — ten guarded batches, 600 meanings

Added 420 N1 vocabulary and 180 N1 kanji meanings in ten batches of exactly 60. Vocabulary asserts stable ID plus exact `w/r/en`; kanji asserts stable `k/on/kun/en`. Independent review is still outstanding. Coverage recalculated after every batch: missing meanings 2077 → 2017 → 1957 → 1897 → 1837 → 1777 → 1717 → 1657 → 1597 → 1537. Unclassified reduced 3229 → 2961. All ten previously recorded source conflicts remain blocking; no guess assigned to those records. The category manifest now includes kanji on/kun reading evidence alongside retained English and source headwords.

Current N1 vocabulary missing 511; N1 kanji missing 546. Examples remain 14407; formations/new provenance gaps/mislabeled MN/invalid categories zero; legacy unchanged 6503. Queued follow-up features are not started: primary content, semantic review, UI/bilingual browser gates and verified release take precedence. No merge or deploy.

Persist-round typecheck, structural validation, routes/coverage/source-guard/category-evidence regressions, 13,673-record retention and build passed. Strict coverage exits 1 intentionally; this is not a release pass. Exhaustive bilingual browser and independent human review still outstanding.

Sustain round added 120 N1 vocabulary and 60 N1 kanji meanings in three guarded 60-entry batches. Coverage recomputed after each: 1477, 1417, 1357 missing meanings. All ten source blockers retained; independent review and remaining scope unfinished. No merge/deploy.


## Sustained round — eight 60-entry batches (480 meanings)

Added 300 N1 vocabulary and 180 N1 kanji meanings. Exact stable-ID `w/r/en` or `k/on/kun/en` guards; semantic topics with refreshed source/reading evidence. Coverage recomputed after every batch: missing meanings 1477 → 1417 → 1357 → 1297 → 1237 → 1177 → 1117 → 1057. All ten recorded source conflicts retained as visible release blockers. JMdict-derived final vocabulary batches cite their actual retained dataset rather than OpenJLPT. New content remains AI-authored and independently unreviewed.

Current missing meanings: vocabulary 511, kanji 546. Unclassified 2713; untranslated examples 14407. No queued follow-up features started, no merge/deploy. Typecheck/data/regressions/retention/build and strict gate rerun; strict completion remains failing, not a release pass.


Continued after the tested eight-batch push with two additional exact 60-entry kanji batches. This turn now totals **600 meanings: 300 vocabulary and 300 kanji** in ten batches. Per-batch missing meanings: 1477, 1417, 1357, 1297, 1237, 1177, 1117, 1057, 997, 937. Final gaps: vocabulary 511, kanji 426; unclassified 2620, examples 14407, ten recorded conflicts. Original data and truthful legacy attribution retained. All content is independently unreviewed; release incomplete.

Close round: another guarded 60-entry N1 vocabulary batch applied; coverage recomputed. Specific regression verifies corrected 萬 MN is exactly арван мянга and rejects bare 10,000 as MN. All ten source conflicts retained. Meaning/category/example/UI/review scope unfinished; no release.

Advance round added two guarded 60-entry batches: 60 kanji and 60 vocabulary. Coverage recomputed after each (817 then 757 missing meanings); ten source blockers retained. Examples unchanged. All original data/provenance retained.

Finish continuation added 60 guarded N1 kanji meanings/topics; coverage recalculated. Independent review/source blockers remain outstanding. No release.

## Remainder round — 540 meanings

Three guarded 60-entry kanji batches and six guarded 60-entry vocabulary batches added 540 meanings. Coverage recomputed after each application: 637, 577, 517, 457, 397, 337, 277, 217, 157 missing meanings. Full checks passed after the kanji group and after each vocabulary batch; the first three kanji applications did not individually run the full check suite (deviation from requested cadence). Strict completion remains exit 1. Expanded exact-batch regressions cover close/advance/finish/remainder batches, including source and category evidence. New content remains independently unreviewed. 31 vocabulary and 126 kanji meanings, 2,228 categories and 14,407 examples remain; ten recorded conflicts are unchanged, and further suspect/unsupported glosses remain untranslated. No merge/deploy or final browser audit.

## Final-source pass (still incomplete)

Added 95 guarded kanji meanings in batches of 60 and 35; full checks and strict report recalculated after each. Remaining meanings: 31 vocabulary plus 31 kanji. These remaining records include source mismatches, unsupported glosses and empty sources; no guesses applied. Began examples despite meaning blockers: two 20-sentence N5 batches with exact Japanese sentence keys, English and headword/reading guards. Both batches fully checked individually. Reduced unclassified entries by 63 through explicit semantic topics on new meanings. All ten existing conflicts individually recorded with exact source guards in content/mn/source-conflict-audit-2026-10-08.json; all remain unresolved. This audit is internal comparison, not newly obtained dictionary evidence. Strict gate still blocks release; no merge/deploy/browser-completion claim.

## Example corpus round — 219 sentences and 50 topics

Five N5 batches (40/40/40/40/35 sentences) and one N4 batch (24 sentences) added 219 natural Mongolian example translations. Every sentence uses stable vocabulary ID, exact Japanese sentence key, exact retained English and w/r/en guards. Original source unchanged; new translations AI-authored and independently unreviewed. Counts recalculated after each batch: 14327 → 14287 → 14247 → 14207 → 14172 → 14148 untranslated examples. A separate 50-entry N4 evidence-backed topic batch reduced unclassified 2165 → 2115. Full typecheck/data/routes/coverage/retention/build and strict gate ran after each of these seven batches; structural checks passed, strict gate exit 1. Corpus regression verifies exact source, unique sentence keys, applied Mongolian/provenance, batch sizes and topic evidence. All 62 missing meanings and ten individual source-conflict warnings/audit records unchanged. No external conflict evidence acquired, no warning silently resolved. Higher-level/grammar examples and page/browser/human reviews remain unfinished. PR stays draft/unmerged/unreleased.

## Sustained examples — 261 sentences

Added 193 N4 + 62 N3 vocabulary and 6 N2 grammar sentences in eight guarded example batches. Coverage after each: 14108 → 14068 → 14028 → 13988 → 13955 → 13915 → 13893 → 13887. Three suspect N4 sentence pairs withheld with exact source/audit records, not silently corrected. N5–N3 grammar examples were already covered, so new grammar work used N2. Twenty additional explicit N4 topic assignments reduce unclassified to 2095. Every batch received full checks/strict gate, new regressions verify exact source/applications/provenance/evidence and withheld sentences. Static UI inspection documented Admin localization gaps; no exhaustive bilingual browser approval. All 62 meanings and ten recorded conflicts unchanged. Strict gate remains exit 1; draft/unmerged/unreleased.

## October 9 continuation — 260 guarded sentences and Admin localization

Recalculated initial working-tree coverage: 62 meanings / 13887 examples / 2095 unclassified / 10 source conflicts. Reconciled local branch metadata to confirmed remote 928cd31 with a mixed reset preserving all working files. Added 120 N2 grammar, 120 N1 grammar, 20 N2 vocabulary examples across seven guarded batches. Counts after each: 13847, 13807, 13767, 13727, 13687, 13647, 13627. Full checks and strict gate after every batch (initial missing tsc resolved with npm ci before advancing). Twenty exact-source N3 kanji topics reduce unclassified to 2075. New semantic content independently unreviewed. All 62 missing meanings and ten conflicts unchanged.

Admin visible static strings now have MN/EN rendering for headers/tabs, overview counts/empty, queue origins/actions/status/empty, import fields/validation/busy/result. Mixed pending_review labels replaced by natural display text, internal API states retained. Mock-API bilingual Chromium regression passed overview, reject/empty, import validation/success in both languages. This does not verify real admin authorization, backend-generated notes/errors/translation content, all loading/network-error states, or exhaustive app browser matrix. No Arena/demo removal claimed. Full release still blocked.
