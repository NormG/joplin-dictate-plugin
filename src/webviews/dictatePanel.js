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
}

function setPaused(active) {
	const pauseBtn = document.getElementById('pauseBtn');
	if (pauseBtn) {
		pauseBtn.textContent = active ? 'Resume' : 'Pause';
	}

	// While paused, force a Resume before Stop is allowed.
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
	} else if (action === 'pause') {
		// backend will send paused message to update button label
	} else if (action === 'cancel') {
		setRecording(false);
		setStatus('Cancelling…');
	} else if (action === 'transcribeFile') {
		setStatus('Choose a WAV file…');
	}

	webviewApi.postMessage({ type: action });
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
});

setStatus('Ready.');
setRecording(false);
