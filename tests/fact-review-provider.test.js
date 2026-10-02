import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentService,validateInput,validateOutput,SAFE_VALIDATION_REASONS} from '../server/provider.js';

const fact={id:'author-fact-1',recordVersion:2,status:'confirmed',authority:'explicit_author_decision',label:'小舟的灯是蓝色',source:{chapterId:'ch1',revision:1,quote:'灯是蓝色'}};
const input={text:'小舟提着蓝色纸灯。有人说：“那灯是红色的。”',chapterId:'ch2',context:{projectId:'p1',version:3,sources:[{chapterId:'ch1',revision:1,text:'旧章中的事实出处。'},{chapterId:'ch2',revision:1,text:'待写'}],facts:[fact,{...fact,id:'proposed',status:'proposed'},{...fact,id:'superseded',status:'superseded'},{...fact,id:'inferred',authority:'inferred'}]}};
const review={summary:'逐项复核，仍需作者确认',issues:[],checks:['角色知识']};
const assessment={factId:fact.id,recordVersion:fact.recordVersion,status:'consistent',explanation:'候选正文直接陈述同一盏灯的颜色',sourceQuote:'小舟提着蓝色纸灯。'};
const validate=out=>validateOutput('reviewChapter',out,input);
function rejects(out,reason){assert.throws(()=>validate(out),error=>error.code==='INVALID_MODEL_OUTPUT'&&error.validationReason===reason&&SAFE_VALIDATION_REASONS.includes(error.validationReason));}

test('fact assessments preserve supplied semantics and ordinary issues without inferred decisions',()=>{
 for(const status of ['consistent','contradiction','unknown','not_applicable']){
  const out={...review,issues:[{severity:'warning',explanation:'角色口述需要复核',sourceQuote:'那灯是红色的。'}],factChecks:[{...assessment,status}]};
  assert.strictEqual(validate(out),out);
  assert.equal(out.factChecks[0].status,status);
  assert.deepEqual(Object.keys(out.factChecks[0]),['factId','recordVersion','status','explanation','sourceQuote']);
 }
});

test('legacy missing and partial factChecks remain missing or partial for domain unknown fallback',()=>{
 assert.strictEqual(validate(review),review);
 assert.equal(Object.hasOwn(review,'factChecks'),false);
 assert.deepEqual(validate({...review,factChecks:[]}).factChecks,[]);
 const more={...input,context:{...input.context,facts:[fact,{...fact,id:'second'}]}};
 assert.equal(validateOutput('reviewChapter',{...review,factChecks:[assessment]},more).factChecks.length,1);
});

test('unknown and not_applicable allow empty quotes, but require explanations and exact nonempty quotes',()=>{
 for(const status of ['unknown','not_applicable']){
  assert.equal(validate({...review,factChecks:[{...assessment,status,sourceQuote:''}]}).factChecks[0].sourceQuote,'');
  rejects({...review,factChecks:[{...assessment,status,explanation:'  ',sourceQuote:''}]},'REVIEW_FACT_EXPLANATION');
  rejects({...review,factChecks:[{...assessment,status,sourceQuote:'旧章中的事实出处。'}]},'REVIEW_FACT_QUOTE_MISMATCH');
 }
 for(const status of ['consistent','contradiction'])for(const sourceQuote of ['', '  ', null, undefined])rejects({...review,factChecks:[{...assessment,status,sourceQuote}]},'REVIEW_FACT_QUOTE_SHAPE');
 rejects({...review,factChecks:[{...assessment,sourceQuote:'旧章中的事实出处。'}]},'REVIEW_FACT_QUOTE_MISMATCH');
});

test('fact assessment identity/version and field allowlist reject fabricated or stale metadata',()=>{
 const cases=[
  [null,'REVIEW_FACT_CHECKS_ARRAY'],[{},'REVIEW_FACT_CHECKS_ARRAY'],
  [[null],'REVIEW_FACT_CHECK_FIELDS'],
  [[{...assessment,severity:'warning'}],'REVIEW_FACT_CHECK_FIELDS'],
  [[{...assessment,provenance:{}}],'REVIEW_FACT_CHECK_FIELDS'],
  [[{...assessment,candidateTextHash:'forged'}],'REVIEW_FACT_CHECK_FIELDS'],
  [[{...assessment,factId:'missing'}],'REVIEW_FACT_ID'],
  ...['proposed','superseded','inferred'].map(factId=>[[{...assessment,factId}],'REVIEW_FACT_ID']),
  ...[1,0,-1,2.1,'2',null,Number.MAX_SAFE_INTEGER+1].map(recordVersion=>[[{...assessment,recordVersion}],'REVIEW_FACT_VERSION']),
  [[assessment,assessment],'REVIEW_FACT_DUPLICATE'],
  [[{...assessment,status:'passed'}],'REVIEW_FACT_STATUS'],
  [[{...assessment,explanation:''}],'REVIEW_FACT_EXPLANATION'],
  [[{...assessment,sourceQuote:undefined}],'REVIEW_FACT_QUOTE_SHAPE'],
  [Array.from({length:151},()=>assessment),'REVIEW_FACT_CHECKS_ARRAY']
 ];
 for(const [factChecks,reason] of cases)rejects({...review,factChecks},reason);
 for(const key of Object.keys(assessment)){
  const entry={...assessment};delete entry[key];
  assert.throws(()=>validate({...review,factChecks:[entry]}),{code:'INVALID_MODEL_OUTPUT'});
 }
 assert.throws(()=>validateOutput('reviewChapter',{...review,factChecks:[assessment]},{...input,context:{...input.context,facts:[]}}),{validationReason:'REVIEW_FACT_ID'});
 rejects({...review,factChecks:[],passed:true},'REVIEW_FIELDS');
});

test('review input rejects malformed or ambiguous confirmed fact identity before provider requests',()=>{
 assert.strictEqual(validateInput('reviewChapter',input),input);
 for(const facts of [{},[fact,fact],[{...fact,id:''}],[{...fact,recordVersion:0}],[{...fact,recordVersion:'2'}]]){
  assert.throws(()=>validateInput('reviewChapter',{...input,context:{...input.context,facts}}),{code:'INVALID_INPUT'});
 }
});

test('offline service prompt requests full semantic assessments without forced mentions or invented bindings',async()=>{
 const env={NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_API_BASE_URL:'https://example.test/v1',NEXUS_API_MODEL:'test-model',NEXUS_API_KEY:'offline-only'};
 let request;
 const service=createAgentService({env,fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...review,factChecks:[assessment]})}}]}));}});
 const result=await service.run('reviewChapter',input);
 assert.deepEqual(result.factChecks,[assessment]);
 assert.deepEqual(result.issues,[]);
 const prompt=request.messages[0].content;
 for(const phrase of ['Assess every context.facts','status confirmed AND authority explicit_author_decision','exactly once','same referent','story time','dialogue','negation','hypothesis','never force a mention','not_applicable','unknown','domain derives','candidate binding','Preserve legitimate generic issues'])assert.ok(prompt.includes(phrase),phrase);
 assert.deepEqual(JSON.parse(request.messages[1].content).input,input);
});
