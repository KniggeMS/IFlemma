# Lemma V2 — Roadmap & Architektur

> **Status:** Planung  
> **Basis:** [xenitV1/lemma](https://github.com/xenitV1/lemma)  
> **Fork:** [KniggeMS/IFlemma](https://github.com/KniggeMS/IFlemma)  
> **Branch:** `feat/lemma-v2-roadmap`

---

## Vision

Lemma V2 schließt drei kritische Lücken des aktuellen Systems, ohne seinen lokalen, privacy-first Charakter aufzugeben:

1. **Retrieval-Qualität** — Hybrid Search (BM25 + Vector + Trust-Weighted Ranking)
2. **Vertrauenswürdigkeit** — Trust Hierarchy, Verified Code Memories, Stale Detection
3. **Workflow-Orchestrierung** — Goal Packets, Review/Codify Loop, Session-Exit-Analyse

Ziel: Lemma wird zum stärksten lokalen MCP-Memory-System für Solo-Developer und Coding-Agents.

---

## Phasen

### V2.1 — Retrieval modernisieren
**Milestone:** `V2.1 Retrieval`  
**Ziel:** Semantische Suchqualität stark verbessern, ohne Cloud-Abhängigkeit einzuführen.

| Feature | Quelle (Inspiration) | Prio |
|---|---|---|
| `sqlite-vec` Vektorindex ergänzen | YesMem | P0 |
| Hybrid Ranking: BM25 + Vector + RRF | YesMem | P0 |
| Trust-gewichtetes Ranking | YesMem | P1 |
| Goal-scoped Retrieval (nur für aktive Session) | Jumbo | P1 |
| Embedding-Generation lokal (z.B. `@xenova/transformers`) | — | P2 |

**Neue Tabellen:**
```sql
CREATE TABLE memory_embeddings (
  id          TEXT PRIMARY KEY,
  fragment_id TEXT NOT NULL REFERENCES memories(id),
  model       TEXT NOT NULL,
  vector      BLOB NOT NULL,
  created_at  TEXT NOT NULL
);
```

---

### V2.2 — Memory vertrauenswürdig machen
**Milestone:** `V2.2 Verification`  
**Ziel:** Code-bezogene Memories sind verifizierbar und werden bei Staleness geblockt.

| Feature | Quelle | Prio |
|---|---|---|
| Trust Hierarchy: `user_stated > code_verified > session_inferred > derived_pattern` | YesMem | P0 |
| Evidence Table: Datei-/Symbol-/Commit-Referenz | Kage | P0 |
| `memory_validity` Status: `verified / stale / superseded / conflicted` | Kage | P1 |
| Stale-Detection bei Dateiänderungen (light) | Kage | P1 |
| Symbol-Hash-Check bei Recall | Kage | P2 |

**Neue Tabellen:**
```sql
CREATE TABLE memory_evidence (
  id          TEXT PRIMARY KEY,
  fragment_id TEXT NOT NULL REFERENCES memories(id),
  source_type TEXT NOT NULL, -- 'file' | 'symbol' | 'commit' | 'url' | 'user'
  path        TEXT,
  symbol      TEXT,
  commit_sha  TEXT,
  snippet_hash TEXT,
  trust_level TEXT NOT NULL DEFAULT 'session_inferred',
  observed_at TEXT NOT NULL
);

CREATE TABLE memory_validity (
  fragment_id TEXT PRIMARY KEY REFERENCES memories(id),
  status      TEXT NOT NULL DEFAULT 'verified', -- verified | stale | superseded | conflicted
  checked_at  TEXT NOT NULL,
  reason      TEXT
);
```

---

### V2.3 — Workflow schließen
**Milestone:** `V2.3 Workflow`  
**Ziel:** Von Memory-Speicherung zu aktivem Arbeitsfluss-Partner.

| Feature | Quelle | Prio |
|---|---|---|
| Goal Packet: kuratiertes Kontextpaket je Session | Jumbo | P0 |
| `lemma_goal_create` / `lemma_goal_context` Tools | Jumbo | P0 |
| Review gegen Erfolgskriterien nach `session_end` | Jumbo | P1 |
| Codify/Distill Loop: Was wird Guide, Warning, Pattern? | Lemma intern | P1 |
| Entity-Extraktion für Knowledge Graph | mcp-memory-service | P2 |

**Neue Tabellen:**
```sql
CREATE TABLE goals (
  id          TEXT PRIMARY KEY,
  project     TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  criteria    TEXT, -- JSON array of success criteria
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL,
  closed_at   TEXT
);

CREATE TABLE goal_memory_links (
  goal_id     TEXT NOT NULL REFERENCES goals(id),
  fragment_id TEXT NOT NULL REFERENCES memories(id),
  relevance   REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (goal_id, fragment_id)
);
```

---

### V2.4 — Wissenspflege
**Milestone:** `V2.4 Lifecycle`  
**Ziel:** Memory-Lifecycle vollständig nachvollziehbar und wartbar.

| Feature | Quelle | Prio |
|---|---|---|
| Revision History je Memory | Origin | P0 |
| Insight Cards / Consolidation | mcp-memory-service | P1 |
| Improved Forgetting / Lifecycle Model | MemoryBear | P1 |
| `lemma_memory_invalidate` Tool | Kage | P1 |
| `lemma_memory_revision_history` Tool | Origin | P2 |

**Neue Tabellen:**
```sql
CREATE TABLE memory_revisions (
  id          TEXT PRIMARY KEY,
  fragment_id TEXT NOT NULL REFERENCES memories(id),
  content     TEXT NOT NULL,
  changed_by  TEXT, -- 'user' | 'agent' | 'auto'
  changed_at  TEXT NOT NULL,
  reason      TEXT
);
```

---

### V2.5 — Qualität messbar machen
**Milestone:** `V2.5 Evals`  
**Ziel:** Recall, Staleness und Task-Success werden benchmarkbar.

| Feature | Quelle | Prio |
|---|---|---|
| Eval Harness: Recall@5, Task-Success, Staleness-Rate | mcp-memory-service / Kage | P0 |
| Regression Suite für Retrieval-Qualität | — | P1 |
| `lemma_eval_run` Tool | — | P2 |

---

## Neue MCP-Tools (V2)

| Tool | Kategorie | Phase |
|---|---|---|
| `lemma_goal_create` | Goals | V2.3 |
| `lemma_goal_context` | Goals | V2.3 |
| `lemma_memory_verify` | Verification | V2.2 |
| `lemma_memory_evidence_add` | Verification | V2.2 |
| `lemma_memory_invalidate` | Lifecycle | V2.4 |
| `lemma_memory_revision_history` | Lifecycle | V2.4 |
| `lemma_eval_run` | Evals | V2.5 |

---

## Bewusst NICHT in V2

- ❌ Proxy-first Ansatz (zu komplex, zu fehleranfällig für Solo-Dev-Fokus)
- ❌ Cloud- oder Team-Sync (widerspricht local-first Prinzip)
- ❌ Overengineered Knowledge Graph vor stabilem Retrieval
- ❌ Breaking Changes an bestehenden 26 Tools ohne Migration

---

## Konventionen

**Commits:** [Conventional Commits](https://www.conventionalcommits.org/)
```
feat(retrieval): add sqlite-vec hybrid ranking
fix(memory): prevent duplicate evidence entries
docs(roadmap): update V2.2 verification plan
refactor(db): extract evidence table migration
test(retrieval): add BM25+vector recall benchmark
chore: update dependencies
```

**Branches:**
```
feat/<kurzbeschreibung>
fix/<kurzbeschreibung>
docs/<kurzbeschreibung>
refactor/<kurzbeschreibung>
```

**Versionen:**
- V2.1 → `v0.9.0`
- V2.2 → `v0.10.0`
- V2.3 → `v0.11.0`
- V2.4 → `v0.12.0`
- V2.5 / Stable → `v1.0.0`
