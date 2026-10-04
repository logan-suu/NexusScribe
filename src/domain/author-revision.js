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
const LENGTH_FIELDS = ['hanMin','hanMax','paragraphsMin','paragraphsMax'];
/** Only explicit numeric fields count as bounds; freeform instructions are never parsed. */
export function parseRevisionLengthBounds(fields = {}) {
 if (!object(fields) || Object.keys(fields).some(key => !LENGTH_FIELDS.includes(key))) fail('篇幅范围字段无效');
 const bounds = {};
 for (const key of LENGTH_FIELDS) {
  const value = fields[key];
  if (value === undefined || value === '') continue;
  if (typeof value === 'string' && !/^\d+$/.test(value) || !['number','string'].includes(typeof value) || !integer(Number(value))) fail('篇幅范围须为非负安全整数，或留空');
  bounds[key] = Number(value);
 }
 for (const metric of ['han','paragraphs']) if (bounds[metric+'Min'] !== undefined && bounds[metric+'Max'] !== undefined && bounds[metric+'Min'] > bounds[metric+'Max']) fail('篇幅下限不能高于上限');
 return bounds;
}
function validateLengthBounds(bounds) {
 if (!object(bounds) || Object.values(bounds).some(value => !integer(value)) || !same(bounds,parseRevisionLengthBounds(bounds))) fail('篇幅范围记录无效');
}
export function revisionLengthWarnings(value, bounds = {}) {
 validateLengthBounds(bounds);
 const counts = proseCounts(value), warnings = [];
 for (const [metric,label] of [['han','汉字'],['paragraphs','段数']]) {
  const min = bounds[metric+'Min'], max = bounds[metric+'Max'];
  if (min !== undefined && counts[metric] < min) warnings.push(`${label} ${counts[metric]} 低于作者下限 ${min}`);
  if (max !== undefined && counts[metric] > max) warnings.push(`${label} ${counts[metric]} 高于作者上限 ${max}`);
 }
 return warnings;
}
export function getRevisionAdoptedText(draft, proposal) {
 if (proposal.status !== 'adopted') return null;
 return draft.proseVersions.find(version => version.revision === proposal.adoptedRevision)?.text ?? null;
}
function eligible(state,draft) {
 if (!['DRAFT','IN_REVIEW'].includes(draft.status) || draft.requiresExtraction !== true || draft.providerInfo?.isLive !== true || Object.hasOwn(draft,'manualSource') || draft.provider === 'author-manuscript' || draft.providerInfo?.id === 'author-manuscript') fail('按意见改稿仅适用于待定的模型正文；已接受稿、模板与手写来源不支持此操作');
 engine.validateProseDraftRecord(draft);
 if (!engine.isDraftContextCurrent(state,draft.id)) fail('原文或参考上下文已变化，请先处理同步并明确更新参考上下文');
 if (state.pendingPatches.length) fail('请先处理待决补丁');
}
function sourceSnapshot(draft,snapshotId) {
 const source=draft.revisionSnapshots?.find(item=>item.id===snapshotId);
 if(!source)fail('改稿来源快照缺失');
 return source;
}
export function getRevisionSource(draft,proposal) {return copy(sourceSnapshot(draft,proposal.binding.snapshotId));}
function binding(state,draft,snapshotId) {
 return {protocol:REVISION_PROTOCOL, projectId:state.projectId, draftId:draft.id, runId:draft.runId, chapterId:draft.chapterId, stateVersion:state.version, draftRevision:draft.revision, snapshotId, instruction:draft.revisionInstruction || '', instructionVersion:draft.revisionInstructionVersion || 0};
}
function internSource(state,draft) {
 const contextSnapshot=engine.getContext(state),textSnapshot=draft.text;
 let source=draft.revisionSnapshots.find(item=>item.textSnapshot===textSnapshot&&same(item.contextSnapshot,contextSnapshot));
 if(!source){source={id:`revision-source-${draft.revisionSnapshots.length+1}`,textSnapshot,contextSnapshot};draft.revisionSnapshots.push(source);}
 return source.id;
}
export function validateDraftRevisions(draft) {
 if (!Object.hasOwn(draft,'revisionProposals') && !Object.hasOwn(draft,'revisionInstruction') && !Object.hasOwn(draft,'revisionInstructionVersion') && !Object.hasOwn(draft,'revisionSnapshots')) return true;
 const invalid = () => fail('改稿指令、原稿、结果或来源记录无效');
 if (draft.requiresExtraction !== true || draft.providerInfo?.isLive !== true || Object.hasOwn(draft,'manualSource') || draft.provider === 'author-manuscript' || draft.providerInfo?.id === 'author-manuscript') invalid();
 if (typeof draft.revisionInstruction !== 'string' || draft.revisionInstruction.length > MAX_REVISION_INSTRUCTION || !integer(draft.revisionInstructionVersion) || !Array.isArray(draft.revisionProposals) || !Array.isArray(draft.revisionSnapshots)) invalid();
 const sourceIds=new Set(),sourceMap=new Map(),sourceCounts=new Map(),versionsByRevision=new Map((draft.proseVersions||[]).map(v=>[v.revision,v])),versionTexts=new Set((draft.proseVersions||[]).map(v=>v.text));
 for(const source of draft.revisionSnapshots){if(!object(source)||Object.keys(source).length!==3||typeof source.id!=='string'||!source.id||sourceIds.has(source.id)||!text(source.textSnapshot)||!versionTexts.has(source.textSnapshot)||!object(source.contextSnapshot)||source.contextSnapshot.projectId!==draft.projectId)invalid();sourceIds.add(source.id);sourceMap.set(source.id,source);sourceCounts.set(source.id,proseCounts(source.textSnapshot));}
 const ids = new Set();
 for (const proposal of draft.revisionProposals) {
  if (!object(proposal) || typeof proposal.id !== 'string' || !proposal.id || ids.has(proposal.id) || !['requesting','proposed','failed','cancelled','stale','discarded','adopted'].includes(proposal.status)) invalid();
  ids.add(proposal.id);
  const b = proposal.binding, source = sourceMap.get(b?.snapshotId);
  if (!object(b) || b.protocol !== REVISION_PROTOCOL || b.projectId !== draft.projectId || b.draftId !== draft.id || b.runId !== draft.runId || b.chapterId !== draft.chapterId || !integer(b.stateVersion) || b.stateVersion < 1 || !integer(b.draftRevision) || b.draftRevision < 1 || Object.keys(b).length!==10 || !source || versionsByRevision.get(b.draftRevision)?.text !== source.textSnapshot || source.contextSnapshot.version !== b.stateVersion || typeof b.instruction !== 'string' || !b.instruction.trim() || b.instruction.length > MAX_REVISION_INSTRUCTION || !integer(b.instructionVersion) || b.instructionVersion > draft.revisionInstructionVersion) invalid();
  if (!same(proposal.beforeCounts,sourceCounts.get(b.snapshotId))) invalid();
  if (proposal.result !== null) {
   const r = proposal.result;
   if (!object(r) || Object.keys(r).some(key => !['text','chapterId','provider'].includes(key)) || !text(r.text) || r.chapterId !== b.chapterId || !object(r.provider) || typeof r.provider.id !== 'string' || !r.provider.id || r.provider.isLive !== true || (['proposed','requesting'].includes(proposal.status)?!same(r,proposal.resultSnapshot):proposal.resultSnapshot!==null) || !same(proposal.afterCounts,proseCounts(r.text))) invalid();
  } else if (proposal.resultSnapshot !== null || proposal.afterCounts !== null) invalid();
  if (['requesting','failed','cancelled'].includes(proposal.status) && proposal.result !== null || ['proposed','adopted','discarded'].includes(proposal.status) && proposal.result === null) invalid();
  if (proposal.status === 'adopted') {
   const finalText = versionsByRevision.get(proposal.adoptedRevision)?.text;
   if (!integer(proposal.adoptedRevision) || proposal.adoptedRevision <= b.draftRevision || !text(finalText)) invalid();
   if (Object.hasOwn(proposal,'adoption')) {
    const a = proposal.adoption;
    if (!object(a) || Object.keys(a).length !== 4 || a.authority !== (finalText === proposal.result.text ? 'explicit_model_adoption' : 'explicit_author_edit') || a.textHash !== engine.hash(finalText) || !same(a.counts,proseCounts(finalText))) invalid();
    validateLengthBounds(a.lengthBounds);
   } else if (finalText !== proposal.result.text) invalid(); // Legacy, unedited adoption.
  } else if (Object.hasOwn(proposal,'adoption') || Object.hasOwn(proposal,'adoptedRevision')) invalid();
 }
 return true;
}
export function setRevisionInstruction(state,id,instruction) {
 if (typeof instruction !== 'string' || instruction.length > MAX_REVISION_INSTRUCTION) fail('修改意见最多 4000 字符');
 const current = get(state,id); eligible(state,current); validateDraftRevisions(current);
 const s = copy(state), d = get(s,id);
 d.revisionProposals ??= []; d.revisionSnapshots ??= []; d.revisionInstructionVersion ??= 0;
 if (instruction !== (d.revisionInstruction || '')) d.revisionInstructionVersion++;
 d.revisionInstruction = instruction;
 return s;
}
export function validateRevisionRequest(state,id) {
 const current = get(state,id); eligible(state,current); validateDraftRevisions(current);
 if (!current.revisionInstruction?.trim()) fail('请先填写具体修改意见');
 if (current.revisionProposals?.some(p => p.status === 'requesting')) fail('已有改稿请求；请先取消或等待结果');
 return true;
}
export function beginDraftRevision(state,id) {
 validateRevisionRequest(state,id);
 const s = copy(state), d = get(s,id); s.sequence++;
 const snapshotId=internSource(s,d);
 d.revisionProposals.push({id:`revision-${s.sequence}`, status:'requesting', binding:binding(s,d,snapshotId), beforeCounts:proseCounts(d.text), result:null, resultSnapshot:null, afterCounts:null});
 return s;
}
export function createRevisionInput(state,id,proposalId) {
 const d = get(state,id), p = d.revisionProposals?.find(p => p.id === proposalId);
 if (!p || p.status !== 'requesting' || !isRevisionCurrent(state,id,proposalId)) fail('改稿请求已过期');
 const source=sourceSnapshot(d,p.binding.snapshotId);
 return copy({text:source.textSnapshot, instruction:p.binding.instruction, chapterId:p.binding.chapterId, context:source.contextSnapshot});
}
/** Render once per draft; terminal proposals never trigger repeated history validation. */
export function getRevisionCurrency(state,id) {
 const d=get(state,id),result=Object.fromEntries((d.revisionProposals||[]).map(p=>[p.id,false]));
 if(!(d.revisionProposals||[]).some(p=>['requesting','proposed'].includes(p.status)))return result;
 try{
  eligible(state,d);validateDraftRevisions(d);
  const context=engine.getContext(state),currentSources=new Set(d.revisionSnapshots.filter(source=>source.textSnapshot===d.text&&same(source.contextSnapshot,context)).map(source=>source.id));
  for(const p of d.revisionProposals)if(['requesting','proposed'].includes(p.status)&&currentSources.has(p.binding.snapshotId))result[p.id]=same(p.binding,binding(state,d,p.binding.snapshotId));
 }catch{}
 return result;
}
export function isRevisionCurrent(state,id,proposalId) {
 const d=state.drafts.find(item=>item.id===id),p=d?.revisionProposals?.find(item=>item.id===proposalId);
 if(!p||!['requesting','proposed'].includes(p.status))return false;
 return getRevisionCurrency(state,id)[proposalId]===true;
}
export function attachDraftRevision(state,id,proposalId,result,expected,{stale=false}={}) {
 const d = get(state,id); validateDraftRevisions(d);
 const original = d.revisionProposals?.find(p => p.id === proposalId);
 if (!original || original.status !== 'requesting' || !same(original.binding,expected)) fail('改稿结果不属于当前请求，或请求已取消');
 if (!object(result) || Object.keys(result).some(key => !['text','chapterId','provider'].includes(key)) || !text(result.text) || result.chapterId !== original.binding.chapterId || !object(result.provider) || !result.provider.id || result.provider.isLive !== true) fail('模型未返回有效的改稿正文');
 const current = isRevisionCurrent(state,id,proposalId), s = copy(state), p = get(s,id).revisionProposals.find(p => p.id === proposalId);
 p.result = copy(result); p.afterCounts = proseCounts(result.text); p.status = current && !stale ? 'proposed' : 'stale'; p.resultSnapshot=p.status==='proposed'?copy(result):null;
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
 p.status = 'discarded'; p.resultSnapshot=null; return s;
}
export function adoptDraftRevision(state,id,proposalId,expected,options = {}) {
 const d = get(state,id); eligible(state,d); validateDraftRevisions(d);
 const p = d.revisionProposals?.find(p => p.id === proposalId);
 if (!p || p.status !== 'proposed' || !isRevisionCurrent(state,id,proposalId) || !same(p,expected)) fail('改稿建议、指令或原稿已变化，请重新核对；旧建议不能采用');
 if (!object(options) || Object.keys(options).some(key => !['text','lengthBounds'].includes(key))) fail('采用选项无效');
 const finalText = options.text === undefined ? p.result.text : options.text;
 if (!text(finalText)) fail('待采用正文不能为空，且不得超过 30000 字符');
 const lengthBounds = options.lengthBounds === undefined ? {} : options.lengthBounds;
 validateLengthBounds(lengthBounds);
 // editDraft archives old extraction/reviews/author choices, preserves original prose,
 // and does not perform extraction, review, acceptance or a provider invocation.
 const s = engine.editDraft(state,id,finalText), next = get(s,id), adopted = next.revisionProposals.find(item => item.id === proposalId);
 adopted.status = 'adopted'; adopted.adoptedRevision = next.revision; adopted.resultSnapshot=null;
 adopted.adoption = {authority:finalText === p.result.text ? 'explicit_model_adoption' : 'explicit_author_edit', textHash:engine.hash(finalText), counts:proseCounts(finalText), lengthBounds:copy(lengthBounds)};
 validateDraftRevisions(next); return s;
}
