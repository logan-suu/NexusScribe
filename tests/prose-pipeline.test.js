import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import {segmentProse} from '../src/domain/prose.js';
import {parseBackup,importBackup} from '../src/storage.js';

const clone=structuredClone;
const raw='  阿岚带着😀走过桥。  \r\n\r\n\t\r\n  她拾起信件。\t\n尾声。\r';
const report=(staging=[])=>({staging,reviewNotes:[],provider:{id:'fixture-extractor',isLive:false}});
const event={label:'阿岚拾起信件',sourceParagraphIndex:1};
const fresh=(text=raw,{live=false,projectId='prose-project'}={})=>{
 const s=e.createProjectFromConfig({projectId,title:'独立正文',idea:'桥边发现信件'});
 return e.stageProseDraft(s,{text,context:e.getContext(s),provider:{id:'fixture-writer',isLive:live}},'ch1');
};
const id=s=>s.drafts.at(-1).id;
const begin=s=>e.beginMemoryExtraction(s,id(s));
const extracted=(s=fresh(),entries=[event])=>{
 s=begin(s);return e.attachMemoryExtraction(s,id(s),report(entries),e.createExtractionBinding(s,id(s)));
};
const reviewed=(s=extracted())=>e.reviewDraft(s,id(s));

const selected=s=>{for(const row of e.getMemoryReviewGate(s,id(s)))s=e.decideMemoryCandidate(s,id(s),{candidateId:row.candidateId,action:row.canKeep?'keep':'override_keep',reason:'测试作者明确核对并保留完整候选',reviewHash:row.reviewHash},row.binding);return s;};
const backup=s=>({format:1,serial:0,state:s,editing:{},patch:null});
const advisory={summary:'需要作者核对的模型候选审查',checks:[],issues:[],factChecks:[],provider:'fixture-review'};

