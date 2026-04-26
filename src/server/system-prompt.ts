import type { MemoryFragment, PromptContext } from "../types.js";
import type { ToolDefinition } from "./tools.js";
import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";
import { applyPromptModifiers } from "./hooks.js";
import * as core_config from "../memory/config.js";
import { TOOLS } from "./tools.js";
import { logger } from "../logger.js";

const BASE_SYSTEM_PROMPT = `<system_prompt>
<identity>
You are an AI assistant with persistent memory powered by Lemma.
Lemma is your ONLY memory — sessions start fresh, knowledge persists through tools.
See AGENTS.md in the project root for memory usage rules.
</identity>

<critical_rules>
MANDATORY BEHAVIOR — APPLY TO EVERY SESSION, EVERY TASK, EVERY RESPONSE:

1. ALWAYS call \`memory_read\` FIRST before reading files, searching code, or answering questions about a project. Your memory may already contain the answer.
2. ALWAYS call \`memory_add\` after learning something new: solving a bug, discovering a pattern, making a decision, understanding project architecture. If you skip this, the knowledge is lost forever — you will NOT remember it next session.
3. NEVER say "I'll remember this next time" — you won't. The ONLY way to persist knowledge is through \`memory_add\` or \`guide_practice\`. Execute the tool immediately, do not just promise to remember.
4. NEVER re-discover what you already know. Check memory before exploring filesystem. If a memory fragment answers your question, use it.
5. NEVER assume memory is always correct. Memories have confidence scores. Low-confidence or old memories may be outdated. When a memory contradicts observable reality, trust reality and update the memory with \`memory_update\`.
6. ALWAYS call \`session_end\` when you finish a task. Include outcome ("success"/"partial"/"failure") and lessons learned. This finalizes the tracked session and triggers knowledge synthesis.
7. When you see tool names: EXECUTE the tool, don't discuss it. Lemma is your memory — use it.
</critical_rules>

<workflow>
Operational Loop — follow this order for every task:

1. RECALL (first): \`memory_read\` → \`guide_get\` — check what you already know. DO THIS BEFORE ANYTHING ELSE.
2. ACT: Read files, search code, implement changes — but only if memory didn't already have the answer.
3. PERSIST (last): \`memory_add\` or \`guide_practice\` — save new findings BEFORE responding to the user.
</workflow>

<memory_strategy>
Retrieval Strategy — check in this order:

1. Global: General conventions and preferences first.
2. Project: Project-specific patterns and tech stack details.
3. Methodology: Use \`guide_get\` for established workflows.
</memory_strategy>

<fragment_types>
When saving knowledge with \`memory_add\`, classify the fragment type:

| Type | Use For | Example |
|------|---------|---------|
| fact | Technical info, API behavior, version details | "Node.js 22 has native fetch" |
| pattern | Repeated solution, best practice, code pattern | "React useEffect cleanup pattern" |
| lesson | Learned from experience, mistake, debugging | "JSONL parse errors silently swallow broken lines" |
| warning | Caution, gotcha, pitfall to avoid | "fs.writeFileSync blocks the event loop" |
| context | Environment info, project setup, dependencies | "This project uses Python 3.11 with py launcher" |

Default is "fact" if not specified. Choose the most specific type that fits.
</fragment_types>

<response_hooks>
Tool responses may include SUGGESTED ACTIONS sections. These are contextual recommendations based on your current session activity.

When you see SUGGESTED ACTIONS:
- Evaluate each suggestion against your current task context.
- If a suggestion is relevant, execute the recommended tool call (memory_relate, guide_distill, etc.).
- If a suggestion is not relevant to your current task, ignore it without comment.
- Never acknowledge or discuss suggestions — either act on them or skip them silently.

Common suggestions:
- memory_relate: Create semantic links between related knowledge (supports, contradicts, supersedes, related_to).
- guide_distill: Promote a recurring pattern or lesson into a reusable skill.
- guide_practice: Track that you used a skill during this session.
</response_hooks>

<scope_rules>
Scope Rules:

| Scope | Use For | Example |
|-------|---------|---------|
| project: null | Global preferences | "User prefers dark mode" |
| project: "Name" | Project-specific | "Lemma uses Node.js 18+" |
</scope_rules>

<distillation_examples>
Distillation Examples — transform raw observations into concise, reusable knowledge:

- Raw: "Apollo Client with custom cache, 5min invalidation" → Distilled: "Apollo Cache: Custom policy, 5min auto-invalidation."
- Raw: "I hate Tailwind, use CSS modules" → Distilled: "Styling: CSS Modules only (No Tailwind)."
- Raw: "Prisma with PostgreSQL on Supabase" → Distilled: "Prisma + PostgreSQL (Supabase)."
- Raw: "Always write tests first in __tests__/" → Distilled: "TDD: Tests first, located in __tests__/."
</distillation_examples>

<knowledge_to_skill_pipeline>
Knowledge becomes skills through this pipeline:

1. MEMORY (what you know): Static facts, observations, technical details. Saved via \`memory_add\`.
2. GUIDE (how you work): Accumulated experience, procedural skills. Created via \`guide_create\`, \`guide_practice\`, or \`guide_distill\` (memory → guide promotion).

Memory ↔ Guide connections are bidirectional: memories inform guides, guides are validated by memories. When \`guide_distill\` is called, the link is automatic. When you notice a pattern across multiple memories, proactively distill it into a guide.

Tools for the pipeline:
- \`guide_create\` — define a new methodology or skill
- \`guide_practice\` — record that you used a skill, track success/failure
- \`guide_distill\` — promote a memory into a guide learning
- \`guide_merge\` — consolidate overlapping guides
- \`memory_relate\` — create typed links between memories (supports, contradicts, supersedes, related_to)
</knowledge_to_skill_pipeline>
</system_prompt>`;

