import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerProvider,createTemplateAdapter,CAPABILITIES} from '../src/adapters/provider.js';
import {mergeStoryPlan,createProjectConfig} from '../src/authoring/index.js';
const response=output=>({ok:true,status:200,json:async()=>({output})});
test('server provider routes legacy and prose-first actions through same-origin without credentials',async()=>{
 const calls=[];const outputs={interview:{questions:[{key:'tone',title:'你希望是什么情绪？'}]},planStory:createProjectConfig({idea:'海上的城堡'}),generateChapter:{text:'新的章节',staging:[]},interpretRevision:{suggestedFacts:[],questions:[]},reviewChapter:{issues:[]},generateProse:{text:'新的章节',chapterId:'chapter-1'},extractMemory:{staging:[],reviewNotes:[]}};
 const provider=createServerProvider({fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,options,body});return response(outputs[body.action]);}});
 for(const action of CAPABILITIES){const result=await provider[action]({input:{idea:'海上的城堡'},context:{stateVersion:8}});assert.ok(result);}
 assert.equal(calls.length,7);assert.ok(calls.every(c=>c.url==='/api/agent'));
 assert.deepEqual(calls.map(c=>c.body.action),CAPABILITIES);
 assert.equal(calls[0].body.input.input.idea,'海上的城堡');assert.ok(calls.every(c=>!c.options.headers.Authorization));
});
test('generation always remains candidate and retains runtime version',async()=>{
 const provider=createServerProvider({fetchImpl:async()=>response({text:'章节',status:'accepted',baseVersion:999,provider:{id:'openai-compatible',model:'configured-test-model'}})});
 const result=await provider.generateChapter({context:{stateVersion:8}});
 assert.equal(result.status,'candidate');assert.equal(result.baseVersion,8);assert.equal(result.provider.isLive,true);assert.equal(result.provider.model,'configured-test-model');
});
test('unavailable server errors reject without silent template output',async()=>{
 let calls=0;
 const provider=createServerProvider({fetchImpl:async()=>{calls++;return {ok:false,status:503,json:async()=>({error:{message:'未配置服务端模型'}})};}});
 await assert.rejects(provider.interview({input:{idea:'故事'}}),/未配置/);assert.equal(calls,1);
 const malformed=createServerProvider({fetchImpl:async()=>response({text:''})});
 await assert.rejects(malformed.generateChapter({}),/正文/);
 const wrongSchema=createServerProvider({fetchImpl:async()=>response({questions:[{key:'constructor',title:'bad'}]})});
 await assert.rejects(wrongSchema.interview({}),/格式/);
 assert.throws(()=>createServerProvider({baseUrl:'https://untrusted.example'}),/同源/);
});
test('status can be checked without requesting model output',async()=>{
 const provider=createServerProvider({fetchImpl:async(url,options)=>{assert.equal(url,'/api/status');assert.equal(options.method,'GET');return {ok:true,status:200,json:async()=>({configured:false,model:null})};}});
 assert.equal((await provider.getStatus()).configured,false);
});
test('story plan retains explicit author inputs and marks new model facts as proposals',()=>{
 const input={projectId:'chosen-id',idea:'我的故事',title:'我的书名',protagonist:'阿岚',tone:'温暖',pov:'第一人称'};
 const output=createProjectConfig({idea:'模型的故事',protagonist:'另一个名字',tone:'悲伤',goal:'找到出口'});
 const merged=mergeStoryPlan(input,output,{id:'server-model',label:'服务端模型',isLive:true});
 assert.equal(merged.idea,input.idea);assert.equal(merged.title,input.title);assert.equal(merged.projectId,input.projectId);
 assert.equal(merged.protagonist,'阿岚');assert.equal(merged.goal,'找到出口');assert.equal(merged.provider,'server-model');
 assert.equal(merged.contract.fields.find(f=>f.key==='protagonist').value,'阿岚');
 assert.equal(merged.contract.fields.find(f=>f.key==='desire').status,'proposed');
 assert.equal(merged.contract.provenance.isLive,true);
});
test('template adapter continues to support the same workflow',async()=>{
 const provider=createTemplateAdapter();const input={idea:'海上的城堡'};
 assert.equal((await provider.interview({input})).questions.length,2);
 const plan=await provider.planStory({input});assert.equal(plan.outline.length,3);
 assert.equal((await provider.generateChapter({project:plan})).provider.isLive,false);
});

test('all actions support external cancellation, including an uncooperative transport',async()=>{
 for(const action of CAPABILITIES){
  const external=new AbortController();let upstream;
  const provider=createServerProvider({fetchImpl:async(_url,options)=>{upstream=options.signal;return new Promise(()=>{});}});
  const pending=provider[action]({}, {signal:external.signal});external.abort('PRIVATE cancellation reason');
  await assert.rejects(pending,error=>error.name==='AbortError'&&error.code==='REQUEST_CANCELLED'&&!error.message.includes('PRIVATE'));
  assert.equal(upstream.aborted,true);
 }
});
test('pre-cancelled requests skip fetch; transport and body deadlines reject as timeout',async()=>{
 const external=new AbortController();external.abort();let calls=0;
 const provider=createServerProvider({fetchImpl:async()=>{calls++;return response({questions:[]});}});
 await assert.rejects(provider.interview({}, {signal:external.signal}),{name:'AbortError',code:'REQUEST_CANCELLED'});assert.equal(calls,0);
 for(const fetchImpl of [async()=>new Promise(()=>{}),async()=>({ok:true,status:200,json:async()=>new Promise(()=>{})})]){
  const timed=createServerProvider({timeoutMs:5,fetchImpl});await assert.rejects(timed.interview({}),{name:'TimeoutError',code:'UPSTREAM_TIMEOUT'});
 }
});
test('late cancelled response cannot cancel or replace a newer request; listeners are removed',async()=>{
 const {getEventListeners}=await import('node:events');const requests=[];
 const provider=createServerProvider({fetchImpl:(_url,options)=>new Promise(resolve=>requests.push({resolve,signal:options.signal}))});
 const older=new AbortController(),newer=new AbortController();
 const a=provider.interview({}, {signal:older.signal});older.abort();await assert.rejects(a,{code:'REQUEST_CANCELLED'});
 const b=provider.interview({}, {signal:newer.signal});requests[0].resolve(response({questions:[{key:'old',title:'old'}]}));
 assert.equal(requests[1].signal.aborted,false);requests[1].resolve(response({questions:[]}));assert.deepEqual(await b,{questions:[]});
 assert.equal(getEventListeners(older.signal,'abort').length,0);assert.equal(getEventListeners(newer.signal,'abort').length,0);
 newer.abort();assert.equal(requests[1].signal.aborted,false);
});
test('provider-reported usage survives success without synthesizing absent counters',async()=>{
 const usage={promptTokens:0,completionTokens:12};const provider=createServerProvider({fetchImpl:async()=>response({text:'章节',provider:{usage}})});
 assert.deepEqual((await provider.generateChapter({})).provider.usage,usage);
 const absent=createServerProvider({fetchImpl:async()=>response({text:'章节'})});assert.equal(Object.hasOwn((await absent.generateChapter({})).provider,'usage'),false);
});
