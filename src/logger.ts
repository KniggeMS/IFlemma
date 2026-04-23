import os from "os";
import path from "path";
import fs from "fs";

const LOG_DIR = path.join(os.homedir(), ".lemma", "logs");
const MAX_LOG_FILES = 7;

let _logDir: string | null = null;

export function setLogDir(dir: string): void {
  _logDir = dir;
}

function getLogDir(): string {
  return _logDir || LOG_DIR;
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split("T")[0];
  return path.join(getLogDir(), `lemma-${date}.log`);
}

function ensureLogDir(): void {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rotateLogs(): void {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) return;

  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("lemma-") && f.endsWith(".log"))
      .sort();

    while (files.length > MAX_LOG_FILES) {
      const toDelete = files.shift();
      if (toDelete) {
        fs.unlinkSync(path.join(dir, toDelete));
      }
    }
  } catch {}
}

function formatMessage(level: string, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${level}] ${message}`;
  if (meta !== undefined) {
    line += " " + (typeof meta === "string" ? meta : JSON.stringify(meta));
  }
  return line;
}

function write(level: string, message: string, meta?: unknown): void {
  try {
    ensureLogDir();
    const line = formatMessage(level, message, meta);
    fs.appendFileSync(getLogFilePath(), line + "\n", "utf-8");

    if (level === "ERROR" || level === "WARN") {
      console.error(`[Lemma] ${line}`);
    }
  } catch {}
}

export const logger = {
  info(message: string, meta?: unknown): void {
    write("INFO", message, meta);
  },

  warn(message: string, meta?: unknown): void {
    write("WARN", message, meta);
  },

  error(message: string, meta?: unknown): void {
    write("ERROR", message, meta);
  },

  debug(message: string, meta?: unknown): void {
    write("DEBUG", message, meta);
  },

  toolCall(tool: string, args?: Record<string, unknown>, durationMs?: number): void {
    const duration = durationMs !== undefined ? ` (${durationMs}ms)` : "";
    const argSummary: Record<string, unknown> = {};
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        if (typeof v === "string" && v.length > 80) {
          argSummary[k] = v.substring(0, 80) + "...";
        } else {
          argSummary[k] = v;
        }
      }
    }
    write("TOOL", `${tool}${duration}`, Object.keys(argSummary).length > 0 ? argSummary : undefined);
  },
};

export function initLogger(): void {
  ensureLogDir();
  rotateLogs();
  logger.info("Lemma MCP server starting");
}
