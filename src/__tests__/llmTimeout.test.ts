import { describe, expect, it } from 'vitest';

import { normalizeLlmTimeoutSec } from '../llmTimeout';

describe('normalizeLlmTimeoutSec', () => {
	const fallback = 60;

	it('returns the fallback when the setting is missing or invalid', () => {
		expect(normalizeLlmTimeoutSec(undefined, fallback)).toBe(60);
		expect(normalizeLlmTimeoutSec('slow', fallback)).toBe(60);
	});

	it('clamps values to the 5–600 second range', () => {
		expect(normalizeLlmTimeoutSec(1, fallback)).toBe(5);
		expect(normalizeLlmTimeoutSec(9999, fallback)).toBe(600);
	});

	it('rounds fractional values before clamping', () => {
		expect(normalizeLlmTimeoutSec(59.6, fallback)).toBe(60);
		expect(normalizeLlmTimeoutSec(59.4, fallback)).toBe(59);
	});
});
