import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentService,normalizeProse,normalizeMemoryExtraction,validateInput,validateOutput,SAFE_VALIDATION_REASONS} from '../server/provider.js';
import {createServerProvider,createTemplateAdapter} from '../src/adapters/provider.js';
import {createProjectConfig} from '../src/authoring/index.js';
import {segmentProse} from '../src/domain/prose.js';

const env={NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_API_BASE_URL:'https://example.test/v1',NEXUS_API_MODEL:'test-model',NEXUS_API_KEY:'offline-only-secret'};
const context={projectId:'prose-project',version:2,sources:[{chapterId:'ch2',revision:1,text:'旧稿，仅供上下文参考。'}]};
const generation={project:{projectId:context.projectId,idea:'纸灯照见未写完的航线',outline:[{id:'chapter-1'},{id:'chapter-2'}]},chapterIndex:1,context};
const raw='\n  小舟举起🪔，  风没有停。\r\n\r\n\t“等潮水。”她说。 \n \t\n  小舟举起🪔，  风没有停。\r\n';
const extraction={text:raw,chapterId:'ch2',context};
const memory={staging:[{label:'小舟等待潮水',sourceParagraphIndex:1}],reviewNotes:['对话仍需作者判断']};
const envelope=(content,{finishReason='stop',usage,...extra}={})=>new Response(JSON.stringify({...extra,...(usage?{usage}:{}),choices:[{finish_reason:finishReason,message:{content}}]}));
const reply=out=>envelope(JSON.stringify(out));
const clientReply=output=>({ok:true,status:200,json:async()=>({output})});
const invalid=(fn,reason)=>assert.throws(fn,error=>error.code==='INVALID_MODEL_OUTPUT'&&error.validationReason===reason&&SAFE_VALIDATION_REASONS.includes(reason));

test('raw multiline prose succeeds unchanged without JSON, model chapter ID, staging, or review notes',async()=>{
 let request;
 const service=createAgentService({env,fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return envelope(raw);}});
 const inputSnapshot=structuredClone(generation);
 const result=await service.run('generateProse',generation);
 assert.equal(result.text,raw);assert.equal(result.chapterId,'chapter-2');assert.equal(result.provider.isLive,true);
 assert.deepEqual(Object.keys(result).sort(),['chapterId','provider','text']);assert.deepEqual(generation,inputSnapshot);
 const prompt=request.messages[0].content;
 assert.match(prompt,/complete chapter prose as plain text/);assert.doesNotMatch(prompt,/Return ONLY a JSON object/);
 assert.equal(JSON.parse(request.messages[1].content).input.chapterId,'chapter-2');
 assert.equal(request.max_tokens,1200);assert.equal(request.headers,undefined);
});

test('JSON-looking content and literal fences remain raw prose, never guessed or normalized',async()=>{
 for(const text of [' {"text":"characters wrote this","chapterId":"forged","staging":[]} \r\n','```json\n{"a":1}\n```','["letter one","letter two"]']){
  const service=createAgentService({env,fetchImpl:async()=>envelope(text)});
  const result=await service.run('generateProse',generation);
  assert.equal(result.text,text);assert.equal(result.chapterId,'chapter-2');
 }
});

test('prose validates nonblank content and the 30000 UTF-16 code-unit boundary only',()=>{
 for(const text of [null,undefined,{},[],0,'',' \r\n\t','x'.repeat(30001),'🪔'.repeat(15001)])invalid(()=>normalizeProse(text,generation),'PROSE_TEXT');
 for(const text of ['x'.repeat(30000),'🪔'.repeat(15000),raw])assert.equal(normalizeProse(text,generation).text,text);
 invalid(()=>validateOutput('generateProse',{text:raw,chapterId:'chapter-2',staging:[]},generation),'PROSE_FIELDS');
 invalid(()=>validateOutput('generateProse',{text:raw,chapterId:'ch2'},generation),'CHAPTER_ID_MISMATCH');
});

