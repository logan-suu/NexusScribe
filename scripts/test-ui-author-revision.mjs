// Deterministic author-revision DOM regressions. All API calls are mocked;
// these checks establish workflow/state safety, never model or literary quality.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir, symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
import {getRevisionSource} from '../src/domain/author-revision.js';
import {parseBackup, KEY} from '../src/storage.js';

const out = '/tmp/nexusscribe-ui-author-revision';
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

const BEFORE = '  陆遥展开信纸。🙂\n\n“别去钟楼。”她轻声读出这句话。\n';
const AFTER = '  陆遥展开信纸。\n\n纸上只有一句：“别去钟楼。”\n她把信压在杯底。🙂\n';
const INSTRUCTION = '保留警告与人物视角，删去解释，用动作结束。';
const FACT = '陆遥从未读过那封信。';
const provider = {id:'author-revision-offline-mock', isLive:true, model:'synthetic-revision', usage:{totalTokens:17}};
const budget = {configured:true, liveEnabled:true, callsUsed:3, maxCalls:10};
const names = {request:'按意见生成改稿建议 · 1 次模型请求', adopt:'核对并采用改稿建议', confirm:'确认采用并使旧审阅失效', discard:'放弃此改稿建议'};
const button = name => screen.getByRole('button', {name, exact:true});
const saved = () => JSON.parse(localStorage.getItem(KEY));
const state = () => saved().state;
const draft = () => state().drafts[0];
const proposal = () => draft().revisionProposals.at(-1);
function noRevisionAttempts() {assert.deepEqual(draft().revisionProposals, []); assert.deepEqual(draft().revisionSnapshots, []);}
const workspace = (state, providerMode = 'server') => ({format:1, serial:0, state, editing:{}, patch:null, providerMode});
function base({reviewed = false} = {}) {
  let s = engine.createProjectFromConfig({projectId:'author-revision-dom', title:'钟楼来信', protagonist:'陆遥'});
  s = engine.saveRevision(s, 'ch1', FACT, s.chapters[0].revision);
  s = engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'author_fact', statement:FACT}));
  s = engine.stageProseDraft(s, {text:BEFORE, chapterId:'ch1', provider, context:engine.getContext(s)}, 'ch1');
  if (!reviewed) return s;
  const id = s.drafts[0].id;
  s = engine.beginMemoryExtraction(s, id);
  s = engine.attachMemoryExtraction(s, id, {staging:[{label:'陆遥展开信纸', sourceParagraphIndex:0}], reviewNotes:[], provider}, engine.createExtractionBinding(s, id));
  s = engine.reviewDraft(s, id);
  const fact = s.facts[0];
  s = engine.attachSemanticReview(s, id, {summary:'合成旧审阅，仅用于失效检查', issues:[], checks:[], factChecks:[{factId:fact.id, recordVersion:fact.recordVersion, status:'contradiction', explanation:'合成冲突', sourceQuote:BEFORE.split('\n')[0]}], provider}, engine.createReviewBinding(s, id));
  s = engine.resolveFactReview(s, id, {factId:fact.id, recordVersion:fact.recordVersion, action:'accept_exception', reason:'仅此候选的合成例外', reviewHash:engine.hash(JSON.stringify(s.drafts[0].modelReview))}, engine.createReviewBinding(s, id));
  const memory = engine.getMemoryReviewGate(s, id)[0];
  return engine.decideMemoryCandidate(s, id, {candidateId:memory.candidateId, action:'keep_quote', reviewHash:memory.reviewHash}, memory.binding);
}
let calls = [], responder, exportedBlob;
const response = (payload, status = 200) => ({ok:status >= 200 && status < 300, status, json:async () => payload});
const result = text => response({output:{text, chapterId:'ch1', provider}});
const paid = () => calls.filter(call => call.method === 'POST');
globalThis.fetch = async (url, options = {}) => {
  assert.ok(['/api/status','/api/agent'].includes(url), `Blocked unexpected network: ${url}`);
  const call = {url, method:options.method, ...(options.body ? JSON.parse(options.body) : {})};
  calls.push(call);
  assert.equal(call.method, url === '/api/status' ? 'GET' : 'POST');
  if (url === '/api/agent') assert.equal(call.action, 'reviseProse', 'No auto extraction, review, generation or fallback call');
  return responder(call);
};
URL.createObjectURL = blob => {exportedBlob = blob; return 'blob:author-revision';};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function() {};
function boot(initial = base(), mode = 'server') {
  cleanup(); localStorage.clear(); calls = [];
  responder = call => call.url === '/api/status' ? response(budget) : result(AFTER);
  localStorage.setItem(KEY, JSON.stringify(workspace(initial, mode)));
  render(React.createElement(App));
}
function reload() {cleanup(); render(React.createElement(App));}
function instruction(value = INSTRUCTION) {fireEvent.change(screen.getByLabelText('改稿意见'), {target:{value}});}
async function request() {
  instruction();
  await user.click(button(names.request));
  await waitFor(() => assert.equal(proposal().status, 'proposed'));
}
async function importData(data) {
  const file = new File([JSON.stringify(data)], 'author-revision.json', {type:'application/json'});
  file.text = async () => JSON.stringify(data);
  await user.upload(screen.getByLabelText('导入备份', {exact:true}), file);
  await waitFor(() => assert.ok(screen.getByRole('dialog', {name:'备份导入预览'})));
  await user.click(button('确认作为新项目导入'));
}
function exactComparison() {
  assert.equal(screen.getByLabelText('改稿前正文').textContent, BEFORE);
  assert.equal(screen.getByLabelText('改稿建议正文').textContent, AFTER);
  // Literal expected values catch code-point, whitespace and nonblank-line regressions.
  assert.deepEqual(proposal().beforeCounts, {han:18, characters:29, paragraphs:2});
  assert.deepEqual(proposal().afterCounts, {han:23, characters:36, paragraphs:3});
  assert.ok(screen.getByRole('heading', {name:'改稿前 · 18 汉字 · 29 字符 · 2 段'}));
  assert.ok(screen.getByRole('heading', {name:'改稿建议 · 23 汉字 · 36 字符 · 3 段'}));
}

