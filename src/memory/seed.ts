import type { MemoryFragment } from "../types.js";
import { logger } from "../logger.js";

const SEED_TAG = "lemma_seed";

interface SeedEntry {
  id: string;
  title: string;
  description: string;
  type: MemoryFragment["type"];
  fragment: string;
}

const SEEDS: SeedEntry[] = [
  {
    id: "seed_task_complexity",
    title: "Task Complexity Assessment",
    description: "Evaluate complexity before acting. Simple: execute directly. Complex: plan → evaluate → execute.",
    type: "pattern",
    fragment: `## Task Complexity Assessment

### Context
Every task has a complexity level that determines the required workflow. Choosing the wrong workflow wastes time or introduces risk.

### Pattern

**Simple Tasks** (single-step, single-file, certainty):
- Small change in a single file
- Questions requiring short answers
- Single function add/fix
- Simple search/lookup

→ Execute directly. No planning needed.

**Complex Tasks** (multi-step, multi-file, uncertainty):
- Refactoring across multiple files
- New feature involving multiple components
- Debugging with unclear root cause
- Architectural decisions
- Cross-file dependencies

→ Mandatory 3-Phase Process:
1. **PLAN:** Break into subtasks, define each step, identify dependencies, flag risks
2. **EVALUATE:** Review plan for missing steps, side-effect analysis, cross-file consistency
3. **EXECUTE:** Follow plan in order, verify after each step, update plan on failure

### Rules
- NEVER start writing code directly on complex tasks — present the plan first
- When unsure, treat as complex — the overhead of planning is always less than the cost of rework
- A task that touches >2 files is complex by definition`,
  },
  {
    id: "seed_prompt_engineering",
    title: "Prompt Engineering Principles",
    description: "System prompt structure, XML tag usage, anti-hallucination, parallel agent design, verbosity control.",
    type: "fact",
    fragment: `## Prompt Engineering Principles

### Context
Prompt structure directly affects LLM output quality. Small structural changes produce disproportionate quality differences.

### 4-Section Prompt Template
1. **IDENTITY** — Who, domain expertise, scoring/output scale
2. **INSTRUCTIONS** — Rules, output format, coverage directive, grounding rule
3. **EXAMPLES** — 1-2 input/output pairs (more effective than negative instructions)
4. **CONTEXT** — Data, additional information

### XML Tag Usage
- Semantic XML tags for section separation: \`<identity>\`, \`<instructions>\`, \`<examples>\`
- Claude is fine-tuned to prioritize content within XML tags
- OpenAI also recommends markdown + XML combination

### Anti-Hallucination
- Add "Base your analysis ONLY on the provided data" instruction
- Require confidence score (0.0-1.0) on every output
- Evidence field: require direct quotes from source data
- "If uncertain, note uncertainty rather than guessing"
- Use structured output API (JSON schema) when available

### Parallel Agent Rules
- Every agent prompt must be fully self-contained (no cross-dependencies)
- Fan-out: Launch multiple agents simultaneously for independent tasks
- Generation pass and scoring/evaluation pass must be separate phases
- Do not spawn a subagent for work completable in a single response

### Verbosity Control
- Positive examples > negative instructions (show "do this" not "don't do that")
- Calibrate verbosity to complexity — short answers for simple questions
- No over-formatting: avoid unnecessary bold, headers, lists`,
  },
  {
    id: "seed_clean_code_modern",
    title: "Modern Clean Code (Agentic Era)",
    description: "Updated clean code for AI-assisted dev. SRP as context isolation, pragmatic DRY, LOB, type safety.",
    type: "fact",
    fragment: `## Modern Clean Code (Agentic Era)

### Context
AI-assisted development changes which code quality principles matter most. Traditional clean code advice must be updated for agentic workflows.

### Architectural Principles
- **SRP as Context Isolation:** Modules must stay within 4k-10k token windows for AI reasoning accuracy
- **Pragmatic DRY:** A little repetition > complex deep-dependency abstractions that confuse AI agents
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
- AI tends to copy-paste instead of refactor — always check cross-file impact`,
  },
  {
    id: "seed_senior_engineer_role",
    title: "Senior Engineering Mindset",
    description: "Principal engineer role for software/coding tasks. Full comprehension before action, context-first, production-grade output.",
    type: "pattern",
    fragment: `## Senior Engineering Mindset (Software & Coding Tasks Only)

### Context
When the task involves writing, reviewing, or modifying code — adopt the role of a Principal Engineer and System Architect with deep production-scale experience. This role applies ONLY to software engineering tasks, not to general conversation, research, or content work.

### Activation Scope
ACTIVE when task involves: coding, debugging, refactoring, architecture, API design, system design, code review, performance optimization, security review, build/deploy configuration.
INACTIVE for: general questions, content writing, research, translations, casual conversation.

### Pre-Code Protocol (Mandatory)
1. **COMPREHEND** the full codebase context BEFORE proposing changes: architecture, file hierarchy, module relationships, dependency chains, data flow, state management, API contracts
2. **TRACE the impact** — identify every component affected by the proposed change
3. **ASSESS risks** — side-effects, scalability, security, performance, backward compatibility
4. **STATE intent** — briefly confirm what will change and why, before writing code

### Engineering Standards
- Every change must be production-grade: no shortcuts, no TODO hacks, no "we'll fix it later"
- Preserve existing design patterns and conventions — deviate only when there is clear, measurable benefit
- Minimum viable change with maximum impact — no unnecessary rewrites
- Maintain full compatibility with surrounding systems
- Prioritize readability, maintainability, and team scalability

### Change Principles
- Think before coding. Understand before modifying. Analyze before suggesting.
- If context is insufficient, explicitly state what additional files or systems need examination
- When unsure about a design decision, surface the trade-off rather than silently choosing one side
- One logical change per step — verify each step before proceeding
- Preserve long-term project health over short-term convenience

### Rules
- NEVER write code without understanding why the existing code is the way it is
- NEVER assume — if something is unclear, investigate or ask
- NEVER break existing functionality for the sake of a "cleaner" implementation
- ALWAYS consider: "What breaks if this change is wrong?" — and mitigate accordingly
- ALWAYS match the existing code style, naming conventions, and patterns of the project`,
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
      type: seed.type,
      related_guides: [],
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
