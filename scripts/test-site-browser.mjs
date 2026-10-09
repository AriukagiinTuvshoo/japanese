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
if(!fs.existsSync(`${libs}/lib/libnss3.so`)) {
 fs.writeFileSync(`${libs}/al2023.tar`,brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
 execFileSync('tar',['xf',`${libs}/al2023.tar`,'-C',libs]);
}
const source=ts.transpileModule(fs.readFileSync('src/lib/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {ui}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const firstWords=JSON.parse(fs.readFileSync('public/data/vocab/n5.json','utf8'));
const firstKanji=JSON.parse(fs.readFileSync('public/data/kanji/n5.json','utf8'));
const origin='http://127.0.0.1:4177';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','0.0.0.0','--port','4177','--strictPort'],{stdio:'pipe'});
let browser;
try {
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('site test preview timed out')),30000);
  server.stdout.on('data',d=>{if(d.toString().includes('4177')){clearTimeout(timer);resolve();}});
  server.on('exit',()=>{clearTimeout(timer);reject(new Error('site test preview exited'));});
 });
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true,env:{...process.env,LD_LIBRARY_PATH:`${libs}/lib:${process.env.LD_LIBRARY_PATH??''}`}});
 for(const language of ['mn','en']) {
  const context=await browser.newContext();const t=ui[language];
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
   if(language==='en') {
    const text=await page.locator('main').innerText();
    const leftovers=text.split('\n').filter(line=>/[А-Яа-яӨөҮү]/.test(line));
    assert.deepEqual(leftovers,[],`${route}: untranslated Mongolian in English UI`);
   }
   console.log(`${language}: route ${route} rendered`);
  }
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
  for(const [route,text] of [['reading/missing',t.lessonNotFound],['listening/missing',t.lessonNotFound],['reading',t.noLessons],['listening',t.lessonNotFound],['mistakes',t.emptyMistakes],['review',t.emptyDue],['dict',t.searchPromptTitle],['account',t.serverOfflineNote]]) {
   await page.goto(`${origin}/#/${route}`);
   await page.getByText(text,{exact:true}).waitFor();
   if(route==='reading')assert.equal(await page.locator('main .animate-spin').count(),0,'empty static library must not spin forever');
  }
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
   await page.goto(`${origin}/#/vocab/${id}`);
   await page.getByRole('heading',{name:r.expected.w,exact:true}).waitFor();
   await page.getByRole('button',{name:new RegExp(t.examplesTab)}).click();
   const body=await page.locator('main').innerText();
   for(const ex of Object.values(r.examples)){assert.ok(body.includes(ex[language]),`${language}/${id}: example not rendered`);checked++;}
  }
  assert.equal(checked,201);console.log(`${language}: 201 added vocabulary example translations rendered`);
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
} finally {if(browser)await browser.close();server.kill();}
