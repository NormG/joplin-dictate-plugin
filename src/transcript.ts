const HALLUCINATION_TOKENS = [
	'[Blank Audio]',
	'[BLANK_AUDIO]',
	'[ Silence ]',
	'[ silence ]',
	'[Silence]',
	'[noise]',
	'[Noise]',
	'[Music]',
	'[music]',
	'(silence)',
	'(Silence)',
];

export function filterTranscript(raw: string): string {
	let text = raw;
	for (const token of HALLUCINATION_TOKENS) {
		text = text.split(token).join('');
	}

	return text.trim();
}
