// Fictional author prose and fully mocked providers. DOM/state regression only;
// zero requests in the manual path is a workflow claim, not semantic validation.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir, symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';

const out = '/tmp/nexusscribe-ui-manual-chapter';
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

const KEY = 'nexusscribe.demo.v1';
const MANUAL = '  陆遥把未拆封的信放在窗边。雨声盖住了楼下的脚步。\n\n她只记下信封上的日期，没有猜寄信人是谁。\n';
const REVISED = MANUAL.replace('窗边', '桌角');
const NEXT = '第二天，陆遥带着那封未拆的信去找守门人。她先问昨夜谁来过，没有打开信封。';
const FACT = '陆遥从未见过寄信人。';
const CONFLICT = '陆遥认出寄信人的脸，说：“我们昨天见过。”';
const provider = {id:'manual-chapter-offline-mock', isLive:true};
const buttons = {classify:'作者分类保存 · 不调用模型', prepare:'准备手写稿 · 不提取记忆', skip:'不提取记忆 · 仅保留正文', accept:'接受此版本', confirm:'确认接受正文与所选记忆'};
let requests = [], replyFor = () => {throw Error('Unexpected provider request');}, exportedBlob;
globalThis.fetch = async (url, options = {}) => {
  const call = {url, ...(options.body ? JSON.parse(options.body) : {})};
  requests.push(call);
  if (url === '/api/status') return {ok:true, json:async () => ({configured:true, liveEnabled:true, callsUsed:requests.length-1, maxCalls:30})};
  assert.equal(url, '/api/agent');
  return {ok:true, json:async () => ({output:{...replyFor(call), provider}})};
};
URL.createObjectURL = blob => {exportedBlob = blob; return 'blob:manual-chapter';};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function() {};
const saved = () => JSON.parse(localStorage.getItem(KEY));
const state = () => saved().state;
const button = name => screen.getByRole('button', {name, exact:true});
const current = () => state().drafts.at(-1);
const workspace = (state, providerMode = 'server', extra = {}) => ({format:1, serial:0, state, editing:{}, patch:null, providerMode, ...extra});
function project() {
  return engine.createProjectFromConfig({projectId:'manual-chapter-dom', title:'窗边的信', protagonist:'陆遥', idea:'从一封未拆的信开始寻找来处', outline:[{title:'窗边的信'}, {title:'守门人'}, {title:'旧登记簿'}], chapters:[{title:'第一章 窗边的信'}, {title:'第二章 守门人'}, {title:'第三章 旧登记簿'}]});
}
function classified(text = MANUAL, initial = project()) {
  const s = engine.saveRevision(initial, 'ch1', text, initial.chapters[0].revision);
  return engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'local_prose'}));
}
function prepared(initial = classified(), review = false) {
  const s = engine.stageManualDraft(initial, 'ch1');
  return review ? engine.reviewDraft(s, s.drafts.at(-1).id) : s;
}
function canonProject() {
  let s = engine.saveRevision(project(), 'ch1', FACT, 1);
  s = engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'author_fact', statement:FACT}));
  return classified(CONFLICT, s);
}
function boot(initial = project(), mode = 'server', extra = {}) {
  cleanup(); localStorage.clear(); requests = []; replyFor = () => {throw Error('Unexpected automatic provider request');};
  localStorage.setItem(KEY, JSON.stringify(workspace(initial, mode, extra)));
  render(React.createElement(App));
}
function reload() {cleanup(); render(React.createElement(App));}
async function classify(text) {
  if (text !== undefined) fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:text}});
  await user.click(button(buttons.classify));
  assert.ok(screen.getByRole('dialog', {name:'确认改文类型'}));
  await user.click(button('仅局部表达，不更新设定'));
}
async function review() {
  await user.click(button('审查候选稿'));
  assert.equal(current().review?.passed, true);
}
async function confirm() {await user.click(button(buttons.accept)); await user.click(button(buttons.confirm));}
async function acceptanceBlocked() {
  const before = structuredClone(state());
  if (!button(buttons.accept).disabled) await user.click(button(buttons.accept));
  assert.equal(screen.queryByRole('dialog', {name:'确认接受候选稿与已选记忆'}), null);
  assert.deepEqual(state(), before);
}
async function importData(data) {
  const file = new File([JSON.stringify(data)], 'manual-backup.json', {type:'application/json'});
  file.text = async () => JSON.stringify(data);
  await user.upload(screen.getByLabelText('导入备份', {exact:true}), file);
  await waitFor(() => assert.ok(screen.getByRole('dialog', {name:'备份导入预览'})));
  await user.click(button('确认作为新项目导入'));
}

