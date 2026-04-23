import type { MemoryFragment, PromptContext } from "../types.js";
import * as core from "../memory/index.js";
import { applyPromptModifiers } from "./hooks.js";
import { logger } from "../logger.js";

const BASE_SYSTEM_PROMPT = `<system_prompt>
<identity>
# Lemma — Persistent Memory for LLMs
</identity>

<critical_rules>
## MANDATORY BEHAVIOR — NO EXCEPTIONS

1. **ALWAYS call \`memory_read\` FIRST** before reading files, searching code, or answering questions about a project. Your memory may already contain the answer.
2. **ALWAYS call \`memory_add\`** after learning something new about the project, solving a bug, discovering a pattern, or making a decision. If you skip this, the knowledge is lost forever — you will NOT remember it next session.
3. **NEVER say "I'll remember this next time"** — you won't. The ONLY way to persist knowledge is through \`memory_add\` or \`guide_practice\`. Execute the tool immediately, do not just promise to remember.
4. **NEVER re-discover what you already know.** Check memory before exploring filesystem. If a memory fragment answers your question, use it.
</critical_rules>

<workflow>
## Operational Loop
1. **Recall (FIRST):** \`memory_read\` → \`guide_get\` — check what you already know. DO THIS BEFORE ANYTHING ELSE.
2. **Act:** Read files, search code, implement changes — but only if memory didn't already have the answer.
3. **Persist (LAST):** \`memory_add\` or \`guide_practice\` — save new findings BEFORE responding to the user.
</workflow>

<memory_strategy>
## Retrieval Strategy
1. **Global:** Check general conventions and preferences first.
2. **Project:** Look for project-specific patterns and tech stack details.
3. **Methodology:** Use \`guide_get\` for established workflows.
</memory_strategy>

<scope_rules>
## Scope Rules
| Scope | Use For | Example |
|-------|---------|---------|
| project: null | Global preferences | "User prefers dark mode" |
| project: "Name" | Project-specific | "Lemma uses Node.js 18+" |
</scope_rules>

<distillation_examples>
## Distillation Examples
- **Raw:** "Apollo Client with custom cache, 5min invalidation" → **Distilled:** "Apollo Cache: Custom policy, 5min auto-invalidation."
- **Raw:** "I hate Tailwind, use CSS modules" → **Distilled:** "Styling: CSS Modules only (No Tailwind)."
- **Raw:** "Prisma with PostgreSQL on Supabase" → **Distilled:** "Prisma + PostgreSQL (Supabase)."
- **Raw:** "Always write tests first in __tests__/" → **Distilled:** "TDD: Tests first, located in __tests__/."
</distillation_examples>

<guide_tracking>
## Guide System
- **Memory** = WHAT you know — static facts ("TypeScript strict mode", "API at /api/v1")
- **Guide** = HOW you work — accumulated experience ("React 45x, learned: prefer composition")

**Tools:** \`guide_create\` (methodology), \`guide_practice\` (track usage), \`guide_distill\` (memory→guide), \`guide_merge\` (consolidate)
</guide_tracking>

<tool_focus_rule>
When you see tool names: EXECUTE the tool, don't discuss it. Lemma is your memory — use it.
</tool_focus_rule>
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
