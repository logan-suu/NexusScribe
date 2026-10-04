import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import * as r from '../src/domain/author-revision.js';
import {parseBackup,importBackup} from '../src/storage.js';
const BEFORE='  陆遥把纸盒放在桌上。\n\n她没有打开它。😀';
const AFTER='陆遥打开纸盒，才看见纸屑。\n她约好明早九点回来。';
const provider={id:'revision-fixture',isLive:true,model:'cheap-fixture'};
const copy=x=>structuredClone(x);
function fresh(){let s=e.createProjectFromConfig({projectId:'author-revision',idea:'信件',tone:'克制'});return e.stageProseDraft(s,{text:BEFORE,chapterId:'ch1',context:e.getContext(s),provider},'ch1');}
const id=s=>s.drafts[0].id;
const last=s=>s.drafts[0].revisionProposals.at(-1);
function begin(s=fresh()){s=r.setRevisionInstruction(s,id(s),'压缩并修复盒子可见性，保留约定');return r.beginDraftRevision(s,id(s));}
function completed(s=begin(),text=AFTER){return r.attachDraftRevision(s,id(s),last(s).id,{text,chapterId:'ch1',provider},last(s).binding);}
const backup=state=>({format:1,serial:0,state,editing:{},patch:null,providerMode:'server'});
test('counts explicitly use Han codepoints, all codepoints and nonblank physical lines',()=>{
 assert.deepEqual(r.proseCounts(' 汉A😀\r\n\n 𠀀\t'),{han:2,characters:10,paragraphs:2});
 assert.deepEqual(r.proseCounts(' \n\t'),{han:0,characters:3,paragraphs:0});
});
test('one request makes a separate immutable bound proposal without altering manuscript or memory',()=>{
 const original=fresh(),s=begin(original),p=last(s),input=r.createRevisionInput(s,id(s),p.id),n=completed(s);
 assert.equal(p.binding.textSnapshot,BEFORE);assert.deepEqual(input,{text:BEFORE,instruction:s.drafts[0].revisionInstruction,chapterId:'ch1',context:e.getContext(s)});
 input.context.constitution.tone='tampered';assert.notEqual(p.binding.contextSnapshot.constitution.tone,'tampered');
 assert.equal(n.drafts[0].text,BEFORE);assert.deepEqual(n.chapters,original.chapters);assert.deepEqual(n.facts,original.facts);assert.deepEqual(n.events,original.events);assert.deepEqual(n.drafts[0].proseVersions,original.drafts[0].proseVersions);
 assert.equal(last(n).status,'proposed');assert.equal(last(n).result.text,AFTER);assert.deepEqual(last(n).afterCounts,r.proseCounts(AFTER));assert.equal(r.isRevisionCurrent(n,id(n),p.id),true);
 assert.throws(()=>r.beginDraftRevision(s,id(s)),/已有改稿请求/);
});
test('adoption preserves original/proposal and invalidates extraction, structural/model reviews and choices',()=>{
 let s=fresh();s=e.beginMemoryExtraction(s,id(s));s=e.attachMemoryExtraction(s,id(s),{staging:[{label:'她没有打开盒子',sourceParagraphIndex:1}],reviewNotes:[],provider},e.createExtractionBinding(s,id(s)));s=e.reviewDraft(s,id(s));s=e.attachSemanticReview(s,id(s),{summary:'合成建议',checks:[],issues:[],factChecks:[],provider:'fixture'},e.createReviewBinding(s,id(s)));
 const item=e.getMemoryReviewGate(s,id(s))[0];s=e.decideMemoryCandidate(s,id(s),{candidateId:item.candidateId,action:'keep_quote',reviewHash:item.reviewHash},item.binding);
 const old=copy(s);s=completed(begin(s));const p=copy(last(s)),n=r.adoptDraftRevision(s,id(s),p.id,p),d=n.drafts[0];
 assert.equal(d.text,AFTER);assert.equal(d.revision,2);assert.equal(d.proseVersions[0].text,BEFORE);assert.equal(last(n).binding.textSnapshot,BEFORE);assert.equal(last(n).status,'adopted');assert.equal(last(n).adoptedRevision,2);
 assert.equal(d.extraction.status,'pending');assert.deepEqual(d.staging,[]);assert.equal(d.review,null);assert.equal(d.modelReview,null);assert.deepEqual(d.factDecisions,[]);assert.deepEqual(d.memoryDecisions,[]);assert.ok(d.memoryArchives.length>old.drafts[0].memoryArchives.length);
 assert.deepEqual(n.chapters,old.chapters);assert.deepEqual(n.events,old.events);assert.deepEqual(n.facts,old.facts);assert.throws(()=>e.acceptDraft(n,id(n)),/重新审查/);assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(n))));
 assert.throws(()=>r.adoptDraftRevision(n,id(n),p.id,p));
});
test('discard and same-text adoption retain every paid result without marking chapter accepted',()=>{
 const s=completed(),p=last(s),n=r.discardDraftRevision(s,id(s),p.id);assert.equal(n.drafts[0].text,BEFORE);assert.equal(last(n).status,'discarded');assert.deepEqual(last(n).result,p.result);
 const same=completed(begin(),BEFORE),adopted=r.adoptDraftRevision(same,id(same),last(same).id,last(same));assert.equal(adopted.drafts[0].revision,2);assert.equal(adopted.chapters[0].status,'PLANNED');
});
for(const [label,change] of [
 ['instruction',s=>r.setRevisionInstruction(s,id(s),'保留更多细节')],
 ['instruction changed back',s=>r.setRevisionInstruction(r.setRevisionInstruction(s,id(s),'新意见'),id(s),s.drafts[0].revisionInstruction)],
 ['draft text',s=>e.editDraft(s,id(s),BEFORE+'后续')],
 ['context',s=>{s=copy(s);s.config.tone='轻快';return s;}],
 ['source chapter',s=>e.saveRevision(s,'ch2','changed',1)],
 ['story version',s=>{s=copy(s);s.version++;return s;}],
 ['rejected',s=>e.rejectDraft(s,id(s))]
])test(`${label} cannot adopt old advice and retains late result only as stale`,()=>{
 const s=begin(),p=last(s),changed=change(s),late=r.attachDraftRevision(changed,id(s),p.id,{text:AFTER,chapterId:'ch1',provider},p.binding);
 assert.equal(last(late).status,'stale');assert.equal(last(late).result.text,AFTER);assert.equal(r.isRevisionCurrent(late,id(late),p.id),false);assert.throws(()=>r.adoptDraftRevision(late,id(late),p.id,last(late)));
 const ready=completed(s),altered=change(ready);assert.throws(()=>r.adoptDraftRevision(altered,id(altered),p.id,last(ready)));
});
test('workspace-only staleness can retain paid result without adoption authority',()=>{const s=begin(),n=r.attachDraftRevision(s,id(s),last(s).id,{text:AFTER,chapterId:'ch1',provider},last(s).binding,{stale:true});assert.equal(last(n).status,'stale');});
for(const status of ['failed','cancelled'])test(`${status} cannot revive or replace request`,()=>{const s=begin(),p=last(s),n=r.markRevisionFailure(s,id(s),p.id,status);assert.equal(n.drafts[0].text,BEFORE);assert.throws(()=>r.attachDraftRevision(n,id(n),p.id,{text:AFTER,chapterId:'ch1',provider},p.binding));const newer=r.beginDraftRevision(n,id(n));assert.notEqual(last(newer).id,p.id);assert.throws(()=>r.attachDraftRevision(newer,id(newer),p.id,{text:AFTER,chapterId:'ch1',provider},p.binding));});
test('wrong request binding and malformed/overlong responses do not modify source',()=>{
 const s=begin(),p=last(s);for(const report of [null,{text:' ',chapterId:'ch1',provider},{text:'字'.repeat(30001),chapterId:'ch1',provider},{text:AFTER,chapterId:'ch2',provider},{text:AFTER,chapterId:'ch1',provider:{id:'fake',isLive:false}},{text:AFTER,chapterId:'ch1',provider,staging:[]}])assert.throws(()=>r.attachDraftRevision(s,id(s),p.id,report,p.binding));
 assert.throws(()=>r.attachDraftRevision(s,id(s),p.id,{text:AFTER,chapterId:'ch1',provider},{...p.binding,instruction:'tampered'}));assert.equal(s.drafts[0].text,BEFORE);
});
test('empty and excessive instructions blocked; template/manual/accepted drafts cannot request revisions',()=>{
 for(const value of [null,{},'a'.repeat(4001)])assert.throws(()=>r.setRevisionInstruction(fresh(),id(fresh()),value));
 const blank=r.setRevisionInstruction(fresh(),id(fresh()),' ');assert.throws(()=>r.beginDraftRevision(blank,id(blank)));
 for(const change of [d=>d.status='ACCEPTED',d=>d.status='REJECTED',d=>d.providerInfo.isLive=false,d=>d.manualSource={},d=>d.provider='author-manuscript']){const s=fresh();change(s.drafts[0]);assert.throws(()=>r.setRevisionInstruction(s,id(s),'压缩'));}
});
test('reload preserves proposal and exact provenance; import removes pending adoption authority',()=>{
 const s=completed(),parsed=parseBackup(JSON.stringify(backup(s)));assert.deepEqual(parsed.state,s);assert.equal(r.isRevisionCurrent(parsed.state,id(s),last(s).id),true);
 const imported=importBackup(backup(e.createInitialState()),parsed,()=> 'imported-author-revision').state;assert.equal(last(imported).status,'stale');assert.equal(last(imported).result.text,AFTER);assert.equal(r.isRevisionCurrent(imported,id(imported),last(imported).id),false);assert.throws(()=>r.adoptDraftRevision(imported,id(imported),last(imported).id,last(imported)));
 const adopted=r.adoptDraftRevision(s,id(s),last(s).id,last(s));assert.doesNotThrow(()=>importBackup(backup(e.createInitialState()),backup(adopted),()=> 'imported-adopted'));
});
for(const [label,change] of [
 ['result',p=>p.result.text='tamper'],['counts',p=>p.beforeCounts.han++],['original text',p=>p.binding.textSnapshot='different'],['chapter',p=>p.binding.chapterId='ch2'],['instruction counter',p=>p.binding.instructionVersion=999],['status',p=>p.status='accepted'],['snapshot',p=>p.resultSnapshot.provider.id='different']
])test(`backup rejects malformed revision ${label}`,()=>{const s=completed();change(last(s));assert.throws(()=>parseBackup(JSON.stringify(backup(s))));});
