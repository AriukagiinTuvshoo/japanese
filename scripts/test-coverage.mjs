import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validMn, topicsFor, auditCoverage } from './validate-coverage.mjs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
assert.equal(validMn('love'), false);
assert.equal(validMn('Орчуулга хүлээгдэж байна'), false);
assert.equal(validMn('хайр'), true);
const taxonomy = read('content/categories/taxonomy.json');
assert.ok(topicsFor({id:'test',en:['loving mother'],t:'n'},'vocab',taxonomy,{vocab:{}}).includes('relationships'));
assert.ok(!topicsFor({id:'test',en:['stage'],t:'n'},'vocab',taxonomy,{vocab:{}}).includes('time'));
assert.deepEqual(topicsFor({id:'test',en:['xyz'],t:'n'},'vocab',taxonomy,{vocab:{}}), []);
const report = auditCoverage();
assert.deepEqual(report.totals, read('content/coverage-report.json').totals, 'Refresh coverage report after data changes');
console.log('Coverage regression checks passed (does not assert release completeness).');

for (const lv of ['N5','N4','N3']) for (const field of ['missingMeanings','missingExamples','missingForms']) assert.equal(report.byLevel[lv].grammar[field],0,`${lv} grammar ${field}`);
assert.equal(report.byLevel.N5.vocab.missingMeanings,0);
assert.equal(report.byLevel.N5.vocab.unclassified,0);
assert.equal(report.byLevel.N5.kanji.unclassified,0);
assert.equal(report.byLevel.N3.grammar.missingMeanings,0);

for (const lv of ["N2","N1"]) for (const field of ["missingMeanings","missingForms"]) assert.equal(report.byLevel[lv].grammar[field],0);

// Legacy exemption is exact-content only; it cannot excuse new derived text.
const legacyPath = 'public/data/vocab/n4.json';
const originalLegacyData = fs.readFileSync(legacyPath, 'utf8');
try {
  const entries = JSON.parse(originalLegacyData);
  const legacyEntry = entries.find(e => e.mn?.length && !e.mn_provenance);
  assert.ok(legacyEntry);
  legacyEntry.mn = ['шинээр өөрчилсөн утга'];
  fs.writeFileSync(legacyPath, JSON.stringify(entries));
  assert.ok(auditCoverage().totals.missingProvenance > 0, 'Changed legacy text must require new provenance');
} finally { fs.writeFileSync(legacyPath, originalLegacyData); }
assert.equal(report.legacyUnreviewed, 6503);

for (const lv of ["N3","N2"]) assert.equal(report.byLevel[lv].vocab.missingMeanings,0);

// A conflicting derived gloss is auditable but must not count as an active translation.
const withdrawn = read('public/data/vocab/n1.json').find(e => e.id === 'e05bb17edd');
assert.deepEqual([withdrawn.w, withdrawn.r, withdrawn.en], ['気品', 'きひん', ['aroma']]);
assert.deepEqual(withdrawn.mn, []);
assert.ok(withdrawn.source_issue);
assert.equal(withdrawn.mn_provenance, undefined);
const withdrawal = read('content/mn/batches/2026-10-08-n1-vocab-six-3.json').vocab.e05bb17edd;
assert.deepEqual(withdrawal.withdrawnMn, ['анхилуун үнэр']);
assert.equal(withdrawal.mn, undefined);
assert.ok(!read('content/categories/overrides.json').vocab.e05bb17edd);

// Persist-round source guards and category evidence are exact, not count-only checks.
const categoryEvidence = read('content/categories/provenance.json');
for (const file of fs.readdirSync('content/mn/batches').filter(f => /^2026-10-08-n1-(vocab|kanji)-(persist|sustain|close|advance|finish|remainder|final)-\d+\.json$/.test(f))) {
  const batch = read(`content/mn/batches/${file}`);
  const kind = batch.vocab ? 'vocab' : 'kanji';
  const records = batch[kind];
  assert.equal(Object.keys(records).length, file === '2026-10-08-n1-kanji-final-2.json' ? 35 : 60, `${file}: exact batch size`);
  assert.equal(batch.provenance.reviewStatus, 'unreviewed');
  const data = read(`public/data/${kind}/n1.json`);
  for (const [id, record] of Object.entries(records)) {
    const entry = data.find(e => (kind === 'vocab' ? e.id : e.k) === id);
    assert.ok(entry, `${file}/${id}: stable key`);
    assert.deepEqual(Object.keys(record.expected).sort(), (kind === 'vocab' ? ['w','r','en'] : ['k','on','kun','en']).sort());
    for (const [field, expected] of Object.entries(record.expected)) assert.deepEqual(entry[field], expected, `${id}/${field}: source retained`);
    assert.deepEqual(entry.mn, record.mn, `${id}: applied sense`);
    const evidence = categoryEvidence.entries[kind][id];
    assert.deepEqual(evidence.topics, record.topics, `${id}: auditable topics`);
    assert.deepEqual(evidence.en, entry.en);
    assert.equal(evidence.ja, kind === 'vocab' ? entry.w : entry.k);
    if (kind === 'vocab') assert.equal(evidence.reading, entry.r);
    else for (const field of ['on','kun']) assert.deepEqual(evidence[field], entry[field]);
  }
}

