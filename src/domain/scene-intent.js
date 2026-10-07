import {getContext, hash} from './engine.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const field = (outline, key) => {
  if (!object(outline) || !Object.hasOwn(outline, key)) return {status:'missing', value:null};
  if (typeof outline[key] !== 'string') return {status:'invalid', value:null};
  return {status:outline[key].trim() ? 'present' : 'empty', value:outline[key]};
};

/** Read-only display reference, never generation evidence or acceptance authority.
 * The existing generator maps config.outline by chapter position, not outline IDs.
 * Draft context does not retain goal/exitState; never reconstruct them from plans.
 */
export function getSceneIntentReference(state, chapterId, draft = null) {
  const targetId = draft ? (draft.chapterId || 'ch3') : chapterId;
  const matches = state.chapters.filter(chapter => chapter.id === targetId);
  const index = matches.length === 1 ? state.chapters.findIndex(chapter => chapter.id === targetId) : -1;
  const chapter = state.chapters[index];
  const outline = index >= 0 && Array.isArray(state.config?.outline) ? state.config.outline[index] : undefined;
  const goal = field(outline, 'goal'), exitState = field(outline, 'exitState');
  const reference = {
    projectId:state.projectId, chapterId:targetId, chapterTitle:chapter?.title ?? '未知章节',
    chapterRevision:chapter?.revision ?? null, stateVersion:state.version,
    source:index >= 0 ? `config.outline[${index}]` : null,
    outlineId:object(outline) && typeof outline.id === 'string' ? outline.id : null,
    goal, exitState,
    // A display fingerprint only; compare full snapshots below, never just hashes.
    intentHash:hash(JSON.stringify([state.projectId, targetId, index, goal, exitState])),
    draft:null,
  };
  if (!draft) return reference;
  const context = draft.context;
  let contextStatus = 'unavailable';
  if (object(context)) {
    const current = getContext(state);
    contextStatus = chapter && draft.projectId === state.projectId && context.projectId === state.projectId
      && draft.baseVersion === state.version
      && state.chapters.every(ch => ch.syncStatus === 'CLEAN' && draft.chapterRevisions?.[ch.id] === ch.revision)
      && JSON.stringify(context) === JSON.stringify(current) ? 'current' : 'stale';
  }
  reference.draft = {
    id:draft.id, revision:draft.revision, textHash:hash(draft.text), baseVersion:draft.baseVersion,
    contextVersion:context?.version ?? null, contextSchemaVersion:context?.contextSchemaVersion ?? null,
    contextStatus, archived:['ACCEPTED','REJECTED'].includes(draft.status), status:draft.status,
  };
  return reference;
}
