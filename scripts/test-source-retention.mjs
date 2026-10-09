import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const baseline = '6cf8ca1c7de24604773fff977e1af9dd37189ac8';
const original = p => JSON.parse(execFileSync('git', ['show', `${baseline}:${p}`], {maxBuffer:32*1024*1024}));
const read = p => JSON.parse(fs.readFileSync(p));
const retained = {
  vocab: ['id','w','r','rm','en','lvl','tier','pos','t','kd','src','sid'],
  kanji: ['k','lvl','lvlSrc','s','g','f','en','on','kun','rad','src','sid','mn_mem'],
  grammar: ['id','p','lvl','en','form','jlpt','related','src'],
};
let checked = 0;
for (const kind of Object.keys(retained)) for (const level of ['n5','n4','n3','n2','n1']) {
  const p = `public/data/${kind}/${level}.json`;
  const before = original(p), after = read(p);
  assert.equal(after.length, before.length, `${p}: no entries removed`);
  const key = e => kind === 'kanji' ? e.k : e.id;
  const byId = new Map(after.map(e => [key(e),e]));
  assert.equal(byId.size,after.length,'Duplicate entry ID');
  for (const e of before) {
    const now = byId.get(key(e)); assert.ok(now,`${p}/${key(e)}`);
    for (const field of retained[kind]) assert.deepEqual(now[field],e[field],`${p}/${key(e)}/${field}`);
    assert.equal((now.ex ?? []).length,(e.ex ?? []).length,'No examples removed');
    for (const [i,x] of (e.ex ?? []).entries()) for (const field of ['ja','fg','en','ts']) assert.deepEqual(now.ex[i][field],x[field],`${key(e)}/ex/${i}/${field}`);
    if (kind === 'kanji') assert.deepEqual(now.w.map(w=>[w.w,w.r,w.lvl]),e.w.map(w=>[w.w,w.r,w.lvl]),'No related-word references removed');
    checked++;
  }
  if (kind === 'kanji') assert.deepEqual(read(`public/data/strokes/${level}.json`),original(`public/data/strokes/${level}.json`),'Stroke data retained');
}
for (const kind of ['vocab','kanji']) {
  const p = `content/mn/${kind}-draft.json`;const before=original(p), after=read(p);
  for (const [key,value] of Object.entries(before)) {
    if (kind === 'vocab' && key === '扇ぐ|あおぐ') {
      const correction = read('content/mn/batches/2026-10-09-n2-vocab-meaning-correction-aogu.json').vocab['5c46e379a2'];
      assert.deepEqual(correction.previousMn, [value], `${p}: previous 扇ぐ gloss retained in correction audit`);
      assert.equal(after[key], correction.mn, `${p}: reviewed correction applied to 扇ぐ`);
    } else assert.equal(after[key],value,`${p}: original draft ${key} retained`);
  }
}
const fifty=read('public/data/vocab/n5.json').find(e=>e.id==='j1693050');
assert.deepEqual([fifty.w,fifty.r,fifty.en,fifty.mn],['五十','ごじゅう',['fifty','50'],['тавь']]);
console.log(`Retained ${checked} original entries, example source text, strokes and legacy drafts. j1693050 remains valid Mongolian.`);
