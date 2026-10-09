import {createInitialState, getImpacts, getFactReviewGate, validatePatch, validateProseDraftRecord, validateMemoryDraftRecord, validateManualDraftSource, hash} from './domain/engine.js';
import {validateDraftRevisions} from './domain/author-revision.js';
import {archiveMemoryReview, replaceMemoryCandidates} from './domain/memory-review.js';
import {validateGenerationIntentRecord} from './domain/generation-intent.js';
import type {Project, Workspace} from './storage-types.js';
export type {Editing, ImportOrigin, Project, ProjectRecord, Workspace, WorkspaceRecovery} from './storage-types.js';

export const KEY = 'nexusscribe.demo.v1', BACKUP_KEY = KEY + '.last-good', QUARANTINE_KEY = KEY + '.preserved';
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
function bad(message: string): never {throw Error(message);}
type UnknownRecord = Record<string, unknown>;
const object = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = (value: unknown): value is unknown[] => Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string';
const fresh = (): Workspace => ({format: 1, serial: 0, state: createInitialState(), editing: {}, patch: null});

// Never evaluate imported content. Bound traversal and forbid dangerous keys at every depth.
function inspect(value: unknown, depth = 0, budget = {nodes: 0}): void {
  if (depth > 60 || ++budget.nodes > 150000) bad('备份结构超出安全上限');
  if (array(value)) {
    if (value.length > 20000) bad('备份列表过大');
    value.forEach(item => inspect(item, depth + 1, budget));
  } else if (object(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) bad('备份包含不安全字段');
      inspect(item, depth + 1, budget);
    }
  }
}

function records(items: unknown, label: string): asserts items is UnknownRecord[] {
  if (!array(items) || items.some(item => !object(item))) bad(label + '格式无效');
  const ids = items.filter(object).filter(item => item.id !== undefined).map(item => item.id);
  if (ids.some(id => !text(id) || !id) || new Set(ids).size !== ids.length) bad(label + ' ID 冲突');
}

const stringFields = ['kind','type','op','id','title','text','label','originalLabel','statement','description','proposition','quote','status','condition','reason','summary','explanation','sourceQuote','factLabel','factId','chapterId','paragraphId','candidateId','decisionId','draftId','runId','projectId','holder','subject','predicate','authority','value','mode','syncStatus','semanticStatus'];
const numberFields = ['revision','version','baseVersion','recordVersion','syncedRevision','draftRevision','stateVersion','toVersion'];
function displayTypes(value: unknown): void {
  if (array(value)) value.forEach(displayTypes);
  else if (object(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (stringFields.includes(key) && item !== null && !text(item)) bad('备份文本字段格式无效：' + key);
      if (numberFields.includes(key) && item !== null && !integer(item)) bad('备份版本字段格式无效：' + key);
      displayTypes(item);
    }
  }
}

const collectionKeys = ['chapters','facts','knowledge','evidence','plans','events','disclosures','preferences','drafts','commits','factHistory','pendingPatches','derived'] as const;
type CollectionKey = typeof collectionKeys[number];
type CheckedCollections = UnknownRecord & Record<CollectionKey, UnknownRecord[]>;
function validateCollections(state: UnknownRecord): asserts state is CheckedCollections {
  for (const key of collectionKeys) {
    // History may repeat logical IDs across record versions; other entity collections may not.
    if (key === 'factHistory') {
      if (!array(state[key]) || state[key].some(item => !object(item))) bad('历史格式无效');
    } else records(state[key], key);
  }
}

