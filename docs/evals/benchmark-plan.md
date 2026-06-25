# Eval Harness — Benchmark Plan (V2.5)

## Ziel

Lemma V2 braucht messbare Qualitätssignale für:
- **Retrieval-Qualität:** Werden die richtigen Memories gefunden?
- **Staleness-Rate:** Wie oft wird veraltetes Wissen injiziert?
- **Task-Success:** Verbessern Memories die tatsächliche Aufgabenbearbeitung?

## Metriken

| Metrik | Beschreibung | Zielwert |
|---|---|---|
| Recall@5 | Relevante Fragments in Top-5 | > 0.85 |
| Precision@5 | Alle Top-5 tatsächlich relevant | > 0.75 |
| Staleness-Rate | % injizierter stale Memories | < 5% |
| Task-Success | Sessions mit Ziel erreicht / Total | > 0.70 |
| Injection Latency | Zeit für Memory-Injection | < 100ms |

## Test-Szenarien

### Szenario 1: Keyword-Overlap
Query und Memory teilen exakte Keywords → FTS5 Baseline.

### Szenario 2: Semantic Distance
Query und Memory beschreiben dasselbe Konzept mit anderen Wörtern → Vector Retrieval nötig.

### Szenario 3: Trust Filtering
Mehrere ähnliche Memories mit unterschiedlichem Trust-Level → höherer Trust gewinnt.

### Szenario 4: Stale Blocking
Memory referenziert gelöschte Datei → wird blockiert, nicht injiziert.

### Szenario 5: Goal-Scoped Retrieval
Nur Memories relevant zum aktiven Goal werden bevorzugt.

## Implementierung

```typescript
// tests/evals/recall.test.ts
describe('Hybrid Recall@5', () => {
  it('finds semantically similar fragments', async () => {
    const results = await hybridSearch('authentication strategy', { limit: 5 });
    const relevant = results.filter(r => r.tags.includes('auth'));
    expect(relevant.length / 5).toBeGreaterThan(0.85);
  });
});
```

## Benchmark-Befehl

```bash
lemma --eval          # Führt alle Benchmarks aus
lemma --eval recall   # Nur Recall-Tests
lemma --eval stale    # Nur Staleness-Check
```
