import { ChildProcessWithoutNullStreams, spawn, SpawnOptions } from 'child_process';

export function captureProcessStderr(child: ChildProcessWithoutNullStreams): () => string {
	let stderr = '';

	child.stderr.on('data', (chunk: Buffer) => {
		stderr += chunk.toString();
	});

	child.on('error', (error) => {
		stderr = stderr || error.message;
	});

	return () => stderr;
}

export function runCommand(
	command: string,
	args: string[],
	options: { errorLabel?: string; spawnOptions?: SpawnOptions } = {},
): Promise<void> {
	const errorLabel = options.errorLabel ?? command;

	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ['ignore', 'ignore', 'pipe'],
			...options.spawnOptions,
		});

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
					? `${errorLabel} failed: ${detail}`
					: `${errorLabel} failed with exit code ${code ?? 'unknown'}`,
			));
		});
	});
}
