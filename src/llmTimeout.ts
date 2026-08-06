const MIN_LLM_TIMEOUT_SEC = 5;
const MAX_LLM_TIMEOUT_SEC = 600;

export function normalizeLlmTimeoutSec(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fallback;
	}

	const rounded = Math.round(value);
	return Math.min(MAX_LLM_TIMEOUT_SEC, Math.max(MIN_LLM_TIMEOUT_SEC, rounded));
}
