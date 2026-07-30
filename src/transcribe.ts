import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { filterTranscript } from './transcript';
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

	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dictate-txt-'));
	const txtBase = path.join(tempDir, 'recording');

	try {
		await runWhisperCli(config, wavPath, txtBase);

		const transcriptPath = `${txtBase}.txt`;
		const raw = await fs.readFile(transcriptPath, 'utf8');
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

function runWhisperCli(
	config: DictateConfig,
	wavPath: string,
	txtBase: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			config.whisperBin,
			[
				'-m', config.whisperModel,
				'-f', wavPath,
				'-otxt',
				'-of', txtBase,
				'-nt',
			],
			{ stdio: ['ignore', 'ignore', 'pipe'] },
		);

		let stderr = '';
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			const detail = stderr.trim();
			reject(new Error(
				detail.length > 0
					? `whisper-cli failed: ${detail}`
					: `whisper-cli failed with exit code ${code ?? 'unknown'}`,
			));
		});
	});
}
