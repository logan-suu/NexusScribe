import type {AuthoringInput, StoryPlan, GenerationRequest} from '../authoring/types.js';
export type Action = 'interview'|'planStory'|'generateChapter'|'generateProse'|'extractMemory'|'auditMemoryCandidate'|'reviseProse'|'interpretRevision'|'reviewChapter';
export interface RequestOptions {signal?: AbortSignal}
/** Only configured is validated by the status endpoint boundary. */
export interface ProviderStatus {configured: boolean; [key:string]: unknown}
export interface InterviewQuestionOutput {key: string; title: string; options?: string[]; [key:string]: unknown}
/** The legacy endpoint checks text only; chapter identity and metadata stay unknown. */
export interface LegacyChapterOutput {text: string; [key:string]: unknown}
export interface ProseOutput extends LegacyChapterOutput {chapterId: string}
export interface MemoryOutput {staging: {label: string; sourceParagraphIndex: number; sourceQuote: string; sourceStart: number; sourceEnd: number}[]; reviewNotes: string[]; [key:string]: unknown}
export interface AuditOutput {status: 'supported'|'unsupported'|'unknown'; explanation: string; [key:string]: unknown}
/** At least one of operations/suggestedFacts is an array; the other is unchecked. */
export interface InterpretationOutput {questions: unknown[]; [key:string]: unknown}
export interface ReviewOutput {issues: unknown[]; [key:string]: unknown}
export interface ActionOutputMap {
 interview: {questions: InterviewQuestionOutput[]; [key:string]: unknown};
 planStory: StoryPlan;
 generateChapter: LegacyChapterOutput;
 generateProse: ProseOutput;
 reviseProse: ProseOutput;
 extractMemory: MemoryOutput;
 auditMemoryCandidate: AuditOutput;
 interpretRevision: InterpretationOutput;
 reviewChapter: ReviewOutput;
}
export interface ProviderAdapter {
 id: string; label?: string; isLive?: boolean;
 interview(input: {input: AuthoringInput}, options?: RequestOptions): Promise<ActionOutputMap['interview']>;
 planStory(input: {input: AuthoringInput}, options?: RequestOptions): Promise<StoryPlan>;
 generateChapter(input: GenerationRequest, options?: RequestOptions): Promise<LegacyChapterOutput>;
 // Injected/template generation can omit a chapter ID; the server adapter narrows it.
 generateProse(input: GenerationRequest, options?: RequestOptions): Promise<LegacyChapterOutput>;
 reviseProse(input: unknown, options?: RequestOptions): Promise<ProseOutput>;
 extractMemory(input: unknown, options?: RequestOptions): Promise<MemoryOutput>;
 auditMemoryCandidate(input: unknown, options?: RequestOptions): Promise<AuditOutput>;
 interpretRevision(input: unknown, options?: RequestOptions): Promise<InterpretationOutput>;
 reviewChapter(input: unknown, options?: RequestOptions): Promise<ReviewOutput>;
}
export interface ServerProvider extends ProviderAdapter {
 getStatus(options?: RequestOptions): Promise<ProviderStatus>;
 generateProse(input: GenerationRequest, options?: RequestOptions): Promise<ProseOutput>;
}
