# Architektur: Verification & Trust (V2.2)

## Problem

Lemma speichert Memories ohne Unterschied, ob sie vom Nutzer explizit bestätigt wurden, aus Code-Analyse stammen oder nur aus einer Session geschlussfolgert wurden. Bei Konflikten und Recalls behandelt Lemma alle Einträge gleich.

## Trust Hierarchy

```
user_stated        ██████████ Höchste Verlässlichkeit
code_verified      █████████░ Aus verifiziertem Code-Kontext
session_agreed     ████████░░ In Session explizit bestätigt
session_inferred   ██████░░░░ Aus Session abgeleitet
derived_pattern    ████░░░░░░ Automatisch generiertes Pattern
```

## Evidence Model

Jedes Memory kann eine oder mehrere Evidence-Einträge haben:

```typescript
interface MemoryEvidence {
  id: string;
  fragment_id: string;
  source_type: 'file' | 'symbol' | 'commit' | 'url' | 'user';
  path?: string;          // z.B. 'src/db/schema.ts'
  symbol?: string;        // z.B. 'SearchAndSortFragments'
  commit_sha?: string;    // z.B. 'abc123'
  snippet_hash?: string;  // SHA-256 des relevanten Code-Snippets
  trust_level: TrustLevel;
  observed_at: string;
}
```

## Stale Detection (light)

Bei jedem Recall von Code-backed Memories:
1. Prüfe ob `path` noch existiert
2. Vergleiche `snippet_hash` mit aktuellem File-Inhalt
3. Bei Mismatch: setze `validity.status = 'stale'`, blockiere Injection bis Review

## Neue Tools

### `lemma_memory_verify`

Manuelle Verifikation eines Fragments:
```json
{
  "fragment_id": "abc123",
  "evidence": {
    "source_type": "file",
    "path": "src/db/schema.ts",
    "symbol": "createMemoriesTable"
  }
}
```

### `lemma_memory_invalidate`

Explizites Markieren als stale oder superseded:
```json
{
  "fragment_id": "abc123",
  "reason": "Funktion wurde in Refactoring umbenannt"
}
```
