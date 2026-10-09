/** A local generation-input record, never proof of wire model input or intent fulfillment. */
export const GENERATION_INTENT_PROTOCOL = 'generation-intent-v1';
export const GENERATION_INTENT_BOUNDARY = 'app-generation-input';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = value => typeof value === 'string' && !!value.trim();
const integer = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => integer(value) && value > 0;
const fail = () => { throw Object.assign(Error('生成意图来源记录或目标绑定无效'), {code:'INVALID_GENERATION_INTENT'}); };
const captureKeys = ['protocol','boundary','projectId','chapterId','chapterIndex','chapterRevision','stateVersion','source','goal','exitState'];
const bindingKeys = ['draftId','runId','draftRevision'];
const manual = draft => Object.hasOwn(draft, 'manualSource') || draft.provider === 'author-manuscript' || draft.providerInfo?.id === 'author-manuscript';

function field(outline, key) {
  if (!object(outline) || !Object.hasOwn(outline, key)) return {status:'missing', value:null};
  if (typeof outline[key] !== 'string') return {status:'invalid', value:null};
  return {status:outline[key].trim() ? 'present' : 'empty', value:outline[key]};
}
function validField(value) {
  if (!exactKeys(value, ['status','value'])) return false;
  if (['missing','invalid'].includes(value.status)) return value.value === null;
  return typeof value.value === 'string' && (value.status === 'present' ? !!value.value.trim() : value.status === 'empty' && !value.value.trim());
}
function validateSnapshot(value, bound = false) {
  if (!exactKeys(value, [...captureKeys, ...(bound ? bindingKeys : [])])
    || value.protocol !== GENERATION_INTENT_PROTOCOL || value.boundary !== GENERATION_INTENT_BOUNDARY
    || !id(value.projectId) || !id(value.chapterId) || !integer(value.chapterIndex)
    || !positive(value.chapterRevision) || !positive(value.stateVersion)
    || value.source !== `project.outline[${value.chapterIndex}]`
    || !validField(value.goal) || !validField(value.exitState)
    || bound && (!id(value.draftId) || !id(value.runId) || value.draftRevision !== 1)) fail();
}
function freeze(value) {
  Object.freeze(value.goal); Object.freeze(value.exitState); return Object.freeze(value);
}

/** Capture the already-mapped request immediately before calling the provider.
 * Missing/unsupported fields are recorded, never reconstructed from plans or Canon.
 * Canonical identity comes from context, not a user-authored outline ID.
 */
export function captureGenerationIntent({project, chapterIndex, context}) {
  if (!object(project) || !object(context) || !id(context.projectId) || !positive(context.version)
    || !integer(chapterIndex) || !Array.isArray(context.sources)
    || Object.hasOwn(project, 'projectId') && project.projectId !== context.projectId) fail();
  const source = context.sources[chapterIndex];
  const outline = Array.isArray(project.outline) ? project.outline[chapterIndex] : undefined;
  if (!object(source) || !id(source.chapterId) || !positive(source.revision)
    || context.sources.filter(item => item?.chapterId === source.chapterId).length !== 1
    || Object.hasOwn(source, 'chapterIndex') && source.chapterIndex !== chapterIndex
    || object(outline) && Object.hasOwn(outline, 'id') && outline.id !== source.chapterId) fail();
  return freeze({
    protocol:GENERATION_INTENT_PROTOCOL, boundary:GENERATION_INTENT_BOUNDARY,
    projectId:context.projectId, chapterId:source.chapterId, chapterIndex,
    chapterRevision:source.revision, stateVersion:context.version,
    source:`project.outline[${chapterIndex}]`, goal:field(outline, 'goal'), exitState:field(outline, 'exitState'),
  });
}

/** Bind a separately supplied local snapshot to initial draft r1, not provider output. */
export function bindGenerationIntent(state, draft, snapshot) {
  validateSnapshot(snapshot);
  if (manual(draft) || draft.revision !== 1 || draft.projectId !== state.projectId
    || snapshot.projectId !== state.projectId || snapshot.chapterId !== draft.chapterId
    || snapshot.stateVersion !== state.version || state.chapters[snapshot.chapterIndex]?.id !== draft.chapterId
    || state.chapters[snapshot.chapterIndex]?.revision !== snapshot.chapterRevision) fail();
  const record = {...structuredClone(snapshot), draftId:draft.id, runId:draft.runId, draftRevision:1};
  validateGenerationIntentRecord(state, {...draft, generationIntent:record});
  return freeze(record);
}

/** Legacy absence is valid. Import validates shape and identity, not authenticity.
 * Historical generation versions must never be compared to refreshed baseVersion
 * or current outline values. No text is duplicated or attributed to later edits.
 */
export function validateGenerationIntentRecord(state, draft) {
  if (!Object.hasOwn(draft, 'generationIntent')) return true;
  const record = draft.generationIntent;
  validateSnapshot(record, true);
  const chapters = state.chapters.filter(chapter => chapter.id === record.chapterId);
  if (manual(draft) || draft.projectId !== state.projectId || record.projectId !== draft.projectId
    || record.chapterId !== draft.chapterId || record.draftId !== draft.id || record.runId !== draft.runId
    || !positive(draft.revision) || record.stateVersion > state.version || chapters.length !== 1
    || !chapters[0].revisions.some(revision => revision.revision === record.chapterRevision)
    || Array.isArray(draft.proseVersions) && draft.proseVersions[0]?.revision !== record.draftRevision) fail();
  return true;
}
