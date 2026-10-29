# Хүний хяналтын дараалал (QUEUE)

Үүсгэсэн: **2026-10-29** · `scripts\review.mjs` · шинэчлэх: `npm run review:queue`

> Энэ файл **машин үүсгэнэ** — гар аргаар бүү зас. Шийдвэрийг доорх
> `review:mark` командаар бичнэ; тэр нь `content/review/decisions.json`-д
> бичигдэж, `git diff`-ээр хянагдана. **`curated` төлөв зөвхөн хүн
> баталгаажуулсны дараа** (`content:qa` нотолгоогүйгээр устгана/эсэргүүцнэ).

## Төлөвийн хуваарилалт (нийт)

| Хэв | Нийт | curated | draft | auto | Хүн хянаагүй |
|---|---:|---:|---:|---:|---:|
| vocab | 10461 | 0 | 7380 | 3081 | 10461 |
| kanji | 2794 | 0 | 1040 | 1754 | 2794 |
| grammar | 526 | — | — | — | 0 мn-гүй |
| terms | 48 | 0 | 33 | — | 15 needs_review |

## Нэр томьёо (terms) — хүлээгдэж буй шийдвэр

| Ключ | Түвшин | Төрөл | Япон | Монгол | Эх сурвалж | Төлөв | Тайлбар |
|---|---|---|---|---|---|---|---|
| `noun` | — | нэр томьёо | 名詞 → Нэр үг | Нэр үг | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | Өөрийгөө нэрлэдэг үг. Япон хэлд хувиралдаггүй. |
| `verb` | — | нэр томьёо | 動詞 → Үйл үг | Үйл үг | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | Хувирал (活用) өөрчлөгдөдөг үг — цаг, хэлбэр, өнгө өөрчлөгдөнө. |
| `i-adjective` | — | нэр томьёо | い形容詞 → и-тэмдэг нэр | и-тэмдэг нэр | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | -い-ээр төгсдөг тэмдэг нэр; үгүйсгэл, өнгөрсөн цаг өөрчлөгдөнө. |
| `na-adjective` | — | нэр томьёо | な形容詞 → на-тэмдэг нэр | на-тэмдэг нэр | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | Нэртэй хэлбэрээр ашиглагддаг тэмдэг нэр; өнгөрсөн цаг нь -だった. |
| `adjective` | — | нэр томьёо | 形容詞 → Тэмдэг нэр | Тэмдэг нэр | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | и/на-г нийтэд нь заахдаа ашигладаг ерөнхий нэр. |
| `adverb` | — | нэр томьёо | 副詞 → Дайвар үг | Дайвар үг | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | үйл үг, тэмдэг нэрийг тодорхойлогч дайвар үг. |
| `counter` | — | нэр томьёо | 助数詞 → Тоолуур | Тоолуур | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | Тоог илэрхийлэхэд нэр үгтэй хамтрагдах тоолуур үг. |
| `measure word` | — | нэр томьёо | 助数詞 → Тоолуур | Тоолуур | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | counter-ийн синоним — нэг л ойлголт, ижил монгол нэр ашиглана. |
| `pronoun` | — | нэр томьёо | 代名詞 → Төлөөний үг | Төлөөний үг | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | Нэр, зүйлийг орлон заадаг үг. |
| `expression` | — | нэр томьёо | 表現 → Хэллэг | Хэллэг | scripts/build-data.mjs#TYPE_MN (төслийн стандарт шошго) | draft | Бэлэн байдлаар ашиглагдах хэлцийн нэгж. |
| `sentence` | — | нэр томьёо | 文 → Өгүүлбэр | Өгүүлбэр | контент дэх давтамж (public/data/grammar, content/mn) | draft | Дуусах тэмдэг (。) -тэй нэг бүтэн санаа. |
| `topic` | — | нэр томьёо | 主題 → Сэдэв | Сэдэв | контент дэх давтамж (public/data/grammar) | draft | Өгүүлбэрийн ярианы сэдэв — は-аар заагдана. |
| `subject` | — | нэр томьёо | 主語 → Өргөл | Өргөл | контент дэх давтамж (public/data/grammar) | draft | Үйлдэл гүйцэтгэгчийг заах гишүүн — ихэвчлэн が-аар илэрхийлэнэ. |
| `object` | — | нэр томьёо | 目的語 → Хэргэм | Хэргэм | proposal — монгол хэлний өгүүлбэрийн гишүүний нэр (хэргэм); контентод одоо хэрэглээгүй | needs_review **[revise]** Freebuff AI reviewer | Үйлдэл чиглэх зүйл — ихэвчлэн を-аар заагдана. |
| `predicate` | — | нэр томьёо | 述語 → Тэмдэглэгээ | Тэмдэглэгээ | контент дэх давтамж (public/data/grammar: 1 удаа) | needs_review **[revise]** Freebuff AI reviewer | Өргөлийн талаар юу хэлж байгааг илэрхийлэх гишүүн. |
| `adverbial` | — | нэр томьёо | 状語 → Өгүүлбэрт | Өгүүлбэрт | контент дэх давтамж (public/data/grammar: 1 удаа) | needs_review **[revise]** Freebuff AI reviewer | Цаг, газар, хэмжээг тодорхойлогч гишүүн. |
| `particle` | — | нэр томьёо | 助詞 → Тусаглал | Тусаглал | proposal — контентод тогтмол монгол хэрэглээ байхгүй (тусаглал=0, хэллиг=0); хүн шийднэ | needs_review **[revise]** Freebuff AI reviewer | Нэр үгтэй хамтран үүргээ илэрхийлдэг тусгай үг (は, が, を, に ...) — өгүүлбэрийн харилцааг заана. |
| `topic marker` | — | нэр томьёо | 主題の助詞 → Сэдвийн тусаглал | Сэдвийн тусаглал | proposal — particle-тэй адил контентод тогтмол хэрэглээгүй | needs_review **[verify]** Freebuff AI reviewer | Сэдвийг заагч тусаглал — は. |
| `conjugation` | — | нэр томьёо | 活用 → Хувирал | Хувирал | контент дэх давтамж (public/data: 1 удаа) | needs_review **[verify]** Freebuff AI reviewer | Үйл үг/тэмдэг нэрийн төгсгөл өөрчлөгдөх дүрэм. |
| `plain form` | — | нэр томьёо | 普通形 → Энгийн хэлбэр | Энгийн хэлбэр | контент дэх давтамж (public/data: 3 удаа) | draft | Ярианы болон дотно ярианд ашигладаг үндсэн хэлбэр. |
| `polite form` | — | нэр томьёо | 丁寧語 → Хүндэтгэсэн хэлбэр | Хүндэтгэсэн хэлбэр | proposal — контентод 2 өөр хувилбар (хүндэтгэсэн=3, дэгжин=6); хүн нэгийг сонгоно | needs_review **[revise]** Freebuff AI reviewer | です/ます ашигласан албаны ярианы хэлбэр. |
| `honorific` | — | нэр томьёо | 敬語 → Хүндэтгэх үг | Хүндэтгэх үг | proposal — контентод тогтмол хэрэглээгүй; хүн шийднэ | needs_review **[revise]** Freebuff AI reviewer | Бусдыг хүндэтгэхдээ ашигладаг хэлний хэлбэр. |
| `humble` | — | нэр томьёо | 謙譲語 → Ишгэл үг | Ишгэл үг | proposal — контентод хэрэглээгүй (ишгэл=0); хүн шийднэ | needs_review **[revise]** Freebuff AI reviewer | Өөрийн байгууллага/үйлдлийг доод түвшинд тавих хэлбэр. |
| `negative` | — | нэр томьёо | 否定 → Үгүйсгэл | Үгүйсгэл | контент дэх давтамж (public/data: 3 удаа) | draft | Үгүйсгэх хэлбэр — ない/ません. |
| `past tense` | — | нэр томьёо | 過去 → Өнгөрсөн цаг | Өнгөрсөн цаг | контент дэх давтамж (public/data: 4 удаа) | draft | Өнгөрсөн үеийг илэрхийлэх цагийн хэлбэр. |
| `conditional` | — | нэр томьёо | 条件 → Нөхцөл | Нөхцөл | контент дэх давтамж (public/data: 37 удаа) | draft | Хэрэв... бол гэдэг харилцаа илэрхийлэх хэлбэр. |
| `passive` | — | нэр томьёо | 受身形 → Хүлээн авагч хэлбэр | Хүлээн авагч хэлбэр | proposal — контентод хэрэглээгүй; хүн шийднэ | needs_review **[revise]** Freebuff AI reviewer | Үйлдэл хүлээн авагч талдаа чиглэх хэлбэр (られる). |
| `causative` | — | нэр томьёо | 使役 → Үйлдүүлэх хэлбэр | Үйлдүүлэх хэлбэр | proposal — контентод хэрэглээгүй; хүн шийднэ | needs_review **[verify]** Freebuff AI reviewer | Бусдыг ямар нэг зүйл хийхэд хүргэх хэлбэр (させる). |
| `potential` | — | нэр томьёо | 可能形 → Боломжийн хэлбэр | Боломжийн хэлбэр | proposal — контентод хэрэглээгүй; хүн шийднэ | needs_review **[verify]** Freebuff AI reviewer | Чадах/боломжтой гэдгийг илэрхийлэх хэлбэр. |
| `te-form` | — | нэр томьёо | て形 → Тэ-хэлбэр | Тэ-хэлбэр | proposal — контентод хэрэглээгүй; хүн шийднэ | needs_review **[verify]** Freebuff AI reviewer | Үйл үгийн холбогч хэлбэр — хүсэл, зэрэгцээ, аргыг илэрхийлнэ. |
| `vowel` | — | нэр томьёо | 母音 → Эгшэг | Эгшэг | контент дэх давтамж (kana/контент: эгш=24) | draft **[revise]** Freebuff AI reviewer | Канагийн 5 эгшэг: あいうえお — бүх дууны үндэс. |
| `consonant` | — | нэр томьёо | 子音 → Тусламж дуудлага | Тусламж дуудлага | proposal — контентод энэ утгыг термин маягаар баталгаажуулаагүй; хүн шийднэ | needs_review **[revise]** Freebuff AI reviewer | Эгшэггүй дуу — ханагийн дүрсний дууны тал. |
| `reading` | — | нэр томьёо | 読み → Уншлага | Уншлага | контент дэх давтамж (public/data: 5+ удаа) | draft | Ханз/бичвэрийг дуугаар хэлэх хэлбэр (он/кун). |
| `kanji` | — | нэр томьёо | 漢字 → Ханз | Ханз | контент дэх давтамж (public/data: 5+ удаа) | draft | Утга бүхий япон бичвэр — уншлага нь нөхцөлөөс хамаарна. |
| `hiragana` | — | нэр томьёо | ひらがな → Хирагана | Хирагана | контент дэх давтамж (kana: 2) | draft | Японы үндсэн бичвэр — дүрэм, үгийн хэсэгт хэрэглэгдэнэ. |
| `katakana` | — | нэр томьёо | カタカна → Катакана | Катакана | контент дэх давтамж (kana: 2) | draft | Гадаад үг, дууны тэмдэглэлд хэрэглэгддэг бичвэр. |
| `pronunciation` | — | нэр томьёо | 発音 → Дуудлага | Дуудлага | контент дэх давтамж (public/data: 13 удаа) | draft | Үгийг дуугаар хэлэх арга — ханз бүр өөрийн дуутай. |
| `spelling` | — | нэр томьёо | 表記 → Бичлэг | Бичлэг | контент дэх давтамж (public/data: 10 удаа) | draft | Япон үгийг ямар бичвэрээр бичсэн бэ. |
| `grammar` | — | нэр томьёо | 文法 → Дүрэм | Дүрэм | контент дэх давтамж (public/data: 35 удаа) | draft | Өгүүлбэр бүтээх дүрэм, хэлбэр, харилцаа. |
| `usage` | — | нэр томьёо | 用法 → Хэрэглээ | Хэрэглээ | контент дэх давтамж (public/data: 18 удаа) | draft | Ямар нөхцөлд, яаж ашиглах талаарх заавар. |
| `meaning` | — | нэр томьёо | 意味 → Утга | Утга | контент дэх давтамж (public/data: 61 удаа) | draft | Үг/өгүүлбэрийн утга. |
| `reason` | — | нэр томьёо | 理由 → Шалтгаан | Шалтгаан | контент дэх давтамж (public/data: 31 удаа) | draft | Яагаад гэдэг хариулт — から/ので-оор илэрхийлнэ. |
| `question` | — | нэр томьёо | 疑問 → Асуулт | Асуулт | контент дэх давтамж (public/data: 30 удаа) | draft | Асуулт өгүүлбэр — か/の/？-аар тэмдэглэнэ. |
| `only` | — | нэр томьёо | だけ → Зөвхөн | Зөвхөн | контент дэх давтамж (public/data: 55 удаа) | draft | Хязгаарлалт илэрхийлэх хэлцэл. |
| `while` | — | нэр томьёо | 間 → Зав | Зав | контент дэх давтамж (public/data: 56 удаа) | draft | Нэг үйл явагдахын зэрэгцээ нөгөө нь явагдах — ながら/間に. |
| `before` | — | нэр томьёо | 前に → -ын өмнө | -ын өмнө | контент дэх давтамж (public/data: 11 удаа) | draft | Нэг үйлээс өмнө нөгөө нь хийгдэнэ. |
| `after` | — | нэр томьёо | 後で → -ын дараа | -ын дараа | контент дэх давтамж (public/data: 130 удаа) | draft | Нэг үйл дууссаны дараа нөгөө нь хийгдэнэ. |
| `try` | — | нэр томьёо | てみる → -аж үзэх | -аж үзэх | proposal — контентод “-аж үзэх” бэлэн хэлбэрээр байхгүй; хүн шийднэ | needs_review **[verify]** Freebuff AI reviewer | Туршиж үзэх утгыг илэрхийлэх хэлбэр. |

