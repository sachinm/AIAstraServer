/**
 * Queue task logger – writes Kundli queue events to a log file for easy monitoring.
 * Use KUNDLI_QUEUE_LOG_FILE to set path; default: logs/kundli-queue.log (relative to cwd).
 */
import fs from 'fs';
import path from 'path';

const DEFAULT_LOG_FILE = 'logs/kundli-queue.log';

function getLogPath(): string {
  const envPath = process.env.KUNDLI_QUEUE_LOG_FILE?.trim();
  if (envPath) return path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  return path.join(process.cwd(), DEFAULT_LOG_FILE);
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write a JSON log line to the queue log file. Also logs to console when KUNDLI_QUEUE_LOG_CONSOLE is set.
 */
export function queueLog(payload: Record<string, unknown>): void {
  const line = JSON.stringify(payload) + '\n';
  const logPath = getLogPath();
  try {
    ensureDir(logPath);
    fs.appendFileSync(logPath, line);
  } catch (err) {
    console.error('Queue log write failed:', (err as Error).message);
  }
  if (process.env.KUNDLI_QUEUE_LOG_CONSOLE === '1') {
    console.log(line.trim());
  }
}

/**
 * Write an error-level log line to the queue log file.
 */
export function queueLogError(payload: Record<string, unknown>): void {
  const withLevel = { ...payload, level: 'error' };
  queueLog(withLevel);
  if (process.env.KUNDLI_QUEUE_LOG_CONSOLE === '1') {
    console.error(JSON.stringify(withLevel));
  }
}
