#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";
import * as virtualSession from "../sessions/virtual.js";
import { BASE_SYSTEM_PROMPT } from "./system-prompt.js";
import { TOOLS } from "./tools.js";
import { handleCallTool } from "./handlers.js";
import { triggerHook, HookTypes } from "./hooks.js";
import * as core_config from "../memory/config.js";
import { setNotifyChange } from "./handlers.js";
import { logger, initLogger } from "../logger.js";
import * as traffic from "./traffic-log.js";
import * as agentsMd from "./agents-md.js";

export let detectedProject: string | null = null;

export function setDetectedProject(p: string | null): void {
  detectedProject = p;
}

const server = new Server(
  {
    name: "lemma",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        listChanged: true,
      },
      resources: {
        listChanged: true,
      },
    },
  }
);

export function getServer(): Server {
  return server;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(InitializeRequestSchema, async (_request) => {
  logger.request("initialize");

  detectedProject = core.detectProject();

  logger.flow("initialize", "project_detected", { project: detectedProject });

  if (detectedProject) {
    console.error(`[Lemma] Detected project: ${detectedProject}`);
  }

  logger.response("initialize", false, 0, {
    project: detectedProject,
  });

  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {
        listChanged: true,
      },
      resources: {
        listChanged: true,
      },
    },
    serverInfo: {
      name: "lemma",
      version: "1.0.0",
    },
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    {
      uri: "lemma://system-prompt",
      name: "Lemma System Prompt",
      description: "System prompt for LLM clients using Lemma memory",
      mimeType: "text/markdown",
    },
  ];

  logger.flow("resources/list", "responded", { count: resources.length });

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params as { uri: string };

  logger.flow("resources/read", "requested", { uri });

  if (uri === "lemma://system-prompt") {
    logger.flow("resources/read", "system-prompt", { uri });
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: BASE_SYSTEM_PROMPT,
        },
      ],
    };
  }

  if (uri.startsWith("lemma://memory/")) {
    const id = uri.replace("lemma://memory/", "");
    logger.flow("resources/read", "memory/id", { uri, memory_id: id });
    const memory: any[] = core.loadMemory();
    const fragment = memory.find((f: any) => f.id === id);

    if (!fragment) {
      throw new Error(`Memory fragment not found: ${id}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(fragment, null, 2),
        },
      ],
    };
  }

  if (uri.startsWith("lemma://guides/")) {
    const guideName = uri.replace("lemma://guides/", "").toLowerCase();
    logger.flow("resources/read", "guides/name", { uri, guide: guideName });
    const allGuides: any[] = guides.loadGuides();
    const guide = allGuides.find((g: any) => g.guide === guideName);

    if (!guide) {
      throw new Error(`Guide not found: ${guideName}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(guide, null, 2),
        },
      ],
    };
  }

  logger.flow("resources/read", "unknown", { uri });
  throw new Error(`Unknown resource: ${uri}`);
});

