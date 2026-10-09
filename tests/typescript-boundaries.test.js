import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerProvider, validateActionOutput} from '../src/adapters/provider.js';
import {mergeStoryPlan} from '../src/authoring/index.js';
import {createAgentService, validateInput} from '../server/provider.js';

const reply=output=>new Response(JSON.stringify({output}));
const proposal=()=>({
 contract:{schemaVersion:{legacy:true},status:42,fields:[{key:'protagonist',label:'主角',value:'林夏',status:{untrusted:true},source:42}]},
 outline:[{id:42,title:'第一章',goal:'寻找灯塔',exitState:{legacy:true},description:false},{id:'chapter-2',title:'第二章',goal:'验证线索',exitState:'获得线索'},{title:'第三章',goal:'作出选择'}],
 provider:{id:42,label:{untrusted:true}},
});

test('browser boundary preserves optional interview and plan metadata as untrusted data',()=>{
 const interview={questions:[{key:'tone',title:'选择情绪',hint:42,placeholder:{legacy:true},importance:'high',options:['克制']}]};
 assert.strictEqual(validateActionOutput('interview',interview),interview);
 const plan=proposal();
 assert.strictEqual(validateActionOutput('planStory',plan),plan);
 assert.equal(plan.outline[0].id,42);
});

test('legacy chapter accepts text-only contract while prose endpoints require string identity',()=>{
 const legacy={text:'正文',chapterId:42,provider:'legacy-provider',reviewNotes:false};
 assert.strictEqual(validateActionOutput('generateChapter',legacy),legacy);
 assert.throws(()=>validateActionOutput('generateProse',legacy),/完整正文/);
 const input={text:'正文',instruction:'修改',chapterId:'chapter-1',context:{projectId:'p',version:1,sources:[]}};
 assert.throws(()=>validateActionOutput('reviseProse',{text:'修改正文',chapterId:42},input),/完整正文/);
 assert.equal(validateActionOutput('reviseProse',{text:'修改正文',chapterId:'chapter-1'},input).chapterId,'chapter-1');
});

test('unvalidated provider and status properties preserve legacy values without acquiring trusted types',async()=>{
 const provider=createServerProvider({fetchImpl:async()=>reply({text:'正文',chapterId:'chapter-1',provider:{id:42,label:false,model:{legacy:true}}})});
 const result=await provider.generateProse({});
 assert.equal(result.provider.id,42);
 assert.equal(result.provider.isLive,true);
 const status={configured:true,liveEnabled:'legacy',callsUsed:'unknown',maxCalls:false,model:{legacy:true}};
 const statusProvider=createServerProvider({fetchImpl:async()=>new Response(JSON.stringify(status))});
 assert.deepEqual(await statusProvider.getStatus(),status);
});

test('revision interpretations do not require both alternatives to be arrays',()=>{
 const operations={operations:[],suggestedFacts:42,questions:[]};
 const facts={operations:42,suggestedFacts:[],questions:[]};
 assert.strictEqual(validateActionOutput('interpretRevision',operations),operations);
 assert.strictEqual(validateActionOutput('interpretRevision',facts),facts);
 assert.throws(()=>validateActionOutput('interpretRevision',{operations:42,suggestedFacts:42,questions:[]}),/格式/);
});

test('planning merge normalizes saved string fields and retains other unknown metadata',()=>{
 const plan=proposal(),merged=mergeStoryPlan({idea:'灯塔' },plan,{id:'server-model',label:'模型',isLive:true});
 assert.equal(merged.outline[0].id,'chapter-1');
 assert.equal(Object.hasOwn(merged.outline[0],'exitState'),false);
 assert.equal(Object.hasOwn(merged.outline[0],'description'),false);
 assert.equal(merged.outline[1].exitState,'获得线索');
 assert.equal(merged.contract.fields[0].status,'proposed');
 assert.equal(merged.contract.fields[0].source,'server-model');
 assert.deepEqual(merged.contract.schemaVersion,{legacy:true});
 assert.equal(merged.providerMetadata.id,42);
 assert.equal(plan.outline[0].id,42);
});

test('server validates only the selected generation outline entry and retains unrelated legacy entries',async()=>{
 const input={project:{projectId:'p',idea:'灯塔',outline:[{id:'chapter-1'},42]},chapterIndex:0,context:{projectId:'p',version:0,sources:[]}};
 assert.strictEqual(validateInput('generateProse',input),input);
 assert.equal(input.project.outline[1],42);
 assert.throws(()=>validateInput('generateProse',{...input,chapterIndex:1}),{code:'INVALID_INPUT'});
 const env={NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_API_BASE_URL:'https://example.test/v1/',NEXUS_API_MODEL:'test-model',NEXUS_API_KEY:'offline-fixture-key'};
 let prompt;
 const service=createAgentService({env,fetchImpl:async(_url,options)=>{prompt=JSON.parse(JSON.parse(options.body).messages[1].content);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'正文'}}]}));}});
 const result=await service.run('generateProse',input);
 assert.equal(result.chapterId,'chapter-1');
 assert.equal(prompt.input.chapterId,'chapter-1');
 assert.equal(prompt.input.project.outline[1],42);
});

test('default browser transport resolves fetch at invocation instead of adapter creation',async()=>{
 const originalFetch=globalThis.fetch;
 let called=false;
 try {
  const provider=createServerProvider();
  globalThis.fetch=async()=>{called=true;return reply({questions:[]});};
  assert.deepEqual(await provider.interview({input:{idea:'灯塔'}}),{questions:[]});
  assert.equal(called,true);
 }finally{globalThis.fetch=originalFetch;}
});

test('planning field names cannot overwrite structural metadata or use inherited author-input mappings',()=>{
 const plan=proposal();
 plan.contract.fields=['fields','status','schemaVersion','provenance','toString'].map(key=>({key,label:key,value:'模型提出的值'}));
 const checked=validateActionOutput('planStory',plan);
 const merged=mergeStoryPlan({idea:'灯塔'},checked,{id:'server-model',label:'模型',isLive:true});
 assert.equal(merged.contract.fields.length,5);
 assert.deepEqual(merged.contract.fields.map(field=>field.key),['fields','status','schemaVersion','provenance','toString']);
 assert.ok(merged.contract.fields.every(field=>field.value==='模型提出的值'));
 assert.equal(merged.contract.status,'proposal');
 assert.deepEqual(merged.contract.schemaVersion,{legacy:true});
 assert.equal(typeof merged.contract.provenance,'object');
 assert.equal(merged.idea,'灯塔');
 assert.equal(Object.keys(merged).some(key=>key.startsWith('function ')),false);
});
