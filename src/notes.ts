import joplin from 'api';

import { polishTranscript } from './polish';
import { DictateConfig } from './types';

export interface CreatedNote {
	id: string;
	title: string;
	body: string;
	parentId?: string;
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

export async function resolveParentFolderId(config: DictateConfig): Promise<string | undefined> {
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
): Promise<CreatedNote> {
	const text = rawText.trim();
	if (text.length === 0) {
		throw new Error('No speech detected.');
	}

	let body = text;
	if (config.polishEnabled) {
		body = await polishTranscript(config, text);
	}

	const title = deriveNoteTitle(body);
	const parentId = await resolveParentFolderId(config);

	const payload: Record<string, unknown> = {
		title,
		body,
	};

	if (parentId) {
		payload.parent_id = parentId;
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
	};
}

export async function openCreatedNote(noteId: string): Promise<void> {
	try {
		await joplin.commands.execute('openNote', noteId);
	} catch {
		// Opening the note is helpful but not required for creation to succeed.
	}
}
