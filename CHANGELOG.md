# Changelog

## [0.8.1] - 2026-04-20

### Added — Active Memory Engine

Inspired by [LLM Wiki v2](https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2) (@rohitg00). Six features transforming Lemma from a passive memory store into an active memory engine.

- **Privacy Filtering** — `memory_add` automatically scans for secrets (API keys, tokens, passwords, connection strings, private keys) and redacts them with `[REDACTED:type]` labels. Use `confirm: true` to store as-is.
  - 17 regex patterns: OpenAI keys, GitHub tokens, Slack tokens, AWS keys, MongoDB/PostgreSQL/MySQL/Redis connection strings, webhook secrets, Bearer tokens, private keys, password assignments
  - New file: `src/memory/privacy.ts` with `scanForSecrets()` and `redactSecrets()`
  - New param: `confirm` on `memory_add`

- **Query Filters** — `memory_read` now supports `minConfidence`, `afterDate`, and `beforeDate` parameters for structured querying.
  - "What did I learn last week?" → `afterDate="2026-04-13"`
  - "High-confidence memories only" → `minConfidence=0.7`
  - New function: `filterFragments()` in core

- **Smart session_start** — `session_start` now pre-loads top-3 relevant memories based on task_type + technologies, so the LLM sees relevant context immediately without calling `memory_read`.
  - Fragments are searched via `searchAndSortFragments(taskDesc, 3)` and included in response
  - Pre-loaded fragments get confidence boost (via `boostOnAccess`)

- **Topic Overlap Detection** — `memory_add` now detects topic-related (but not duplicate) fragments and suggests them in the response.
  - Uses Fuse.js with 40-65% similarity range (below dedup threshold)
  - New function: `findTopicOverlaps()` in core
  - Suggestions include fragment ID, title, and confidence
  - Prompts: "Does this update or contradict existing knowledge?"

- **Typed Relations** — New `memory_relate` tool creates typed links between fragments.
  - Relation types: `contradicts`, `supersedes`, `supports`, `related_to`
  - Bidirectional: reverse relation auto-created on target
  - New interface: `MemoryRelation` in types.ts
  - New field: `relations: MemoryRelation[]` on MemoryFragment
  - `formatMemoryDetail` shows relations
  - `memory_audit` detects orphan relations
  - Tool count: 20 → 21

- **Injection Ranking** — Memory injection now uses composite score instead of pure confidence.
  - Formula: `confidence * 0.7 + recency * 0.3` where recency decays over 180 days
  - Recent knowledge (2 days old, 0.72 confidence) now surfaces above old knowledge (6 months, 0.95)
  - Applied in all 3 sort paths of `searchAndSortFragments`

### Changed
- `src/types.ts` — Added `MemoryRelation` interface and `relations` field on `MemoryFragment`
- `src/memory/core.ts` — Added `filterFragments`, `findTopicOverlaps`, `addRelation`, `injectionScore`, updated `formatMemoryDetail`, `auditMemory`
- `src/memory/index.ts` — New exports: `scanForSecrets`, `redactSecrets`, `filterFragments`, `findTopicOverlaps`, `addRelation`
- `src/server/handlers.ts` — Updated `handleMemoryAdd` (privacy + overlap), `handleMemoryRead` (filters), `handleSessionStart` (pre-load), new `handleMemoryRelate`
- `src/server/tools.ts` — Updated tool definitions, added `memory_relate`

### Tests
- **415 tests** passing (+55 from 360), 0 failures
- New test files: `privacy.test.ts` (14), `filter.test.ts` (11), `session-preload.test.ts` (5), `topic-overlap.test.ts` (5), `relations.test.ts` (9), `injection-ranking.test.ts` (5)

### Documentation
- Added `docs/llm-wiki-v2.md` — LLM Wiki v2 reference document by @rohitg00

---

## [0.7.4] - 2026-04-19

