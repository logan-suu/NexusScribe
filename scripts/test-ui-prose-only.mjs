// Offline workflow regressions only. Historical prose is replayed without a live
// provider; author edits and synthetic reviews never upgrade its failed quality verdict.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir, symlink} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
import * as revisions from '../src/domain/author-revision.js';
import {KEY, parseBackup} from '../src/storage.js';

const out = '/tmp/nexusscribe-ui-prose-only';
await mkdir(out+'/node_modules', {recursive:true});
for (const name of ['react','react-dom','lucide-react']) {
  try {await symlink(resolve('node_modules', name), out+'/node_modules/'+name);}
  catch (error) {if (error.code !== 'EEXIST') throw error;}
}
await build({entryPoints:['src/App.tsx'], bundle:true, packages:'external', format:'esm', outfile:out+'/App.mjs', loader:{'.css':'empty'}, jsx:'automatic'});
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'});
for (const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle','File']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', {value:dom.window.navigator, configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function() {};
const React = await import('react');
const {render, screen, within, waitFor, cleanup, fireEvent, act} = await import('@testing-library/react');
const user = (await import('@testing-library/user-event')).default.setup();
const {default:App} = await import(out+'/App.mjs');

const PROSE = '  陆遥展开信纸。🙂\n\n她把信放在窗边。\n';
const FACT = '陆遥从未读过那封信。';
const NEXT = '第二天，陆遥在窗边停住，先去找守门人。';
const provider = {id:'prose-only-offline-mock', isLive:true, model:'synthetic'};
const names = {skip:'不提取记忆 · 仅保留正文', dialog:'确认不提取候选记忆', confirm:'确认不提取记忆', back:'返回核对', review:'审查候选稿', accept:'接受此版本', final:'确认接受正文与所选记忆'};
const button = name => screen.getByRole('button', {name, exact:true});
const saved = () => JSON.parse(localStorage.getItem(KEY));
const state = () => saved().state;
const draft = () => state().drafts[0];
const workspace = (state, providerMode = 'server') => ({format:1, serial:0, state, editing:{}, patch:null, providerMode});
const report = (s, status = 'consistent') => ({summary:'离线合成审阅，不证明语义或文学质量', issues:[], checks:[], factChecks:s.facts.filter(f => f.status === 'confirmed').map(f => ({factId:f.id, recordVersion:f.recordVersion, status, explanation:'离线门禁测试', sourceQuote:s.drafts[0].text.split('\n')[0]})), provider});
function base({reviewed = false, text = PROSE, canon = true} = {}) {
  let s = engine.createProjectFromConfig({projectId:'prose-only-dom', title:'窗边的信', protagonist:'陆遥', chapters:[{title:'第一章 窗边的信'}, {title:'第二章 守门人'}, {title:'第三章 旧登记簿'}]});
  if (canon) {
    s = engine.saveRevision(s, 'ch1', FACT, s.chapters[0].revision);
    s = engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'author_fact', statement:FACT}));
  }
  s = engine.stageProseDraft(s, {text, chapterId:'ch1', provider, context:engine.getContext(s)}, 'ch1');
  if (!reviewed) return s;
  const id = s.drafts[0].id;
  s = engine.beginMemoryExtraction(s, id);
  s = engine.attachMemoryExtraction(s, id, {staging:[{label:'陆遥展开信纸', sourceParagraphIndex:0}], reviewNotes:[], provider}, engine.createExtractionBinding(s, id));
  s = engine.reviewDraft(s, id);
  s = engine.attachSemanticReview(s, id, report(s, 'contradiction'), engine.createReviewBinding(s, id));
  const fact = s.facts[0];
  s = engine.resolveFactReview(s, id, {factId:fact.id, recordVersion:fact.recordVersion, action:'accept_exception', reason:'仅旧版的合成例外', reviewHash:engine.hash(JSON.stringify(s.drafts[0].modelReview))}, engine.createReviewBinding(s, id));
  const memory = engine.getMemoryReviewGate(s, id)[0];
  return engine.decideMemoryCandidate(s, id, {candidateId:memory.candidateId, action:'keep_quote', reviewHash:memory.reviewHash}, memory.binding);
}
const historyRoot = new URL('../eval/history/author-revision-v1/', import.meta.url);
const trialNames = ['raw-01.bin','revised-chapter-2.txt','close-read.json','outcome.json'];
const trialBytes = Object.fromEntries(trialNames.map(name => [name, readFileSync(new URL(name, historyRoot))]));
const historical = trialBytes['revised-chapter-2.txt'].toString('utf8');
const contradiction = '许宁没再敲，退后半步，用指节在铁门下半部敲了三下。';
const corrected = historical.replace(contradiction, '许宁退后半步，用指节在铁门下半部敲了三下。');
function historicalProposal() {
  // The ch1 wrapper is synthetic; the retained trial remains a failed chapter-2 run.
  let s = base({canon:false});
  const id = s.drafts[0].id;
  s = revisions.setRevisionInstruction(s, id, '离线回放历史输出，仅测试作者编辑与正文接受流程');
  s = revisions.beginDraftRevision(s, id);
  const p = s.drafts[0].revisionProposals[0];
  return revisions.attachDraftRevision(s, id, p.id, {text:historical, chapterId:'ch1', provider}, p.binding);
}
let calls = [], responder, exportedBlob;
const response = (payload, status = 200) => ({ok:status >= 200 && status < 300, status, json:async () => payload});
const output = value => response({output:{...value, provider}});
globalThis.fetch = async (url, options = {}) => {
  assert.equal(url, '/api/agent', 'Skip, reopening and reload must not even request provider status');
  assert.equal(options.method, 'POST');
  const call = {url, ...JSON.parse(options.body), signal:options.signal};
  calls.push(call);
  return responder(call);
};
URL.createObjectURL = blob => {exportedBlob = blob; return 'blob:prose-only';};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function() {};
function boot(initial = base(), mode = 'server') {
  cleanup(); localStorage.clear(); calls = [];
  responder = () => {throw Error('Unexpected automatic model request');};
  localStorage.setItem(KEY, JSON.stringify(workspace(initial, mode)));
  render(React.createElement(App));
}
function reload() {cleanup(); render(React.createElement(App));}
async function skip() {await user.click(button(names.skip)); await user.click(button(names.confirm));}
async function importData(data) {
  const file = new File([JSON.stringify(data)], 'prose-only.json', {type:'application/json'});
  file.text = async () => JSON.stringify(data);
  await user.upload(screen.getByLabelText('导入备份', {exact:true}), file);
  await waitFor(() => assert.ok(screen.getByRole('dialog', {name:'备份导入预览'})));
  await user.click(button('确认作为新项目导入'));
}
async function requireFreshReview() {
  assert.equal(draft().review, null); assert.equal(draft().modelReview, null);
  assert.deepEqual(draft().factDecisions, []); assert.deepEqual(draft().memoryDecisions, []);
  const before = structuredClone(saved());
  if (!button(names.accept).disabled) await user.click(button(names.accept));
  assert.equal(screen.queryByRole('dialog', {name:'确认接受候选稿与已选记忆'}), null);
  assert.deepEqual(saved(), before);
  assert.equal(button(names.review).disabled, false);
  assert.throws(() => engine.acceptDraft(state(), draft().id), /重新审查/);
}

