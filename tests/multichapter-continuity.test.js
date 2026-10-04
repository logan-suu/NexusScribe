import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import {parseBackup,importBackup} from '../src/storage.js';
import {validateInput} from '../server/provider.js';

const fresh=()=>e.createProjectFromConfig({projectId:'multichapter',idea:'阿岚到岛上寻找失踪的朋友。'});
function accepted(state=fresh(),{chapterId='ch1',text='阿岚拾起铜钥匙。\n她不相信陌生人的话。',entries=[{label:'阿岚获得铜钥匙',sourceParagraphIndex:0},{label:'陌生人说的都是真的',sourceParagraphIndex:1}],actions=['attest_keep','reject'],finalize=true}={}) {
 state=e.stageProseDraft(state,{text,context:e.getContext(state),provider:{id:'offline-fixture',isLive:false}},chapterId);
 const id=state.drafts.at(-1).id;
 state=e.beginMemoryExtraction(state,id);
 state=e.attachMemoryExtraction(state,id,{staging:entries,reviewNotes:[],provider:'offline-fixture'},e.createExtractionBinding(state,id));
 state=e.reviewDraft(state,id);
 for(const [index,candidate] of state.drafts.at(-1).staging.entries()){
  const action=actions[index]??'reject';
  if(action==='attest_keep'&&index===0){
   state=e.beginMemorySupportAssessment(state,id,candidate.id);
   state=e.attachMemorySupportAssessment(state,id,candidate.id,{status:'supported',explanation:'合成测试判断，非真实模型证据',provider:'isolated-fixture'},e.createMemorySupportBinding(state,id,candidate.id));
  }
  const row=e.getMemoryReviewGate(state,id).find(item=>item.candidateId===candidate.id);
  state=e.decideMemoryCandidate(state,id,{candidateId:candidate.id,action,...(action==='attest_keep'?{reason:'作者明确保留此主张，知悉尚未独立核对',attestation:{protocol:'quote-grounded-memory-v1',accepted:true,statement:e.MEMORY_ATTESTATION_STATEMENT}}:{}),reviewHash:row.reviewHash},row.binding);
 }
 return finalize?e.acceptDraft(state,id):state;
}
const backup=state=>({format:1,serial:0,state,editing:{},patch:null});

test('accepted chapter passes only explicitly selected current memories to later chapter context',()=>{
 const state=accepted(),before=structuredClone(state),context=e.getContext(state);
 assert.equal(context.events.length,1);assert.equal(context.events[0].label,'阿岚获得铜钥匙');
 assert.equal(context.events[0].memoryDecision.action,'attest_keep');assert.equal(context.events[0].memoryDecision.assessment,'supported');
 const source=context.events[0].source,chapter=context.sources.find(item=>item.chapterId===source.chapterId);
 assert.equal(source.revision,chapter.revision);assert.equal(chapter.text.slice(source.start,source.end),'阿岚拾起铜钥匙。');
 assert.equal(JSON.stringify(context).includes('陌生人说的都是真的'),false);
 assert.equal(context.memoryContext.included,1);assert.equal(context.memoryContext.staleSource,0);
 assert.deepEqual(state,before);
 context.events[0].source.revision=999;context.events[0].memoryDecision.action='reject';assert.deepEqual(state,before);
});

test('three accepted chapters preserve prior selections without recursive audit or inferred knowledge',()=>{
 let state=accepted();
 state=accepted(state,{chapterId:'ch2',text:'阿岚走到北门。',entries:[{label:'阿岚到达北门',sourceParagraphIndex:0}],actions:['attest_keep']});
 const context=e.getContext(state);
 assert.deepEqual(context.events.map(item=>item.label),['阿岚获得铜钥匙','阿岚到达北门']);
 assert.equal(context.events[1].memoryDecision.action,'attest_keep');assert.equal(context.events[1].trust,'author_attested_unverified');
 assert.deepEqual(context.knowledge,[]);assert.deepEqual(context.facts,[]);
 assert.equal(context.events[0].kind,'author_attested_paraphrase');assert.equal(context.events[0].trust,'author_attested_unverified');
 for(const key of ['memoryBindingSnapshots','memoryDecisionHistory','supportResultHash','reviewHash','authorityId'])assert.equal(JSON.stringify(context).includes(key),false);
 state=accepted(state,{chapterId:'ch3',text:'阿岚在门外停下脚步。',entries:[],actions:[]});
 assert.equal(e.getContext(state).events.length,2);assert.ok(state.chapters.every(item=>item.status==='ACCEPTED'));
});