// Regression: 萬 once contained a bare numeric alternative, which is not MN text.
const tenThousandBatch = read('content/mn/batches/2026-10-08-n1-kanji-sustain-6.json').kanji['萬'];
assert.deepEqual(tenThousandBatch.mn, ['арван мянга']);
assert.ok(tenThousandBatch.mn.every(validMn));
assert.deepEqual(read('public/data/kanji/n1.json').find(e => e.k === '萬').mn, tenThousandBatch.mn);
assert.equal(validMn('10,000'), false, 'Bare number must not qualify as Mongolian');

// Sentence-keyed example batches guard both source languages and applied provenance.
for (const file of ['2026-10-08-n5-examples-final-1.json','2026-10-08-n5-examples-final-2.json']) {
 const batch = read(`content/mn/batches/${file}`);
 const data = read('public/data/vocab/n5.json');
 let count = 0;
 for (const [id, record] of Object.entries(batch.vocab)) {
  const entry = data.find(e => e.id === id);
  for (const [field, expected] of Object.entries(record.expected)) assert.deepEqual(entry[field], expected);
  for (const [ja, value] of Object.entries(record.examples)) {
   const example = entry.ex.find(e => e.ja === ja);
   assert.equal(example.en, value.en);
   assert.equal(example.mn, value.mn);
   assert.equal(example.mn_provenance, batch.provenance.id);
   assert.ok(validMn(value.mn)); count++;
  }
 }
 assert.equal(count, 20);
}
const reviewStatusBatch = read('content/mn/batches/2026-10-09-z-source-review-status.json');
const conflictAudit = read('content/mn/source-conflict-audit-2026-10-08.json');
assert.equal(conflictAudit.records.length, 10);
for (const record of conflictAudit.records) {
 const data = read(`public/data/${record.kind}/${record.level}.json`);
 const entry = data.find(e => (record.kind === 'vocab' ? e.id : e.k) === record.key);
 for (const [field, expected] of Object.entries(record.expected)) assert.deepEqual(entry[field], expected);
 assert.equal(reviewStatusBatch[record.kind][record.key].previousSourceNote, record.existingWarning);
 assert.equal(entry.source_issue, reviewStatusBatch[record.kind][record.key].sourceNote);
}

// Corpus batches: sentence guards, applied MN, provenance and semantic evidence.
for (const file of fs.readdirSync('content/mn/batches').filter(f => /^2026-10-08-n[45]-(examples|topics)-corpus-\d+\.json$/.test(f))) {
 const batch = read(`content/mn/batches/${file}`);
 const level = file.match(/-n([45])-/)[1];
 const data = read(`public/data/vocab/n${level}.json`);
 let sentences = 0;
 for (const [id, record] of Object.entries(batch.vocab)) {
  const entry = data.find(e => e.id === id);
  assert.ok(entry, `${file}/${id}: stable ID`);
  assert.deepEqual(Object.keys(record.expected).sort(), ['en','r','w']);
  for (const [field, expected] of Object.entries(record.expected)) assert.deepEqual(entry[field], expected);
  for (const [ja, value] of Object.entries(record.examples ?? {})) {
   const matches = entry.ex.filter(e => e.ja === ja);
   assert.equal(matches.length, 1, `${id}/${ja}: unique sentence key`);
   const example = matches[0];
   assert.equal(example.en, value.en);
   assert.equal(example.mn, value.mn);
   assert.equal(example.mn_provenance, batch.provenance.id);
   assert.ok(validMn(value.mn)); sentences++;
  }
  if (record.topics) {
   const evidence = read('content/categories/provenance.json').entries.vocab[id];
   assert.deepEqual(evidence.topics, record.topics);
   assert.equal(evidence.ja, entry.w);
   assert.equal(evidence.reading, entry.r);
   assert.deepEqual(evidence.en, entry.en);
  }
 }
 if (file.includes('examples')) assert.equal(sentences, level === '4' ? 24 : file.endsWith('-5.json') ? 35 : 40);
 else assert.equal(Object.keys(batch.vocab).length, 50);
 assert.equal(batch.provenance.reviewStatus, 'unreviewed');
}

