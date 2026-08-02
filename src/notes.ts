import joplin from 'api';

import { polishTranscript } from './polish';
import { DictateConfig, NoteCreateOptions, NOTEBOOK_DEFAULT, NOTEBOOK_PICK } from './types';

export interface CreatedNote {
	id: string;
	title: string;
	body: string;
	parentId?: string;
	isTodo: boolean;
	dueHuman?: string;
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

export async function resolveParentFolderId(
	config: DictateConfig,
	overrideParentId?: string,
): Promise<string | undefined> {
	const override = overrideParentId?.trim();
	if (override && override !== NOTEBOOK_PICK && override !== NOTEBOOK_DEFAULT) {
		return override;
	}

	if (config.useSelectedNotebook) {
		const folder = await joplin.workspace.selectedFolder();
		if (folder?.id) {
			return folder.id;
		}
	}

	const fallback = config.defaultParentId.trim();
	return fallback.length > 0 ? fallback : undefined;
}

export async function createNoteFromTranscript(
	config: DictateConfig,
	rawText: string,
	options: NoteCreateOptions = { isTodo: false },
): Promise<CreatedNote> {
	const text = rawText.trim();
	if (text.length === 0) {
		throw new Error('No speech detected.');
	}

	let body = text;
	if (config.polishEnabled) {
		body = await polishTranscript(config, text);
	}

	const title = options.title?.trim()
		? options.title.trim().slice(0, 80)
		: deriveNoteTitle(body);
	let isTodo = options.isTodo;
	let dueHuman: string | undefined;
	let todoDue: number | undefined;

	if (options.due?.trim()) {
		const parsed = parseDueDate(options.due);
		todoDue = parsed.todoDue;
		dueHuman = parsed.human;
		isTodo = true;
		body = `Due: ${dueHuman}\n\n${body}`;
	}

	const parentId = await resolveParentFolderId(config, options.parentId);

	const payload: Record<string, unknown> = {
		title,
		body,
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

	return {
		id,
		title: (created?.title as string | undefined) ?? title,
		body,
		parentId,
		isTodo,
		dueHuman,
	};
}

export async function openCreatedNote(noteId: string): Promise<void> {
	try {
		await joplin.commands.execute('openNote', noteId);
	} catch {
		// Opening the note is helpful but not required for creation to succeed.
	}
}