// A returned failed-quality historical proposal is edited explicitly, then the
// resulting pending prose may skip extraction. No live trial is resumed.
assert.ok(historical.includes(contradiction));
assert.equal(JSON.parse(trialBytes['outcome.json']).closeRead, 'fail');
boot(historicalProposal());
const rawProposal = structuredClone(draft().revisionProposals[0]);
await user.click(button('核对并采用改稿建议'));
fireEvent.change(screen.getByLabelText('待采用正文', {exact:true}), {target:{value:corrected}});
await user.click(button('确认采用并使旧审阅失效'));
assert.equal(draft().revisionProposals[0].adoption.authority, 'explicit_author_edit');
assert.equal(draft().text, corrected);
assert.equal(draft().extraction.status, 'pending');
const beforeSkip = structuredClone(saved());
await user.click(button(names.skip));
let dialog = screen.getByRole('dialog', {name:names.dialog});
assert.match(dialog.textContent, new RegExp(`候选 r${draft().revision}`));
assert.ok(dialog.textContent.includes(engine.hash(corrected)), 'Confirmation binds exact text hash');
assert.match(dialog.textContent, /0/);
assert.match(dialog.textContent, /尚未完成|未提取|待提取|pending/);
assert.match(dialog.textContent, /审阅|审查/);
assert.match(dialog.textContent, /上下文/);
assert.deepEqual(saved(), beforeSkip);
assert.equal(document.activeElement, within(dialog).getByRole('button', {name:names.back}));
await user.keyboard('{Escape}');
assert.equal(document.activeElement, button(names.skip));
assert.deepEqual(saved(), beforeSkip);
await user.click(button(names.skip));
await user.click(button(names.back));
assert.deepEqual(saved(), beforeSkip);
await skip();
assert.equal(calls.length, 0);
assert.equal(draft().extraction.status, 'skipped');
assert.equal(draft().extraction.authority, 'explicit_author_decision');
assert.deepEqual(draft().staging, []);
assert.equal(draft().requiresSemanticReview, true);
await requireFreshReview();
responder = call => {assert.equal(call.action, 'reviewChapter'); assert.equal(call.input.text, corrected); return output(report(state()));};
await user.click(button(names.review));
await waitFor(() => assert.ok(draft().modelReview));
assert.equal(calls.length, 1);
await user.click(button(names.accept));
const acceptDialog = screen.getByRole('dialog', {name:'确认接受候选稿与已选记忆'});
assert.match(acceptDialog.textContent, /0/);
await user.click(button(names.back));
assert.notEqual(state().chapters[0].status, 'ACCEPTED');
await user.click(button(names.accept)); await user.click(button(names.final));
assert.equal(state().chapters[0].status, 'ACCEPTED');
assert.equal(state().chapters[0].text, corrected);
assert.deepEqual(state().events, []);
assert.deepEqual(state().commits.at(-1).acceptance, {protocol:'prose-only-v1', authority:'explicit_author_decision', draftRevision:draft().revision, textHash:engine.hash(corrected), textSnapshot:corrected, memoryExtraction:'skipped', extractionAttempt:draft().extraction.attempt, semanticStatus:'model_reviewed_unverified'});
assert.deepEqual(draft().revisionProposals[0].result, rawProposal.result);
assert.deepEqual(draft().revisionProposals[0].binding, rawProposal.binding);
assert.deepEqual(draft().proseVersions.map(v => v.text), [PROSE, corrected]);
await user.click(button('导出项目备份'));
assert.deepEqual(parseBackup(await exportedBlob.text()).state, state());
reload();
responder = call => {assert.equal(call.action, 'generateProse'); return output({text:NEXT, chapterId:'ch2'});};
await user.click(within(screen.getByRole('navigation', {name:'章节'})).getAllByRole('button')[1]);
await user.click(button('生成当前章'));
await waitFor(() => assert.equal(state().drafts.at(-1).text, NEXT));
assert.deepEqual(calls.map(c => c.action), ['reviewChapter','generateProse']);
assert.deepEqual(calls[1].input.context.events, []);
assert.equal(calls[1].input.context.sources.find(source => source.chapterId === 'ch1').text, corrected);
assert.equal(calls[1].input.context.sources.find(source => source.chapterId === 'ch1').role, 'accepted_manuscript');
for (const name of trialNames) assert.deepEqual(readFileSync(new URL(name, historyRoot)), trialBytes[name]);
console.log('PASS prose-only journey: retained failed trial → explicit author edit → zero-call skip → explicit synthetic review → final acceptance → exact accepted prose/no new events in next chapter context; raw trial and failed verdict immutable');

