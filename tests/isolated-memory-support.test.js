import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import {parseBackup,importBackup} from '../src/storage.js';
const clone=structuredClone;
const id=s=>s.drafts[0].id;
const candidate=(s,index=0)=>s.drafts[0].staging[index].id;
const envelope=s=>({format:1,serial:0,state:s,editing:{},patch:null});
const provider={id:'offline-isolated-fixture',isLive:false};
function fixture() {
 let s=e.createProjectFromConfig({projectId:'isolated-memory'});
 const text='阿陶说：“你总得问点什么。”\n“先问这锁。”程岚说，“收费低。”';
 s=e.stageProseDraft(s,{text,context:e.getContext(s),provider:{id:'fixture-writer',isLive:true}},'ch1');s=e.beginMemoryExtraction(s,id(s));
 s=e.attachMemoryExtraction(s,id(s),{staging:[{label:'阿陶催促程岚问点什么，程岚回应先问锁，收费低',sourceParagraphIndex:0},{label:'程岚回应先问这锁，收费低',sourceParagraphIndex:1}],reviewNotes:[],provider},e.createExtractionBinding(s,id(s)));
 s=e.reviewDraft(s,id(s));s=e.attachSemanticReview(s,id(s),{summary:'旧混合检查',issues:[],checks:[],provider,memoryChecks:s.drafts[0].staging.map(c=>({candidateId:c.id,status:'supported',explanation:'旧混合检查借用了整篇正文及另一条引文'}))},e.createReviewBinding(s,id(s)));
 return s;
}
function begin(s,index=0){return e.beginMemorySupportAssessment(s,id(s),candidate(s,index));}
function audit(s,index=0,status='supported',explanation='本条完整标签可由本条引文支持') {
 s=begin(s,index);return e.attachMemorySupportAssessment(s,id(s),candidate(s,index),{status,explanation,provider},e.createMemorySupportBinding(s,id(s),candidate(s,index)));
}
function decide(s,index=0,action='attest_keep',reason='作者逐条确认主张并承担其解释责任') {
 const row=e.getMemoryReviewGate(s,id(s))[index];return e.decideMemoryCandidate(s,id(s),{candidateId:row.candidateId,action,reason,...(action==='attest_keep'?{attestation:{protocol:'quote-grounded-memory-v1',accepted:true,statement:e.MEMORY_ATTESTATION_STATEMENT}}:{}),reviewHash:row.reviewHash},row.binding);
}

