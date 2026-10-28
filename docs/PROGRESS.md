# PROGRESS — Nihongo Dōjō

Сүүлд шинэчилсэн: 2026-10-27 · Milestone A (P0 бүхэн) дууссан — Milestone B-ийн зөвшөөрөл хүлээж байна

## Фазын төлөв

| Phase | Төлөв | Тэмдэглэл |
|---|---|---|
| 0 — Аудит | ✅ дууссан | `docs/PHASE0_AUDIT.md` |
| 1 — Milestone A (P0) | ✅ дууссан | `fix/p0-core`, 7 commit (доор) |
| 1 — Milestone B (P1+) | ⏳ хүлээж байна | playwright, content:qa, missing data, review queue |
| 2 — Контентын чанар | ⏳ | Хамгийн чухал; Phase 3-аас өмнө |
| 3 — Learning engine | ⏳ | |
| 4 — UX/A11y/Perf | ⏳ | |
| 5 — Backend/Ops | ⏳ | `server/` байхгүй хэвээр |

## Milestone A — хийсэн ажил

| # | Commit | Юу зассан | Тест |
|---|---|---|---|
| P0-1 | `ccc2bd8` | Again → 10 мин learning step; fuzz зөвхөн ≥3 хоногийн интервалд; stability 36,500 хоногт хязгаарлав | `src/lib/srs.test.ts` (12) |
| P0-2 | `545ab08` | `buildQuiz`/`buildExam` хүссэн N асуулт өгнө (per-type quota-г нийттэй харьцуулах байсныг зассан) | `src/lib/study.test.ts` (15) |
| P0-3 | `9e3c234` | Схем шалгалт + v2→v3 migrate + эвдэрхийг нөөцлөх + quota toast + route error boundary + importJSON шалгалт | `src/lib/storage.test.ts` (15) |
| P0-4 | `b4f99a6` | Backend тохируулаагүй бол `/api/health` огт дуудахгүй; алдаа гарвал 30с→10мин backoff, чимээгүй | `src/lib/api.test.ts` (6) |
| P0-5 | `79bd7c6` | Build-аас хамаарах SW хувилбар, shell + N5 precache, N4–N1 арын warm, хуучин кэш устгах, "шинэчлэх" toast; 4 фонт self-host (2.1 MB woff2) | Playwright: offline-real / update-test |
| P0-6 | `e7a9520` | meta.json шударга (sources 7, byLevel.vocabMn бодит, curated=0), About-д лиценз + чанарын төлөв + MT disclosure, README attribution | `data:validate` дүрэм |
| EXTRA | `8473c47` | Хялбаршуулсан хятад үсгийн хориг (漢字/復習 vs 汉字/复习) | `src/lib/glyphs.test.ts` (3) |

## Чанарын хаалга (Milestone A-ийн дараа)

| Шалгалт | Үр дүн |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npx vitest run` | ✅ 51 тест / 5 файл |
| `npm run test:routes` | ✅ exit 0 |
| `npm run data:validate` | ✅ 0 алдаа, 0 анхааруулга |
| `npm run build` | ✅ ~5 s, 123 kB gzip main JS |
| Офлайн (сервер унтраасан) | ✅ home/vocab/kanji/grammar/review + 4 фонт, 0 console error |
| Console алдаа (production) | ✅ `/api/*` хүсэлт 0 |
| SW update flow | ✅ toast → шинэ SW → хуучин кэш устсан |

## Контентын тоо (шударга төлөв)

| Ангилал | Нийт | curated | draft | auto |
|---|---|---|---|---|
| Үгийн сан | 10,461 | **0** | 7,380 | 3,081 |
| Ханз | 2,794 | **0** | 1,040 | 1,754 |
| Дүрэм | 526 | 0 | — | 526 (mn бүгд машин) |
| Үгийн жишээ (MN) | 13,718 | — | — | 13,718 |
| Дүрмийн жишээ (MN) | 1,526 | — | — | 1,526 |

Дээжээр (60/30/10/10) хэмжсэн алдааны түвшин: **≈10–13%**, N1 `auto` ба дүрмийн
тайлбарт төвлөрсөн. `meta.json` одоо үүнийг шууд харуулна (`counts.mn`).

## Milestone B — хийсэн ажил (branch `fix/milestone-b`)

| # | Commit | Юу зассан | Тест |
|---|---|---|---|
| B1 | `896a61a` | `mergeDocs(local, remote)` цэвэр merge + `docs/SYNC.md` (талбар бүрийн дүрэм, сервер гэрээ), pull/push дээр blind `push(true)`-ийг орлож, 409 дээр дахин merge, синкын өмнө локал нөөц | `src/lib/merge.test.ts` (15, property: commutative/associative/idempotent ×500) |
| B2 | `7d48dbe` | Зочин → аккаунт: нэвтрэхэд guest ахиц устгахаа больсон, `mergeDocs`-аар нэгтгэх санал (default ON), signOut-д локал копи үлдэнэ | `src/lib/guest.test.ts` |
| B3 | `93a9478` | Импорт preview (кард/xp/streak/өдөр/хувилбар) + merge-or-replace (default merge) + урьдчилсан нөөц + нэг товшилт Undo; Anki CSV (due+weak, UTF-8 BOM, CSV escaping) | `src/lib/port.test.ts` (17: malformed, хуучин/шинэ хувилбар, 5 MB, `__proto__`, давхар импорт, undo) |
| B4 | (энэ commit) | Хадгалалтын хязгаарыг **бичлэгээс өмнө** мэдээлнэ (80%), нэг удаа persistent storage хүснэ, нөөцийн тоог баримтын хэмжээгээр тогтооно (3/1/0) | `src/lib/quota.test.ts` (10) |

### B4 — Докийн хэмжээ (мергөжүүлэл, `npx vite-node scripts/measure-doc.ts`)

| Төлөв | Карт | Өдөр | Хэмжээ |
|---|---|---|---|
| Анхны (хоосон) | 0 | 0 | **0.5 kB** |
| Типик (6 сар) | 600 | 180 | **130 kB (0.13 MB)** |
| Хүнд (3 жил, бүх үг) | 10,461 | 1,095 | **1.72 MB** |
| Хэт хүнд (стресс) | 20,000 | 2,000 | **3.54 MB** |

Типик баримт × (основ + 3 sync нөөц + undo + коррупт нөөц) ≈ **0.76 MB** → Safari-ийн
~5 MB token-ийн хязгаарт багтана. Тиймээс **IndexedDB рүү шилжүүлэх шаардлагагүй** гэж
дүгнэсэн (адаптер + миграцийн эрсдэл үр ашгаас илүү); оронд нь хүнд баримтад нөөцийн тоог
0/1 болгон хязгаарлав. `navigator.storage.estimate()` дэмжихгүй хөтөч дээр ямар ч
нэмэлт дуудалтгүй, таамаглахгүй.

## Мэдэгдэж байгаа, хийгдээгүй (Milestone B-д)

- Lighthouse дахин хэмжих (P0-5-ын дараа хүлээгдэж буй сайжрал: фонт CDN-гүй, 0 API 500).
- A11y: контраст (vocab 67 зөрчил), `lang="ja"`, 44px touch target — Phase 4.
- `content:qa`, review queue, N1/N2 контентын чанар — Phase 2.
- Иш татсан жишээ өгүүлбэрийн хяналт (10–13% алдаа) — Phase 2.
- `server/` (sync) — Phase 5.
