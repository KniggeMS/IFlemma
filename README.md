<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - Persistent Memory for LLMs via MCP

[English](README.md) | [Türkçe](docs/README.tr.md)

Lemma is a Model Context Protocol (MCP) server that provides a persistent memory layer for Large Language Models. It enables LLMs to remember facts, preferences, and context across sessions through a biological memory model with automatic decay, learning, and universal injection.

## What is Lemma?

Lemma acts as an external hippocampus for AI assistants. The human brain does not record everything — it synthesizes, distills, and leaves behind fragments. Frequently accessed knowledge grows stronger; unused knowledge fades and is forgotten.

Lemma operates on the same principle:

- **Raw conversations are never stored** — only synthesized fragments
- **Fragments decay over time** — frequently accessed ones strengthen
- **Used knowledge gains context** — tags and associations are built automatically
- **Memories are injected automatically** — LLM sees them without calling tools

## How It Works

### Universal Memory Injection

Lemma injects memories directly into tool descriptions via `tools/list`. This works on **every MCP client** — Claude Desktop, Cursor, VS Code, opencode, Gemini CLI, and others.

```
tools/list → memory_read description includes:
  "YOUR MEMORIES (you already know these):
   [m8f728] React Architecture (95%)
   Full content here...
   [m1bbea] Clean Code Research (77%)
   Full content here..."
```

The LLM starts every session already knowing its most important memories. No explicit tool call needed.

**Dual injection:**
1. **Tool descriptions** — universal, works everywhere
2. **`instructions` field** — for clients that support MCP initialize instructions

**3-layer architecture:**
- Layer 1: Full content for top memories (~3000 tokens, configurable)
- Layer 2: Summary index for remaining memories
- Layer 3: Active guides with descriptions and learnings

### Memory Structure

Each memory fragment has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (`m` + 12 hex chars from crypto.randomUUID) |
| `title` | string | Short title for quick scanning |
| `fragment` | string | Synthesized memory text |
| `project` | string | Project scope (`null` for global) |
| `confidence` | float | Reliability 0.0-1.0 (decays and boosts over time) |
| `source` | string | `"user"` or `"ai"` |
| `created` | string | Creation date (YYYY-MM-DD) |
| `lastAccessed` | string | ISO timestamp of last read |
| `accessed` | int | Access count in current decay cycle |
| `tags` | string[] | Context tags from usage (e.g., "debugging", "refactoring") |
| `associatedWith` | string[] | IDs of fragments accessed in the same session |
| `negativeHits` | int | Times this memory was marked unhelpful (resets per session) |

### Learning System

Unlike static memory, Lemma uses a biological model where knowledge evolves through use:

**Boost (on access):**
```
confidence = min(1.0, confidence + 0.015)
tags += context_tag  (e.g., "debugging")
associatedWith += co_accessed_fragment_ids
```

**Decay (per session, only unused fragments):**
```
if accessed == 0:
    confidence = confidence - 0.002
if accessed > 0:
    no decay (shield — used knowledge is protected)
```

- **Shield**: Frequently accessed items are protected from decay entirely
- **Unused items** decay very slowly at 0.002 per session
- **Negative feedback** reduces confidence by -0.02 (was -0.1)
- **Associations**: Fragments used together build cross-references for future recall
- **No time-based decay**: Confidence only changes when the system is actively used

### Deduplication

Lemma uses **Fuse.js fuzzy matching** (not Jaccard) for dedup:
- "Use React hooks" vs "Don't use React hooks" — correctly detected as different
- "react", "reactjs", "React.js" — correctly detected as same (for guides)
- Applies to both user and AI sourced memories

### Virtual Sessions

Tool calls are automatically correlated into virtual sessions:
- Auto-starts on first tool call
- Auto-finalizes after 30 minutes of inactivity
- Tracks technologies seen, guides used, memories created
- No explicit `session_start`/`session_end` required
- Sessions stored in `~/.lemma/sessions/`

### Data Safety

- **Cumulative backup**: `.bak` files are ID-based merges — never overwrites existing entries
- **File locking**: Module-level write lock prevents concurrent data corruption
- **Safe I/O**: Empty/null arrays rejected before writing
- **No implicit deletion**: Decay only reduces confidence, never removes fragments

### Configuration

Optional config file at `~/.lemma/config.json`:

```json
{
  "token_budget": {
    "full_content": 3000,
    "summary_index": 1000,
    "guides_detail": 1000
  },
  "injection": {
    "max_full_content_fragments": 15,
    "max_summary_fragments": 30,
    "max_guides": 20,
    "max_guide_detail": 3
  },
  "virtual_session": {
    "timeout_minutes": 30
  }
}
```

### File Locations

