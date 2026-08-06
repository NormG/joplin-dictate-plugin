import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';

import { errorMessage } from './errors';
import { createNotebookFolder, listNotebookFolders } from './folders';
import { logError, logInfo } from './logger';
import {
	cancelRecording,
	getActiveRecording,
	pauseRecording,
	resumeRecording,
	startRecording,
	stopRecordingAndTranscribe,
	transcribeAudioFile,
} from './pipeline';
import { openCreatedNote, processNoteCreation } from './notes';
import { loadDictateConfig } from './settings';
import { DictateFolder, NOTEBOOK_PICK, NoteCreateOptions, NoteCreationStatusCallback } from './types';

const PANEL_ID = 'dictatePanel';

const panelHtml = `
<div class="dictate-panel">
	<div class="options">
		<label class="field-row">
			<span class="field-label">Notebook</span>
			<div class="field-control notebook-row">
				<div class="select-wrap">
					<select id="notebookSelect" class="field-input">
						<option value="__pick__">Pick a notebook…</option>
					</select>
				</div>
				<button type="button" id="newNotebookBtn" class="icon-btn" title="Create notebook">+</button>
			</div>
		</label>
		<div id="newNotebookRow" class="new-notebook-row hidden">
			<input id="newNotebookName" class="field-input" type="text" placeholder="New notebook name" />
			<button type="button" id="createNotebookBtn" class="ready compact">Create</button>
			<button type="button" id="cancelNotebookBtn" class="secondary compact">Cancel</button>
		</div>
		<label class="field-row">
			<span class="field-label">Title</span>
			<div class="field-control">
				<input id="noteTitle" class="field-input" type="text" placeholder="Auto (first line of transcript)" />
			</div>
		</label>
		<label class="field-row checkbox-row">
			<input id="todoCheck" type="checkbox" />
			<span>Create as to-do</span>
		</label>
		<label class="field-row">
			<span class="field-label">Due</span>
			<div class="field-control due-inputs">
				<div class="picker-wrap date-picker">
					<input id="dueDate" class="field-input" type="date" disabled />
				</div>
				<div class="picker-wrap time-picker">
					<input id="dueTime" class="field-input" type="time" step="300" value="09:00" disabled />
				</div>
				<button type="button" id="clearDueBtn" class="secondary compact" disabled>Clear</button>
			</div>
		</label>
	</div>
	<div class="actions">
		<button id="dictateBtn" class="ready" data-action="toggle">Dictate</button>
		<button id="pauseBtn" class="ready" data-action="pause" disabled>Pause</button>
		<button id="cancelBtn" class="ready" data-action="cancel" disabled>Cancel</button>
		<button id="fileBtn" class="ready" data-action="transcribeFile">Transcribe file…</button>
	</div>
	<div class="status-row">
		<span class="status-label">Status</span>
		<span id="status" class="status">Ready.</span>
	</div>
</div>
`;

type PanelMessage = {
	type?: string;
	text?: string;
	active?: boolean;
	parentId?: string;
	isTodo?: boolean;
	due?: string;
	noteTitle?: string;
	title?: string;
	folders?: DictateFolder[];
	folderId?: string;
	locked?: boolean;
};

let panelHandle: string | null = null;
let panelNoteOptions: NoteCreateOptions = { isTodo: false, parentId: NOTEBOOK_PICK };
let sessionNoteOptions: NoteCreateOptions | null = null;

function getCurrentNoteOptions(): NoteCreateOptions {
	return { ...panelNoteOptions };
}

async function postPanelMessage(message: PanelMessage): Promise<void> {
	if (!panelHandle) return;
	joplin.views.panels.postMessage(panelHandle, message);
}

async function loadFoldersForPanel(selectFolderId?: string): Promise<void> {
	const folders = await listNotebookFolders();
	await postPanelMessage({ type: 'folders', folders });

	if (selectFolderId) {
		await postPanelMessage({ type: 'selectFolder', folderId: selectFolderId });
	}
}

async function syncPanelUi(): Promise<void> {
	if (!panelHandle) return;

	await loadFoldersForPanel(panelNoteOptions.parentId);

	await postPanelMessage({
		type: 'recording',
		active: !!getActiveRecording()?.isActive,
	});

	await postPanelMessage({
		type: 'options',
		parentId: panelNoteOptions.parentId ?? NOTEBOOK_PICK,
		noteTitle: panelNoteOptions.title ?? '',
		isTodo: panelNoteOptions.isTodo,
		due: panelNoteOptions.due ?? '',
		locked: !!getActiveRecording()?.isActive,
	});

	await postPanelMessage({
		type: 'status',
		text: getActiveRecording()?.isActive
			? 'Recording… press Stop when done.'
			: 'Ready.',
	});
}

async function showError(message: string, error?: unknown): Promise<void> {
	logError(message, error);
	await postPanelMessage({ type: 'recording', active: false });
	await postPanelMessage({ type: 'paused', active: false });
	await postPanelMessage({ type: 'optionsLocked', locked: false });
	sessionNoteOptions = null;
	await postPanelMessage({ type: 'status', text: `Error: ${message}` });
	await joplin.views.dialogs.showMessageBox(message);
}

