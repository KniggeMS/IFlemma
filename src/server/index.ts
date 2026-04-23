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
import type { ToolDefinition } from "./tools.js";
import { handleCallTool } from "./handlers.js";
import { triggerHook, HookTypes } from "./hooks.js";
import * as core_config from "../memory/config.js";
import { setNotifyChange } from "./handlers.js";

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
  return { tools: buildToolsWithMemory() };
});

export function buildToolsWithMemory(): ToolDefinition[] {
  const tools: ToolDefinition[] = TOOLS.map(t => ({ ...t }));
  const memoryIdx = tools.findIndex(t => t.name === "memory_read");
  if (memoryIdx === -1) return tools;

  const config = core_config.loadConfig();
  const memory: any[] = core.loadMemory();
  const projectName = detectedProject;

  const allSorted = projectName
    ? (core.filterByProject(memory, projectName) as any[]).sort((a: any, b: any) => b.confidence - a.confidence)
    : (core.filterByProject(memory, null) as any[]).sort((a: any, b: any) => b.confidence - a.confidence);

  let contextBlock = "";
  let tokensUsed = 0;
  const budget = config.token_budget.full_content || 3000;
  const maxFrags = config.injection.max_full_content_fragments || 15;
  let count = 0;
  const injectedIds = new Set<string>();

  if (allSorted.length > 0) {
    contextBlock += `\n\nYOUR MEMORIES (you already know these — no need to call memory_read for them):\n`;

    for (const frag of allSorted) {
      if (count >= maxFrags) break;
      const entry = `---\n[${frag.id}] ${frag.title} (${(frag.confidence * 100).toFixed(0)}%)\n${frag.fragment}\n`;
      const cost = core_config.estimateTokens(entry);
      if (tokensUsed + cost > budget) break;

      contextBlock += entry;
      tokensUsed += cost;
      count++;
      injectedIds.add(frag.id);
    }

    const remaining = allSorted.filter((f: any) => !injectedIds.has(f.id)).slice(0, config.injection.max_summary_fragments || 30);
    if (remaining.length > 0) {
      contextBlock += `---\nADDITIONAL (call memory_read for details):\n`;
      for (const frag of remaining) {
        const scope = frag.project ? `[${frag.project}]` : "[global]";
        contextBlock += `[${frag.id}] ${scope} ${frag.title}\n`;
      }
    }
  }

  const allGuides: any[] = guides.loadGuides();
  const topGuides = guides.getTopGuides(allGuides, config.injection.max_guides || 20);
  if (topGuides.length > 0) {
    contextBlock += `\nACTIVE GUIDES:\n`;
    for (const g of topGuides) {
      const learnings = (g.learnings || []).slice(0, 3).join("; ");
      contextBlock += `- ${g.guide} (${g.category}, ${g.usage_count}x)${learnings ? ": " + learnings : ""}\n`;
    }
  }

  if (contextBlock) {
    tools[memoryIdx] = {
      ...tools[memoryIdx]!,
      description: tools[memoryIdx]!.description + contextBlock,
    };
  }

  return tools;
}