interface CheckedRevision extends UnknownRecord {
  revision: number;
  text: string;
  paragraphs: (UnknownRecord & {id: string; text: string})[];
}
interface CheckedChapter extends UnknownRecord {
  id: string;
  title: string;
  text: string;
  revision: number;
  syncedRevision: number;
  status: string;
  syncStatus: string;
  revisions: CheckedRevision[];
}
function validateChapters(chapters: UnknownRecord[]): asserts chapters is CheckedChapter[] {
  if (!chapters.length || chapters.length > 2000) bad('章节数量无效');
  for (const chapter of chapters) {
    if (!text(chapter.id) || !chapter.id || !text(chapter.title) || !text(chapter.text)
      || !integer(chapter.revision) || !integer(chapter.syncedRevision) || !text(chapter.status) || !text(chapter.syncStatus)) bad('章节格式无效');
    records(chapter.revisions, '正文版本');
    const revisions = new Set<number>();
    for (const revision of chapter.revisions) {
      if (!integer(revision.revision) || revisions.has(revision.revision) || !text(revision.text)
        || !array(revision.paragraphs) || revision.paragraphs.some(paragraph => !object(paragraph) || !text(paragraph.id) || !text(paragraph.text))) bad('正文版本格式无效');
      revisions.add(revision.revision);
    }
    if (!chapter.revisions.some(revision => revision.revision === chapter.revision && revision.text === chapter.text)) bad('当前正文缺少对应原始版本');
  }
}

/**
 * Import dependency probes historically accept partially populated legacy records.
 * Invoke those runtime checks without pretending their untrusted arguments already
 * satisfy the richer engine-created-record contracts. Their result is discarded;
 * only successful completion contributes to the existing import checks below.
 */
function probe(check: (...args: never[]) => unknown, ...args: unknown[]): void {
  Reflect.apply(check, undefined, args);
}

interface CheckedProject extends UnknownRecord {
  state: CheckedCollections & {projectId: string; chapters: CheckedChapter[]};
  editing: UnknownRecord;
}
function validateProject(project: unknown): asserts project is CheckedProject {
  if (!object(project) || !object(project.state) || !object(project.editing)) bad('项目结构无效');
  const state = project.state;
  if (state.schemaVersion !== 1 || (state.mode !== 'demo' && state.mode !== 'custom') || !text(state.projectId) || !state.projectId
    || !text(state.title) || !integer(state.version) || !integer(state.sequence)) bad('项目版本或标识不兼容');
  displayTypes(state);
  validateCollections(state);
  for (const key of ['facts','knowledge','evidence','plans','events','disclosures','drafts','commits'] as const) {
    if (state[key].some(item => !text(item.id) || !item.id)) bad(key + ' 缺少 ID');
  }
  validateChapters(state.chapters);
  for (const [id, value] of Object.entries(project.editing)) {
    if (!state.chapters.some(chapter => chapter.id === id) || (value !== undefined && !text(value))) bad('暂存正文格式无效');
  }
  for (const knowledge of state.knowledge) {
    if (!array(knowledge.supportSets) || knowledge.supportSets.some(set => !array(set) || set.some(item => !text(item)))) bad('认知来源格式无效');
  }
  for (const draft of state.drafts) {
    try {probe(validateGenerationIntentRecord, state, draft);} catch {bad('候选稿生成意图来源记录无效');}
    try {
      probe(validateProseDraftRecord, draft);
      probe(validateMemoryDraftRecord, draft);
      probe(validateDraftRevisions, draft);
      probe(validateManualDraftSource, state, draft);
    } catch {bad('候选稿正文版本或记忆提取记录无效');}
    if (draft.requiresExtraction !== undefined && typeof draft.requiresExtraction !== 'boolean') bad('候选稿提取标记无效');
    if (draft.requiresExtraction === true) {
      if (draft.projectId !== state.projectId) bad('候选稿提取记录不属于当前项目');
      if (!object(draft.context) || !array(draft.context.sources)) bad('候选稿来源正文版本无效');
      for (const source of draft.context.sources) {
        if (!object(source) || !state.chapters.some(chapter => chapter.id === source.chapterId
          && chapter.revisions.some(revision => revision.revision === source.revision && revision.text === source.text))) bad('候选稿来源正文版本无效');
      }
    }
    if (!text(draft.id) || !text(draft.text) || !integer(draft.revision) || !object(draft.chapterRevisions) || !array(draft.staging)) bad('候选稿格式无效');
    for (const report of [draft.review, draft.modelReview]) {
      if (report != null) {
        if (!object(report)) bad('审阅记录格式无效');
        for (const key of ['issues','errors','factLedger','factChecks','memoryLedger','memoryChecks']) {
          const entries = report[key];
          if (entries !== undefined && (!array(entries) || entries.some(entry => !(object(entry) || (['issues','errors'].includes(key) && report === draft.review && text(entry)))))) bad('审阅列表格式无效');
        }
      }
    }
    if (draft.factDecisions !== undefined && (!array(draft.factDecisions) || draft.factDecisions.some(item => !object(item)))) bad('例外记录格式无效');
  }
  if (state.config && (!object(state.config) || (state.config.outline !== undefined
    && (!array(state.config.outline) || state.config.outline.some(item => !object(item) && !text(item)))))) bad('故事约定格式无效');
  if (state.config) {
    // The preceding check establishes this shape while preserving absent/falsy legacy config.
    if (!object(state.config)) bad('故事约定格式无效');
    for (const key of ['idea','premise','protagonist','pov','tone','goal','boundaries']) {
      if (state.config[key] !== undefined && !text(state.config[key])) bad('故事约定文本格式无效');
    }
    if (state.config.constraints !== undefined && (!array(state.config.constraints) || state.config.constraints.some(item => !text(item)))) bad('故事约定限制格式无效');
  }
  if (project.patch !== null && project.patch !== undefined) {
    if (!object(project.patch) || !array(project.patch.operations) || !array(project.patch.questions) || !array(project.patch.intents)) bad('待决补丁格式无效');
    displayTypes(project.patch);
    if (project.patch.operations.some(item => !object(item)) || project.patch.questions.some(item => !text(item)) || project.patch.intents.some(item => !text(item))) bad('待决补丁内容格式无效');
  }
  try {
    probe(getImpacts, state);
    state.drafts.forEach(draft => probe(getFactReviewGate, state, draft.id));
    if (project.patch) probe(validatePatch, state, project.patch);
  } catch {bad('项目依赖结构无效，未导入');}
}

