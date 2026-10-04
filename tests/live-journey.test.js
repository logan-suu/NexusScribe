import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyConfig,guardJourney} from '../scripts/live-journey-guard.mjs';
const approved={NEXUS_JOURNEY_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true'};
test('journey configuration requires three explicit gates and overrides unsafe limits',()=>{
 for(const key of Object.keys(approved))assert.throws(()=>journeyConfig({...approved,[key]:'false'}));
 const env=journeyConfig({...approved,NEXUS_MAX_CALLS:'99',NEXUS_MAX_OUTPUT_TOKENS:'99000',NEXUS_REASONING_EFFORT:'low'});
 assert.equal(env.NEXUS_MAX_CALLS,'12');assert.equal(env.NEXUS_MAX_OUTPUT_TOKENS,'3000');assert.equal(env.NEXUS_THINKING_MODE,'disabled');assert.equal(env.NEXUS_REASONING_EFFORT,undefined);
 assert.equal(env.NEXUS_API_MODEL,'deepseek-v4.1-flash');assert.equal(env.NEXUS_API_BASE_URL,'https://opencode.ai/zen/go/v1');
});
test('journey enforces 12 calls and serial pacing without retry',async()=>{
 let calls=0,time=0;const waits=[],logs=[];const guard=guardJourney({status:()=>({}),run:async()=>{calls++;return {ok:true}}},{now:()=>time,sleep:async ms=>{waits.push(ms);time+=ms},log:x=>logs.push(x)});
 for(let i=0;i<12;i++)await guard.run('interview',{});
 await assert.rejects(guard.run('interview',{}));assert.equal(calls,12);assert.deepEqual(waits,[0,...Array(11).fill(11000)]);assert.equal(logs.length,12);
});
test('first provider failure latches the session closed and sanitizes logs',async()=>{
 let calls=0;const logs=[];const guard=guardJourney({status:()=>({}),run:async()=>{calls++;throw Object.assign(Error('SECRET RAW RESPONSE'),{code:'UPSTREAM_ERROR'})}},{sleep:async()=>{},log:x=>logs.push(x)});
 await assert.rejects(guard.run('interview',{}),{code:'UPSTREAM_ERROR'});await assert.rejects(guard.run('planStory',{}));assert.equal(calls,1);assert.equal(guard.stopped,true);assert.deepEqual(logs,['provider UPSTREAM_ERROR 1']);
});
test('failed preflight invariant prevents a provider call and closes the session',async()=>{
 let calls=0;const guard=guardJourney({status:()=>({}),run:async()=>calls++},{before:()=>{throw Error('PRIVATE')},log:()=>{}});
 await assert.rejects(guard.run('generateChapter',{}),{code:'JOURNEY_FAILED'});assert.equal(calls,0);assert.equal(guard.stopped,true);
});
test('concurrent request is rejected without an extra provider call',async()=>{
 let release,calls=0;const gate=new Promise(r=>release=r);const guard=guardJourney({status:()=>({}),run:async()=>{calls++;await gate;return {}}},{sleep:async()=>{},log:()=>{}});
 const first=guard.run('interview',{});await assert.rejects(guard.run('interview',{}));release();await first;assert.equal(calls,1);
});
test('journey logs only allowlisted validation reason, never model diagnostics',async()=>{
 for(const reason of ['STAGING_QUOTE_MISMATCH','PRIVATE RAW OUTPUT']){
  const logs=[];const guard=guardJourney({status:()=>({}),run:async()=>{throw Object.assign(Error('PRIVATE RAW OUTPUT'),{code:'INVALID_MODEL_OUTPUT',validationReason:reason,diagnostics:{text:'PRIVATE RAW OUTPUT'}})}},{sleep:async()=>{},log:x=>logs.push(x)});
  await assert.rejects(guard.run('generateChapter',{}));assert.deepEqual(logs,reason==='STAGING_QUOTE_MISMATCH'?['provider INVALID_MODEL_OUTPUT 1','validation STAGING_QUOTE_MISMATCH']:['provider INVALID_MODEL_OUTPUT 1']);
 }
});


// The optional live journey must exercise the same explicit selection and final-confirmation UI.
import {planJourneyMemorySelection} from '../scripts/journey-memory-selection.mjs';
import * as engine from '../src/domain/engine.js';
import {readFileSync} from 'node:fs';
function memoryFixture(statuses=['supported','unsupported',null],isolated=true){
 let state=engine.createProjectFromConfig({projectId:'journey-memory'});state=engine.stageProseDraft(state,{text:'小舟举起纸灯。\n他走向北门。\n风停了。',provider:{id:'mock',isLive:true},context:engine.getContext(state)},'ch1');const id=state.drafts[0].id;state=engine.beginMemoryExtraction(state,id);state=engine.attachMemoryExtraction(state,id,{staging:statuses.map((_,i)=>({label:`候选${i+1}`,sourceParagraphIndex:i})),reviewNotes:[],provider:'mock'},engine.createExtractionBinding(state,id));state=engine.reviewDraft(state,id);const checks=engine.createMemoryReviewInput(state,id).flatMap((c,i)=>statuses[i]?[{candidateId:c.candidateId,status:statuses[i],explanation:'合成测试判断'}]:[]);state=engine.attachSemanticReview(state,id,{summary:'合成测试',issues:[],checks:[],factChecks:[],memoryChecks:checks,provider:'mock'},engine.createReviewBinding(state,id));if(isolated){for(const [i,item] of engine.createMemoryReviewInput(state,id).entries()){if(!statuses[i])continue;state=engine.beginMemorySupportAssessment(state,id,item.candidateId);state=engine.attachMemorySupportAssessment(state,id,item.candidateId,{status:statuses[i],explanation:'独立引文合成判断',provider:{id:'mock',isLive:true}},engine.createMemorySupportBinding(state,id,item.candidateId))}}return state;
}
test('registered journey rejects every candidate even after positive advice and reports explicit prose-only counts',()=>{
 const state=memoryFixture(),before=structuredClone(state),selection=planJourneyMemorySelection(state,state.drafts[0].id);
 assert.deepEqual(selection.decisions.map(c=>c.action),['reject','reject','reject']);assert.equal(selection.selected,0);assert.equal(selection.rejected,3);assert.equal(selection.total,3);assert.deepEqual(state,before);
 assert.deepEqual(selection.decisions.map(c=>c.candidateId),engine.createMemoryReviewInput(state,state.drafts[0].id).map(c=>c.candidateId));assert.ok(selection.decisions.every(c=>c.action!=='override_keep'));
});
test('journey supports reject-all and successful empty extraction without inventing selected memory',()=>{
 for(const statuses of [['unsupported','unknown',null],[]]){const state=memoryFixture(statuses),selection=planJourneyMemorySelection(state,state.drafts[0].id);assert.equal(selection.selected,0);assert.equal(selection.rejected,statuses.length);assert.equal(selection.total,statuses.length)}
});
test('journey refuses a stale nonempty decision surface',()=>{
 const state=memoryFixture();state.version++;assert.throws(()=>planJourneyMemorySelection(state,state.drafts[0].id),/MEMORY_SELECTION_NOT_CURRENT/);
});
test('journey uses visible memory choices and final confirmation with no automatic override or extra request',()=>{
 const source=readFileSync(new URL('../scripts/live-writing-journey.mjs',import.meta.url),'utf8');assert.match(source,/planJourneyMemorySelection/);assert.match(source,/click\(`拒绝候选记忆/);assert.match(source,/await click\('确认接受正文与所选记忆'\)/);assert.match(source,/SELECTED_MEMORY/);assert.doesNotMatch(source,/click\('确认作者例外保留'\)/);assert.doesNotMatch(source,/call\('确认接受正文与所选记忆'\)/);
});

test('the registered journey never adds audits or promotes bundled-only positive memory',()=>{const state=memoryFixture(['supported','supported'],false),selection=planJourneyMemorySelection(state,state.drafts[0].id);assert.equal(selection.selected,0);assert.equal(selection.rejected,2);const source=readFileSync(new URL('../scripts/live-writing-journey.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/call\(['"]auditMemoryCandidate|click\(['"]独立核对/);});