// One explicit click authorizes exactly one paid request, guarded synchronously.
boot(base({reviewed:true}));
assert.equal(calls.length, 0);
assert.equal(button(names.request).disabled, true);
const original = structuredClone(draft()), canonical = structuredClone(state().facts), chapters = structuredClone(state().chapters);
instruction();
let finish;
responder = call => call.url === '/api/status' ? response(budget) : new Promise(resolve => {finish = resolve;});
await act(async () => {fireEvent.click(button(names.request)); fireEvent.click(button(names.request));});
await waitFor(() => assert.equal(typeof finish, 'function'));
assert.equal(paid().length, 1);
assert.deepEqual(calls.map(call => [call.url, call.method]), [['/api/status','GET'], ['/api/agent','POST']]);
assert.equal(paid()[0].action, 'reviseProse');
assert.deepEqual(Object.keys(paid()[0].input).sort(), ['chapterId','context','instruction','text']);
assert.deepEqual(paid()[0].input, {text:BEFORE, instruction:INSTRUCTION, chapterId:'ch1', context:engine.getContext(state())});
assert.equal(button(names.request).disabled, true);
await act(async () => finish(result(AFTER)));
exactComparison();
assert.equal(draft().text, BEFORE);
assert.deepEqual(draft().modelReview, original.modelReview);
assert.deepEqual(draft().factDecisions, original.factDecisions);
assert.deepEqual(draft().memoryDecisions, original.memoryDecisions);
assert.equal(state().events.length, 0);
const advice = structuredClone(proposal()), beforeConfirm = structuredClone(saved());
assert.equal(draft().revisionSnapshots.length, 1);
assert.equal(Object.hasOwn(advice.binding, 'textSnapshot'), false);
assert.equal(Object.hasOwn(advice.binding, 'contextSnapshot'), false);
assert.deepEqual(getRevisionSource(draft(), advice), {id:advice.binding.snapshotId, textSnapshot:BEFORE, contextSnapshot:paid()[0].input.context});
await user.click(button(names.adopt));
const dialog = screen.getByRole('dialog', {name:'确认采用改稿建议'});
assert.match(dialog.textContent, /旧提取、整章审阅、设定例外与记忆选择全部失效/);
assert.equal(document.activeElement, within(dialog).getByRole('button', {name:'返回比较'}));
assert.deepEqual(saved(), beforeConfirm);
await user.keyboard('{Escape}');
assert.equal(screen.queryByRole('dialog', {name:'确认采用改稿建议'}), null);
assert.equal(document.activeElement, button(names.adopt));
assert.deepEqual(saved(), beforeConfirm);
await user.click(button(names.adopt));
await user.click(button(names.confirm));
assert.equal(draft().text, AFTER);
assert.equal(draft().status, 'DRAFT');
assert.equal(draft().revision, original.revision+1);
assert.equal(draft().extraction.status, 'pending');
assert.equal(draft().review, null);
assert.equal(draft().modelReview, null);
assert.deepEqual(draft().staging, []);
assert.deepEqual(draft().factDecisions, []);
assert.deepEqual(draft().memoryDecisions, []);
assert.deepEqual(draft().proseVersions.map(version => version.text), [BEFORE, AFTER]);
assert.equal(proposal().adoptedRevision, draft().revision);
assert.equal(draft().proseVersions.find(version => version.revision === proposal().adoptedRevision).text, advice.result.text);
assert.equal(proposal().status, 'adopted');
assert.equal(proposal().resultSnapshot, null);
assert.equal(getRevisionSource(draft(), proposal()).textSnapshot, BEFORE);
assert.deepEqual(proposal().binding, advice.binding);
assert.deepEqual(proposal().result, advice.result);
assert.deepEqual(proposal().result.provider, advice.result.provider);
assert.ok(draft().memoryArchives.some(archive => archive.reason === 'draft_edited' && archive.decisions.length === 1));
assert.deepEqual(state().chapters, chapters);
assert.deepEqual(state().facts, canonical);
assert.deepEqual(state().events, []);
assert.equal(paid().length, 1);
await user.click(button('导出项目备份'));
assert.deepEqual(parseBackup(await exportedBlob.text()).state, state());
console.log('PASS author revision UI: one budget GET + one paid request, exact comparison/counts, confirm/Escape/focus, immutable original/provenance, old extraction/reviews/choices invalidated without auto calls');

