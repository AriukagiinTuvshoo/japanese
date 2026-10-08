import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
const server = spawn('node', ['node_modules/vite/bin/vite.js','preview','--host','0.0.0.0','--port','4173'], {stdio:'pipe'});
try {
  await new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('preview startup timed out')), 30000);
    server.stdout.on('data', d => { if (d.toString().includes('4173')) {clearTimeout(timer);resolve();} });
    server.on('exit', () => reject(new Error('preview exited')));
  });
  const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args:chromium.args, headless:true });
  try {
    for (const language of ['mn','en']) {
      const page = await browser.newPage();
      const errors=[];page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(lang => localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:lang,onboarded:true,current:'N4',target:'N1'}})),language);
      await page.goto('http://127.0.0.1:4173/#/grammar/te-ageru?level=N4');
      await page.getByRole('heading',{name:'〜てあげる',exact:true}).waitFor();
      assert.ok((await page.locator('body').innerText()).includes(language === 'mn' ? 'Хэн нэгэнд тус' : 'do something for someone'));
      await page.goto('http://127.0.0.1:4173/#/kanji?level=N1');
      const topic = page.getByRole('button',{name:language==='mn' ? /Хайр · харилцаа/ : /Love & relationships/}).first();
      await topic.waitFor();await topic.click();assert.equal(await topic.getAttribute('aria-pressed'),'true');
      await page.goto('http://127.0.0.1:4173/#/vocab?level=N5');
      await page.getByRole('button',{name:language==='mn' ? /Хайр · харилцаа/ : /Love & relationships/}).first().waitFor();
      assert.deepEqual(errors,[]);await page.close();console.log(`${language}: grammar detail and vocabulary/kanji category browser smoke passed`);
    }
  } finally {await browser.close();}
} finally {server.kill();}
