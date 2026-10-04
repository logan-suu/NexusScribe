import {segmentProse} from './prose.js';
/** Model verdicts are advice; deterministic excerpts prove textual presence only. */
export const MEMORY_SELECTION_PROTOCOL='quote-grounded-memory-v1';
export const MEMORY_ATTESTATION_STATEMENT='我已核对原始标签、引文和上下文，理解此转述未经验证；模型支持不代表事实或完整含义正确。我明确选择让它以作者确认的未验证转述进入后续上下文。';
const copy = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && Boolean(value.trim());
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const invalid = (message='候选记忆审查格式无效') => { const error = Error(message); error.code='INVALID_MEMORY_REVIEW'; throw error; };
/** A card always retains the complete paragraph and adjacent paragraphs. No semantic claim is inferred.
 * Modern paragraph indexes use segmentProse; legacy indexes refer to physical newline positions.
 * Unanchored repeated evidence is ambiguous and fails closed instead of selecting its first occurrence.
 */
export function deriveQuoteCard(draft,candidate) {
 if(!candidate||typeof draft.text!=='string'||!text(candidate.sourceQuote))return null;
 const paragraphs=segmentProse(draft.text),modern=draft.requiresExtraction===true;
 const paragraphQuote=!modern&&Object.hasOwn(candidate,'sourceParagraphIndex')?candidate.sourceQuote.replace(/\r$/,''):candidate.sourceQuote;
 let matches=paragraphs.filter(p=>p.text.includes(paragraphQuote));
 if(Object.hasOwn(candidate,'sourceParagraphIndex')){
  if(!Number.isSafeInteger(candidate.sourceParagraphIndex)||candidate.sourceParagraphIndex<0)return null;
  if(modern)matches=matches.filter(p=>p.index===candidate.sourceParagraphIndex&&p.text===candidate.sourceQuote);
  else{
   const lines=draft.text.split('\n'),index=candidate.sourceParagraphIndex;
   if(lines[index]!==candidate.sourceQuote)return null;
   const start=lines.slice(0,index).reduce((n,line)=>n+line.length+1,0);
   matches=matches.filter(p=>p.start===start&&p.text===candidate.sourceQuote.replace(/\r$/,''));
  }
 }
 if(Object.hasOwn(candidate,'sourceStart')||Object.hasOwn(candidate,'sourceEnd')){
  if(!Number.isSafeInteger(candidate.sourceStart)||!Number.isSafeInteger(candidate.sourceEnd)||candidate.sourceStart<0||candidate.sourceEnd<=candidate.sourceStart||candidate.sourceEnd>draft.text.length||draft.text.slice(candidate.sourceStart,candidate.sourceEnd)!==candidate.sourceQuote)return null;
  matches=matches.filter(p=>p.start<=candidate.sourceStart&&p.end>=candidate.sourceEnd);
 }
 if(matches.length!==1)return null;
 const paragraph=matches[0],paragraphId=p=>modern?p.id:`p${draft.text.slice(0,p.start).split('\n').length}`,anchor=p=>p?{paragraphId:paragraphId(p),start:p.start,end:p.end,text:p.text}:null;
 return {protocol:MEMORY_SELECTION_PROTOCOL,trust:'textual_presence_only',chapterId:draft.chapterId||'ch3',draftId:draft.id,draftRevision:draft.revision,paragraphId:paragraphId(paragraph),paragraphIndex:paragraph.index,start:paragraph.start,end:paragraph.end,text:paragraph.text,before:anchor(paragraphs[paragraph.index-1]),after:anchor(paragraphs[paragraph.index+1])};
}
export function compactQuoteCard(card) {
 if(!card)return null;
 const value=copy(card);delete value.text;
 for(const key of ['before','after'])if(value[key])delete value[key].text;
 return value;
}
export function validMemoryAttestation(value) {
 return object(value)&&Object.keys(value).length===3&&value.protocol===MEMORY_SELECTION_PROTOCOL&&value.accepted===true&&value.statement===MEMORY_ATTESTATION_STATEMENT;
}
export function memorySelectionValid(draft,decision,candidate,binding) {
 if(decision?.selectionProtocol!==MEMORY_SELECTION_PROTOCOL)return false;
 if(decision.action==='reject')return !Object.hasOwn(decision,'quoteSnapshot')&&!Object.hasOwn(decision,'attestation');
 if(decision.action==='attest_keep')return text(decision.reason)&&validMemoryAttestation(decision.attestation)&&!Object.hasOwn(decision,'quoteSnapshot');
 if(decision.action!=='keep_quote'||Object.hasOwn(decision,'attestation')||!binding)return false;
 const card=deriveQuoteCard({...draft,text:binding.textSnapshot,revision:binding.draftRevision},candidate);
 return Boolean(card&&same(decision.quoteSnapshot,compactQuoteCard(card)));
}
export function initializeMemoryReview(draft) {
 if (draft.memoryReviewSchema === undefined) {
  draft.memoryReviewSchema=1;
  draft.memoryCandidatesSnapshot=copy(draft.staging);
  draft.memoryDecisions=[];
  draft.memoryDecisionHistory=[];
  draft.memoryArchives=[];
  draft.memoryAuthorities=[];
  draft.memoryBindingSnapshots=[];
  draft.memoryReviewEpoch=0;
 }
}
export function memoryCandidatesIntact(draft) {
 return draft.memoryReviewSchema===1 && Array.isArray(draft.memoryCandidatesSnapshot) && same(draft.staging,draft.memoryCandidatesSnapshot);
}
// Binding holds exact prose/context/candidate snapshots once per reviewed authority.
// Derived ledgers and duplicate structural snapshots can be rebuilt and are not copied
// into every decision. This keeps a normal chapter within the unchanged backup cap.
const bindingSnapshotKeys=['textSnapshot','stagingSnapshot','contextSnapshot','extractionSnapshot'];
export function compactMemoryBinding(draft,binding) {
 if(binding?.snapshotId)return copy(binding);
 initializeMemoryReview(draft);
 const values=Object.fromEntries(bindingSnapshotKeys.filter(key=>Object.hasOwn(binding,key)).map(key=>[key,copy(binding[key])]));
 let stored=draft.memoryBindingSnapshots.find(snapshot=>same(snapshot.values,values));
 if(!stored){stored={id:`${draft.id}-memory-binding-${draft.memoryBindingSnapshots.length+1}`,values};draft.memoryBindingSnapshots.push(stored);}
 const compact=copy(binding);for(const key of bindingSnapshotKeys)delete compact[key];compact.snapshotId=stored.id;return compact;
}
export function expandMemoryBinding(draft,binding) {
 if(!binding?.snapshotId)return copy(binding);
 const snapshot=draft.memoryBindingSnapshots?.find(item=>item.id===binding.snapshotId);
 if(!snapshot)return null;
 const expanded=copy(binding);delete expanded.snapshotId;return {...expanded,...copy(snapshot.values)};
}
export function memoryAssessmentSnapshot(ledger){return ledger.map(({candidateId,status,explanation,assessmentOrigin})=>({candidateId,status,explanation,assessmentOrigin}));}
export function memoryReviewSnapshot(review) {
 const value=copy(review);
 for(const key of ['binding','textSnapshot','stagingSnapshot','factLedger','memoryLedger'])delete value[key];
 return value;
}
const digest = input => {let n=2166136261;for(const c of input)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(16);};
export function registerMemoryAuthority(draft,binding,review,reviewHash=digest(JSON.stringify(review))) {
 initializeMemoryReview(draft);
 const reviewSnapshot=memoryReviewSnapshot(review);binding=compactMemoryBinding(draft,binding);
 const existing=draft.memoryAuthorities.find(item=>same(item.binding,binding)&&same(item.reviewSnapshot,reviewSnapshot)&&item.reviewHash===reviewHash);
 if(existing)return existing;
 const authority={id:`${draft.id}-memory-authority-${draft.memoryAuthorities.length+1}`,binding:copy(binding),reviewSnapshot,reviewHash};
 draft.memoryAuthorities.push(authority);
 return authority;
}
export function archiveMemoryReview(draft,reason) {
 initializeMemoryReview(draft);
 const changingCandidates=['draft_edited','draft_rejected','extraction_restarted','backup_imported'].includes(reason);
 const hasPriorReview=Boolean(draft.modelReview||draft.memoryDecisions.length);
 if (changingCandidates&&(draft.staging.length||draft.extraction) || hasPriorReview) {
  const authorityIds=[...new Set(draft.memoryDecisions.map(d=>d.authorityId))];
  const oldBinding=draft.modelReview?.binding?expandMemoryBinding(draft,draft.modelReview.binding):null;
  const completeBinding=oldBinding&&typeof oldBinding.textSnapshot==='string'&&Array.isArray(oldBinding.stagingSnapshot)&&object(oldBinding.contextSnapshot);
  if(completeBinding){const authority=registerMemoryAuthority(draft,draft.modelReview.binding,draft.modelReview);if(!authorityIds.includes(authority.id))authorityIds.push(authority.id);}
  const extractionSnapshot=copy(draft.extraction??null);if(extractionSnapshot)delete extractionSnapshot.stagingSnapshot;
  draft.memoryArchives.push({reason,draftRevision:draft.revision,textSnapshot:changingCandidates?draft.text:'',candidates:changingCandidates?copy(draft.memoryCandidatesSnapshot):[],stagingSnapshot:changingCandidates&&!same(draft.staging,draft.memoryCandidatesSnapshot)?copy(draft.staging):[],extractionSnapshot:changingCandidates?extractionSnapshot:null,authorityIds,decisions:copy(draft.memoryDecisions),...(!completeBinding&&draft.modelReview?{legacyModelReview:copy(draft.modelReview)}:{})});
 }
 invalidateMemorySupport(draft,reason);
 draft.memoryDecisions=[];
 draft.memoryReviewEpoch++;
}
export function replaceMemoryCandidates(draft,candidates) {
 initializeMemoryReview(draft);
 draft.staging=copy(candidates);
 draft.memoryCandidatesSnapshot=copy(candidates);
}
export function buildMemoryLedger(draft,checks=[]) {
 if (!Array.isArray(checks)) invalid();
 if (!Array.isArray(draft.staging) || draft.staging.some(c=>!object(c)||!text(c.id)||!text(c.label)||!text(c.sourceQuote)) || new Set(draft.staging.map(c=>c.id)).size!==draft.staging.length) invalid('候选记忆身份或原始证据无效');
 const seen=new Set();
 for (const check of checks) {
  if (!object(check)||Object.keys(check).some(k=>!['candidateId','status','explanation'].includes(k))||!text(check.candidateId)||!draft.staging.some(c=>c.id===check.candidateId)||seen.has(check.candidateId)||!['supported','unsupported','unknown'].includes(check.status)||!text(check.explanation)||check.explanation.length>4000) invalid();
  seen.add(check.candidateId);
 }
 return draft.staging.map(candidate=>{
  const check=checks.find(c=>c.candidateId===candidate.id);
  return {candidateId:candidate.id,label:candidate.label,sourceQuote:candidate.sourceQuote,status:check?.status??'unknown',explanation:check?.explanation??'模型未判断这条候选的完整主张是否获得原文支持',assessmentOrigin:check?'model':'missing'};
 });
}
/** Legacy records remain readable; absent metadata never grants new authority. */
export function validateMemoryDraftRecord(draft) {
 const fields=['memoryReviewSchema','memoryCandidatesSnapshot','memoryDecisions','memoryDecisionHistory','memoryArchives','memoryAuthorities','memoryBindingSnapshots','memoryReviewEpoch','memorySupport'];
 if (fields.every(k=>!Object.hasOwn(draft,k))) return true;
 if (draft.memoryReviewSchema!==1 || !Number.isSafeInteger(draft.memoryReviewEpoch)||draft.memoryReviewEpoch<0||!memoryCandidatesIntact(draft)||!Array.isArray(draft.memoryDecisions)||!Array.isArray(draft.memoryDecisionHistory)||!Array.isArray(draft.memoryArchives)||!Array.isArray(draft.memoryAuthorities)||!Array.isArray(draft.memoryBindingSnapshots)) invalid('候选记忆快照或决定审计无效');
 for(const snapshot of draft.memoryBindingSnapshots)if(!object(snapshot)||!text(snapshot.id)||!object(snapshot.values)||typeof snapshot.values.textSnapshot!=='string'||!Array.isArray(snapshot.values.stagingSnapshot)||!object(snapshot.values.contextSnapshot)||Object.keys(snapshot.values).some(k=>!bindingSnapshotKeys.includes(k)))invalid('候选记忆完整绑定快照无效');
 if(new Set(draft.memoryBindingSnapshots.map(x=>x.id)).size!==draft.memoryBindingSnapshots.length)invalid('候选记忆完整绑定身份重复');
 for(const authority of draft.memoryAuthorities)if(!object(authority)||!text(authority.id)||!object(authority.binding)||!object(authority.reviewSnapshot)||!text(authority.reviewHash)||!Array.isArray(expandMemoryBinding(draft,authority.binding)?.stagingSnapshot))invalid('候选记忆授权快照无效');
 if(new Set(draft.memoryAuthorities.map(a=>a.id)).size!==draft.memoryAuthorities.length)invalid('候选记忆授权身份重复');
 for (const decision of [...draft.memoryDecisions,...draft.memoryDecisionHistory]) {
  if (!object(decision)||!text(decision.decisionId)||!text(decision.candidateId)||!['keep','reject','override_keep','keep_quote','attest_keep'].includes(decision.action)||typeof decision.reason!=='string'||decision.reason.length>2000||['override_keep','attest_keep'].includes(decision.action)&&!text(decision.reason)||!text(decision.authorityId)||!draft.memoryAuthorities.some(a=>a.id===decision.authorityId&&a.reviewHash===decision.reviewHash&&expandMemoryBinding(draft,a.binding)?.stagingSnapshot?.some(c=>c.id===decision.candidateId))||!text(decision.reviewHash)||!['supported','unsupported','unknown'].includes(decision.assessment)||!text(decision.explanation)||decision.authority!=='explicit_author_decision') invalid('候选记忆决定审计无效');
 }
 for(const decision of [...draft.memoryDecisions,...draft.memoryDecisionHistory]) {
  if(Object.hasOwn(decision,'selectionProtocol')||['keep_quote','attest_keep'].includes(decision.action)){
   const authority=draft.memoryAuthorities.find(item=>item.id===decision.authorityId),binding=expandMemoryBinding(draft,authority?.binding),candidate=binding?.stagingSnapshot?.find(item=>item.id===decision.candidateId);
   if(!memorySelectionValid(draft,decision,candidate,binding))invalid('原文摘录或作者未验证转述确认无效');
  }
 }
 for(const decision of [...draft.memoryDecisions,...draft.memoryDecisionHistory])if(Object.hasOwn(decision,'supportAttemptId')){
  if(decision.supportAttemptId!==null&&!text(decision.supportAttemptId)||!['not_started','pending','complete','failed','cancelled','stale'].includes(decision.supportState)||decision.supportResultHash!==null&&!text(decision.supportResultHash))invalid('作者决定的单条核验引用无效');
  const attempt=draft.memorySupport?.attempts.find(item=>item.id===decision.supportAttemptId&&item.candidateId===decision.candidateId);
  if(decision.supportAttemptId!==null&&!attempt)invalid('作者决定引用了不存在的单条核验');
  if(decision.action==='keep'&&(!attempt||attempt.state!=='complete'||attempt.resultSnapshot?.assessmentOrigin!==ISOLATED_MEMORY_PROTOCOL||attempt.resultSnapshot.status!=='supported'||decision.assessment!=='supported'||decision.supportState!=='complete'||decision.supportResultHash!==digest(JSON.stringify(attempt.resultSnapshot))))invalid('普通保留缺少独立单条核验依据');
 }
 if (new Set(draft.memoryDecisions.map(d=>d.candidateId)).size!==draft.memoryDecisions.length||new Set(draft.memoryDecisionHistory.map(d=>d.decisionId)).size!==draft.memoryDecisionHistory.length||draft.memoryDecisions.some(d=>!draft.memoryDecisionHistory.some(h=>same(h,d)))) invalid('候选记忆决定历史不一致');
 for (const archive of draft.memoryArchives) if (!object(archive)||!text(archive.reason)||!Number.isSafeInteger(archive.draftRevision)||archive.draftRevision<1||typeof archive.textSnapshot!=='string'||!Array.isArray(archive.candidates)||!Array.isArray(archive.stagingSnapshot)||!Array.isArray(archive.decisions)||!Array.isArray(archive.authorityIds)||archive.authorityIds.some(id=>!draft.memoryAuthorities.some(a=>a.id===id))||archive.candidates.some(c=>!object(c)||!text(c.id)||!text(c.label)||!text(c.sourceQuote))) invalid('候选记忆存档无效');
 validateMemorySupportRecord(draft);
 return true;
}

