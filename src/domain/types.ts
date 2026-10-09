/** Concrete contracts for the persisted v1 story schema. Runtime import/provider validation remains authoritative. */
import type {
  MemoryDecision, MemoryArchive, MemoryAuthority, MemoryBindingSnapshot, MemorySupport,
  MemoryLedgerEntry, MemoryCheck, MemoryBinding, RevisionProposal, RevisionSnapshot,
  GenerationIntentRecord, GenerationIntentCapture, MemorySupportState, MemorySupportResult, CompactQuoteCard, MemoryAttestation,
} from './review-types.js';
export type * from './review-types.js';

export interface Paragraph { id: string; text: string; index?: number; start?: number; end?: number }
export interface ProseParagraph extends Paragraph { index: number; start: number; end: number }
export interface RevisionRecord { id: string; revision: number; text: string; hash: string; paragraphs: Paragraph[] }
export interface ProseVersion { revision: number; text: string; textHash: string; paragraphs: ProseParagraph[] }
export type ChapterStatus = 'ACCEPTED' | 'DRAFT' | 'PLANNED';
export type SyncStatus = 'CLEAN' | 'PENDING' | 'NEEDS_REVIEW';
export interface Chapter { id: string; title: string; text: string; revision: number; syncedRevision: number; status: ChapterStatus; syncStatus: SyncStatus; revisions: RevisionRecord[] }
export interface SourceAnchor { chapterId: string; revision: number; revisionId?: string; paragraphId?: string; quote: string; start?: number; end?: number }
export interface CanonFact { statement?:string; description?:string; text?:string; id: string; projectId?: string; subject: string; predicate: string; value: string; label: string; status: 'confirmed' | 'superseded'; recordVersion: number; validStoryFrom?: string; authority?: 'explicit_author_decision'; source: SourceAnchor; supersedesVersion?: number; recordedFromVersion?: number; recordedToVersion?: number }
export type Fact = CanonFact;
export interface Knowledge { id: string; holder: string; proposition: string; status: 'explicitly_unaware' | 'knows' | 'unsupported'; label: string; supportSets: string[][]; at?: number }
export interface Evidence extends SourceAnchor { status?:string; title?:string; description?:string; id: string; label: string; active: boolean; storyTime: number }
export interface Plan { label?:string; id: string; title: string; chapter: number; description: string; condition: 'never_met' | 'police_unaware' | 'independent' | 'address_support' | 'author_outline'; status: 'valid' | 'invalid' | 'needs_review' | 'ready'; reason?: string }
export interface MemoryCandidate { id: string; label: string; status: 'proposed'; sourceQuote: string; sourceParagraphIndex?: number; sourceParagraphId?: string; sourceStart?: number; sourceEnd?: number; acquiredScene?: number; usedScene?: number }
export type Candidate = MemoryCandidate;
export interface StoryEvent { id: string; label: string; status: 'confirmed'; source: SourceAnchor; storyTime?: string; draftId?: string; originalLabel?: string; memoryKind?: 'textual_excerpt' | 'author_attested_paraphrase'; memoryTrust?: 'textual_presence_only' | 'author_attested_unverified'; memoryDecision?: MemoryDecision; sourceParagraphIndex?: number; sourceParagraphId?: string; sourceStart?: number; sourceEnd?: number; acquiredScene?: number; usedScene?: number }
export interface Disclosure { id: string; proposition: string; audience: string; status: 'explicit'; source: SourceAnchor }
export interface DerivedRecord { id?: string; chapterId: string; revision: number; status: 'valid' | 'stale'; text?: string; summary?: string }
export interface OutlineEntry { id?: string; title?: string; description?: string; goal?: string; exitState?: string; [key: string]: unknown }
export interface ConstitutionField { key: string; value?: unknown; [key: string]: unknown }
export interface AuthorContract { fields?: ConstitutionField[]; title?: unknown; premise?: unknown; protagonist?: unknown; emotionalDirection?: unknown; pov?: unknown; desire?: unknown; boundaries?: unknown; [key: string]: unknown }
export interface ProjectConfig { projectId?: string; title?: string; premise?: string; idea?: string; protagonist?: string; tone?: string; pov?: string; goal?: string; boundaries?: string; constraints?: string[]; outline?: (string | OutlineEntry)[]; chapters?: { title?: string; text?: string }[]; contract?: AuthorContract; [key: string]: unknown }
export interface AuthorConstitution { title?: unknown; idea?: unknown; protagonist?: unknown; tone?: unknown; pov?: unknown; goal?: unknown; boundaries?: unknown; contract?: AuthorContract }
export interface SupportResult { status: 'supported' | 'unsupported'; validPaths: string[][]; sourceIds: string[]; explanation?: string }
export interface ContextSource { chapterId: string; chapterIndex?: number; revision: number; revisionId?: string; text: string; channel?: 'planning_text' | 'original_text'; chapterStatus?: ChapterStatus; syncStatus?: SyncStatus; role?: 'accepted_manuscript' | 'planned_content' | 'unaccepted_manuscript' }
export interface ContextMemoryAnchor { chapterId: string; revision: number; paragraphId: string; start: number; end: number }
export interface ContextMemoryEvent { id: string; label: string; kind: 'textual_excerpt' | 'author_attested_paraphrase' | 'legacy_unverified_paraphrase'; trust: 'textual_presence_only' | 'author_attested_unverified' | 'historical_unverified'; memoryDecision: { action: MemoryDecision['action']; assessment: MemoryDecision['assessment']; advisory: boolean }; source: Omit<SourceAnchor,'quote'>; contextBefore?: ContextMemoryAnchor | null; contextAfter?: ContextMemoryAnchor | null }
export interface MemoryContextPolicy { policy: string; included: number; staleSource: number; unverifiedSelection: number; omittedByLimit: number; maxBytes: number; maxEntries: number }
export interface Context { constitution?: AuthorConstitution; contextSchemaVersion?: number; projectId: string; version: number; view: 'writer'; sceneTime: number | null; pov: string; facts: CanonFact[]; knowledge: Knowledge[]; events: ContextMemoryEvent[]; memoryContext: MemoryContextPolicy; forbiddenReveals: string[]; plans: Plan[]; obligations: {id: string; label: string; status: 'OPEN'}[]; sources: ContextSource[]; summaries: DerivedRecord[]; support: SupportResult; staging: MemoryCandidate[] }
export interface AuthorInstruction { intent: 'local_prose' | 'author_fact'; statement?: string; targetFactId?: string }
export type PatchOperation =
 | { op: 'set_relationship'; targetId: string; expectedRecordVersion: number; value: string; validStoryFrom: string; source: SourceAnchor }
 | { op: 'remove_evidence'; targetId: string }
 | { op: 'supersede_author_fact'; targetId: string; expectedRecordVersion: number; statement: string; source: SourceAnchor }
 | { op: 'append_author_fact'; statement: string; source: SourceAnchor };