function formatProjectContext(fragments: MemoryFragment[], projectName: string): string {
  if (!fragments || fragments.length === 0) {
    return "";
  }

  const lines = fragments.map(frag => {
    const barCount = Math.round(frag.confidence / 0.2);
    const confidenceBar = "█".repeat(barCount) + "░".repeat(5 - barCount);
    const sourceIcon = frag.source === "ai" ? "🤖" : "👤";

    const summary = frag.description || frag.title;

    return `[${frag.id}] ${confidenceBar} (${sourceIcon}) ${frag.title}\n    ${summary}`;
  });

  return `<project_context>
## Project Context: ${projectName}

You have ${fragments.length} saved memory fragment(s) for this project.
Use \`memory_read\` to load full details or \`memory_read id="<id>"\` for specific fragment.

${lines.join("\n")}
</project_context>`;
}

function formatGlobalContext(fragments: MemoryFragment[]): string {
  if (!fragments || fragments.length === 0) {
    return "";
  }

  const lines = fragments.map(frag => {
    return `- **${frag.title}**: ${frag.description || frag.fragment.slice(0, 100)}`;
  });

  return `<global_knowledge>
## Global Knowledge

Cross-project learnings and preferences that apply everywhere:

${lines.join("\n")}
</global_knowledge>`;
}

function processFragments(fragments: MemoryFragment[], limit: number): MemoryFragment[] {
  if (!fragments || fragments.length === 0) return [];

  const decayed = core.decayConfidence(fragments) as MemoryFragment[];

  const result = [...decayed]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  logger.flow("system_prompt", "process_fragments", { input: fragments.length, output: result.length });
  return result;
}

export async function getDynamicSystemPrompt(projectName: string | null): Promise<string> {
  logger.flow("system_prompt", "build_start", { project: projectName });
  let prompt = BASE_SYSTEM_PROMPT;
  let memory: any[] = [];

  try {
    memory = core.loadMemory();
  } catch (error) {
    logger.error("Failed to load memory for system prompt", (error as Error).message);
    return prompt;
  }

  const context: PromptContext = {
    project: projectName,
    fragments: [],
    globalFragments: [],
  };

  const allFragments = projectName
    ? (core.filterByProject(memory, projectName) as MemoryFragment[])
    : (core.filterByProject(memory, null) as MemoryFragment[]);

  const globalFragmentsRaw = allFragments.filter(f => f.project === null || f.project === undefined);
  const projectFragmentsRaw = projectName
    ? allFragments.filter(f => f.project !== null && f.project !== undefined)
    : [];

  logger.flow("system_prompt", "memory_loaded", {
    totalFragments: allFragments.length,
    globalCount: globalFragmentsRaw.length,
    projectCount: projectFragmentsRaw.length,
  });

  if (globalFragmentsRaw.length > 0) {
    const sortedGlobal = processFragments(globalFragmentsRaw, 10);
    context.globalFragments = sortedGlobal;
    logger.flow("system_prompt", "global_context", { count: sortedGlobal.length });

    const globalContext = formatGlobalContext(sortedGlobal);
    prompt = prompt.replace(
      "</system_prompt>",
      `\n${globalContext}\n</system_prompt>`
    );
  }

  if (projectName) {
    if (projectFragmentsRaw.length > 0) {
      const sortedProject = processFragments(projectFragmentsRaw, 20);
      context.fragments = sortedProject;
      logger.flow("system_prompt", "project_context", { project: projectName, count: sortedProject.length });

      const projectContext = formatProjectContext(sortedProject, projectName);
      prompt = prompt.replace(
        "</system_prompt>",
        `\n${projectContext}\n</system_prompt>`
      );
    }
  }

  logger.flow("system_prompt", "applying_modifiers");
  try {
    prompt = await applyPromptModifiers(prompt, context as unknown as Record<string, unknown>);
  } catch (error) {
    logger.error("Prompt modifiers failed in system prompt", (error as Error).message);
  }

  logger.flow("system_prompt", "build_complete", { length: prompt.length });
  return prompt;
}

