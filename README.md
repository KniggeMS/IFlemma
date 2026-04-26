<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma — Persistent Memory for LLMs via MCP

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

**Requirements:** Node.js 20.0.0 or higher

## How It Works

Memories are injected into tool descriptions via `tools/list`. The LLM starts every session already knowing its most important memories — works on every MCP client.

**3-layer injection:**
- Full content for top memories (token-budgeted)
- Summary index for remaining memories
- Active guides with learnings

**Memory types:** `fact`, `pattern`, `lesson`, `warning`, `context`

**Knowledge pipeline:** Memory (what you know, `memory_add`) ↔ Guide (how you work, `guide_practice`/`guide_distill`)

## Tools (21)

### Memory (11)

| Tool | Purpose |
|------|---------|
| `memory_read` | Read/search fragments. Summary mode or full detail by ID |
| `memory_add` | Save findings. Auto-redacts secrets |
| `memory_update` | Update fragment by ID |
| `memory_feedback` | Positive/negative feedback, adjusts confidence |
| `memory_forget` | Delete fragment |
| `memory_merge` | Merge fragments, inherit relations & guide links |
| `memory_relate` | Create typed links (`contradicts`, `supersedes`, `supports`, `related_to`) |
| `memory_stats` | Fragment counts, confidence, project breakdown |
| `memory_audit` | Integrity check for orphans, duplicates, anomalies |

### Guides (8)

| Tool | Purpose |
|------|---------|
| `guide_get` | Get guides sorted by usage, filter by category or task |
| `guide_practice` | Record guide usage. Mandatory during work |
| `guide_create` | Create guide with manual |
| `guide_distill` | Transform memory → guide learning (bidirectional link) |
| `guide_update` | Update guide properties |
| `guide_forget` | Remove guide |
| `guide_merge` | Merge guides, inherit source memories |

### Sessions (2)

| Tool | Purpose |
|------|---------|
| `session_start` | Start traced session, pre-loads relevant context |
| `session_end` | End session with review and suggestions |
| `session_stats` | Virtual session statistics |

## Configuration

Optional config at `~/.lemma/config.json`:

```json
{
  "token_budget": {
    "full_content": 5000,
    "summary_index": 1000,
    "guides_detail": 1000
  },
  "injection": {
    "max_full_content_fragments": 15,
    "max_summary_fragments": 30,
    "max_guides": 20
  },
  "virtual_session": {
    "timeout_minutes": 30
  }
}
```

## File Locations

| OS | Path |
|---|---|
| **Windows** | `C:\Users\{username}\.lemma\` |
| **macOS/Linux** | `~/.lemma/` |

Files: `memory.jsonl`, `guides.jsonl`, `config.json`, `sessions/`, `logs/`, `.bak` backups

## Semantic Search

Lemma includes optional embedding-based semantic search using `@huggingface/transformers` (optionalDependency). On first use, a 470MB multilingual model is downloaded to `~/.lemma/models/`. Until ready, search falls back to Fuse.js keyword matching. No configuration needed — it activates automatically.

## Security

All data is stored locally in `~/.lemma/`. Nothing is sent to external servers. Secrets are automatically redacted from memory fragments (17 regex patterns for API keys, tokens, connection strings).

## Documentation

- [Development Guide](docs/development/DEVELOPMENT.md) — Architecture, project structure, testing
- [Roadmap](docs/development/ROADMAP.md) — v0.9, v0.10, v1.0 plans
- [Research](docs/research/README.md) — Academic papers that influenced Lemma's design
- [Changelog](CHANGELOG.md) — Version history

## License

MIT