export interface Patch { id: string; projectId: string; baseVersion: number; chapterId: string; revision: number; textHash: string; intents: string[]; scope: 'chapter' | 'story'; status: 'proposed' | 'noop' | 'blocked'; summary: string; operations: PatchOperation[]; questions: string[]; evidence: SourceAnchor[]; authorInstruction?: AuthorInstruction; instructionHash?: string }
export interface CanonSnapshot { facts: CanonFact[]; knowledge: Knowledge[]; evidence: Evidence[]; plans: Plan[]; events: StoryEvent[]; disclosures: Disclosure[] }
export interface ManualSource { protocol: 'manual-chapter-v1'; authority: 'explicit_author_selection'; projectId: string; chapterId: string; revision: number; textHash: string; textSnapshot: string; patchId: string }
export interface AcceptanceRecord { protocol: 'manual-chapter-v1' | 'prose-only-v1'; authority: 'explicit_author_decision'; draftRevision: number; textHash: string; textSnapshot: string; sourceRevision?: number; memoryExtraction: ExtractionRecord['status']; extractionAttempt?: number; semanticStatus: 'model_reviewed_unverified' | 'not_evaluated' }
export interface Commit { toVersion?:number; type?:string; id: string; kind: 'patch' | 'draft_accept' | 'compensation'; version: number; summary: string; before: CanonSnapshot; after: CanonSnapshot; dependencies: string[]; chapterId?: string; revision?: number; patchId?: string; patchHash?: string; draftId?: string; undoes?: string; authorInstruction?: AuthorInstruction; authority?: 'explicit_author_decision'; authorTextHash?: string; authorTextSnapshot?: string; operations?: PatchOperation[]; manualSource?: ManualSource; acceptance?: AcceptanceRecord; factDecisions?: FactDecision[]; memoryDecisions?: MemoryDecision[]; memoryCandidateIds?: string[]; memoryAuthorityIds?: string[] }
export interface ProviderInfo { id: string; isLive?: boolean; label?: string; model?: string; [key: string]: unknown }
export type Provider = string | ProviderInfo;
export interface StructuralIssue { ruleId: string; severity: 'error'; explanation: string; certainty: 'deterministic'; suggestedAction: string }
export interface StructuralReview { valid?:boolean; errors?:(string|{message?:string;explanation?:string})[]; stateVersion: number; chapterId: string; stagingHash: string; stagingSnapshot: MemoryCandidate[]; textSnapshot: string; textHash: string; revision: number; issues: StructuralIssue[]; passed: boolean; checks: string[]; semanticStatus: 'not_evaluated' | 'fixture_rules_only'; limitations: string[]; binding?: MemoryBinding }
export type FactAssessment = 'consistent' | 'contradiction' | 'not_applicable' | 'unknown';
export interface FactCheck { factId: string; recordVersion: number; status: FactAssessment; explanation: string; sourceQuote: string }
export interface FactLedgerEntry extends FactCheck { factLabel: string; factSource: SourceAnchor | null; provenanceValid: boolean; assessmentOrigin: 'model' | 'missing'; candidate: { draftId: string; runId: string; revision: number }; blocking: boolean; stale?: boolean }
export interface FactDecision { factId: string; recordVersion: number; action: 'accept_exception'; reason: string; binding: ReviewBinding; reviewHash: string; factSource: SourceAnchor | null; sourceQuote: string; assessment: FactAssessment; authority: 'explicit_author_decision' }
export interface FactDecisionInstruction { factId: string; recordVersion: number; action: 'accept_exception'; reason: string; reviewHash: string }
export interface SemanticIssue { severity: 'error' | 'warning'; explanation: string; sourceQuote: string }
export interface SemanticReviewReport { summary: string; issues: SemanticIssue[]; checks: string[]; provider: Provider; factChecks?: FactCheck[]; memoryChecks?: MemoryCheck[] }
export interface ModelReview extends SemanticReviewReport { binding: MemoryBinding; factChecks: FactCheck[]; factLedger: FactLedgerEntry[]; memoryChecks: MemoryCheck[]; memoryLedger: Pick<MemoryLedgerEntry,'candidateId'|'status'|'explanation'|'assessmentOrigin'>[]; stateVersion: number; draftRevision: number; textHash: string; chapterId: string; stagingHash: string; chapterRevisions: Record<string,number>; semanticStatus: 'model_reviewed_unverified'; advisory: true; limitations: string[] }
export type MemoryReview = StructuralReview | ModelReview;
export interface ExtractionBinding { projectId: string; draftId: string; runId: string; chapterId: string; stateVersion: number; draftRevision: number; textHash: string; chapterRevisions: Record<string,number>; contextHash: string; attempt: number; requestId: string; textSnapshot: string }
export interface ExtractionRecord { status: 'pending' | 'complete' | 'failed' | 'cancelled' | 'skipped'; attempt: number; binding: ExtractionBinding | null; provider?: Provider; reviewNotes?: string[]; stagingHash?: string; stagingSnapshot?: MemoryCandidate[]; error?: string; authority?: 'explicit_author_decision' }
export interface ReviewBinding { projectId: string; draftId: string; runId: string; chapterId: string; stateVersion: number; draftRevision: number; textHash: string; stagingHash: string; chapterRevisions: Record<string,number>; contextHash: string; textSnapshot: string; stagingSnapshot: MemoryCandidate[]; contextSnapshot: Context; memoryReviewEpoch: number; extractionAttempt?: number; extractionHash?: string; extractionSnapshot?: ExtractionRecord }
export interface Draft { id: string; projectId: string; runId: string; chapterId?: string; revision: number; baseVersion: number; chapterRevisions: Record<string,number>; status: 'DRAFT' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED'; text: string; textHash: string; provider: string; providerInfo?: ProviderInfo | null; requiresSemanticReview?: boolean; staging: MemoryCandidate[]; context: Context; review: StructuralReview | null; modelReview?: ModelReview | null; requiresExtraction?: boolean; proseVersions?: ProseVersion[]; extraction?: ExtractionRecord; manualSource?: ManualSource; factDecisions?: FactDecision[]; memoryReviewSchema?: 1; memoryCandidatesSnapshot?: MemoryCandidate[]; memoryDecisions?: MemoryDecision[]; acceptedMemoryDecisions?: MemoryDecision[]; memoryDecisionHistory?: MemoryDecision[]; memoryArchives?: MemoryArchive[]; memoryAuthorities?: MemoryAuthority[]; memoryBindingSnapshots?: MemoryBindingSnapshot[]; memoryReviewEpoch?: number; memorySupport?: MemorySupport; revisionInstruction?: string; revisionInstructionVersion?: number; revisionProposals?: RevisionProposal[]; revisionSnapshots?: RevisionSnapshot[]; generationIntent?: GenerationIntentRecord }
export interface ProseDraft extends Draft { chapterId: string; requiresExtraction: true; requiresSemanticReview: boolean; proseVersions: ProseVersion[]; extraction: ExtractionRecord }
export interface ManualDraft extends ProseDraft { manualSource: ManualSource }
export interface ProjectState extends CanonSnapshot { schemaVersion: 1; mode: 'demo' | 'custom'; projectId: string; title: string; version: number; chapters: Chapter[]; config?: ProjectConfig; preferences: unknown[]; drafts: Draft[]; commits: Commit[]; factHistory: CanonFact[]; pendingPatches: Patch[]; derived: DerivedRecord[]; sequence: number }
export type State = ProjectState;
export interface ProviderDraftResult { text: string; context: Context; chapterId?: string; provider?: Provider; staging?: {label: string; sourceQuote: string; sourceParagraphIndex?: number}[] }
export interface ExtractionEntry { label: string; sourceParagraphIndex: number; sourceQuote?: string; sourceStart?: number; sourceEnd?: number }
export interface ExtractionReport { staging: ExtractionEntry[]; reviewNotes: string[]; provider: Provider }
export type GenerationIntentInput = GenerationIntentCapture;
export type GenerationContext = Context;
export interface MemoryDecisionBinding extends ReviewBinding { memoryCandidateId: string; memorySupportAttemptId: string|null; memorySupportState: MemorySupportState; memorySupportResult: MemorySupportResult|null; memorySelectionProtocol: 'quote-grounded-memory-v1'; memoryQuoteSnapshot: CompactQuoteCard|null }
export interface MemoryDecisionInstruction { candidateId: string; action: 'keep_quote'|'reject'|'attest_keep'; reason?: string; reviewHash: string; attestation?: MemoryAttestation }
export interface MemorySupportBinding { candidateId: string; attemptId: string; reviewAuthorityId: string; reviewBinding: ReviewBinding }