export function parseBackup(raw: unknown): Workspace {
  if (!text(raw) || new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) bad('备份超过 2 MiB 上限');
  let data: unknown;
  try {data = JSON.parse(raw);} catch {bad('备份不是有效 JSON');}
  inspect(data);
  if (object(data)) delete data.recovery; // Runtime recovery flags are never trusted from serialized input.
  if (!object(data) || data.format !== 1 || !integer(data.serial) || data.serial === Number.MAX_SAFE_INTEGER) bad('保存数据格式不兼容');
  if (data.providerMode !== undefined && data.providerMode !== 'template' && data.providerMode !== 'server') bad('运行方式无效');
  if (data.archived !== undefined && !array(data.archived)) bad('项目列表无效');
  const archived = array(data.archived) ? data.archived : [];
  const projects = [data, ...archived];
  if (projects.length > 50) bad('备份最多支持 50 个项目');
  const ids: string[] = [];
  for (const project of projects) {
    validateProject(project);
    ids.push(project.state.projectId);
  }
  if (new Set(ids).size !== ids.length) bad('项目 ID 冲突');
  // Audited v1 compatibility boundary: every pre-existing structural/provenance
  // check above has completed. Historical records may intentionally omit fields
  // supplied by today's engine (for example, old review metadata). Do not tighten
  // these checks or normalize the data merely to satisfy a newer producer type.
  return data as unknown as Workspace;
}

function encode(data: Workspace): string {
  const {recovery, ...clean} = data;
  const raw = JSON.stringify(clean);
  parseBackup(raw);
  return raw;
}

export function loadWorkspace(): Workspace {
  let primaryRaw: string | null | undefined;
  try {
    primaryRaw = localStorage.getItem(KEY);
    if (primaryRaw !== null) return parseBackup(primaryRaw);
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup !== null) return {...parseBackup(backup), recovery: {blocked: true, primaryRaw: null, message: '主存储缺失，已打开上一份可读备份。请导出并确认恢复后再保存。'}};
    return fresh();
  } catch (error: unknown) {
    let workspace = fresh(), available = false;
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (raw !== null) {workspace = parseBackup(raw); available = true;}
    } catch {}
    return {...workspace, recovery: {blocked: true, primaryRaw, message: available
      ? '主存储损坏，已打开上一份可读备份；原始数据未改变。请导出并确认恢复。'
      : '存储无法读取，已进入临时工作区；原始数据未改变。请导出当前内容。', available,
    error: error instanceof Error || object(error) ? error.message : undefined}};
  }
}