### Fixed
- **Critical: Universal Memory Injection broken in MCP clients (Kilo Code, Cursor, Claude Desktop, etc.)** — Memory fragments were never injected into tool descriptions because clients cache `tools/list` on session start and never re-fetch.
  - Added `listChanged: true` to server capabilities so clients listen for tool change notifications
  - Server now sends `notifications/tools/list_changed` on every memory change (`memory_add`, `memory_update`, `memory_forget`, `memory_feedback`, `memory_merge`)
  - Clients re-fetch `tools/list` → `buildToolsWithMemory()` runs with updated memory → LLM sees current context
- **Global fragments injected twice** — `filterByProject(projectName)` already includes global fragments, but all 3 injection paths (`buildToolsWithMemory`, `buildDynamicInstructions`, `getDynamicSystemPrompt`) also called `filterByProject(null)` separately and concatenated results. Fixed to use a single filtered list.
- **Hardcoded injection limits ignoring config** — `buildToolsWithMemory` used hardcoded values (`maxFrags=10→15`, `remaining.slice(0,15)`, `getTopGuides(_,5)`) instead of reading from `config.injection.*`. Now respects `max_full_content_fragments`, `max_summary_fragments`, and `max_guides` from config.

### Changed
- `buildToolsWithMemory` and `buildDynamicInstructions` exported for testability
- `setDetectedProject()` helper added for testing
- Added 5 new tests verifying no duplicate fragment injection and config limit respect

---

## [0.7.2] - 2026-04-19

### Fixed
- **Critical: Confidence death spiral** — Decay was applied to ALL fragments every session start, including actively used ones. Average confidence dropped from 0.52 to 0.04 across 339 fragments. Rewritten with biological memory model:
  - **Shield**: Fragments with `accessed > 0` are completely protected from decay
  - **Slow decay**: Unused fragments decay at only -0.002 per session (was 0.005-0.05)
  - **Slow boost**: Access boost reduced to +0.015 (was +0.1) for gradual, lasting growth
  - **Slow penalty**: Negative feedback reduced to -0.02 (was -0.1)
  - **No time-based decay**: Confidence only changes when the system is actively used

### Added
- **`migrateConfidenceFloor()`** — One-time migration that boosts fragments below 0.3 to 0.3 floor on startup. Runs automatically on first launch after update.

### Changed
- **README (EN/TR)** — Learning System section updated with new rates and shield behavior
- **361 tests** — All passing with updated confidence rate assertions

---

## [0.7.0] - 2026-04-19

### Breaking Changes
- **TypeScript Migration** — Entire codebase migrated from JavaScript to TypeScript (strict mode)
  - All source files: `.js` → `.ts`
  - Shared type definitions in `src/types.ts` (15+ interfaces)
  - Full type annotations on all function parameters and return types
  - `noUncheckedIndexedAccess` and `noImplicitOverride` enabled

