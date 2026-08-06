function unwrapMessage(event) {
	if (event && typeof event === 'object' && event.message !== undefined) {
		return event.message;
	}

	return event;
}

function isRecording() {
	const dictateBtn = document.getElementById('dictateBtn');
	return !!dictateBtn && dictateBtn.classList.contains('recording');
}

function isPaused() {
	const pauseBtn = document.getElementById('pauseBtn');
	return !!pauseBtn && pauseBtn.textContent === 'Resume';
}

function getOptionElements() {
	return {
		notebookSelect: document.getElementById('notebookSelect'),
		newNotebookBtn: document.getElementById('newNotebookBtn'),
		newNotebookRow: document.getElementById('newNotebookRow'),
		newNotebookName: document.getElementById('newNotebookName'),
		createNotebookBtn: document.getElementById('createNotebookBtn'),
		cancelNotebookBtn: document.getElementById('cancelNotebookBtn'),
		noteTitle: document.getElementById('noteTitle'),
		todoCheck: document.getElementById('todoCheck'),
		dueDate: document.getElementById('dueDate'),
		dueTime: document.getElementById('dueTime'),
		clearDueBtn: document.getElementById('clearDueBtn'),
	};
}

let optionsLocked = false;

function updateDueControlsEnabled() {
	const els = getOptionElements();
	const locked = isRecording() || optionsLocked;
	const todoEnabled = !!els.todoCheck && els.todoCheck.checked;
	const hasDate = !!els.dueDate && els.dueDate.value.length > 0;

	if (els.notebookSelect) {
		els.notebookSelect.disabled = locked;
	}

	if (els.noteTitle) {
		els.noteTitle.disabled = locked;
	}

	if (els.newNotebookBtn) {
		els.newNotebookBtn.disabled = locked;
		els.newNotebookBtn.title = locked
			? 'Create notebook'
			: 'Create a new notebook (replaces current selection)';
	}

	if (els.newNotebookName) {
		els.newNotebookName.disabled = locked;
	}

	if (els.createNotebookBtn) {
		els.createNotebookBtn.disabled = locked;
	}

	if (els.cancelNotebookBtn) {
		els.cancelNotebookBtn.disabled = locked;
	}

	if (els.todoCheck) {
		els.todoCheck.disabled = locked;
	}

	if (els.dueDate) {
		els.dueDate.disabled = !todoEnabled || locked;
	}

	if (els.dueTime) {
		els.dueTime.disabled = !todoEnabled || locked;
	}

	if (els.clearDueBtn) {
		els.clearDueBtn.disabled = !todoEnabled || !hasDate || locked;
	}
}

function setOptionsLocked(locked) {
	optionsLocked = !!locked;
	const els = getOptionElements();

	if (locked && els.newNotebookRow) {
		els.newNotebookRow.classList.add('hidden');
	}

	updateDueControlsEnabled();
}

function buildDueString() {
	const els = getOptionElements();
	if (!els.todoCheck || !els.todoCheck.checked) {
		return '';
	}

	if (!els.dueDate || !els.dueDate.value) {
		return '';
	}

	const timeValue = els.dueTime && els.dueTime.value ? els.dueTime.value : '09:00';
	return `${els.dueDate.value} ${timeValue}`;
}

function sendPanelOptions() {
	const els = getOptionElements();
	webviewApi.postMessage({
		type: 'panelOptionsChanged',
		parentId: els.notebookSelect ? els.notebookSelect.value : '__pick__',
		noteTitle: els.noteTitle ? els.noteTitle.value : '',
		isTodo: !!els.todoCheck && els.todoCheck.checked,
		due: buildDueString(),
	});
}

