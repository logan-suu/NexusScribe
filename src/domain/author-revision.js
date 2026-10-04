/** Author-requested proposals are isolated from manuscript and memory authority. */
import * as engine from './engine.js';
import {segmentProse, MAX_PROSE_LENGTH} from './prose.js';
const copy = value => structuredClone(value);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value === 'string' && !!value.trim() && value.length <= MAX_PROSE_LENGTH;
const fail = message => {throw Object.assign(Error(message), {code:'INVALID_AUTHOR_REVISION'});};
const get = (state,id) => state.drafts.find(draft => draft.id === id) || fail('候选稿不存在');
export const REVISION_PROTOCOL = 'author-directed-revision-v1';
export const MAX_REVISION_INSTRUCTION = 4000;
export function proseCounts(value) {
 if (typeof value !== 'string') fail('正文必须是字符串');
 return {han:[...value.matchAll(/\p{Script=Han}/gu)].length, characters:[...value].length, paragraphs:segmentProse(value).length};
}
function eligible(state,draft) {
 if (!['DRAFT','IN_REVIEW'].includes(draft.status) || draft.requiresExtraction !== true || draft.providerInfo?.isLive !== true || Object.hasOwn(draft,'manualSource') || draft.provider === 'author-manuscript' || draft.providerInfo?.id === 'author-manuscript') fail('按意见改稿仅适用于待定的模型正文；已接受稿、模板与手写来源不支持此操作');
 engine.validateProseDraftRecord(draft);
 if (!engine.isDraftContextCurrent(state,draft.id)) fail('原文或参考上下文已变化，请先处理同步并明确更新参考上下文');
 if (state.pendingPatches.length) fail('请先处理待决补丁');
}
function binding(state,draft) {
 return {protocol:REVISION_PROTOCOL, projectId:state.projectId, draftId:draft.id, runId:draft.runId, chapterId:draft.chapterId, stateVersion:state.version, draftRevision:draft.revision, textSnapshot:draft.text, contextSnapshot:engine.getContext(state), instruction:draft.revisionInstruction || '', instructionVersion:draft.revisionInstructionVersion || 0};
}
export function validateDraftRevisions(draft) {
 if (!Object.hasOwn(draft,'revisionProposals') && !Object.hasOwn(draft,'revisionInstruction') && !Object.hasOwn(draft,'revisionInstructionVersion')) return true;
 const invalid = () => fail('改稿指令、原稿、结果或来源记录无效');
 if (typeof draft.revisionInstruction !== 'string' || draft.revisionInstruction.length > MAX_REVISION_INSTRUCTION || !integer(draft.revisionInstructionVersion) || !Array.isArray(draft.revisionProposals)) invalid();
 const ids = new Set();
 for (const proposal of draft.revisionProposals) {
  if (!object(proposal) || typeof proposal.id !== 'string' || !proposal.id || ids.has(proposal.id) || !['requesting','proposed','failed','cancelled','stale','discarded','adopted'].includes(proposal.status)) invalid();
  ids.add(proposal.id);
  const b = proposal.binding;
  if (!object(b) || b.protocol !== REVISION_PROTOCOL || b.projectId !== draft.projectId || b.draftId !== draft.id || b.runId !== draft.runId || b.chapterId !== draft.chapterId || !integer(b.stateVersion) || b.stateVersion < 1 || !integer(b.draftRevision) || b.draftRevision < 1 || !text(b.textSnapshot) || !draft.proseVersions?.some(v => v.revision === b.draftRevision && v.text === b.textSnapshot) || !object(b.contextSnapshot) || b.contextSnapshot.projectId !== b.projectId || b.contextSnapshot.version !== b.stateVersion || typeof b.instruction !== 'string' || !b.instruction.trim() || b.instruction.length > MAX_REVISION_INSTRUCTION || !integer(b.instructionVersion) || b.instructionVersion > draft.revisionInstructionVersion) invalid();
  if (!same(proposal.beforeCounts,proseCounts(b.textSnapshot))) invalid();
  if (proposal.result !== null) {
   const r = proposal.result;
   if (!object(r) || Object.keys(r).some(key => !['text','chapterId','provider'].includes(key)) || !text(r.text) || r.chapterId !== b.chapterId || !object(r.provider) || typeof r.provider.id !== 'string' || !r.provider.id || r.provider.isLive !== true || !same(r,proposal.resultSnapshot) || !same(proposal.afterCounts,proseCounts(r.text))) invalid();
  } else if (proposal.resultSnapshot !== null || proposal.afterCounts !== null) invalid();
  if (['requesting','failed','cancelled'].includes(proposal.status) && proposal.result !== null || ['proposed','adopted','discarded'].includes(proposal.status) && proposal.result === null) invalid();
  if (proposal.status === 'adopted' && (!integer(proposal.adoptedRevision) || proposal.adoptedRevision <= b.draftRevision || !draft.proseVersions.some(v => v.revision === proposal.adoptedRevision && v.text === proposal.result.text))) invalid();
 }
 return true;
}
export function setRevisionInstruction(state,id,instruction) {
 if (typeof instruction !== 'string' || instruction.length > MAX_REVISION_INSTRUCTION) fail('修改意见最多 4000 字符');
 const current = get(state,id); eligible(state,current); validateDraftRevisions(current);
 const s = copy(state), d = get(s,id);
 d.revisionProposals ??= []; d.revisionInstructionVersion ??= 0;
 if (instruction !== (d.revisionInstruction || '')) d.revisionInstructionVersion++;
 d.revisionInstruction = instruction;
 return s;
}
export function beginDraftRevision(state,id) {
 const current = get(state,id); eligible(state,current); validateDraftRevisions(current);
 if (!current.revisionInstruction?.trim()) fail('请先填写具体修改意见');
 if (current.revisionProposals?.some(p => p.status === 'requesting')) fail('已有改稿请求；请先取消或等待结果');
 const s = copy(state), d = get(s,id); s.sequence++;
 d.revisionProposals.push({id:`revision-${s.sequence}`, status:'requesting', binding:binding(s,d), beforeCounts:proseCounts(d.text), result:null, resultSnapshot:null, afterCounts:null});
 return s;
}
export function createRevisionInput(state,id,proposalId) {
 const d = get(state,id), p = d.revisionProposals?.find(p => p.id === proposalId);
 if (!p || p.status !== 'requesting' || !isRevisionCurrent(state,id,proposalId)) fail('改稿请求已过期');
 return copy({text:p.binding.textSnapshot, instruction:p.binding.instruction, chapterId:p.binding.chapterId, context:p.binding.contextSnapshot});
}
export function isRevisionCurrent(state,id,proposalId) {
 try {const d = get(state,id); eligible(state,d); validateDraftRevisions(d); const p = d.revisionProposals?.find(p => p.id === proposalId); return !!p && ['requesting','proposed'].includes(p.status) && same(p.binding,binding(state,d));} catch {return false;}
}
export function attachDraftRevision(state,id,proposalId,result,expected,{stale=false}={}) {
 const d = get(state,id); validateDraftRevisions(d);
 const original = d.revisionProposals?.find(p => p.id === proposalId);
 if (!original || original.status !== 'requesting' || !same(original.binding,expected)) fail('改稿结果不属于当前请求，或请求已取消');
 if (!object(result) || Object.keys(result).some(key => !['text','chapterId','provider'].includes(key)) || !text(result.text) || result.chapterId !== original.binding.chapterId || !object(result.provider) || !result.provider.id || result.provider.isLive !== true) fail('模型未返回有效的改稿正文');
 const current = isRevisionCurrent(state,id,proposalId), s = copy(state), p = get(s,id).revisionProposals.find(p => p.id === proposalId);
 p.result = copy(result); p.resultSnapshot = copy(result); p.afterCounts = proseCounts(result.text); p.status = current && !stale ? 'proposed' : 'stale';
 validateDraftRevisions(get(s,id));
 return s;
}
export function markRevisionFailure(state,id,proposalId,status='failed') {
 if (!['failed','cancelled','stale'].includes(status)) fail('无效的请求结束状态');
 const s = copy(state), p = get(s,id).revisionProposals?.find(p => p.id === proposalId);
 if (p?.status === 'requesting') p.status = status;
 return s;
}
export function discardDraftRevision(state,id,proposalId) {
 const d = get(state,id); validateDraftRevisions(d);
 const s = copy(state), p = get(s,id).revisionProposals?.find(p => p.id === proposalId);
 if (!p || !['proposed','stale'].includes(p.status) || !p.result) fail('此改稿建议不可放弃或已处理');
 p.status = 'discarded'; return s;
}
export function adoptDraftRevision(state,id,proposalId,expected) {
 const d = get(state,id); eligible(state,d); validateDraftRevisions(d);
 const p = d.revisionProposals?.find(p => p.id === proposalId);
 if (!p || p.status !== 'proposed' || !isRevisionCurrent(state,id,proposalId) || !same(p,expected)) fail('改稿建议、指令或原稿已变化，请重新核对；旧建议不能采用');
 // editDraft archives old extraction/reviews/author choices, preserves original prose,
 // and does not perform extraction, review, acceptance or a provider invocation.
 const s = engine.editDraft(state,id,p.result.text), next = get(s,id), adopted = next.revisionProposals.find(item => item.id === proposalId);
 adopted.status = 'adopted'; adopted.adoptedRevision = next.revision;
 validateDraftRevisions(next); return s;
}
