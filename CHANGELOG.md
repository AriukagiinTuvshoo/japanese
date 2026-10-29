# CHANGELOG

Бүх онцолж буй өөрчлөлтүүд. Формат: [Keep a Changelog](https://keepachangelog.com/).
Гишгүүд: `Added` · `Changed` · `Fixed` · `Removed` — энд зөвхөн хэрэглэгчэд/хөгжүүлэгчдэд
чухал өөрчлөлтүүд жагсана.

## [Unreleased] — Milestone B (branch `fix/milestone-b`)

### Fixed

- **B1 — Синкийн аюулгүй байдал** (`896a61a`): `pull() → push(true)` нь хоёр төхөөрөмжийг
  хооронд нь дарж байсан. Одоо `mergeDocs(local, remote)` цэвэр merge + талбар бүрийн дүрэм
  (`docs/SYNC.md`), синкын өмнө локал нөөц, 409 дээр дахин merge. Тест: `src/lib/merge.test.ts`
  (property: commutative/associative/idempotent ×500).
- **B2 — Зочин → аккаунт** (`7d48dbe`): нэвтрэх/гарахдаа зочны ахиц устгахаа больсон;
  "гост ахицыг нэгтгэх" диалог (default ON), signOut-д локал копи үлдэнэ.
  Тест: `src/lib/guest.test.ts`.
- **B3 — Импорт/Экспорт** (`93a9478`): импорт одоо storage-ийн адил схемээр баталгаажна,
  preview (кард/xp/streak/өдөр/хувилбар), урьдчилсан нөөц, нэг товшилт Undo; шинээр
  **Anki CSV** экспорт (due + weak, UTF-8 BOM). Тест: `src/lib/port.test.ts` (17).
- **B4 — Хадгалалтын хязгаар** (`db1a99a`): localStorage дүүрэхээс **өмнө** анхааруулна (80%),
  нэг удаа persistent storage хүснэ; нөөцийн тоог баримтын хэмжээгээр тогтооно.
  Тест: `src/lib/quota.test.ts` (10). IndexedDB шилжүүлэлт хэмжилтээр шаардлагагүй гэж тогтоов.
- **B5 — Шалгалтын дүн** (`fbe0a53`): жинхэнэ JLPT дүрмээр — хэсэг бүрт ≥60% **ба** нийт дүн,
  хэсгийн оноог шалгалтын дэлгэцээр харуулна; XP таблицийн эрэмбэ зассан (reviewEasy ≤ reviewGood).
  Тест: `src/lib/study.test.ts`, `src/lib/gamification.test.ts` (38 шинэ).
- **B6 — Хоосон онцлог** (`0b9e4b1`): Уншлага/Сонсгол навигацийг **default OFF** флагаар нуусан
  (код үлдсэн), гүнзгий холбоос "бэлэн болоогүй" шударга хуудас; `docs/FEATURE_GAPS.md`.
  Тест: `src/lib/features.test.ts` (52).
- **B7 — Фонт жин** (`2c52f86`): Noto Sans/Serif JP 2 файл (2.1 MB) → **13 unicode-range хэсэг**,
  эхний ачаалал **271 kB** (<300 kB зорилт); SW кэшийг build хэсгээр хувааж урдчилах.
  Шалгалт: `npm run fonts:check`, `npm run test:sw`, Lighthouse ×12 → `docs/PROGRESS.md`.
- **B8 — E2e шинэчлэл** (`4bd8f8c`): Playwright шинжилгээ `e2e/` -д (`.cache` биш),
  `npm run test:e2e` + CI ажил (headless, rootгүй); SW `Vary` толгойн засвар (офлайн кэш),
  guest-merge диалог навигацийн давхарга дээр гардаг болсон; стартапын мэдэгдэл (recovery/
  migration) `Notices`-д хүрэхгүй байсныг засав. 5 сценари + `src/lib/notice.test.ts`.
- **B9 — Цэвэрлэгээ** (энэ commit): `src`-аас ашиглагдаагүй 30 export/функцийг устгасан
  (~290 мөр: `seeded`, `KANA_TIPS`, `getToken`, `ping`, `levelFromScore`, `LinkButton`,
  `useLazy`, `MemoryPanel` г.э.), README-ийн онцлог жагсаалт Б6-ийн бодит төлөвтэй
  тааруулж, CHANGELOG-ийг нээв.

## [3.0.0] — Milestone A (branch `fix/p0-core`)

### Fixed

- `ccc2bd8` — SRS: "дахин" (Again) 10 минутын алхамдаа буцаж, stability 36,500 хоногоор
  хязгаарлагдаж, зөвхөн ≥3 хоногийн интервалд fuzz дүрэгдэнэ.
- `545ab08` — Квиз/шалгалт хүссэн асуултын тоог холимог төрлөөр ч биелүүлнэ (per-type quota).
- `9e3c234` — localStorage: схем баталгаажуулалт + v2→v3 миграци + эвдэрсэн баримтын нөөц +
  quota toast; маршрут бүрт error boundary; импорт баталгаажуулалт.
- `b4f99a6` — Backend тохируулаагүй бол `/api/health` огт дуудахгүй; алдаа 30с→10мин backoff.
- `79bd7c6` — Жинхэнэ офлайн: SW хувилбар build-аас, shell + N5 precache, N4–N1 арын warm,
  хуучин кэш устгал, "шинэчлэх" toast; 4 фонт локал woff2.
- `e7a9520` — `meta.json` шударга (эх сурвалж 7, бодит тоо, curated=0), About-д лиценз +
  чанарын төлөв + машин орчуулгын мэдээлэл.
- `8473c47` — Япон текстэд хялбаршуулсан хятад үсэг (漢字/復習) хориглогдоно.
- `8f2b01f` — Route тестийг transpile дараа `file://` ачаална (Windows дээр ажиллахгүй байсан).

## Хуучин (main дээрх үндсэн ажил)

### Added

- `ca8b3ae` — PWA: офлайн service worker, manifest, icons, GitHub Pages deploy.
- `0bbeb37` — MN/EN бүрэн хоёр хэлтэй интерфейс.
- `b01fcf6` — N2/N1 контентын тогтвортой байдлын шинэчилгээ скрипт + REVIEW дэвтэр.