test('legacy bundled supported, including the retained sibling-borrowing failure, cannot authorize ordinary keep',()=>{
 const s=fixture(),row=e.getMemoryReviewGate(s,id(s))[0];assert.equal(row.status,'unknown');assert.equal(row.canKeep,false);assert.equal(row.auditState,'not_started');assert.equal(row.legacyAssessment.status,'supported');assert.equal(row.legacyAssessment.assessmentOrigin,'legacy_combined_unverified');
 assert.throws(()=>decide(s,0,'keep'),{code:'MEMORY_DECISION_REQUIRED'});
 const overridden=decide(s,0,'attest_keep','作者知道尚无单条引文核验，明确保留');assert.equal(e.getMemoryReviewGate(overridden,id(s))[0].decision.assessment,'unknown');
});
test('network input is only the exact immutable original label and its own quote',()=>{
 const s=begin(fixture()),input=e.createMemorySupportInput(s,id(s),candidate(s));assert.deepEqual(Object.keys(input),['label','sourceQuote']);assert.equal(input.label,s.drafts[0].staging[0].label);assert.equal(input.sourceQuote,'阿陶说：“你总得问点什么。”');
 for(const forbidden of ['先问这锁','context','candidateId','memoryCandidates','chapterId','textSnapshot'])assert.equal(input.sourceQuote.includes(forbidden),false);
 input.label='caller mutation';assert.notEqual(s.drafts[0].staging[0].label,input.label);
 assert.throws(()=>e.createMemorySupportInput(fixture(),id(s),candidate(s)),{code:'STALE_MEMORY_SUPPORT'});
});
test('one isolated audit remains target-scoped advisory and preserves original claim/evidence',()=>{
 const original=fixture(),s=audit(original,1),rows=e.getMemoryReviewGate(s,id(s));assert.equal(rows[0].canKeep,false);assert.equal(rows[1].canKeep,false);assert.equal(rows[1].canAttest,true);assert.equal(rows[1].assessmentOrigin,'isolated-own-quote-v1');assert.equal(s.drafts[0].memorySupport.attempts.length,1);assert.deepEqual(s.drafts[0].staging,original.drafts[0].staging);
 let accepted=decide(s,1);accepted=decide(accepted,0,'reject');accepted=e.acceptDraft(accepted,id(s));assert.equal(accepted.events.length,1);assert.equal(accepted.events[0].label,original.drafts[0].staging[1].label);assert.equal(accepted.events[0].memoryDecision.supportAttemptId,rows[1].isolatedAssessmentId);
});
test('isolated unsupported or unknown cannot enable ordinary keep but remains explicit attestation evidence',()=>{
 for(const status of ['unsupported','unknown']){const s=audit(fixture(),0,status,'本条引文没有回应内容，不能借用另一条引文');assert.throws(()=>decide(s,0,'keep'),{code:'MEMORY_DECISION_REQUIRED'});const next=decide(s,0,'attest_keep','作者理解单条引文不足，明确承担此例外');const row=e.getMemoryReviewGate(next,id(next))[0];assert.equal(row.status,status);assert.equal(row.decision.assessment,status);assert.ok(row.decision.supportAttemptId);}
});
test('isolated response schema rejects model-supplied identities, scope stamps and bundled checks',()=>{
 const s=begin(fixture()),key=id(s),cid=candidate(s),binding=e.createMemorySupportBinding(s,key,cid),valid={status:'supported',explanation:'核验说明',provider};
 for(const report of [null,{...valid,candidateId:cid},{...valid,assessmentOrigin:'isolated-own-quote-v1'},{...valid,memoryChecks:[]},{...valid,status:'probably'},{...valid,explanation:{}},{...valid,explanation:''},{...valid,explanation:'x'.repeat(4001)},{...valid,provider:null}])assert.throws(()=>e.attachMemorySupportAssessment(s,key,cid,report,binding),{code:'INVALID_MEMORY_SUPPORT'});
 for(const length of [2001,4000])assert.equal(e.attachMemorySupportAssessment(s,key,cid,{...valid,explanation:'x'.repeat(length)},binding).drafts[0].memorySupport.attempts.at(-1).result.explanation.length,length);
});
test('all local request identity and exact binding fields are enforced without being sent upstream',()=>{
 const s=begin(fixture()),key=id(s),cid=candidate(s),binding=e.createMemorySupportBinding(s,key,cid),report={status:'supported',explanation:'核验',provider};
 for(const field of Object.keys(binding)){const bad=clone(binding);delete bad[field];assert.throws(()=>e.attachMemorySupportAssessment(s,key,cid,report,bad),{code:'STALE_MEMORY_SUPPORT'});}
 for(const field of Object.keys(binding.reviewBinding)){const bad=clone(binding);delete bad.reviewBinding[field];assert.throws(()=>e.attachMemorySupportAssessment(s,key,cid,report,bad),{code:'STALE_MEMORY_SUPPORT'});}
 assert.throws(()=>e.attachMemorySupportAssessment(s,key,candidate(s,1),report,binding),{code:'STALE_MEMORY_SUPPORT'});
 assert.throws(()=>e.attachMemorySupportAssessment(s,key,cid,report,{...binding,extra:true}),{code:'STALE_MEMORY_SUPPORT'});
});
test('candidate re-audit invalidates its decision immediately without changing review epoch or other decisions',()=>{
 let s=audit(audit(fixture(),0,'unsupported'),1);s=decide(s,0,'attest_keep','作者例外');s=decide(s,1);const before=clone(s),epoch=s.drafts[0].memoryReviewEpoch,facts=clone(s.drafts[0].factDecisions);
 s=begin(s,0);const rows=e.getMemoryReviewGate(s,id(s));assert.equal(s.drafts[0].memoryReviewEpoch,epoch);assert.deepEqual(s.drafts[0].factDecisions,facts);assert.equal(rows[0].resolved,false);assert.equal(rows[0].auditState,'pending');assert.equal(rows[1].resolved,true);assert.equal(rows[1].canKeep,false);assert.equal(rows[1].canAttest,true);assert.deepEqual(s.drafts[0].memoryDecisionHistory,before.drafts[0].memoryDecisionHistory);
});
test('same-candidate replacement, cancellation, failure and replay never revive prior support',()=>{
 let s=decide(audit(fixture(),0)),key=id(s),cid=candidate(s);s=begin(s);const old=e.createMemorySupportBinding(s,key,cid);s=begin(s);const current=e.createMemorySupportBinding(s,key,cid),report={status:'supported',explanation:'核验',provider};
 assert.throws(()=>e.attachMemorySupportAssessment(s,key,cid,report,old),{code:'STALE_MEMORY_SUPPORT'});assert.deepEqual(e.markMemorySupportFailure(s,key,cid,old),s);
 for(const status of ['failed','cancelled']){const ended=e.markMemorySupportFailure(s,key,cid,current,status);assert.equal(e.getMemoryReviewGate(ended,key)[0].canKeep,false);assert.equal(e.getMemoryReviewGate(ended,key)[0].auditState,status);assert.throws(()=>e.attachMemorySupportAssessment(ended,key,cid,report,current),{code:'STALE_MEMORY_SUPPORT'});}
 s=e.attachMemorySupportAssessment(s,key,cid,report,current);assert.throws(()=>e.attachMemorySupportAssessment(s,key,cid,report,current),{code:'STALE_MEMORY_SUPPORT'});assert.equal(s.drafts[0].memorySupport.attempts.length,3);
});
test('parallel explicitly started different-candidate assessments do not stale each other',()=>{
 let s=begin(fixture(),0),a=e.createMemorySupportBinding(s,id(s),candidate(s));s=begin(s,1);const b=e.createMemorySupportBinding(s,id(s),candidate(s,1));
 s=e.attachMemorySupportAssessment(s,id(s),candidate(s,1),{status:'supported',explanation:'第二条',provider},b);s=e.attachMemorySupportAssessment(s,id(s),candidate(s),{status:'unsupported',explanation:'第一条不足',provider},a);
 assert.deepEqual(e.getMemoryReviewGate(s,id(s)).map(row=>row.status),['unsupported','supported']);
});
test('open keep/override decisions expire at audit begin and at result completion',()=>{
 let s=fixture(),old=e.getMemoryReviewGate(s,id(s))[0];s=begin(s);assert.throws(()=>e.decideMemoryCandidate(s,id(s),{candidateId:old.candidateId,action:'attest_keep',reason:'旧视图',reviewHash:old.reviewHash},old.binding),{code:'STALE_MEMORY_DECISION'});
 const pending=e.getMemoryReviewGate(s,id(s))[0],binding=e.createMemorySupportBinding(s,id(s),candidate(s));s=e.attachMemorySupportAssessment(s,id(s),candidate(s),{status:'unknown',explanation:'新结果',provider},binding);
 assert.throws(()=>e.decideMemoryCandidate(s,id(s),{candidateId:pending.candidateId,action:'attest_keep',reason:'等待中视图',reviewHash:pending.reviewHash},pending.binding),{code:'STALE_MEMORY_DECISION'});
});
test('review, edit, extraction, rejection, state/context changes invalidate late isolated results and retain attempts',()=>{
 const s=begin(fixture()),key=id(s),cid=candidate(s),binding=e.createMemorySupportBinding(s,key,cid),report={status:'supported',explanation:'核验',provider};
 const variants=[e.reviewDraft(s,key),e.beginSemanticReview(s,key),e.editDraft(s,key,'新正文。'),e.beginMemoryExtraction(s,key),e.rejectDraft(s,key)];
 for(const changed of variants){assert.throws(()=>e.attachMemorySupportAssessment(changed,key,cid,report,binding),{code:'STALE_MEMORY_SUPPORT'});assert.equal(changed.drafts[0].memorySupport.attempts.length,1);assert.equal(changed.drafts[0].memorySupport.attempts[0].state,'cancelled');}
 for(const mutate of [n=>{n.version++},n=>{n.config.boundaries='changed'},n=>{n.drafts[0].staging[0].label='rewritten'},n=>{n.drafts[0].modelReview.summary='rewritten'}]){const changed=clone(s);mutate(changed);assert.throws(()=>e.attachMemorySupportAssessment(changed,key,cid,report,binding),{code:'STALE_MEMORY_SUPPORT'});}
});
test('support/legacy imported display fields are validated and imports revoke all support authority',()=>{
 const original=decide(audit(fixture(),1),1),key=id(original);
 for(const mutate of [d=>{d.modelReview.memoryChecks[0].explanation={text:'bad'}},d=>{d.modelReview.memoryChecks[0].status={}},d=>{d.memorySupport.attempts[0].result.explanation={}},d=>{d.memorySupport.attempts[0].result.status={}},d=>{d.memorySupport.attempts[0].protocol='combined-review'},d=>{d.memorySupport.attempts[0].resultSnapshot.status='unsupported'},d=>{d.memorySupport.attempts[0].candidateId='foreign'},d=>{d.memorySupport.heads[0].attemptId='foreign'}]){const changed=clone(original);mutate(changed.drafts[0]);assert.throws(()=>parseBackup(JSON.stringify(envelope(changed))));}
 const imported=importBackup(envelope(e.createProjectFromConfig({projectId:'target'})),envelope(original),()=> 'imported');assert.deepEqual(imported.state.drafts[0].memorySupport.heads,[]);assert.equal(imported.state.drafts[0].memorySupport.attempts[0].state,'complete');assert.deepEqual(imported.state.drafts[0].memoryDecisions,[]);assert.deepEqual(imported.state.importOrigin.original.state,original);assert.throws(()=>e.acceptDraft(imported.state,key),{code:'REVIEW_REQUIRED'});
 assert.deepEqual(parseBackup(JSON.stringify(imported)),imported);
});
test('isolated result and binding mutations cannot grant or preserve keep',()=>{
 const original=decide(audit(fixture(),1),1);
 for(const mutate of [d=>{d.memorySupport.attempts[0].result.status='unsupported'},d=>{d.memorySupport.attempts[0].result.explanation='changed'},d=>{d.memorySupport.attempts[0].authorityId='foreign'},d=>{d.memorySupport.heads=[]},d=>{d.memoryDecisions[0].supportAttemptId='foreign'},d=>{d.memoryDecisions[0].supportState='pending'}]){const changed=clone(original);mutate(changed.drafts[0]);assert.equal(e.getMemoryReviewGate(changed,id(changed))[1].resolved,false);}
});