test('new actions validate target, context, and confirmed fact identity before network access',async()=>{
 let calls=0;const service=createAgentService({env,fetchImpl:async()=>{calls++;return envelope(raw);}});
 const badInputs=[
  ['generateProse',{...generation,chapterId:'wrong'}],
  ['generateProse',{...generation,chapterIndex:2}],
  ['generateProse',{...generation,context:{...context,projectId:'wrong'}}],
  ['extractMemory',{...extraction,chapterId:''}],
  ['extractMemory',{...extraction,context:{...context,version:0}}],
  ['extractMemory',{...extraction,text:' '.repeat(3)}],
  ['extractMemory',{...extraction,text:'x'.repeat(30001)}],
  ['extractMemory',{...extraction,paragraphs:segmentProse(raw)}],
  ['extractMemory',{...extraction,context:{...context,facts:{}}}],
  ['extractMemory',{...extraction,context:{...context,facts:[{id:'f',status:'confirmed',authority:'explicit_author_decision',recordVersion:0}]}}]
 ];
 for(const [action,input] of badInputs)await assert.rejects(service.run(action,input),{code:'INVALID_INPUT'});
 assert.equal(calls,0);
 assert.equal(validateInput('generateProse',{...generation,context:{...context,version:0,sources:[]}}).context.version,0);
 assert.strictEqual(validateInput('extractMemory',extraction),extraction);
 // Saved generation targets use outline IDs, which need not match legacy source IDs.
 assert.equal(validateInput('extractMemory',{...extraction,chapterId:'chapter-2'}).chapterId,'chapter-2');
 assert.throws(()=>validateInput('reviewChapter',{...extraction,chapterId:'chapter-2'}),{code:'INVALID_INPUT'});
});

test('extraction sends deterministic index/offset-labeled paragraphs and derives exact saved evidence',async()=>{
 let request;const snapshot=structuredClone(extraction);
 const service=createAgentService({env,fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return reply(memory);}});
 const result=await service.run('extractMemory',extraction);
 const paragraphs=segmentProse(raw),source=paragraphs[1];
 assert.deepEqual(result.staging,[{...memory.staging[0],sourceQuote:source.text,sourceStart:source.start,sourceEnd:source.end}]);
 assert.equal(raw.slice(result.staging[0].sourceStart,result.staging[0].sourceEnd),source.text);
 assert.deepEqual(result.reviewNotes,memory.reviewNotes);assert.deepEqual(extraction,snapshot);
 const input=JSON.parse(request.messages[1].content).input;
 assert.deepEqual(input,{chapterId:'ch2',context,paragraphs});assert.equal(Object.hasOwn(input,'text'),false);
 for(const phrase of ['sourceParagraphIndex','JavaScript UTF-16','Do not return sourceQuote','untrusted story data','author review'])assert.ok(request.messages[0].content.includes(phrase),phrase);
});

test('repeated paragraphs retain the selected occurrence and full-length paragraphs remain extractable',()=>{
 const paragraphs=segmentProse(raw);
 const result=normalizeMemoryExtraction({staging:[{label:'再次举灯',sourceParagraphIndex:2}],reviewNotes:[]},extraction);
 assert.equal(result.staging[0].sourceQuote,paragraphs[0].text);
 assert.equal(result.staging[0].sourceStart,paragraphs[2].start);assert.notEqual(result.staging[0].sourceStart,paragraphs[0].start);
 const text='🪔'.repeat(15000),single={...extraction,text};
 const long=normalizeMemoryExtraction({staging:[{label:'正文',sourceParagraphIndex:0}],reviewNotes:[]},single).staging[0];
 assert.equal(long.sourceQuote,text);assert.equal(long.sourceStart,0);assert.equal(long.sourceEnd,30000);
});

