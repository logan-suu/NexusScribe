import {currentMaintenancePaths} from './eval-source-inventory.mjs';
/** Offline preregistration validator only. No live transport, dispatch, credential read, or application mutation. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { segmentProse } from '../src/domain/prose.js';
import { validateInput, validateOutput } from '../server/provider.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const protocol = Object.freeze({ id: 'author-revision-v1', version: 1, mode: 'retired_consumed_offline_replay',
  endpoint: 'https://opencode.ai/zen/go/v1/chat/completions', model: 'deepseek-v4.1-flash',
  maxCalls: 3, maxTokens: 3000, maxOutputTokens: 9000, temperature: 0.7, thinking: 'disabled', minimumGapMs: 11000,
  actions: Object.freeze(['reviseProse', 'extractMemory', 'reviewChapter']),
  targetHan: Object.freeze([350, 500]), targetParagraphs: Object.freeze([4, 7]) });
export const CLOSE_READ_ITEMS = Object.freeze(['physical_visibility_and_custody', 'time_and_obligation',
  'knowledge_and_viewpoint', 'voice_and_professional_detail', 'compression_without_flattening']);
export const SOURCE_HASHES = Object.freeze({
  text: '6a58486c108fe32ac376f3d4f5bbd96483b7367300fa61c549aa5fca30142046',
  context: '8c7fb150cf64b1c9cee21892a9afb0b11458e349358dea2e5631eadd9a5a7436',
  acceptedPriorText: 'c093b4d5bf0ae51a4cdf9bc9b62aa7f5f20a1851493b429acac6eec974178a73',
  project: '3e0cb449d4cb55e9b949a6de940ca526febed706d2c0fda3f5a649fd6765f5ed'
});
export const FROZEN_PATHS = Object.freeze(currentMaintenancePaths(Object.freeze([
  'eval/AUTHOR-REVISION-PROTOCOL.md', 'scripts/run-author-revision-eval.mjs', 'tests/author-revision-eval.test.js',
  'server/provider.js', 'server/provider-transport.js', 'src/domain/prose.js',
  'scripts/run-author-revision-live.mjs', 'tests/author-revision-live.test.js', '.github/workflows/author-revision-trial.yml',
  'eval/history/multichapter-v1/completed-05.json', 'eval/history/multichapter-v1/request-05.json',
  'eval/history/multichapter-v1/request-06.json', 'eval/history/multichapter-v1/request-07.json',
  'eval/history/multichapter-v1/source-manifest.json', 'eval/history/multichapter-v1/artifact-index.json',
  'eval/MULTICHAPTER-RESULTS.md',
  ...['completed-01.json','dispatch-01.json','index-01.json','intent-01.json','ledger-01.json','raw-01.bin','request-01.json','source-manifest.json'].map(name => 'eval/history/author-revision-v1/'+name)
])));
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const fail = reason => { throw Object.assign(Error(reason), { code: 'AUTHOR_REVISION_PREFLIGHT_FAILED', reason }); };
const check = (id, pass) => ({ id, status: pass ? 'pass' : 'fail' });
const assessment = checks => ({ status: checks.every(x => x.status === 'pass') ? 'pass' : 'fail', checks,
  stopReason: checks.find(x => x.status !== 'pass')?.id || null });

export async function verifyFrozenManifest({ root = ROOT } = {}) {
  const manifest = JSON.parse(await readFile(resolve(root, 'eval/author-revision-manifest.json'), 'utf8'));
  if (manifest.protocol !== protocol.id || manifest.version !== protocol.version || manifest.status !== protocol.mode ||
      !same(manifest.settings, protocol) || !same(manifest.closeReadItems, CLOSE_READ_ITEMS) ||
      !object(manifest.sha256) || !same(Object.keys(manifest.sha256).sort(), [...FROZEN_PATHS].sort())) fail('FROZEN_MANIFEST');
  for (const path of FROZEN_PATHS) {
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256[path]) || digest(await readFile(resolve(root, path))) !== manifest.sha256[path]) fail('FROZEN_SOURCE_MISMATCH');
  }
  const prose = await readFile(resolve(root, 'eval/AUTHOR-REVISION-PROTOCOL.md'), 'utf8');
  const instruction = prose.match(/## Exact author instruction[\s\S]*?```text\n([\s\S]*?)\n```/)?.[1];
  if (!nonempty(manifest.instruction) || instruction !== manifest.instruction || digest(instruction) !== manifest.instructionSha256) fail('INSTRUCTION_MISMATCH');
  return manifest;
}
function assertTrial(trial) {
  if (!object(trial) || trial.chapterId !== 'ch2' || digest(trial.text) !== SOURCE_HASHES.text ||
      digest(trial.context) !== SOURCE_HASHES.context || !nonempty(trial.instruction) ||
      trial.instruction !== trial.manifest?.instruction || digest(trial.instruction) !== trial.manifest?.instructionSha256) fail('INPUT_MISMATCH');
}
export async function loadFrozenTrial(options = {}) {
  const root = options.root || ROOT, manifest = await verifyFrozenManifest({ root });
  const original = JSON.parse(await readFile(resolve(root, 'eval/history/multichapter-v1/completed-05.json'), 'utf8'));
  const request = JSON.parse(await readFile(resolve(root, 'eval/history/multichapter-v1/request-05.json'), 'utf8'));
  const trial = { text: original.output.text, chapterId: original.output.chapterId, instruction: manifest.instruction,
    context: structuredClone(request.input.context), manifest };
  assertTrial(trial);
  const prior = trial.context.sources[0], stats = proseStats(trial.text);
  if (request.action !== 'generateProse' || original.action !== 'generateProse' || original.sequence !== 5 ||
      request.input.chapterIndex !== 1 || digest(request.input.project) !== SOURCE_HASHES.project ||
      stats.hanCharacters !== 691 || stats.paragraphs !== 8 || prior.chapterId !== 'ch1' || prior.revision !== 3 ||
      prior.revisionId !== 'ch1-r3' || prior.role !== 'accepted_manuscript' || digest(prior.text) !== SOURCE_HASHES.acceptedPriorText ||
      trial.context.events.length !== 0 || trial.context.facts.length !== 3 ||
      !trial.context.sources.slice(1).every(x => x.role === 'planned_content')) fail('SOURCE_IDENTITY_MISMATCH');
  const input = buildRevisionInput(trial);
  if (digest(input) !== manifest.revisionInputSha256) fail('REVISION_INPUT_HASH_MISMATCH');
  return trial;
}
export function buildRevisionInput(trial) {
  assertTrial(trial);
  const input = { text: trial.text, instruction: trial.instruction, chapterId: trial.chapterId, context: structuredClone(trial.context) };
  validateInput('reviseProse', input);
  return input;
}
export function proseStats(text) {
  if (typeof text !== 'string') return { characters: null, hanCharacters: null, paragraphs: null };
  return { characters: [...text].length, hanCharacters: (text.match(/\p{Script=Han}/gu) || []).length, paragraphs: segmentProse(text).length };
}
export function proseChecks(text) {
  const stats = proseStats(text);
  let jsonWrapped = false;
  if (typeof text === 'string') { try { const parsed = JSON.parse(text); jsonWrapped = object(parsed) || Array.isArray(parsed); } catch {} }
  const checks = [check('PROSE_NONEMPTY_BOUNDED', nonempty(text) && text.length <= 30000),
    check('PROSE_NO_CODE_FENCES', typeof text === 'string' && !/^\s*(?:```|~~~)/m.test(text)),
    check('PROSE_NOT_JSON_WRAPPED', !jsonWrapped),
    check('HAN_350_500', stats.hanCharacters >= 350 && stats.hanCharacters <= 500),
    check('PARAGRAPHS_4_7', stats.paragraphs >= 4 && stats.paragraphs <= 7)];
  return { ...assessment(checks), stats, textSha256: typeof text === 'string' ? digest(text) : null,
    semanticStatus: 'not_evaluated', note: 'Counts and hashes do not assess prose quality or story semantics.' };
}
/** Validate the recorded reader attestation, never claim to infer semantics from its fields. */
export function validateCloseReadRecord(record, text) {
  const validText = typeof text === 'string';
  const items = Array.isArray(record?.items) ? record.items.filter(object) : [];
  const checks = [check('CLOSE_READ_IDENTITY', validText && object(record) && record.protocol === protocol.id &&
    ['human', 'assistant'].includes(record.reviewerType) && nonempty(record.reviewer) && record.nonBlind === true &&
    record.fullCandidateRead === true && record.textSha256 === digest(text) && record.locked === true),
    check('CLOSE_READ_ITEMS', Array.isArray(record?.items) && record.items.length === CLOSE_READ_ITEMS.length &&
      items.length === CLOSE_READ_ITEMS.length && same(items.map(x => x.id).sort(), [...CLOSE_READ_ITEMS].sort()))];
  for (const id of CLOSE_READ_ITEMS) {
    const item = items.find(x => x.id === id);
    const evidenceValid = validText && Array.isArray(item?.evidence) && item.evidence.length > 0 && item.evidence.every(span =>
      object(span) && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= 0 && span.end > span.start &&
      span.end <= text.length && nonempty(span.quote) && text.slice(span.start, span.end) === span.quote);
    checks.push(check(`CLOSE_READ_${id}`, item?.status === 'pass' && nonempty(item.explanation) && evidenceValid));
  }
  return { ...assessment(checks), semanticStatus: 'reader_attestation_only',
    note: 'A syntactically valid record is a fallible recorded close read, not verified literary quality or author approval.' };
}
export function buildFollowupInput(action, text, trial, closeRead) {
  assertTrial(trial);
  if (!['extractMemory', 'reviewChapter'].includes(action)) fail('REQUEST_ORDER');
  if (proseChecks(text).status !== 'pass') fail('OBJECTIVE_CHECK_FAILED');
  if (validateCloseReadRecord(closeRead, text).status !== 'pass') fail('CLOSE_READ_NOT_PASSED');
  const input = { text, chapterId: trial.chapterId, context: structuredClone(trial.context) };
  validateInput(action, input);
  return input;
}
/** Assessment only; no call dispatch, retry, lifecycle mutation or automatic acceptance. */
export function assessStage(action, output, { trial, text, closeRead } = {}) {
  assertTrial(trial);
  if (!protocol.actions.includes(action)) fail('REQUEST_ORDER');
  const input = action === 'reviseProse' ? buildRevisionInput(trial) : buildFollowupInput(action, text, trial, closeRead);
  const normalized = object(output) ? { ...output } : output;
  if (object(normalized)) delete normalized.provider;
  let schemaValid = true;
  try { validateOutput(action, normalized, input); } catch { schemaValid = false; }
  const checks = [check('PRODUCTION_OUTPUT_SCHEMA', schemaValid)];
  if (!schemaValid) return assessment(checks);
  if (action === 'reviseProse') {
    const objective = proseChecks(normalized.text);
    return { ...assessment([...checks, ...objective.checks]), stats: objective.stats, textSha256: objective.textSha256,
      nextStage: objective.status === 'pass' ? 'await_close_read' : 'stopped', semanticStatus: 'not_evaluated' };
  }
  if (action === 'extractMemory') {
    checks.push(check('EXTRACTION_NONEMPTY', normalized.staging.length > 0));
    const paragraphs = segmentProse(text);
    checks.push(check('EXACT_SOURCE_BINDING', normalized.staging.every(item => {
      const p = paragraphs[item.sourceParagraphIndex];
      return p && item.sourceQuote === p.text && item.sourceStart === p.start && item.sourceEnd === p.end && text.slice(item.sourceStart, item.sourceEnd) === item.sourceQuote;
    })));
  } else {
    const facts = trial.context.facts.filter(f => f.status === 'confirmed' && f.authority === 'explicit_author_decision');
    const actual = normalized.factChecks;
    checks.push(check('COMPLETE_FACT_COVERAGE', Array.isArray(actual) && actual.length === facts.length &&
      facts.every(f => actual.filter(x => x.factId === f.id && x.recordVersion === f.recordVersion).length === 1)));
    checks.push(check('NO_BLOCKING_REVIEW', !normalized.issues.some(x => x.severity === 'error') &&
      Array.isArray(actual) && !actual.some(x => ['contradiction', 'unknown'].includes(x.status))));
  }
  return { ...assessment(checks), textSha256: digest(text), semanticStatus: 'not_independently_verified', authorAccepted: false };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--offline')) fail('OFFLINE_ONLY_NO_DISPATCH');
  const trial = await loadFrozenTrial();
  return { protocol: protocol.id, mode: 'offline_preparation_only', sourceVerified: true, sourceStats: proseStats(trial.text),
    revisionInputSha256: digest(buildRevisionInput(trial)), liveCalls: 0, liveRetired: true, historicalLiveAttempts: 1, additionalLiveAllowance: 0, nextStage: 'none_retired',
    note: 'The one-call trial stopped at its close-read gate. Live workflow and CLI are retired; only credential-free offline checks/replay remain.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await main(), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: 'blocked', code: error.code || 'PREFLIGHT_ERROR', reason: error.reason || 'READ_OR_PARSE_FAILED', liveCalls: 0 })); process.exitCode = 1; }
}
