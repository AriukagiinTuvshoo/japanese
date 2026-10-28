# PROGRESS — Nihongo Dōjō

Сүүлд шинэчилсэн: 2026-10-28 · Milestone A + B1–B7 дууссан (branch `fix/milestone-b`) — B8/B9 дараагийн алхам

## Фазын төлөв

| Phase | Төлөв | Тэмдэглэл |
|---|---|---|
| 0 — Аудит | ✅ дууссан | `docs/PHASE0_AUDIT.md` |
| 1 — Milestone A (P0) | ✅ дууссан | `fix/p0-core`, 7 commit (доор) |
| 1 — Milestone B (P1+) | 🔄 явцтай | B1–B7 ✅ (доор), B8 e2e + B9 цэвэрлэгээ үлдсэн |
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

## Чанарын хаалга (B7-ийн дараа — 2026-10-28, бүх шалгалт нэг дор ажиллуулсан)

| Шалгалт | Үр дүн |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npx vitest run` | ✅ **203 тест / 11 файл** (Milestone A-д 51/5) |
| `npm run test:routes` | ✅ exit 0 |
| `npm run data:validate` | ✅ 0 алдаа, 0 анхааруулга |
| `npm run fonts:check` | ✅ 3,308 тэмдэгт бүгд нэг chunk-д, overlap 0 (tofu/нийлэлдэлтгүй) |
| `npm run test:sw` | ✅ install-д зөвхөн критик, хуучин кэш устдаг, ND_WARM ажиллана |
| `npm run build` | ✅ ~4 s, 131 kB gzip main JS |
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
| B4 | `db1a99a` | Хадгалалтын хязгаарыг **бичлэгээс өмнө** мэдээлнэ (80%), нэг удаа persistent storage хүснэ, нөөцийн тоог баримтын хэмжээгээр тогтооно (3/1/0) | `src/lib/quota.test.ts` (10) |
| B5 | `fbe0a53` | Жинхэнэ JLPT дүрмээр: хэсэг бүрт ≥60% + нийт дүн, хэсгийн оноог шалгалтын дэлгэцээр харуулна; XP таблицийн эрэмбэ зассан (reviewEasy ≤ reviewGood) | `src/lib/study.test.ts`, `src/lib/gamification.test.ts` (38 шинэ) |
| B6 | `0b9e4b1` | Уншлага/Сонсгол навигацийг **default OFF** флагаар нуусан (код үлдсэн), гүнзгий холбоос "бэлэн болоогүй" шударга хуудас; `docs/FEATURE_GAPS.md` — юу хэрэгтэйг бүрэн жагсаав | `src/lib/features.test.ts` (52) |
| B7 | (энэ commit) | Фонт: 2 файл (2.1 MB) → **13 хэсэг unicode-range-тай**, эхний ачаалал **271 kB** (<300); serif core зөвхөн mincho-д гардаг 84 тэмдэгт; `fonts:check` (coverage) + `test:sw` (SW-ийн кэш/тэсэлгээ) npm-д оруулсан | `scripts/check-font-coverage.mjs`, `scripts/test-sw.mjs`, Lighthouse ×12 |

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

## B7 — Фонт: жин хэмжээс (2026-10-28)

**Юу өөрчлөв:** `scripts/build-fonts.mjs` нь одоо 4 фоноо 13 woff2 хэсэгт (unicode-range) таслана.

| Файл | Хэмжээ | Юу агуулдаг | Хэзээ татагдаг вэ |
|---|---|---|---|
| manrope.woff2 | 22 kB | латин/кирилл (UI хэл) | эхний рендер (**preload**) |
| jetbrains-mono.woff2 | 30 kB | тоо/код | эхний рендер (tabnum) |
| noto-sans-jp-**core** | 180 kB | кана + N5/N4 ханз + UI хатуу текст | эхний рендер (**preload**) |
| noto-sans-jp-n3/n2/n1/rest | 97/104/493/32 kB | түвшин бүрийн ханз | тэр түвшний хуудас нээгдэхэд |
| noto-serif-jp-**core** | **66 kB** | **зөвхөн `font-mincho` элементэд гарч болох 84 тэмдэгт** + латин | зөвхөн минчо тексттэй хуудас |
| noto-serif-jp-n4/n3/n2/n1/rest | 61/132/141/664/123 kB | N5+N4, N3, N2, N1 ханз + кана | ханзан тэмдэг/тол mincho-д гарахад |
| **Нийт** | 2.19 MB | (омно: 2 файлаар 2.1 MB, ямар ч unicode-rangeгүй) | |

- **Эхний ачааллын фонт = 271 kB** (22+30+180+66, бүгд transfer) — зорилт **<300 kB** биелэв.
- Яагаад serif-ийг тусад нь жижигчилсэн: UI-ийн гарчиг/иконууд mincho-д байдаг ч тэд
  хэдхэн арав тэмдэгт; бүх N5/N4-ийг серфийн `core`-д оруулбал **+246 kB** болж,
  эхний ачаалал 480 kB болдог (ойролцоо үнэлээд үзсэн: 84 тэмдэгт = 66 kB, 650 = 246 kB).
- `npm run fonts:check` — өгөгдөл/кодын **бүх** япон тэмдэг ямар нэг хэсгийн unicode-range-д
  байгааг (tofu эрсдэлгүйг) баталгаажуулна, хэсгүүд нийлэлдэхгүйг шалгана → CI хаалга.
- `npm run test:sw` — SW install-д зөвхөн критик файл, хуучин build-ийн кэш устдаг,
  `ND_WARM` мессежээр үлдсэн chunk-ууд кэшинэ, save-data/2G үед татдаггүй.
- Визуал шалгалт: `artifacts/b7-fonts-core-only.png` (зөвхөн core) vs
  `artifacts/b7-fonts-full-n5-n3.png` (бүрэн) — N5–N3 агуулгад дутуу мөр алга.

### B7 — Lighthouse (mobile) before / after

Одоо байдал: Lighthouse **13.6.0**, `headless=new`, **шинэ profile** тус бүрт, mobile preset
(4x CPU, simulated slow-4G), `vite preview` → `dist`, Windows 11 / Node 24, **3 удаа → медиан**.
Түүхий JSON: `artifacts/b7-lighthouse-summary.json` (before/after бүр 12 run).

| Хуудас | Perf before → after | LCP before → after | CLS after | Фонт (transfer) before → after | Нийт жин before → after |
|---|---|---|---|---|---|
| Home | 75 → **87** | 6 909 → **3 732 ms** | 0.000 | 882 → **271 kB** | 1 034 → 433 kB |
| Vocab N1 | 75 → **85** | 6 609 → **3 461 ms** | 0.000 | 882 → **271 kB** | 1 038 → 438 kB |
| Review | 75 → **87** | 6 909 → **3 459 ms** | 0.000 | 882 → **271 kB** | 1 035 → 434 kB |
| Kanji detail (日) | 75 → **87** | 7 057 → **3 768 ms** | 0.000 | 882 → **271 kB** | 1 036 → 435 kB |

**Хэрхэн хэмжсэн:** `npx lighthouse@13.6.0 <url> --output=json --only-categories=performance
--chrome-flags="--headless=new --no-sandbox --disable-gpu"` (before/after ижил тэмдэглээж, 12 run).

**Тогтворгүй байдал (шударга тэмдэглэл):** build-ийн **шууд дараа** ажиллуулсан run-ууд Windows-ийн
файл скани/дискний саатлын улмаас LCP 7–17 s хүртэл муудсан (нийт 2.7 MB-тай, арын дата
таталт давхцсан) — уг хэмжилтийг давтан гаргаж байсан. Эцсийн тоонууд нь **build-аас ≥20 мин
хойно** авсан, дотоод сүлжээнд сааталгүй run-уудын медиан; 3 run бүрт давтагдсан.

## Мэдэгдэж байгаа, хийгдээгүй (Milestone B-д)

- A11y: контраст (vocab 67 зөрчил), `lang="ja"`, 44px touch target — Phase 4.
- `content:qa`, review queue, N1/N2 контентын чанар — Phase 2.
- Иш татсан жишээ өгүүлбэрийн хяналт (10–13% алдаа) — Phase 2.
- `server/` (sync) — Phase 5.