test('memory extraction rejects malformed, forged, out-of-range, and unsupported wire fields',()=>{
 const base={staging:[{label:'等待潮水',sourceParagraphIndex:1}],reviewNotes:[]};
 const cases=[
  [null,'MEMORY_FIELDS'],[{},'STAGING_REFERENCE_SCHEMA'],
  [{...base,text:raw},'MEMORY_FIELDS'],[{...base,chapterId:'ch2'},'MEMORY_FIELDS'],
  [{...base,provider:{}},'MEMORY_FIELDS'],[{...base,staging:null},'STAGING_REFERENCE_SCHEMA'],
  ...['1',1.2,null,undefined,Number.MAX_SAFE_INTEGER+1].map(sourceParagraphIndex=>[{...base,staging:[{label:'等待',sourceParagraphIndex}]},'STAGING_REFERENCE_SCHEMA']),
  ...[-1,3,Number.MAX_SAFE_INTEGER].map(sourceParagraphIndex=>[{...base,staging:[{label:'等待',sourceParagraphIndex}]},'STAGING_REFERENCE_RANGE']),
  ...['sourceQuote','sourceStart','sourceEnd','id'].map(key=>[{...base,staging:[{...base.staging[0],[key]:'forged'}]},'STAGING_REFERENCE_SCHEMA']),
  [{...base,staging:[{label:' ',sourceParagraphIndex:0}]},'STAGING_REFERENCE_SCHEMA'],
  [{...base,staging:[{label:'x'.repeat(1001),sourceParagraphIndex:0}]},'STAGING_REFERENCE_SCHEMA'],
  [{...base,reviewNotes:null},'REVIEW_NOTES_SCHEMA'],[{...base,reviewNotes:['']},'REVIEW_NOTES_SCHEMA']
 ];
 for(const [wire,reason] of cases)invalid(()=>normalizeMemoryExtraction(wire,extraction),reason);
 const canonical=normalizeMemoryExtraction(base,extraction);
 for(const change of [{sourceQuote:'伪造证据'},{sourceStart:0},{sourceEnd:1},{sourceParagraphIndex:0}])invalid(()=>validateOutput('extractMemory',{...canonical,staging:[{...canonical.staging[0],...change}]},extraction),'STAGING_REFERENCE_MISMATCH');
});

test('prose and memory extraction preserve independent provider-reported usage without synthesis',async()=>{
 let calls=0;
 const service=createAgentService({env,fetchImpl:async()=>++calls===1?envelope(raw,{usage:{prompt_tokens:0,completion_tokens:40}}):envelope(JSON.stringify(memory),{usage:{total_tokens:55,completion_tokens_details:{reasoning_tokens:2}}})});
 const prose=await service.run('generateProse',generation),memoryResult=await service.run('extractMemory',extraction);
 assert.deepEqual(prose.provider.usage,{promptTokens:0,completionTokens:40});
 assert.deepEqual(memoryResult.provider.usage,{totalTokens:55,reasoningTokens:2});
 assert.equal(service.status().callsUsed,2);
 for(const action of ['generateProse','extractMemory']){
  const absent=createAgentService({env,fetchImpl:async()=>action==='generateProse'?envelope(raw):reply(memory)});
  assert.equal(Object.hasOwn((await absent.run(action,action==='generateProse'?generation:extraction)).provider,'usage'),false);
 }
});

test('raw and extraction truncation, provider failures, and incomplete finish states cannot succeed',async()=>{
 for(const action of ['generateProse','extractMemory']){
  const input=action==='generateProse'?generation:extraction,content=action==='generateProse'?raw:JSON.stringify(memory);
  const truncated=createAgentService({env,fetchImpl:async()=>envelope(content,{finishReason:'length',usage:{completion_tokens:12}})});
  await assert.rejects(truncated.run(action,input),error=>error.code==='OUTPUT_TRUNCATED'&&error.diagnostics.completionTokens===12&&!JSON.stringify(error).includes(raw));
  for(const finishReason of ['content_filter','tool_calls','cancelled',null]){
   const service=createAgentService({env,fetchImpl:async()=>envelope(content,{finishReason})});
   await assert.rejects(service.run(action,input),{code:'UPSTREAM_ERROR'});
  }
  for(const fetchImpl of [async()=>{throw Error('PRIVATE');},async()=>new Response('PRIVATE',{status:500}),async()=>envelope(content,{error:{message:'PRIVATE'}}),async()=>new Response('{invalid'),async()=>new Response('x'.repeat(130*1024))]){
   const service=createAgentService({env,fetchImpl});
   await assert.rejects(service.run(action,input),error=>error.code==='UPSTREAM_ERROR'&&!error.message.includes('PRIVATE'));
  }
 }
});

