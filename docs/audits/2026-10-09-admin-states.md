# Admin and shared state audit — partial release coverage

All three Admin screens were inspected in source. UI-authored labels now have MN/EN display mappings. Stable API kind/state values remain unchanged. Editable Mongolian content and backend diagnostics are data, not relabeled as English translations.

| Screen | Inspected states / focused mock-browser coverage |
|---|---|
| Overview | Loading, failed request, retry, content counts, empty top words, populated top words (explicit MN label), QC diagnostic list |
| Queue | Loading, failed request/retry, populated AI suggestion, filter/kind labels, MN input, reject-to-empty, empty state |
| Import | Fields, disabled blank submit, array validation, malformed JSON syntax, request error, submitting/disabled state, added/skipped result |
| About | Delayed metadata and failed metadata: shared loading/error headings follow current MN/EN language |

Both language test runs passed. These are mock API state tests, not production authorization/data mutation verification. Approval/edit payloads, all origin combinations, filter request races, in-place language switching with existing errors/results, network timeout text, and backend-generated diagnostic/note translations still need additional review. Do NOT call all Admin behavior or all visible content complete. Other app pages/mobile layouts need an exhaustive browser matrix.

Shared loading/error widgets now inherit selected language when callers omit it. Explicit localized caller labels remain preserved. Native JSON parser exception text is no longer exposed as the UI-authored import syntax message.

No confirmed visible Arena/demo artifact was removed; prior substring scan found ordinary input placeholder attributes. No study features removed.

Continuation: About populated metadata now renders all five source descriptions in BOTH languages, including the actual jamdict-data 1.5 CC-BY-SA-3.0 dictionary license (MIT package). Both sets of static-metadata browser assertions passed; the Admin endpoint tests remain mocks. See the full captured output in `2026-10-09-validation.md`.