// Discard keeps the original and all its existing author decisions.
boot(base({reviewed:true}));
const kept = structuredClone(draft());
await request();
await user.click(button(names.discard));
assert.equal(proposal().status, 'discarded');
assert.equal(proposal().resultSnapshot, null);
for (const key of ['text','revision','extraction','review','modelReview','staging','memoryDecisions','factDecisions','proseVersions']) assert.deepEqual(draft()[key], kept[key]);
assert.equal(paid().length, 1);
assert.equal(screen.getByLabelText('改稿建议正文').textContent, AFTER);

// Malformed/missing/exhausted budget or unavailable server cannot dispatch a POST.
for (const status of [
  {...budget, callsUsed:10}, {...budget, callsUsed:-1}, {...budget, callsUsed:1.5},
  {...budget, maxCalls:0}, {...budget, maxCalls:31}, {...budget, maxCalls:'10'},
  {configured:true, liveEnabled:true}, {...budget, configured:false}, {...budget, liveEnabled:false},
  {error:{message:'Synthetic budget read failure'}}, {...budget, configured:'true'}
]) {
  boot(); responder = () => response(status); instruction();
  const beforePreflight = structuredClone(saved());
  for (let attempt = 0; attempt < 3; attempt++) {
    await user.click(button(names.request));
    await waitFor(() => assert.match(screen.getByLabelText('模型任务状态').textContent, /请求失败/));
    noRevisionAttempts();
    assert.deepEqual(saved(), beforePreflight, 'Blocked budget checks cannot allocate history, snapshots or storage serials');
  }
  assert.equal(paid().length, 0);
  assert.equal(draft().text, BEFORE);
  assert.equal(calls.length, 3);
}
for (const failure of [response({error:{message:'Synthetic upstream failed'}}, 502), response({output:{text:'', chapterId:'ch1'}}), response({output:{text:AFTER, chapterId:'ch2'}}), response({output:{text:AFTER, chapterId:'ch1', staging:[]}})]) {
  boot(); responder = call => call.url === '/api/status' ? response(budget) : failure;
  instruction(); await user.click(button(names.request));
  await waitFor(() => assert.equal(proposal().status, 'failed'));
  assert.equal(draft().text, BEFORE); assert.equal(paid().length, 1);
  assert.equal(screen.queryByLabelText('改稿建议正文'), null);
}
console.log('PASS author revision UI: blocked/cancelled budget preflight creates no history or snapshots; malformed/upstream paid failures have no implicit retries or fallback');

