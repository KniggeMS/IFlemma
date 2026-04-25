import os from "os";
import path from "path";
import fs from "fs";
import { logger } from "../logger.js";
import * as guides from "../guides/index.js";
import type { VirtualSession, ToolCallEntry } from "../types.js";

interface FinalizedVirtualSession {
  id: string;
  started_at: string;
  tool_calls: ToolCallEntry[];
  project: string | null;
  guides_used: string[];
  memories_accessed: string[];
  memories_created: string[];
  ended_at: string;
  duration_tool_calls: number;
  technologies: string[];
}

const SESSION_LOG_DIR = path.join(os.homedir(), ".lemma", "sessions");
let _logDir: string | null = null;

export function setSessionLogDir(dir: string): void {
  _logDir = dir;
}

function getLogDir(): string {
  return _logDir || SESSION_LOG_DIR;
}

function ensureLogDir(): string {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

let currentVirtualSession: VirtualSession | null = null;
let sessionTimeout: ReturnType<typeof setTimeout> | null = null;
let config: { timeout_minutes: number } = { timeout_minutes: 30 };

export function setVirtualSessionConfig(cfg: { timeout_minutes: number } | null): void {
  if (cfg) config = cfg;
}

export function recordToolCall(toolName: string, args: any, result: any): VirtualSession {
  logger.flow("virtual_session", "record_tool", { tool: toolName });

  const entry: ToolCallEntry = {
    tool: toolName,
    timestamp: new Date().toISOString(),
    args_summary: summarizeArgs(toolName, args),
    result_summary: summarizeResult(result),
  };

  if (!currentVirtualSession) {
    currentVirtualSession = {
      id: "vs_" + Date.now().toString(36),
      started_at: new Date().toISOString(),
      tool_calls: [],
      project: null,
      technologies_seen: new Set(),
      guides_used: new Set(),
      memories_accessed: [],
      memories_created: [],
    };
    logger.flow("virtual_session", "created", { id: currentVirtualSession.id });
  }

  currentVirtualSession.tool_calls.push(entry);
  logger.flow("virtual_session", "recorded", { tool: toolName, entryCount: currentVirtualSession.tool_calls.length });

  extractSessionData(toolName, args, result, currentVirtualSession);

  const detectedTechs = detectTechnologies(toolName, args);
  for (const tech of detectedTechs) {
    currentVirtualSession.technologies_seen.add(tech);
  }

  resetTimeout();

  return currentVirtualSession;
}

function resetTimeout(): void {
  logger.flow("virtual_session", "timeout_reset", { minutes: config.timeout_minutes });
  if (sessionTimeout) clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    finalizeVirtualSession();
  }, config.timeout_minutes * 60 * 1000);
}

function summarizeArgs(tool: string, args: any): string | null {
  if (!args) return null;
  switch (tool) {
    case "memory_read":
      return args.id ? `id=${args.id}` : args.query ? `query=${args.query}` : "list";
    case "memory_add":
      return args.title || args.fragment?.slice(0, 50);
    case "guide_practice":
      return args.guide;
    case "memory_feedback":
      return `${args.id} useful=${args.useful}`;
    default:
      return null;
  }
}

function summarizeResult(result: any): string | null {
  if (!result?.content?.[0]?.text) return null;
  const text: string = result.content[0].text;
  if (text.length > 100) return text.slice(0, 100) + "...";
  return text;
}

function extractSessionData(tool: string, args: any, result: any, session: VirtualSession): void {
  switch (tool) {
    case "memory_read":
      if (args?.id) session.memories_accessed.push(args.id);
      if (args?.ids) {
        for (const id of args.ids) session.memories_accessed.push(id);
      }
      break;
    case "memory_add":
      if (args?.project) session.project = args.project;
      const addedId = result?.content?.[0]?.text?.match(/\[(m[0-9a-f]+)\]/)?.[1];
      if (addedId) session.memories_created.push(addedId);
      break;
    case "guide_practice":
      if (args?.guide) session.guides_used.add(args.guide.toLowerCase());
      if (args?.contexts) {
        for (const c of args.contexts) session.technologies_seen.add(c.toLowerCase());
      }
      break;
    case "memory_feedback":
      break;
  }
}