test('reject-all retains manuscript evidence and states the auxiliary-memory boundary explicitly',()=>{
 const state=accepted(fresh(),{actions:['reject','reject']}),context=e.getContext(state);
 assert.deepEqual(context.events,[]);assert.ok(context.sources[0].text.includes('阿岚拾起铜钥匙。'));
 assert.match(context.memoryContext.policy,/Rejected or omitted memory labels do not erase facts expressed by the accepted manuscript/);
 assert.match(context.memoryContext.policy,/not independently verified truth/);
});

test('planned placeholders are labeled separately from accepted manuscript without dropping source snapshots',()=>{
 const planned=e.getContext(fresh());assert.equal(planned.sources.length,3);
 assert.equal(planned.sceneTime,null);assert.deepEqual(planned.sources.map(source=>source.chapterIndex),[0,1,2]);
 assert.equal(e.getContext(e.createInitialState()).sceneTime,3);
 assert.ok(planned.sources.every(source=>source.role==='planned_content'&&source.chapterStatus==='PLANNED'&&source.channel==='planning_text'));
 const state=accepted(),context=e.getContext(state);
 assert.equal(context.sources[0].role,'accepted_manuscript');assert.equal(context.sources[0].channel,'original_text');
 assert.equal(context.sources[1].role,'planned_content');
 const saved=e.saveRevision(state,'ch1',state.chapters[0].text+'\n风停了。',state.chapters[0].revision);
 assert.equal(e.getContext(saved).sources[0].role,'unaccepted_manuscript');assert.equal(e.getContext(saved).sources[0].syncStatus,'PENDING');
});

test('replacement chapter excludes obsolete memories but preserves their complete original history',()=>{
 const original=accepted(),event=structuredClone(original.events[0]);
 const state=accepted(original,{text:'阿岚空手离开了码头。',entries:[],actions:[]}),context=e.getContext(state);
 assert.deepEqual(state.events,[event]);assert.deepEqual(context.events,[]);assert.equal(context.memoryContext.staleSource,1);
 assert.equal(state.chapters[0].revisions.find(item=>item.revision===event.source.revision).text.includes(event.source.quote),true);
});

test('even quote-preserving source revisions need new memory authority; unrelated chapter edits do not revoke them',()=>{
 const state=accepted();
 let changed=e.saveRevision(state,'ch1',state.chapters[0].text+'\n海风吹来。',state.chapters[0].revision);
 changed=e.commitPatch(changed,e.proposeCustomPatch(changed,'ch1',{intent:'local_prose'}));
 assert.deepEqual(e.getContext(changed).events,[]);assert.equal(e.getContext(changed).memoryContext.staleSource,1);
 let other=e.saveRevision(state,'ch3','后来，潮水涨了。',state.chapters[2].revision);
 other=e.commitPatch(other,e.proposeCustomPatch(other,'ch3',{intent:'local_prose'}));
 assert.equal(e.getContext(other).events.length,1);
});

test('pending, rejected, forged and source-mismatched events never become selected memory context',()=>{
 const original=accepted();
 for(const change of [
  state=>{state.events[0].memoryDecision.action='reject'},
  state=>{state.events[0].label='阿岚知道所有秘密'},
  state=>{state.events[0].source.quote='没有发生的事件'},
  state=>{state.events[0].source.start++},
  state=>{state.drafts[0].status='REJECTED'},
  state=>{state.drafts[0].acceptedMemoryDecisions=[]},
  state=>{state.drafts[0].memoryDecisionHistory=[]},
 ]){const state=structuredClone(original);change(state);assert.deepEqual(e.getContext(state).events,[]);}
 let state=e.stageProseDraft(original,{text:'阿岚找到一封信。',context:e.getContext(original),provider:'offline-fixture'},'ch2');
 assert.equal(e.getContext(state).events.length,1);
 state=e.rejectDraft(state,state.drafts.at(-1).id);assert.equal(e.getContext(state).events.length,1);
});