// Previously extracted quotes, model advice and Canon exceptions become history,
// and a new contradictory model review cannot inherit the old exception.
boot(base({reviewed:true}));
const old = structuredClone(draft()), oldFacts = structuredClone(state().facts);
await user.click(button(names.skip));
dialog = screen.getByRole('dialog', {name:names.dialog});
assert.match(dialog.textContent, /1/); assert.match(dialog.textContent, /已完成|已提取|complete/);
await user.click(button(names.confirm));
assert.equal(calls.length, 0); await requireFreshReview();
assert.deepEqual(state().facts, oldFacts);
assert.deepEqual(draft().memoryAuthorities.slice(0, old.memoryAuthorities.length), old.memoryAuthorities);
const archived = draft().memoryArchives.find(a => a.reason === 'prose_extraction_skipped');
assert.ok(archived);
assert.deepEqual(archived.candidates, old.staging);
assert.deepEqual(archived.decisions, old.memoryDecisions);
assert.equal(archived.textSnapshot, old.text);
assert.deepEqual(archived.extractionSnapshot, old.extraction);
responder = () => output(report(state(), 'contradiction'));
await user.click(button(names.review)); await waitFor(() => assert.ok(draft().modelReview));
assert.equal(engine.getFactReviewGate(state(), draft().id)[0].resolved, false);
assert.throws(() => engine.acceptDraft(state(), draft().id), /冲突|逐条/);
assert.deepEqual(state().events, []);
console.log('PASS prose-only invalidation: old quote/candidate/extraction history remains exact; all reviews and Canon exception authority revoked');