// Cancellation before dispatch, and cancellation after dispatch with a late result.
for (const phase of ['budget','paid']) {
  boot(); let release;
  responder = call => phase === 'budget' || call.method === 'POST' ? new Promise(resolve => {release = resolve;}) : response(budget);
  instruction(); const beforePreflight = structuredClone(saved());
  await user.click(button(names.request));
  await waitFor(() => assert.equal(typeof release, 'function'));
  if (phase === 'budget') {noRevisionAttempts(); assert.deepEqual(saved(), beforePreflight);}
  await user.click(button('取消请求'));
  await act(async () => release(phase === 'budget' ? response(budget) : result(AFTER)));
  if (phase === 'budget') {noRevisionAttempts(); assert.deepEqual(saved(), beforePreflight);}
  else {assert.equal(proposal().status, 'cancelled'); assert.equal(proposal().result, null);}
  assert.equal(draft().text, BEFORE);
  assert.equal(paid().length, phase === 'budget' ? 0 : 1);
}
boot(); let pending = [];
responder = call => call.url === '/api/status' ? response(budget) : new Promise(resolve => pending.push(resolve));
instruction(); await user.click(button(names.request));
await waitFor(() => assert.equal(pending.length, 1));
await user.click(button('取消请求'));
await user.click(button(names.request));
await waitFor(() => assert.equal(pending.length, 2));
await act(async () => pending[0](result('旧的迟到结果不能被下一次请求采用')));
assert.equal(proposal().status, 'requesting');
await act(async () => pending[1](result(AFTER)));
assert.equal(proposal().status, 'proposed');
assert.equal(draft().revisionProposals[0].result, null);
assert.equal(proposal().result.text, AFTER);
assert.equal(paid().length, 2);
assert.equal(draft().revisionSnapshots.length, 1, 'Same source/context must reuse one shared snapshot across requests');
assert.equal(draft().revisionProposals[0].binding.snapshotId, proposal().binding.snapshotId);
assert.equal(getRevisionSource(draft(), proposal()).textSnapshot, BEFORE);

// Both durable changes and unsaved author edits invalidate advice authority.
for (const change of ['instruction','source']) {
  boot(); await request();
  if (change === 'instruction') instruction(INSTRUCTION+'不要新增线索。');
  else {
    await user.click(button('编辑此稿'));
    fireEvent.change(screen.getByLabelText('编辑候选稿'), {target:{value:BEFORE+'作者的新句子。'}});
    await user.click(button('保存候选稿修改'));
  }
  assert.equal(button(names.adopt).disabled, true);
  assert.equal(proposal().result.text, AFTER);
  assert.equal(paid().length, 1);
}
boot(); await request(); await user.click(button(names.adopt));
fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:FACT+'尚未分类的正文修改。'}});
const afterEdit = structuredClone(saved());
await user.click(button(names.confirm));
assert.deepEqual(saved(), afterEdit);
assert.equal(draft().text, BEFORE);
assert.equal(paid().length, 1);
await user.click(button('返回比较'));

// A changed workspace while the paid call waits retains the result only as stale advice.
boot(); let late;
responder = call => call.url === '/api/status' ? response(budget) : new Promise(resolve => {late = resolve;});
instruction(); await user.click(button(names.request));
await waitFor(() => assert.equal(typeof late, 'function'));
fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:FACT+'未保存修改'}});
await act(async () => late(result(AFTER)));
assert.equal(proposal().status, 'stale');
assert.equal(proposal().result.text, AFTER);
assert.equal(button(names.adopt).disabled, true);
assert.equal(draft().text, BEFORE);

