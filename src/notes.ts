import joplin from 'api';

import { logInfo, logWarn } from './logger';
import { polishTranscript } from './polish';
import { DictateConfig, NoteCreateOptions, NoteCreationStatusCallback, NOTEBOOK_DEFAULT, NOTEBOOK_PICK } from './types';

export interface CreatedNote {
	id: string;
	title: string;
	body: string;
	parentId?: string;
	isTodo: boolean;
	dueHuman?: string;
	/** True when polish was enabled but failed; note body is the raw transcript. */
	rawFallback?: boolean;
}

function formatDictationTimestamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function deriveNoteTitle(text: string): string {
	const firstLine = text.split('\n').find((line) => line.trim().length > 0) ?? '';
	const title = firstLine.trim().slice(0, 80);
	return title.length > 0 ? title : `Dictation ${formatDictationTimestamp(new Date())}`;
}

export function parseDueDate(raw: string): { todoDue: number; human: string } {
	const trimmed = raw.trim();
	const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
	if (!match) {
		throw new Error(`Could not parse due date: ${raw}`);
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const date = new Date(year, month - 1, day, hour, minute, 0, 0);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Could not parse due date: ${raw}`);
	}

	return {
		todoDue: date.getTime(),
		human: formatDueHuman(date),
	};
}

function formatDueHuman(date: Date): string {
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${hh}:${mm}`;
}

function defaultParentFromConfig(config: DictateConfig): string | undefined {
	const fallback = config.defaultParentId.trim();
	return fallback.length > 0 ? fallback : undefined;
}

export async function resolveParentFolderId(
	config: DictateConfig,
	overrideParentId?: string,
): Promise<string | undefined> {
	const override = overrideParentId?.trim();
	if (override && override !== NOTEBOOK_PICK && override !== NOTEBOOK_DEFAULT) {
		return override;
	}

	if (override === NOTEBOOK_DEFAULT) {
		return defaultParentFromConfig(config);
	}

	if (config.useSelectedNotebook) {
		const folder = await joplin.workspace.selectedFolder();
		if (folder?.id) {
			return folder.id;
		}
	}

	return defaultParentFromConfig(config);
}

async function saveNoteFromBody(
	config: DictateConfig,
	body: string,
	options: NoteCreateOptions,
	rawFallback = false,
): Promise<CreatedNote> {
	const title = options.title?.trim()
		? options.title.trim().slice(0, 80)
		: deriveNoteTitle(body);
	let isTodo = options.isTodo;
	let dueHuman: string | undefined;
	let todoDue: number | undefined;
	let noteBody = body;

	if (options.due?.trim()) {
		const parsed = parseDueDate(options.due);
		todoDue = parsed.todoDue;
		dueHuman = parsed.human;
		isTodo = true;
		noteBody = `Due: ${dueHuman}\n\n${body}`;
	}

	const parentId = await resolveParentFolderId(config, options.parentId);

	const payload: Record<string, unknown> = {
		title,
		body: noteBody,
	};

	if (parentId) {
		payload.parent_id = parentId;
	}

	if (isTodo) {
		payload.is_todo = 1;
	}

	if (todoDue !== undefined) {
		payload.todo_due = todoDue;
	}

	const created = await joplin.data.post(['notes'], null, payload);
	const id = created?.id as string | undefined;
	if (!id) {
		throw new Error('Joplin did not return a note ID after creation.');
	}

	logInfo('Note created', {
		id,
		title,
		parentId,
		isTodo,
		dueHuman,
		rawFallback,
	});

	return {
		id,
		title: (created?.title as string | undefined) ?? title,
		body: noteBody,
		parentId,
		isTodo,
		dueHuman,
		rawFallback: rawFallback || undefined,
	};
}

export async function processNoteCreation(
	config: DictateConfig,
	rawText: string,
	options: NoteCreateOptions = { isTodo: false },
	statusCallback: NoteCreationStatusCallback = () => {},
): Promise<CreatedNote> {
	const text = rawText.trim();
	if (text.length === 0) {
		throw new Error('No speech detected.');
	}

	if (!config.polishEnabled) {
		await statusCallback('Creating note…');
		return saveNoteFromBody(config, text, options);
	}

	await statusCallback('Polishing transcript…');
	let polished: string;
	try {
		polished = await polishTranscript(config, text);
	} catch (error) {
		logWarn('Polish failed; saving raw transcript', error);
		await statusCallback('Polish failed — saving raw transcript…');
		return saveNoteFromBody(config, text, options, true);
	}

	await statusCallback('Polishing complete. Saving note…');
	return saveNoteFromBody(config, polished, options);
}

export async function createNoteFromTranscript(
	config: DictateConfig,
	rawText: string,
	options: NoteCreateOptions = { isTodo: false },
): Promise<CreatedNote> {
	return processNoteCreation(config, rawText, options);
}

export async function openCreatedNote(noteId: string): Promise<void> {
	try {
		await joplin.commands.execute('openNote', noteId);
	} catch {
		// Opening the note is helpful but not required for creation to succeed.
	}
}
