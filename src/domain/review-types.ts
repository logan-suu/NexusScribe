/** Persisted review contracts. Runtime validators remain the authority at import boundaries. */
import type {Context, Draft, ExtractionRecord, MemoryCandidate, MemoryReview, ReviewBinding} from './types.js';

export type MemoryAssessment = 'supported' | 'unsupported' | 'unknown';
export interface MemoryCheck {candidateId:string; status:MemoryAssessment; explanation:string}
export interface MemoryLedgerEntry extends MemoryCheck {label:string; sourceQuote:string; assessmentOrigin:'model'|'missing'}
export interface QuoteAnchor {paragraphId:string; start:number; end:number; text:string}
export interface QuoteCard extends QuoteAnchor {
 protocol:'quote-grounded-memory-v1'; trust:'textual_presence_only'; chapterId:string;
 draftId:string; draftRevision:number; paragraphIndex:number; before:QuoteAnchor|null; after:QuoteAnchor|null;
}
export type CompactQuoteAnchor = Omit<QuoteAnchor,'text'>;
export type CompactQuoteCard = Omit<QuoteCard,'text'|'before'|'after'> & {before:CompactQuoteAnchor|null; after:CompactQuoteAnchor|null};
export interface MemoryAttestation {protocol:'quote-grounded-memory-v1'; accepted:true; statement:string}
export type MemorySupportState = 'not_started'|'pending'|'complete'|'failed'|'cancelled'|'stale';
export interface MemorySupportResult {status:MemoryAssessment; explanation:string; provider:string|{id:string; [key:string]:unknown}; assessmentOrigin:'isolated-own-quote-v1'}
export interface MemorySupportAttempt {
 id:string; sequence:number; candidateId:string; authorityId:string; protocol:'isolated-own-quote-v1';
 state:'pending'|'complete'|'failed'|'cancelled'; supersedesAttemptId:string|null; invalidatedDecisionIds:string[];
 result?:MemorySupportResult; resultSnapshot?:MemorySupportResult; outcomeReason?:string;
}
export interface MemorySupport {schemaVersion:1; sequence:number; attempts:MemorySupportAttempt[]; heads:{candidateId:string;attemptId:string}[]}
export interface MemoryDecision {
 decisionId:string; candidateId:string; action:'keep'|'reject'|'override_keep'|'keep_quote'|'attest_keep';
 reason:string; authorityId:string; reviewHash:string; assessment:MemoryAssessment; explanation:string; authority:'explicit_author_decision';
 selectionProtocol?:'quote-grounded-memory-v1'; quoteSnapshot?:CompactQuoteCard|null; attestation?:MemoryAttestation;
 supportAttemptId?:string|null; supportState?:MemorySupportState; supportResultHash?:string|null;
}
export type MemorySnapshotValues = Pick<ReviewBinding,'textSnapshot'|'stagingSnapshot'|'contextSnapshot'|'extractionSnapshot'>;
export type CompactReviewBinding = Omit<ReviewBinding,keyof MemorySnapshotValues> & {snapshotId:string};
export type MemoryBinding = ReviewBinding|CompactReviewBinding;
export interface ContextRefreshBinding extends MemorySnapshotValues {projectId:string; baseVersion:number; chapterRevisions:Record<string,number>; draftRevision:number}
export type CompactContextRefreshBinding = Omit<ContextRefreshBinding,keyof MemorySnapshotValues> & {snapshotId:string};
export interface MemoryBindingSnapshot {id:string; values:MemorySnapshotValues}
export type MemoryReviewSnapshot = Omit<MemoryReview,'binding'|'textSnapshot'|'stagingSnapshot'|'factLedger'|'memoryLedger'>;
export interface MemoryAuthority {id:string; binding:MemoryBinding; reviewSnapshot:MemoryReviewSnapshot; reviewHash:string}
export interface MemoryArchive {
 reason:string; draftRevision:number; textSnapshot:string; candidates:MemoryCandidate[]; stagingSnapshot:MemoryCandidate[];
 extractionSnapshot:Omit<ExtractionRecord,'stagingSnapshot'>|null; authorityIds:string[]; decisions:MemoryDecision[];
 legacyModelReview?:MemoryReview; contextBinding?:CompactContextRefreshBinding;
}
export type InitializedMemoryDraft = Draft & Required<Pick<Draft,'memoryReviewSchema'|'memoryCandidatesSnapshot'|'memoryDecisions'|'memoryDecisionHistory'|'memoryArchives'|'memoryAuthorities'|'memoryBindingSnapshots'|'memoryReviewEpoch'>>;

export interface ProseCounts {han:number; characters:number; paragraphs:number}
export type RevisionLengthBounds = Partial<Record<'hanMin'|'hanMax'|'paragraphsMin'|'paragraphsMax',number>>;
export interface RevisionSnapshot {id:string; textSnapshot:string; contextSnapshot:Context}
export interface RevisionBinding {
 protocol:'author-directed-revision-v1'; projectId:string; draftId:string; runId:string; chapterId:string;
 stateVersion:number; draftRevision:number; snapshotId:string; instruction:string; instructionVersion:number;
}
export interface RevisionResult {text:string; chapterId:string; provider:{id:string; isLive:true; [key:string]:unknown}}
export interface RevisionProposal {
 id:string; status:'requesting'|'proposed'|'failed'|'cancelled'|'stale'|'discarded'|'adopted'; binding:RevisionBinding;
 beforeCounts:ProseCounts; result:RevisionResult|null; resultSnapshot:RevisionResult|null; afterCounts:ProseCounts|null;
 adoptedRevision?:number; adoption?:{modelResultHash:string; authority:'explicit_model_adoption'|'explicit_author_edit'; textHash:string; counts:ProseCounts; lengthBounds:RevisionLengthBounds};
}
export type InitializedRevisionDraft = Draft & Required<Pick<Draft,'revisionProposals'|'revisionSnapshots'|'revisionInstruction'|'revisionInstructionVersion'|'proseVersions'>> & {chapterId:string};
export type IntentField = {status:'missing'|'invalid';value:null}|{status:'present'|'empty';value:string};
export interface GenerationIntentCapture {
 protocol:'generation-intent-v1'; boundary:'app-generation-input'; projectId:string; chapterId:string;
 chapterIndex:number; chapterRevision:number; stateVersion:number; source:string; goal:IntentField; exitState:IntentField;
}
export interface GenerationIntentRecord extends GenerationIntentCapture {draftId:string; runId:string; draftRevision:1}
export type GenerationIntent = GenerationIntentRecord;
