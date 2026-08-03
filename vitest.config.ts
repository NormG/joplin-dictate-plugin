import * as path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
	},
	resolve: {
		alias: {
			api: path.resolve(__dirname, 'src/__tests__/mocks/api.ts'),
		},
	},
});
