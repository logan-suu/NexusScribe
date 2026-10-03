import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
const clone=structuredClone;
const text='阿岚拾起一封信。\n信上只写着北城。\n她把信放进口袋。';
const entries=[{label:'阿岚获得信件',sourceParagraphIndex:0},{label:'信件提到了北城，而且寄信人正躲在那里',sourceParagraphIndex:1},{label:'阿岚把信放进口袋',sourceParagraphIndex:2}];
const id=s=>s.drafts[0].id;
function extracted({live=true,body=text,candidates=entries}={}) {
 let s=e.createProjectFromConfig({projectId:'memory-review'});
 s=e.stageProseDraft(s,{text:body,context:e.getContext(s),provider:{id:'writer-fixture',isLive:live}},'ch1');
 s=e.beginMemoryExtraction(s,id(s));
 return e.attachMemoryExtraction(s,id(s),{staging:candidates,reviewNotes:[],provider:'extract-fixture'},e.createExtractionBinding(s,id(s)));
}
function report(s,statuses=['supported','unsupported','supported']) {
 return {summary:'测试提供的语义判断，不代表独立验证',issues:[],checks:[],factChecks:[],provider:'review-fixture',memoryChecks:s.drafts[0].staging.map((candidate,i)=>({candidateId:candidate.id,status:statuses[i]??'unknown',explanation:statuses[i]==='unsupported'?'原文只提到北城，不能支持寄信人所在地这一额外分句':'对完整原始主张逐项检查'}))};
}
function auditFixture(s,index,status,explanation='对完整原始主张逐项检查'){const candidateId=s.drafts[0].staging[index].id;s=e.beginMemorySupportAssessment(s,id(s),candidateId);return e.attachMemorySupportAssessment(s,id(s),candidateId,{status,explanation,provider:'isolated-fixture'},e.createMemorySupportBinding(s,id(s),candidateId));}
// Explicit offline isolated-result fixtures keep these prior gate tests focused.
function review(s=extracted(),r=report(s)) {s=e.reviewDraft(s,id(s));s=e.attachSemanticReview(s,id(s),r,e.createReviewBinding(s,id(s)));for(const [index,candidate] of s.drafts[0].staging.entries()){const check=r.memoryChecks?.find(c=>c.candidateId===candidate.id);if(check)s=auditFixture(s,index,check.status,check.explanation);}return s;}
function decide(s,index,action='keep',reason) {const row=e.getMemoryReviewGate(s,id(s))[index];return e.decideMemoryCandidate(s,id(s),{candidateId:row.candidateId,action,reason,reviewHash:row.reviewHash},row.binding);}
function selected(s=review()) {s=decide(s,0);s=decide(s,1,'reject');return decide(s,2);}