for (const file of fs.readdirSync('content/mn/batches').filter(f => /^2026-10-08-n[34]-examples-sustained-\d+\.json$/.test(f))) {
 const batch = read(`content/mn/batches/${file}`);
 const lv = file.match(/-n([34])-/)[1];
 const data = read(`public/data/vocab/n${lv}.json`);
 let count = 0;
 for (const [id, r] of Object.entries(batch.vocab)) {
  const entry = data.find(e => e.id === id);
  assert.deepEqual(Object.keys(r.expected).sort(), ['en','r','w']);
  for (const [f,v] of Object.entries(r.expected)) assert.deepEqual(entry[f],v);
  for (const [ja,v] of Object.entries(r.examples)) {
   const matches=entry.ex.filter(e=>e.ja===ja); assert.equal(matches.length,1);
   const ex=matches[0]; assert.equal(ex.en,v.en); assert.equal(ex.mn,v.mn);
   assert.equal(ex.mn_provenance,batch.provenance.id); assert.ok(validMn(ex.mn)); count++;
  }
 }
 assert.equal(count, lv==='4' && file.endsWith('-5.json') ? 33 : lv==='3' && file.endsWith('-2.json') ? 22 : 40);
 assert.equal(batch.provenance.reviewStatus,'unreviewed');
}

const grammarBatch=read('content/mn/batches/2026-10-08-n2-grammar-examples-sustained-1.json');
let grammarSentences=0;
for(const [id,r] of Object.entries(grammarBatch.grammar)) {
 const e=read('public/data/grammar/n2.json').find(e=>e.id===id);
 for(const [f,v] of Object.entries(r.expected)) assert.deepEqual(e[f],v);
 for(const [ja,v] of Object.entries(r.examples)) {
  const matches=e.ex.filter(x=>x.ja===ja);assert.equal(matches.length,1);
  assert.equal(matches[0].en,v.en);assert.equal(matches[0].mn,v.mn);
  assert.equal(matches[0].mn_provenance,grammarBatch.provenance.id);assert.ok(validMn(v.mn));grammarSentences++;
 }
}
assert.equal(grammarSentences,6);
const topicBatch=read('content/mn/batches/2026-10-08-n4-topics-sustained-1.json');
assert.equal(Object.keys(topicBatch.vocab).length,20);
for(const [id,r] of Object.entries(topicBatch.vocab)) {
 const e=read('public/data/vocab/n4.json').find(e=>e.id===id);
 for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
 const evidence=read('content/categories/provenance.json').entries.vocab[id];
 assert.deepEqual(evidence.topics,r.topics);assert.equal(evidence.ja,e.w);assert.equal(evidence.reading,e.r);assert.deepEqual(evidence.en,e.en);
}
for(const r of read('content/mn/example-source-audit-2026-10-08.json').records) {
 const e=read(`public/data/vocab/${r.level}.json`).find(e=>e.id===r.id);
 for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
 const x=e.ex.find(x=>x.ja===r.ja);assert.equal(x.en,r.en);assert.ok(!x.mn);
}

