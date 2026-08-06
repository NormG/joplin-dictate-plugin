import joplin from 'api';
import { SettingItemSubType, SettingItemType } from 'api/types';
import * as os from 'os';
import * as path from 'path';

import { DictateConfig } from './types';

export const SETTINGS_SECTION = 'dictateSettings';

export const SETTING_KEYS = [
	'whisperDir',
	'whisperModel',
	'whisperBin',
	'llmUrl',
	'llmModel',
	'polishEnabled',
	'useSelectedNotebook',
	'defaultParentId',
	'debugLogging',
] as const;

export type SettingKey = typeof SETTING_KEYS[number];

function homePath(...segments: string[]): string {
	return path.join(os.homedir(), ...segments);
}

function defaultWhisperDir(): string {
	return homePath('whisper.cpp');
}

function defaultWhisperModel(): string {
	return path.join(defaultWhisperDir(), 'models', 'ggml-small.en.bin');
}

function defaultWhisperBin(): string {
	return path.join(defaultWhisperDir(), 'build', 'bin', 'whisper-cli');
}

export function defaultDictateConfig(): DictateConfig {
	return {
		whisperDir: defaultWhisperDir(),
		whisperModel: defaultWhisperModel(),
		whisperBin: defaultWhisperBin(),
		llmUrl: 'http://localhost:8080',
		llmModel: 'qwen/qwen3-coder-30b',
		polishEnabled: false,
		useSelectedNotebook: true,
		defaultParentId: '',
		debugLogging: true,
	};
}

export async function registerDictateSettings(): Promise<void> {
	const defaults = defaultDictateConfig();

	await joplin.settings.registerSection(SETTINGS_SECTION, {
		label: 'Dictate',
		description: 'Local voice recording, Whisper transcription, and note creation.',
		iconName: 'fas fa-microphone',
	});

	await joplin.settings.registerSettings({
		whisperDir: {
			value: defaults.whisperDir,
			type: SettingItemType.String,
			subType: SettingItemSubType.DirectoryPath,
			label: 'Whisper.cpp directory',
			description: 'Root directory of your local whisper.cpp checkout.',
			public: true,
			section: SETTINGS_SECTION,
		},
		whisperModel: {
			value: defaults.whisperModel,
			type: SettingItemType.String,
			subType: SettingItemSubType.FilePath,
			label: 'Whisper model file',
			description: 'Path to the ggml model file used for transcription.',
			public: true,
			section: SETTINGS_SECTION,
		},
		whisperBin: {
			value: defaults.whisperBin,
			type: SettingItemType.String,
			subType: SettingItemSubType.FilePath,
			label: 'whisper-cli binary',
			description: 'Path to the whisper-cli executable from your whisper.cpp build.',
			public: true,
			section: SETTINGS_SECTION,
			advanced: true,
		},
		llmUrl: {
			value: defaults.llmUrl,
			type: SettingItemType.String,
			label: 'LLM server URL',
			description: 'Base URL for transcript polishing (OpenAI-compatible chat API).',
			public: true,
			section: SETTINGS_SECTION,
			advanced: true,
		},
		llmModel: {
			value: defaults.llmModel,
			type: SettingItemType.String,
			label: 'LLM model name',
			description: 'Model identifier sent to the LLM server when polishing is enabled.',
			public: true,
			section: SETTINGS_SECTION,
			advanced: true,
		},
		polishEnabled: {
			value: defaults.polishEnabled,
			type: SettingItemType.Bool,
			label: 'Polish transcripts with LLM',
			description: 'Correct grammar and punctuation before creating the note.',
			public: true,
			section: SETTINGS_SECTION,
		},
		useSelectedNotebook: {
			value: defaults.useSelectedNotebook,
			type: SettingItemType.Bool,
			label: 'Use selected notebook',
			description: 'Create dictated notes in the notebook currently selected in Joplin.',
			public: true,
			section: SETTINGS_SECTION,
		},
		defaultParentId: {
			value: defaults.defaultParentId,
			type: SettingItemType.String,
			label: 'Default notebook ID',
			description: 'Optional fallback notebook ID when "Use selected notebook" is disabled.',
			public: true,
			section: SETTINGS_SECTION,
			advanced: true,
		},
		debugLogging: {
			value: defaults.debugLogging,
			type: SettingItemType.Bool,
			label: 'Write debug log file',
			description: 'Append pipeline events to dictate.log in the plugin data directory (useful while developing).',
			public: true,
			section: SETTINGS_SECTION,
			advanced: true,
		},
	});
}

export async function loadDictateConfig(): Promise<DictateConfig> {
	const values = await joplin.settings.values([...SETTING_KEYS]);
	const defaults = defaultDictateConfig();

	return {
		whisperDir: stringSetting(values.whisperDir, defaults.whisperDir),
		whisperModel: stringSetting(values.whisperModel, defaults.whisperModel),
		whisperBin: stringSetting(values.whisperBin, defaults.whisperBin),
		llmUrl: stringSetting(values.llmUrl, defaults.llmUrl),
		llmModel: stringSetting(values.llmModel, defaults.llmModel),
		polishEnabled: booleanSetting(values.polishEnabled, defaults.polishEnabled),
		useSelectedNotebook: booleanSetting(values.useSelectedNotebook, defaults.useSelectedNotebook),
		defaultParentId: stringSetting(values.defaultParentId, defaults.defaultParentId),
		debugLogging: booleanSetting(values.debugLogging, defaults.debugLogging),
	};
}

function stringSetting(value: unknown, fallback: string): string {
	if (typeof value !== 'string') {
		return fallback;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}
