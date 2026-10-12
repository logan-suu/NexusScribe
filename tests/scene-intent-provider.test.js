import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentService,validateInput} from '../server/provider.js';

const env={NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_API_BASE_URL:'https://example.test/v1',NEXUS_API_MODEL:'offline-scene-test',NEXUS_API_KEY:'offline-fake-key'};
const text='她把信放在桌上。';
const sceneIntent={protocol:'request-scene-intent-v1',boundary:'app-saved-scene-input',projectId:'scene-project',chapterId:'ch2',chapterIndex:1,chapterRevision:3,stateVersion:8,draftId:'draft-1',runId:'run-1',draftRevision:2,contextVersion:8,contextSchemaVersion:3,source:'config.outline[1]',goal:{status:'present',value:'  保留完整目标\r\n🙂  '},exitState:{status:'empty',value:' \n\t'}};
const context={projectId:'scene-project',version:8,contextSchemaVersion:3,sources:[{chapterId:'ch1',chapterIndex:0,revision:2,text:'前章。'},{chapterId:'ch2',chapterIndex:1,revision:3,text:'旧正文，不是本次候选。'}],facts:[]};
const input=action=>({text,chapterId:'ch2',context:structuredClone(context),...(action==='reviseProse'?{instruction:'保持克制的语气。'}:{}),sceneIntent:structuredClone(sceneIntent)});
const envelope=action=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:action==='reviseProse'?'她轻轻把信放在桌上。':JSON.stringify({summary:'仍需作者确认。',issues:[],checks:[]})}}]}));

