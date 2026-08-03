export interface DictateConfig {
	whisperDir: string;
	whisperModel: string;
	whisperBin: string;
	llmUrl: string;
	llmModel: string;
	polishEnabled: boolean;
	useSelectedNotebook: boolean;
	defaultParentId: string;
}

export interface DictateFolder {
	id: string;
	title: string;
}

export interface NoteCreateOptions {
	/** Notebook ID, or sentinel values `__pick__` / `__default__` for no explicit folder. */
	parentId?: string;
	/** Optional note/to-do title; auto-derived from transcript when empty. */
	title?: string;
	isTodo: boolean;
	/** Local date/time as `YYYY-MM-DD HH:MM`. */
	due?: string;
}

export const NOTEBOOK_PICK = '__pick__';
export const NOTEBOOK_DEFAULT = '__default__';

/** Receives granular note-creation status updates for UI display. */
export type NoteCreationStatusCallback = (status: string) => void | Promise<void>;
