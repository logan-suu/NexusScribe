// Offline application workflow regression. Retained prose is replayed verbatim;
// all follow-on prose, extraction choices and semantic judgments are mocks.
// This is DOM/state evidence, not browser layout or model-quality evidence.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir, symlink} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
import {segmentProse} from '../src/domain/prose.js';

const out = '/tmp/nexusscribe-ui-multichapter';
await mkdir(out + '/node_modules', {recursive:true});
for (const name of ['react','react-dom','lucide-react']) {
  try {await symlink(resolve('node_modules', name), out + '/node_modules/' + name);}
  catch (error) {if (error.code !== 'EEXIST') throw error;}
}
await build({entryPoints:['src/App.jsx'], bundle:true, packages:'external', format:'esm', outfile:out+'/App.mjs', loader:{'.css':'empty'}, jsx:'automatic'});
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'});
for (const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle','File']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', {value:dom.window.navigator, configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function() {};
const React = await import('react');
const {render, screen, within, waitFor, cleanup, act, fireEvent} = await import('@testing-library/react');
const user = (await import('@testing-library/user-event')).default.setup();
const {default:App} = await import(out+'/App.mjs');

const KEY = 'nexusscribe.demo.v1';
const provider = {id:'multichapter-offline-mock', isLive:true};
const retained = JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-02.json', import.meta.url), 'utf8'));
const extracted = JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-03.json', import.meta.url), 'utf8'));
const unsupported = extracted.staging[1], kept = extracted.staging[8];
const second = '第二天，程岚带着装纸屑的空表壳找到管理员。管理员说：“昨夜没有开过门。”\n\n程岚把押金条压在登记簿旁，请他核对昨晚的记录。阿陶站在门外，没有看见表壳里的纸屑。\n\n管理员翻到空白的一页，没有回答。';
const revisedSecond = second.replace('昨夜没有开过门', '昨夜开过一次南门');
const third = '程岚沿登记簿指向的南门走去，把空表壳留在自己口袋里。她没有告诉阿陶管理员改了口。\n\n南门内侧压着一条湿纸带。程岚没有把它和表壳里的纸屑拼在一起，只先记下纸带的位置。\n\n门外响起脚步声。她关上登记簿，等那人先开口。';
const report = {summary:'合成整章审阅，不是语义正确性证据', issues:[], checks:[], factChecks:[], provider};
let calls = [], exportedBlob;
globalThis.fetch = (url, options = {}) => {
  if (url === '/api/status') return Promise.resolve({ok:true, json:async () => ({configured:true, liveEnabled:true, callsUsed:calls.length, maxCalls:30})});
  assert.equal(url, '/api/agent', 'Only the offline mock endpoint is permitted');
  return new Promise(resolve => calls.push({resolve, options, body:JSON.parse(options.body)}));
};
URL.createObjectURL = blob => {exportedBlob = blob; return 'blob:offline-multichapter';};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function() {};
const saved = () => JSON.parse(localStorage.getItem(KEY));
const state = () => saved().state;
const drafts = () => [...document.querySelectorAll('article.draft')];
const control = (action, n) => screen.getByRole('button', {name:new RegExp(`^${action}候选记忆 ${n}：`)});
const candidate = n => screen.getByRole('article', {name:new RegExp(`^候选记忆 ${n}：`)});

function project() {
  return engine.createProjectFromConfig({projectId:'multichapter-offline', title:'雨夜寄存室', protagonist:'程岚', idea:'修表师沿纸屑寻找匿名来信的来处', pov:'第三人称限知，只跟随程岚', tone:'克制、干涩', goal:'沿证据推进，不提前揭晓寄信人', boundaries:'阿陶不能无来源知道信封内容', outline:[{title:'雨夜寄存室',goal:'保存纸屑'}, {title:'次日登记簿',goal:'核对管理员'}, {title:'南门纸带',goal:'寻找证据'}], chapters:[{title:'第一章 雨夜寄存室'}, {title:'第二章 次日登记簿'}, {title:'第三章 南门纸带'}]});
}
function extraction(text, chapterId) {
  if (chapterId === 'ch1') return {staging:[unsupported, kept], reviewNotes:[]};
  const index = chapterId === 'ch2' ? 0 : 1, paragraph = segmentProse(text)[index];
  const label = chapterId === 'ch2' ? (text.includes('昨夜开过一次南门') ? '管理员说昨夜开过一次南门' : '管理员说昨夜没有开过门') : '程岚记下南门内侧湿纸带的位置';
  return {staging:[{label, sourceParagraphIndex:index, sourceQuote:paragraph.text, sourceStart:paragraph.start, sourceEnd:paragraph.end}], reviewNotes:[]};
}
async function boot(initial = project()) {
  cleanup(); calls = []; localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify({format:1, serial:0, state:initial, editing:{}, patch:null, providerMode:'server'}));
  render(React.createElement(App));
}
function reload() {cleanup(); render(React.createElement(App));}
async function chapter(index) {await user.click(within(screen.getByRole('navigation', {name:'章节'})).getAllByRole('button')[index]);}
async function request(action, buttonName) {
  const count = calls.length;
  await user.click(screen.getByRole('button', {name:buttonName, exact:typeof buttonName === 'string'}));
  await waitFor(() => assert.equal(calls.length, count + 1, `Expected one ${action} request`));
  assert.equal(calls[count].body.action, action);
  return calls[count];
}
async function reply(call, output, failed = false) {
  await act(async () => call.resolve({ok:!failed, status:failed ? 503 : 200, json:async () => failed ? {error:{message:'合成提取失败，无真实调用'}} : {output:{...output, provider}}}));
}
async function generate(index, text) {
  const call = await request('generateProse', '生成当前章');
  assert.equal(call.body.input.chapterIndex, index);
  await reply(call, {text, chapterId:`ch${index+1}`});
  assert.equal(drafts()[0].querySelector('.draft-prose').textContent, text);
  return call;
}
async function extract() {
  const call = await request('extractMemory', '提取候选记忆');
  await reply(call, extraction(call.body.input.text, call.body.input.chapterId));
  assert.equal(screen.getByRole('button', {name:'审查候选稿'}).disabled, false);
}
async function review() {
  const call = await request('reviewChapter', '审查候选稿');
  assert.equal(Object.hasOwn(call.body.input, 'memoryCandidates'), false);
  await reply(call, report);
}
async function audit(n, status = 'supported') {
  const expected = state().drafts.at(-1).staging[n-1];
  const call = await request('auditMemoryCandidate', new RegExp(`^独立核对候选记忆 ${n}：`));
  assert.deepEqual(call.body.input, {label:expected.label, sourceQuote:expected.sourceQuote});
  await reply(call, {status, explanation:'合成独立判断，仅验证工作流'});
  assert.equal(control('保留', n).disabled, status !== 'supported');
}
async function accept(index) {
  const before = structuredClone(state().events);
  await user.click(screen.getByRole('button', {name:'接受此版本'}));
  assert.ok(screen.getByRole('dialog', {name:'确认接受候选稿与已选记忆'}));
  assert.ok(screen.getByRole('dialog', {name:'确认接受候选稿与已选记忆'}).textContent.includes(['第一章 雨夜寄存室','第二章 次日登记簿','第三章 南门纸带'][index]));
  assert.deepEqual(state().events, before, 'Opening acceptance is not a commit');
  await user.click(screen.getByRole('button', {name:'确认接受正文与所选记忆'}));
  assert.equal(state().chapters[index].status, 'ACCEPTED');
}

// 1. The actual application completes all three stages per chapter. Failed and
// cancelled extraction cannot be mistaken for an empty successful result.
await boot(); await chapter(1);
await user.click(screen.getByRole('button', {name:'生成当前章'}));
assert.match(screen.getByRole('status').textContent, /请先审阅并接受前一章/);
assert.equal(calls.length, 0);
await chapter(0); await generate(0, retained.text);
const failed = await request('extractMemory', '提取候选记忆');
await reply(failed, null, true);
assert.equal(state().drafts[0].text, retained.text);
assert.equal(state().drafts[0].extraction.status, 'failed');
assert.deepEqual(state().events, []);
reload();
assert.equal(screen.getByRole('heading', {level:1}).textContent, '第一章 雨夜寄存室');
assert.equal(calls.length, 2);
const cancelled = await request('extractMemory', '提取候选记忆');
await user.click(screen.getByRole('button', {name:'取消请求'}));
assert.equal(cancelled.options.signal.aborted, true);
assert.equal(state().drafts[0].extraction.status, 'cancelled');
await extract();
const afterRetry = structuredClone(state());
await reply(cancelled, extraction(retained.text, 'ch1'));
assert.deepEqual(state(), afterRetry);
await review();
assert.equal(control('保留', 1).disabled, true);
assert.equal(control('保留', 2).disabled, true);
await audit(1, 'unsupported'); await user.click(control('拒绝', 1));
await audit(2); await user.click(control('保留', 2));
assert.deepEqual(state().events, []); await accept(0);
const acceptedFirst = structuredClone(state());
assert.deepEqual(state().events.map(event => event.label), [kept.label]);
assert.equal(state().events[0].source.quote, kept.sourceQuote);

await chapter(1);
assert.equal(drafts().length, 0, 'Chapter 2 must not display chapter 1 draft controls');
const secondRequest = await generate(1, second);
assert.deepEqual(secondRequest.body.input.context.events.map(event => event.label), [kept.label]);
assert.equal(secondRequest.body.input.context.sources[0].text, retained.text);
await extract(); await review(); await audit(1); await user.click(control('保留', 1));
const oldDraft = structuredClone(state().drafts.at(-1));
await user.click(screen.getByRole('button', {name:'编辑此稿'}));
fireEvent.change(screen.getByLabelText('编辑候选稿'), {target:{value:revisedSecond}});
await user.click(screen.getByRole('button', {name:'保存候选稿修改'}));
const edited = state().drafts.at(-1);
assert.deepEqual(edited.proseVersions.map(version => version.text), [second, revisedSecond]);
assert.deepEqual(edited.staging, []);
assert.deepEqual(edited.memoryDecisions, []);
assert.equal(edited.modelReview, null);
assert.ok(edited.memoryArchives.some(archive => archive.candidates.some(item => item.id === oldDraft.staging[0].id)));
assert.equal(screen.getByRole('button', {name:'接受此版本'}).disabled, true);
await extract(); await review(); await audit(1); await user.click(control('保留', 1)); await accept(1);
await chapter(2); assert.equal(drafts().length, 0);
const thirdRequest = await generate(2, third);
assert.deepEqual(thirdRequest.body.input.context.events.map(event => event.label), [kept.label, '管理员说昨夜开过一次南门']);
assert.equal(JSON.stringify(thirdRequest.body.input.context).includes('管理员说昨夜没有开过门'), false);
await extract(); await review(); await audit(1); await user.click(control('保留', 1)); await accept(2);
assert.deepEqual(state().chapters.map(item => item.status), ['ACCEPTED','ACCEPTED','ACCEPTED']);
assert.equal(state().events.length, 3);
assert.equal(calls.length, 18);
reload();
assert.equal(screen.getByRole('heading', {level:1}).textContent, '第三章 南门纸带');
for (let index = 0; index < 3; index++) {await chapter(index); assert.equal(drafts().length, 1); assert.equal(drafts()[0].querySelector('.draft-prose').textContent, [retained.text,revisedSecond,third][index]);}
console.log('PASS offline three-chapter journey: 18 mocked requests, retained prose, failed/cancelled extraction/retry, isolated keep/reject, draft revision invalidation, later context, per-chapter controls and reload');

function pendingAfterFirst() {
  let s = engine.stageProseDraft(acceptedFirst, {text:second, provider, context:engine.getContext(acceptedFirst)}, 'ch2');
  const id = s.drafts.at(-1).id;
  s = engine.beginMemoryExtraction(s, id);
  s = engine.attachMemoryExtraction(s, id, {...extraction(second, 'ch2'), provider}, engine.createExtractionBinding(s, id));
  s = engine.reviewDraft(s, id);
  s = engine.attachSemanticReview(s, id, report, engine.createReviewBinding(s, id));
  const candidateId = s.drafts.at(-1).staging[0].id;
  s = engine.beginMemorySupportAssessment(s, id, candidateId);
  s = engine.attachMemorySupportAssessment(s, id, candidateId, {status:'supported', explanation:'合成预置独立核对', provider}, engine.createMemorySupportBinding(s, id, candidateId));
  const gate = engine.getMemoryReviewGate(s, id)[0];
  return engine.decideMemoryCandidate(s, id, {candidateId, action:'keep', reviewHash:gate.reviewHash}, gate.binding);
}

// 2. Editing accepted prose leaves audit history intact but must not continue
// presenting that obsolete quote as current memory to the next request.
const initial = pendingAfterFirst();
await boot(initial); await chapter(0);
const revisedFirst = retained.text.replace(kept.sourceQuote, '阿陶把回形针搁回柜台。程岚把纸屑装进小纸袋，决定暂时不问管理员。');
fireEvent.change(screen.getByLabelText('章节正文'), {target:{value:revisedFirst}});
const interpretation = await request('interpretRevision', '保存并分析');
await reply(interpretation, {summary:'合成修改解释', suggestedFacts:[], operations:[], questions:[]});
await user.click(screen.getByRole('button', {name:'仅局部表达，不更新设定'}));
await user.click(screen.getByRole('button', {name:'确认并提交状态'}));
assert.deepEqual(state().events, initial.events);
assert.ok(state().chapters[0].revisions.some(version => version.text === retained.text));
await user.click(screen.getByRole('button', {name:'查看场景上下文'}));
const current = JSON.parse(screen.getByRole('dialog', {name:'场景上下文'}).querySelector('pre').textContent);
assert.deepEqual(current.events, []);
assert.equal(current.sources[0].text, revisedFirst);
await user.click(screen.getByRole('button', {name:'关闭详情'}));
await chapter(1);
assert.equal(screen.getByRole('button', {name:'接受此版本'}).disabled, true);
await user.click(screen.getByRole('button', {name:'提取候选记忆'}));
assert.match(screen.getByRole('status').textContent, /已变化/);
assert.equal(calls.length, 1, 'Stale extraction is blocked before any provider request');
await user.click(screen.getByRole('button', {name:'更新参考上下文'}));
assert.ok(screen.getByRole('dialog', {name:'确认更新候选参考上下文'}));
const beforeCancel = structuredClone(state());
await user.click(screen.getByRole('button', {name:'取消更新'}));
assert.deepEqual(state(), beforeCancel);
await user.click(screen.getByRole('button', {name:'更新参考上下文'}));
await user.click(screen.getByRole('button', {name:'确认更新参考上下文', exact:true}));
assert.equal(calls.length, 1, 'Refreshing reference context is local and never regenerates paid prose');
assert.equal(state().drafts.at(-1).text, second);
assert.deepEqual(state().drafts.at(-1).proseVersions, initial.drafts.at(-1).proseVersions);
assert.deepEqual(state().drafts.at(-1).context.events, []);
assert.equal(state().drafts.at(-1).context.sources[0].text, revisedFirst);
assert.deepEqual(state().drafts.at(-1).memoryDecisions, []);
assert.deepEqual(state().drafts.at(-1).staging, []);
await extract(); await review();
assert.equal(control('保留', 1).disabled, true);
await audit(1); await user.click(control('保留', 1));
assert.deepEqual(state().events, initial.events);
await accept(1);
assert.deepEqual(calls.map(call => call.body.action), ['interpretRevision','extractMemory','reviewChapter','auditMemoryCandidate']);
console.log('PASS source revision: obsolete memory excluded, source history retained, old draft gated; cancel-safe local refresh preserves prose and requires new extraction/review/audit');

// 3. Use the UI-exported bytes as input to the UI import, rather than constructing
// a different backup. Pending permissions must be earned again in the new project.
await boot(initial); await chapter(1);
await user.click(screen.getByRole('button', {name:'导出项目备份'}));
const raw = await exportedBlob.text(), backup = JSON.parse(raw);
assert.equal(backup.state.drafts.at(-1).memoryDecisions.length, 1);
const file = new dom.window.File([raw], 'multichapter-backup.json', {type:'application/json'});
Object.defineProperty(file, 'text', {value:async () => raw});
await user.upload(screen.getByLabelText('导入备份'), file);
await waitFor(() => assert.ok(screen.getByRole('dialog', {name:'备份导入预览'})));
await user.click(screen.getByRole('button', {name:'确认作为新项目导入'}));
assert.notEqual(state().projectId, initial.projectId);
assert.deepEqual(state().importOrigin.original.state, backup.state);
assert.deepEqual(state().events.map(event => event.label), [kept.label]);
assert.deepEqual(state().drafts.at(-1).staging, []);
assert.deepEqual(state().drafts.at(-1).memoryDecisions, []);
assert.equal(state().drafts.at(-1).modelReview, null);
await chapter(1); reload();
assert.equal(screen.getByRole('heading', {level:1}).textContent, '第二章 次日登记簿');
assert.equal(screen.getByRole('button', {name:'接受此版本'}).disabled, true);
assert.equal(calls.length, 0);
await extract(); await review();
assert.equal(control('保留', 1).disabled, true);
await audit(1); await user.click(control('保留', 1)); await accept(1);
await user.selectOptions(screen.getByLabelText('切换项目'), initial.projectId);
assert.deepEqual(state().drafts.at(-1), initial.drafts.at(-1));
assert.deepEqual(state().events, initial.events);
assert.equal(calls.length, 3);
console.log('PASS backup export/import: original project preserved, pending permissions cleared, reload safe, new extraction/review/audit required');

// 4. Quota failures after a paid-stage result cannot silently drop that result.
// Retrying local persistence must not issue another extraction or review call.
for (const stage of ['extractMemory','reviewChapter']) {
  await boot(); await chapter(0); await generate(0, retained.text);
  if (stage === 'reviewChapter') await extract();
  const call = await request(stage, stage === 'extractMemory' ? '提取候选记忆' : '审查候选稿');
  const proto = dom.window.Storage.prototype, originalSet = proto.setItem;
  proto.setItem = function() {throw new DOMException('Synthetic quota exhausted', 'QuotaExceededError');};
  try {await reply(call, stage === 'extractMemory' ? extraction(retained.text, 'ch1') : report);}
  finally {proto.setItem = originalSet;}
  assert.match(screen.getByRole('alert').textContent, /尚未安全保存/);
  if (stage === 'extractMemory') assert.ok(candidate(2), 'Returned extraction stays visible in memory');
  else assert.ok(screen.getByText(report.summary), 'Returned semantic review stays visible in memory');
  const beforeRetry = calls.length;
  await user.click(screen.getByRole('button', {name:'重试保存'}));
  assert.equal(screen.queryByRole('alert'), null);
  assert.equal(calls.length, beforeRetry);
  if (stage === 'extractMemory') assert.equal(state().drafts[0].staging.length, 2);
  else assert.equal(state().drafts[0].modelReview.summary, report.summary);
  reload();
  if (stage === 'extractMemory') assert.ok(candidate(2));
  else assert.ok(screen.getByText(report.summary));
}
cleanup();
console.log('PASS extraction/review persistence retry: returned result survives quota failure, retry and reload with zero additional provider requests');