for(const action of ['reviewChapter','reviseProse']){
 test(`${action} forwards exact optional scene intent through the actual model payload without claiming authority`,async()=>{
  const request=input(action),before=structuredClone(request);let captured,calls=0;
  const service=createAgentService({env,fetchImpl:async(_url,options)=>{calls++;captured=JSON.parse(options.body);return envelope(action);}});
  const output=await service.run(action,request);
  assert.equal(calls,1);assert.equal(service.status().callsUsed,1);
  assert.deepEqual(JSON.parse(captured.messages[1].content),{action,input:before});
  assert.deepEqual(request,before);assert.equal(Object.hasOwn(output,'sceneIntent'),false);
  assert.ok(captured.messages[0].content.includes('Proposals never authorize commits'));
 });

 test(`${action} preserves the legacy absent payload and supports absent legacy schema only as zero`,async()=>{
  const request=input(action);delete request.sceneIntent;let captured;
  const service=createAgentService({env,fetchImpl:async(_url,options)=>{captured=JSON.parse(options.body);return envelope(action);}});
  await service.run(action,request);assert.deepEqual(JSON.parse(captured.messages[1].content),{action,input:request});
  const noSchema=input(action);delete noSchema.context.contextSchemaVersion;noSchema.sceneIntent.contextSchemaVersion=0;
  assert.strictEqual(validateInput(action,noSchema),noSchema);
 });

 test(`${action} rejects malformed and incoherent scene intent before any HTTP or call-budget use`,async()=>{
  let calls=0;const service=createAgentService({env,fetchImpl:async()=>{calls++;return envelope(action);}});
  const changes=[
   x=>{x.sceneIntent=null;},x=>{x.sceneIntent=[];},x=>{x.sceneIntent='reference';},x=>{x.sceneIntent=undefined;},
   ...Object.keys(sceneIntent).map(key=>x=>{delete x.sceneIntent[key];}),
   x=>{x.sceneIntent.extra='authority';},x=>{x.sceneIntent.protocol='generation-intent-v1';},x=>{x.sceneIntent.boundary='provider-wire';},
   ...['projectId','chapterId','draftId','runId'].flatMap(key=>['',' ','x'.repeat(201),null,1].map(value=>x=>{x.sceneIntent[key]=value;})),
   ...['chapterIndex','chapterRevision','stateVersion','draftRevision','contextVersion','contextSchemaVersion'].flatMap(key=>[-1,1.5,Number.MAX_SAFE_INTEGER+1,'1',null].map(value=>x=>{x.sceneIntent[key]=value;})),
   ...['chapterRevision','stateVersion','draftRevision','contextVersion'].map(key=>x=>{x.sceneIntent[key]=0;}),
   x=>{x.sceneIntent.source='project.outline[1]';},x=>{x.sceneIntent.source='config.outline[0]';},
   ...['goal','exitState'].flatMap(key=>[null,{},'goal',{status:'present',value:''},{status:'empty',value:'text'},{status:'missing',value:'text'},{status:'invalid',value:1},{status:'approved',value:'text'},{status:'present',value:'x'.repeat(4001)},{status:'present',value:'text',authority:true}].map(value=>x=>{x.sceneIntent[key]=value;})),
   x=>{x.sceneIntent.projectId='foreign';},x=>{x.sceneIntent.chapterId='ch1';},x=>{x.sceneIntent.chapterIndex=0;x.sceneIntent.source='config.outline[0]';},
   x=>{x.sceneIntent.chapterRevision++;},x=>{x.sceneIntent.stateVersion++;},x=>{x.sceneIntent.contextVersion++;},x=>{x.sceneIntent.contextSchemaVersion++;},
   x=>{x.context.contextSchemaVersion=Number.MAX_SAFE_INTEGER+1;},x=>{x.context.contextSchemaVersion=null;},x=>{x.context.contextSchemaVersion=null;x.sceneIntent.contextSchemaVersion=0;},
   x=>{delete x.context.contextSchemaVersion;},x=>{x.context.sources[1].chapterIndex=0;},x=>{x.context.sources.push(structuredClone(x.context.sources[1]));},
   x=>{x.context.projectId='foreign';},x=>{x.chapterId='ch1';},x=>{x.context.sources[1].chapterId='foreign';},x=>{x.context.sources.splice(1,1);},x=>{x.context.sources[1].chapterIndex=Number.MAX_SAFE_INTEGER+1;},x=>{x.context.sources[1].revision++;},x=>{x.context.sources[1].revision=Number.MAX_SAFE_INTEGER+1;},x=>{x.context.version=Number.MAX_SAFE_INTEGER+1;},
  ];
  for(const change of changes){const request=input(action);change(request);await assert.rejects(service.run(action,request),{code:'INVALID_INPUT'});}
  assert.equal(calls,0);assert.equal(service.status().callsUsed,0);
 });

 test(`${action} preserves missing, invalid, empty, and present scene fields without inferring values`,async()=>{
  for(const field of [{status:'missing',value:null},{status:'invalid',value:null},{status:'empty',value:''},{status:'empty',value:' \r\n'},{status:'present',value:'\t精准措辞。🙂\n'},{status:'present',value:'x'.repeat(4000)}]){
   const request=input(action);request.sceneIntent.goal=structuredClone(field);request.sceneIntent.exitState=structuredClone(field);let captured;
   const service=createAgentService({env,fetchImpl:async(_url,options)=>{captured=JSON.parse(JSON.parse(options.body).messages[1].content);return envelope(action);}});
   await service.run(action,request);assert.deepEqual(captured.input.sceneIntent,request.sceneIntent);
  }
 });
}

test('scene coherence accepts safe integer upper bounds without rounding and optional source indices',()=>{
 const request=input('reviewChapter'),n=Number.MAX_SAFE_INTEGER;
 request.context.version=n;request.sceneIntent.stateVersion=n;request.sceneIntent.contextVersion=n;
 request.context.contextSchemaVersion=n;request.sceneIntent.contextSchemaVersion=n;
 request.context.sources[1].revision=n;request.sceneIntent.chapterRevision=n;request.sceneIntent.draftRevision=n;
 delete request.context.sources[1].chapterIndex;
 request.sceneIntent.draftId='d'.repeat(200);request.sceneIntent.runId='r'.repeat(200);
 assert.strictEqual(validateInput('reviewChapter',request),request);
});

test('scene intent is not admitted to unrelated extraction or isolated memory requests',()=>{
 assert.throws(()=>validateInput('extractMemory',input('reviewChapter')),{code:'INVALID_INPUT'});
 assert.throws(()=>validateInput('auditMemoryCandidate',{label:'主张',sourceQuote:text,sceneIntent}),{code:'INVALID_INPUT'});
});
