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

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
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