for(const file of fs.readdirSync('content/mn/batches').filter(f=>/^2026-10-09-n[12]-(vocab|grammar)-examples-round-\d+\.json$/.test(f))) {
 const b=read(`content/mn/batches/${file}`);const kind=b.vocab?'vocab':'grammar';const lv=file.match(/-n([12])-/)[1];
 const data=read(`public/data/${kind}/n${lv}.json`);let count=0;
 for(const [id,r] of Object.entries(b[kind])) {
  const e=data.find(x=>x.id===id);assert.ok(e);
  assert.deepEqual(Object.keys(r.expected).sort(),kind==='vocab'?['en','r','w']:['en','p']);
  for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
  for(const [ja,v] of Object.entries(r.examples)) {
   const xs=e.ex.filter(x=>x.ja===ja);assert.equal(xs.length,1);const x=xs[0];
   assert.equal(x.en,v.en);assert.equal(x.mn,v.mn);assert.equal(x.mn_provenance,b.provenance.id);assert.ok(validMn(x.mn));count++;
  }
 }
 assert.equal(count,kind==='vocab'?20:40);assert.equal(b.provenance.reviewStatus,'unreviewed');
}
const oct9Topics=read('content/mn/batches/2026-10-09-n3-kanji-topics-1.json');
assert.equal(Object.keys(oct9Topics.kanji).length,20);
for(const [id,r] of Object.entries(oct9Topics.kanji)) {
 const e=read('public/data/kanji/n3.json').find(e=>e.k===id);
 for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
 const evidence=read('content/categories/provenance.json').entries.kanji[id];
 assert.equal(evidence.ja,id);assert.deepEqual(evidence.topics,r.topics);
 for(const f of ['on','kun','en'])assert.deepEqual(evidence[f],e[f]);
}
for(const file of fs.readdirSync('content/mn/batches').filter(f=>/^2026-10-09-n2-(grammar|vocab)-examples-progress-\d+\.json$/.test(f))) {
 const b=read(`content/mn/batches/${file}`),kind=b.grammar?'grammar':'vocab';let count=0;
 for(const [id,r] of Object.entries(b[kind])) {
  const e=read(`public/data/${kind}/n2.json`).find(e=>e.id===id);assert.ok(e);
  for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
  for(const [ja,v] of Object.entries(r.examples)) {
   const xs=e.ex.filter(x=>x.ja===ja);assert.equal(xs.length,1);assert.equal(xs[0].en,v.en);assert.equal(xs[0].mn,v.mn);assert.equal(xs[0].mn_provenance,b.provenance.id);assert.ok(validMn(v.mn));count++;
  }
 }
 assert.equal(count,kind==='grammar'&&file.endsWith('-4.json')?30:kind==='grammar'&&file.endsWith('-3.json')?10:kind==='vocab'&&file.endsWith('-5.json')?9:40);
}
const progressTopics=read('content/mn/batches/2026-10-09-topics-progress-1.json');
for(const kind of ['kanji','vocab']) {
 assert.equal(Object.keys(progressTopics[kind]).length,20);
 for(const [id,r] of Object.entries(progressTopics[kind])) {
  const e=read(`public/data/${kind}/${kind==='kanji'?'n2':'n3'}.json`).find(e=>(kind==='kanji'?e.k:e.id)===id);
  for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
  const ev=read('content/categories/provenance.json').entries[kind][id];
  assert.deepEqual(ev.topics,r.topics);assert.deepEqual(ev.en,e.en);assert.equal(ev.ja,kind==='kanji'?e.k:e.w);
  if(kind==='vocab')assert.equal(ev.reading,e.r);else for(const f of ['on','kun'])assert.deepEqual(ev[f],e[f]);
 }
}
for(const r of read('content/mn/example-source-audit-2026-10-09.json').records) {
 const e=read(`public/data/vocab/${r.level}.json`).find(e=>e.id===r.id);
 for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
 const x=e.ex.find(x=>x.ja===r.ja);assert.equal(x.en,r.en);assert.ok(!x.mn);
}

// October 9 continued corpus: exact source fields, unique sentence keys, applied text/provenance.
for (const file of fs.readdirSync('content/mn/batches').filter(f => /^2026-10-09-n[12]-grammar-examples-continue-\d+\.json$/.test(f))) {
 const batch=read(`content/mn/batches/${file}`),level=file.match(/-n([12])-/)[1];let count=0;
 const data=read(`public/data/grammar/n${level}.json`);
 for(const [id,record] of Object.entries(batch.grammar)) {
  const entry=data.find(e=>e.id===id);assert.ok(entry,`${file}/${id}`);
  assert.deepEqual(Object.keys(record.expected).sort(),['en','p']);
  for(const [field,value] of Object.entries(record.expected))assert.deepEqual(entry[field],value);
  for(const [ja,value] of Object.entries(record.examples)) {
   const examples=entry.ex.filter(ex=>ex.ja===ja);assert.equal(examples.length,1);
   assert.equal(examples[0].en,value.en);assert.equal(examples[0].mn,value.mn);
   assert.equal(examples[0].mn_provenance,batch.provenance.id);assert.ok(validMn(value.mn));count++;
  }
 }
 assert.equal(count,level==='2'&&file.endsWith('-2.json')?37:level==='1'&&file.endsWith('-5.json')?20:level==='1'&&file.endsWith('-7.json')?26:40);
 assert.equal(batch.provenance.reviewStatus,'unreviewed');
}