test('memory projection has a byte budget with explicit omissions, without truncating labels or manuscript',()=>{
 const labels=Array.from({length:30},(_,index)=>`${index}：${'作者选择的完整主张'.repeat(90)}`);
 const state=accepted(fresh(),{text:'完整原文。',entries:labels.map(label=>({label,sourceParagraphIndex:0})),actions:Array(30).fill('attest_keep')}),context=e.getContext(state);
 assert.ok(context.events.length>0&&context.events.length<30);assert.equal(context.memoryContext.omittedByLimit,30-context.events.length);
 assert.ok(new TextEncoder().encode(JSON.stringify(context.events)).length<=context.memoryContext.maxBytes);
 assert.ok(context.events.every(event=>labels.includes(event.label)));assert.equal(context.sources[0].text,'完整原文。');
 validateInput('generateProse',{project:{projectId:state.projectId,idea:state.config.idea,outline:state.chapters.map(ch=>({id:ch.id}))},chapterIndex:1,context});
});

test('long evidence paragraphs are referenced by exact UTF-16 offsets, not copied repeatedly',()=>{
 const text='😀'+'长'.repeat(8000),state=accepted(fresh(),{text,entries:Array.from({length:30},(_,index)=>({label:`完整候选${index}`,sourceParagraphIndex:0})),actions:Array(30).fill('attest_keep')}),context=e.getContext(state);
 assert.equal(context.events.length,30);
 assert.ok(context.events.every(event=>event.source.start===0&&event.source.end===text.length));
 assert.ok(new TextEncoder().encode(JSON.stringify(context.events)).length<16000);
 assert.equal(context.sources[0].text,text);
});

test('context survives backup roundtrip and project import without leaking audit snapshots',()=>{
 const state=accepted(),roundtrip=parseBackup(JSON.stringify(backup(state))).state;
 assert.deepEqual(e.getContext(roundtrip),e.getContext(state));
 const imported=importBackup(backup(e.createProjectFromConfig({projectId:'another'})),backup(state),()=> 'imported-continuity').state;
 assert.equal(e.getContext(imported).events.length,1);assert.equal(e.getContext(imported).projectId,'imported-continuity');
 assert.equal(JSON.stringify(e.getContext(imported)).includes('importOrigin'),false);
});

test('legacy selected events resolve repeated paragraph evidence to the correct paragraph',()=>{
 let state=fresh();state=e.stageProviderDraft(state,{text:'同一句话。\n同一句话。',staging:[{label:'第二段事件',sourceQuote:'同一句话。',sourceParagraphIndex:1}],context:e.getContext(state),provider:'offline-fixture'},'ch1');
 const id=state.drafts[0].id;state=e.reviewDraft(state,id);const row=e.getMemoryReviewGate(state,id)[0];
 state=e.decideMemoryCandidate(state,id,{candidateId:row.candidateId,action:'attest_keep',attestation:{protocol:'quote-grounded-memory-v1',accepted:true,statement:e.MEMORY_ATTESTATION_STATEMENT},reason:'作者选择第二段',reviewHash:row.reviewHash},row.binding);state=e.acceptDraft(state,id);
 const event=e.getContext(state).events[0];assert.equal(event.source.paragraphId,'p2');assert.equal(event.source.start,'同一句话。\n'.length);
});

function makeLegacyContext(d){
 delete d.context.contextSchemaVersion;delete d.context.events;delete d.context.memoryContext;d.context.sceneTime=3;
 for(const source of d.context.sources){delete source.chapterIndex;delete source.chapterStatus;delete source.syncStatus;delete source.role;source.channel='original_text';}
 if(d.extraction.binding)d.extraction.binding.contextHash=e.hash(JSON.stringify(d.context));
}