test('review input contains every exact original claim and quote, independently of decisions',()=>{
 let s=review(),before=clone(s.drafts[0].staging),input=e.createMemoryReviewInput(s,id(s));
 assert.deepEqual(input,before.map(c=>({candidateId:c.id,label:c.label,sourceQuote:c.sourceQuote})));
 input[0].label='mutated caller copy';assert.deepEqual(s.drafts[0].staging,before);
 s=decide(s,1,'reject');assert.equal(e.createMemoryReviewInput(s,id(s))[1].label,entries[1].label);assert.deepEqual(s.drafts[0].staging,before);
});
test('partial-support multiclause claim cannot be kept unchanged by ordinary keep or implicit acceptance',()=>{
 let s=review(),key=id(s);const row=e.getMemoryReviewGate(s,key)[1];
 assert.equal(row.status,'unsupported');assert.equal(row.canKeep,false);assert.equal(row.resolved,false);
 assert.throws(()=>decide(s,1),{code:'MEMORY_DECISION_REQUIRED'});
 s=decide(s,0);s=decide(s,2);assert.throws(()=>e.acceptDraft(s,key),{code:'MEMORY_DECISION_REQUIRED'});assert.deepEqual(s.events,[]);
 const accepted=e.acceptDraft(decide(s,1,'reject'),key);
 assert.deepEqual(accepted.events.map(v=>v.label),[entries[0].label,entries[2].label]);
 assert.equal(accepted.drafts[0].staging[1].label,entries[1].label);
 assert.equal(accepted.commits.at(-1).memoryCandidateIds[1],accepted.drafts[0].staging[1].id);
 assert.equal(accepted.commits.at(-1).memoryDecisions.find(d=>d.candidateId===row.candidateId).action,'reject');
 assert.equal(accepted.events[0].memoryDecision.action,'keep');
 assert.ok(e.getMemoryReviewGate(accepted,key).every(row=>row.resolved));
});
test('author override is scoped, reasoned, bound and visibly preserves unsupported assessment',()=>{
 let s=review(),key=id(s);assert.throws(()=>decide(s,1,'override_keep','  '),{code:'MEMORY_DECISION_REQUIRED'});
 assert.throws(()=>decide(s,1,'override_keep','x'.repeat(2001)),{code:'MEMORY_DECISION_REQUIRED'});
 s=decide(s,1,'override_keep','作者有意保留推断，知道原文未完全支持');
 const row=e.getMemoryReviewGate(s,key)[1];assert.equal(row.status,'unsupported');assert.equal(row.decision.assessment,'unsupported');assert.equal(row.canKeep,false);assert.equal(row.resolved,true);
 assert.throws(()=>e.acceptDraft(s,key),{code:'MEMORY_DECISION_REQUIRED'});
 s=decide(s,0,'reject');s=decide(s,2,'reject');s=e.acceptDraft(s,key);
 assert.equal(s.events.length,1);assert.equal(s.events[0].label,entries[1].label);assert.equal(s.events[0].source.quote,'信上只写着北城。');assert.equal(s.events[0].memoryDecision.reason,'作者有意保留推断，知道原文未完全支持');
});
test('rejecting every candidate accepts prose without promoting any memory',()=>{
 let s=review();for(let i=0;i<3;i++)s=decide(s,i,'reject');
 s=e.acceptDraft(s,id(s));assert.equal(s.events.length,0);assert.equal(s.chapters[0].text,text);assert.equal(s.drafts[0].staging.length,3);assert.equal(s.commits.at(-1).memoryDecisions.length,3);
});
test('missing checks and missing per-candidate checks are explicit unknown and never ordinary keep',()=>{
 for(const checks of [undefined,[],[report(extracted()).memoryChecks[0]]]){
  const source=extracted(),r=report(source);r.memoryChecks=checks;const s=review(source,r),rows=e.getMemoryReviewGate(s,id(s));
  assert.equal(rows[1].status,'unknown');assert.equal(rows[1].assessmentOrigin,'not_audited');assert.throws(()=>decide(s,1),{code:'MEMORY_DECISION_REQUIRED'});
 }
});
test('duplicate, foreign, unsupported statuses and malformed memory checks fail closed',()=>{
 const s=extracted(),r=report(s),check=r.memoryChecks[0];
 for(const memoryChecks of [null,{},[check,check],[{...check,candidateId:'foreign'}],[{...check,status:'probably'}],[{...check,explanation:''}],[{...check,explanation:'x'.repeat(4001)}],[{...check,severity:'warning'}],[{...check,label:'replacement'}]])assert.throws(()=>review(s,{...r,memoryChecks}),{code:'INVALID_MEMORY_REVIEW'});
});
test('offline fixture offers explicit unknown override or reject but cannot silently keep',()=>{
 let s=e.reviewDraft(extracted({live:false}),id(extracted({live:false})));const rows=e.getMemoryReviewGate(s,id(s));
 assert.equal(rows[0].canKeep,false);assert.equal(rows[0].canOverride,true);assert.throws(()=>decide(s,0),{code:'MEMORY_DECISION_REQUIRED'});
 s=decide(s,0,'override_keep','作者人工核对完整主张及对应原文');s=decide(s,1,'reject');s=decide(s,2,'reject');s=e.acceptDraft(s,id(s));
 assert.equal(s.events.length,1);assert.equal(s.events[0].memoryDecision.assessment,'unknown');
});
test('live override needs current semantic review; reject can be staged after structural review',()=>{
 let s=extracted();assert.throws(()=>decide(s,0,'reject'),{code:'STALE_MEMORY_DECISION'});
 s=e.reviewDraft(s,id(s));assert.equal(e.getMemoryReviewGate(s,id(s))[0].canOverride,false);
 assert.throws(()=>decide(s,0,'override_keep','确认'),{code:'MEMORY_DECISION_REQUIRED'});
 s=decide(s,0,'reject');assert.equal(e.getMemoryReviewGate(s,id(s))[0].resolved,true);
 assert.throws(()=>e.acceptDraft(s,id(s)),{code:'SEMANTIC_REVIEW_REQUIRED'});
});
test('re-review invalidates old decisions and response authority while preserving their exact audit',()=>{
 let s=selected(),key=id(s),old=clone(s.drafts[0].memoryDecisions),binding=e.createReviewBinding(s,key),r=report(s);
 s=e.attachSemanticReview(s,key,r,binding);
 assert.deepEqual(s.drafts[0].memoryDecisions,[]);assert.deepEqual(s.drafts[0].memoryDecisionHistory,old);assert.ok(s.drafts[0].memoryArchives.some(a=>a.decisions.length===3));
 assert.throws(()=>e.acceptDraft(s,key),{code:'MEMORY_DECISION_REQUIRED'});
 assert.throws(()=>e.attachSemanticReview(s,key,r,binding),{code:'STALE_SEMANTIC_REVIEW'});
 s.drafts[0].memoryDecisions=old;assert.ok(e.getMemoryReviewGate(s,key).every(r=>!r.resolved));
});
test('starting a review revokes old authority even before new response or after cancellation',()=>{
 const before=selected(),key=id(before),row=e.getMemoryReviewGate(before,key)[0],s=e.beginSemanticReview(before,key);
 assert.equal(s.drafts[0].modelReview,null);assert.deepEqual(s.drafts[0].memoryDecisions,[]);assert.equal(s.drafts[0].memoryDecisionHistory.length,3);
 assert.throws(()=>e.acceptDraft(s,key),{code:'SEMANTIC_REVIEW_REQUIRED'});
 assert.throws(()=>e.decideMemoryCandidate(s,key,{candidateId:row.candidateId,action:'keep',reviewHash:row.reviewHash},row.binding),{code:'STALE_MEMORY_DECISION'});
});
test('all binding fields, exact snapshots and unexpected extra keys are checked for decisions',()=>{
 const s=review(),key=id(s),row=e.getMemoryReviewGate(s,key)[0],instruction={candidateId:row.candidateId,action:'keep',reviewHash:row.reviewHash};
 for(const field of Object.keys(row.binding)){
  const missing=clone(row.binding);delete missing[field];assert.throws(()=>e.decideMemoryCandidate(s,key,instruction,missing),{code:'STALE_MEMORY_DECISION'});
 }
 assert.throws(()=>e.decideMemoryCandidate(s,key,instruction,{...row.binding,unexpected:1}),{code:'STALE_MEMORY_DECISION'});
 assert.throws(()=>e.decideMemoryCandidate(s,key,{...instruction,label:'rewritten'},row.binding),{code:'MEMORY_DECISION_REQUIRED'});
});
test('editing, re-extracting and draft rejection retain candidate evidence, original decisions and review audit',()=>{
 const original=selected(),key=id(original),candidates=clone(original.drafts[0].staging),decisions=clone(original.drafts[0].memoryDecisionHistory);
 for(const next of [e.editDraft(original,key,'新的正文。'),e.beginMemoryExtraction(original,key),e.rejectDraft(original,key)]){
  assert.deepEqual(next.drafts[0].memoryDecisionHistory,decisions);assert.deepEqual(next.drafts[0].staging,[]);
  assert.ok(next.drafts[0].memoryArchives.some(a=>JSON.stringify(a.candidates)===JSON.stringify(candidates)&&a.decisions.length===3));
  assert.equal(next.drafts[0].memoryDecisions.length,0);
 }
});
test('candidate and decision mutations cannot reuse old authority, including legacy hash collisions',()=>{
 const base=selected(),key=id(base);
 for(const mutate of [d=>{d.staging[0].label='被替换的主张'},d=>{d.staging.pop()},d=>{d.memoryDecisions[0].action='reject'},d=>{d.memoryDecisions[1].action='keep'},d=>{d.memoryBindingSnapshots[0].values.stagingSnapshot[0].label='改写'},d=>{d.memoryAuthorities[0].reviewSnapshot.summary='改写审查'},d=>{d.modelReview.memoryChecks[1].status='supported'},d=>{d.memoryDecisions[0].reviewHash='forged'}]){
  const next=clone(base);mutate(next.drafts[0]);assert.throws(()=>e.acceptDraft(next,key));
 }
 let s=review(extracted({body:'😀',candidates:[{label:'😀',sourceParagraphIndex:0}]}),undefined);
 const before=e.createReviewBinding(s,id(s)),next=clone(s),d=next.drafts[0];assert.equal(e.hash('😀'),e.hash('😁'));
 d.staging[0].label='😁';d.memoryCandidatesSnapshot=clone(d.staging);d.extraction.stagingSnapshot=clone(d.staging);d.extraction.stagingHash=e.hash(JSON.stringify(d.staging));d.review.stagingSnapshot=clone(d.staging);d.review.stagingHash=d.extraction.stagingHash;
 assert.equal(before.stagingHash,e.createReviewBinding(next,id(next)).stagingHash);
 assert.equal(e.getMemoryReviewGate(next,id(next))[0].canKeep,false);assert.throws(()=>e.attachSemanticReview(next,id(next),report(next),before),{code:'STALE_SEMANTIC_REVIEW'});
});
test('failed extraction never authorizes an empty-memory acceptance',()=>{
 let s=extracted();s=e.beginMemoryExtraction(s,id(s));s=e.markExtractionFailure(s,id(s),e.createExtractionBinding(s,id(s)));s=e.reviewDraft(s,id(s));
 assert.deepEqual(e.getMemoryReviewGate(s,id(s)),[]);assert.throws(()=>e.acceptDraft(s,id(s)),{code:'REVIEW_REQUIRED'});
});
test('empty successful extraction has no implicit memory decision but still obeys live review gate',()=>{
 let s=extracted({candidates:[]});s=e.reviewDraft(s,id(s));assert.throws(()=>e.acceptDraft(s,id(s)),{code:'SEMANTIC_REVIEW_REQUIRED'});
 s=e.attachSemanticReview(s,id(s),report(s),e.createReviewBinding(s,id(s)));assert.equal(e.acceptDraft(s,id(s)).events.length,0);
});
test('supported decisions cannot waive generic model errors or fact conflicts',()=>{
 let source=extracted(),r=report(source);r.issues=[{severity:'error',explanation:'独立正文问题',sourceQuote:'她把信放进口袋。'}];let s=selected(review(source,r));
 assert.throws(()=>e.acceptDraft(s,id(s)),{code:'SEMANTIC_REVIEW_ERRORS'});
 let fact=e.createProjectFromConfig({projectId:'fact-with-memory',chapters:[{text:'纸灯是蓝色的。'}]});
 fact=e.commitPatch(fact,e.proposeCustomPatch(fact,'ch1',{intent:'author_fact',statement:'纸灯是蓝色的。'}));
 fact=e.stageProviderDraft(fact,{text:'纸灯是红色的。',staging:[{label:'纸灯为红色',sourceQuote:'纸灯是红色的。'}],context:e.getContext(fact),provider:{id:'live',isLive:true}},'ch2');
 fact=e.reviewDraft(fact,id(fact));r=report(fact,['supported']);r.factChecks=[{factId:fact.facts[0].id,recordVersion:1,status:'contradiction',sourceQuote:'纸灯是红色的。',explanation:'颜色冲突'}];fact=e.attachSemanticReview(fact,id(fact),r,e.createReviewBinding(fact,id(fact)));fact=auditFixture(fact,0,'supported');fact=decide(fact,0);
 assert.throws(()=>e.acceptDraft(fact,id(fact)),{code:'FACT_DECISION_REQUIRED'});
});

