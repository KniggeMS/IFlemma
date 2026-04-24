<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - Persistent Memory for LLMs via MCP

[English](README.md) | [Türkçe](docs/README.tr.md)

Lemma is an MCP server that gives LLMs persistent, cross-session memory. Memories are injected automatically into every session — no explicit tool call needed. Knowledge evolves through use: frequently accessed memories strengthen, unused ones fade, and patterns are promoted into reusable skills.

## Quick Start

Add Lemma to your MCP client configuration:

**Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
**Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
**opencode:** `%APPDATA%\opencode\opencode.json`

```json
{
  "mcpServers": {
    "lemma": {
      "command": "npx",
      "args": ["-y", "lemma-mcp@latest"]
    }
  }
}
```

> Using `@latest` ensures npx always fetches the newest version.

**Requirements:** Node.js 18.0.0 or higher

## How It Works

### Universal Memory Injection

Memories are injected into tool descriptions via `tools/list`. The LLM starts every session already knowing its most important memories — works on every MCP client.

**3-layer architecture:**
- Layer 1: Full content for top memories (token-budgeted)
- Layer 2: Summary index for remaining memories
- Layer 3: Active guides with learnings

### Fragment Types

Every memory fragment has a type that classifies its nature:

| Type | Use For | Example |
|------|---------|---------|
| `fact` | Technical info, API behavior, versions | "Node.js 22 has native fetch" |
| `pattern` | Repeated solution, best practice | "React useEffect cleanup pattern" |
| `lesson` | Learned from experience, debugging | "JSONL parse errors silently swallow broken lines" |
| `warning` | Caution, gotcha, pitfall | "fs.writeFileSync blocks the event loop" |
| `context` | Environment info, project setup | "This project uses Python 3.11 with py launcher" |

Default is `fact` if not specified.

### Memory ↔ Guide Pipeline

Knowledge flows through a two-way pipeline:

1. **Memory** = WHAT you know — facts, observations, technical details (`memory_add`)
2. **Guide** = HOW you work — accumulated experience, procedural skills (`guide_practice`, `guide_distill`)

Connections are **bidirectional** and automatic:
- `guide_distill` → links memory to guide AND guide to memory
- `guide_practice` → session-read memories validate the guide
- `memory_merge` → relations, guide links, and associations are inherited by the merged fragment

### Response Hooks (Suggested Actions)

Tool responses include contextual `SUGGESTED ACTIONS` when meaningful connections are detected. For example:

- `memory_add` with topic overlap → "Call `memory_relate` to link these fragments"
- `memory_add` with type `pattern` → "Call `guide_distill` to promote into a skill"
- `memory_feedback` positive → "Call `guide_distill` to convert into a reusable skill"
- `session_end` with activity → Full review with relate + distill + practice suggestions

Hooks only appear when there's meaningful context — no noise in empty states.

### Learning System

Knowledge evolves through use with a biological memory model:

- **Shield**: Accessed items are protected from decay entirely
- **Unused items** decay very slowly (0.002 per session)
- **Negative feedback** reduces confidence by -0.02
- **Associations**: Fragments used together build cross-references automatically
- **No time-based decay**: Confidence only changes when the system is actively used

### Memory Structure

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (`m` + 12 hex chars) |
| `title` | string | Short title |
| `fragment` | string | Synthesized memory text |
| `type` | FragmentType | `fact`, `pattern`, `lesson`, `warning`, or `context` |
| `project` | string | Project scope (`null` for global) |
| `confidence` | float | Reliability 0.0-1.0 |
| `source` | string | `"user"` or `"ai"` |
| `relations` | MemoryRelation[] | Typed links to other fragments |
| `related_guides` | string[] | Guide names this fragment informs |
| `associatedWith` | string[] | IDs of co-accessed fragments |
| `tags` | string[] | Context tags from usage |
| `accessed` | int | Access count in current decay cycle |

### Guide Structure

| Field | Type | Description |
|-------|------|-------------|
| `guide` | string | Guide name |
| `category` | string | Category (e.g., `web-frontend`, `dev-tool`) |
| `description` | string | Full manual/protocols |
| `source_memories` | string[] | Memory IDs that spawned this guide |
| `validated_by` | string[] | Memory IDs that validated this guide in practice |
| `usage_count` | int | Times practiced |
| `success_count` | int | Successful uses |
| `failure_count` | int | Failed uses |
| `learnings` | string[] | Accumulated learnings |
| `contexts` | string[] | Contexts where used |

### Virtual Sessions

Tool calls are automatically correlated into virtual sessions:
- Auto-starts on first tool call, auto-finalizes after 30 min inactivity
- Tracks technologies seen, guides used, memories created/accessed
- No explicit `session_start`/`session_end` required

### Configuration

Optional config at `~/.lemma/config.json`:

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

Files: `memory.jsonl`, `guides.jsonl`, `config.json`, `sessions/`, `logs/`, `.bak` backups

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
- `fragment` (string, required): Memory text. Use structured markdown: `## [Topic]\n[Context]\n- [Key points]`
- `title` (string, optional): Short title (max 80 chars)
- `description` (string, optional): Short summary (max 150 chars)
- `project` (string, optional): Project scope (null = global)
- `source` (string, optional): "user" or "ai", default "ai"
- `confirm` (boolean, optional): Store as-is even if secrets detected (default: false)
- `type` (string, optional): Fragment type — `fact`, `pattern`, `lesson`, `warning`, or `context` (default: `fact`)

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