export function persistWorkspace(data: Workspace, expected: number): Workspace {
  if (data.recovery?.blocked) bad('尚未恢复存储，当前编辑仅在内存中；请先导出并确认恢复');
  const current = localStorage.getItem(KEY), old = current === null ? null : parseBackup(current);
  if ((old?.serial ?? 0) !== expected) bad('另一窗口已更新项目。当前编辑已保留在内存，请先导出再刷新');
  const next: Workspace = {...data, format: 1, serial: expected + 1};
  const raw = encode(next);
  if (current !== null) localStorage.setItem(BACKUP_KEY, current);
  localStorage.setItem(KEY, raw);
  return next;
}

export function recoverWorkspace(data: Workspace): Workspace {
  if (!data.recovery?.blocked) bad('无需恢复');
  const current = localStorage.getItem(KEY);
  if (current !== data.recovery.primaryRaw) bad('存储已被另一窗口改变，请导出当前编辑后重新打开');
  const {recovery, ...clean} = data;
  const next: Workspace = {...clean, serial: clean.serial + 1};
  const raw = encode(next);
  // A preservation failure MUST stop repair. Existing evidence is never silently replaced.
  if (current !== null) {
    const preserved = localStorage.getItem(QUARANTINE_KEY);
    if (preserved !== null && preserved !== current) bad('已存在另一份损坏原始数据，请先导出，暂不覆盖恢复');
    localStorage.setItem(QUARANTINE_KEY, current);
  }
  localStorage.setItem(KEY, raw);
  return next;
}

export function importBackup(current: Workspace, backup: unknown, idFactory: () => string = () => `import-${crypto.randomUUID()}`): Workspace {
  const parsed = parseBackup(JSON.stringify(backup));
  const used = new Set([current.state.projectId, ...(current.archived || []).map(project => project.state.projectId)]);
  const projects = [parsed, ...(parsed.archived || [])].map(project => {
    const id = idFactory();
    if (!text(id) || !id || used.has(id)) bad('新项目 ID 冲突，未导入');
    used.add(id);
    const original: Project = structuredClone({state: project.state, editing: project.editing, patch: project.patch ?? null});
    const clone = structuredClone(original);
    function remap(value: unknown): void {
      if (array(value)) value.forEach(remap);
      else if (object(value)) {
        for (const [key, item] of Object.entries(value)) {
          if (key === 'projectId' && item === project.state.projectId) value[key] = id;
          else remap(item);
        }
      }
    }
    remap(clone);
    // Exact original bytes are available in the user's source file; preserve structured audit here.
    clone.state.importOrigin = {projectId: project.state.projectId, original};
    clone.patch = null;
    clone.state.pendingPatches = [];
    for (const draft of clone.state.drafts) {
      if (draft.requiresExtraction && draft.extraction?.binding) draft.extraction.binding.contextHash = hash(JSON.stringify(draft.context));
      if (!['ACCEPTED', 'REJECTED'].includes(draft.status)) {
        for (const proposal of draft.revisionProposals || []) {
          if (['requesting', 'proposed'].includes(proposal.status)) {proposal.status = 'stale'; proposal.resultSnapshot = null;}
        }
        archiveMemoryReview(draft, 'backup_imported');
        draft.review = null;
        draft.modelReview = null;
        draft.factDecisions = [];
        draft.status = 'DRAFT';
        if (draft.requiresExtraction) {
          replaceMemoryCandidates(draft, []);
          // Prose validation above guarantees an extraction record for this branch.
          if (!draft.extraction) bad('候选稿正文版本或记忆提取记录无效');
          draft.extraction = {status: 'pending', attempt: draft.extraction.attempt + 1, binding: null};
        }
      }
    }
    return clone;
  });
  const active: Project = {state: current.state, editing: current.editing, patch: current.patch};
  const next: Workspace = {...current, ...projects[0], archived: [...(current.archived || []), active, ...projects.slice(1)]};
  encode(next);
  return next;
}

export function download(name: string, data: unknown, type = 'application/json'): void {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {type});
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}