// Failed extraction never silently skips; an active request must first be
// cancelled, and a late response cannot restore candidates or old authority.
for (const ending of ['failed','cancelled']) {
  boot(); let finish;
  responder = () => new Promise(resolve => {finish = resolve;});
  await user.click(button('提取候选记忆'));
  await waitFor(() => assert.equal(typeof finish, 'function'));
  assert.equal(button(names.skip).disabled, true);
  assert.equal(screen.queryByRole('dialog', {name:names.dialog}), null);
  if (ending === 'cancelled') await user.click(button('取消请求'));
  else await act(async () => finish(response({error:{message:'合成提取失败'}}, 502)));
  assert.equal(draft().extraction.status, ending);
  assert.equal(button(names.accept).disabled, true);
  await skip();
  if (ending === 'cancelled') {
    assert.equal(calls[0].signal.aborted, true);
    await act(async () => finish(output({staging:[{label:'旧结果', sourceParagraphIndex:0}], reviewNotes:[]})));
  }
  assert.equal(draft().extraction.status, 'skipped'); assert.deepEqual(draft().staging, []);
  assert.equal(calls.length, 1); await requireFreshReview();
}

// Dirty editors, changed selection/state, save health and cross-tab changes all
// revoke a previously opened confirmation instead of authorizing a changed draft.
for (const changed of ['editing','selection','storage-event','cross-tab']) {
  boot(); await user.click(button(names.skip));
  if (changed === 'editing') fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:FACT+'未提交的新句。'}});
  if (changed === 'selection') await user.click(within(screen.getByRole('navigation', {name:'章节'})).getAllByRole('button')[1]);
  if (changed === 'storage-event') await act(async () => window.dispatchEvent(new window.StorageEvent('storage', {key:KEY, storageArea:localStorage, oldValue:localStorage.getItem(KEY), newValue:localStorage.getItem(KEY)})));
  if (changed === 'cross-tab') {const external = saved(); external.serial++; external.state.title = '另一窗口的新标题'; localStorage.setItem(KEY, JSON.stringify(external));}
  const before = structuredClone(saved());
  await user.click(button(names.confirm));
  assert.deepEqual(saved(), before);
  assert.notEqual(draft().extraction.status, 'skipped');
  assert.equal(calls.length, 0);
}
boot(); await user.click(button('编辑此稿'));
fireEvent.change(screen.getByLabelText('编辑候选稿'), {target:{value:PROSE+'尚未保存'}});
if (!button(names.skip).disabled) await user.click(button(names.skip));
assert.equal(screen.queryByRole('dialog', {name:names.dialog}), null);
await user.click(button('取消候选稿修改'));
await skip();
await user.click(button('编辑此稿'));
fireEvent.change(screen.getByLabelText('编辑候选稿'), {target:{value:PROSE+'作者的新版本。'}});
await user.click(button('保存候选稿修改'));
assert.equal(draft().extraction.status, 'pending');
assert.equal(button(names.review).disabled, true);
assert.equal(calls.length, 0);
console.log('PASS prose-only interruption guards: failed/cancelled extraction explicit recovery, late output isolation, editor/selection/storage staleness and later edits revoke skip');

