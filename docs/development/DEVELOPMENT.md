# Development Guide

## Setup

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

## Commands

```bash
npm test            # Run all 488 tests (node --test)
npm run typecheck   # TypeScript type checking
npm run build       # Compile to dist/
```

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── types.ts              # Shared TypeScript interfaces
├── logger.ts             # Structured logging (daily rotation, ~/.lemma/logs/)
├── memory/
│   ├── core.ts           # Core memory logic, decay, search, dedup, relations
│   ├── config.ts         # User configuration loader
│   ├── embeddings.ts     # HuggingFace embeddings + hybrid search
│   ├── seed.ts           # Built-in seed knowledge fragments
│   ├── privacy.ts        # Secret scanning and redaction (17 regex patterns)
│   └── index.ts          # Barrel exports
├── guides/
│   ├── core.ts           # Guides logic, fuzzy dedup, source_memories, validated_by
│   └── task-map.ts       # Task-to-guide mapping for suggestions
├── server/
│   ├── index.ts          # Server setup, memory injection, notifications, lifecycle
│   ├── handlers.ts       # 21 tool handlers + response hooks (SUGGESTED ACTIONS)
│   ├── tools.ts          # MCP tool definitions with Zod schemas
│   ├── hooks.ts          # Hook system & prompt modifiers
│   ├── system-prompt.ts  # Dynamic system prompt generation
│   └── agents-md.ts      # AGENTS.md file parsing
└── sessions/
    ├── core.ts           # Formal session lifecycle (session_start/end)
    └── virtual.ts        # Virtual session auto-tracking (idle detection)

tests/                    # 488 tests, node:test + tsx
├── memory/               # 14 test files
├── guides/               # 6 test files
├── sessions/             # 2 test files
├── server/               # 16 test files
└── _setup.ts             # Global setup (logger disabled)
```

## Architecture

### Memory Injection

Memories are injected into MCP tool descriptions at `tools/list` time:

1. `buildToolsWithMemory()` — Injects full content + summary index + guides into `memory_read` tool description
2. `buildDynamicInstructions()` — Builds 3-layer context (rules → memories → guides)
3. `getDynamicSystemPrompt()` — Dynamic system prompt with project context

All injection paths use `injectionScore()` ranking: `confidence * 0.7 + recency * 0.3`.

### Memory Lifecycle

- **Confidence decay**: Only unused fragments decay (-0.002/session). Accessed fragments are shielded.
- **Boost on access**: +0.015 confidence, context tagging, association tracking
- **Negative feedback**: -0.02 confidence
- **Dedup**: Fuse.js fuzzy matching at 0.65 threshold

### Semantic Search

Embedding model (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384-dim) loaded via `@huggingface/transformers`:

- `initEmbeddings()` — Async model loading, cached at `~/.lemma/models/`
- `hybridSearch()` — `0.4 * fuseScore + 0.6 * vectorScore` when embeddings ready
- Falls back to pure Fuse.js when model unavailable
- `embedFragments()` — Background embedding of stored fragments on first search

### Virtual Sessions

Automatic session correlation without explicit `session_start`/`session_end`:

- Auto-starts on first tool call
- Idle detection: 10s mark → finalize on next call if >30s idle
- 30min absolute timeout (configurable)
- Tracks tools, technologies, guides, memories
- Sessions persisted to `~/.lemma/sessions/vs_*.json`
- LLM-driven synthesis prompt on session end

### Response Hooks

10 hooks add contextual `SUGGESTED ACTIONS` to tool responses:
- Topic overlap → `memory_relate`
- Type `pattern`/`lesson` → `guide_distill`
- Positive feedback → `guide_distill`
- Session end → full review with relate + distill + practice suggestions

### Deterministic Connections

4 mechanisms for automatic knowledge linking:
1. `guide_distill` → bidirectional memory ↔ guide link
2. `guide_practice` → session-read memories validate guide
3. `trackAssociations` → co-accessed fragments cross-referenced
4. `memory_merge` → relations, guides, associations inherited

## Data Storage

All data in `~/.lemma/`:

| File | Format | Purpose |
|------|--------|---------|
| `memory.jsonl` | JSONL | Memory fragments (semantic layer) |
| `guides.jsonl` | JSONL | Procedural knowledge (procedural layer) |
| `sessions.jsonl` | JSONL | Formal session records |
| `sessions/vs_*.json` | JSON | Virtual session details |
| `config.json` | JSON | User configuration |
| `logs/lemma-YYYY-MM-DD.log` | Text | Structured logs (7-day rotation) |
| `models/` | Binary | Embedding model cache (~470MB) |
| `*.bak` | JSONL | Cumulative backups |

## Testing

Tests use Node.js built-in test runner (`node:test`) with `tsx` for TypeScript:

```bash
npm test                                    # All 488 tests
npm run test:memory                         # Memory tests only
npm run test:guides                         # Guide tests only
npm run test:sessions                       # Session tests only
npm run test:server                         # Server tests only
```

`tests/_setup.ts` disables logger globally to prevent disk I/O during tests. Each test file uses temp directories via `os.tmpdir()` for isolation.

## Adding New Features

Lemma follows the principle that tool count stays fixed (21 tools). New capabilities are added as parameters to existing tools. See [ROADMAP.md](./ROADMAP.md) for planned features.

## Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `@modelcontextprotocol/sdk` | required | MCP protocol |
| `fuse.js` | required | Fuzzy search, dedup |
| `@huggingface/transformers` | optional | Embedding model (semantic search) |