// Cross-tab state or edits while checking the budget must stop before paid dispatch.
for (const interruption of ['edit','cross-tab','cancel']) {
  boot(); let release;
  responder = () => new Promise(resolve => {release = resolve;});
  instruction(); await user.click(button(names.request));
  await waitFor(() => assert.equal(typeof release, 'function'));
  noRevisionAttempts();
  if (interruption === 'edit') fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:FACT+'未保存修改'}});
  if (interruption === 'cancel') await user.click(button('取消请求'));
  if (interruption === 'cross-tab') {const external = saved(); external.serial++; external.state.title = '另一窗口版本'; localStorage.setItem(KEY, JSON.stringify(external));}
  await act(async () => release(response(budget)));
  assert.equal(paid().length, 0);
  noRevisionAttempts();
  assert.equal(draft().text, BEFORE);
  if (interruption === 'cross-tab') assert.equal(state().title, '另一窗口版本');
}
// A valid budget cannot authorize a paid call if recording its request fails.
boot(); let releaseBeforeWrite;
responder = call => call.method === 'GET' ? new Promise(resolve => {releaseBeforeWrite = resolve;}) : result(AFTER);
instruction(); const beforeRequestWrite = structuredClone(saved());
await user.click(button(names.request));
await waitFor(() => assert.equal(typeof releaseBeforeWrite, 'function'));
const originalRequestWrite = dom.window.Storage.prototype.setItem;
try {
  dom.window.Storage.prototype.setItem = function(key, value) {
    if (key === KEY) throw new DOMException('synthetic pre-dispatch quota failure', 'QuotaExceededError');
    return originalRequestWrite.call(this, key, value);
  };
  await act(async () => releaseBeforeWrite(response(budget)));
  assert.match(screen.getByRole('alert').textContent, /尚未安全保存/);
  noRevisionAttempts();
  assert.deepEqual(saved(), beforeRequestWrite);
  assert.equal(paid().length, 0);
} finally {dom.window.Storage.prototype.setItem = originalRequestWrite;}
await user.click(button('重试保存'));
noRevisionAttempts();
assert.equal(calls.length, 1, 'Retry-save must not dispatch a revision after a pre-dispatch write failure');

console.log('PASS author revision UI: budget and paid cancellation, late replay isolation, changed source/instruction/workspace and stale confirmation gates');

// Paid outputs remain exportable in memory when storage fails; retry is a write only.
for (const errorName of ['QuotaExceededError','SecurityError']) {
  boot(); let release;
  responder = call => call.url === '/api/status' ? response(budget) : new Promise(resolve => {release = resolve;});
  instruction(); await user.click(button(names.request));
  await waitFor(() => assert.equal(typeof release, 'function'));
  const setItem = dom.window.Storage.prototype.setItem;
  try {
    dom.window.Storage.prototype.setItem = function(key, value) {
      if (key === KEY) throw new DOMException('synthetic paid revision save failure', errorName);
      return setItem.call(this, key, value);
    };
    await act(async () => release(result(AFTER)));
    assert.match(screen.getByRole('alert').textContent, /尚未安全保存/);
    assert.equal(screen.getByLabelText('改稿建议正文').textContent, AFTER);
    assert.equal(proposal().result, null, 'The failed durable write must not appear persisted');
    await user.click(button('导出当前内容（含暂存编辑）'));
    const backup = parseBackup(await exportedBlob.text());
    assert.equal(backup.state.drafts[0].revisionProposals.at(-1).result.text, AFTER);
    assert.equal(backup.state.drafts[0].text, BEFORE);
    assert.equal(button(names.adopt).disabled, true);
  } finally {dom.window.Storage.prototype.setItem = setItem;}
  await user.click(button('重试保存'));
  assert.equal(screen.queryByRole('alert'), null);
  assert.equal(proposal().result.text, AFTER);
  assert.equal(proposal().status, 'proposed');
  assert.equal(paid().length, 1);
  assert.equal(calls.length, 2);
}
console.log('PASS author revision UI: quota/security failure retains paid proposal in export; retry-save sends no request');