test('memory support explanations share the provider 4000-character bound',()=>{const s=extracted(),r=report(s);for(const size of [2001,4000]){r.memoryChecks[0].explanation='x'.repeat(size);assert.equal(e.getMemoryReviewGate(review(s,r),id(s))[0].explanation.length,size);}});

test('legacy live provider provenance cannot be downgraded to the offline override path',()=>{let s=e.createProjectFromConfig({projectId:'legacy-live'});s=e.stageProviderDraft(s,{text:'作者写下一封信。',staging:[{label:'作者写信',sourceQuote:'作者写下一封信。'}],context:e.getContext(s),provider:{id:'live',isLive:true}},'ch1');s=e.reviewDraft(s,id(s));s.drafts[0].requiresSemanticReview=false;assert.equal(e.getMemoryReviewGate(s,id(s))[0].canOverride,false);assert.throws(()=>e.acceptDraft(s,id(s)),{code:'SEMANTIC_REVIEW_REQUIRED'});});

test('an explicit offline structural re-review revokes prior memory authority without deleting audit',()=>{let s=extracted({live:false});s=e.reviewDraft(s,id(s));for(let i=0;i<3;i++)s=decide(s,i,'reject');const before=clone(s.drafts[0].memoryDecisionHistory);s=e.reviewDraft(s,id(s));assert.equal(s.drafts[0].memoryDecisions.length,0);assert.deepEqual(s.drafts[0].memoryDecisionHistory,before);assert.throws(()=>e.acceptDraft(s,id(s)),{code:'MEMORY_DECISION_REQUIRED'});});

test('offline re-review invalidates an open override dialog even before any decision was recorded',()=>{let s=extracted({live:false});s=e.reviewDraft(s,id(s));const previous=e.getMemoryReviewGate(s,id(s))[0],epoch=s.drafts[0].memoryReviewEpoch;assert.equal(s.drafts[0].memoryDecisions.length,0);s=e.reviewDraft(s,id(s));assert.equal(s.drafts[0].memoryReviewEpoch,epoch+1);assert.throws(()=>e.decideMemoryCandidate(s,id(s),{candidateId:previous.candidateId,action:'override_keep',reason:'旧对话框的理由',reviewHash:previous.reviewHash},previous.binding),{code:'STALE_MEMORY_DECISION'});s=decide(s,0,'override_keep','重新查看当前结构审阅后确认');assert.equal(e.getMemoryReviewGate(s,id(s))[0].resolved,true);});
