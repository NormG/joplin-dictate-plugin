import joplin from 'api';

import { registerDictatePanelUi } from './dictatePanel';
import { registerDictateSettings } from './settings';

joplin.plugins.register({
	onStart: async function() {
		await registerDictateSettings();
		await registerDictatePanelUi();

		// eslint-disable-next-line no-console
		console.info('Dictate plugin started');
	},
});