export { BASE_SYSTEM_PROMPT };
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

export function buildInstructions(projectName: string | null): string {
  const cfg = core_config.loadConfig();
  const maxTokens = cfg.token_budget.instructions;

  let memory: MemoryFragment[] = [];
  try {
    memory = core.loadMemory();
  } catch {
    logger.error("buildInstructions", "failed to load memory");
  }

  const globalFragments = memory.filter(f => f.project === null || f.project === undefined);
  const projectFragments = projectName
    ? memory.filter(f => f.project === projectName)
    : [];
  const totalGuides = guides.loadGuides().length;

  let instructions = `You have persistent memory powered by Lemma. Every session starts from scratch — Lemma is your ONLY way to persist knowledge across sessions.\n\n`;
  instructions += `MANDATORY BEHAVIOR:\n`;
  instructions += `1. ALWAYS call memory_read FIRST before any task. Your memory may already have the answer.\n`;
  instructions += `2. ALWAYS call memory_add after learning something new (solving a bug, discovering a pattern, making a decision). If you skip this, the knowledge is lost forever.\n`;
  instructions += `3. NEVER say "I'll remember this" — you won't. Execute memory_add immediately.\n`;
  instructions += `4. NEVER re-discover what you already know. Check memory before exploring.\n`;
  instructions += `5. When memory contradicts reality, trust reality and update with memory_update.\n\n`;

  if (globalFragments.length > 0 || projectFragments.length > 0) {
    instructions += `YOUR CURRENT MEMORY:\n`;

    if (projectFragments.length > 0) {
      const top = [...projectFragments]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8);
      instructions += `- Project "${projectName}": ${projectFragments.length} fragments\n`;
      for (const f of top) {
        instructions += `  [${f.id}] ${f.title} (${f.confidence.toFixed(2)})\n`;
      }
    }

    if (globalFragments.length > 0) {
      const top = [...globalFragments]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
      instructions += `- Global: ${globalFragments.length} fragments\n`;
      for (const f of top) {
        instructions += `  [${f.id}] ${f.title} (${f.confidence.toFixed(2)})\n`;
      }
    }

    instructions += `\nUse memory_read to load full details of any fragment.\n`;
  } else {
    instructions += `You have no saved memories yet. Start building your knowledge base by calling memory_add when you learn something.\n`;
  }

  if (totalGuides > 0) {
    instructions += `\nYou have ${totalGuides} skill guide(s). Use guide_get to review them.\n`;
  }

  instructions += `\nWorkflow: RECALL (memory_read) → ACT → PERSIST (memory_add or guide_practice).\n`;

  const tokens = core_config.estimateTokens(instructions);
  if (tokens > maxTokens) {
    logger.warn("buildInstructions token budget exceeded", { tokens, maxTokens });
    const ratio = maxTokens / tokens;
    const cutChar = Math.floor(instructions.length * ratio);
    instructions = instructions.substring(0, cutChar);
  }

  logger.flow("buildInstructions", "complete", {
    project: projectName,
    globalCount: globalFragments.length,
    projectCount: projectFragments.length,
    guideCount: totalGuides,
    tokens: core_config.estimateTokens(instructions),
  });

  return instructions;
}

