import type {Patch, State} from './domain/types.js';

/** Unsaved chapter text. An explicit undefined entry means no pending edit. */
export type Editing = Record<string, string | undefined>;

/** Project snapshots share the same persisted v1 schema as the active project. */
export interface Project {
  state: State & {importOrigin?: ImportOrigin};
  editing: Editing;
  patch?: Patch | null;
}

export interface ImportOrigin {
  projectId: string;
  original: Project;
}

/** Recovery is local runtime metadata, never trusted from serialized input. */
export interface WorkspaceRecovery {
  blocked: true;
  primaryRaw: string | null | undefined;
  message: string;
  available?: boolean;
  error?: unknown;
}

export interface Workspace extends Project {
  format: 1;
  serial: number;
  providerMode?: 'template' | 'server';
  archived?: Project[];
  recovery?: WorkspaceRecovery;
}

export type ProjectRecord = Project;