export const ISOLATED_MEMORY_PROTOCOL='isolated-own-quote-v1';
export function initializeMemorySupport(draft) {
 if(!Object.hasOwn(draft,'memorySupport'))draft.memorySupport={schemaVersion:1,sequence:0,attempts:[],heads:[]};
}
/** Global draft/review changes revoke heads, but keep all attempts and decisions. */
export function invalidateMemorySupport(draft,reason) {
 initializeMemorySupport(draft);
 for(const attempt of draft.memorySupport.attempts)if(attempt.state==='pending'){attempt.state='cancelled';attempt.outcomeReason=reason;}
 draft.memorySupport.heads=[];
}
export function memorySupportHead(draft,candidateId) {
 const head=draft.memorySupport?.heads.find(item=>item.candidateId===candidateId);
 const latest=draft.memorySupport?.attempts.findLast(attempt=>attempt.candidateId===candidateId);
 return head&&latest?.id===head.attemptId?latest:null;
}
export function validateMemorySupportRecord(draft) {
 if(draft.memorySupport===undefined)return true;
 const support=draft.memorySupport;
 if(!object(support)||Object.keys(support).some(k=>!['schemaVersion','sequence','attempts','heads'].includes(k))||support.schemaVersion!==1||!Number.isSafeInteger(support.sequence)||support.sequence<0||!Array.isArray(support.attempts)||!Array.isArray(support.heads))invalid('单条记忆核验记录无效');
 if(support.sequence!==support.attempts.length||new Set(support.attempts.map(a=>a?.id)).size!==support.attempts.length)invalid('单条记忆核验批次身份无效');
 for(const [index,attempt] of support.attempts.entries()){
  const authority=draft.memoryAuthorities?.find(item=>item.id===attempt?.authorityId),binding=authority?expandMemoryBinding(draft,authority.binding):null;
  if(!object(attempt)||Object.keys(attempt).some(k=>!['id','sequence','candidateId','authorityId','protocol','state','supersedesAttemptId','invalidatedDecisionIds','result','resultSnapshot','outcomeReason'].includes(k))||attempt.sequence!==index+1||attempt.id!==`${draft.id}-support-${index+1}`||!text(attempt.candidateId)||!binding?.stagingSnapshot?.some(candidate=>candidate.id===attempt.candidateId)||attempt.protocol!==ISOLATED_MEMORY_PROTOCOL||!['pending','complete','failed','cancelled'].includes(attempt.state)||!Array.isArray(attempt.invalidatedDecisionIds)||attempt.invalidatedDecisionIds.some(id=>!draft.memoryDecisionHistory.some(decision=>decision.decisionId===id)))invalid('单条记忆核验来源或绑定无效');
  if(attempt.supersedesAttemptId!==null&&!support.attempts.slice(0,index).some(old=>old.id===attempt.supersedesAttemptId&&old.candidateId===attempt.candidateId))invalid('单条记忆核验替代记录无效');
  if(attempt.state==='complete'){
   const result=attempt.result;
   if(JSON.stringify(result)!==JSON.stringify(attempt.resultSnapshot)||!object(result)||Object.keys(result).length!==4||!['supported','unsupported','unknown'].includes(result.status)||!text(result.explanation)||result.explanation.length>4000||result.assessmentOrigin!==ISOLATED_MEMORY_PROTOCOL||!(text(result.provider)||object(result.provider)&&text(result.provider.id))||Object.hasOwn(attempt,'outcomeReason'))invalid('单条记忆核验结果无效');
  }else if(Object.hasOwn(attempt,'result')||Object.hasOwn(attempt,'resultSnapshot')||attempt.state==='pending'&&Object.hasOwn(attempt,'outcomeReason')||attempt.state!=='pending'&&!text(attempt.outcomeReason))invalid('未完成的单条记忆核验不能携带支持结果');
 }
 if(new Set(support.heads.map(head=>head?.candidateId)).size!==support.heads.length||support.heads.some(head=>!object(head)||Object.keys(head).length!==2||!text(head.candidateId)||support.attempts.findLast(attempt=>attempt.candidateId===head.candidateId)?.id!==head.attemptId))invalid('当前单条记忆核验身份无效');
 return true;
}
