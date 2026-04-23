import type { MemoryFragment } from "../types.js";
import { logger } from "../logger.js";

const SEED_TAG = "lemma_seed";

interface SeedEntry {
  id: string;
  title: string;
  description: string;
  fragment: string;
}

const SEEDS: SeedEntry[] = [
  {
    id: "seed_task_complexity",
    title: "Task Complexity Assessment — Simple vs Complex Workflow",
    description: "Evaluate complexity before acting. Simple tasks: execute directly. Complex tasks: mandatory plan → evaluate → execute step-by-step.",
    fragment: `## Task Complexity Assessment

Before starting any task, evaluate its complexity:

### Simple Tasks (single-step resolution)
- Small change in a single file
- Questions requiring short answers
- Single function add/fix
- Simple search/lookup

**Approach:** Execute directly. No planning needed.

### Complex Tasks (multi-step, multi-file, uncertainty)
- Refactoring across multiple files
- New feature involving multiple components
- Debugging with unclear root cause
- Architectural decisions
- Cross-file dependencies

**Approach — Mandatory 3-Phase Process:**

**1. PLAN:**
- Break the request into subtasks
- Define each step clearly
- Identify file and component dependencies
- Flag risky points and unknowns

**2. EVALUATE:**
- Review the plan: any missing steps?
- Side-effect analysis: what else does this change affect?
- Cross-file consistency check
- Revise plan if needed

**3. EXECUTE STEP-BY-STEP:**
- Follow the plan in order
- Verify after each step
- On failure: go back and update the plan
- Final verification after all steps complete

### Rule
NEVER start writing code directly on complex tasks. Present the plan first, then execute it faithfully.`,
  },
  {
    id: "seed_prompt_engineering",
    title: "Prompt Engineering — System Prompt & Agent Design Principles",
    description: "Principles for writing system prompts and creating parallel agents. Claude + OpenAI best practices synthesis.",
    fragment: `## Prompt Engineering Principles

### Prompt Structure (4-Section Template)
Every prompt should follow this order:

1. **IDENTITY** — Who, what they do, domain expertise, scoring/output scale
2. **INSTRUCTIONS** — Rules, output format, coverage directive, grounding rule
3. **EXAMPLES** — 1-2 input/output pairs (more effective than negative instructions)
4. **CONTEXT** — Data, additional information

### XML Tag Usage
- Use semantic XML tags for section separation: \`<identity>\`, \`<instructions>\`, \`<examples>\`
- Claude is specifically fine-tuned to prioritize content within XML tags
- OpenAI also recommends markdown + XML combination

### Anti-Hallucination Rules
- Add "Base your analysis ONLY on the provided data" instruction
- Require confidence score (0.0-1.0) on every output
- Evidence field: require direct quotes from source data
- "If uncertain, note uncertainty rather than guessing"
- Use structured output API (JSON schema) when available

### Parallel Agent Rules
- Every agent prompt must be fully self-contained (no cross-dependencies)
- Fan-out: Launch multiple agents simultaneously for independent tasks (Promise.all)
- Generation pass and scoring/evaluation pass must be separate phases
- One agent's instructions do not generalize to another — each works in its own scope
- Do not spawn a subagent for work completable in a single response

### Verbosity Control
- Positive examples > negative instructions (show "do this" instead of "don't do that")
- Calibrate verbosity to complexity — short answers for simple questions
- No over-formatting: avoid unnecessary bold, headers, lists`,
  },
  {
    id: "seed_clean_code_modern",
    title: "Modern Clean Code — Agentic Era Practices",
    description: "Updated clean code principles for AI-assisted development. SRP, LOB, type safety, naming conventions.",
    fragment: `## Modern Clean Code (Agentic Era)

### Architectural Principles
- **SRP as Context Isolation:** Modules must stay within 4k-10k token windows for AI reasoning accuracy
- **Pragmatic DRY:** A little repetition is preferred over complex, deep-dependency abstractions that confuse AI agents
- **Locality of Behavior (LOB):** Feature-grouping over role-grouping for faster context retrieval
- **Naming as Metadata:** Explicit, unambiguous naming is the primary signal for AI logic correlation

### Type Safety
- TypeScript/Rust strict type systems reduce AI hallucination rates by ~40% in refactoring
- Runtime validation (Zod, io-ts) mandatory at API boundaries
- Avoid any/unknown, define explicit types

### Structural Rules
- Functions should do one thing, stay under 50 lines
- Files over 300 lines should be considered for splitting
- Import depth maximum 3 levels
- Circular dependencies forbidden

### AI-Assisted Development Caveats
- AI-generated code produces 48% more duplicate blocks — be intentional
- Code churn increases from 3.1% to 5.7% with AI adoption — don't neglect refactoring
- "Moved" lines dropped from 24.1% to 9.5% — AI tends to copy-paste instead of refactor
- Always check cross-file impact after every AI-suggested change`,
  },
];

export function seedMemory(memory: MemoryFragment[]): { seeded: number; skipped: number } {
  const existingIds = new Set(memory.map(f => f.id));
  let seeded = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    if (existingIds.has(seed.id)) {
      skipped++;
      continue;
    }

    const now = new Date();
    const fragment: MemoryFragment = {
      id: seed.id,
      title: seed.title,
      description: seed.description,
      fragment: seed.fragment,
      project: null,
      confidence: 1.0,
      source: "ai",
      created: now.toISOString().split("T")[0] ?? "",
      lastAccessed: now.toISOString(),
      accessed: 0,
      tags: [SEED_TAG],
      associatedWith: [],
      relations: [],
      negativeHits: 0,
      quality_score: null,
      refinement_count: 0,
      parent_id: null,
      child_ids: [],
      session_id: null,
      task_type: null,
      outcome: null,
      positive_feedback: 0,
      negative_feedback: 0,
      last_refined: null,
    };

    memory.push(fragment);
    seeded++;
    existingIds.add(seed.id);
  }

  if (seeded > 0) {
    logger.info(`Seeded ${seeded} new built-in entries (${skipped} already existed)`);
  }

  return { seeded, skipped };
}

export function getSeedCount(): number {
  return SEEDS.length;
}

export function getSeedIds(): string[] {
  return SEEDS.map(s => s.id);
}