test('restoring an older supported head after failed re-audit is rejected rather than reviving authority',()=>{
 let s=audit(fixture(),1),old=s.drafts[0].memorySupport.heads[0].attemptId;s=begin(s,1);s=e.markMemorySupportFailure(s,id(s),candidate(s,1),e.createMemorySupportBinding(s,id(s),candidate(s,1)));
 s.drafts[0].memorySupport.heads[0].attemptId=old;assert.equal(e.getMemoryReviewGate(s,id(s))[1].canKeep,false);assert.throws(()=>parseBackup(JSON.stringify(envelope(s))));
});
test('legacy pending keep decisions remain readable but cannot promote; historic accepted keeps remain explicitly unverified',()=>{
 let s=decide(audit(fixture(),1),1);s=decide(s,0,'reject');
 const downgrade=d=>{delete d.memorySupport;for(const record of [...d.memoryDecisions,...d.memoryDecisionHistory]){if(record.action==='attest_keep')record.action='keep';for(const key of ['supportAttemptId','supportState','supportResultHash','selectionProtocol','attestation','quoteSnapshot'])delete record[key];}};
 const pending=clone(s);downgrade(pending.drafts[0]);const restored=parseBackup(JSON.stringify(envelope(pending))).state;assert.equal(e.getMemoryReviewGate(restored,id(restored))[1].canKeep,false);assert.equal(e.getMemoryReviewGate(restored,id(restored))[1].resolved,false);assert.throws(()=>e.acceptDraft(restored,id(restored)),{code:'MEMORY_DECISION_REQUIRED'});
 s=e.acceptDraft(s,id(s));downgrade(s.drafts[0]);for(const record of [...s.drafts[0].acceptedMemoryDecisions,...s.events.map(event=>event.memoryDecision)]){if(record.action==='attest_keep')record.action='keep';for(const field of ['supportAttemptId','supportState','supportResultHash','selectionProtocol','attestation','quoteSnapshot'])delete record[field];}for(const event of s.events){delete event.memoryKind;delete event.memoryTrust;delete event.originalLabel;}const historical=parseBackup(JSON.stringify(envelope(s))).state,row=e.getMemoryReviewGate(historical,id(historical))[1];assert.equal(row.historical,true);assert.equal(row.assessmentOrigin,'historic_combined_unverified');assert.equal(row.resolved,true);assert.equal(row.canKeep,false);assert.equal(e.acceptDraft(historical,id(historical)).drafts[0].status,'ACCEPTED');
});
test('a scope stamp on a legacy combined model report does not upgrade it to isolated authority',()=>{
 const s=fixture();s.drafts[0].modelReview.assessmentOrigin='isolated-own-quote-v1';s.drafts[0].modelReview.protocol='isolated-own-quote-v1';const row=e.getMemoryReviewGate(s,id(s))[0];assert.equal(row.canKeep,false);assert.equal(row.isolatedAssessmentId,null);assert.equal(row.assessmentOrigin,'not_audited');assert.throws(()=>decide(s,0,'keep'),{code:'MEMORY_DECISION_REQUIRED'});
});