// Local classification, preparation and acceptance remain local even in server mode.
boot();
await classify(MANUAL);
assert.equal(state().chapters[0].text, MANUAL);
assert.ok(saved().patch);
await user.click(button('确认并提交状态'));
const source = structuredClone(state().chapters[0]);
await user.click(button(buttons.prepare));
assert.equal(current().text, MANUAL);
assert.equal(current().manualSource.revision, source.revision);
assert.equal(current().manualSource.textSnapshot, MANUAL);
assert.equal(current().extraction.status, 'skipped');
assert.deepEqual(current().staging, []);
assert.equal(current().modelReview, null);
await acceptanceBlocked();
assert.equal(screen.queryByRole('button', {name:'编辑此稿'}), null, 'Manual source snapshots must not expose candidate editing');
await review();
assert.equal(current().review.semanticStatus, 'not_evaluated');
assert.equal(current().modelReview, null);
const beforeCancel = structuredClone(saved());
await user.click(button(buttons.accept));
const dialog = screen.getByRole('dialog', {name:'确认接受候选稿与已选记忆'});
assert.match(dialog.textContent, /第一章 窗边的信/);
assert.match(dialog.textContent, new RegExp(`正文 r${source.revision}`));
assert.match(dialog.textContent, /候选 r1/);
assert.match(dialog.textContent, /未.*(模型|语义)|语义.*未/);
assert.deepEqual(saved(), beforeCancel, 'Opening confirmation cannot write state');
await user.click(within(dialog).getByRole('button', {name:'返回核对'}));
assert.deepEqual(saved(), beforeCancel, 'Cancel cannot accept or alter prose');
await confirm();
assert.equal(state().chapters[0].status, 'ACCEPTED');
assert.equal(state().chapters[0].text, MANUAL);
assert.equal(state().chapters[0].revision, source.revision+1);
assert.equal(state().chapters[0].revisions.find(r => r.revision === source.revision).text, MANUAL);
assert.deepEqual(current().proseVersions.map(r => r.text), [MANUAL]);
assert.deepEqual(state().events, []);
assert.equal(requests.length, 0, 'No network endpoint may be contacted by the manual-only path');
reload();
assert.equal(screen.getByLabelText('章节正文').value, MANUAL);
await user.click(button('导出项目备份'));
const backup = JSON.parse(await exportedBlob.text());
assert.equal(backup.state.chapters[0].text, MANUAL);
await importData(backup);
assert.notEqual(state().projectId, backup.state.projectId);
assert.deepEqual(state().importOrigin.original.state, backup.state);
assert.equal(state().chapters[0].status, 'ACCEPTED');
assert.deepEqual(state().events, []);
assert.equal(requests.length, 0);
replyFor = call => {assert.equal(call.action, 'generateProse'); return {text:NEXT, chapterId:'ch2'};};
await user.click(within(screen.getByRole('navigation', {name:'章节'})).getAllByRole('button')[1]);
await user.click(button('生成当前章'));
await waitFor(() => assert.equal(state().drafts.at(-1).text, NEXT));
assert.equal(requests.length, 1, 'Only the explicitly requested next chapter calls the provider');
const context = requests[0].input.context;
assert.deepEqual(context.events, []);
assert.equal(context.sources.find(s => s.chapterId === 'ch1').role, 'accepted_manuscript');
assert.equal(context.sources.find(s => s.chapterId === 'ch1').text, MANUAL);
console.log('PASS manual UI: exact classified text, zero requests in server mode, skipped memory, local unverified review, cancel/confirm, retained revisions, reload/export/import and accepted-manuscript next context');

// Unsaved editing and unchanged-text pending classification each block staging.
boot(classified());
fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:REVISED}});
await user.click(button(buttons.prepare));
assert.equal(state().drafts.length, 0);
assert.equal(screen.getByLabelText('章节正文').value, REVISED);
assert.equal(requests.length, 0);
boot(classified());
await classify();
assert.ok(saved().patch);
assert.equal(state().chapters[0].syncStatus, 'CLEAN');
await user.click(button(buttons.prepare));
assert.equal(state().drafts.length, 0, 'Unchanged-text pending patch is still an unresolved author choice');
await user.click(button('关闭影响预览'));
await user.click(button(buttons.prepare));
await review();
const oldDraft = structuredClone(current());
await classify(REVISED); await user.click(button('确认并提交状态'));
await user.click(button('审查候选稿'));
assert.throws(() => engine.acceptDraft(state(), current().id), /重新审查|变化|过期/);
await acceptanceBlocked();
assert.equal(current().text, MANUAL);
await user.click(button('拒绝此稿'));
await user.click(button(buttons.prepare));
assert.equal(current().text, REVISED);
assert.equal(state().drafts[0].status, 'REJECTED');
assert.deepEqual(state().drafts[0].proseVersions, oldDraft.proseVersions);
assert.equal(requests.length, 0);
console.log('PASS manual UI guards: unsaved editor, same-text pending patch, immutable source, stale review, reject/reclassify/restage');