### Added
- **npm Package** — Published to [npmjs.com/package/lemma-mcp](https://www.npmjs.com/package/lemma-mcp)
  - Install: `npx lemma-mcp` or `npm install lemma-mcp`
  - SDK exports: `import { ... } from "lemma-mcp/memory"`
- **TypeScript Infrastructure**
  - `tsconfig.json` — strict mode, Node16 module resolution, ES2022 target
  - `tsconfig.test.json` — type checking for test files
  - Build: `tsc` compiles to `dist/` with declarations and source maps
  - Test runner: `tsx` (replaces `node --test` for .ts files)
- **Shared Types** (`src/types.ts`)
  - `MemoryFragment`, `Guide`, `Session`, `VirtualSession`
  - `MemoryStats`, `AuditResult`, `GuideSuggestion`, `SuggestResult`
  - `LemmaConfig`, `HookContext`, `PromptContext`
  - `TaskType`, `TaskOutcome` union types
- **`files` field** in package.json — Only `dist/`, `README.md`, `LICENSE` included in npm package
- **`prepare` script** — Auto-builds on `npm install` (for GitHub installs)

### Changed
- **Import paths** — Hook/PromptModifier examples now use `lemma-mcp/server` instead of `@lemma/lemma/server`
- **Quick Start** — Changed from `npx github:xenitV1/lemma` to `npx lemma-mcp` (npm package)
- **Manual Installation** — Entry point changed from `src/index.js` to `dist/index.js`
- **Test runner** — From `node --test *.test.js` to `tsx --test *.test.ts`
- **Project structure** — All `.js` → `.ts` in README

### Removed
- **`tsup`** as primary build tool — Replaced with `tsc` for proper module structure
- **`vitest`** dependency — Not used, tests use `node:test` via `tsx`

### Tests
- 360 tests passing (all converted to TypeScript)
- 25 test files, 0 failures
- `npm run typecheck` — Zero errors across src + tests

---

## [0.6.1] - 2026-04-19

### Added
- **GitHub Actions CI** — Automated test pipeline on push/PR to main, Node.js 18/20/22 matrix
- **Modular Test Suite** — Tests refactored from single file to 28 modular files across 4 directories
  - `tests/memory/` — core, lifecycle, persistence, audit, stats, config, edge-cases (7 files)
  - `tests/guides/` — core, suggest, merge, update, fuzzy-match, detail-format (6 files)
  - `tests/sessions/` — core, virtual (2 files)
  - `tests/server/` — handlers-core, guide-handlers, guide-advanced, memory-read-advanced, memory-update-advanced, memory-merge-validation, memory-stats-audit, session-handlers, session-guide-interaction, injection (10 files)
- **250 new tests** — Coverage expanded from 110 to 360 tests
  - Memory: applySessionDecay, detectProject, generateId, concurrent writes, malformed JSONL, large datasets (1000 fragments), backup integrity, empty/null protection
  - Guides: formatGuideDetail (anti_patterns, pitfalls, success rate), getGuidesByCategory, getTopGuides, outcome tracking, context deduplication
  - Handlers: memory_read batch ids, all=true, query search; memory_update fragment/confidence/type validation; memory_merge validation; guide_create similar update; guide_merge auto-merge; guide_practice session linking; session start/end lifecycle with guide interaction
  - Sessions: core CRUD, virtual session tracking, session-guide interaction, improvement suggestions

### Changed
- **Test runner** — Migrated from manual `node tests/test.js` to `node --test tests/**/*.test.js` glob pattern
- **Package scripts** — Added `test:memory`, `test:guides`, `test:sessions`, `test:server` for module-specific runs
- **Removed monolithic `tests/test.js`** — All tests distributed to modular files

### Tests
- 360 tests passing (was 110)
- 28 test files (was 1)
- ~80% estimated coverage (was ~55%)

---

## [0.6.0] - 2026-04-18

### Inspired by Karpathy's LLM Wiki
- **Lint concept** — `memory_audit` tool inspired by Karpathy's wiki health-check idea (contradictions, orphans, gaps)
- **Always-available knowledge** — Universal tool description injection ensures memories are in LLM context without explicit tool calls

### Added
- **Universal Memory Injection** — Memories are now injected into tool descriptions via `tools/list`, guaranteeing ALL MCP clients (opencode, Claude Desktop, Cursor, VS Code, Gemini CLI) see full memory content without requiring explicit tool calls.
  - Top N memories injected as full content into `memory_read` tool description (~4000 tokens budget)
  - Remaining memories shown as compact index
  - Top 5 guides shown with learnings
  - Dual injection: `instructions` field (for clients that support it) + tool descriptions (universal fallback)
- **Config System** (`~/.lemma/config.json`) — User-configurable token budgets and injection limits
  - `token_budget.full_content` (default: 3000)
  - `token_budget.summary_index` (default: 1000)
  - `token_budget.guides_detail` (default: 1000)
  - `injection.max_full_content_fragments` (default: 15)
  - `virtual_session.timeout_minutes` (default: 30)
- **Virtual Session Tracking** (`src/sessions/virtual.js`) — Automatic session correlation without requiring explicit `session_start`/`session_end`
  - Auto-starts on first tool call, auto-finalizes after 30 min inactivity
  - Tracks tool calls, technologies seen, guides used, memories created/accessed
  - Sessions persisted to `~/.lemma/sessions/` as JSON files
  - `session_stats` tool to view virtual session statistics
- **3-Layer Injection Architecture** — `buildDynamicInstructions` rewritten with:
  - Layer 1: Base rules (~500 tokens)
  - Layer 2: Full content for high-confidence memories (token-budgeted)
  - Layer 3: Summary index for remaining memories
  - Layer 4: Active guides with descriptions
- **MCP Resource Notifications** — `notifications/resources/updated` sent after every memory change
  - New `lemma://context/current` resource with dynamically generated context
  - Clients that support resource subscriptions get live updates
- **`session_stats` tool** — View virtual session activity, technologies, and guide usage

### Changed
- **`ListToolsRequestSchema` handler** — Now dynamically builds tool descriptions with injected memory context on every `tools/list` call
- **System prompt** — Added `<critical_rules>` section with mandatory behavior rules (always call `memory_read` first, always call `memory_add` after learning)
- **`buildDynamicInstructions`** — Removed redundant `decayConfidence` call (already applied at startup)

---

## [0.5.0] - 2026-04-18

### Breaking Changes
- **JSR support removed** — `jsr.json` deleted. Use `npx -y github:xenitV1/lemma` instead of `npx -y jsr @lemma/lemma`.

### Fixed
- **Critical: memory_read was destructive** — Decay was applied and saved on every `memory_read` call, causing confidence death spiral. Decay now only persists at session boundary (`initializeContext` on startup). Read operations no longer modify confidence.
- **Critical: Jaccard dedup was semantically broken** — "Use React hooks" vs "Don't use React hooks" scored 0.75 (blocked as duplicate). Replaced with Fuse.js fuzzy matching at threshold 0.65 for accurate similarity detection.
- **Critical: No concurrent write protection** — Added module-level write lock (`saveMemorySafe`) to prevent data loss from overlapping writes.
- **High: Double context injection** — Both `buildDynamicInstructions` and `getDynamicSystemPrompt` produced overlapping data with double decay. Resource handler now returns static `BASE_SYSTEM_PROMPT` only. Dynamic context via initialize `instructions` is the single source.
- **High: User memories bypassed dedup** — `source === "ai"` check meant user duplicates were never caught. Dedup now applies to all sources.
- **High: Guide dedup missing** — "react", "reactjs", "react.js" created 3 separate guides. Added `findSimilarGuide` with Fuse.js fuzzy matching.
- **High: ID collision risk** — 6 hex chars (16M space, 50% collision at ~4,800 IDs). Replaced with `crypto.randomUUID`-based 12 hex chars (281 trillion space).
- **Redundant decay in buildDynamicInstructions** — Was applying decay a second time after `applySessionDecay` already ran on startup. Removed.

### Added
- **`memory_stats` tool** — Fragment counts, average confidence, project breakdown, high/low confidence counts.
- **`memory_audit` tool** — Integrity check for orphan references, duplicate IDs, confidence anomalies, malformed entries.
- **Batch read support** — `memory_read` now accepts `ids: string[]` for fetching multiple fragment details in one call.
- **`outcome` parameter on `guide_practice`** — Track success/failure rate without requiring session_end.
- **`guide_update` expanded** — Now supports `add_anti_patterns`, `add_pitfalls`, `superseded_by`, `deprecated` fields.
- **`<critical_rules>` in system prompt** — Mandatory behavior rules forcing LLM to always call `memory_read` first and `memory_add` after learning.
- **File locking** — `writeLock`/`writeQueue` mechanism prevents overlapping writes within same process.

### Changed
- **System prompt slimmed** — From ~1,300 tokens to ~500 tokens. Removed philosophical framing ("Recursive Cognitive Engine", "Agentic Sovereignty"). Kept operational instructions.
- **Compact formatting** — Replaced box-drawing characters (╔═══╗║╚╝) with simple markdown headers. Removed 14-space alignment padding.
- **`guide_practice` returns compact response** — One-liner confirmation instead of echoing full guide detail.
- **`guide_merge` merges all array fields** — Now also merges `anti_patterns` and `known_pitfalls`, not just contexts/learnings.
- **Dead guide fields removed** — `feedback_patterns` and `improvement_log` were never populated by any tool. Removed from schema.
- **Session tracking** — Added `session_start`/`session_end` tools with guide suggestions, success rate tracking, and improvement detection.
- **Feedback counters** — Memory fragments now track `positive_feedback` and `negative_feedback` counts.

### Removed
- **JSR support** — `jsr.json` deleted. README updated to show GitHub npx as sole installation method.
- **`calculateSimilarity` (Jaccard)** — Replaced entirely by Fuse.js-based `findSimilarFragment`.

### Tests
- All 110 tests passing. Fixed broken assertions (`filterByProject` count, `findSimilarFragment` threshold, system prompt title).

---

## [0.4.1] - 2026-03-20

### Changed
- **Streamlined Initialize Response** — Cleaner context display on MCP initialization
  - Added `buildDynamicInstructions()` for focused project context
  - Project memories + global memories shown in compact tables
  - Guides now show only name and category (no usage_count, learnings)
  - Removed verbose resource listing from `ListResourcesRequestSchema`
  - Memories and guides accessed exclusively via tools, not resources

---

## [0.4.0] - 2026-03-20

### Added
- **Dynamic System Prompt Generation** — System prompt now automatically injects project and global memory context at runtime
  - `getDynamicSystemPrompt(projectName)` — Async function that builds contextualized prompts
  - Global context section: Shows cross-project learnings and preferences (up to 10 fragments)
  - Project context section: Shows project-specific fragments with confidence bars and source icons (up to 20 fragments)
  - Automatic confidence decay applied for accurate relevance display
  - `</system_prompt>` injection point for seamless context embedding

- **Hook System** (`src/server/hooks.js`) — Pluggable lifecycle event system
  - `HookTypes.ON_START` — Triggered when server starts
  - `HookTypes.ON_PROJECT_CHANGE` — Triggered when project context changes
  - `registerHook(type, callback)` — Register callbacks, returns unregister function
  - `triggerHook(type, context)` — Execute all registered callbacks for a hook

- **Prompt Modifier System** — Extend system prompt generation with custom transformations
  - `registerPromptModifier(modifier)` — Add async functions that transform prompts
  - `applyPromptModifiers(prompt, context)` — Apply all modifiers in sequence
  - Context object provides: `{ project, fragments, globalFragments }`

- **Visual Context Formatting** — Enhanced readability in injected contexts
  - Confidence bars: `███░░` visual representation (5 blocks, 0.2 increments)
  - Source icons: 🤖 (AI-generated) / 👤 (user-provided)
  - Summary mode: Title + description only (full content via `memory_read`)

### Changed
- **Server Index** — Now uses `getDynamicSystemPrompt()` for resource requests
- **Handlers Refactored** — Simplified tool/resource handling with hook integration
- **Tools Module** — Streamlined tool definitions and registration
- **Memory/Guides Core** — Minor improvements for context retrieval

### Tests
- **+269 lines** of new tests covering hook system, prompt modifiers, and dynamic context injection

---

## [0.3.2] - 2026-03-20

### Changed
- **Simplified decay formula** — Removed `time_multiplier` and `negativeHitMultiplier` from `decayConfidence()`. Decay is now a flat rate based only on access frequency: `max(0.005, 0.05 - accessed * 0.005)`. Negative feedback still reduces confidence directly via `memory_feedback` (-0.1), but no longer accelerates decay over time.

## [0.3.1] - 2026-03-19

### Fixed
- **Critical: Memory data loss in `memory_read`** — Accessing memory within a project scope was mistakenly overwriting the main file with only the filtered project fragments, deleting all global and other project data. Fixed by separating full and filtered memory arrays during the save process.

## [0.3.0] - 2026-03-19

### Added
- **Memory Learning System** — Fragments now gain confidence when actively used, not just decay slower
  - `boostOnAccess()`: +0.1 confidence per use (max 1.0), context tagging, access counter
  - `recordNegativeHit()`: -0.1 confidence when memory is unhelpful, negative hit counter
  - `trackAssociations()`: Bidirectional cross-references between co-accessed fragments
  - New fragment fields: `tags`, `associatedWith`, `negativeHits`
- **`memory_feedback` Tool** — Provide positive/negative feedback on memory fragments after use
- **`memory_read` context parameter** — Tag fragments with usage context (e.g., "debugging", "refactoring") for future recall
- **Test Suite** — 90 tests covering all modules (memory core, guides core, handlers, learning lifecycle) with full I/O isolation

### Changed
- **Decay now factors negative hits** — Fragments marked unhelpful decay faster via `negativeHitMultiplier`
- **Negative hits reset per session** — Like `accessed`, `negativeHits` resets after each decay cycle
- **`saveMemory` / `saveGuides` accept `force` option** — Allows intentional empty array saves (for deletion operations)
- **`formatMemoryDetail`** — Shows `tags` and `associatedWith` fields when present

### Fixed
- **`handleMemoryForget`** — Saving empty array after deleting last fragment now works (was silently blocked by safety check)
- **`handleGuideForget`** — Same fix for guides deletion

## [0.2.3] - 2026-03-19

### Fixed
- **Critical: Memory data loss from decay** — `decayConfidence()` was permanently removing fragments with confidence below 0.1 from disk. Decay now only reduces confidence scores; fragments are never removed implicitly. Deletion is exclusive to `memory_forget` and `memory_merge` (explicit user actions).
- **Critical: Backup overwrite on same-count save** — When new data had the same number of entries as the backup but different IDs, the backup was silently overwritten, losing unique entries. Backup is now cumulative (ID-based merge) — it only adds new entries and never removes existing ones.
- **Critical: Backup overwrite after count recovery** — After decay reduced entries and new additions brought the count back up, the backup was overwritten with data missing decayed entries. Cumulative backup prevents this entirely.
- **saveMemory(null/undefined/[]) protection** — Empty, null, or undefined arrays are now rejected before writing, preventing accidental file wipe.

### Changed
- **Backup system rewritten** — Both `memory.jsonl.bak` and `guides.jsonl.bak` now use cumulative merging instead of overwrite. The backup grows over time but never loses entries.
- **Test suite added** — Comprehensive memory test suite (110 tests) covering all tools, decay behavior, backup safety, and data loss scenarios.

## [0.2.2] - 2026-03-18

### Added
- **memory_merge Tool**: Merge multiple memory fragments into one to consolidate duplicates. Creates new ID, deletes originals.
- **guide_merge Tool**: Merge multiple guides into one. Auto-merges contexts, learnings, and sums usage counts.
- **Auto-backup**: Both `memory.jsonl` and `guides.jsonl` are automatically backed up to `.bak` on every save.

### Changed
- **System Prompt**: Rewritten identity section — clearer, explanatory, non-mandatory tone
- **System Prompt**: Expanded guide tracking section with detailed explanations (memory vs guide, categories, merge tools)
- **System Prompt**: Added "Discovering Technologies" recommendation for manual project analysis via `package.json`

### Removed
- **guide_discover Tool**: Removed in favor of manual discovery. System prompt now recommends reading `package.json` directly and using `guide_practice` to register technologies.

---

## [0.2.0] - 2026-03-15

### Breaking Changes
- **Skill → Guide Rename**: Complete terminology migration across the entire codebase
  - All tool names renamed: `skill_*` → `guide_*`
    - `skill_get` → `guide_get`
    - `skill_practice` → `guide_practice`
    - `skill_create` → `guide_create`
    - `skill_suggest` → `guide_suggest`
    - `skill_discover` → `guide_discover`
  - Directory renamed: `src/skills/` → `src/guides/`
  - Export path changed: `./skills` → `./guides`
  - URI pattern changed: `lemma://skills/` → `lemma://guides/`
  - Data file changed: `skills.jsonl` → `guides.jsonl`
  - ID prefix changed: `s1a2b3` → `g1a2b3`

### Migration Guide
- Rename your data file: `~/.lemma/skills.jsonl` → `~/.lemma/guides.jsonl`
- Update any MCP client configurations referencing skill tools
- Existing `SKILL.md` files remain compatible for import

---

## [0.1.4] - 2025-03-12

### Changed
- **MCP Resources Refactor**: Memory fragments and skills are now exposed as individual resources instead of bulk endpoints
  - `list_resources` returns each record with metadata (title, description, scope)
  - `read_resource` fetches only the requested single record
- **New URI Patterns**:
  - `lemma://memory/{id}` - Single memory fragment by ID
  - `lemma://skills/{name}` - Single skill by name
- This change reduces unnecessary token consumption when working with large datasets

## [0.1.3] - 2025-03-12

### Added
- **Skill Categories**: Granular and structured skill categories for better organization
  - Web: `web-frontend`, `web-backend`, `data-storage`, `dev-tool`
  - Mobile: `mobile-frontend`
  - Game: `game-frontend`, `game-backend`, `game-tool`, `game-design`
  - Cross-cutting: `app-security`, `ui-design`, `infra-devops`, `programming-language`
- **skill_distill Tool**: Promote memory fragments into reusable skills
- **skill_update Tool**: Update existing skill properties
- **skill_forget Tool**: Remove skills from tracking
- **System Prompt Resource**: LLM identity, workflow, and rules exposed via `lemma://system-prompt`
- **JSR Installation**: Added JSR configuration and installation guide

### Changed
- Core workflow redefined to integrate skill suggestion and practice
- Removed Smithery.ai distribution instructions
- Prioritized JSR as primary installation method

### Removed
- Legacy memory and skills core modules and their associated tests

## [0.1.2] - 2025-03-08

### Added
- **Fuzzy Search**: Skill suggestions now use Fuse.js for typo-tolerant, partial matching
- **Documentation**: Added research papers on Agentic Memory and Self-Distillation
- **Tests**: Inline Fuse.js mock for testing

## [0.1.1] - 2025-03-07

### Added
- **skill_create Tool**: Create new skills with detailed manuals
- **skill_suggest Tool**: Suggest relevant skills based on task description
- **Token-based Matching**: Improved skill suggestion across names, keywords, contexts, and learnings
- **Description Field**: Added `description` field to `skill_practice` for detailed skill management
- **Mandatory Fields**: Made `skill_practice` contexts and learnings mandatory

### Changed
- **System Prompt**: Restructured with XML tags, condensed and optimized
- **memory_add**: Changed project default from auto-detection to explicit global scope (null)

### Fixed
- Full skill details now provided on update

## [0.1.0] - 2025-03-05

### Added
- **Initial Release**: Lemma MCP memory system with project scoping
- **Memory Tools**:
  - `memory_read` - Read memory fragments with optional query
  - `memory_check` - Check if memory exists for a project
  - `memory_add` - Add new memory fragments
  - `memory_update` - Update existing fragments
  - `memory_forget` - Remove fragments
  - `memory_list` - List all fragments
- **Project Scoping**: Memory fragments can be scoped to specific projects or global
- **Confidence Decay**: Time-based confidence decay for memory relevance
- **lastAccessed Field**: Track when fragments were last accessed
- **MANDATORY Flags**: Tool descriptions include mandatory parameter flags
- **Zero-install Method**: Support for npx and GitHub installation
- **MIT License**
- **Turkish Translation**: Full README in Turkish

### Documentation
- Self-Distillation Enables Continual Learning research paper
- Tool descriptions and usage examples

---

[0.7.2]: https://github.com/xenitV1/lemma/compare/v0.7.1...v0.7.2
[0.7.0]: https://github.com/xenitV1/lemma/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/xenitV1/lemma/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/xenitV1/lemma/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/xenitV1/lemma/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/xenitV1/lemma/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/xenitV1/lemma/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/xenitV1/lemma/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/xenitV1/lemma/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/xenitV1/lemma/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/xenitV1/lemma/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/xenitV1/lemma/compare/v0.2.0...v0.2.2
[0.1.4]: https://github.com/xenitV1/lemma/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/xenitV1/lemma/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/xenitV1/lemma/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/xenitV1/lemma/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xenitV1/lemma/releases/tag/v0.1.0