async function finishDictation(
	config: Awaited<ReturnType<typeof loadDictateConfig>>,
	text: string,
	noteOptions: NoteCreateOptions,
): Promise<void> {
	if (text.trim().length === 0) {
		await postPanelMessage({ type: 'status', text: 'No speech detected.' });
		await joplin.views.dialogs.showToast({
			message: 'No speech detected.',
			duration: 5000,
		});
		return;
	}

	const onNoteCreationStatus: NoteCreationStatusCallback = async (status) => {
		await postPanelMessage({ type: 'status', text: status });
	};

	const note = await processNoteCreation(config, text, noteOptions, onNoteCreationStatus);
	await openCreatedNote(note.id);

	const kind = note.isTodo ? 'To-do' : 'Note';
	const dueSuffix = note.dueHuman ? ` (due ${note.dueHuman})` : '';
	const fallbackSuffix = note.rawFallback ? ' (raw transcript — polish failed)' : '';
	await postPanelMessage({
		type: 'status',
		text: `${kind} created: ${note.title}${fallbackSuffix}`,
	});
	await joplin.views.dialogs.showToast({
		message: `${kind} created: ${note.title}${dueSuffix}${fallbackSuffix}`,
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
		await showError(errorMessage(error, 'Unexpected error while running Dictate'), error);
	}
}

async function ensurePanel(): Promise<string> {
	if (panelHandle) {
		return panelHandle;
	}

	panelHandle = await joplin.views.panels.create(PANEL_ID);
	await joplin.views.panels.setHtml(panelHandle, panelHtml);
	await joplin.views.panels.addScript(panelHandle, './webviews/dictatePanel.css');
	await joplin.views.panels.addScript(panelHandle, './webviews/dictatePanel.js');

	await joplin.views.panels.onMessage(panelHandle, async (message: PanelMessage) => {
		switch (message?.type) {
		case 'requestFolders':
			try {
				await loadFoldersForPanel(panelNoteOptions.parentId);
			} catch (error) {
				logError('Failed to load notebooks', error);
				await postPanelMessage({
					type: 'status',
					text: `Error: ${errorMessage(error, 'Failed to load notebooks')}`,
				});
			}
			break;

		case 'panelOptionsChanged':
			panelNoteOptions = {
				parentId: message.parentId ?? NOTEBOOK_PICK,
				title: message.noteTitle?.trim() ? message.noteTitle.trim() : undefined,
				isTodo: !!message.isTodo,
				due: message.due?.trim() ? message.due.trim() : undefined,
			};
			break;

		case 'createFolder': {
			const title = message.title?.trim();
			if (!title) {
				await postPanelMessage({ type: 'status', text: 'Enter a notebook name first.' });
				break;
			}

			try {
				const folder = await createNotebookFolder(title);
				panelNoteOptions = {
					...panelNoteOptions,
					parentId: folder.id,
				};
				await loadFoldersForPanel(folder.id);
				await postPanelMessage({ type: 'status', text: `Created notebook: ${folder.title}` });
			} catch (error) {
				logError('Failed to create notebook', error);
				await postPanelMessage({
					type: 'status',
					text: `Error: ${errorMessage(error, 'Failed to create notebook')}`,
				});
			}
			break;
		}

		case 'toggle':
			if (getActiveRecording()?.isActive) {
				logInfo('Panel: stop dictation');
				await withConfig(async (config) => {
					const noteOptions = sessionNoteOptions ?? getCurrentNoteOptions();
					sessionNoteOptions = null;

					try {
						await postPanelMessage({ type: 'status', text: 'Transcribing…' });
						const result = await stopRecordingAndTranscribe(config);
						await finishDictation(config, result.text, noteOptions);
					} finally {
						await postPanelMessage({ type: 'recording', active: false });
						await postPanelMessage({ type: 'paused', active: false });
						await postPanelMessage({ type: 'optionsLocked', locked: false });
					}
				});
			} else {
				logInfo('Panel: start dictation');
				await withConfig(async () => {
					sessionNoteOptions = getCurrentNoteOptions();
					await startRecording();
					await postPanelMessage({ type: 'recording', active: true });
					await postPanelMessage({ type: 'optionsLocked', locked: true });
					await postPanelMessage({ type: 'status', text: 'Recording… press Stop when done.' });
				});
			}
			break;

		case 'pause':
			if (getActiveRecording()?.isPaused) {
				resumeRecording();
				await postPanelMessage({ type: 'paused', active: false });
				await postPanelMessage({ type: 'status', text: 'Recording… press Stop when done.' });
			} else {
				pauseRecording();
				await postPanelMessage({ type: 'paused', active: true });
				await postPanelMessage({ type: 'status', text: 'Paused.' });
			}
			break;

		case 'cancel':
			logInfo('Panel: cancel recording');
			await cancelRecording();
			sessionNoteOptions = null;
			await postPanelMessage({ type: 'recording', active: false });
			await postPanelMessage({ type: 'paused', active: false });
			await postPanelMessage({ type: 'optionsLocked', locked: false });
			await postPanelMessage({ type: 'status', text: 'Recording cancelled.' });
			break;

		case 'transcribeFile':
			await withConfig(async (config) => {
				const noteOptions = getCurrentNoteOptions();
				await postPanelMessage({ type: 'optionsLocked', locked: true });

				try {
					const paths = await joplin.views.dialogs.showOpenDialog({
						title: 'Select a WAV file to transcribe',
						properties: ['openFile'],
						filters: [{ name: 'WAV audio', extensions: ['wav'] }],
					});

					if (!paths || paths.length === 0) {
						await postPanelMessage({ type: 'status', text: 'Ready.' });
						return;
					}

					logInfo('Panel: transcribe file', { path: paths[0] });
					await postPanelMessage({ type: 'status', text: 'Transcribing…' });
					const result = await transcribeAudioFile(config, paths[0]);
					await finishDictation(config, result.text, noteOptions);
				} finally {
					await postPanelMessage({ type: 'optionsLocked', locked: false });
				}
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
		ToolbarButtonLocation.NoteToolbar,
	);

	await joplin.views.menuItems.create(
		'dictateMenuItem',
		'dictate.togglePanel',
		MenuItemLocation.Tools,
	);
}
