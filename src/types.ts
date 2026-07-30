export interface DictateConfig {
	whisperDir: string;
	whisperModel: string;
	whisperBin: string;
	llmUrl: string;
	llmModel: string;
	polishEnabled: boolean;
	useSelectedNotebook: boolean;
	defaultParentId: string;
}
