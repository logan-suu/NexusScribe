/** Candidate evidence is model-assessed, never inferred from keyword presence. */
const copy = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && Boolean(value.trim());
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const invalid = (message='候选记忆审查格式无效') => { const error = Error(message); error.code='INVALID_MEMORY_REVIEW'; throw error; };
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
 const fields=['memoryReviewSchema','memoryCandidatesSnapshot','memoryDecisions','memoryDecisionHistory','memoryArchives','memoryAuthorities','memoryBindingSnapshots','memoryReviewEpoch'];
 if (fields.every(k=>!Object.hasOwn(draft,k))) return true;
 if (draft.memoryReviewSchema!==1 || !Number.isSafeInteger(draft.memoryReviewEpoch)||draft.memoryReviewEpoch<0||!memoryCandidatesIntact(draft)||!Array.isArray(draft.memoryDecisions)||!Array.isArray(draft.memoryDecisionHistory)||!Array.isArray(draft.memoryArchives)||!Array.isArray(draft.memoryAuthorities)||!Array.isArray(draft.memoryBindingSnapshots)) invalid('候选记忆快照或决定审计无效');
 for(const snapshot of draft.memoryBindingSnapshots)if(!object(snapshot)||!text(snapshot.id)||!object(snapshot.values)||typeof snapshot.values.textSnapshot!=='string'||!Array.isArray(snapshot.values.stagingSnapshot)||!object(snapshot.values.contextSnapshot)||Object.keys(snapshot.values).some(k=>!bindingSnapshotKeys.includes(k)))invalid('候选记忆完整绑定快照无效');
 if(new Set(draft.memoryBindingSnapshots.map(x=>x.id)).size!==draft.memoryBindingSnapshots.length)invalid('候选记忆完整绑定身份重复');
 for(const authority of draft.memoryAuthorities)if(!object(authority)||!text(authority.id)||!object(authority.binding)||!object(authority.reviewSnapshot)||!text(authority.reviewHash)||!Array.isArray(expandMemoryBinding(draft,authority.binding)?.stagingSnapshot))invalid('候选记忆授权快照无效');
 if(new Set(draft.memoryAuthorities.map(a=>a.id)).size!==draft.memoryAuthorities.length)invalid('候选记忆授权身份重复');
 for (const decision of [...draft.memoryDecisions,...draft.memoryDecisionHistory]) {
  if (!object(decision)||!text(decision.decisionId)||!text(decision.candidateId)||!['keep','reject','override_keep'].includes(decision.action)||typeof decision.reason!=='string'||decision.reason.length>2000||decision.action==='override_keep'&&!text(decision.reason)||!text(decision.authorityId)||!draft.memoryAuthorities.some(a=>a.id===decision.authorityId&&a.reviewHash===decision.reviewHash&&expandMemoryBinding(draft,a.binding)?.stagingSnapshot?.some(c=>c.id===decision.candidateId))||!text(decision.reviewHash)||!['supported','unsupported','unknown'].includes(decision.assessment)||!text(decision.explanation)||decision.authority!=='explicit_author_decision') invalid('候选记忆决定审计无效');
 }
 if (new Set(draft.memoryDecisions.map(d=>d.candidateId)).size!==draft.memoryDecisions.length||new Set(draft.memoryDecisionHistory.map(d=>d.decisionId)).size!==draft.memoryDecisionHistory.length||draft.memoryDecisions.some(d=>!draft.memoryDecisionHistory.some(h=>same(h,d)))) invalid('候选记忆决定历史不一致');
 for (const archive of draft.memoryArchives) if (!object(archive)||!text(archive.reason)||!Number.isSafeInteger(archive.draftRevision)||archive.draftRevision<1||typeof archive.textSnapshot!=='string'||!Array.isArray(archive.candidates)||!Array.isArray(archive.stagingSnapshot)||!Array.isArray(archive.decisions)||!Array.isArray(archive.authorityIds)||archive.authorityIds.some(id=>!draft.memoryAuthorities.some(a=>a.id===id))||archive.candidates.some(c=>!object(c)||!text(c.id)||!text(c.label)||!text(c.sourceQuote))) invalid('候选记忆存档无效');
 return true;
}
