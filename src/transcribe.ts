import { promises as fs } from 'fs';
import * as path from 'path';

import { createTempDir, delay, pathExists } from './fsUtils';
import { filterTranscript } from './transcript';
import { logInfo } from './logger';
import { runCommand } from './processUtils';
import { DictateConfig } from './types';
import { assertDictateReady } from './validate';

export interface TranscriptionResult {
	raw: string;
	text: string;
	wavPath: string;
	transcriptPath: string;
}

export async function transcribeWav(
	config: DictateConfig,
	wavPath: string,
): Promise<TranscriptionResult> {
	await assertDictateReady(config);

	const tempDir = await createTempDir('dictate-txt-');
	const txtBase = path.join(tempDir, 'recording');

	try {
		logInfo('Running whisper-cli', {
			bin: config.whisperBin,
			model: config.whisperModel,
			wavPath,
		});
		await runWhisperCli(config, wavPath, txtBase);

		const { path: transcriptPath, raw } = await readWhisperTranscript(txtBase, tempDir);
		const text = filterTranscript(raw);

		return {
			raw,
			text,
			wavPath,
			transcriptPath,
		};
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}

// whisper-cli occasionally reports success a beat before its output file is
// visible on disk (and may use a slightly different name). Poll for the
// expected file, fall back to any .txt in the temp dir, and finally treat a
// missing file as an empty transcript rather than throwing ENOENT.
async function readWhisperTranscript(
	txtBase: string,
	tempDir: string,
): Promise<{ path: string; raw: string }> {
	const expected = `${txtBase}.txt`;
	const maxAttempts = 20;
	const delayMs = 100;

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		if (await pathExists(expected)) {
			return { path: expected, raw: await fs.readFile(expected, 'utf8') };
		}

		const entries = await fs.readdir(tempDir).catch(() => [] as string[]);
		const txtName = entries.find((name) => name.endsWith('.txt'));
		if (txtName) {
			const found = path.join(tempDir, txtName);
			return { path: found, raw: await fs.readFile(found, 'utf8') };
		}

		await delay(delayMs);
	}

	return { path: expected, raw: '' };
}

function runWhisperCli(
	config: DictateConfig,
	wavPath: string,
	txtBase: string,
): Promise<void> {
	return runCommand(
		config.whisperBin,
		[
			'-m', config.whisperModel,
			'-f', wavPath,
			'-otxt',
			'-of', txtBase,
			'-nt',
		],
		{ errorLabel: 'whisper-cli' },
	);
}
