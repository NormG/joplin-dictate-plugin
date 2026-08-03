import { vi } from 'vitest';

const api = {
	data: {
		post: vi.fn(async (_path: string[], _query: null, payload: Record<string, unknown>) => ({
			id: 'note-test-id',
			title: payload.title,
		})),
	},
	workspace: {
		selectedFolder: vi.fn(async () => null),
	},
	commands: {
		execute: vi.fn(async () => {}),
	},
};

export default api;
