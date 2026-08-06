import joplin from 'api';

import { registerDictatePanelUi } from './dictatePanel';
import { getLogFilePath, initLogger, logInfo } from './logger';
import { loadDictateConfig, registerDictateSettings } from './settings';

joplin.plugins.register({
	onStart: async function() {
		await registerDictateSettings();
		const config = await loadDictateConfig();
		await initLogger(config.debugLogging);

		logInfo('Plugin starting', { debugLogging: config.debugLogging });

		await registerDictatePanelUi();

		const logFile = getLogFilePath();
		logInfo('Plugin started', logFile ? { logFile } : undefined);
	},
});
