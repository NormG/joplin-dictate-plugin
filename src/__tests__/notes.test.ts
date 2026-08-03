import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DictateConfig } from '../types';

vi.mock('../polish', () => ({
	polishTranscript: vi.fn(async (_config: DictateConfig, text: string) => `polished: ${text}`),
}));

import { deriveNoteTitle, parseDueDate, processNoteCreation } from '../notes';
import { polishTranscript } from '../polish';

const baseConfig: DictateConfig = {
	whisperDir: '/tmp/whisper',
	whisperModel: '/tmp/model.bin',
	whisperBin: '/tmp/whisper-cli',
	llmUrl: 'http://localhost:8080',
	llmModel: 'test-model',
	polishEnabled: false,
	useSelectedNotebook: false,
	defaultParentId: 'folder-default',
};

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
