import { RecordingSession } from './recording';
import { transcribeWav, TranscriptionResult } from './transcribe';
import { DictateConfig } from './types';
import { assertDictateReady } from './validate';

export interface RecordAndTranscribeResult extends TranscriptionResult {
	sessionTempDir?: string;
}

let activeRecording: RecordingSession | null = null;
let isTranscribing = false;

export function getActiveRecording(): RecordingSession | null {
	return activeRecording;
}

export function isTranscriptionInProgress(): boolean {
	return isTranscribing;
}

export async function startRecording(): Promise<void> {
	if (isTranscribing) {
		throw new Error('Cannot start dictation while a file is being transcribed');
	}

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
	isTranscribing = true;

	try {
		const wavPath = await session.stop();
		const result = await transcribeWav(config, wavPath);
		return result;
	} finally {
		await session.dispose();
		isTranscribing = false;
	}
}

export async function transcribeAudioFile(
	config: DictateConfig,
	wavPath: string,
): Promise<TranscriptionResult> {
	if (activeRecording?.isActive) {
		throw new Error('Cannot transcribe a file while dictation is in progress');
	}

	if (isTranscribing) {
		throw new Error('A transcription is already in progress');
	}

	isTranscribing = true;

	try {
		return await transcribeWav(config, wavPath);
	} finally {
		isTranscribing = false;
	}
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
