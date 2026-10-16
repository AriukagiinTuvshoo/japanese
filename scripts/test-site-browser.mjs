// Broader UI state tests. Static content is real; injected network failures are
// controlled fixtures, not backend/authentication or linguistic verification.
import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {brotliDecompressSync} from 'node:zlib';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const libs=path.resolve('.cache/browser-libs');fs.mkdirSync(libs,{recursive:true});
if(process.platform!=='win32'&&!fs.existsSync(`${libs}/lib/libnss3.so`)) {
 fs.writeFileSync(`${libs}/al2023.tar`,brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
 execFileSync('tar',['xf',`${libs}/al2023.tar`,'-C',libs]);
}
const source=ts.transpileModule(fs.readFileSync('src/lib/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {ui}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const firstWords=JSON.parse(fs.readFileSync('public/data/vocab/n5.json','utf8'));
const firstKanji=JSON.parse(fs.readFileSync('public/data/kanji/n5.json','utf8'));
const grammarN5=JSON.parse(fs.readFileSync('public/data/grammar/n5.json','utf8'));
const readingLessons=JSON.parse(fs.readFileSync('content/reading.json','utf8'));
const listeningLessons=JSON.parse(fs.readFileSync('content/listening.json','utf8'));
const origin='http://127.0.0.1:4177';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','0.0.0.0','--port','4177','--strictPort'],{stdio:'pipe'});
let browser;
try {
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('site test preview timed out')),30000);
  server.stdout.on('data',d=>{if(d.toString().includes('4177')){clearTimeout(timer);resolve();}});
  server.on('exit',()=>{clearTimeout(timer);reject(new Error('site test preview exited'));});
 });
  const executablePath=process.platform==='win32'
   ? [process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p))
   : await chromium.executablePath();
  assert.ok(executablePath,'No browser executable found for UI tests');
  browser=await playwright.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true,env:process.platform==='win32'?process.env:{...process.env,LD_LIBRARY_PATH:`${libs}/lib:${process.env.LD_LIBRARY_PATH??''}`}});
 for(const language of ['mn','en']) {
  // Fixtures assert network loading/error UI; block SW so its cache cannot
  // mask the controlled requests. The PWA block below opts back in.
  const context=await browser.newContext({serviceWorkers:'block'});const t=ui[language];
  await context.addInitScript(lang=>{if(!localStorage.getItem('nd:doc:local'))localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:lang,onboarded:true,current:'N4',target:'N1'}}));},language);
  await context.route(/^https:\/\//,r=>r.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const headings={vocab:t.vocab,kanji:t.kanji,grammar:t.grammar,reading:t.readingStudio,listening:t.listeningLib,review:`${t.reviewShort} (SRS)`,quiz:t.quizHero,mock:t.mockHero,placement:t.placementHero,dict:t.dictTitle,plan:t.planHero,progress:t.progressHero,achievements:t.achievementsTitle,account:t.accountPageTitle,kana:t.kana,mistakes:t.mistakesTitle,about:t.aboutTitle,write:t.writeHero,'not-a-page':t.notFound};
  const waitRoute=async route=>{
   const key=route.split(/[/?]/)[0];
   if(key==='home')await page.getByRole('heading',{name:new RegExp([t.greetNight,t.greetMorning,t.greetDay,t.greetEvening].join('|'))}).waitFor();
   else await page.locator('main').getByRole('heading',{name:headings[key],exact:true}).waitFor();
  };
  for(const route of ['home','vocab?level=N5','kanji?level=N5','grammar?level=N5','reading','listening','review','quiz','mock','placement','dict','plan','progress','achievements','account','kana','mistakes','about','write/日','not-a-page']) {
   await page.goto(`${origin}/#/${route}`);
   await waitRoute(route);
   if(route==='reading'){const expected=readingLessons.filter(x=>x.level==='N4').length;assert.ok(expected>=30,`reading corpus must keep a floor of 30/level`);assert.equal(await page.locator('main a[href^="#/reading/"]').count(),expected,`${language}: reading library must show every N4 lesson (${expected}, growth floor 30/level)`);}
   if(route==='listening'){const expected=listeningLessons.filter(x=>x.level==='N4').length;assert.ok(expected>=30,`listening corpus must keep a floor of 30/level`);assert.equal(await page.locator('main a[href^="#/listening/"]').count(),expected,`${language}: listening library must show every N4 lesson (${expected}, growth floor 30/level)`);}
   if(language==='en') {
    const text=await page.locator('main').innerText();
    const leftovers=text.split('\n').filter(line=>/[А-Яа-яӨөҮү]/.test(line));
    assert.deepEqual(leftovers,[],`${route}: untranslated Mongolian in English UI`);
   }
   console.log(`${language}: route ${route} rendered`);
  }

  // Word-network regression: the map must connect kanji and word nodes, explain
  // that links are structural rather than synonymous, and persist the learner's
  // own kanji memory note across navigation/reload.
  await page.goto(`${origin}/#/vocab?level=N5&tab=network`);
  await page.getByRole('heading',{name:t.wordNetworkTitle,exact:true}).waitFor();
  const networkMap=page.locator('main svg[role="img"]');
  await networkMap.waitFor();
  assert.ok(await networkMap.locator('line').count()>0,`${language}: word network must draw relationship links`);
  assert.ok(await networkMap.locator('a[href*="#/vocab/"]').count()>0,`${language}: word nodes must link to vocabulary details`);
  assert.ok(await networkMap.locator('a[href*="#/kanji/"]').count()>0,`${language}: connected kanji nodes must link to kanji details`);
  await page.getByText(t.wordNetworkRelationNote,{exact:true}).waitFor();
  const centerCharacter=(await networkMap.locator('text[x="450"][y="280"]').textContent())?.trim();
  assert.ok(centerCharacter,`${language}: network must expose a central kanji`);
  const noteBox=page.getByRole('textbox',{name:t.mnemonicTitle,exact:true});
  await noteBox.waitFor();
  const originalNote=await noteBox.inputValue();
  const trialNote=`network regression ${language} ${centerCharacter}`;
  await noteBox.fill(trialNote);
  await page.getByRole('heading',{name:t.wordNetworkTitle,exact:true}).click();
  await page.waitForFunction(({ch,note})=>{
    const stored=JSON.parse(localStorage.getItem('nd:doc:local')||'{}');
    return stored.mnemonics?.[ch]===note;
  },{ch:centerCharacter,note:trialNote});
  await page.reload();
  await page.getByRole('heading',{name:t.wordNetworkTitle,exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:t.mnemonicTitle,exact:true}).inputValue(),trialNote,
    `${language}: memory note must persist on the word network`);
  await page.getByRole('textbox',{name:t.mnemonicTitle,exact:true}).fill(originalNote);
  await page.getByRole('heading',{name:t.wordNetworkTitle,exact:true}).click();
  await page.waitForFunction(({ch,note})=>{
    const stored=JSON.parse(localStorage.getItem('nd:doc:local')||'{}');
    return (stored.mnemonics?.[ch]??'')===note;
  },{ch:centerCharacter,note:originalNote});
  console.log(`${language}: word network links, explanation, and memory persistence passed`);

  // A failed corpus request must show a retryable error rather than an endless spinner.
  await context.route('**/data/index/meta.json', route => route.abort());
  // Reload to reset module-level data caches before inducing the load failure.
  await page.reload();
  const errorHeading = language === 'en' ? 'Failed to load' : 'Ачаалахад алдаа гарлаа';
  const retryLabel = language === 'en' ? 'Try again' : 'Дахин оролдох';
  await page.getByText(errorHeading,{exact:true}).waitFor();
  await page.getByRole('button',{name:retryLabel,exact:true}).waitFor();
  await context.unroute('**/data/index/meta.json');
  await page.getByRole('button',{name:retryLabel,exact:true}).click();
  await page.getByRole('heading',{name:t.wordNetworkTitle,exact:true}).waitFor();
  await page.locator('main svg[role="img"]').waitFor();
  console.log(`${language}: word network error and retry flow passed`);

  await page.goto(`${origin}/#/vocab/d9c88143a2`);
  await page.getByRole("heading",{name:"シャワー",exact:true}).waitFor();
  await page.getByRole("button",{name:t.examplesTab}).click();
  if (language === "mn") await page.getByText("Шүршүүрт оръё.",{exact:true}).waitFor();
  await page.getByText(t.exampleMnNeedsReview,{exact:true}).waitFor();
  console.log(`${language}: example translation review status is visible`);

  const firstWord=firstWords[0],nextWord=firstWords[1];
  await page.goto(`${origin}/#/vocab/${firstWord.id}`);
  await page.getByRole('heading',{name:firstWord.w,exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:t.previousWord,exact:true}).isDisabled(),true,`${language}: first vocabulary item must not have a previous item`);
  await page.getByRole('link',{name:`${t.nextWord}: ${nextWord.w}`,exact:true}).click();
  await page.getByRole('heading',{name:nextWord.w,exact:true}).waitFor();
  await page.getByRole('link',{name:`${t.previousWord}: ${firstWord.w}`,exact:true}).click();
  await page.getByRole('heading',{name:firstWord.w,exact:true}).waitFor();
  const firstCharacter=firstKanji[0],nextCharacter=firstKanji[1];
  await page.goto(`${origin}/#/kanji/${encodeURIComponent(firstCharacter.k)}`);
  await page.locator('main').getByText(firstCharacter.k,{exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:t.previousKanji,exact:true}).isDisabled(),true,`${language}: first kanji must not have a previous item`);
  await page.getByRole('link',{name:`${t.nextKanji}: ${nextCharacter.k}`,exact:true}).click();
  await page.locator('main').getByText(nextCharacter.k,{exact:true}).first().waitFor();
  await page.getByRole('link',{name:`${t.previousKanji}: ${firstCharacter.k}`,exact:true}).click();
  await page.locator('main').getByText(firstCharacter.k,{exact:true}).first().waitFor();
  console.log(`${language}: vocabulary and kanji previous/next navigation passed`);
  const firstGrammar=grammarN5[0],nextGrammar=grammarN5[1];
  await page.goto(`${origin}/#/grammar/${firstGrammar.id}?level=N5`);
  const prevGrammarLabel=language==='en'?'Previous grammar':'Өмнөх дүрэм',nextGrammarLabel=language==='en'?'Next grammar':'Дараагийн дүрэм';
  assert.equal(await page.getByRole('button',{name:new RegExp(prevGrammarLabel)}).isDisabled(),true,`${language}: first grammar item must not have a previous item`);
  await page.getByRole('link',{name:new RegExp(nextGrammarLabel)}).click();
  await page.waitForFunction(id=>location.hash.includes(id),nextGrammar.id);
  await page.goto(`${origin}/#/grammar/${firstGrammar.id}?level=N5`);
  await page.getByRole('button',{name:t.practiceBtn,exact:true}).click();
  await page.getByText(language==='en'?'Which expression appears exactly as written in this sentence? (Recognition, not sentence completion.)':'Энэ өгүүлбэрт яг энэ хэлбэрээр орсон илэрхийлэл аль вэ? (Таних дасгал; өгүүлбэр бөглөх биш.)',{exact:true}).waitFor();
  const grammarOptions=page.locator('main .card.mt-5 .space-y-2\\.5 > button');
  await grammarOptions.first().waitFor();
  assert.equal(await grammarOptions.count(),4,`${language}: grammar-use quiz must show four answer choices`);
  assert.equal(new Set((await grammarOptions.allTextContents()).map(x=>x.trim())).size,4,`${language}: grammar-use choices must be unique`);
  console.log(`${language}: grammar previous/next navigation and usage quiz passed`);
  await grammarOptions.first().click();
  const before=await grammarOptions.allTextContents();
  const otherLang=language==='en'?'mn':'en';
  await page.getByRole('button',{name:otherLang.toUpperCase(),exact:true}).filter({visible:true}).first().click();
  await page.getByText(otherLang==='en'?'Which expression appears exactly as written in this sentence? (Recognition, not sentence completion.)':'Энэ өгүүлбэрт яг энэ хэлбэрээр орсон илэрхийлэл аль вэ? (Таних дасгал; өгүүлбэр бөглөх биш.)',{exact:true}).waitFor();
  assert.deepEqual(await grammarOptions.allTextContents(),before,`${language}: switching language must preserve choices and selected/correct icons`);
  assert.ok(await grammarOptions.first().isDisabled());
  await page.getByRole('button',{name:language.toUpperCase(),exact:true}).filter({visible:true}).first().click();
  await page.goto(`${origin}/#/mock?level=N3`);
  await page.getByRole('button',{name:t.startExam,exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:t.startExam,exact:true}).isDisabled());
  await page.getByRole('button',{name:language==='en'?'Start available Japanese drills (not a full exam)':'Бэлэн япон дасгал эхлэх (бүрэн шалгалт биш)',exact:true}).click();
  await page.locator('main .card.mt-5 .space-y-2\\.5 > button').first().waitFor();
  assert.ok(!/[A-Za-zА-Яа-яӨөҮү]/.test((await page.locator('main .card.mt-5 .space-y-2\\.5 > button').allTextContents()).join('')));
  console.log(`${language}: live quiz switching and honest full-mock blocking passed`);

  for(const [route,text] of [['reading/missing',t.lessonNotFound],['listening/missing',t.lessonNotFound],['mistakes',t.emptyMistakes],['review',t.emptyDue],['dict',t.searchPromptTitle],['account',t.serverOfflineNote]]) {
   await page.goto(`${origin}/#/${route}`);
   await page.getByText(text,{exact:true}).waitFor();
  }
  const reading=readingLessons.find(x=>x.level==='N3'),listening=listeningLessons.find(x=>x.level==='N5');
  await page.goto(`${origin}/#/reading/${reading.id}`);
  const readingHeading=page.locator('main h1');
  await readingHeading.waitFor();
  assert.ok((await readingHeading.evaluate(el=>el.textContent)).includes(reading.titleJp),`${language}: reading lesson title must render`);
  await page.getByRole('button',{name:new RegExp(t.wordsTab)}).click();
  const readWord=reading.glossary[0],reviewLabel=language==='en'?'Review':'Давтах',knownLabel=language==='en'?'✓ Known':'✓ Мэднэ';
  await page.locator('main .card-flat').filter({hasText:readWord.w}).getByRole('button',{name:reviewLabel,exact:true}).click();
  await page.locator('main .card-flat').filter({hasText:readWord.w}).getByRole('button',{name:knownLabel,exact:true}).waitFor();
  const readWordKey=`${readWord.w}|${readWord.r}`;
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem('nd:doc:local')??'{}').knownWords?.includes(key),readWordKey);
  assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('nd:doc:local'))).knownWords.includes(readWordKey),`${language}: reading known-word state did not persist`);
  await page.goto(`${origin}/#/listening/${listening.id}`);
  const listenWord=listening.vocab[0];
  await page.getByRole('button',{name:reviewLabel,exact:true}).first().click();
  await page.getByRole('button',{name:knownLabel,exact:true}).first().waitFor();
  const listenWordKey=`${listenWord.w}|${listenWord.r}`;
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem('nd:doc:local')??'{}').knownWords?.includes(key),listenWordKey);
  assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('nd:doc:local'))).knownWords.includes(listenWordKey),`${language}: listening known-word state did not persist`);
  console.log(`${language}: reading/listening libraries each show 30 lessons; known-word controls persist`);
  await page.goto(`${origin}/#/vocab?level=N5`);
  await page.getByRole('button',{name:language==='en'?/^Listen to /:/дуудлагыг сонсох$/}).first().waitFor();
  const search=page.locator('main input').first();await search.fill('zzzz-no-such-word');
  await page.getByText(t.noResults,{exact:true}).waitFor();
  // Every example added in this recovery round must actually render in both languages.
  const records=new Map();
  for(const file of fs.readdirSync('content/mn/batches').filter(f=>/^2026-10-09-(exact-example-reuse-\d|n5-examples-recovery-\d)\.json$/.test(f))) {
   const b=JSON.parse(fs.readFileSync(`content/mn/batches/${file}`));
   for(const [id,r] of Object.entries(b.vocab)) {
    if(!records.has(id))records.set(id,{...r,examples:{}});
    Object.assign(records.get(id).examples,r.examples);
   }
  }
  let checked=0;
  for(const [id,r] of records) {
   await page.evaluate(id=>{location.hash=`#/vocab/${id}`;},id);
   await page.getByRole('heading',{name:r.expected.w,exact:true}).waitFor();
   await page.getByRole('button',{name:new RegExp(t.examplesTab)}).click();
   const body=await page.locator('main').innerText();
   for(const ex of Object.values(r.examples)){assert.ok(body.includes(ex[language]),`${language}/${id}: example not rendered`);checked++;}
  }
  assert.equal(checked,201);console.log(`${language}: 201 added vocabulary example translations rendered`);

  // Exercise the guarded N5 translation batch in the actual bilingual UI.
  const n5Batches = fs.readdirSync('content/mn/batches')
   .filter(file=>file.startsWith('2026-10-16-n5-examples-batch-') && file.endsWith('.json'))
   .sort()
   .map(file=>JSON.parse(fs.readFileSync(`content/mn/batches/${file}`,'utf8')));
  const n5ById = new Map(firstWords.map(word => [word.id, word]));
  let n5ExamplesRendered = 0;
  for (const n5Batch of n5Batches) {
   for (const [id, record] of Object.entries(n5Batch.vocab)) {
   const sourceWord = n5ById.get(id);
   assert.ok(sourceWord, `N5 translation batch entry must exist: ${id}`);
   assert.equal(sourceWord.w, record.expected.w, `N5 translation batch word guard: ${id}`);
   await page.evaluate(id=>{location.hash=`#/vocab/${id}`;},id);
   await page.getByRole('heading',{name:sourceWord.w,exact:true}).waitFor();
   await page.getByRole('button',{name:new RegExp(t.examplesTab)}).click();
   const exampleBody=await page.locator('main').innerText();
   for(const [ja,mn] of Object.entries(record.examples)) {
    const sourceExample=sourceWord.ex.find(item=>item.ja===ja);
    assert.ok(sourceExample, `${language}/${id}: batch sentence must match source Japanese exactly`);
    assert.equal(sourceExample.mn,mn, `${language}/${id}: applied Mongolian translation must match the provenance batch`);
    assert.ok(sourceExample.en, `${language}/${id}: source English must be retained`);
    assert.ok(exampleBody.includes(sourceExample.en), `${language}/${id}: source English example must render`);
    if(language==='mn') assert.ok(exampleBody.includes(mn), `${language}/${id}: Mongolian sentence must render`);
    else assert.ok(!exampleBody.includes(mn), `${language}/${id}: unrequested Mongolian translation should not leak into English UI`);
    n5ExamplesRendered++;
   }
   await page.getByText(t.exampleMnNeedsReview,{exact:true}).waitFor();
   }
  }
  const expectedN5ExampleCount = n5Batches.reduce((sum,batch)=>sum+Object.values(batch.vocab).reduce((n,record)=>n+Object.keys(record.examples).length,0),0);
  assert.equal(n5ExamplesRendered,expectedN5ExampleCount);
  console.log(`${language}: ${expectedN5ExampleCount} guarded N5 example translations, source preservation and unreviewed-label UI passed`);
  await page.goto(`${origin}/#/vocab/j1693050`);
  await page.getByRole('heading',{name:'五十',exact:true}).waitFor();
  await page.getByRole('button',{name:new RegExp(t.sourceTab)}).click();
  await page.getByText('CC-BY-SA-3.0 (jamdict-data 1.5 dictionary) · MIT (package)',{exact:true}).waitFor();
  // Retry path and delayed loading for all three learning libraries.
  for(const [route,kind,loading] of [['vocab','vocab',t.loadingVocab],['kanji','kanji',t.loadingKanji],['grammar','grammar',t.loadingGrammar]]) {
   let mode='loading',release,requestArrived;
   const arrived=new Promise(resolve=>{requestArrived=resolve;});
   const pattern=`**/data/${kind}/n5.json`;
   await page.route(pattern,async r=>{
    if(mode==='loading')await new Promise(resolve=>{release=resolve;requestArrived();});
    if(mode==='error')await r.fulfill({status:503,body:'controlled data outage'});
    else await r.continue();
   });
   await page.goto(`${origin}/#/${route}?level=N5`);
   await page.reload();
   await page.getByText(loading,{exact:true}).waitFor();
   await arrived;mode='error';assert.ok(release,'request reached delayed route');release();
   await page.getByText(new RegExp(`/data/${kind}/n5.json.*503`)).waitFor();
   mode='normal';
   await page.getByRole('button',{name:language==='en'?'Try again':'Дахин оролдох',exact:true}).click();
   await page.locator(`main a[href^="#/${route}/"]`).first().waitFor();
   await page.unroute(pattern);
  }
  await page.setViewportSize({width:390,height:844});
  for(const route of ['home','vocab?level=N5','account','reading']) {
   await page.goto(`${origin}/#/${route}`);await waitRoute(route);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language}/${route}: mobile overflow`);
  }
  // Exercise the actual language switch and local persistence, not just seeded UI.
  await page.goto(`${origin}/#/account`);
  await page.getByRole('button',{name:t.studySettingsTab}).click();
  await page.getByText(t.dailyGoalInput,{exact:true}).waitFor();
  const other=language==='en'?'mn':'en';
  // At the mobile viewport the switcher is inside the closed navigation drawer.
  await page.getByRole('button',{name:t.menu,exact:true}).click();
  await page.getByRole('button',{name:other.toUpperCase(),exact:true}).filter({visible:true}).first().click();
  await page.getByRole('button',{name:ui[other].close,exact:true}).filter({visible:true}).first().click();
  await page.getByText(ui[other].dailyGoalInput,{exact:true}).waitFor();
  await page.waitForFunction(lang=>JSON.parse(localStorage.getItem('nd:doc:local')).profile.language===lang,other);
  await page.reload();
  await page.getByText(ui[other].accountPageTitle,{exact:true}).waitFor();
  await page.getByRole('button',{name:ui[other].menu,exact:true}).click();
  await page.getByRole('button',{name:language.toUpperCase(),exact:true}).filter({visible:true}).first().click();
  await page.getByRole('button',{name:t.close,exact:true}).filter({visible:true}).first().click();
  await page.getByText(t.accountPageTitle,{exact:true}).waitFor();
  assert.deepEqual(errors,[],`${language}: uncaught page errors`);
  await context.close();console.log(`${language}: route smoke, empty/offline, loading/error/retry and mobile layout checks passed (not real auth)`);
 }
  // PWA: service-worker install, useful offline corpus, offline launch/routes,
  // and hard proof that /api traffic (auth, tutor, transcripts) is never cached.
  {
   const context=await browser.newContext();
   await context.addInitScript(()=>{if(!localStorage.getItem('nd:doc:local'))localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:'mn',onboarded:true,current:'N4',target:'N1'}}));});
   await context.route(/^https:\/\//,r=>r.abort());
   const page=await context.newPage();page.setDefaultTimeout(25000);
   await page.goto(`${origin}/#/home`);
   await page.evaluate(()=>navigator.serviceWorker.ready);
   await page.reload();
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:25000});
   const manifest=await page.evaluate(async()=>{const res=await fetch('/manifest.webmanifest');return res.ok?await res.json():null;});
   assert.ok(manifest,'pwa: manifest must be served');
   assert.equal(manifest.display,'standalone','pwa: manifest display');
   assert.ok((manifest.icons||[]).some(i=>i.sizes==='512x512'&&/maskable/.test(i.purpose||'')),'pwa: maskable icon required');
   // Warm the study corpus through the SW, then require it to be on disk.
   await page.evaluate(()=>navigator.serviceWorker.controller.postMessage('WARM_DATA'));
   // NOTE: page.waitForFunction does NOT await async predicates (a returned
   // Promise is truthy and resolves the wait instantly) — poll via
   // page.evaluate, which does await. Wait until the study corpus AND the
   // lazy route chunks needed by the offline checks below are on disk.
   {
    const deadline=Date.now()+120000;
    for(;;){
     const ready=await page.evaluate(async()=>{
      const want=['index-','react-','Home-','Vocabulary-','KanjiList-','GrammarList-','categories-','Session-'];
      const found=new Set();
      let corpora=0;
      for(const k of await caches.keys()){
      const c=await caches.open(k);
       for(const req of await c.keys()){
        const p=new URL(req.url).pathname;
        if(/^\/data\/(vocab|kanji|grammar)\/n[1-5]\.json$/.test(p))corpora++;
        for(const w of want) if(p.includes(`/assets/${w}`)) found.add(w);
       }
      }
      return corpora>=15 && found.size>=want.length;
     });
     if(ready)break;
     if(Date.now()>deadline)throw new Error('warm cache timeout (corpus + route chunks)');
     await page.waitForTimeout(250);
    }
   }
   const apiCached=await page.evaluate(async()=>{
    const keys=await caches.keys();
    for(const k of keys){const c=await caches.open(k);for(const req of await c.keys()){if(new URL(req.url).pathname.startsWith('/api/'))return true;}}
    return false;
   });
   assert.equal(apiCached,false,'pwa: /api responses must never be cached');
   await context.setOffline(true);
   for(const [route,name] of [['home',null],['vocab?level=N5',ui.mn.vocab],['kanji?level=N5',ui.mn.kanji],['grammar?level=N5',ui.mn.grammar]]) {
    await page.goto(`${origin}/#/${route}`);
    if(name===null)await page.getByRole('heading',{name:new RegExp([ui.mn.greetNight,ui.mn.greetMorning,ui.mn.greetDay,ui.mn.greetEvening].join('|'))}).waitFor();
    else await page.locator('main').getByRole('heading',{name,exact:true}).waitFor();
    console.log(`pwa: offline route ${route} rendered`);
   }
   await context.setOffline(false);
   await context.close();console.log('pwa: install metadata, offline launch/routes and /api non-caching verified');
  }
} finally {if(browser)await browser.close();server.kill();}
