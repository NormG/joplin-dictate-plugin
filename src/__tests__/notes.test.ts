import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DictateConfig } from '../types';

vi.mock('../polish', () => ({
	polishTranscript: vi.fn(async (_config: DictateConfig, text: string) => `polished: ${text}`),
}));

import { deriveNoteTitle, parseDueDate, processNoteCreation, resolveParentFolderId } from '../notes';
import { NOTEBOOK_DEFAULT, NOTEBOOK_PICK } from '../types';
import { polishTranscript } from '../polish';
import joplin from 'api';

const baseConfig: DictateConfig = {
	whisperDir: '/tmp/whisper',
	whisperModel: '/tmp/model.bin',
	whisperBin: '/tmp/whisper-cli',
	llmUrl: 'http://localhost:8080',
	llmModel: 'test-model',
	polishEnabled: false,
	useSelectedNotebook: false,
	defaultParentId: 'folder-default',
	debugLogging: false,
};

describe('resolveParentFolderId', () => {
	beforeEach(() => {
		vi.mocked(joplin.workspace.selectedFolder).mockReset();
		vi.mocked(joplin.workspace.selectedFolder).mockResolvedValue(null);
	});

	it('uses defaultParentId when user selects the default notebook sentinel', async () => {
		vi.mocked(joplin.workspace.selectedFolder).mockResolvedValue({ id: 'selected-folder', title: 'Selected' });

		const parentId = await resolveParentFolderId(
			{ ...baseConfig, useSelectedNotebook: true, defaultParentId: 'folder-default' },
			NOTEBOOK_DEFAULT,
		);

		expect(parentId).toBe('folder-default');
		expect(joplin.workspace.selectedFolder).not.toHaveBeenCalled();
	});

	it('uses selected folder for pick sentinel when useSelectedNotebook is enabled', async () => {
		vi.mocked(joplin.workspace.selectedFolder).mockResolvedValue({ id: 'selected-folder', title: 'Selected' });

		const parentId = await resolveParentFolderId(
			{ ...baseConfig, useSelectedNotebook: true, defaultParentId: 'folder-default' },
			NOTEBOOK_PICK,
		);

		expect(parentId).toBe('selected-folder');
	});
});

describe('deriveNoteTitle', () => {
	it('uses the first non-empty line', () => {
		expect(deriveNoteTitle('Hello world\nsecond line')).toBe('Hello world');
	});
});

describe('parseDueDate', () => {
	it('parses YYYY-MM-DD HH:MM', () => {
		const result = parseDueDate('2026-08-15 09:00');
		expect(result.todoDue).toBe(new Date(2026, 7, 15, 9, 0, 0, 0).getTime());
		expect(result.human).toMatch(/15 Aug 2026 09:00/);
	});

	it('rejects invalid input', () => {
		expect(() => parseDueDate('not-a-date')).toThrow(/Could not parse due date/);
	});
});

describe('Mandatory Raw Save Fallback Test', () => {
	beforeEach(() => {
		vi.mocked(polishTranscript).mockClear();
		vi.mocked(joplin.data.post).mockClear();
		vi.mocked(joplin.data.post).mockImplementation(async (_path, _query, payload) => ({
			id: 'note-test-id',
			title: payload.title,
		}));
	});

	it('saves the original raw transcript when LLM polish fails (API error)', async () => {
		vi.mocked(polishTranscript).mockRejectedValueOnce(new Error('LLM server returned 503'));

		const statuses: string[] = [];
		const note = await processNoteCreation(
			{ ...baseConfig, polishEnabled: true },
			'Meeting notes about the Q3 roadmap.',
			{ isTodo: false, parentId: 'folder-1' },
			async (status) => { statuses.push(status); },
		);

		expect(statuses).toEqual([
			'Polishing transcript…',
			'Polish failed — saving raw transcript…',
		]);
		expect(note.body).toBe('Meeting notes about the Q3 roadmap.');
		expect(note.rawFallback).toBe(true);
	});

	it('saves the original raw transcript when LLM polish times out', async () => {
		vi.mocked(polishTranscript).mockRejectedValueOnce(
			new Error('LLM request timed out after 60s (http://localhost:8080/v1/chat/completions)'),
		);

		const note = await processNoteCreation(
			{ ...baseConfig, polishEnabled: true },
			'can u meet next week?',
			{ isTodo: false, parentId: 'folder-1' },
		);

		expect(note.body).toBe('can u meet next week?');
		expect(note.rawFallback).toBe(true);
	});

	it('does not fall back when polished note save fails', async () => {
		vi.mocked(joplin.data.post).mockResolvedValueOnce({ title: 'polished title' });

		await expect(processNoteCreation(
			{ ...baseConfig, polishEnabled: true },
			'Raw transcript',
			{ isTodo: false, parentId: 'folder-1' },
		)).rejects.toThrow('Joplin did not return a note ID after creation.');

		expect(joplin.data.post).toHaveBeenCalledOnce();
	});
});

describe('processNoteCreation status callbacks', () => {
	beforeEach(() => {
		vi.mocked(polishTranscript).mockClear();
	});

	it('emits Creating note… when polish is disabled', async () => {
		const statuses: string[] = [];

		const note = await processNoteCreation(
			baseConfig,
			'Plain transcript',
			{ isTodo: false, parentId: 'folder-1' },
			async (status) => { statuses.push(status); },
		);

		expect(statuses).toEqual(['Creating note…']);
		expect(note.id).toBe('note-test-id');
		expect(note.body).toBe('Plain transcript');
		expect(polishTranscript).not.toHaveBeenCalled();
	});

	it('emits polish statuses before and after LLM polish', async () => {
		const statuses: string[] = [];

		const note = await processNoteCreation(
			{ ...baseConfig, polishEnabled: true },
			'Raw transcript',
			{ isTodo: false, parentId: 'folder-1' },
			async (status) => { statuses.push(status); },
		);

		expect(statuses).toEqual([
			'Polishing transcript…',
			'Polishing complete. Saving note…',
		]);
		expect(polishTranscript).toHaveBeenCalledOnce();
		expect(note.body).toBe('polished: Raw transcript');
	});

	it('throws on empty transcript', async () => {
		await expect(processNoteCreation(baseConfig, '   ', { isTodo: false }))
			.rejects.toThrow('No speech detected.');
	});
});