export function finalizeVirtualSession(): FinalizedVirtualSession | null {
  logger.flow("virtual_session", "finalize_start");
  if (!currentVirtualSession || currentVirtualSession.tool_calls.length === 0) {
    logger.flow("virtual_session", "finalize_skipped", { reason: "empty" });
    currentVirtualSession = null;
    return null;
  }

  const session: any = {
    ...currentVirtualSession,
    ended_at: new Date().toISOString(),
    duration_tool_calls: currentVirtualSession.tool_calls.length,
    technologies: [...currentVirtualSession.technologies_seen],
    guides_used: [...currentVirtualSession.guides_used],
  };

  delete session.technologies_seen;

  ensureLogDir();
  const filePath = path.join(getLogDir(), `${session.id}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
    logger.flow("virtual_session", "finalize_complete", { id: session.id, toolCalls: session.duration_tool_calls });
  } catch (error: any) {
    logger.error("Failed to write virtual session file:", { error: error.message, id: session.id });
  }

  try {
    const allGuides = guides.loadGuides();
    let autoTracked = 0;
    for (const tech of session.technologies || []) {
      const guide = guides.findGuide(allGuides, tech);
      if (guide) {
        guide.auto_usage_count = (guide.auto_usage_count || 0) + 1;
        guide.last_used = new Date().toISOString();
        autoTracked++;
      }
    }
    if (autoTracked > 0) {
      guides.saveGuides(allGuides);
      logger.flow("virtual_session", "auto_practice", { count: autoTracked });
    }
  } catch (error) {
    logger.error("Auto-practice failed", (error as Error).message);
  }

  currentVirtualSession = null;
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
    sessionTimeout = null;
  }

  return session as FinalizedVirtualSession;
}

export function getCurrentVirtualSession(): VirtualSession | null {
  return currentVirtualSession;
}

export function getRecentSessions(count: number = 10): FinalizedVirtualSession[] {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) return [];

  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith("vs_") && f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, count);

    return files.map((f: string) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as FinalizedVirtualSession;
      } catch { return null; }
    }).filter(Boolean) as FinalizedVirtualSession[];
  } catch {
    return [];
  }
}

export function detectTechnologies(tool: string, args: any): string[] {
  const techs: string[] = [];

  if (args?.contexts) {
    for (const c of args.contexts) techs.push(String(c).toLowerCase());
  }
  if (args?.technologies) {
    for (const t of args.technologies) techs.push(String(t).toLowerCase());
  }

  const text = [args?.fragment, args?.query, args?.description, args?.guide]
    .filter(Boolean)
    .join(" ");

  if (text) {
    const patterns: [string, RegExp][] = [
      ["react", /\breact\b/i],
      ["vue", /\bvue\b/i],
      ["angular", /\bangular\b/i],
      ["nextjs", /\bnext\.?js\b/i],
      ["sveltekit", /\bsveltekit\b/i],
      ["svelte", /\bsvelte\b/i],
      ["typescript", /\btypescript\b/i],
      ["python", /\bpython\b/i],
      ["nodejs", /\bnode\.?js\b|\bexpress\b/i],
      ["prisma", /\bprisma\b/i],
      ["supabase", /\bsupabase\b/i],
      ["docker", /\bdocker\b/i],
      ["jest", /\bjest\b/i],
      ["vitest", /\bvitest\b/i],
      ["seo", /\bseo\b|\bsitemap\b/i],
      ["git", /\bgit\b(?!hub)/i],
      ["astro", /\bastro\b/i],
      ["remix", /\bremix\b/i],
      ["hugo", /\bhugo\b/i],
    ];

    for (const [tech, pattern] of patterns) {
      if (pattern.test(text)) techs.push(tech);
    }
  }

  return [...new Set(techs)];
}