// Reloaded completed advice requires a fresh confirmation; interrupted attempts
// need an explicit local cancellation. Import always revokes pending authority.
for (const pendingStatus of ['proposed','requesting']) {
  boot();
  if (pendingStatus === 'proposed') await request();
  else {
    responder = call => call.url === '/api/status' ? response(budget) : new Promise(() => {});
    instruction(); await user.click(button(names.request));
    await waitFor(() => assert.equal(proposal().status, 'requesting'));
  }
  const beforeReload = structuredClone(saved());
  reload();
  if (pendingStatus === 'proposed') {
    assert.equal(button(names.adopt).disabled, false);
    assert.equal(screen.queryByRole('dialog', {name:'确认采用改稿建议'}), null);
    await user.click(button(names.adopt));
    assert.equal(draft().text, BEFORE);
    await user.click(button('返回比较'));
    assert.equal(screen.getByLabelText('改稿建议正文').textContent, AFTER);
  } else {
    assert.equal(proposal().status, 'requesting');
    await user.click(button('取消中断的改稿请求'));
    assert.equal(proposal().status, 'cancelled');
    assert.equal(calls.length, 2);
    assert.equal(button(names.request).disabled, false);
  }
  assert.equal(draft().text, BEFORE);
  await importData(beforeReload);
  assert.notEqual(state().projectId, beforeReload.state.projectId);
  assert.deepEqual(state().importOrigin.original.state, beforeReload.state);
  assert.equal(proposal().status, 'stale');
  assert.equal(draft().text, BEFORE);
  if (pendingStatus === 'proposed') assert.equal(button(names.adopt).disabled, true);
  assert.equal(paid().length, 1);
}