function populateFolders(folders) {
	const select = document.getElementById('notebookSelect');
	if (!select) {
		return;
	}

	const currentValue = select.value;
	select.innerHTML = '';

	const pickOption = document.createElement('option');
	pickOption.value = '__pick__';
	pickOption.textContent = 'Pick a notebook…';
	select.appendChild(pickOption);

	const defaultOption = document.createElement('option');
	defaultOption.value = '__default__';
	defaultOption.textContent = '— use default notebook —';
	select.appendChild(defaultOption);

	for (const folder of folders || []) {
		const option = document.createElement('option');
		option.value = folder.id;
		option.textContent = folder.title;
		select.appendChild(option);
	}

	if (currentValue && Array.from(select.options).some((opt) => opt.value === currentValue)) {
		select.value = currentValue;
	} else {
		select.value = '__pick__';
	}

	updateDueControlsEnabled();
}

function applyOptions(message) {
	const els = getOptionElements();

	if (els.notebookSelect && typeof message.parentId === 'string') {
		els.notebookSelect.value = message.parentId;
	}

	if (els.noteTitle && typeof message.noteTitle === 'string') {
		els.noteTitle.value = message.noteTitle;
	}

	if (els.todoCheck && typeof message.isTodo === 'boolean') {
		els.todoCheck.checked = message.isTodo;
	}

	if (typeof message.due === 'string' && message.due.trim().length > 0) {
		const parts = message.due.trim().split(/[ T]/);
		if (els.dueDate && parts[0]) {
			els.dueDate.value = parts[0];
		}
		if (els.dueTime && parts[1]) {
			els.dueTime.value = parts[1].slice(0, 5);
		}
	} else {
		if (els.dueDate) {
			els.dueDate.value = '';
		}
	}

	updateDueControlsEnabled();
}

function setStatus(text) {
	const status = document.getElementById('status');
	if (status) {
		status.textContent = text;
	}

	const dictateBtn = document.getElementById('dictateBtn');
	const cancelBtn = document.getElementById('cancelBtn');
	const fileBtn = document.getElementById('fileBtn');
	const busy = text === 'Transcribing…'
		|| text === 'Stopping…'
		|| text === 'Polishing transcript…'
		|| text === 'Polishing complete. Saving note…'
		|| text === 'Polish failed — saving raw transcript…'
		|| text === 'Creating note…';

	if (dictateBtn) {
		dictateBtn.disabled = busy || isPaused();
	}

	if (cancelBtn) {
		cancelBtn.disabled = busy || !isRecording();
	}

	if (fileBtn) {
		fileBtn.disabled = busy || isRecording();
	}
}

function setRecording(active) {
	const dictateBtn = document.getElementById('dictateBtn');
	const pauseBtn = document.getElementById('pauseBtn');
	const cancelBtn = document.getElementById('cancelBtn');
	const fileBtn = document.getElementById('fileBtn');

	if (dictateBtn) {
		dictateBtn.disabled = false;
		dictateBtn.textContent = active ? 'Stop' : 'Dictate';
		dictateBtn.classList.toggle('ready', !active);
		dictateBtn.classList.toggle('recording', active);
	}

	if (pauseBtn) {
		pauseBtn.disabled = !active;
		pauseBtn.textContent = 'Pause';
	}

	if (cancelBtn) {
		cancelBtn.disabled = !active;
	}

	if (fileBtn) {
		fileBtn.disabled = active;
	}

	setOptionsLocked(active);
	updateDueControlsEnabled();
}

function setPaused(active) {
	const pauseBtn = document.getElementById('pauseBtn');
	if (pauseBtn) {
		pauseBtn.textContent = active ? 'Resume' : 'Pause';
	}

	const dictateBtn = document.getElementById('dictateBtn');
	if (dictateBtn) {
		dictateBtn.disabled = active;
	}
}

function sendAction(action) {
	if (action === 'toggle') {
		if (isRecording()) {
			setStatus('Stopping…');
			setRecording(false);
		} else {
			setRecording(true);
			setStatus('Recording… press Stop when done.');
		}
	} else if (action === 'cancel') {
		setRecording(false);
		setStatus('Cancelling…');
	} else if (action === 'transcribeFile') {
		setOptionsLocked(true);
		setStatus('Choose a WAV file…');
	}

	webviewApi.postMessage({ type: action });
}