test('segmentProse preserves whitespace and UTF-16 offsets across blank lines, CRLF and surrogate pairs',()=>{
 const paragraphs=segmentProse(raw);
 assert.deepEqual(paragraphs.map(p=>p.text),['  阿岚带着😀走过桥。  ','  她拾起信件。\t','尾声。']);
 assert.deepEqual(paragraphs.map(p=>[p.id,p.index]),[['p1',0],['p2',1],['p3',2]]);
 for(const p of paragraphs)assert.equal(raw.slice(p.start,p.end),p.text);
 assert.equal(paragraphs[1].start,raw.indexOf('  她'));assert.equal(paragraphs[2].end,raw.length-1);
 assert.deepEqual(segmentProse('\r\n \t\n'),[]);assert.throws(()=>segmentProse(null));
});
test('prose saves unchanged before extraction, ignores all supplied staging, and promotes nothing',()=>{
 const s=e.createProjectFromConfig({projectId:'raw-save'}),context=e.getContext(s),before=clone(s);
 const n=e.stageProseDraft(s,{text:raw,context,staging:{invalid:'must not erase prose'},paragraphs:['invented'],provider:'writer'},'ch1'),d=n.drafts[0];
 assert.equal(d.text,raw);assert.deepEqual(d.staging,[]);assert.equal(d.requiresExtraction,true);assert.deepEqual(d.extraction,{status:'pending',attempt:0,binding:null});
 assert.deepEqual(d.proseVersions,[{revision:1,text:raw,textHash:e.hash(raw),paragraphs:segmentProse(raw)}]);
 assert.deepEqual(n.facts,s.facts);assert.deepEqual(n.events,s.events);assert.deepEqual(n.chapters,s.chapters);assert.deepEqual(s,before);
 assert.equal(e.hasCurrentExtraction(n,d.id),false);
});
test('prose accepts one full-length paragraph, bounds total length, and never trims raw text',()=>{
 const text=' '+ '界'.repeat(29998)+' ';
 let s=fresh(text);assert.equal(s.drafts[0].text,text);assert.equal(s.drafts[0].proseVersions[0].paragraphs[0].text.length,30000);
 s=extracted(s,[{label:'长段候选',sourceParagraphIndex:0}]);assert.equal(s.drafts[0].staging[0].sourceQuote,text);
 assert.throws(()=>fresh('界'.repeat(30001)),{code:'INVALID_TEXT'});
 assert.throws(()=>e.editDraft(s,id(s),'界'.repeat(30001)),{code:'INVALID_TEXT'});
 assert.throws(()=>fresh(' \r\n\t'),{code:'INVALID_TEXT'});
});
test('new prose rejects wrong target, stale chapter snapshots, and changed exact context',()=>{
 const s=e.createProjectFromConfig({projectId:'origin'}),context=e.getContext(s);
 assert.throws(()=>e.stageProseDraft(s,{text:raw,chapterId:'ch2',context},'ch1'),{code:'CHAPTER_MISMATCH'});
 const altered=clone(context);altered.constitution.tone='invented';
 assert.throws(()=>e.stageProseDraft(s,{text:raw,context:altered},'ch1'),{code:'STALE_CONTEXT'});
 const saved=e.saveRevision(s,'ch2','new chapter',1);
 assert.throws(()=>e.stageProseDraft(saved,{text:raw,context},'ch1'),{code:'UNSYNCED_TEXT'});
});
test('unextracted prose cannot pass structural or semantic review or acceptance, even with forged passed review',()=>{
 let s=fresh(raw,{live:true}),key=id(s);s=e.reviewDraft(s,key);
 assert.equal(s.drafts[0].review.passed,false);assert.ok(s.drafts[0].review.issues.some(x=>x.ruleId==='EXTRACTION_REQUIRED'));
 assert.throws(()=>e.attachSemanticReview(s,key,advisory,e.createReviewBinding(s,key)),{code:'EXTRACTION_REQUIRED'});
 s.drafts[0].review.passed=true;
 assert.throws(()=>e.acceptDraft(s,key),{code:'REVIEW_REQUIRED'});assert.equal(s.events.length,0);
});
test('cannot attach extraction without a saved attempt; input and binding are independent copies',()=>{
 let s=fresh(),key=id(s),b=e.createExtractionBinding(s,key);
 assert.throws(()=>e.attachMemoryExtraction(s,key,report([event]),b),{code:'STALE_EXTRACTION'});
 const before=clone(s);s=begin(s);assert.deepEqual(before.drafts[0].staging,[]);
 b=e.createExtractionBinding(s,key);const input=e.createExtractionInput(s,key);
 assert.equal(b.attempt,1);assert.equal(b.textSnapshot,raw);assert.equal(b.projectId,s.projectId);assert.equal(b.draftId,key);assert.equal(b.runId,s.drafts[0].runId);
 input.context.sources[0].text='wrong';b.chapterRevisions.ch1=999;
 assert.notEqual(s.drafts[0].context.sources[0].text,'wrong');assert.equal(s.drafts[0].extraction.binding.chapterRevisions.ch1,1);
 assert.equal(input.text,raw);assert.equal(input.chapterId,'ch1');
});
test('valid extraction derives every evidence field and event ID but leaves Canon and chapters untouched',()=>{
 const s=fresh(),n=extracted(s),d=n.drafts[0],p=segmentProse(raw)[1];
 assert.equal(e.hasCurrentExtraction(n,id(n)),true);
 assert.deepEqual(d.staging,[{id:`extracted-${d.runId}-r1-a1-1`,label:event.label,sourceParagraphIndex:1,sourceParagraphId:'p2',sourceQuote:p.text,sourceStart:p.start,sourceEnd:p.end,status:'proposed'}]);
 assert.deepEqual(n.facts,s.facts);assert.deepEqual(n.events,s.events);assert.deepEqual(n.chapters,s.chapters);
});
test('valid empty extraction is complete and can pass review and author acceptance',()=>{
 let s=extracted(fresh(),[]);assert.equal(e.hasCurrentExtraction(s,id(s)),true);
 s=reviewed(s);assert.equal(s.drafts[0].review.passed,true);s=e.acceptDraft(s,id(s));
 assert.equal(s.drafts[0].status,'ACCEPTED');assert.equal(s.events.length,0);assert.equal(s.chapters[0].text,raw);
});
test('accepted extraction source matches revision-local paragraph ID and exact offsets',()=>{
 let s=e.acceptDraft(selected(reviewed()),id(reviewed()));const c=s.chapters[0],event=s.events[0],p=c.revisions.at(-1).paragraphs[1];
 assert.equal(event.source.paragraphId,p.id);assert.equal(event.source.quote,p.text);
 assert.equal(c.text.slice(event.source.start,event.source.end),p.text);assert.equal(event.source.start,p.start);
 const patch=e.proposeCustomPatch(s,'ch1',{intent:'author_fact',statement:p.text});
 assert.equal(patch.operations[0].source.paragraphId,'p2');
});

