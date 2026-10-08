import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
// Use the npm-distributed runtime libraries; no OS package download or system mutation.
const libs = path.resolve('.cache/browser-libs');
fs.mkdirSync(libs, {recursive:true});
if (!fs.existsSync(`${libs}/lib/libnss3.so`)) {
  fs.writeFileSync(`${libs}/al2023.tar`, brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['xf', `${libs}/al2023.tar`, '-C', libs]);
}
const uiSource = ts.transpileModule(fs.readFileSync('src/lib/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {ui} = await import(`data:text/javascript;base64,${Buffer.from(uiSource).toString('base64')}`);
const server = spawn('node', ['node_modules/vite/bin/vite.js','preview','--host','0.0.0.0','--port','4176','--strictPort'], {stdio:'pipe'});
try {
  await new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('preview startup timed out')), 30000);
    server.stdout.on('data', d => { if (d.toString().includes('4176')) {clearTimeout(timer);resolve();} });
    server.on('exit', () => reject(new Error('preview exited')));
  });
  for (const language of ['mn','en']) {
    const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'], headless:true, env:{...process.env,LD_LIBRARY_PATH:`${libs}/lib:${process.env.LD_LIBRARY_PATH ?? ''}`} });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(15000);
      await page.route(/^https:\/\//, route => route.abort());
      const errors=[];page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(lang => localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:lang,onboarded:true,current:'N4',target:'N1'}})),language);
      await page.goto('http://127.0.0.1:4176/#/grammar/te-ageru?level=N4');
      await page.getByRole('heading',{name:'〜てあげる',exact:true}).waitFor();
      assert.ok((await page.locator('body').innerText()).includes(language === 'mn' ? 'Хэн нэгэнд тус' : 'do something for someone'));
      let checkedRules=0, checkedExamples=0;
      for (const level of ['n5','n4','n3','n2','n1']) {
        const rules = JSON.parse(fs.readFileSync(`public/data/grammar/${level}.json`));
        for (const g of rules) {
          await page.goto(`http://127.0.0.1:4176/#/grammar/${g.id}?level=${level.toUpperCase()}`,{waitUntil:'domcontentloaded'});
          const form = language === 'mn' ? g.form_mn : g.form;
          await page.waitForFunction(text => document.body.innerText.includes(text), form);
          await page.getByRole('button',{name:new RegExp(ui[language].examplesTab2)}).click();
          const body = await page.locator('body').innerText();
          for (const ex of g.ex) {
            const translation=language==='mn'?ex.mn:ex.en;
            assert.ok(translation,`${language}/${level}/${g.id}: translation must exist`);
            assert.ok(body.includes(translation), `${language}/${level}/${g.id}: example`);checkedExamples++;
          }
          checkedRules++;
        }
        console.log(`${language}/${level}: ${rules.length} grammar details/forms and ${rules.reduce((n,g)=>n+g.ex.length,0)} examples checked`);
      }
      await page.goto('http://127.0.0.1:4176/#/kanji?level=N1');
      const topic = page.getByRole('button',{name:language==='mn' ? /Хайр · харилцаа/ : /Love & relationships/}).first();
      await topic.waitFor();await topic.click();assert.equal(await topic.getAttribute('aria-pressed'),'true');
      await page.goto('http://127.0.0.1:4176/#/vocab?level=N5');
      await page.getByRole('button',{name:language==='mn' ? /Хайр · харилцаа/ : /Love & relationships/}).first().waitFor();
      assert.deepEqual(errors,[]);await page.close();console.log(`${language}: ${checkedRules} N5–N1 grammar details/forms and ${checkedExamples} example translations plus vocabulary/kanji topic filters passed`);
    } finally {await browser.close();}
  }
} finally {server.kill();}
