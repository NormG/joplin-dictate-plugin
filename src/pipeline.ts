import { RecordingSession } from './recording';
import { transcribeWav, TranscriptionResult } from './transcribe';
import { DictateConfig } from './types';
import { assertDictateReady } from './validate';

export interface RecordAndTranscribeResult extends TranscriptionResult {
	sessionTempDir?: string;
}

let activeRecording: RecordingSession | null = null;

export function getActiveRecording(): RecordingSession | null {
	return activeRecording;
}

export async function startRecording(): Promise<void> {
	if (activeRecording?.isActive) {
		throw new Error('Recording is already in progress');
	}

	if (activeRecording) {
		await activeRecording.dispose();
		activeRecording = null;
	}

	activeRecording = await RecordingSession.start();
}

export async function stopRecordingAndTranscribe(
	config: DictateConfig,
): Promise<RecordAndTranscribeResult> {
	if (!activeRecording?.isActive) {
		throw new Error('No active recording to stop');
	}

	await assertDictateReady(config);

	const session = activeRecording;
	activeRecording = null;

	try {
		const wavPath = await session.stop();
		const result = await transcribeWav(config, wavPath);
		return result;
	} finally {
		await session.dispose();
	}
}

export async function transcribeAudioFile(
	config: DictateConfig,
	wavPath: string,
): Promise<TranscriptionResult> {
	return transcribeWav(config, wavPath);
}

export function pauseRecording(): void {
	activeRecording?.pause();
}

export function resumeRecording(): void {
	activeRecording?.resume();
}

export async function cancelRecording(): Promise<void> {
	if (!activeRecording) {
		return;
	}

	const session = activeRecording;
	activeRecording = null;
	await session.dispose();
}