function wireOptionEvents() {
	const els = getOptionElements();

	if (els.notebookSelect) {
		els.notebookSelect.addEventListener('change', () => {
			updateDueControlsEnabled();
			sendPanelOptions();
		});
	}

	if (els.noteTitle) {
		els.noteTitle.addEventListener('input', sendPanelOptions);
		els.noteTitle.addEventListener('change', sendPanelOptions);
	}

	if (els.todoCheck) {
		els.todoCheck.addEventListener('change', () => {
			if (!els.todoCheck.checked) {
				if (els.dueDate) {
					els.dueDate.value = '';
				}
			}
			updateDueControlsEnabled();
			sendPanelOptions();
		});
	}

	for (const input of [els.dueDate, els.dueTime]) {
		if (input) {
			input.addEventListener('change', () => {
				updateDueControlsEnabled();
				sendPanelOptions();
			});
		}
	}

	if (els.clearDueBtn) {
		els.clearDueBtn.addEventListener('click', () => {
			if (els.dueDate) {
				els.dueDate.value = '';
			}
			updateDueControlsEnabled();
			sendPanelOptions();
		});
	}

	if (els.newNotebookBtn && els.newNotebookRow) {
		els.newNotebookBtn.addEventListener('click', () => {
			els.newNotebookRow.classList.toggle('hidden');
			if (!els.newNotebookRow.classList.contains('hidden') && els.newNotebookName) {
				els.newNotebookName.focus();
			}
		});
	}

	if (els.cancelNotebookBtn && els.newNotebookRow && els.newNotebookName) {
		els.cancelNotebookBtn.addEventListener('click', () => {
			els.newNotebookRow.classList.add('hidden');
			els.newNotebookName.value = '';
		});
	}

	if (els.createNotebookBtn && els.newNotebookName && els.newNotebookRow) {
		const submitNotebook = () => {
			const title = els.newNotebookName.value.trim();
			if (title.length === 0) {
				setStatus('Enter a notebook name first.');
				return;
			}

			webviewApi.postMessage({ type: 'createFolder', title });
			els.newNotebookRow.classList.add('hidden');
			els.newNotebookName.value = '';
		};

		els.createNotebookBtn.addEventListener('click', submitNotebook);
		els.newNotebookName.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				submitNotebook();
			}
		});
	}
}

document.addEventListener('click', (event) => {
	const target = event.target instanceof HTMLElement
		? event.target.closest('[data-action]')
		: null;

	if (!target) {
		return;
	}

	event.preventDefault();
	sendAction(target.getAttribute('data-action'));
});

webviewApi.onMessage((event) => {
	const message = unwrapMessage(event);

	if (message && message.type === 'status' && message.text) {
		setStatus(message.text);
	}

	if (message && message.type === 'recording') {
		setRecording(!!message.active);
	}

	if (message && message.type === 'paused') {
		setPaused(!!message.active);
	}

	if (message && message.type === 'folders') {
		populateFolders(message.folders || []);
	}

	if (message && message.type === 'selectFolder' && message.folderId) {
		const select = document.getElementById('notebookSelect');
		if (select) {
			select.value = message.folderId;
		}
		updateDueControlsEnabled();
		sendPanelOptions();
	}

	if (message && message.type === 'options') {
		applyOptions(message);
		if (typeof message.locked === 'boolean') {
			setOptionsLocked(message.locked);
		}
		sendPanelOptions();
	}

	if (message && message.type === 'optionsLocked') {
		setOptionsLocked(!!message.locked);
	}
});

wireOptionEvents();
updateDueControlsEnabled();
setStatus('Ready.');
setRecording(false);
sendPanelOptions();
requestNotebookFolders();

function requestNotebookFolders() {
	webviewApi.postMessage({ type: 'requestFolders' });
}
