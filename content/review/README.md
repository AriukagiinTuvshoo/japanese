# Хүний хяналтын шийдвэрүүд (file-based review)

Энэ **нийтлэг** (`content/review/`) нь хүний хяналтын workflow-г Git дээр хадгална.
Яагаад UI биш: энэ репод `server/` (backend) байхгүй тул `src/pages/Admin.tsx`-ийн
Approve/Reject товч `/api/admin/*` руу дуудаж чадахгүй — браузер мөн репозиторийн
файл бичих боломжгүй. Тиймээс шийдвэр бүр файл болж, `git diff`-ээр хянагдана.

## Файлууд

| Файл | Юу вэ | Хэн бичдэг вэ |
|---|---|---|
| `QUEUE.md` | одоогоор хянах ёстой бичлэгүүд (жагсаалт) | **машин** — `npm run review:queue` |
| `decisions.json` | шийдвэр бүр: `approve` / `revise` / `reject` / `verify` | **хүн** — `npm run review:mark` |

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
2. Дөрвөн үйлдэл:
   - `approve` — зөв, баталгаажуулна (terms-ийн хувьд `status → curated` + `reviewedBy`).
     **Зөвхөн энэ үйлдэл** `curated` тавьдаг.
   - `revise` — засвар санал (`--mn="шинэ утга"`-г шийдвэрт хадгална, өгөгдөл өөрчлөгдөөгүй)
   - `reject` — хэрэглэхгүй (тэмдэглэлээ `--note`-д бичнэ)
   - `verify` — нотолгоотой шалгалт бүртгэнэ (жишээ: техникийн/AI шалгалт,
     эх сурвалжийн тулгалт). `revise`-ийн адил **өгөгдөл, төлөв өөрчлөгдөхгүй**
     ба `curated` тавихгүй — эцсийн хүний батламжыг `approve`-аар л өгнө.
3. `decisions.json`-ийн түлхүүр: `<kind>:<key>` — жнь `vocab:学校|がっこう`,
   `kanji:学`, `grammar:〜は`, `terms:particle`.
4. Шийдвэрийг **коммит** хийнэ — түүнээс гадна өөр газар "баталгаажсан"
   гэж дүрслэхгүй.