const continueTopics = read('content/mn/batches/2026-10-09-topics-continue-1.json');
for (const kind of ['kanji','vocab']) {
 assert.equal(Object.keys(continueTopics[kind]).length,20);
 for (const [id,record] of Object.entries(continueTopics[kind])) {
  const entry=read(`public/data/${kind}/${kind==='kanji'?'n3':'n2'}.json`).find(e=>(kind==='kanji'?e.k:e.id)===id);
  assert.ok(entry);assert.deepEqual(Object.keys(record.expected).sort(),kind==='kanji'?['en','k','kun','on']:['en','r','w']);
  for(const [field,value] of Object.entries(record.expected))assert.deepEqual(entry[field],value);
  const evidence=read('content/categories/provenance.json').entries[kind][id];
  assert.deepEqual(evidence.topics,record.topics);assert.deepEqual(evidence.en,entry.en);assert.equal(evidence.ja,kind==='kanji'?entry.k:entry.w);
  if(kind==='vocab')assert.equal(evidence.reading,entry.r);else for(const f of ['on','kun'])assert.deepEqual(evidence[f],entry[f]);
  assert.deepEqual(read('content/categories/overrides.json')[kind][id],record.topics);
 }
}
assert.equal(continueTopics.provenance.reviewStatus,'unreviewed');

// External evidence is reproducible and guarded, not a release/linguistic pass.
const dictionaryAudit=read('docs/audits/2026-10-09-dictionary-evidence.json');
assert.deepEqual(dictionaryAudit.counts,{missingMeaningsAudited:62,sourceWarningsAudited:10,uniqueRecords:67,activeCorrections:0});
assert.equal(dictionaryAudit.source.packageVersion,'1.5');
assert.equal(dictionaryAudit.source.dictionaryLicense,'CC-BY-SA-3.0');
assert.equal(dictionaryAudit.source.artifactSha256,'a4247dd9bb3148ab17c1b32fc56d7a7f1c35293b0d6ff2838c811f896d13f415');
assert.equal(new Set(dictionaryAudit.records.map(r=>`${r.kind}/${r.level}/${r.key}`)).size,67);
for(const r of dictionaryAudit.records) {
 const e=read(`public/data/${r.kind}/${r.level}.json`).find(e=>(r.kind==='kanji'?e.k:e.id)===r.key);
 assert.ok(e);for(const [f,v] of Object.entries(r.expected))assert.deepEqual(e[f],v);
 assert.equal(e.source_issue??null,reviewStatusBatch[r.kind]?.[r.key]?.sourceNote ?? r.existingWarning);
 if(r.existingWarning)assert.equal(reviewStatusBatch[r.kind][r.key].previousSourceNote,r.existingWarning);if(r.missingMeaning)assert.ok(!e.mn?.length);
 assert.equal(r.artifactUrl,dictionaryAudit.source.artifactUrl);
 assert.equal(r.dictionaryLicense,dictionaryAudit.source.dictionaryLicense);
 assert.match(r.decision,/blocked/);
}
const aromaEvidence=dictionaryAudit.records.find(r=>r.key==='e05bb17edd');
assert.ok(aromaEvidence.exactHeadwordReadingCandidates.some(c=>c.entrySeq===1222540&&c.senses.some(s=>s.englishGlosses.includes('aroma'))));
const bundledDictionary=read('public/data/index/meta.json').sources.find(s=>s.id==='jmdict');
assert.match(bundledDictionary.license,/CC-BY-SA-3\.0/);
for(const s of read('public/data/index/meta.json').sources) assert.ok(s.note_en,'English source description');

for(const level of ['n1','n2']) {
 const batch=read(`content/mn/batches/2026-10-09-${level}-vocab-examples-continue-1.json`);let count=0;
 for(const [id,record] of Object.entries(batch.vocab)) {
  const e=read(`public/data/vocab/${level}.json`).find(e=>e.id===id);
  assert.ok(e);assert.deepEqual(Object.keys(record.expected).sort(),['en','r','w']);
  for(const [f,v] of Object.entries(record.expected))assert.deepEqual(e[f],v);
  for(const [ja,x] of Object.entries(record.examples)) {
   const matches=e.ex.filter(e=>e.ja===ja);assert.equal(matches.length,1);
   assert.equal(matches[0].en,x.en);assert.equal(matches[0].mn,x.mn);
   assert.equal(matches[0].mn_provenance,batch.provenance.id);assert.ok(validMn(x.mn));count++;
  }
 }
 assert.equal(count,20);assert.equal(batch.provenance.reviewStatus,'unreviewed');
}
for(const level of ['N5','N4','N3','N2','N1'])assert.equal(report.byLevel[level].grammar.missingExamples,0);