// Manual, accepted, and offline/template paths expose no usable paid revision action.
let manual = engine.createProjectFromConfig({projectId:'manual-revision-unsupported'});
manual = engine.saveRevision(manual, 'ch1', BEFORE, manual.chapters[0].revision);
manual = engine.commitPatch(manual, engine.proposeCustomPatch(manual, 'ch1', {intent:'local_prose'}));
manual = engine.stageManualDraft(manual, 'ch1');
boot(manual);
assert.equal(screen.queryByLabelText('改稿意见'), null);
assert.equal(screen.queryByRole('button', {name:names.request}), null);
let accepted = base({reviewed:true}); accepted = engine.acceptDraft(accepted, accepted.drafts[0].id);
boot(accepted);
assert.equal(screen.queryByLabelText('改稿意见'), null);
assert.equal(screen.queryByRole('button', {name:names.request}), null);
assert.equal(calls.length, 0);
boot(base(), 'template'); instruction();
assert.equal(button(names.request).disabled, true);
assert.equal(calls.length, 0);
// Author edits are a local adoption buffer, never a replacement of raw model output.
boot(base({reviewed:true})); await request();
const rawAdvice = structuredClone(proposal()), editBaseline = structuredClone(saved());
const EDITED = '  陆遥把信压在杯底。🙂\n\n她等到钟声停下。\n';
await user.click(button(names.adopt));
fireEvent.change(screen.getByLabelText('待采用正文', {exact:true}), {target:{value:EDITED}});
fireEvent.change(screen.getByLabelText('汉字下限'), {target:{value:'100'}});
fireEvent.change(screen.getByLabelText('段数上限'), {target:{value:'1'}});
assert.match(screen.getByLabelText('篇幅提醒').textContent, /低于作者下限 100/);
assert.match(screen.getByLabelText('篇幅提醒').textContent, /高于作者上限 1/);
assert.equal(button(names.confirm).disabled, false, 'Length warnings are advisory');
assert.deepEqual(saved(), editBaseline);
assert.equal(screen.getByLabelText('采用窗口模型原文').textContent, AFTER);
await user.keyboard('{Escape}');
await user.click(button(names.adopt));
assert.equal(screen.getByLabelText('待采用正文', {exact:true}).value, AFTER);
assert.equal(screen.getByLabelText('汉字下限').value, '');
for (const invalid of ['-1','1.5','1e2','9007199254740992']) {
  fireEvent.change(screen.getByLabelText('汉字下限'), {target:{value:invalid}});
  assert.equal(button(names.confirm).disabled, true);
}
fireEvent.change(screen.getByLabelText('汉字下限'), {target:{value:'100'}});
fireEvent.change(screen.getByLabelText('汉字上限'), {target:{value:'99'}});
assert.equal(button(names.confirm).disabled, true);
fireEvent.change(screen.getByLabelText('汉字上限'), {target:{value:''}});
fireEvent.change(screen.getByLabelText('待采用正文', {exact:true}), {target:{value:' \n'}});
assert.equal(button(names.confirm).disabled, true);
fireEvent.change(screen.getByLabelText('待采用正文', {exact:true}), {target:{value:EDITED}});
await user.click(button(names.confirm));
assert.equal(draft().text, EDITED);
assert.deepEqual(proposal().result, rawAdvice.result);
assert.deepEqual(proposal().afterCounts, rawAdvice.afterCounts);
assert.deepEqual(proposal().adoption, {modelResultHash:engine.hash(JSON.stringify(rawAdvice.result)),authority:'explicit_author_edit',textHash:engine.hash(EDITED),counts:{han:15,characters:23,paragraphs:2},lengthBounds:{hanMin:100}});
assert.equal(draft().modelReview, null); assert.equal(draft().extraction.status, 'pending');
assert.deepEqual(draft().factDecisions, []); assert.deepEqual(draft().memoryDecisions, []);
assert.equal(screen.getByLabelText('已采用版本正文').textContent, EDITED);
assert.match(screen.getByLabelText('采用来源记录').textContent, /explicit_author_edit/);
assert.equal(paid().length, 1);
reload(); assert.equal(draft().text, EDITED);
const editedBackup = saved(); await importData(editedBackup);
assert.equal(draft().text, EDITED); assert.equal(proposal().adoption.authority, 'explicit_author_edit');
assert.deepEqual(state().importOrigin.original.state, editedBackup.state);
console.log('PASS edited revision UI: local-only buffer, immutable raw output, explicit author-edit provenance, optional strict numeric bounds, advisory counts, Escape/reload/import and old-gate invalidation');

for (const errorName of ['QuotaExceededError','SecurityError']) {
  boot(); await request(); await user.click(button(names.adopt));
  fireEvent.change(screen.getByLabelText('待采用正文', {exact:true}), {target:{value:EDITED}});
  const beforeWrite = structuredClone(saved()), setItem = dom.window.Storage.prototype.setItem;
  try {
    dom.window.Storage.prototype.setItem = function(key, value) {
      if (key === KEY) throw new DOMException('synthetic edited adoption save failure', errorName);
      return setItem.call(this, key, value);
    };
    await user.click(button(names.confirm));
    assert.deepEqual(saved(), beforeWrite);
    assert.equal(screen.getByLabelText('待采用正文', {exact:true}).value, EDITED);
    assert.equal(proposal().result.text, AFTER); assert.equal(draft().text, BEFORE);
    assert.equal(button(names.confirm).disabled, true);
    await user.click(button('导出待采用正文')); assert.equal(await exportedBlob.text(), EDITED);
  } finally {dom.window.Storage.prototype.setItem = setItem;}
  await user.click(button('重试保存当前工作区'));
  assert.equal(draft().text, BEFORE, 'Retry-save must not adopt');
  await user.click(button(names.confirm));
  assert.equal(draft().text, EDITED); assert.equal(proposal().adoption.authority, 'explicit_author_edit');
  assert.equal(paid().length, 1); assert.equal(calls.length, 2);
}
console.log('PASS edited revision UI: quota/security failures retain exportable local edits and immutable paid proposal; recovery is an explicit local write and fresh confirmation, no requests');

cleanup();
console.log('PASS author revision UI: reload requires fresh confirmation/interrupted cancellation, import revokes pending authority; manual, accepted and template flows cannot request revisions. No live calls or browser launched.');