// A source reclassification needs an explicit context refresh; an unresolved
// same-text classification is still an outstanding author choice.
let stale = base();
stale = engine.saveRevision(stale, 'ch1', FACT+'作者添加了钟楼的位置。', stale.chapters[0].revision);
stale = engine.commitPatch(stale, engine.proposeCustomPatch(stale, 'ch1', {intent:'local_prose'}));
boot(stale); const staleBefore = structuredClone(saved());
await user.click(button(names.skip));
assert.equal(screen.queryByRole('dialog', {name:names.dialog}), null);
assert.deepEqual(saved(), staleBefore);
await user.click(button('更新参考上下文')); await user.click(button('确认更新参考上下文'));
await skip(); assert.equal(draft().extraction.status, 'skipped'); assert.equal(calls.length, 0);
boot();
await user.click(button('作者分类保存 · 不调用模型'));
await user.click(button('仅局部表达，不更新设定'));
assert.ok(saved().patch);
const beforePatchSkip = structuredClone(saved());
await user.click(button(names.skip));
assert.equal(screen.queryByRole('dialog', {name:names.dialog}), null);
assert.deepEqual(saved(), beforePatchSkip);
await user.click(button('关闭影响预览')); await skip();
assert.equal(draft().extraction.status, 'skipped'); assert.equal(calls.length, 0);

// Local write failure never applies skip, and retry-save cannot replay a decision.
for (const name of ['QuotaExceededError','SecurityError']) {
  boot(); await user.click(button(names.skip));
  const before = structuredClone(saved()), setItem = dom.window.Storage.prototype.setItem;
  try {
    dom.window.Storage.prototype.setItem = function(key, value) {if (key === KEY) throw new DOMException('synthetic skip save failure', name); return setItem.call(this, key, value);};
    await user.click(button(names.confirm));
    assert.deepEqual(saved(), before); assert.match(screen.getByRole('alert').textContent, /尚未安全保存/);
  } finally {dom.window.Storage.prototype.setItem = setItem;}
  await user.click(button(names.back));
  await user.click(button('重试保存'));
  assert.equal(draft().extraction.status, 'pending'); assert.equal(calls.length, 0);
  await skip();
  assert.equal(draft().extraction.status, 'skipped');
}
boot(); await user.click(button(names.skip)); const beforeReload = structuredClone(saved()); reload();
assert.equal(screen.queryByRole('dialog', {name:names.dialog}), null);
assert.deepEqual(saved(), beforeReload);
await skip(); const backup = structuredClone(saved()); await importData(backup);
assert.notEqual(state().projectId, backup.state.projectId);
assert.deepEqual(state().importOrigin.original.state, backup.state);
assert.equal(draft().extraction.status, 'pending');
assert.equal(button(names.accept).disabled, true); assert.equal(calls.length, 0);
await skip(); assert.equal(draft().extraction.status, 'skipped');
console.log('PASS prose-only persistence: quota/security failures are noncommitting; reload drops dialog authority and import requires a fresh choice');

// Zero NEW memories never deletes earlier accepted excerpts, and context still
// includes the earlier accepted prose and its independently selected quote.
let prior = base({canon:false}), firstId = prior.drafts[0].id;
prior = engine.beginMemoryExtraction(prior, firstId);
prior = engine.attachMemoryExtraction(prior, firstId, {staging:[{label:'陆遥展开信纸', sourceParagraphIndex:0}], reviewNotes:[], provider}, engine.createExtractionBinding(prior, firstId));
prior = engine.reviewDraft(prior, firstId);
prior = engine.attachSemanticReview(prior, firstId, report(prior), engine.createReviewBinding(prior, firstId));
const quote = engine.getMemoryReviewGate(prior, firstId)[0];
prior = engine.decideMemoryCandidate(prior, firstId, {candidateId:quote.candidateId, action:'keep_quote', reviewHash:quote.reviewHash}, quote.binding);
prior = engine.acceptDraft(prior, firstId);
const earlierEvents = structuredClone(prior.events);
prior = engine.stageProseDraft(prior, {text:NEXT, chapterId:'ch2', provider, context:engine.getContext(prior)}, 'ch2');
boot(prior); await skip();
responder = call => {assert.equal(call.action, 'reviewChapter'); return output({summary:'合成第二章审阅', issues:[], checks:[], factChecks:[]});};
await user.click(button(names.review));
await waitFor(() => assert.ok(state().drafts.at(-1).modelReview));
await user.click(button(names.accept)); await user.click(button(names.final));
assert.deepEqual(state().events, earlierEvents);
assert.equal(state().chapters[1].text, NEXT);
assert.equal(engine.getContext(state()).events.length, 1);
assert.equal(engine.getContext(state()).sources.find(source => source.chapterId === 'ch2').role, 'accepted_manuscript');
assert.deepEqual(calls.map(call => call.action), ['reviewChapter']);
console.log('PASS prose-only scope: zero added memories preserves all previously accepted excerpts and accepted-prose context');
cleanup();