| OS | Path |
|---|---|
| **Windows** | `C:\Users\{username}\.lemma\` |
| **macOS** | `/Users/{username}/.lemma/` |
| **Linux** | `/home/{username}/.lemma/` |

Files:
- `memory.jsonl` — memory fragments
- `guides.jsonl` — experience guides
- `config.json` — user configuration (optional)
- `sessions/` — virtual session logs
- `.bak` files — cumulative backups

## Quick Start

Add Lemma to your MCP client configuration:

**Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
**Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lemma": {
      "command": "npx",
      "args": ["-y", "lemma-mcp"]
    }
  }
}
```

---

## Hook System

Lemma provides a pluggable hook system for extending server behavior:

### Lifecycle Hooks

```javascript
import { registerHook, HookTypes } from "@lemma/lemma/server";

registerHook(HookTypes.ON_START, async (context) => {
  console.log("Server started!", context);
});

registerHook(HookTypes.ON_PROJECT_CHANGE, async (context) => {
  console.log(`Project changed to: ${context.project}`);
});
```

### Prompt Modifiers

Extend the system prompt generation with custom transformations:

```javascript
import { registerPromptModifier } from "lemma-mcp/server";

registerPromptModifier(async (prompt, context) => {
  if (context.project === "my-app") {
    return prompt + "\n\n<custom>Note: Using experimental features.</custom>";
  }
  return prompt;
});
```

---

## Manual Installation

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

**Requirements:** Node.js 18.0.0 or higher

