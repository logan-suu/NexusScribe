import type {ProjectConfig as SavedProjectConfig, ProviderInfo, Context} from '../domain/types.js';
export type {ProviderInfo} from '../domain/types.js';
export type AuthoringKey = 'idea' | 'title' | 'protagonist' | 'tone' | 'pov' | 'goal' | 'boundaries';
export type AuthoringInput = Partial<Record<AuthoringKey, string>> & {projectId?: string};
export type NormalizedAuthoringInput = Record<AuthoringKey, string>;
export interface InterviewQuestion {[key:string]: unknown; key: string; title: string; hint?: string; placeholder?: string; options?: string[]; importance?: number}
export interface ContractField {key: string; label: string; value: string; status?: string; source?: string; [key:string]: unknown}
export interface StoryContract {schemaVersion?: unknown; fields: ContractField[]; status?: string; provenance?: unknown; [key:string]: unknown}
export interface OutlineChapter {id: string; title: string; goal: string; exitState?: string; number?: number; status?: string; provenance?: string; [key:string]: unknown}
export interface ProjectConfig extends SavedProjectConfig {idea: string; title: string; protagonist: string; tone: string; pov: string; goal: string; boundaries: string;projectId: string; outline: OutlineChapter[]; contract: StoryContract; provider: string; providerMetadata?: unknown}
/** Minimum externally validated planning proposal; all optional metadata is unknown. */
export interface StoryPlan {contract: {fields: {key: string;label: string;value: string;[key:string]: unknown}[];[key:string]: unknown}; outline: {title: string;goal: string;[key:string]: unknown}[]; [key:string]: unknown}
export interface GenerationRequest {project?: SavedProjectConfig; chapterIndex?: number; chapterId?: string; context?: Partial<Context> & {stateVersion?: number; sourceIds?: string[]}}
export interface GeneratedChapter {text: string; chapterId?: string; chapterIndex: number; provider: ProviderInfo; baseVersion: number | null; status: string; staging: {type: string; value?: string; status: string; source: string}[]; reviewNotes: string[]; contextUsed: {pov: string; tone: string; boundaries: string; sourceIds: string[]}}
export interface ChapterGenerator {generateChapter(request?: GenerationRequest): Promise<GeneratedChapter>}