Merge multiple fragments into one. Relations, guide links, and associations are inherited by the merged fragment.

**Parameters:**
- `ids` (string[], required): Fragment IDs to merge
- `title` (string, required): Title for merged fragment
- `fragment` (string, required): Merged content
- `project` (string, optional): Project scope

#### `memory_relate`

Create a typed relation between two memory fragments. Bidirectional — reverse relation auto-created.

**Parameters:**
- `sourceId` (string, required): Source fragment ID
- `targetId` (string, required): Target fragment ID
- `type` (string, required): `contradicts`, `supersedes`, `supports`, or `related_to`
- `note` (string, optional): Note explaining the relation

#### `memory_stats`

Get memory store statistics.

**Parameters:**
- `project` (string, optional): Filter by project

#### `memory_audit`

Audit memory store for integrity issues.

### Guide Tools (8)

#### `guide_get`

Get guides with usage statistics, sorted by usage count.

**Parameters:**
- `category` (string, optional): Filter by category
- `guide` (string, optional): Get detail for specific guide
- `task` (string, optional): Task description to get relevant suggestions

#### `guide_practice`

**MANDATORY:** Record guide usage during work.

**Parameters:**
- `guide` (string, required): Guide name
- `category` (string, required): Category
- `description` (string, optional): Detailed manual/protocols
- `contexts` (string[], required): Contexts where used
- `learnings` (string[], required): New learnings discovered
- `outcome` (string, optional): "success" or "failure"

#### `guide_create`

Create a guide with a detailed manual.

**Parameters:**
- `guide` (string, required): Guide name
- `category` (string, required): Category
- `description` (string, required): Full manual/protocols
- `contexts` (string[], optional): Initial contexts
- `learnings` (string[], optional): Initial learnings

#### `guide_distill`

Transform a memory fragment into a guide's learning. Creates bidirectional link (memory ↔ guide).

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
- `superseded_by` (string, optional): Mark as superseded
- `deprecated` (boolean, optional): Mark as deprecated

#### `guide_forget`

Remove a guide.

**Parameters:**
- `guide` (string, required): Guide name

#### `guide_merge`

Merge multiple guides into one. Source memories and validations are inherited.

**Parameters:**
- `guides` (string[], required): Guide names to merge
- `guide` (string, required): Name for merged guide
- `category` (string, required): Category
- `description` (string, optional): Merged description
- `contexts` (string[], optional): Merged contexts
- `learnings` (string[], optional): Merged learnings

### Session Tools (2)

#### `session_start`

Start a traced work session. Pre-loads relevant guides and memories.

**Parameters:**
- `task_type` (string, required): "debugging", "implementation", "refactoring", "testing", "research", "documentation", "optimization", or "other"
- `technologies` (string[], optional): Technologies involved
- `initial_approach` (string, optional): Initial plan

#### `session_end`

End the current session. Shows SESSION REVIEW with activity summary and suggestions.

**Parameters:**
- `outcome` (string, required): "success", "partial", "failure", or "abandoned"
- `final_approach` (string, optional): What approach worked
- `lessons` (string[], optional): What was learned

#### `session_stats`

Get virtual session statistics.

**Parameters:**
- `count` (number, optional): Number of recent sessions (default 10)

---

## Manual Installation

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["C:\\path\\to\\Lemma\\dist\\index.js"]
    }
  }
}
```

## Development

```bash
npm test            # 481 tests
npm run typecheck   # TypeScript type checking
npm run build       # Compile to dist/
```

### Project Structure

```
Lemma/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # Shared TypeScript interfaces (MemoryFragment, Guide, FragmentType...)
│   ├── memory/
│   │   ├── core.ts           # Core memory logic, decay, search, dedup, relations, associations
│   │   ├── config.ts         # User configuration loader
│   │   ├── seed.ts           # Built-in seed knowledge fragments
│   │   └── privacy.ts        # Secret scanning and redaction
│   ├── guides/
│   │   ├── core.ts           # Core guides logic, fuzzy dedup, source_memories, validated_by
│   │   └── task-map.ts       # Task-to-guide mapping
│   ├── server/
│   │   ├── index.ts          # Server setup, injection, notifications
│   │   ├── handlers.ts       # Tool handlers (21 tools) + response hooks
│   │   ├── tools.ts          # Tool definitions
│   │   ├── hooks.ts          # Hook system & prompt modifiers
│   │   └── system-prompt.ts  # Dynamic system prompt
│   └── sessions/
│       ├── core.ts           # Session lifecycle
│       └── virtual.ts        # Virtual session tracking
├── tests/                    # 36 test files, 481 tests
├── docs/                     # Research papers and references
├── package.json
├── tsconfig.json
├── CHANGELOG.md
└── README.md
```

## Security

All data is stored locally in `~/.lemma/`. Nothing is sent to external servers. Secrets are automatically redacted from memory fragments.

## License

MIT License
