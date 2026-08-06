import { afterEach, describe, expect, it, vi } from 'vitest';

import { polishTranscript } from '../polish';
import { DictateConfig } from '../types';

const baseConfig: DictateConfig = {
	whisperDir: '/tmp/whisper',
	whisperModel: '/tmp/model.bin',
	whisperBin: '/tmp/whisper-cli',
	llmUrl: 'http://localhost:8080',
	llmModel: 'test-model',
	llmTimeoutSec: 60,
	polishEnabled: true,
	useSelectedNotebook: false,
	defaultParentId: '',
	debugLogging: false,
};

describe('polishTranscript', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('times out using the configured LLM timeout', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
				});
			});
		}));

		const promise = polishTranscript({ ...baseConfig, llmTimeoutSec: 120 }, 'hello');
		const expectation = expect(promise).rejects.toThrow(
			'LLM request timed out after 120s (http://localhost:8080/v1/chat/completions)',
		);
		await vi.advanceTimersByTimeAsync(120_000);
		await expectation;
	});
});
