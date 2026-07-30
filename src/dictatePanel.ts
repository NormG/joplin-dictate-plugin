import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';

import {
	cancelRecording,
	getActiveRecording,
	startRecording,
	stopRecordingAndTranscribe,
	transcribeAudioFile,
} from './pipeline';
import { createNoteFromTranscript, openCreatedNote } from './notes';
import { loadDictateConfig } from './settings';
import { DictateSetupError } from './validate';

const PANEL_ID = 'dictatePanel';

const panelHtml = `
<style>
	.dictate-panel {
		box-sizing: border-box;
		padding: calc(var(--joplin-toolbar-height, 32px) + 10px) 10px 10px 14px;
		font-family: inherit;
		color: var(--joplin-color, inherit);
		font-size: var(--joplin-font-size, 14px);
	}
	.dictate-panel h2 {
		margin: 0 0 6px;
		font-size: 1em;
		font-weight: 600;
		line-height: 1.2;
	}
	.dictate-panel .status {
		margin: 0 0 8px;
		color: var(--joplin-color-faded, #666);
		min-height: 1.2em;
		line-height: 1.3;
		font-size: 0.92em;
	}
	.dictate-panel .actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
	}
	.dictate-panel button {
		display: block;
		width: fit-content;
		max-width: 100%;
		margin: 0;
		padding: 5px 10px;
		border: 1px solid var(--joplin-border-color4, #ccc);
		border-radius: 4px;
		background: var(--joplin-background-color3, #f7f7f7);
		color: var(--joplin-color, inherit);
		cursor: pointer;
		font-size: 0.95em;
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;
	}
	.dictate-panel button.ready {
		background: #27ae60;
		border-color: #27ae60;
		color: white;
	}
	.dictate-panel button.recording {
		background: #d63031;
		border-color: #d63031;
		color: white;
	}
	.dictate-panel button.secondary {
		background: var(--joplin-background-color3, #ececec);
	}
	.dictate-panel button:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
<div class="dictate-panel">
	<h2>Dictate</h2>
	<p id="status" class="status">Ready.</p>
	<div class="actions">
		<button id="dictateBtn" class="ready" data-action="toggle">Dictate</button>
		<button id="cancelBtn" class="secondary" data-action="cancel" disabled>Cancel</button>
		<button id="fileBtn" class="secondary" data-action="transcribeFile">Transcribe file…</button>
	</div>
</div>
`;

let panelHandle: string | null = null;

async function syncPanelUi(): Promise<void> {
	if (!panelHandle) return;

	await postPanelMessage({
		type: 'recording',
		active: !!getActiveRecording()?.isActive,
	});

	await postPanelMessage({
		type: 'status',
		text: getActiveRecording()?.isActive
			? 'Recording… press Stop Dictating when done.'
			: 'Ready.',
	});
}
async function postPanelMessage(message: { type: string; text?: string; active?: boolean }): Promise<void> {
	if (!panelHandle) return;
	joplin.views.panels.postMessage(panelHandle, message);
}

async function showError(message: string): Promise<void> {
	await postPanelMessage({ type: 'recording', active: false });
	await postPanelMessage({ type: 'status', text: `Error: ${message}` });
	await joplin.views.dialogs.showMessageBox(message);
}

async function finishDictation(config: Awaited<ReturnType<typeof loadDictateConfig>>, text: string): Promise<void> {
	if (text.trim().length === 0) {
		await postPanelMessage({ type: 'status', text: 'No speech detected.' });
		await joplin.views.dialogs.showToast({
			message: 'No speech detected.',
			duration: 5000,
		});
		return;
	}

	if (config.polishEnabled) {
		await postPanelMessage({ type: 'status', text: 'Polishing transcript…' });
	}

	await postPanelMessage({ type: 'status', text: 'Creating note…' });

	const note = await createNoteFromTranscript(config, text);
	await openCreatedNote(note.id);

	await postPanelMessage({ type: 'status', text: `Note created: ${note.title}` });
	await joplin.views.dialogs.showToast({
		message: `Note created: ${note.title}`,
		duration: 8000,
	});
}

async function withConfig<T>(
	action: (config: Awaited<ReturnType<typeof loadDictateConfig>>) => Promise<T>,
): Promise<T | void> {
	try {
		const config = await loadDictateConfig();
		return await action(config);
	} catch (error) {
		const message = error instanceof DictateSetupError || error instanceof Error
			? error.message
			: 'Unexpected error while running Dictate';
		await showError(message);
	}
}

async function ensurePanel(): Promise<string> {
	if (panelHandle) {
		return panelHandle;
	}

	panelHandle = await joplin.views.panels.create(PANEL_ID);
	await joplin.views.panels.setHtml(panelHandle, panelHtml);
	await joplin.views.panels.addScript(panelHandle, './webviews/dictatePanel.js');

	await joplin.views.panels.onMessage(panelHandle, async (message: { type?: string }) => {
		switch (message?.type) {
		case 'toggle':
			if (getActiveRecording()?.isActive) {
				await withConfig(async (config) => {
					await postPanelMessage({ type: 'status', text: 'Transcribing…' });
					await postPanelMessage({ type: 'recording', active: false });

					const result = await stopRecordingAndTranscribe(config);
					await finishDictation(config, result.text);
					await postPanelMessage({ type: 'status', text: 'Ready.' });
				});
			} else {
				await withConfig(async () => {
					await startRecording();
					await postPanelMessage({ type: 'recording', active: true });
					await postPanelMessage({ type: 'status', text: 'Recording… press Stop Dictating when done.' });
				});
			}
			break;

		case 'cancel':
			await cancelRecording();
			await postPanelMessage({ type: 'recording', active: false });
			await postPanelMessage({ type: 'status', text: 'Recording cancelled.' });
			break;

		case 'transcribeFile':
			await withConfig(async (config) => {
				const paths = await joplin.views.dialogs.showOpenDialog({
					title: 'Select a WAV file to transcribe',
					properties: ['openFile'],
					filters: [{ name: 'WAV audio', extensions: ['wav'] }],
				});

				if (!paths || paths.length === 0) {
					return;
				}

				await postPanelMessage({ type: 'status', text: 'Transcribing…' });
				const result = await transcribeAudioFile(config, paths[0]);
				await finishDictation(config, result.text);
			});
			break;
		}
	});

	return panelHandle;
}

export async function toggleDictatePanel(): Promise<void> {
	const handle = await ensurePanel();
	const isVisible = await joplin.views.panels.visible(handle);
	const shouldShow = !isVisible;

	await joplin.views.panels.show(handle, shouldShow);

	if (shouldShow) {
		await syncPanelUi();
	}
}

export async function registerDictatePanelUi(): Promise<void> {
	await ensurePanel();

	await joplin.commands.register({
		name: 'dictate.togglePanel',
		label: 'Dictate',
		iconName: 'fas fa-microphone',
		execute: async () => {
			await toggleDictatePanel();
		},
	});

	await joplin.views.toolbarButtons.create(
		'dictateToolbarButton',
		'dictate.togglePanel',
		ToolbarButtonLocation.EditorToolbar,
	);

	await joplin.views.menuItems.create(
		'dictateMenuItem',
		'dictate.togglePanel',
		MenuItemLocation.Tools,
	);
}
