// Offline artifact-contract validation only. No model, semantic classifier or adoption gate.
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const statuses = Object.freeze(['fulfilled', 'partial', 'missing', 'contradicted', 'uncertain']);
export const dimensions = Object.freeze(['goalfulfillment', 'causaltransitions', 'boundaries', 'advancement', 'voiceagency', 'countssoft']);
const defaultRoot = fileURLToPath(new URL('..', import.meta.url));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function loadSource(reference, root) {
  requireThat(object(reference) && nonempty(reference.path), 'source path required');
  requireThat(!isAbsolute(reference.path) && !reference.path.includes('\\') &&
    reference.path.split('/').every(part => part && part !== '.' && part !== '..'), 'unsafe source path');
  requireThat(/^eval\//.test(reference.path), 'source must be an eval artifact');
  requireThat(typeof reference.sha256 === 'string' && /^[a-f0-9]{64}$/.test(reference.sha256), 'source SHA-256 required');
  const base = realpathSync(root);
  const path = realpathSync(resolve(base, reference.path));
  const rel = relative(base, path);
  requireThat(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'source escapes root');
  const bytes = readFileSync(path);
  requireThat(hash(bytes) === reference.sha256, `source hash mismatch: ${reference.path}`);
  // Preserve a raw-text BOM as U+FEFF; JSON sources with a BOM are rejected by JSON.parse.
  return new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(bytes);
}

function resolvePointer(text, pointer) {
  requireThat(typeof pointer === 'string', 'JSON pointer required');
  if (pointer === '') return text; // Exact whole raw-text file, never parsed or normalized.
  requireThat(pointer.startsWith('/') && !/~(?:[^01]|$)/.test(pointer), 'invalid JSON pointer');
  let value = JSON.parse(text);
  for (const encoded of pointer.slice(1).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    requireThat(value !== null && typeof value === 'object' && Object.hasOwn(value, key), 'missing JSON pointer target');
    value = value[key];
  }
  requireThat(typeof value === 'string', 'pointer target must be a string');
  return value;
}

export function validateEvidenceReference(reference, root = defaultRoot) {
  const value = resolvePointer(loadSource(reference, root), reference.pointer);
  requireThat(Number.isSafeInteger(reference.start) && Number.isSafeInteger(reference.end) &&
    reference.start >= 0 && reference.end > reference.start && reference.end <= value.length,
  'invalid UTF-16 span');
  requireThat(nonempty(reference.quote) && value.slice(reference.start, reference.end) === reference.quote,
    'quote/span mismatch');
  // A matching quote verifies location and bytes, never entailment or world truth.
  return true;
}

export function validateReviewArtifact(artifact, root = defaultRoot) {
  requireThat(object(artifact) && artifact.formatVersion === 1 &&
    artifact.kind === 'offline-review-calibration' && artifact.providerCalls === 0, 'invalid offline calibration header');
  requireThat(Array.isArray(artifact.records) && artifact.records.length > 0, 'records required');
  const ids = new Set();
  let obligations = 0;
  let references = 0;
  for (const record of artifact.records) {
    requireThat(object(record) && nonempty(record.id) && !ids.has(record.id), 'unique record id required');
    ids.add(record.id);
    requireThat(['retained', 'synthetic'].includes(record.origin), 'explicit record origin required');
    loadSource(record.source, root);
    loadSource(record.text, root);
    let constraintPointer;
    let outputPointer;
    if (record.origin === 'retained') {
      requireThat(record.source.path.startsWith('eval/history/causal-quality-20261007/candidate-') &&
        /^eval\/history\/causal-quality-20261007\/raw-prose-0[1-6]\.bin$/.test(record.text.path),
      'retained records must cite original trial packets and raw prose');
      const packet = JSON.parse(loadSource(record.source, root));
      requireThat(packet.text === loadSource(record.text, root), 'retained packet/output binding mismatch');
      constraintPointer = '/storyInput';
      outputPointer = '';
    } else {
      requireThat(record.source.path === 'eval/scene-goal-synthetic-sources.json' &&
        record.text.path === record.source.path, 'synthetic records require labeled synthetic source');
      const corpus = JSON.parse(loadSource(record.source, root));
      requireThat(corpus.origin === 'synthetic-counterexamples',
        'synthetic source origin required');
      requireThat(nonempty(record.syntheticCaseId) && Array.isArray(corpus.cases), 'synthetic case binding required');
      const indices = corpus.cases.flatMap((row, index) => row.id === record.syntheticCaseId ? [index] : []);
      requireThat(indices.length === 1, 'unique synthetic case required');
      constraintPointer = `/cases/${indices[0]}/constraint`;
      outputPointer = `/cases/${indices[0]}/text`;
    }
    requireThat(Array.isArray(record.notes) && record.notes.every(nonempty), 'record notes must be strings');
    requireThat(Array.isArray(record.obligations) && record.obligations.length > 0, 'obligations required');
    const obligationIds = new Set();
    for (const obligation of record.obligations) {
      requireThat(object(obligation) && nonempty(obligation.id) && !obligationIds.has(obligation.id), 'unique obligation id required');
      obligationIds.add(obligation.id);
      requireThat(dimensions.includes(obligation.dimension) && statuses.includes(obligation.status), 'invalid review dimension/status');
      requireThat(nonempty(obligation.requirement) && nonempty(obligation.reasoning), 'requirement and reasoning required');
      requireThat(object(obligation.constraint) && obligation.constraint.path === record.source.path &&
        obligation.constraint.sha256 === record.source.sha256 && obligation.constraint.pointer === constraintPointer,
      'constraint must bind to record source and role');
      validateEvidenceReference(obligation.constraint, root);
      requireThat(Array.isArray(obligation.evidence) && obligation.evidence.length > 0, 'context evidence required, including missing/uncertain judgments');
      for (const evidence of obligation.evidence) {
        requireThat(object(evidence) && evidence.path === record.text.path && evidence.sha256 === record.text.sha256 &&
          evidence.pointer === outputPointer, 'evidence must bind to record output and role');
        validateEvidenceReference(evidence, root);
      }
      references += 1 + obligation.evidence.length;
      obligations++;
    }
  }
  return {records: artifact.records.length, obligations, references, semanticQuality: 'not_evaluated'};
}
