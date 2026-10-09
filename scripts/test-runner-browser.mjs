// Isolated real React runner, not an authentication/backend test. App dist is untouched.
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';
import {createServer} from 'vite';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const fixture=`import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StoreProvider,useStore} from '/src/lib/store.tsx';
import {QuizRunner} from '/src/components/QuizRunner.tsx';
const questions=[{id:'test',kind:'grammar',level:'N5',prompt:'これは本です。',options:['本','車','家','雨'],answer:1,section:'Дүрэм',presentation:{mn:{prompt:'これは本です。',options:['本','車','家','雨'],section:'Дүрэм',promptSub:'Монгол заавар',explain:'Монгол тайлбар'},en:{prompt:'これは本です。',options:['本','車','家','雨'],section:'Grammar',promptSub:'English directions',explain:'English explanation'}}}];
function Test(){const {doc,actions}=useStore();const [finishes,setFinishes]=useState(0);return <><button onClick={()=>actions.patchProfile({language:doc.profile.language==='en'?'mn':'en'})}>Toggle language</button><input aria-label="Typing guard"/><output id="finishes">{finishes}</output><output id="logs">{doc.quizzes.length}</output><QuizRunner questions={questions} options={{timed:0.5,reveal:false,onFinish:()=>setFinishes(x=>x+1)}}/></>}
createRoot(document.getElementById('root')).render(<StoreProvider><Test/></StoreProvider>);`;
const server=await createServer({server:{host:'0.0.0.0',port:4179,strictPort:true},plugins:[{name:'runner-fixture',configureServer(server){server.middlewares.use('/__runner',async (_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__runner','<div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/runner-fixture.jsx"></script>'))})},resolveId(id){if(id==='/runner-fixture.jsx')return '\0runner-fixture.jsx'},load(id){if(id==='\0runner-fixture.jsx')return ts.transpileModule(fixture,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText}}]});
let browser;
try {
 await server.listen();
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,LD_LIBRARY_PATH:`${path.resolve('.cache/browser-libs/lib')}:${process.env.LD_LIBRARY_PATH??''}`}});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
 await page.addInitScript(()=>localStorage.setItem('nd:doc:local',JSON.stringify({profile:{language:'mn',onboarded:true}})));
 await page.clock.install();
 await page.goto('http://127.0.0.1:4179/__runner');
 await page.getByText('Монгол заавар',{exact:true}).waitFor();
 await page.getByRole('textbox').fill('1234');
 const choices=page.locator('.card.mt-5 .space-y-2\\.5 > button');
 assert.ok(!await choices.first().isDisabled(),'typing in input must not answer');
 await choices.first().click();
 const classes=await choices.evaluateAll(nodes=>nodes.map(n=>n.className));
 assert.equal(classes[1],classes[2],'hidden correct option must look the same as other unpicked options');
 await page.getByRole('button',{name:'Toggle language',exact:true}).click();
 await page.getByText('English directions',{exact:true}).waitFor();
 assert.ok(await choices.first().isDisabled(),'selected answer survives language switch');
 await page.clock.fastForward(31000);
 await page.locator('#finishes').filter({hasText:'1'}).waitFor({timeout:12000});
 assert.equal(await page.locator('#finishes').textContent(),'1');assert.equal(await page.locator('#logs').textContent(),'1');
 await page.getByRole('button',{name:'Toggle language',exact:true}).click();
 assert.equal(await page.locator('#finishes').textContent(),'1');
 const retry=page.getByRole('button').filter({hasText:'Дахин'});await retry.first().click();
 await page.getByText('Монгол заавар',{exact:true}).waitFor();
 assert.ok(!await choices.first().isDisabled(),'retry resets answer state');
 await page.clock.fastForward(31000);
 await page.locator('#finishes').filter({hasText:'2'}).waitFor({timeout:12000});
 assert.equal(await page.locator('#logs').textContent(),'2');
 assert.deepEqual(errors,[]);console.log('Real React runner: keyboard focus guard, hidden-answer styling, live language state, timeout exactly-once callback/log and retry passed.');
} finally {await browser?.close();await server.close();}