## Vocab — хүн хянаагүй (доорх 50 нь жишээ)

| Ключ | Түвшин | Төрөл | Япон | Монгол | Эх сурвалж | Төлөв | Тайлбар |
|---|---|---|---|---|---|---|---|
| `会う\|あう` | N5 | үг | 会う（あう） | уулзах | openjlpt#ada066edfd | draft | to meet |
| `青\|あお` | N5 | үг | 青（あお） | цэнхэр | openjlpt#ebec658463 | draft | blue |
| `青い\|あおい` | N5 | үг | 青い（あおい） | цэнхэр | openjlpt#51a671ec17 | draft | blue |
| `赤\|あか` | N5 | үг | 赤（あか） | улаан | openjlpt#2dacb910b2 | draft | red |
| `赤い\|あかい` | N5 | үг | 赤い（あかい） | улаан | openjlpt#44ba38cf8b | draft | red |
| `明るい\|あかるい` | N5 | үг | 明るい（あかるい） | гэрэлтэй, тодорхой | openjlpt#91987ae840 | draft | bright |
| `秋\|あき` | N5 | үг | 秋（あき） | намар | openjlpt#8dc7006bda | draft | autumn |
| `開く\|あく` | N5 | үг | 開く（あく） | нээгдэх | openjlpt#fc3bc1e6f1 | draft | to open; to become open |
| `開ける\|あける` | N5 | үг | 開ける（あける） | нээх | openjlpt#321963ed35 | draft | to open |
| `上げる\|あげる` | N5 | үг | 上げる（あげる） | өгөх (хүндэтгэлтэй), өргөх | openjlpt#9661cbac61 | draft | to give |
| `朝\|あさ` | N5 | үг | 朝（あさ） | өглөө | openjlpt#d46ae79a26 | draft | morning |
| `朝ごはん\|あさごはん` | N5 | үг | 朝ごはん（あさごはん） | өглөөний хоол | openjlpt#98bc6f72ae | draft | breakfast |
| `あさって\|あさって` | N5 | үг | あさって（あさって） | нөгөөдөр | openjlpt#b3b4041c52 | draft | day after tomorrow |
| `足\|あし` | N5 | үг | 足（あし） | хөл | openjlpt#27df3d5802 | draft | foot; leg |
| `明日\|あした` | N5 | үг | 明日（あした） | маргааш | openjlpt#115ec83476 | draft | tomorrow |
| `あそこ\|あそこ` | N5 | үг | あそこ（あそこ） | тэнд | openjlpt#bee501faf0 | draft | over there |
| `遊ぶ\|あそぶ` | N5 | үг | 遊ぶ（あそぶ） | тоглох, зугаалах | openjlpt#2d55571300 | draft | to play; to make a visit |
| `暖かい\|あたたかい` | N5 | үг | 暖かい（あたたかい） | дулаан | openjlpt#f665c2128a | draft | warm |
| `頭\|あたま` | N5 | үг | 頭（あたま） | толгой | openjlpt#b62cb9ce4c | draft | head |
| `新しい\|あたらしい` | N5 | үг | 新しい（あたらしい） | шинэ | openjlpt#8ae27e3b51 | draft | new |
| `あちら\|あちら` | N5 | үг | あちら（あちら） | тэнд (хүндэтгэлтэй) | openjlpt#34e6f7d220 | draft | there |
| `厚い\|あつい` | N5 | үг | 厚い（あつい） | зузаан | openjlpt#9949d87445 | draft | kind; deep; thick |
| `暑い\|あつい` | N5 | үг | 暑い（あつい） | халуун (агаар, цаг агаар) | openjlpt#7b4aecdf7b | draft | hot |
| `熱い\|あつい` | N5 | үг | 熱い（あつい） | халуун (хүрэхэд) | openjlpt#a379d413fd | draft | hot to the touch |
| `あっち\|あっち` | N5 | үг | あっち（あっち） | тэнд (зөөлөн) | openjlpt#60dd63379e | draft | over there |
| `後\|あと` | N5 | үг | 後（あと） | дараа, хойно | openjlpt#4f134c9b38 | draft | afterwards |
| `あなた\|あなた` | N5 | үг | あなた（あなた） | чи, та | openjlpt#afdf384f68 | draft | you |
| `兄\|あに` | N5 | үг | 兄（あに） | ах (бусдынх) | openjlpt#4aab699864 | draft | (humble) older brother |
| `姉\|あね` | N5 | үг | 姉（あね） | эгч (бусдынх) | openjlpt#8bfeb208b4 | draft | (humble) older sister |
| `あの\|あの` | N5 | үг | あの（あの） | тэр (холын) | openjlpt#ac4706068b | draft | that over there |
| `アパート\|アパート` | N5 | үг | アパート（アパート） | орон сууц | openjlpt#0cf05b3a0d | draft | apartment |
| `あびる\|あびる` | N5 | үг | あびる（あびる） | шүршүүрт орох, угаах | openjlpt#a5aceb6426 | draft | to bathe; to shower |
| `危ない\|あぶない` | N5 | үг | 危ない（あぶない） | аюултай | openjlpt#0509cb3b27 | draft | dangerous |
| `甘い\|あまい` | N5 | үг | 甘い（あまい） | амттай, чихэрлэг | openjlpt#4afffe5811 | draft | sweet |
| `あまり\|あまり` | N5 | үг | あまり（あまり） | тийм ч их биш | openjlpt#eac90e8e98 | draft | not very |
| `飴\|あめ` | N5 | үг | 飴（あめ） | карамель, чихэр | openjlpt#5d72771a3c | draft | candy |
| `雨\|あめ` | N5 | үг | 雨（あめ） | бороо | openjlpt#277a58c9df | draft | rain |
| `洗う\|あらう` | N5 | үг | 洗う（あらう） | угаах | openjlpt#f8fa96946f | draft | to wash |
| `ありがとう\|ありがとう` | N5 | үг | ありがとう（ありがとう） | баярлалаа | openjlpt#93461820fe | draft | Thank you |
| `ある\|ある` | N5 | үг | ある（ある） | байх, байгаа (эд зүйлд) | openjlpt#ac08788418 | draft | to be; to have (used for inanimate objects) |
| `歩く\|あるく` | N5 | үг | 歩く（あるく） | алхах | openjlpt#55f3080ce4 | draft | to walk |
| `あれ\|あれ` | N5 | үг | あれ（あれ） | тэр (өндөр) | openjlpt#d727a76b22 | draft | that |
| `いい\|いい` | N5 | үг | いい（いい） | сайн, гайхалтай | openjlpt#e37a087c0f | draft | good |
| `いいえ\|いいえ` | N5 | үг | いいえ（いいえ） | үгүй | openjlpt#6d4596ae46 | draft | no |
| `言う\|いう` | N5 | үг | 言う（いう） | хэлэх | openjlpt#ae0cc00f94 | draft | to say |
| `家\|いえ` | N5 | үг | 家（いえ） | гэр, байшин | openjlpt#9f074820b1 | draft | house |
| `いかが\|いかが` | N5 | үг | いかが（いかが） | ямар, яаж (хүндэтгэлтэй) | openjlpt#a3f296ad9a | draft | how |
| `行く\|いく` | N5 | үг | 行く（いく） | явах | openjlpt#66e4692df7 | draft | to go |
| `いくつ\|いくつ` | N5 | үг | いくつ（いくつ） | хэдэн, хэдтэй | openjlpt#026ae57b50 | draft | how many?; how old? |
| `いくら\|いくら` | N5 | үг | いくら（いくら） | хэд (үнэ) | openjlpt#4fc98c6938 | draft | how much? |

