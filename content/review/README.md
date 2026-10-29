# Хүний хяналтын шийдвэрүүд (file-based review)

Энэ **нийтлэг** (`content/review/`) нь хүний хяналтын workflow-г Git дээр хадгална.
Яагаад UI биш: энэ репод `server/` (backend) байхгүй тул `src/pages/Admin.tsx`-ийн
Approve/Reject товч `/api/admin/*` руу дуудаж чадахгүй — браузер мөн репозиторийн
файл бичих боломжгүй. Тиймээс шийдвэр бүр файл болж, `git diff`-ээр хянагдана.

## Файлууд

| Файл | Юу вэ | Хэн бичдэг вэ |
|---|---|---|
| `QUEUE.md` | одоогоор хянах ёстой бичлэгүүд (жагсаалт) | **машин** — `npm run review:queue` |
| `decisions.json` | шийдвэр бүр: `approve` / `revise` / `reject` | **хүн** — `npm run review:mark` |

## Алхам

```bash
npm run review:queue                      # QUEUE.md шинэчилнэ
npm run review:status                     # шийдвэрийн тоо харах
npm run review:mark -- terms particle \
  --action=approve --reviewer="Нэр" --note="яагаад"
git diff content/review/                  # шийдвэрийг хянах
npm run content:qa                        # нотолгоогүй curated байхгүйг шалгана
```

## Дүрэм

1. **`--reviewer` заавал.** Хүнгүйгээр шийдвэр үүсэхгүй; `curated` төлөв
   нотолгоогүйгээр тавигдахгүй (`scripts/content-qa.mjs` шалгана).
2. Гурван үйлдэл:
   - `approve` — зөв, баталгаажуулна (terms-ийн хувьд `status → curated` + `reviewedBy`)
   - `revise` — засвар санал (`--mn="шинэ утга"`-г шийдвэрт хадгална, өгөгдөл өөрчлөгдөөгүй)
   - `reject` — хэрэглэхгүй (тэмдэглэлээ `--note`-д бичнэ)
3. `decisions.json`-ийн түлхүүр: `<kind>:<key>` — жнь `vocab:学校|がっこう`,
   `kanji:学`, `grammar:〜は`, `terms:particle`.
4. Шийдвэрийг **коммит** хийнэ — түүнээс гадна өөр газар "баталгаажсан"
   гэж дүрслэхгүй.