test('new actions preserve cancellation/deadline behavior without accepting partial or late content',async()=>{
 for(const action of ['generateProse','extractMemory']){
  const input=action==='generateProse'?generation:extraction,snapshot=structuredClone(input);
  const controller=new AbortController();let upstream,resolve;
  const service=createAgentService({env,fetchImpl:async(_url,options)=>{upstream=options.signal;return new Promise(done=>{resolve=done});}});
  const pending=service.run(action,input,{signal:controller.signal});controller.abort('PRIVATE');
  await assert.rejects(pending,error=>error.code==='REQUEST_CANCELLED'&&!error.message.includes('PRIVATE'));
  assert.equal(upstream.aborted,true);assert.equal(service.status().callsUsed,1);
  resolve(action==='generateProse'?envelope(raw):reply(memory));assert.deepEqual(input,snapshot);
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(service.run(action,input,{signal:cancelled.signal}),{code:'REQUEST_CANCELLED'});assert.equal(service.status().callsUsed,1);
  const timed=createAgentService({env,timeoutMs:5,fetchImpl:async()=>new Promise(()=>{})});
  await assert.rejects(timed.run(action,input),{code:'UPSTREAM_TIMEOUT'});
 }
});

test('browser prose-first methods keep raw content and independent metadata while enforcing saved-text anchors',async()=>{
 const canonical=normalizeMemoryExtraction(memory,extraction),calls=[];
 const outputs={generateProse:{text:raw,chapterId:'chapter-2',provider:{usage:{completionTokens:10}}},extractMemory:{...canonical,provider:{usage:{completionTokens:3}}}};
 const provider=createServerProvider({fetchImpl:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return clientReply(outputs[body.action]);}});
 const prose=await provider.generateProse(generation),result=await provider.extractMemory(extraction);
 assert.equal(prose.text,raw);assert.equal(prose.chapterId,'chapter-2');assert.equal(prose.provider.isLive,true);assert.deepEqual(prose.provider.usage,{completionTokens:10});
 assert.deepEqual(result.staging,canonical.staging);assert.deepEqual(result.provider.usage,{completionTokens:3});
 assert.deepEqual(calls,[{action:'generateProse',input:generation},{action:'extractMemory',input:extraction}]);
 for(const change of [{sourceQuote:'forged'},{sourceStart:0},{sourceParagraphIndex:0}]){
  const malformed=createServerProvider({fetchImpl:async()=>clientReply({...canonical,staging:[{...canonical.staging[0],...change}]})});
  await assert.rejects(malformed.extractMemory(extraction),/定位无效/);
 }
 const wrongChapter=createServerProvider({fetchImpl:async()=>clientReply({text:raw,chapterId:'ch2'})});
 await assert.rejects(wrongChapter.generateProse(generation),/完整正文/);
});

test('browser deadline wording preserves previously saved prose',async()=>{
 for(const action of ['generateProse','extractMemory']){
  const provider=createServerProvider({timeoutMs:5,fetchImpl:async()=>new Promise(()=>{})});
  await assert.rejects(provider[action](action==='generateProse'?generation:extraction),error=>error.code==='UPSTREAM_TIMEOUT'&&error.message.includes('已保存的正文保持不变')&&!error.message.includes('没有生成或接受任何章节'));
 }
});

test('template prose remains explicitly offline and performs no semantic memory extraction',async()=>{
 const template=createTemplateAdapter(),project=createProjectConfig({idea:'纸灯照见航线'});
 const prose=await template.generateProse({project,chapterIndex:0});
 assert.equal(typeof prose.text,'string');assert.equal(prose.chapterId,project.outline[0].id);assert.equal(prose.provider.isLive,false);assert.equal(Object.hasOwn(prose,'staging'),false);
 const result=await template.extractMemory({text:prose.text});assert.deepEqual(result.staging,[]);assert.equal(result.provider.isLive,false);assert.match(result.reviewNotes[0],/不执行语义记忆提取/);
});
