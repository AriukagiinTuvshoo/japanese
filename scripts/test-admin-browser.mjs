import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {brotliDecompressSync} from 'node:zlib';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const libs=path.resolve('.cache/browser-libs');fs.mkdirSync(libs,{recursive:true});
if(!fs.existsSync(`${libs}/lib/libnss3.so`)) {
 fs.writeFileSync(`${libs}/al2023.tar`,brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
 execFileSync('tar',['xf',`${libs}/al2023.tar`,'-C',libs]);
}
const origin=process.env.TEST_ORIGIN ?? 'http://127.0.0.1:4173';
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process'),headless:true,env:{...process.env,LD_LIBRARY_PATH:`${libs}/lib:${process.env.LD_LIBRARY_PATH??''}`}});
try {
 for(const language of ['mn','en']) {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(lang=>localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:lang,onboarded:true,current:'N4',target:'N1'}})),language);
  let empty=false;
  await page.route('**/api/admin/**',async route=>{
   const url=route.request().url();let data;
   if(url.includes('/overview'))data={accounts:2,activeToday:1,reviewsToday:3,content:{vocab:4,kanji:5,grammar:6,listening:7,reading:8},queue:{pending:1,approved:0,rejected:0},top:[],errors:[]};
   else if(url.includes('/queue'))data={items:empty?[]:[{id:'fixture',kind:'vocab',ref:'fixture-source',level:'N4',en:'example',mn:'жишээ',origin:'ai',status:'pending_review'}]};
   else if(url.includes('/import'))data={added:1,skipped:0};else data={ok:true};
   await route.fulfill({json:data});
  });
  await page.goto(`${origin}/#/admin/overview`);
  await page.getByText(language==='en'?'Content counts':'Агуулгын тоо',{exact:true}).waitFor();
  assert.ok((await page.locator('body').innerText()).includes(language==='en'?'No data yet.':'Одоогоор өгөгдөл алга.'));
  await page.goto(`${origin}/#/admin/queue`);
  await page.getByRole('button',{name:language==='en'?'Approve':'Батлах',exact:true}).waitFor();
  assert.ok((await page.locator('body').innerText()).includes(language==='en'?'AI suggestion · awaiting review':'Хиймэл оюуны санал · хяналт хүлээж буй'));
  assert.ok(!(await page.locator('body').innerText()).includes('pending_review'));
  await page.getByRole('button',{name:language==='en'?'Reject':'Татгалзах',exact:true}).click();
  await page.getByText(language==='en'?'Nothing awaiting review.':'Хүлээгдэж буй зүйл алга.',{exact:true}).waitFor();
  await page.goto(`${origin}/#/admin/import`);
  const area=page.getByRole('textbox',{name:language==='en'?'Content JSON':'Өгөгдлийн JSON'});
  await area.fill('{}');await page.getByRole('button',{name:language==='en'?'Import':'Импортлох',exact:true}).click();
  await page.getByText(language==='en'?'JSON must be an array':'JSON нь массив байх ёстой',{exact:false}).waitFor();
  await area.fill('[{}]');await page.getByRole('button',{name:language==='en'?'Import':'Импортлох',exact:true}).click();
  await page.getByText(language==='en'?'Added: 1 · Skipped: 0. All records are awaiting review.':'Нэмэгдсэн: 1 · Алгассан: 0. Бүх мөр хяналт хүлээж буй төлөвөөр орсон.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);await page.close();console.log(`Admin ${language}: overview, queue/reject/empty, import error/success passed (mock API).`);
 }
}finally{await browser.close();}
