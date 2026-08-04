import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { logDebug, logInfo } from './logger';

const STOP_TIMEOUT_MS = 5000;

export class RecordingSession {
	private readonly tempDir: string;
	private readonly wavPath: string;
	private child: ChildProcessWithoutNullStreams | null = null;
	private stderr = '';
	private _isPaused = false;

	constructor(tempDir: string, wavPath: string) {
		this.tempDir = tempDir;
		this.wavPath = wavPath;
	}

	get wavFile(): string {
		return this.wavPath;
	}

	get isActive(): boolean {
		return this.child !== null;
	}

	get isPaused(): boolean {
		return this._isPaused;
	}

	pause(): void {
		if (this.child && !this._isPaused) {
			this.child.kill('SIGSTOP');
			this._isPaused = true;
		}
	}

	resume(): void {
		if (this.child && this._isPaused) {
			this.child.kill('SIGCONT');
			this._isPaused = false;
		}
	}

	static async start(): Promise<RecordingSession> {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dictate-'));
		const wavPath = path.join(tempDir, 'recording.wav');
		const session = new RecordingSession(tempDir, wavPath);

		session.child = spawn(
			'pw-record',
			['--format=s16', '--rate=16000', '--channels=1', wavPath],
			{ stdio: ['ignore', 'ignore', 'pipe'] },
		);

		session.child.stderr.on('data', (chunk: Buffer) => {
			session.stderr += chunk.toString();
		});

		session.child.on('error', (error) => {
			session.stderr = session.stderr || error.message;
		});

		logInfo('pw-record started', { wavPath, tempDir });
		return session;
	}

	async stop(): Promise<string> {
		if (!this.child) {
			throw new Error('Recording is not active');
		}

		if (this._isPaused) {
			this.child.kill('SIGCONT');
			this._isPaused = false;
		}

		const child = this.child;
		this.child = null;

		await terminateRecordingProcess(child);

		const wavSize = await fileSize(this.wavPath);
		if (wavSize === 0) {
			const recordErr = this.stderr.trim();
			throw new Error(
				recordErr.length > 0
					? `Recording error: ${recordErr}`
					: 'No audio captured — check microphone is connected and not muted',
			);
		}

		logInfo('Recording stopped', { wavPath: this.wavPath, bytes: wavSize });
		return this.wavPath;
	}

	async dispose(): Promise<void> {
		if (this.child) {
			if (this._isPaused) {
				this.child.kill('SIGCONT');
				this._isPaused = false;
			}
			await terminateRecordingProcess(this.child);
			this.child = null;
		}

		await fs.rm(this.tempDir, { recursive: true, force: true });
		logDebug('Recording session disposed', { tempDir: this.tempDir });
	}
}

async function terminateRecordingProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
	// Note: do NOT gate on child.killed here. Node sets `killed` to true after
	// any signal is sent — including the SIGSTOP/SIGCONT used by pause/resume —
	// even though the process is still alive. Gating on it would skip SIGINT and
	// leave pw-record running, so the WAV header is never finalized (whisper then
	// decodes 0 samples). Only short-circuit when the process has actually exited.
	if (child.exitCode !== null) {
		return;
	}

	await new Promise<void>((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			resolve();
		};

		child.once('close', finish);
		child.once('error', finish);

		child.kill('SIGINT');

		setTimeout(() => {
			if (child.exitCode === null) {
				child.kill('SIGTERM');
			}
		}, 1500);

		setTimeout(() => {
			if (child.exitCode === null) {
				child.kill('SIGKILL');
			}
			finish();
		}, STOP_TIMEOUT_MS);
	});
}

async function fileSize(filePath: string): Promise<number> {
	try {
		const stats = await fs.stat(filePath);
		return stats.size;
	} catch {
		return 0;
	}
}
