import joplin from 'api';

import { DictateFolder } from './types';

interface FolderPage {
	items?: Array<{ id?: string; title?: string }>;
	has_more?: boolean;
}

export async function listNotebookFolders(): Promise<DictateFolder[]> {
	const folders: DictateFolder[] = [];
	let page = 1;

	for (;;) {
		const response = await joplin.data.get(['folders'], {
			fields: ['id', 'title'],
			page,
		}) as FolderPage | DictateFolder[];

		if (Array.isArray(response)) {
			for (const item of response) {
				if (typeof item.id === 'string' && typeof item.title === 'string') {
					folders.push({ id: item.id, title: item.title });
				}
			}
			break;
		}

		const items = response?.items ?? [];
		for (const item of items) {
			if (typeof item.id === 'string' && typeof item.title === 'string') {
				folders.push({ id: item.id, title: item.title });
			}
		}

		if (!response?.has_more) {
			break;
		}

		page += 1;
	}

	folders.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	return folders;
}

export async function createNotebookFolder(title: string): Promise<DictateFolder> {
	const trimmed = title.trim();
	if (trimmed.length === 0) {
		throw new Error('Notebook name cannot be empty.');
	}

	const created = await joplin.data.post(['folders'], null, { title: trimmed });
	const id = created?.id as string | undefined;
	if (!id) {
		throw new Error('Joplin did not return a notebook ID after creation.');
	}

	return {
		id,
		title: (created?.title as string | undefined) ?? trimmed,
	};
}