// Exact reuse must retain the earlier origin, not pretend to be a new human translation.
const allVocab = ['n5','n4','n3','n2','n1'].flatMap(l=>read(`public/data/vocab/${l}.json`));
for(let i=1;i<=4;i++) {
 const b=read(`content/mn/batches/2026-10-09-exact-example-reuse-${i}.json`);let n=0;
 assert.equal(b.provenance.reviewStatus,'unreviewed');
 for(const [id,r] of Object.entries(b.vocab)) {
  const e=allVocab.find(e=>e.id===id);assert.ok(e);
  assert.deepEqual(Object.keys(r.expected).sort(),['en','r','w']);
  for(const [k,v] of Object.entries(r.expected))assert.deepEqual(e[k],v);
  for(const [ja,x] of Object.entries(r.examples)) {
   const matches=e.ex.filter(ex=>ex.ja===ja);assert.equal(matches.length,1);
   assert.equal(matches[0].en,x.en);assert.equal(matches[0].mn,x.mn);assert.ok(validMn(x.mn));
   assert.equal(matches[0].mn_provenance,b.provenance.id);assert.ok(x.reusedFrom.length);
   for(const origin of x.reusedFrom) {
    assert.equal(origin.kind,'vocab');
    const source=read(`public/data/vocab/${origin.level}.json`).find(e=>e.id===origin.id);
    assert.ok(source);assert.ok(source.ex.some(ex=>ex.ja===ja&&ex.en===x.en&&ex.mn===x.mn&&ex.mn_provenance===origin.provenance));
   }
   n++;
  }
 }
 assert.equal(n,i===4?1:40);
}
for(let i=1;i<=4;i++) {
 const b=read(`content/mn/batches/2026-10-09-n4-topics-recovery-${i}.json`);
 assert.equal(b.provenance.reviewStatus,'unreviewed');assert.equal(Object.keys(b.vocab).length,i===4?24:40);
 for(const [id,r] of Object.entries(b.vocab)) {
  const e=read('public/data/vocab/n4.json').find(e=>e.id===id);assert.ok(e);
  assert.deepEqual(Object.keys(r.expected).sort(),['en','r','w']);
  for(const [k,v] of Object.entries(r.expected))assert.deepEqual(e[k],v);
  assert.deepEqual(read('content/categories/overrides.json').vocab[id],r.topics);
  const evidence=read('content/categories/provenance.json').entries.vocab[id];
  assert.deepEqual(evidence,{ja:e.w,reading:e.r,en:e.en,topics:r.topics,provenance:b.provenance.id});
 }
}
assert.equal(report.byLevel.N4.vocab.unclassified,0);
for(let i=1;i<=2;i++) {
 const b=read(`content/mn/batches/2026-10-09-n5-examples-recovery-${i}.json`);let n=0;
 assert.equal(b.provenance.reviewStatus,'unreviewed');
 for(const [id,r] of Object.entries(b.vocab)) {
  const e=allVocab.find(e=>e.id===id);assert.ok(e);
  assert.deepEqual(Object.keys(r.expected).sort(),['en','r','w']);
  for(const [k,v] of Object.entries(r.expected))assert.deepEqual(e[k],v);
  for(const [ja,x] of Object.entries(r.examples)) {
   const matches=e.ex.filter(ex=>ex.ja===ja);assert.equal(matches.length,1);
   assert.equal(matches[0].en,x.en);assert.equal(matches[0].mn,x.mn);assert.ok(validMn(x.mn));
   assert.equal(matches[0].mn_provenance,b.provenance.id);n++;
  }
 }
 assert.equal(n,40);
}
const references=read('docs/audits/2026-10-09-independent-reference-checks.json');
assert.deepEqual(references.counts,{records:10,activeCorrections:0,clearedWarnings:0});
for(const r of references.records) {
 const e=read(`public/data/${r.kind}/${r.level}.json`).find(e=>(r.kind==='kanji'?e.k:e.id)===r.key);
 assert.ok(e);for(const [k,v] of Object.entries(r.expected))assert.deepEqual(e[k],v);
 assert.equal(e.source_issue,reviewStatusBatch[r.kind][r.key].sourceNote);
 assert.equal(reviewStatusBatch[r.kind][r.key].previousSourceNote,r.existingWarning);assert.match(r.referenceUrl,/^https:\/\//);
 assert.match(r.version,/not established/);assert.match(r.decision,/blocked/);
}
