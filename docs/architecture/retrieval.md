# Architektur: Hybrid Retrieval Engine (V2.1)

## Aktueller Stand

Lemma nutzt **SQLite FTS5** mit TF-IDF-basierter Ähnlichkeitssuche. Das ist schnell und lokal, aber:
- Synonyme und konzeptionell verwandte Begriffe werden nicht erkannt
- Semantische Distanz zwischen Fragmenten ist nicht messbar
- Ranking ist rein keyword-basiert

## Zielarchitektur

```
┌─────────────────────────────────────────────────────┐
│                   Query Input                       │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────▼───────┐
       │  Query Parser │ (Tokenisierung, Trust-Filter, Goal-Scope)
       └───────┬───────┘
               │
    ┌──────────▼──────────┐
    │   Parallel Retrieval │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐         ┌────────────────────┐
    │   FTS5 BM25 Search  │         │  Vector Search     │
    │   (Keyword Match)   │         │  (sqlite-vec)      │
    └──────────┬──────────┘         └────────┬───────────┘
               │                             │
    ┌──────────▼─────────────────────────────▼──────────┐
    │              RRF Fusion Ranking                    │
    │   score = BM25_rank + vector_rank + trust_boost   │
    └──────────────────────┬────────────────────────────┘
                           │
    ┌──────────────────────▼────────────────────────────┐
    │           Token Budget & Injection                 │
    │   (Top-K Full Content + Summary Index + Guides)   │
    └───────────────────────────────────────────────────┘
```

## Trust Boost

Memories mit höherem Trust Level erhalten einen Ranking-Bonus:

| Trust Level | Boost |
|---|---|
| `user_stated` | +0.4 |
| `code_verified` | +0.3 |
| `session_agreed` | +0.2 |
| `session_inferred` | +0.1 |
| `derived_pattern` | 0.0 |

## Implementierung

### 1. sqlite-vec einbinden

```typescript
import Database from 'better-sqlite3';
// sqlite-vec wird als native Extension geladen:
db.loadExtension('vec0');
```

### 2. Embedding-Generation

Lokal via `@xenova/transformers` (Xenova-Modell, ca. 30MB):

```typescript
import { pipeline } from '@xenova/transformers';
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const output = await embedder(text, { pooling: 'mean', normalize: true });
const vector = Array.from(output.data); // 384-dim float32
```

### 3. RRF Fusion

```typescript
function rrfScore(bm25Rank: number, vectorRank: number, trust: number, k = 60): number {
  const bm25 = 1 / (k + bm25Rank);
  const vec = 1 / (k + vectorRank);
  return bm25 + vec + trust;
}
```

## Migration

1. `memory_embeddings` Tabelle anlegen (siehe LEMMA-V2.md)
2. Beim Startup fehlende Embeddings asynchron nachgenerieren
3. `searchAndSortFragments()` zu Hybrid-Funktion umbauen
4. Fallback auf FTS5-only wenn Extension nicht verfügbar
