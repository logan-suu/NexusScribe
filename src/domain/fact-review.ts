import type {Draft, ProjectState, FactCheck, FactLedgerEntry} from './types.js';
/** Structural evidence validation only. Semantic labels remain model assessments. */
export const authorFacts = (state: ProjectState) => state.facts.filter(f => f.status === 'confirmed' && f.authority === 'explicit_author_decision');
const validText = (x: unknown): x is string => typeof x === 'string' && !!x.trim();
function invalid(): never { throw Object.assign(Error('设定审查需要当前设定 ID、记录版本、合法判断和候选原文证据'), {code:'INVALID_FACT_REVIEW'}); }
export function buildFactLedger(state: ProjectState, draft: Draft, checks: unknown = []): FactLedgerEntry[] {
 if (!Array.isArray(checks)) invalid();
 const facts = authorFacts(state), seen = new Set<unknown>();
 const validChecks: FactCheck[] = [];
 const incoming: unknown[] = checks;
 for (const check of incoming) {
  if (!isRecord(check) || Object.keys(check).some(k => !['factId','recordVersion','status','explanation','sourceQuote'].includes(k))) invalid();
  const fact = facts.find(f => f.id === check.factId);
  if (!fact || seen.has(check.factId) || check.recordVersion !== fact.recordVersion || !isFactStatus(check.status) || !validText(check.explanation) || typeof check.sourceQuote !== 'string') invalid();
  if (check.sourceQuote && !draft.text.includes(check.sourceQuote)) invalid();
  if ((check.status === 'consistent' || check.status === 'contradiction') && !validText(check.sourceQuote)) invalid();
  seen.add(check.factId);
  validChecks.push({factId:fact.id,recordVersion:fact.recordVersion,status:check.status,explanation:check.explanation,sourceQuote:check.sourceQuote});
 }
 return facts.map(fact => {
  const check = validChecks.find(x => x.factId === fact.id);
  const source = fact.source, revision = state.chapters.find(c => c.id === source?.chapterId)?.revisions.find(r => r.revision === source?.revision);
  const provenanceValid = Boolean(source && validText(source.quote) && revision?.text.includes(source.quote) && (!source.paragraphId || revision.paragraphs?.some(p => p.id === source.paragraphId && p.text.includes(source.quote))));
  return {factId:fact.id,recordVersion:fact.recordVersion,factLabel:fact.label,factSource:structuredClone(source ?? null),provenanceValid,status:!provenanceValid?'unknown':check?.status??'unknown',explanation:!provenanceValid?'设定原始版本证据无法核验，需作者复核':check?.explanation??'模型未提供这条已确认设定的判断',sourceQuote:check?.sourceQuote??'',assessmentOrigin:check?'model':'missing',candidate:{draftId:draft.id,runId:draft.runId,revision:draft.revision},blocking:!provenanceValid||!check||['contradiction','unknown'].includes(check.status)};
 });
}

function isRecord(value: unknown): value is Record<string,unknown> {return value !== null && typeof value === 'object' && !Array.isArray(value);}
function isFactStatus(value: unknown): value is FactCheck['status'] {return value === 'consistent' || value === 'contradiction' || value === 'not_applicable' || value === 'unknown';}
