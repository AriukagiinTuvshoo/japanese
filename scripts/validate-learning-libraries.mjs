import assert from "node:assert/strict";
import fs from "node:fs";

const levels = ["N5", "N4", "N3", "N2", "N1"];
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const unannotatedKanji = (text) => text.replace(/\{[^|{}]+\|[^{}]+\}/g, "").match(/\p{Script=Han}/u);
const hasBrokenRuby = (text) => /[{}]/.test(text.replace(/\{[^|{}]+\|[^{}]+\}/g, ""));
const isKana = (text) => /^[\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u.test(text);

function checkQuestions(lesson, kind) {
  assert.equal(lesson.questions?.length, 1, `${kind}/${lesson.id}: expected one comprehension question`);
  const [q] = lesson.questions;
  assert.ok(q.q?.trim(), `${kind}/${lesson.id}: missing Japanese question`);
  const questionMn = q.mn ?? (kind === "reading" ? q.q : "");
  assert.ok(questionMn?.trim(), `${kind}/${lesson.id}: missing Mongolian question`);
  assert.ok(q.promptEn?.trim(), `${kind}/${lesson.id}: missing English question`);
  assert.equal(q.opts?.length, 4, `${kind}/${lesson.id}: expected four options`);
  assert.equal(q.optsEn?.length, 4, `${kind}/${lesson.id}: expected four English options`);
  assert.equal(new Set(q.opts.map((x) => x.trim())).size, 4, `${kind}/${lesson.id}: duplicate options`);
  assert.equal(new Set(q.optsEn.map((x) => x.trim())).size, 4, `${kind}/${lesson.id}: duplicate English options`);
  assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < 4, `${kind}/${lesson.id}: invalid answer index`);
  assert.ok(q.why?.trim(), `${kind}/${lesson.id}: missing answer explanation`);
  assert.ok(q.whyEn?.trim(), `${kind}/${lesson.id}: missing English answer explanation`);
}

function checkLibrary(path, kind, expectedPerLevel) {
  const items = read(path);
  assert.equal(items.length, expectedPerLevel * levels.length, `${kind}: total count`);
  assert.equal(new Set(items.map((x) => x.id)).size, items.length, `${kind}: duplicate IDs`);
  for (const level of levels) {
    const batch = items.filter((x) => x.level === level);
    assert.equal(batch.length, expectedPerLevel, `${kind}/${level}: expected ${expectedPerLevel} lessons`);
    assert.ok(new Set(batch.map((x) => x.title)).size >= expectedPerLevel * 0.9, `${kind}/${level}: repetitive Mongolian titles`);
    assert.ok(new Set(batch.map((x) => x.titleEn)).size >= expectedPerLevel * 0.9, `${kind}/${level}: repetitive English titles`);
    const promptVariety = Math.ceil(expectedPerLevel * 0.4);
    assert.ok(new Set(batch.map((x) => x.questions[0]?.mn ?? (kind === "reading" ? x.questions[0]?.q : ""))).size >= promptVariety, `${kind}/${level}: repetitive Mongolian questions`);
    assert.ok(new Set(batch.map((x) => x.questions[0]?.promptEn)).size >= promptVariety, `${kind}/${level}: repetitive English questions`);
  }

  for (const item of items) {
    assert.ok(item.title?.trim() && item.titleEn?.trim(), `${kind}/${item.id}: missing bilingual title`);
    assert.ok(item.titleJp?.trim() && item.titleJpFuri?.trim(), `${kind}/${item.id}: missing Japanese title/furigana`);
    assert.ok(!/[{}]/.test(item.titleJp), `${kind}/${item.id}: searchable title must be plain Japanese`);
    assert.ok(!hasBrokenRuby(item.titleJpFuri), `${kind}/${item.id}: malformed title furigana`);
    assert.ok(!unannotatedKanji(item.titleJpFuri), `${kind}/${item.id}: title has unannotated kanji`);
    assert.ok(item.topic?.trim() && item.topicEn?.trim(), `${kind}/${item.id}: missing bilingual topic`);
    checkQuestions(item, kind);

    if (kind === "reading") {
      assert.ok(item.body.length >= 2 && item.body.length <= 3, `${kind}/${item.id}: expected 2–3 Japanese lines`);
      assert.equal(item.bodyMn?.length, item.body.length, `${kind}/${item.id}: Mongolian line count mismatch`);
      assert.equal(item.bodyEn?.length, item.body.length, `${kind}/${item.id}: English line count mismatch`);
      for (let i = 0; i < item.body.length; i++) {
        assert.ok(item.bodyMn[i]?.trim() && item.bodyEn[i]?.trim(), `${kind}/${item.id}: missing line translation ${i}`);
        assert.ok(!hasBrokenRuby(item.body[i]), `${kind}/${item.id}: malformed ruby in line ${i}`);
        assert.ok(!unannotatedKanji(item.body[i]), `${kind}/${item.id}: unannotated kanji in line ${i}`);
      }
      assert.ok(item.glossary.length >= 4, `${kind}/${item.id}: too few glossary terms`);
      for (const term of item.glossary) {
        assert.ok(term.w?.trim() && term.mn?.trim() && term.meaningEn?.trim(), `${kind}/${item.id}: incomplete glossary term`);
        assert.ok(isKana(term.r), `${kind}/${item.id}/${term.w}: reading must be kana`);
      }
    } else {
      assert.equal(item.audioMode, "tts", `${kind}/${item.id}: expected native TTS lesson`);
      assert.ok(!item.youtubeId, `${kind}/${item.id}: unexpected external video dependency`);
      assert.ok(item.transcript.length >= 2, `${kind}/${item.id}: transcript is too short`);
      for (let i = 0; i < item.transcript.length; i++) {
        const line = item.transcript[i];
        assert.ok(line.ja?.trim() && line.mn?.trim() && line.en?.trim(), `${kind}/${item.id}: incomplete transcript line ${i}`);
        assert.ok(!hasBrokenRuby(line.ja), `${kind}/${item.id}: malformed ruby in line ${i}`);
        assert.ok(!unannotatedKanji(line.ja), `${kind}/${item.id}: unannotated kanji in line ${i}`);
      }
      assert.ok(item.vocab.length >= 3, `${kind}/${item.id}: too few vocabulary terms`);
      for (const term of item.vocab) {
        assert.ok(term.w?.trim() && term.mn?.trim() && term.en?.trim(), `${kind}/${item.id}: incomplete vocabulary term`);
        assert.ok(isKana(term.r), `${kind}/${item.id}/${term.w}: reading must be kana`);
      }
    }
  }
  console.log(`${kind}: ${items.length} lessons; ${expectedPerLevel} per level; bilingual content, furigana, questions and choices pass`);
}

checkLibrary("content/reading.json", "reading", 30);
checkLibrary("content/listening.json", "listening", 30);
