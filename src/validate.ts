import { pathExists } from './fsUtils';
import { DictateConfig } from './types';

export class DictateSetupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DictateSetupError';
	}
}

async function commandExists(command: string): Promise<boolean> {
	const pathEntries = (process.env.PATH ?? '')
		.split(':')
		.filter(Boolean);

	for (const dir of pathEntries) {
		if (await pathExists(`${dir}/${command}`)) {
			return true;
		}
	}

	return false;
}

export async function assertDictateReady(config: DictateConfig): Promise<void> {
	if (!(await commandExists('pw-record'))) {
		throw new DictateSetupError(
			'pw-record not found — install pipewire-utils: sudo dnf install pipewire-utils',
		);
	}

	if (!(await pathExists(config.whisperBin))) {
		throw new DictateSetupError(
			`whisper-cli not found — build whisper.cpp first (missing: ${config.whisperBin})`,
		);
	}

	if (!(await pathExists(config.whisperModel))) {
		throw new DictateSetupError(`Whisper model not found: ${config.whisperModel}`);
	}
}