for(const [name,entry] of [
 ['missing label',{sourceParagraphIndex:1}],['blank label',{label:' ',sourceParagraphIndex:1}],['oversized label',{label:'a'.repeat(1001),sourceParagraphIndex:1}],
 ['negative index',{...event,sourceParagraphIndex:-1}],['fractional index',{...event,sourceParagraphIndex:1.5}],['string index',{...event,sourceParagraphIndex:'1'}],['source-only index',{...event,sourceParagraphIndex:99}],
 ['invented quote',{...event,sourceQuote:'another chapter'}],['trimmed quote',{...event,sourceQuote:segmentProse(raw)[1].text.trim()}],['wrong offset',{...event,sourceStart:0}],['string offset',{...event,sourceStart:String(segmentProse(raw)[1].start)}],['wrong end',{...event,sourceEnd:999}],
 ['supplied ID',{...event,id:'external'}],['auto promotion',{...event,status:'confirmed'}],['unknown field',{...event,canon:true}]
])test(`extraction rejects ${name} and preserves saved text and empty staging`,()=>{
 const s=begin(fresh()),before=clone(s);
 assert.throws(()=>e.attachMemoryExtraction(s,id(s),report([entry]),e.createExtractionBinding(s,id(s))),{code:'INVALID_EXTRACTION'});
 assert.deepEqual(s,before);assert.equal(s.drafts[0].text,raw);assert.deepEqual(s.drafts[0].staging,[]);
});
test('extraction rejects malformed reports and excessive candidate counts',()=>{
 const s=begin(fresh()),key=id(s),b=e.createExtractionBinding(s,key);
 for(const r of [null,{...report(),provider:null},{...report(),reviewNotes:[{}]},{...report(),reviewNotes:['x'.repeat(2001)]},{...report(),reviewNotes:Array(31).fill('x')},{...report(),unknown:true},{...report(),staging:Array(31).fill(event)}])assert.throws(()=>e.attachMemoryExtraction(s,key,r,b),{code:'INVALID_EXTRACTION'});
});
test('extraction verifies every binding field and prohibits incomplete or expanded bindings',()=>{
 const s=begin(fresh()),key=id(s),b=e.createExtractionBinding(s,key);
 for(const field of Object.keys(b)){
  const bad=clone(b);delete bad[field];assert.throws(()=>e.attachMemoryExtraction(s,key,report(),bad),{code:'STALE_EXTRACTION'});
  const changed=clone(b);changed[field]=field==='chapterRevisions'?{ch1:9}:'wrong';assert.throws(()=>e.attachMemoryExtraction(s,key,report(),changed),{code:'STALE_EXTRACTION'});
 }
 assert.throws(()=>e.attachMemoryExtraction(s,key,report(),{...b,unknown:1}),{code:'STALE_EXTRACTION'});
});
test('raw binding rejects a known legacy emoji-hash collision',()=>{
 const s=begin(fresh('😀')),key=id(s),b=e.createExtractionBinding(s,key),n=clone(s);
 assert.equal(e.hash('😀'),e.hash('😁'));
 n.drafts[0].text='😁';n.drafts[0].proseVersions[0].text='😁';n.drafts[0].proseVersions[0].paragraphs=segmentProse('😁');
 assert.throws(()=>e.attachMemoryExtraction(n,key,report(),b),{code:'STALE_EXTRACTION'});
});
test('same-text attempts cannot overwrite newer extraction or revive after cancellation',()=>{
 let s=begin(fresh()),key=id(s),old=e.createExtractionBinding(s,key);s=begin(s);const latest=e.createExtractionBinding(s,key);
 assert.equal(latest.attempt,old.attempt+1);assert.throws(()=>e.attachMemoryExtraction(s,key,report([event]),old),{code:'STALE_EXTRACTION'});
 assert.deepEqual(e.markExtractionFailure(s,key,old),s);
 s=e.markExtractionFailure(s,key,latest,'cancelled');assert.equal(s.drafts[0].extraction.status,'cancelled');assert.equal(s.drafts[0].text,raw);
 assert.throws(()=>e.attachMemoryExtraction(s,key,report([event]),latest),{code:'STALE_EXTRACTION'});
 s=begin(s);s=e.attachMemoryExtraction(s,key,report([event]),e.createExtractionBinding(s,key));assert.equal(e.hasCurrentExtraction(s,key),true);
});
test('failed extraction preserves immutable prose and retry clears previous staging and all reviews',()=>{
 let s=reviewed(),key=id(s),before=clone(s.drafts[0].proseVersions);
 s.drafts[0].modelReview={summary:'old'};s.drafts[0].factDecisions=[{reason:'old'}];s=begin(s);
 assert.deepEqual(s.drafts[0].staging,[]);assert.equal(s.drafts[0].review,null);assert.equal(s.drafts[0].modelReview,null);assert.deepEqual(s.drafts[0].factDecisions,[]);
 s=e.markExtractionFailure(s,key,e.createExtractionBinding(s,key));
 assert.equal(s.drafts[0].extraction.status,'failed');assert.deepEqual(s.drafts[0].proseVersions,before);
 assert.throws(()=>e.acceptDraft(e.reviewDraft(s,key),key),{code:'REVIEW_REQUIRED'});
});
test('editing appends a raw immutable version and invalidates extraction, staging, reviews and fact decisions',()=>{
 let s=reviewed(),key=id(s),before=clone(s);const binding=s.drafts[0].extraction.binding;
 s.drafts[0].factDecisions=[{reason:'old'}];s=e.editDraft(s,key,'  新正文😀\r\n  下一段  ');
 assert.equal(s.drafts[0].revision,2);assert.deepEqual(s.drafts[0].proseVersions[0],before.drafts[0].proseVersions[0]);
 assert.deepEqual(s.drafts[0].proseVersions[1],{revision:2,text:s.drafts[0].text,textHash:e.hash(s.drafts[0].text),paragraphs:segmentProse(s.drafts[0].text)});
 assert.deepEqual(s.drafts[0].staging,[]);assert.equal(s.drafts[0].review,null);assert.equal(s.drafts[0].modelReview,null);assert.deepEqual(s.drafts[0].factDecisions,[]);
 assert.equal(e.hasCurrentExtraction(s,key),false);assert.throws(()=>e.attachMemoryExtraction(s,key,report(),binding),{code:'STALE_EXTRACTION'});
});
test('project, draft, source text, state and author intent changes reject late extraction',()=>{
 const s=begin(fresh()),key=id(s),b=e.createExtractionBinding(s,key);
 const alternatives=[t=>{t.projectId='other'},t=>{t.drafts[0].runId='other'},t=>{t.drafts[0].chapterId='ch2'},t=>{t.version++},t=>{t.chapters[1].revision++},t=>{t.chapters[1].text+=' changed'},t=>{t.config.boundaries='changed'}];
 for(const mutate of alternatives){const n=clone(s);mutate(n);assert.throws(()=>e.attachMemoryExtraction(n,key,report(),b),{code:'STALE_EXTRACTION'});}
 const n=e.stageProseDraft(s,{text:raw,context:e.getContext(s)},'ch2');assert.throws(()=>e.attachMemoryExtraction(n,id(n),report(),b),{code:'STALE_EXTRACTION'});
 const rejected=e.rejectDraft(s,key);assert.throws(()=>e.attachMemoryExtraction(rejected,key,report(),b),{code:'STALE_EXTRACTION'});assert.deepEqual(e.markExtractionFailure(rejected,key,b),rejected);
});
test('same-text re-extraction invalidates a pending or completed semantic review even if staging identical',()=>{
 let s=extracted(fresh(raw,{live:true})),key=id(s),old=e.createReviewBinding(s,key);
 s=e.attachSemanticReview(s,key,advisory,old);s=e.reviewDraft(s,key);s=extracted(s);const current=e.createReviewBinding(s,key);
 assert.notEqual(current.extractionAttempt,old.extractionAttempt);assert.equal(s.drafts[0].modelReview,null);
 assert.throws(()=>e.attachSemanticReview(s,key,advisory,old),{code:'STALE_SEMANTIC_REVIEW'});
 s=e.attachSemanticReview(s,key,advisory,current);s=e.reviewDraft(s,key);assert.equal(e.acceptDraft(selected(s),key).drafts[0].status,'ACCEPTED');
});
test('new extraction retains mandatory fact-conflict decisions and never changes Canon',()=>{
 let s=e.createProjectFromConfig({projectId:'fact-pipeline',chapters:[{text:'纸灯是蓝色的。'}]});
 s=e.commitPatch(s,e.proposeCustomPatch(s,'ch1',{intent:'author_fact',statement:'纸灯是蓝色的。'}));
 const facts=clone(s.facts);s=e.stageProseDraft(s,{text:'纸灯是红色的。',context:e.getContext(s),provider:{id:'live',isLive:true}},'ch2');s=extracted(s,[]);const key=id(s);
 s=e.attachSemanticReview(s,key,{...advisory,factChecks:[{factId:s.facts[0].id,recordVersion:1,status:'contradiction',explanation:'颜色冲突',sourceQuote:'纸灯是红色的。'}]},e.createReviewBinding(s,key));s=e.reviewDraft(s,key);
 assert.throws(()=>e.acceptDraft(s,key),{code:'FACT_DECISION_REQUIRED'});
 s=e.resolveFactReview(s,key,{factId:s.facts[0].id,recordVersion:1,action:'accept_exception',reason:'作者有意保留差异',reviewHash:e.hash(JSON.stringify(s.drafts[0].modelReview))},e.createReviewBinding(s,key));
 s=e.acceptDraft(s,key);assert.deepEqual(s.facts,facts);assert.equal(s.commits.at(-1).factDecisions.length,1);
});
test('bypassing extraction flag or tampering staging/paragraph evidence fails closed',()=>{
 const s=reviewed(),key=id(s);
 for(const mutate of [d=>{d.requiresExtraction=false},d=>{d.extraction.status='pending'},d=>{d.extraction.binding=null},d=>{d.proseVersions[0].paragraphs[1].start=0},d=>{d.staging[0].sourceStart=0;d.extraction.stagingHash=e.hash(JSON.stringify(d.staging));d.review.stagingHash=d.extraction.stagingHash},d=>{d.staging[0].id='forged';d.extraction.stagingHash=e.hash(JSON.stringify(d.staging));d.review.stagingHash=d.extraction.stagingHash}]){
  const n=clone(s);mutate(n.drafts[0]);assert.equal(e.hasCurrentExtraction(n,key),false);assert.throws(()=>e.acceptDraft(n,key),{code:'REVIEW_REQUIRED'});
 }
});
test('backup round-trips pending, failed, complete, accepted and rejected prose snapshots',()=>{
 let s=begin(fresh());const failed=e.markExtractionFailure(s,id(s),e.createExtractionBinding(s,id(s)));
 for(const state of [fresh(),s,failed,extracted(),reviewed(),e.acceptDraft(selected(reviewed()),id(reviewed())),e.rejectDraft(extracted(),id(extracted()))]){
  const w=backup(state);assert.deepEqual(parseBackup(JSON.stringify(w)),w);
 }
});
test('backup rejects malformed prose version, evidence, extraction status and binding fields',()=>{
 const s=extracted();
 const mutations=[d=>{d.proseVersions=[]},d=>{d.proseVersions[0].text='forged'},d=>{d.proseVersions[0].paragraphs[0].end++},d=>{d.proseVersions[0].paragraphs[0].id='model-id'},d=>{d.proseVersions[0].paragraphs[0].index=99},d=>{d.extraction.binding.textHash='wrong'},d=>{delete d.extraction.binding.requestId},d=>{d.extraction.binding.attempt++},d=>{d.extraction.status='ready'},d=>{d.extraction.reviewNotes=[{}]},d=>{d.extraction.stagingHash='wrong'},d=>{d.requiresExtraction=false},d=>{d.staging[0].sourceParagraphIndex=0},d=>{d.context.sources[0].text='forged prior chapter'},d=>{d.runId='other'}];
 for(const mutate of mutations){const w=backup(clone(s));mutate(w.state.drafts[0]);assert.throws(()=>parseBackup(JSON.stringify(w)));}
});
test('import invalidates all pending extraction/review authority but preserves raw version audit',()=>{
 const current=backup(e.createProjectFromConfig({projectId:'current'})),source=backup(reviewed()),before=clone(source),binding=source.state.drafts[0].extraction.binding;
 const imported=importBackup(current,source,()=> 'imported-prose'),d=imported.state.drafts[0];
 assert.equal(d.extraction.status,'pending');assert.equal(d.extraction.binding,null);assert.deepEqual(d.staging,[]);assert.equal(d.review,null);assert.equal(d.modelReview,null);assert.deepEqual(d.factDecisions,[]);
 assert.deepEqual(d.proseVersions,before.state.drafts[0].proseVersions);assert.deepEqual(imported.state.importOrigin.original.state,before.state);
 assert.equal(e.hasCurrentExtraction(imported.state,d.id),false);assert.throws(()=>e.attachMemoryExtraction(imported.state,d.id,report(),binding),{code:'STALE_EXTRACTION'});
 assert.deepEqual(source,before);assert.deepEqual(parseBackup(JSON.stringify(imported)),imported);
 const retried=extracted(imported.state);assert.equal(e.hasCurrentExtraction(retried,d.id),true);
});
test('import preserves accepted historical prose/evidence while remapping its audited origin',()=>{
 const accepted=e.acceptDraft(selected(reviewed()),id(reviewed())),source=backup(accepted),current=backup(e.createProjectFromConfig({projectId:'import-current'}));
 const imported=importBackup(current,source,()=> 'historical-prose');
 assert.equal(imported.state.drafts[0].status,'ACCEPTED');assert.equal(imported.state.events[0].source.quote,accepted.events[0].source.quote);
 assert.deepEqual(parseBackup(JSON.stringify(imported)),imported);
});

test('live provenance cannot bypass semantic/fact gates by flipping its required-review flag',()=>{
 const s=reviewed(extracted(fresh(raw,{live:true}))),key=id(s),n=clone(s);
 n.drafts[0].requiresSemanticReview=false;
 assert.equal(e.hasCurrentExtraction(n,key),false);
 assert.throws(()=>e.acceptDraft(n,key),{code:'REVIEW_REQUIRED'});
 assert.throws(()=>parseBackup(JSON.stringify(backup(n))));
});