server.setRequestHandler(CallToolRequestSchema, (async (request: any) => {
  const toolName = (request.params as any).name as string;
  const start = Date.now();

  const argsSummary: Record<string, unknown> = {};
  const rawArgs = (request.params as any).arguments;
  if (rawArgs) {
    for (const [k, v] of Object.entries(rawArgs)) {
      if (typeof v === "string" && (v as string).length > 80) {
        argsSummary[k] = (v as string).substring(0, 80) + "...";
      } else {
        argsSummary[k] = v;
      }
    }
  }
  logger.request("tools/call", { name: toolName, args_summary: argsSummary });

  try {
    const result = await handleCallTool(request);
    const duration = Date.now() - start;
    logger.toolCall(toolName, (request.params as any).arguments, duration);
    if (result.isError) {
      const text = result.content?.[0]?.text || "";
      logger.warn(`Tool ${toolName} returned error: ${text}`);
    }
    logger.response("tools/call", !!result.isError, duration, { tool: toolName });
    try {
      virtualSession.recordToolCall(
        toolName,
        (request.params as any).arguments,
        result
      );
    } catch {}
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Tool ${toolName} threw after ${duration}ms: ${(error as Error).message}`);
    logger.response("tools/call", true, duration, { tool: toolName });
    throw error;
  }
}) as any);

async function initializeContext(): Promise<void> {
  initLogger();
  logger.flow("initialize_context", "entry");

  const cfg = core_config.loadConfig();
  logger.flow("initialize_context", "config_loaded", {
    token_budget_full: cfg.token_budget.full_content,
    virtual_session_timeout: cfg.virtual_session.timeout_minutes,
    max_full_content_fragments: cfg.injection.max_full_content_fragments,
  });

  virtualSession.setVirtualSessionConfig(cfg.virtual_session);
  logger.flow("initialize_context", "virtual_session_config_set");

  const memory = core.loadMemory();
  const seedResult = core.seedMemory(memory);
  if (seedResult.seeded > 0) {
    core.saveMemory(memory);
    logger.flow("initialize_context", "seeded", seedResult);
  }

  const allGuidesForSeed = guides.loadGuides();
  const guideSeedResult = guides.seedGuides(allGuidesForSeed);
  if (guideSeedResult.seeded > 0) {
    guides.saveGuides(allGuidesForSeed);
    logger.flow("initialize_context", "guide_seeded", guideSeedResult);
  }

  const migrated = core.migrateConfidenceFloor();
  if (migrated > 0) {
    logger.info(`Migration: boosted ${migrated} fragments to 0.3 floor`);
    logger.flow("initialize_context", "migration", { migrated });
  } else {
    logger.flow("initialize_context", "migration", { migrated: 0 });
  }

  core.applySessionDecay();
  logger.flow("initialize_context", "decay_applied");

  detectedProject = core.detectProject();

  if (detectedProject) {
    logger.info(`Detected project: ${detectedProject}`);

    const memory: any[] = core.loadMemory();
    const projectFragments = core.filterByProject(memory, detectedProject);

    if (projectFragments.length > 0) {
      logger.info(`Found ${projectFragments.length} memory fragment(s) for this project`);
    } else {
      logger.info(`No saved memories for this project yet`);
    }

    const projectDir = process.cwd();
    if (projectDir) {
      try {
        const result = agentsMd.injectAgentsMd(projectDir);
        if (result.injected) {
          logger.info(`AGENTS.md ${result.created ? "created" : "injected"}: ${result.path}`);
        }
      } catch (e) {
        logger.warn("Failed to inject AGENTS.md", (e as Error).message);
      }
    }
  } else {
    logger.info(`No project detected (running in global context)`);
  }

  logger.flow("initialize_context", "hook_trigger", { hook: HookTypes.ON_START });
  await triggerHook(HookTypes.ON_START, {
    project: detectedProject,
    timestamp: new Date().toISOString(),
  });
  logger.flow("initialize_context", "complete");
}

export async function startServer(): Promise<void> {
  logger.flow("server", "starting");
  traffic.initTrafficLogger();

  let incomingBuffer = "";

  process.stdin.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    incomingBuffer += text;
    const lines = incomingBuffer.split("\n");
    incomingBuffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        traffic.logIncoming(parsed);
      } catch {}
    }
  });

  const origStdoutWrite = process.stdout.write;

  (process.stdout as any).write = function (data: unknown, ...args: unknown[]): boolean {
    if (typeof data === "string") {
      const trimmed = data.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          traffic.logOutgoing(parsed);
        } catch {}
      }
    }
    return (origStdoutWrite as any).apply(process.stdout, [data, ...args]);
  };

  await initializeContext();

  logger.flow("server", "creating_transport");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Server connected via stdio transport");
  logger.flow("server", "connected");

  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  setNotifyChange(() => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      logger.notify("notifications/tools/list_changed", "debounced");
      server.notification({ method: "notifications/tools/list_changed" }).then(() => {
        logger.notify("notifications/tools/list_changed", "sending");
      }).catch((e) => {
        logger.notify("notifications/tools/list_changed", "failed", (e as Error).message);
      });
    }, 100);
  });

  logger.flow("server", "notify_callback_set");
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === `file://${argv1.replace(/\\/g, '/')}`) {
  startServer().catch((error: unknown) => {
    logger.error("Fatal error on startup", (error as Error).message);
    process.exit(1);
  });
}
