import joplin from 'api';
import { promises as fs } from 'fs';
import * as path from 'path';

const LOG_FILE = 'dictate.log';
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const TRIM_TO_BYTES = 1024 * 1024;

let fileLoggingEnabled = false;
let logPath: string | null = null;
let initPromise: Promise<void> | null = null;
let appendChain: Promise<void> = Promise.resolve();

export async function initLogger(debugLogging: boolean): Promise<void> {
	fileLoggingEnabled = debugLogging;
	if (!fileLoggingEnabled) {
		return;
	}

	if (!initPromise) {
		initPromise = (async () => {
			const dir = await joplin.plugins.dataDir();
			await fs.mkdir(dir, { recursive: true });
			logPath = path.join(dir, LOG_FILE);
		})();
	}

	await initPromise;
}

export function getLogFilePath(): string | null {
	return logPath;
}

function timestamp(): string {
	return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function serializeExtra(extra: unknown): string {
	if (extra === undefined) {
		return '';
	}

	if (extra instanceof Error) {
		const stack = extra.stack?.trim();
		return stack && stack.length > 0 ? stack : extra.message;
	}

	if (typeof extra === 'string') {
		return extra;
	}

	try {
		return JSON.stringify(extra);
	} catch {
		return String(extra);
	}
}

function formatLine(level: string, message: string, extra?: unknown): string {
	const suffix = extra === undefined ? '' : ` ${serializeExtra(extra)}`;
	return `${timestamp()} [${level}] ${message}${suffix}\n`;
}

async function maybeTrimLog(): Promise<void> {
	if (!logPath) {
		return;
	}

	try {
		const stats = await fs.stat(logPath);
		if (stats.size <= MAX_LOG_BYTES) {
			return;
		}

		const handle = await fs.open(logPath, 'r');
		try {
			const start = Math.max(0, stats.size - TRIM_TO_BYTES);
			const buffer = Buffer.alloc(stats.size - start);
			await handle.read(buffer, 0, buffer.length, start);
			await fs.writeFile(logPath, buffer);
		} finally {
			await handle.close();
		}
	} catch {
		// Ignore rotation failures — logging should never break the plugin.
	}
}

function queueAppend(line: string): void {
	if (!fileLoggingEnabled || !logPath) {
		return;
	}

	appendChain = appendChain.then(async () => {
		try {
			await fs.appendFile(logPath as string, line, 'utf8');
			await maybeTrimLog();
		} catch {
			// Ignore write failures.
		}
	});
}

function write(level: string, message: string, extra?: unknown, consoleFn?: (...args: unknown[]) => void): void {
	const line = formatLine(level, message, extra);
	if (consoleFn) {
		if (extra === undefined) {
			consoleFn(`Dictate: ${message}`);
		} else {
			consoleFn(`Dictate: ${message}`, extra);
		}
	}
	queueAppend(line);
}

export function logDebug(message: string, extra?: unknown): void {
	write('DEBUG', message, extra, console.debug);
}

export function logInfo(message: string, extra?: unknown): void {
	write('INFO', message, extra, console.info);
}

export function logWarn(message: string, extra?: unknown): void {
	write('WARN', message, extra, console.warn);
}

export function logError(message: string, extra?: unknown): void {
	write('ERROR', message, extra, console.error);
}