test('older saved prose contexts stay readable and require explicit context refresh instead of silent rebinding',()=>{
 let state=fresh();state=e.stageProseDraft(state,{text:'作者需要保留的旧版候选。',context:e.getContext(state),provider:'offline-fixture'},'ch1');
 const d=state.drafts[0];makeLegacyContext(d);
 state=parseBackup(JSON.stringify(backup(state))).state;const before=structuredClone(state);
 assert.equal(e.hasCurrentExtraction(state,d.id),false);
 assert.throws(()=>e.beginMemoryExtraction(state,d.id),error=>error.code==='CONTEXT_UPGRADE_REQUIRED'&&error.message.includes('更新参考上下文'));
 assert.deepEqual(state,before);
 const reviewed=e.reviewDraft(state,d.id);assert.equal(reviewed.drafts[0].review.passed,false);
 assert.ok(reviewed.drafts[0].review.issues.some(issue=>issue.ruleId==='CONTEXT_UPGRADE_REQUIRED'));
 assert.throws(()=>e.acceptDraft(reviewed,d.id),{code:'REVIEW_REQUIRED'});
 assert.equal(reviewed.drafts[0].text,'作者需要保留的旧版候选。');assert.deepEqual(reviewed.drafts[0].context,before.drafts[0].context);
 const refreshed=e.refreshDraftContext(state,d.id);
 assert.equal(e.isDraftContextCurrent(refreshed,d.id),true);assert.equal(refreshed.drafts[0].text,d.text);
 assert.deepEqual(refreshed.drafts[0].proseVersions,d.proseVersions);
 assert.equal(e.beginMemoryExtraction(refreshed,d.id).drafts[0].extraction.status,'pending');
 assert.equal(parseBackup(JSON.stringify(backup(refreshed))).state.drafts[0].memoryArchives.at(-1).reason,'context_refreshed');
});

test('refresh after preceding chapter changes keeps prose, archives prior context and revokes extraction and choices',()=>{
 let state=accepted();state=accepted(state,{chapterId:'ch2',finalize:false});
 const d=state.drafts.at(-1),id=d.id,old=structuredClone(d),oldBinding=e.createExtractionBinding(state,id),oldChoice=e.getMemoryReviewGate(state,id)[0];
 state=e.saveRevision(state,'ch1',state.chapters[0].text+'\n阿岚转向北门。',state.chapters[0].revision);
 assert.throws(()=>e.refreshDraftContext(state,id),{code:'UNSYNCED_TEXT'});
 state=e.commitPatch(state,e.proposeCustomPatch(state,'ch1',{intent:'local_prose'}));
 assert.equal(e.isDraftContextCurrent(state,id),false);
 const refreshed=e.refreshDraftContext(state,id),next=refreshed.drafts.at(-1),archive=next.memoryArchives.at(-1);
 assert.equal(next.text,old.text);assert.deepEqual(next.proseVersions,old.proseVersions);assert.equal(next.revision,old.revision);
 assert.equal(next.baseVersion,refreshed.version);assert.equal(next.chapterRevisions.ch1,refreshed.chapters[0].revision);
 assert.deepEqual(next.context,e.getContext(refreshed));assert.equal(e.isDraftContextCurrent(refreshed,id),true);
 assert.equal(next.review,null);assert.equal(next.modelReview,null);assert.deepEqual(next.staging,[]);assert.deepEqual(next.memoryDecisions,[]);
 assert.deepEqual(next.memoryDecisionHistory,old.memoryDecisionHistory);assert.deepEqual(next.memorySupport.heads,[]);
 assert.equal(next.extraction.status,'pending');assert.equal(next.extraction.binding,null);assert.equal(next.extraction.attempt,old.extraction.attempt+1);
 assert.equal(archive.reason,'context_refreshed');assert.deepEqual(archive.decisions,old.memoryDecisions);
 const snapshot=next.memoryBindingSnapshots.find(item=>item.id===archive.contextBinding.snapshotId);
 assert.deepEqual(snapshot.values.contextSnapshot,old.context);assert.equal(snapshot.values.textSnapshot,old.text);
 assert.throws(()=>e.attachMemoryExtraction(refreshed,id,{staging:[],reviewNotes:[],provider:'late'},oldBinding),{code:'STALE_EXTRACTION'});
 assert.throws(()=>e.decideMemoryCandidate(refreshed,id,{candidateId:oldChoice.candidateId,action:'keep_quote',reviewHash:oldChoice.reviewHash},oldChoice.binding),{code:'STALE_MEMORY_DECISION'});
 assert.throws(()=>e.acceptDraft(refreshed,id),{code:'REVIEW_REQUIRED'});
 assert.deepEqual(e.refreshDraftContext(refreshed,id),refreshed);
 const restored=parseBackup(JSON.stringify(backup(refreshed))).state;
 assert.equal(e.isDraftContextCurrent(restored,id),true);
 const imported=importBackup(backup(e.createProjectFromConfig({projectId:'different'})),backup(refreshed),()=> 'refreshed-import').state;
 assert.equal(e.isDraftContextCurrent(imported,id),true);assert.equal(imported.drafts.at(-1).memoryArchives.findLast(archive=>archive.reason==='context_refreshed').contextBinding.projectId,'refreshed-import');
});

