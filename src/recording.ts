import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

const STOP_TIMEOUT_MS = 5000;

export class RecordingSession {
	private readonly tempDir: string;
	private readonly wavPath: string;
	private child: ChildProcessWithoutNullStreams | null = null;
	private stderr = '';

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

		return session;
	}

	async stop(): Promise<string> {
		if (!this.child) {
			throw new Error('Recording is not active');
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

		return this.wavPath;
	}

	async dispose(): Promise<void> {
		if (this.child) {
			await terminateRecordingProcess(this.child);
			this.child = null;
		}

		await fs.rm(this.tempDir, { recursive: true, force: true });
	}
}

async function terminateRecordingProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
	if (child.killed || child.exitCode !== null) {
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
			if (!child.killed && child.exitCode === null) {
				child.kill('SIGTERM');
			}
		}, 1500);

		setTimeout(() => {
			if (!child.killed && child.exitCode === null) {
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