## Kanji — хүн хянаагүй (доорх 50 нь жишээ)

| Ключ | Түвшин | Төрөл | Япон | Монгол | Эх сурвалж | Төлөв | Тайлбар |
|---|---|---|---|---|---|---|---|
| `日` | N5 | ханз | 日（にち/じつ · ひ/-び/-か） | өдөр, нар, Япон | openjlpt+kanji-data#日 | draft | Day; Sun; Japan |
| `一` | N5 | ханз | 一（いち/いつ · ひと-/ひと.つ） | нэг | openjlpt+kanji-data#一 | draft | One; One Radical (no.1) |
| `国` | N5 | ханз | 国（こく · くに） | улс, орон | openjlpt+kanji-data#国 | draft | Country |
| `人` | N5 | ханз | 人（じん/にん · ひと/-り/-と） | хүн | openjlpt+kanji-data#人 | draft | Person |
| `年` | N5 | ханз | 年（ねん · とし） | жил | openjlpt+kanji-data#年 | draft | Year; Counter For Years |
| `大` | N5 | ханз | 大（だい/たい · おお-/おお.きい/-おお.いに） | том | openjlpt+kanji-data#大 | draft | Large; Big |
| `十` | N5 | ханз | 十（じゅう/じっ/じゅっ · とお/と） | арван | openjlpt+kanji-data#十 | draft | Ten |
| `二` | N5 | ханз | 二（に/じ · ふた/ふた.つ/ふたたび） | хоёр | openjlpt+kanji-data#二 | draft | Two; Two Radical (no. 7) |
| `本` | N5 | ханз | 本（ほん · もと） | ном, суурь | openjlpt+kanji-data#本 | draft | Book; Present; Main |
| `中` | N5 | ханз | 中（ちゅう · なか/うち/あた.る） | дунд, дотор | openjlpt+kanji-data#中 | draft | In; Inside; Middle |
| `長` | N5 | ханз | 長（ちょう · なが.い/おさ） | урт, дарга | openjlpt+kanji-data#長 | draft | Long; Leader; Superior |
| `出` | N5 | ханз | 出（しゅつ/すい · で.る/-で/だ.す/-だ.す） | гарах | openjlpt+kanji-data#出 | draft | Exit; Leave; Go Out |
| `三` | N5 | ханз | 三（さん/ぞう · み/み.つ/みっ.つ） | гурав | openjlpt+kanji-data#三 | draft | Three |
| `時` | N5 | ханз | 時（じ · とき/-どき） | цаг | openjlpt+kanji-data#時 | draft | Time; Hour |
| `行` | N5 | ханз | 行（こう/ぎょう/あん · い.く/ゆ.く/-ゆ.き/-ゆき） | явах | openjlpt+kanji-data#行 | draft | Going; Journey; Carry Out |
| `見` | N5 | ханз | 見（けん · み.る/み.える/み.せる） | харах | openjlpt+kanji-data#見 | draft | See; Hopes; Chances |
| `月` | N5 | ханз | 月（げつ/がつ · つき） | сар | openjlpt+kanji-data#月 | draft | Month; Moon |
| `分` | N5 | ханз | 分（ぶん/ふん/ぶ · わ.ける/わ.け/わ.かれる/わ.かる） | хуваах, минут | openjlpt+kanji-data#分 | draft | Part; Minute Of Time; Segment |
| `後` | N5 | ханз | 後（ご/こう · のち/うし.ろ/うしろ/あと） | дараа, ар | openjlpt+kanji-data#後 | draft | Behind; Back; Later |
| `前` | N5 | ханз | 前（ぜん · まえ/-まえ） | өмнө | openjlpt+kanji-data#前 | draft | In Front; Before |
| `生` | N5 | ханз | 生（せい/しょう · い.きる/い.かす/い.ける/う.まれる） | амьдрах, төрөх | openjlpt+kanji-data#生 | draft | Life; Genuine; Birth |
| `五` | N5 | ханз | 五（ご · いつ/いつ.つ） | тав | openjlpt+kanji-data#五 | draft | Five |
| `間` | N5 | ханз | 間（かん/けん · あいだ/ま/あい） | завсар, хооронд | openjlpt+kanji-data#間 | draft | Interval; Space |
| `上` | N5 | ханз | 上（じょう/しょう/しゃん · うえ/-うえ/うわ-/かみ） | дээд | openjlpt+kanji-data#上 | draft | Above; Up |
| `東` | N5 | ханз | 東（とう · ひがし） | зүүн | openjlpt+kanji-data#東 | draft | East |
| `四` | N5 | ханз | 四（し · よ/よ.つ/よっ.つ/よん） | дөрөв | openjlpt+kanji-data#四 | draft | Four |
| `今` | N5 | ханз | 今（こん/きん · いま） | одоо | openjlpt+kanji-data#今 | draft | Now |
| `金` | N5 | ханз | 金（きん/こん/ごん · かね/かな-/-がね） | алт, мөнгө | openjlpt+kanji-data#金 | draft | Gold |
| `九` | N5 | ханз | 九（きゅう/く · ここの/ここの.つ） | ес | openjlpt+kanji-data#九 | draft | Nine |
| `入` | N5 | ханз | 入（にゅう/じゅ · い.る/-い.る/-い.り/い.れる） | орох | openjlpt+kanji-data#入 | draft | Enter; Insert |
| `学` | N5 | ханз | 学（がく · まな.ぶ） | сурах, шинжлэх ухаан | openjlpt+kanji-data#学 | draft | Study; Learning; Science |
| `高` | N5 | ханз | 高（こう · たか.い/たか/-だか/たか.まる） | өндөр, үнэтэй | openjlpt+kanji-data#高 | draft | Tall; High; Expensive |
| `円` | N5 | ханз | 円（えん · まる.い/まる/まど/まど.か） | дугуй, иен | openjlpt+kanji-data#円 | draft | Circle; Yen; Round |
| `子` | N5 | ханз | 子（し/す/つ · こ/-こ/ね） | хүүхэд | openjlpt+kanji-data#子 | draft | Child; Sign Of The Rat; 11pm-1am |
| `外` | N5 | ханз | 外（がい/げ · そと/ほか/はず.す/はず.れる） | гадна | openjlpt+kanji-data#外 | draft | Outside |
| `八` | N5 | ханз | 八（はち · や/や.つ/やっ.つ/よう） | найм | openjlpt+kanji-data#八 | draft | Eight; Eight Radical (no. 12) |
| `六` | N5 | ханз | 六（ろく/りく · む/む.つ/むっ.つ/むい） | зургаа | openjlpt+kanji-data#六 | draft | Six |
| `下` | N5 | ханз | 下（か/げ · した/しも/もと/さ.げる） | доод | openjlpt+kanji-data#下 | draft | Below; Down; Descend |
| `来` | N5 | ханз | 来（らい/たい · く.る/きた.る/きた.す/き.たす） | ирэх | openjlpt+kanji-data#来 | draft | Come; Due; Next |
| `気` | N5 | ханз | 気（き/け · いき） | сэтгэл, агаар | openjlpt+kanji-data#気 | draft | Spirit; Mind; Air |
| `小` | N5 | ханз | 小（しょう · ちい.さい/こ-/お-/さ-） | жижиг | openjlpt+kanji-data#小 | draft | Little; Small |
| `七` | N5 | ханз | 七（しち · なな/なな.つ/なの） | долоо | openjlpt+kanji-data#七 | draft | Seven |
| `山` | N5 | ханз | 山（さん/せん · やま） | уул | openjlpt+kanji-data#山 | draft | Mountain |
| `話` | N5 | ханз | 話（わ · はな.す/はなし） | яриа | openjlpt+kanji-data#話 | draft | Tale; Talk |
| `女` | N5 | ханз | 女（じょ/にょ/にょう · おんな/め） | эмэгтэй | openjlpt+kanji-data#女 | draft | Woman; Female |
| `北` | N5 | ханз | 北（ほく · きた） | хойд | openjlpt+kanji-data#北 | draft | North |
| `午` | N5 | ханз | 午（ご · うま） | үд | openjlpt+kanji-data#午 | draft | Noon; Sign Of The Horse; 11am-1pm |
| `百` | N5 | ханз | 百（ひゃく/びゃく · もも） | зуун | openjlpt+kanji-data#百 | draft | Hundred |
| `書` | N5 | ханз | 書（しょ · か.く/-が.き/-がき） | бичих | openjlpt+kanji-data#書 | draft | Write |
| `先` | N5 | ханз | 先（せん · さき/ま.ず） | өмнө, урьд | openjlpt+kanji-data#先 | draft | Before; Ahead; Previous |

