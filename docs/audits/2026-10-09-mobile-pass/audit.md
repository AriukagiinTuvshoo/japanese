# Mobile UX pass (320–430px) — audit note

Tested head: `f7a437c` (code commit; `scripts/test-mobile-browser.mjs` ran against a frozen `dist` built from its exact source tree — this note only cites that head).
Suite: `scripts/test-mobile-browser.mjs` (new) — 320/375/390/430px × MN+EN, frozen `dist`, `isMobile`/`hasTouch` context, port 4182.

## Confirmed defects (browser-measured before fixes)

- mn@320 menu button: 40×40px (< 44px). Route sweep at 320px: 21 routes, no page overflow or clipped Japanese text.
- After raising control heights: language/level/search filter buttons still < 44px wide (e.g. 41×44, 38×43) — width fixes needed alongside height.

## Fixes (CSS/class only; `sm:` resets keep tablet/desktop sizes unchanged)

- `ui.tsx` Button sm/md/icon, Tabs, Select, SpeakButton: 44px min width/height on phone widths (`min-h-11 min-w-11 sm:min-h-0 sm:min-w-0`).
- `Shell.tsx` top-bar search/menu and drawer close: 44×44; Language/Level switcher buttons 44px (min-w too); drawer control row `flex-wrap`; level row scrolls in drawer; bottom-nav tabs `min-h-11`.
- `SearchPalette.tsx` header wraps; input/filters 44px on phones; ESC kbd hidden below `sm`.
- Filter chips on Vocabulary/Kanji lists 44px min-height on phones.
- SpeakButton inline overrides (`!h-7/!h-8/!h-10`) in Vocabulary/WordRow, KanjiDetail, ReadingDetail, ListeningDetail, Dictionary, XRayText: 44px on phones, original sizes at `sm:`.
- `EntryNavigator.tsx` prev/next steps `min-h-11`.

## Results after fixes (see after-fixes.txt)

- `node scripts/test-mobile-browser.mjs` exit 0: all 8 width×language combinations pass — 21 routes each with no horizontal page overflow or clipped Japanese text; menu/search/language/level controls reachable and ≥44px (1px layout-rounding tolerance); drawer and search dialog contained at 320px; word/kanji prev/next and speak tap targets pass; grammar quiz primary actions ≥44px; mock practice shows the honest full-exam block; safe-area bottom clearance verified.
- Regressions (all exit 0): `npm run typecheck`, `npm run content:validate`, `npm test` (43 files), `npm run test:study`, `npm run test:site-browser` (desktop+tablet layout checks intact), `npm run test:runner-browser`.
- `npm run build` exit 0.
- Strict content gate unchanged: `npm run coverage:validate` exit 1 — INCOMPLETE — release blocked. Totals unchanged: 62 missing meanings (31 N1 vocab + 31 N1 kanji), 12,774 example gaps (N5 974, N4 1,010, N3 3,121, N2 2,861, N1 4,808), 1,851 unclassified, 10 source issues; full N5–N1 mock stays blocked.
- `git diff --check` exit 0.

Scope: UI responsiveness only. No content, provenance, coverage-gate, or Japanese-source changes.