test('a one-candidate audit preserves an already explicit fact exception and its exact review generation',()=>{
 let s=e.createProjectFromConfig({projectId:'fact-and-isolated',chapters:[{text:'纸灯是蓝色的。'}]});s=e.commitPatch(s,e.proposeCustomPatch(s,'ch1',{intent:'author_fact',statement:'纸灯是蓝色的。'}));
 s=e.stageProviderDraft(s,{text:'纸灯是红色的。',staging:[{label:'纸灯为红色',sourceQuote:'纸灯是红色的。'}],context:e.getContext(s),provider:{id:'writer',isLive:true}},'ch2');s=e.reviewDraft(s,id(s));s=e.attachSemanticReview(s,id(s),{summary:'颜色冲突',issues:[],checks:[],provider,factChecks:[{factId:s.facts[0].id,recordVersion:1,status:'contradiction',explanation:'蓝色与红色矛盾',sourceQuote:'纸灯是红色的。'}]},e.createReviewBinding(s,id(s)));
 s=e.resolveFactReview(s,id(s),{factId:s.facts[0].id,recordVersion:1,action:'accept_exception',reason:'作者刻意保留叙述差异',reviewHash:e.hash(JSON.stringify(s.drafts[0].modelReview))},e.createReviewBinding(s,id(s)));
 const before=clone(s.drafts[0].factDecisions),review=clone(s.drafts[0].modelReview),epoch=s.drafts[0].memoryReviewEpoch;s=audit(s,0);assert.deepEqual(s.drafts[0].factDecisions,before);assert.deepEqual(s.drafts[0].modelReview,review);assert.equal(s.drafts[0].memoryReviewEpoch,epoch);assert.equal(e.getFactReviewGate(s,id(s))[0].resolved,true);
});
test('exact result snapshots reject a changed pending dialog even when the legacy hash collides',()=>{
 let s=audit(fixture(),1,'supported','😀');const row=e.getMemoryReviewGate(s,id(s))[1],attempt=s.drafts[0].memorySupport.attempts[0];assert.equal(e.hash('😀'),e.hash('😁'));attempt.result.explanation='😁';attempt.resultSnapshot.explanation='😁';
 assert.throws(()=>e.decideMemoryCandidate(s,id(s),{candidateId:row.candidateId,action:'attest_keep',reason:'旧结果视图',reviewHash:row.reviewHash},row.binding),{code:'STALE_MEMORY_DECISION'});
});