## Бүртгэгдсэн шийдвэрүүд

| Ключ | Үйлдэл | Reviewer | Огноо | Тэмдэглэл |
|---|---|---|---|---|
| `terms:adverbial` | revise | Freebuff AI reviewer | 2026-10-29 | «Өгүүлбэрт» гэдэг нь монгол хэлний нэр биш (adverb/adverbial-ийг машин буулгасан артефакт). Цаг, газар, хэмжээг заасан гишүүнийг «байц» гэнэ. Санал: Байц. |
| `terms:causative` | verify | Freebuff AI reviewer | 2026-10-29 | «Үйлдүүлэх хэлбэр» = 使役; монгол «үйлдүүлэхүүн хэв»-тэй нийцнэ (хэлбэр/хэв гэсэн стилийн ялгаа л бий). 例 食べさせる зөв. |
| `terms:conjugation` | verify | Freebuff AI reviewer | 2026-10-29 | «Хувирал» = 活用; монгол хэл шинжлэлийн «үйл үгийн хувирал» гэсэн тогтсон нэртэй нийцнэ. 例 書く→書いて→書いた зөв. |
| `terms:consonant` | revise | Freebuff AI reviewer | 2026-10-29 | «Тусламж дуудлага» нь 子音-ийн утга биш. Монгол хэл шинжлэлд 子音 = гийгүүлэгч, 母音 = эгшиг. Санал: Гийгүүлэгч. |
| `terms:honorific` | revise | Freebuff AI reviewer | 2026-10-29 | 敬語 нь хүндэтгэл (尊敬語), даруу (謙譲語), эелдэг (丁寧語) гурвыг хамарсан систем; «Хүндэтгэх үг» хэт явцуу. Санал: Хүндэтгэлийн хэл (сонкэйго). |
| `terms:humble` | revise | Freebuff AI reviewer | 2026-10-29 | «Ишгэл үг» нь монгол хэл шинжлэлийн нэр биш, контентод ч хэрэглээ 0. 謙譲語 = өөрийн үйлдлийг дорд үзэх хэлбэр. Санал: Даруу хэлбэр (кэнжёго). |
| `terms:object` | revise | Freebuff AI reviewer | 2026-10-29 | «Хэргэм» нь орчин үеийн монгол хэлэнд «зэрэг/цол» гэсэн утгатай болсон тул 目的語-г заахад ойлгомжгүй. Монгол хэл шинжлэлд өгүүлбэрийн объектыг «тусагдахуун» гэнэ. Санал: Тусагдахуун. |
| `terms:particle` | revise | Freebuff AI reviewer | 2026-10-29 | «Тусаглал» нь тогтсон монгол хэл шинжлэлийн нэр биш; «туслах үг» нь 助動詞-той андуурна. Одоогийн контентод хэрэглээ 0 тул нэрийг одоо тодорхойлох нь зүйтэй. Санал: Тусаглал (постпозитив). |
| `terms:passive` | revise | Freebuff AI reviewer | 2026-10-29 | «Хүлээн авагч хэлбэр» нь 受身-г буруу тайлбарлана. Монгол хэвний систем: үйлдэхүүн / үйлдэгдэхүүн / үйлдүүлэхүүн. Санал: Үйлдэгдэхүүн хэв. |
| `terms:polite form` | revise | Freebuff AI reviewer | 2026-10-29 | 丁寧語 нь です/ます-ийн эелдэг хэв; «хүндэтгэсэн» гэвэл 尊敬語 (сонкэйго)-той андуурна. Контентод «дэгжин» 6, «хүндэтгэсэн» 3 удаа — нэг нэрийг сонгох ёстой. Санал: Эелдэг хэлбэр (дэгжин хэв). |
| `terms:potential` | verify | Freebuff AI reviewer | 2026-10-29 | «Боломжийн хэлбэр» = 可能形; утга зөв, 例 食べられる/食べれる хоёулаа (ярианы) зөв. |
| `terms:predicate` | revise | Freebuff AI reviewer | 2026-10-29 | «Тэмдэглэгээ» нь 述語-ийн утга биш (predicate ≠ marking). 例 私は学生です。 — өгүүлэхүүн нь «学生です». Санал: Өгүүлэхүүн. |
| `terms:te-form` | verify | Freebuff AI reviewer | 2026-10-29 | て形 → «Тэ-хэлбэр» — япон нэрийг шууд буулгасан, суралцагчид ойлгомжтой; 例 食べて・書いて зөв. |
| `terms:topic marker` | verify | Freebuff AI reviewer | 2026-10-29 | «Сэдвийн тусаглал» нь は-ийн үүргийг зөв тодорхойлсон; 例 今日は寒いです。 тохирно. particle-ийн эцсийн нэрээс хамаарна. |
| `terms:try` | verify | Freebuff AI reviewer | 2026-10-29 | 〜てみる = «-аж үзэх» — утга зөв (туршин хийх). Контентод ашиглагдаагүй ч нэр томьёо хүчинтэй. |
| `terms:vowel` | revise | Freebuff AI reviewer | 2026-10-29 | «Эгшэг» нь «эгшиг»-ийн алдаатай бичиг (тэмдэглэлд ч «5 эгшэг» гэж бичсэн). 母音 = эгшиг. Энэ бичлэг draft байсан ч алдаа нь тодорхой. Санал: Эгшиг. |
| `vocab:ぞんざい|ぞんざい` | verify | Freebuff AI reviewer | 2026-10-29 | кана уншлага зөв (канжигүй үг); mn «хайхрамжгүй» = rough/careless; 例 ぞんざいな扱い → «огцом харьцсан» нийцнэ. |
| `vocab:ひたすら|ひたすら` | revise | Freebuff AI reviewer | 2026-10-29 | mn «чин сэтгэлээсээ» нь «нэг л зүйлд автах» утгыг алдана; мөн ex[0] (「一向に構いません」) нь ひたすら-г агуулаагүй — жишээ буруу холбогдсон. |
| `vocab:わざわざ|わざわざ` | revise | Freebuff AI reviewer | 2026-10-29 | mn нь MT-ийн буруу холимог («санамсаргүй гэхээсээ илүүтэйгээр…»). わざわざ = зориуд хийх; ex[0].mn («бүү зов») ч буруу. |
| `vocab:中断|ちゅうだん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «тасалдал; түдгэлзүүлэх; завсарлага» = interruption; 例 休暇が中断 → «амралт тасарсан» нийцнэ. |
| `vocab:交渉|こうしょう` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хэлэлцээр» = negotiations; 例 労働組合は経営陣と交渉 → зөв. |
| `vocab:依然|いぜん` | revise | Freebuff AI reviewer | 2026-10-29 | «хэвийн» нь 依然 биш (依然 = 相変わらず, still/as yet); ex[0] «Одоог хүртэл…» зөв тул mn-ийг түүнд нийцүүлнэ. |
| `vocab:促す|うながす` | revise | Freebuff AI reviewer | 2026-10-29 | «түлхэх» хэт явцуу; 促す = urge/promote (жишээ: 眠りを促す = унтахад хүргэх). |
| `vocab:促進|そくしん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хурдасгах» = promotion/acceleration; 例 平和を促進 → «энх тайвныг дэмжих» нийцнэ. |
| `vocab:保障|ほしょう` | revise | Freebuff AI reviewer | 2026-10-29 | mn давхардсан; мөн 保障 (нийгмийн баталгаа) ба 保証 (батлан даалт) хоёрыг ялгах ёстой. |
| `vocab:優先|ゆうせん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «давуу эрх; тэргүүлэх ач холбогдол» = priority; 例 すべての任務に優先する → зөв. |
| `vocab:円滑|えんかつ` | revise | Freebuff AI reviewer | 2026-10-29 | «найрсаг» нь 円滑-ийн утга биш; 円滑 = smooth (ажил явц саадгүй). |
| `vocab:切ない|せつない` | revise | Freebuff AI reviewer | 2026-10-29 | «гуниг, зовлонтой» нь нэр/тэмдэг нэрийн холимог; 切ない = сэтгэл хөндөм (sentimental). |
| `vocab:削減|さくげん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «бууруулах» = cut/reduction; 例 支出を削減 → «зардлаа багасгасан» зөв. |
| `vocab:加入|かにゅう` | revise | Freebuff AI reviewer | 2026-10-29 | Үгийн утга зөв боловч ex[0].mn буруу: 「まさかの時のために…保険に加入した» = «гэнэтийн тохиолдлоос сэргийлж даатгалд орсон» — «бороотой өдөр» биш. |
| `vocab:動機|どうき` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «сэдэл; урамшуулал» = motive/incentive; 例 動機が信用できない → зөв. |
| `vocab:厳しさ|きびしさ` | revise | Freebuff AI reviewer | 2026-10-29 | «хүндийн зэрэг» нь 厳しさ биш — en «severity»-г «зэрэг» гэж буруу буулгасан. |
| `vocab:多様|たよう` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «олон янз» = diverse; 例 多様なテーマ → «янз бүрийн сэдэв» зөв. |
| `vocab:妨げ|さまたげ` | revise | Freebuff AI reviewer | 2026-10-29 | mn давхардсан («саад тотгор» хоёр удаа); утга зөв, цэвэрлэх шаардлагатай. |
| `vocab:対応|たいおう` | revise | Freebuff AI reviewer | 2026-10-29 | Одоогийн mn 3 утгын (interaction/correspondence/coping) зөвхөн нэгийг заана; ex[0] нь «対応する» = «дүйцэх» утга. |
| `vocab:導入|どうにゅう` | revise | Freebuff AI reviewer | 2026-10-29 | «тэргүүлэх» нь 導入 биш — en «leading in»-ийг шууд буулгасан MT алдаа. |
| `vocab:尚更|なおさら` | revise | Freebuff AI reviewer | 2026-10-29 | «арай бага» нь эсрэг утга — MT алдаа; なおさら = all the more. |
| `vocab:応募|おうぼ` | revise | Freebuff AI reviewer | 2026-10-29 | «анкет» нь 応募 биш; 応募 = ажил/сургалтад өргөдөл гаргах; ex[0] зөв. |
| `vocab:把握|はあく` | revise | Freebuff AI reviewer | 2026-10-29 | mn-д «барих» хоёр удаа давхардсан; 把握 = grasp (ойлгох). |
| `vocab:指示|しじ` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «заавар» = instruction; 例 гурван хүн ирэхийг надад даалгасан гэсэн утга зөв. |
| `vocab:措置|そち` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «арга хэмжээ» = measure/step; 例 必要な措置を取る → зөв. |
| `vocab:提唱|ていしょう` | revise | Freebuff AI reviewer | 2026-10-29 | «сурталчилгаа» нь 提唱-ийн утга биш; 提唱 = advocate (санаа дэвшүүлэх). |
| `vocab:損なう|そこなう` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «гэмтээх, доройтуулах» = harm/hurt; 例 返事を出し損なった → «чадсангүй» (хоёр дахь утга) зөв. |
| `vocab:明朗|めいろう` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «тод; хөгжилтэй» = bright/cheerful; 例 хөгжилтэй залуу → зөв. |
| `vocab:本格|ほんかく` | revise | Freebuff AI reviewer | 2026-10-29 | «зохистой байдал; үндсэн дүрэм» нь 本格-ийн утга биш — en «propriety»-г шууд буулгасан MT алдаа. |
| `vocab:極端|きょくたん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хэт, туйлын» = extreme; 例 極端じゃないか → «хэтэрхий биш үү» зөв. |
| `vocab:活発|かっぱつ` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «идэвхтэй» = active/vigor; 例 活発な討論 → «идэвхтэй хэлэлцүүлэг» нийцнэ. |
| `vocab:減少|げんしょう` | revise | Freebuff AI reviewer | 2026-10-29 | ex[0].mn буруу: 「死亡により人口は減少しつつある» = «нас баралтаас хүн ам буурч байна», «хүн ам үхэж байна» биш. |
| `vocab:独自|どくじ` | revise | Freebuff AI reviewer | 2026-10-29 | «эх» нь 独自 биш; 独自 = original/peculiar (өөрийн онцлогтой). |
| `vocab:発生|はっせい` | revise | Freebuff AI reviewer | 2026-10-29 | «урагшлах» нь 発生 биш (MT алдаа); ex[0] нь «үүсдэг» гэсэн утгатай тул mn-ийг засна. |
| `vocab:眠たい|ねむたい` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «нойрмог» = sleepy; 例 眠気を催す → «нойрмог болгосон» нийцнэ. |
| `vocab:緩和|かんわ` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хөнгөрүүлэх» = relief/mitigation. Жишээний «тэнцвэр» (需給関係=эрэлт нийлүүлэлтийн харьцаа) ойролцоо — жишээг сайжруулахыг зөвлөнө. |
| `vocab:群集|ぐんしゅう` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «олон түмэн» = crowd; 例 群集が集まる → «цугларсан хүмүүс» зөв. |
| `vocab:補助|ほじょ` | revise | Freebuff AI reviewer | 2026-10-29 | mn-д «тусламж» давхардсан; 補助 = assistance/subsidy. |
| `vocab:覆す|くつがえす` | revise | Freebuff AI reviewer | 2026-10-29 | «эргүүлэх» биш; 覆す = overturn (шийдвэр, үзэл санаа). |
| `vocab:規制|きせい` | revise | Freebuff AI reviewer | 2026-10-29 | «хязгаарлалт» хэт явцуу; 規制 = regulation. ex[0] «замын хөдөлгөөний дүрэм» зөв. |
| `vocab:規模|きぼ` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хэмжээ» = scale/scope; 例 クラスの規模 → «ангийн хэмжээ» нийцнэ. |
| `vocab:視点|してん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «үзэл бодол, өнцөг» = point of view; 例 根拠のある視点 → нийцнэ. |
| `vocab:観点|かんてん` | revise | Freebuff AI reviewer | 2026-10-29 | mn ойролцоо зөв боловч ex[0].mn буруу: 「見るようになった» = «үзэх болсон», «харахаар ирсэн» биш. |
| `vocab:課題|かだい` | revise | Freebuff AI reviewer | 2026-10-29 | «сэдэв» нь 課題-ийн гол утга биш; ex[0] «гэрийн даалгавар» зөв тул mn-ийг тэр утгад нийцүүлнэ. |
| `vocab:負担|ふたん` | revise | Freebuff AI reviewer | 2026-10-29 | «цэнэглэх» нь 負担 биш — en «charge»-ийг шууд буулгасан MT алдаа. |
| `vocab:賃金|ちんぎん` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «цалин» = wages; 例 賃金を払う → зөв. |
| `vocab:込める|こめる` | revise | Freebuff AI reviewer | 2026-10-29 | «хийх» хэт ерөнхий тул утга ялгарахгүй; 込める = put into (сэтгэл, сум). |
| `vocab:迅速|じんそく` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хурдан» = quick/rapid; 例 迅速に対応 → «нэн даруй» нийцнэ. |
| `vocab:達成|たっせい` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «амжилт» = achievement; 例 目標を達成 → «зорилгодоо хүрсэн» зөв. |
| `vocab:遠ざかる|とおざかる` | verify | Freebuff AI reviewer | 2026-10-29 | уншлага зөв; mn «хол явах» = to move away; 例 岸から遠ざかる → зөв. |

## Дараагийн алхам

```bash
npm run review:mark -- terms particle --action=approve --reviewer="<нэр>"
git diff content/review/decisions.json content/mn/terms.json
npm run content:qa
```
