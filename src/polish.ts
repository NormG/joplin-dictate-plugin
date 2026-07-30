import { DictateConfig } from './types';

interface ChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

const SYSTEM_PROMPT = 'You are a transcript editor. Correct the following voice transcript. '
	+ 'Fix ALL grammar errors including subject-verb agreement (e.g. \'they was\' → \'they were\', '
	+ '\'there was no any\' → \'there were no\'), incorrect word order, and awkward phrasing. '
	+ 'Add correct punctuation and capitalisation. Remove filler words such as \'um\', \'uh\', '
	+ '\'like\', and \'you know\'. Do not change the meaning or invent content. '
	+ 'Return only the corrected text, nothing else.';

export async function polishTranscript(config: DictateConfig, text: string): Promise<string> {
	const url = `${config.llmUrl.replace(/\/$/, '')}/v1/chat/completions`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: config.llmModel,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: text },
			],
			max_tokens: 2048,
			temperature: 0.3,
		}),
	});

	if (!response.ok) {
		throw new Error(`LLM server returned ${response.status} ${response.statusText}`);
	}

	const data = await response.json() as ChatCompletionResponse;
	const polished = data.choices?.[0]?.message?.content?.trim() ?? '';
	if (polished.length === 0) {
		throw new Error('LLM returned empty response');
	}

	return polished;
}