// Confirmation binds more than state: editing, pending patch and chapter selection.
for (const changed of ['editing','same-text-patch','selection']) {
  boot(prepared(classified(), true));
  await user.click(button(buttons.accept));
  if (changed === 'editing') fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:REVISED}});
  if (changed === 'same-text-patch') await classify();
  if (changed === 'selection') await user.click(within(screen.getByRole('navigation', {name:'章节'})).getAllByRole('button')[1]);
  const before = structuredClone(state());
  await user.click(button(buttons.confirm));
  assert.deepEqual(state(), before, `Stale ${changed} confirmation must not commit`);
  assert.notEqual(state().chapters[0].status, 'ACCEPTED');
  assert.equal(requests.length, 0);
}
// A storage event changes save health without changing the in-memory workspace.
boot(prepared(classified(), true));
await user.click(button(buttons.accept));
const beforeHealth = structuredClone(state());
await act(async () => window.dispatchEvent(new window.StorageEvent('storage', {key:KEY, storageArea:localStorage, oldValue:localStorage.getItem(KEY), newValue:localStorage.getItem(KEY)})));
await user.click(button(buttons.confirm));
assert.deepEqual(state(), beforeHealth);
assert.ok(screen.getByRole('alert'));
console.log('PASS manual UI confirmation: editor, same-text patch, selection and save-health changes cannot reuse approval');

// Failed writes never accept, erase the saved chapter or trigger provider retry.
boot(prepared(classified(), true));
await user.click(button(buttons.accept));
const beforeFailure = structuredClone(saved());
const storageWrite = dom.window.Storage.prototype.setItem;
dom.window.Storage.prototype.setItem = function() {throw new DOMException('manual synthetic quota failure', 'QuotaExceededError');};
await user.click(button(buttons.confirm));
assert.deepEqual(saved(), beforeFailure);
assert.match(screen.getByRole('alert').textContent, /尚未安全保存/);
assert.equal(screen.getByLabelText('章节正文').value, MANUAL);
dom.window.Storage.prototype.setItem = storageWrite;
await user.click(button('重试保存'));
assert.notEqual(state().chapters[0].status, 'ACCEPTED', 'Retry saving is not renewed acceptance');
await user.click(button('返回核对'));
await confirm();
assert.equal(state().chapters[0].status, 'ACCEPTED');
assert.equal(requests.length, 0);
console.log('PASS manual UI quota failure: no acceptance, retained exact text, local save retry, renewed confirmation');

// Import clears pending skip/review permissions; the author must explicitly skip again.
boot(prepared(classified(), true));
const pendingBackup = structuredClone(saved());
await importData(pendingBackup);
assert.equal(current().text, MANUAL);
assert.equal(current().extraction.status, 'pending');
assert.equal(current().review, null);
assert.equal(current().modelReview, null);
assert.deepEqual(current().staging, []);
await acceptanceBlocked();
await user.click(button(buttons.skip));
assert.equal(current().extraction.status, 'skipped');
assert.equal(current().review, null);
await review(); await confirm();
assert.equal(state().chapters[0].status, 'ACCEPTED');
assert.equal(requests.length, 0);
console.log('PASS pending manual import: original text retained, skip/review authority reset, explicit local re-skip and re-review');

// Confirmed Canon always requires the existing model review and conflict gate.
boot(prepared(canonProject()), 'template');
const canon = structuredClone(state().facts);
await user.click(button('审查候选稿'));
await acceptanceBlocked();
assert.equal(current().modelReview, null);
assert.equal(requests.length, 0, 'Offline mode cannot silently use the configured server');
assert.equal(button('提取候选记忆').disabled, true);
await user.click(button('模型运行方式'));
await user.click(button('检查服务连接'));
await user.click(button('使用真实模型'));
assert.equal(requests.length, 1, 'Choosing server mode does not initiate chapter review');
replyFor = call => {
  assert.equal(call.action, 'reviewChapter');
  assert.equal(call.input.text, CONFLICT);
  assert.deepEqual(call.input.context.facts, canon);
  return {summary:'合成已知设定冲突，仅测试门禁', issues:[], checks:[], factChecks:[{factId:canon[0].id, recordVersion:canon[0].recordVersion, status:'contradiction', explanation:'原设定与当前手写稿相冲突', sourceQuote:CONFLICT}]};
};
await user.click(button('审查候选稿'));
await waitFor(() => assert.ok(current().modelReview));
assert.equal(requests.length, 2);
await acceptanceBlocked();
assert.match(screen.getByLabelText('已确认设定逐条审阅').textContent, /冲突/);
await user.click(button('审阅并决定此项例外'));
assert.equal(button('确认接受此项例外，保留原设定').disabled, true);
await user.type(screen.getByLabelText('作者决定理由'), '此处是角色声称见过，不改写原有设定');
await user.click(button('确认接受此项例外，保留原设定'));
await confirm();
assert.deepEqual(state().facts, canon);
assert.deepEqual(state().events, []);
assert.equal(requests.filter(call => call.action === 'reviewChapter').length, 1);
assert.equal(requests.filter(call => call.action === 'extractMemory').length, 0);
cleanup();
console.log('PASS Canon manual UI: template blocks, explicit server review only, known conflict requires reasoned exception, Canon retained, no extraction or hidden calls');
