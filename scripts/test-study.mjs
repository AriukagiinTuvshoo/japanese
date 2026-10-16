import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const modules=new Map();
function load(path){
 if(modules.has(path))return modules.get(path);
 if(path.endsWith('.json'))return `data:text/javascript;base64,${Buffer.from('export default '+fs.readFileSync(path,'utf8')).toString('base64')}`;
 let js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 js=js.replace(/from ["'](\.[^"']+)["']/g,(_,ref)=>`from "${load(new URL(ref+(ref.endsWith('.json')?'':'.ts'),'file://'+process.cwd()+'/'+path).pathname.slice(process.cwd().length+1))}"`);
 const url=`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;modules.set(path,url);return url;
}
const {buildQuiz,buildExam,buildJapanesePractice,scoreExam,EXAM_BLUEPRINTS,presentQuestion}=await import(load('src/lib/study.ts'));
const levels=['N5','N4','N3','N2','N1'];
const data=Object.fromEntries(['vocab','kanji','grammar'].map(kind=>[kind,levels.flatMap(l=>JSON.parse(fs.readFileSync(`public/data/${kind}/${l.toLowerCase()}.json`)))]));
const normalize=s=>s.normalize('NFKC').replace(/\s/g,'');
for(const level of levels)for(const lang of ['mn','en']){
 for(const mode of ['mixed','vocab-read','kanji-read','grammar-mn','grammar-use']){
 const {questions}=buildQuiz({level,lang,mode,count:12},data);assert.equal(questions.length,12,`${level}/${lang}/${mode}`);
 if(mode==='mixed')assert.equal(new Set(questions.map(q=>q.id.split('-').slice(0,-1).join('-'))).size>=5,true);
 for(const q of questions){assert.equal(q.level,level);assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<4);
 for(const language of ['mn','en']){const shown=presentQuestion(q,language);assert.equal(shown.answer,q.answer);assert.equal(shown.id,q.id);assert.equal(new Set(shown.options.map(normalize)).size,4);if(language==='en')assert.ok(!/[А-Яа-яӨөҮү]/.test(shown.explain||''));}
 }
 }
 const bp=EXAM_BLUEPRINTS[level],built=buildExam(bp,data,lang);assert.ok(built.some(s=>s.questions.length!==s.section.count));
 const practice=buildJapanesePractice(level,15,data,lang);assert.equal(practice.questions.length,15);
 for(const q of practice.questions)assert.ok(!/[A-Za-zА-Яа-яӨөҮү]/.test(q.prompt+q.options.join('')),'Japanese-only practice');
 const results=bp.sections.map(section=>({section,correct:section.count,total:section.count}));
 assert.equal(scoreExam(bp,results,1).passed,true);assert.equal(scoreExam(bp,results.slice(1),1).max,180);assert.equal(scoreExam(bp,results.slice(1),1).passed,false);
 assert.equal(scoreExam(bp,results.map(r=>({...r,total:1,correct:1})),1).passed,false);
 assert.equal(scoreExam(bp,results.map(()=>results[0]),1).passed,false);
 assert.equal(scoreExam(bp,results.map(r=>({...r,correct:r.total+1})),1).passed,false);
 console.log(`${level}/${lang}: stable bilingual keys, unique options, mixed quotas, Japanese drills, full-exam block and scoring checks passed`);
}
assert.equal(buildQuiz({level:'N1',mode:'vocab-read',count:10,restrictIds:['not-real']},data).questions.length,0);
console.log('No out-of-scope restriction fallback.');