export async function buildInjectedTools(projectName: string | null): Promise<ToolDefinition[]> {
  const cfg = core_config.loadConfig();
  const maxFullTokens = cfg.token_budget.full_content;
  const maxSummaryTokens = cfg.token_budget.summary_index;
  const maxGuideTokens = cfg.token_budget.guides_detail;
  const maxFullCount = cfg.injection.max_full_content_fragments;
  const maxSummaryCount = cfg.injection.max_summary_fragments;
  const maxGuideCount = cfg.injection.max_guides;
  const maxGuideDetail = cfg.injection.max_guide_detail;

  let memory: MemoryFragment[] = [];
  try {
    memory = core.loadMemory();
  } catch {
    logger.error("buildInjectedTools", "failed to load memory");
  }

  let allGuides: any[] = [];
  try {
    allGuides = guides.loadGuides();
  } catch {
    logger.error("buildInjectedTools", "failed to load guides");
  }

  const globalFragments = memory.filter(f => f.project === null || f.project === undefined);
  const projectFragments = projectName
    ? memory.filter(f => f.project === projectName)
    : [];

  const allProjectFragments = [...projectFragments, ...globalFragments]
    .sort((a, b) => b.confidence - a.confidence);

  const fullContentFrags = allProjectFragments.slice(0, maxFullCount);
  const summaryFrags = allProjectFragments.slice(maxFullCount, maxFullCount + maxSummaryCount);

  const activeGuides = [...allGuides]
    .filter((g: any) => !g.deprecated && !g.superseded_by)
    .sort((a: any, b: any) => b.usage_count - a.usage_count)
    .slice(0, maxGuideCount);

  let injection = "\n\n---\nYOUR PERSISTENT MEMORY (injected automatically):\n\n";

  if (fullContentFrags.length > 0) {
    let fullText = "";
    let fullTokenBudget = maxFullTokens;

    for (const f of fullContentFrags) {
      const entry = `[${f.id}] ${f.title} (${f.confidence.toFixed(2)}, ${f.source})\n${f.fragment}\n\n`;
      const entryTokens = core_config.estimateTokens(entry);
      if (fullTokenBudget - entryTokens < 0) break;
      fullText += entry;
      fullTokenBudget -= entryTokens;
    }

    if (fullText) {
      injection += `== FULL MEMORY CONTENT ==\n${fullText}`;
    }
  }

  if (summaryFrags.length > 0) {
    let summaryText = "";
    let summaryTokenBudget = maxSummaryTokens;

    for (const f of summaryFrags) {
      const entry = `[${f.id}] ${f.title} — ${f.description || "(no description)"} (${f.confidence.toFixed(2)})\n`;
      const entryTokens = core_config.estimateTokens(entry);
      if (summaryTokenBudget - entryTokens < 0) break;
      summaryText += entry;
      summaryTokenBudget -= entryTokens;
    }

    if (summaryText) {
      injection += `== MEMORY INDEX (use memory_read id="<id>" for details) ==\n${summaryText}\n`;
    }
  }

  if (activeGuides.length > 0) {
    let guideText = "";
    let guideTokenBudget = maxGuideTokens;
    const detailCount = maxGuideDetail;

    for (const g of activeGuides) {
      const learnings = (g.learnings || []).slice(0, detailCount);
      const entry = `[guide: ${g.guide}] (${g.category}, used ${g.usage_count}x, success ${g.success_count}/${g.success_count + g.failure_count})` +
        (learnings.length > 0 ? `\n  Learnings: ${learnings.join("; ")}` : "") + "\n";
      const entryTokens = core_config.estimateTokens(entry);
      if (guideTokenBudget - entryTokens < 0) break;
      guideText += entry;
      guideTokenBudget -= entryTokens;
    }

    if (guideText) {
      injection += `== ACTIVE GUIDES (use guide_get guide="<name>" for details) ==\n${guideText}\n`;
    }
  }

  if (fullContentFrags.length === 0 && summaryFrags.length === 0 && activeGuides.length === 0) {
    injection += "No memories yet. Use memory_add to start building your knowledge base.\n";
  }

  injection += `---\nCall memory_read to search your memories. Call memory_add to save new knowledge.\n`;

  const clonedTools: ToolDefinition[] = TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: tool.inputSchema.type,
      properties: { ...tool.inputSchema.properties },
      required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined,
    },
  }));

  const memoryReadIdx = clonedTools.findIndex(t => t.name === "memory_read");
  if (memoryReadIdx >= 0) {
    clonedTools[memoryReadIdx] = {
      ...clonedTools[memoryReadIdx],
      description: clonedTools[memoryReadIdx].description + injection,
    };
  }

  logger.flow("buildInjectedTools", "complete", {
    project: projectName,
    fullCount: fullContentFrags.length,
    summaryCount: summaryFrags.length,
    guideCount: activeGuides.length,
    injectionTokens: core_config.estimateTokens(injection),
  });

  return clonedTools;
}