### Local Configuration

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["C:\\path\\to\\Lemma\\src\\index.js"]
    }
  }
}
```

---

## Available Tools (21)

### Memory Tools (11)

#### `memory_read`

Read memory fragments. SUMMARY MODE shows title + description; use `id` for full detail.

**Parameters:**
- `project` (string, optional): Project name to filter
- `query` (string, optional): Semantic search keyword
- `id` (string, optional): Get full detail for a specific fragment
- `ids` (string[], optional): Get full details for multiple fragments at once
- `context` (string, optional): Tag this access with a context (e.g., "debugging")
- `all` (boolean, optional): Show fragments from all projects (default: false)
- `minConfidence` (number, optional): Minimum confidence threshold (0-1)
- `afterDate` (string, optional): ISO date — only fragments created on or after
- `beforeDate` (string, optional): ISO date — only fragments created on or before

#### `memory_add`

**MANDATORY:** Call AFTER completing analysis to save findings. Automatically redacts secrets unless `confirm: true`.

**Parameters:**
- `fragment` (string, required): The memory text to store
- `title` (string, optional): Short title
- `description` (string, optional): Short summary
- `project` (string, optional): Project scope (null = global)
- `source` (string, optional): "user" or "ai", default "ai"
- `confirm` (boolean, optional): Store as-is even if secrets detected (default: false)

#### `memory_update`

Update an existing fragment by ID.

**Parameters:**
- `id` (string, required): Fragment ID
- `title` (string, optional): New title
- `fragment` (string, optional): New text
- `confidence` (number, optional): New confidence 0-1

#### `memory_feedback`

Provide feedback on a memory fragment after use. Positive boosts confidence; negative reduces by -0.02.

**Parameters:**
- `id` (string, required): Fragment ID
- `useful` (boolean, required): `true` if helpful, `false` if not

#### `memory_forget`

Remove a memory fragment by ID.

**Parameters:**
- `id` (string, required): Fragment ID

#### `memory_merge`

Merge multiple fragments into one. Creates new ID, deletes originals.

**Parameters:**
- `ids` (string[], required): Fragment IDs to merge
- `title` (string, required): Title for merged fragment
- `fragment` (string, required): Merged content
- `project` (string, optional): Project scope

#### `memory_relate`

Create a typed relation between two memory fragments.

**Parameters:**
- `sourceId` (string, required): Source fragment ID
- `targetId` (string, required): Target fragment ID
- `type` (string, required): One of `contradicts`, `supersedes`, `supports`, `related_to`
- `note` (string, optional): Note explaining the relation

#### `memory_stats`

Get memory store statistics: fragment counts, average confidence, project breakdown.

**Parameters:**
- `project` (string, optional): Filter by project

#### `memory_audit`

Audit memory store for integrity issues: orphan references, duplicate IDs, confidence anomalies.

### Guide Tools (8)

#### `guide_get`

Get tracked guides with usage statistics. Returns guides sorted by usage count (most used first).

**Parameters:**
- `category` (string, optional): Filter by category
- `guide` (string, optional): Get detail for specific guide
- `task` (string, optional): Task description to get relevant guide suggestions

#### `guide_practice`

**MANDATORY:** Record guide usage when you use a guide during work.

**Parameters:**
- `guide` (string, required): Guide name
- `category` (string, required): Category
- `description` (string, optional): Detailed manual/protocols
- `contexts` (string[], required): Contexts where used
- `learnings` (string[], required): New learnings discovered
- `outcome` (string, optional): "success" or "failure" — tracks success rate

#### `guide_create`

Create a guide with a detailed manual.

**Parameters:**
- `guide` (string, required): Guide name
- `category` (string, required): Category
- `description` (string, required): Full manual/protocols
- `contexts` (string[], optional): Initial contexts
- `learnings` (string[], optional): Initial learnings

#### `guide_distill`

Transform a memory fragment into a guide's learning.

**Parameters:**
- `memory_id` (string, required): Memory fragment ID
- `guide` (string, required): Target guide name
- `category` (string, optional): Category (required if creating new guide)

#### `guide_update`

Update an existing guide's properties.

**Parameters:**
- `guide` (string, required): Current guide name
- `new_name` (string, optional): New name
- `category` (string, optional): New category
- `description` (string, optional): New description/manual
- `add_anti_patterns` (string[], optional): Add anti-patterns
- `add_pitfalls` (string[], optional): Add known pitfalls
- `superseded_by` (string, optional): Mark as superseded by another guide
- `deprecated` (boolean, optional): Mark as deprecated

#### `guide_forget`

Remove a guide.

**Parameters:**
- `guide` (string, required): Guide name

#### `guide_merge`

Merge multiple guides into one. Usage counts are summed.

**Parameters:**
- `guides` (string[], required): Guide names to merge
- `guide` (string, required): Name for merged guide
- `category` (string, required): Category
- `description` (string, optional): Merged description
- `contexts` (string[], optional): Merged contexts
- `learnings` (string[], optional): Merged learnings

### Session Tools (2)

#### `session_start`

Start a traced work session. Records task metadata and returns relevant guides + pre-loaded memories.

**Parameters:**
- `task_type` (string, required): "debugging", "implementation", "refactoring", "testing", "research", "documentation", "optimization", or "other"
- `technologies` (string[], optional): Technologies involved
- `initial_approach` (string, optional): Initial plan

#### `session_end`

End the current session. Records outcome and updates guide success tracking.

**Parameters:**
- `outcome` (string, required): "success", "partial", "failure", or "abandoned"
- `final_approach` (string, optional): What approach worked
- `lessons` (string[], optional): What was learned

#### `session_stats`

Get virtual session statistics: recent tool usage patterns and technologies.

**Parameters:**
- `count` (number, optional): Number of recent sessions (default 10)

## Philosophy

### What Should Be Stored

**User Layer:**
- User preferences (communication style, format, language)
- Project context (technology stack, folder structure, conventions)
- Explicitly requested memories

**Capability Layer:**
- Successful solutions and approaches used
- Shortcuts discovered for recurring tasks
- Approaches that were tried and failed

### What Should NOT Be Stored

- Raw conversation content
- One-off questions that won't recur
- Temporary or highly context-specific information
- Personal or sensitive data

## Development

### Running Tests

```bash
npm test
```

415 tests covering memory core, guides core, handlers, learning lifecycle, hook system, dynamic prompt generation, virtual sessions, privacy filtering, query filters, topic overlap, relations, injection ranking, and session pre-loading. All I/O is isolated to temp directories.

```bash
npm run typecheck   # TypeScript type checking
npm run build       # Compile TypeScript to dist/
```

### Project Structure

```
Lemma/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # Shared TypeScript interfaces
│   ├── memory/
│   │   ├── index.ts          # Memory module re-exports
│   │   ├── core.ts           # Core memory logic, decay, search, dedup, relations
│   │   ├── config.ts         # User configuration loader
│   │   └── privacy.ts        # Secret scanning and redaction
│   ├── guides/
│   │   ├── index.ts          # Guides module re-exports
│   │   ├── core.ts           # Core guides logic, fuzzy dedup
│   │   └── task-map.ts       # Task-to-guide mapping
│   ├── server/
│   │   ├── index.ts          # Server setup, injection, notifications
│   │   ├── handlers.ts       # Tool handlers (20 tools)
│   │   ├── tools.ts          # Tool definitions
│   │   ├── hooks.ts          # Hook system & prompt modifiers
│   │   └── system-prompt.ts  # Dynamic system prompt
│   └── sessions/
│       ├── index.ts          # Sessions module re-exports
│       ├── core.ts           # Session lifecycle
│       └── virtual.ts        # Virtual session tracking
├── tests/
│   ├── memory/               # 7 test files
│   ├── guides/               # 6 test files
│   ├── sessions/             # 2 test files
│   └── server/               # 10 test files
├── docs/                     # Research papers and references
├── package.json
├── tsconfig.json
├── CHANGELOG.md
└── README.md
```

## Security

All data is stored locally in `~/.lemma/`. Nothing is ever sent to external servers. Users can inspect, edit, or clear data at any time via the MCP tools or directly.

## License

MIT License
