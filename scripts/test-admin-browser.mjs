import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {brotliDecompressSync} from 'node:zlib';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const libs=path.resolve('.cache/browser-libs');fs.mkdirSync(libs,{recursive:true});
if(process.platform!=='win32'&&!fs.existsSync(`${libs}/lib/libnss3.so`)) {
 fs.writeFileSync(`${libs}/al2023.tar`,brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
 execFileSync('tar',['xf',`${libs}/al2023.tar`,'-C',libs]);
}
const origin=process.env.TEST_ORIGIN ?? (process.env.ADMIN_TEST_START_SERVER==='1'?'http://127.0.0.1:4175':'http://127.0.0.1:4173');
let server;
if(process.env.ADMIN_TEST_START_SERVER==='1') {
 server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','0.0.0.0','--port','4175','--strictPort'],{stdio:'pipe'});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{server.kill();reject(new Error('Admin test preview startup timed out'));},30000);
  server.stdout.on('data',d=>{if(d.toString().includes('4175')){clearTimeout(timer);resolve();}});
  server.on('exit',()=>{clearTimeout(timer);reject(new Error('Admin test preview exited'));});
 });
}
const executablePath=process.platform==='win32'
 ? [process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p))
 : await chromium.executablePath();
assert.ok(executablePath,'No browser executable found for admin UI tests');
const browser=await playwright.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true,env:process.platform==='win32'?process.env:{...process.env,LD_LIBRARY_PATH:`${libs}/lib:${process.env.LD_LIBRARY_PATH??''}`}});
try {
 for(const language of ['mn','en']) {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(lang=>localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:lang,onboarded:true,current:'N4',target:'N1'}})),language);
  let empty=false;
  let mode="normal", release, apiWaiting;
  await page.route('**/api/admin/**',async route=>{
   const url=route.request().url();let data;
   if(mode==='loading') await new Promise(resolve=>{release=resolve;apiWaiting=true;});
    if(mode==='error') {await route.fulfill({status:500,json:{error:'fixture backend diagnostic'}});return;}
    if(mode==='unavailable') {await route.fulfill({status:404,contentType:'text/html',body:'The page could not be found'});return;}

   if(url.includes('/overview'))data={accounts:2,activeToday:1,reviewsToday:3,content:{vocab:4,kanji:5,grammar:6,listening:7,reading:8},queue:{pending:1,approved:0,rejected:0},top:mode==="populated"?[{word:"例",mn:"жишээ",misses:2}]:[],errors:mode==="populated"?["fixture QC diagnostic"]:[]};
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
  // Delayed and failed responses use the real shared loading/error/retry UI.
  for(const tab of ['overview','queue']) {
   mode='loading';apiWaiting=false;release=undefined;
   await page.goto(`${origin}/#/admin/${tab}`);
   await page.getByText(language==='en'?'Loading…':'Ачаалж байна…',{exact:true}).waitFor();
   // The loading label appears before the asynchronous request; wait for its capture.
   await page.waitForFunction(()=>true);
   const deadline=Date.now()+10000;
   while(!apiWaiting && Date.now()<deadline) await new Promise(resolve=>setImmediate(resolve));
   assert.ok(apiWaiting);mode='normal';release();
   await page.getByText(language==='en'?(tab==='overview'?'Content counts':'AI suggestion · awaiting review'):(tab==='overview'?'Агуулгын тоо':'Хиймэл оюуны санал · хяналт хүлээж буй'),{exact:true}).waitFor();
   mode='error';await page.reload();
   await page.getByText(language==='en'?'Failed to load':'Ачаалахад алдаа гарлаа',{exact:true}).waitFor();
   mode='normal';await page.getByRole('button',{name:language==='en'?'Try again':'Дахин оролдох',exact:true}).click();
   await page.getByText(language==='en'?(tab==='overview'?'Content counts':'AI suggestion · awaiting review'):(tab==='overview'?'Агуулгын тоо':'Хиймэл оюуны санал · хяналт хүлээж буй'),{exact:true}).waitFor();
   mode='unavailable';await page.reload();
   await page.getByText(language==='en'?'Admin service unavailable':'Админ үйлчилгээ холбогдоогүй байна',{exact:true}).waitFor();
   assert.ok(!(await page.locator('body').innerText()).includes('Unexpected token'));
   mode='normal';await page.getByRole('button',{name:language==='en'?'Retry':'Дахин оролдох',exact:true}).click();
   await page.getByText(language==='en'?(tab==='overview'?'Content counts':'AI suggestion · awaiting review'):(tab==='overview'?'Агуулгын тоо':'Хиймэл оюуны санал · хяналт хүлээж буй'),{exact:true}).waitFor();
  }
  mode='populated';await page.goto(`${origin}/#/admin/overview`);
  await page.getByText('MN: жишээ',{exact:true}).waitFor();
  await page.getByText(language==='en'?'Quality warnings':'QC анхааруулга',{exact:true}).waitFor();
  mode='normal';await page.goto(`${origin}/#/admin/import`);
  await page.getByRole('textbox',{name:language==='en'?'Content JSON':'Өгөгдлийн JSON'}).fill('{');
  await page.getByRole('button',{name:language==='en'?'Import':'Импортлох',exact:true}).click();
  await page.getByText(language==='en'?'Invalid JSON syntax':'JSON бичлэг буруу байна',{exact:true}).waitFor();
  mode='error';await area.fill('[{}]');await page.getByRole('button',{name:language==='en'?'Import':'Импортлох',exact:true}).click();
  await page.getByText(language==='en'?'Failed to load':'Ачаалахад алдаа гарлаа',{exact:true}).waitFor();
  mode='loading';apiWaiting=false;release=undefined;
  await page.getByRole('button',{name:language==='en'?'Import':'Импортлох',exact:true}).click();
  await page.getByRole('button',{name:language==='en'?'Submitting…':'Илгээж байна…',exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:language==='en'?'Submitting…':'Илгээж байна…',exact:true}).isDisabled());
  const deadline=Date.now()+10000;
  while(!apiWaiting && Date.now()<deadline) await new Promise(resolve=>setImmediate(resolve));
  assert.ok(apiWaiting);mode='normal';release();
  await page.getByText(language==='en'?'Added: 1 · Skipped: 0. All records are awaiting review.':'Нэмэгдсэн: 1 · Алгассан: 0. Бүх мөр хяналт хүлээж буй төлөвөөр орсон.',{exact:true}).waitFor();
  // Shared widget defaults also follow the selected language outside Admin.
  let metaRelease;
  await page.route('**/data/index/meta.json',async route=>{
   if(mode==='meta-loading') await new Promise(resolve=>{metaRelease=resolve;});
   if(mode==='meta-error') {await route.fulfill({status:500,body:'fixture data error'});return;}
   await route.continue();
  });
  mode='meta-loading';await page.goto(`${origin}/#/about`);await page.reload();
  await page.getByText(language==='en'?'Loading…':'Ачаалж байна…',{exact:true}).first().waitFor();
  const metaDeadline=Date.now()+10000;
  while(!metaRelease && Date.now()<metaDeadline) await new Promise(resolve=>setImmediate(resolve));
  assert.ok(metaRelease);mode='normal';metaRelease();
  const sources=JSON.parse(fs.readFileSync('public/data/index/meta.json')).sources;
  for(const source of sources) {
   await page.getByText(language==='mn'?source.note:source.note_en,{exact:true}).waitFor();
  }
  await page.getByText('CC-BY-SA-3.0 (bundled dictionaries); MIT (package)',{exact:false}).waitFor();
  console.log(`About ${language}: all ${sources.length} source descriptions and pinned dictionary attribution passed (real static metadata).`);
  mode='meta-error';await page.reload();
  await page.getByText(language==='en'?'Failed to load':'Ачаалахад алдаа гарлаа',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);await page.close();console.log(`Admin ${language}: overview/queue loading/error/retry/empty/populated, import validation/error/busy/success passed (mock API).`);
 }
}finally{await browser.close();server?.kill();}