export function buildDynamicInstructions(projectName: string | null): string {
  const config = core_config.loadConfig();
  const memory: any[] = core.loadMemory();

  const allSorted = projectName
    ? (core.filterByProject(memory, projectName) as any[])
        .sort((a: any, b: any) => b.confidence - a.confidence)
    : (core.filterByProject(memory, null) as any[])
        .sort((a: any, b: any) => b.confidence - a.confidence);

  const allGuides: any[] = guides.loadGuides();
  const topGuides = guides.getTopGuides(allGuides, config.injection.max_guides);

  let instructions = "";

  const fullBudget = config.token_budget.full_content;
  let tokensUsed = 0;
  const fullContentIds = new Set<string>();

  const fullContentParts: string[] = [];
  for (const frag of allSorted) {
    const entryText = `### [${frag.id}] ${frag.title} (${(frag.confidence * 100).toFixed(0)}%)\n${frag.fragment}\n`;
    const cost = core_config.estimateTokens(entryText);
    if (tokensUsed + cost > fullBudget) break;
    if (fullContentParts.length >= config.injection.max_full_content_fragments) break;

    fullContentParts.push(entryText);
    tokensUsed += cost;
    fullContentIds.add(frag.id);
  }

  if (fullContentParts.length > 0) {
    instructions += `## What You Already Know (no need to call memory_read for these)\n\n`;
    for (const part of fullContentParts) {
      instructions += part + "\n";
    }
  }

  const remaining = allSorted.filter((f: any) => !fullContentIds.has(f.id));
  const maxSummary = config.injection.max_summary_fragments;

  if (remaining.length > 0) {
    instructions += `## Additional Memory Index (call \`memory_read id="<id>"\` for details)\n\n`;
    const toShow = remaining.slice(0, maxSummary);
    for (const frag of toShow) {
      const scope = frag.project ? `[${frag.project}]` : "[global]";
      const desc = (frag.description || "").replace(/\n/g, " ").slice(0, 80);
      instructions += `- [${frag.id}] ${scope} ${frag.title}${desc ? " — " + desc : ""}\n`;
    }
    if (remaining.length > maxSummary) {
      instructions += `- ... and ${remaining.length - maxSummary} more (use \`memory_read\` to browse)\n`;
    }
    instructions += "\n";
  }

  if (topGuides.length > 0) {
    const maxDetail = config.injection.max_guide_detail;
    const guideBudget = config.token_budget.guides_detail;

    instructions += `## Guides (accumulated experience)\n\n`;

    let guideTokens = 0;
    let detailCount = 0;
    for (const guide of topGuides) {
      if (detailCount < maxDetail && guide.description && guide.description.length > 20) {
        const entry = `### ${guide.guide} (${guide.category}) — ${guide.usage_count}x used\n`;
        const desc = guide.description.length > 300 ? guide.description.slice(0, 300) + "..." : guide.description;
        const fullEntry = entry + desc + "\n\n";
        const cost = core_config.estimateTokens(fullEntry);

        if (guideTokens + cost <= guideBudget) {
          instructions += fullEntry;
          guideTokens += cost;
          detailCount++;
          continue;
        }
      }

      instructions += `- ${guide.guide} (${guide.category}) — ${guide.usage_count}x used\n`;
    }
    instructions += `\nUse \`guide_get guide="<name>"\` for full guide details.\n\n`;
  }

  if (projectName) {
    instructions = `# Lemma — Your Memory (project: ${projectName})\n\n` + instructions;
  } else {
    instructions = `# Lemma — Your Memory\n\n` + instructions;
  }

  if (fullContentParts.length === 0 && remaining.length === 0) {
    instructions += `No memories stored yet. Start working and call \`memory_add\` to build your memory.\n`;
  }

  instructions += `\n**RULE:** Call \`memory_add\` AFTER learning something new. If you skip this, the knowledge is lost forever — you will NOT remember it next session.`;

  return instructions;
}

server.setRequestHandler(InitializeRequestSchema, async (_request) => {
  detectedProject = core.detectProject();

  if (detectedProject) {
    console.error(`[Lemma] Detected project: ${detectedProject}`);
  }

  const instructions = buildDynamicInstructions(detectedProject);

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
    instructions,
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
    {
      uri: "lemma://context/current",
      name: "Lemma Current Context",
      description: "Dynamically generated context with current memories and guides",
      mimeType: "text/markdown",
    },
  ];

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params as { uri: string };

  if (uri === "lemma://system-prompt") {
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

  if (uri === "lemma://context/current") {
    const contextStr = buildDynamicInstructions(detectedProject);
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: contextStr,
        },
      ],
    };
  }

  if (uri.startsWith("lemma://memory/")) {
    const id = uri.replace("lemma://memory/", "");
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

  throw new Error(`Unknown resource: ${uri}`);
});

server.setRequestHandler(CallToolRequestSchema, (async (request: any) => {
  const result = await handleCallTool(request);
  try {
    virtualSession.recordToolCall(
      (request.params as any).name,
      (request.params as any).arguments,
      result
    );
  } catch {}
  return result;
}) as any);

async function initializeContext(): Promise<void> {
  const cfg = core_config.loadConfig();
  virtualSession.setVirtualSessionConfig(cfg.virtual_session);

  const migrated = core.migrateConfidenceFloor();
  if (migrated > 0) {
    console.error(`[Lemma] Migration: boosted ${migrated} fragments to 0.3 floor`);
  }

  core.applySessionDecay();

  detectedProject = core.detectProject();

  if (detectedProject) {
    console.error(`[Lemma] Detected project: ${detectedProject}`);

    const memory: any[] = core.loadMemory();
    const projectFragments = core.filterByProject(memory, detectedProject);

    if (projectFragments.length > 0) {
      console.error(`[Lemma] Found ${projectFragments.length} memory fragment(s) for this project`);
    } else {
      console.error(`[Lemma] No saved memories for this project yet`);
    }
  } else {
    console.error(`[Lemma] No project detected (running in global context)`);
  }

  await triggerHook(HookTypes.ON_START, {
    project: detectedProject,
    timestamp: new Date().toISOString(),
  });
}

export async function startServer(): Promise<void> {
  await initializeContext();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  setNotifyChange(() => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      server.notification({ method: "notifications/tools/list_changed" }).catch(() => {});
      server.notification({
        method: "notifications/resources/updated",
        params: { uri: "lemma://context/current" },
      }).catch(() => {});
    }, 100);
  });
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === `file://${argv1.replace(/\\/g, '/')}`) {
  startServer().catch((error: unknown) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
