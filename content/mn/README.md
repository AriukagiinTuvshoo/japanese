# Mongolian translation provenance and licensing

OpenJLPT: **evanclan and contributors**, https://github.com/evanclan/OpenJLPT, CC-BY-SA-4.0. This repository retains original Japanese patterns, readings, English meanings and examples and adds Mongolian translations. New OpenJLPT-derived Mongolian text is an adaptation distributed under **CC-BY-SA-4.0**: https://creativecommons.org/licenses/by-sa/4.0/ . Credit the source and translators, identify changes, and distribute adaptations under that license. This license applies to derived learning content, not automatically to all application code. Original KanjiVG CC-BY-SA-3.0, kanji-data MIT and upstream dictionary/example obligations remain applicable.

New batches in `batches/` record author, date, source snapshot, method, license, and actual review status. `mn_provenance` links public records to the public provenance manifest. Batch IDs and entry IDs are stable; indices are not accepted. `npm run translations:apply` applies all batches without replacing retained English/Japanese/examples; `data:build` reapplies them after upstream generation.

The 2026-10-08 batches were AI-authored by the Arena coding assistant. **No independent human review is claimed.** Older `drafts/`, `drafts-pending/`, and JSON translations predate this session; their authorship and review histories are not established. They are preserved, not relabeled as human-reviewed. Pending TSVs must not be blindly imported: some glosses need accuracy review and are index-based.

Category taxonomy rules and overrides live in `content/categories/`. Rules use whole-word matching, allow multiple groups, and never hide unclassified entries under “Other”. Override keys are stable vocabulary IDs or kanji characters. Validate appropriateness manually as well as structurally.

See `docs/CONTENT-STATUS.md` and `content/coverage-report.json` for exact remaining work.
