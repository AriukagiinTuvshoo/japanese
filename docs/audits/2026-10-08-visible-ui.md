# Visible UI inspection — incomplete

Static source inspection only; not an exhaustive browser or bilingual review.

- Searched `src` for Arena/demo/placeholder markers. Hits were normal input placeholder attributes, not proof of visible demo branding. No blanket removal was performed.
- `src/pages/Admin.tsx` remains a localization blocker: page title, subtitle, tabs, stats, queue controls and import placeholders are hard-coded Mongolian. English mode cannot be considered localized on this page. The subtitle exposes `pending_review` and origin label mixes English `pending` with Mongolian. These are real review states, not removable study features; they need bilingual presentation rather than deletion.
- No assertion that the other pages, empty/error/loading states or mobile layouts pass. Full page/state MN/EN browser matrix remains outstanding.
- No source warnings resolved; ten individual source audits remain internal, not external evidence.
