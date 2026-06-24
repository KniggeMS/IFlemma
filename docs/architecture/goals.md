# Architektur: Goal Packets & Workflow (V2.3)

## Problem

Lemma injiziert aktuell ein globales Memory-Set in jede Session. Das ist für allgemeinen Kontext gut, aber für task-spezifische Arbeit zu breit — irrelevante Memories belegen Token, wichtige task-spezifische fehlen.

## Goal Packet

Ein Goal Packet ist ein kuratiertes Kontextpaket für eine spezifische Aufgabe:

```typescript
interface GoalPacket {
  goal: Goal;
  relevant_memories: Fragment[];   // Top-K semantisch ähnlich zum Ziel
  active_dead_ends: Attempt[];     // Offene Session Attempts
  applicable_guides: Guide[];      // Guides mit passendem tag/category
  success_criteria: string[];      // Was "fertig" bedeutet
  token_budget: number;            // Verbleibende Tokens für Injektion
}
```

## Workflow

```
lemma_goal_create(title, criteria)
        │
        ▼
lemma_session_start(goal_id)     ← lädt Goal Packet
        │
     [Arbeit...]
        │
lemma_session_attempt(approach)  ← Dead Ends werden erfasst
        │
lemma_session_end()              ← Review gegen Criteria
        │
        ▼
   Auto-Review:
   ├── Was hat funktioniert? → lemma_memory_add(type: 'lesson')
   ├── Was war stale?       → lemma_memory_invalidate()
   ├── Was ist ein Pattern? → lemma_guide_distill()
   └── Offene Dead Ends?    → In nächste Session mitgeben
```

## Neue Tools

### `lemma_goal_create`

```json
{
  "title": "Hybrid Search implementieren",
  "project": "IFlemma",
  "description": "sqlite-vec + BM25 Fusion Ranking",
  "criteria": [
    "Memory-Recall@5 > 0.85",
    "Latenz < 50ms bei 1000 Fragmenten",
    "Fallback auf FTS5 wenn Extension fehlt"
  ]
}
```

### `lemma_goal_context`

Gibt das kuratierte Goal Packet zurück — für manuelle Inspection oder Debugging:

```json
{
  "goal_id": "goal_abc123",
  "include_dead_ends": true,
  "max_memories": 10
}
```