test('complete and imported pre-upgrade prose can refresh without dropping prose history or enabling old acceptance',()=>{
 for(const imported of [false,true]){
  let state=accepted(fresh(),{finalize:false}),id=state.drafts[0].id;makeLegacyContext(state.drafts[0]);
  state=parseBackup(JSON.stringify(backup(state))).state;
  if(imported)state=importBackup(backup(e.createProjectFromConfig({projectId:'other'})),backup(state),()=> 'legacy-import').state;
  const old=structuredClone(state.drafts[0]);assert.equal(e.isDraftContextCurrent(state,id),false);
  state=e.refreshDraftContext(state,id);assert.equal(e.isDraftContextCurrent(state,id),true);assert.equal(state.drafts[0].text,old.text);
  assert.deepEqual(state.drafts[0].proseVersions,old.proseVersions);assert.deepEqual(state.drafts[0].memoryDecisionHistory,old.memoryDecisionHistory);
  assert.deepEqual(state.drafts[0].staging,[]);assert.equal(e.hasCurrentExtraction(state,id),false);
  assert.throws(()=>e.acceptDraft(state,id),{code:'REVIEW_REQUIRED'});parseBackup(JSON.stringify(backup(state)));
 }
});

test('context refresh rejects accepted, rejected, cross-project and malformed prose drafts',()=>{
 const state=accepted(),id=state.drafts[0].id;assert.throws(()=>e.refreshDraftContext(state,id),{code:'DRAFT_STATUS'});
 const active=accepted(fresh(),{finalize:false}),activeId=active.drafts[0].id;
 assert.throws(()=>e.refreshDraftContext(e.rejectDraft(active,activeId),activeId),{code:'DRAFT_STATUS'});
 const foreign=structuredClone(active);foreign.projectId='different';assert.throws(()=>e.refreshDraftContext(foreign,activeId),{code:'PROJECT_MISMATCH'});
 const malformed=structuredClone(active);malformed.drafts[0].proseVersions[0].text='changed';assert.throws(()=>e.refreshDraftContext(malformed,activeId),{code:'INVALID_PROSE_SNAPSHOT'});
});

test('identical quotes cannot move an accepted event to a different paragraph or offset',()=>{
 const original=accepted(fresh(),{text:'阿岚拾起铜钥匙。\n\n阿岚拾起铜钥匙。',entries:[{label:'阿岚取得钥匙',sourceParagraphIndex:0}],actions:['attest_keep']});
 const state=structuredClone(original),second=state.chapters[0].revisions.at(-1).paragraphs[1];
 Object.assign(state.events[0].source,{paragraphId:second.id,start:second.start,end:second.end});
 parseBackup(JSON.stringify(backup(state)));assert.deepEqual(e.getContext(state).events,[]);assert.equal(e.getContext(state).memoryContext.unverifiedSelection,1);
});
