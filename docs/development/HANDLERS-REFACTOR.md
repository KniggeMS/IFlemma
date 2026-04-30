# handlers.ts Targeted SQL Refactor

## Durum

`handlers.ts` hala JSONL-era pattern kullanıyor:

```ts
const memory = core.loadMemory();   // SELECT * FROM memories → RAM'e yükle
memory.push(newFragment);           // Array mutation
core.saveMemory(memory);            // Tüm tabloyu re-upsert et (O(n))
```

Bu, her yazma işleminde tüm memory tablosunu `INSERT ... ON CONFLICT DO UPDATE` ile yeniden yazıyor. Çalışıyor ama O(n) yazma maliyeti var.

## Hedef Pattern

```ts
const db = getDb();
store.addMemory(db, fragment, source, title, project);   // Tek INSERT
```

## Handler Bazında Plan

### Tam Hedeflenen SQL'e Çevrilecekler

| Handler | Şimdiki Pattern | Hedef |
|---|---|---|
| `handleMemoryAdd` | loadMemory → push → saveMemory | `store.addMemory()` (tek INSERT) |
| `handleMemoryUpdate` | loadMemory → findIndex → mutate → saveMemory | `store.updateMemory()` (tek UPDATE) |
| `handleMemoryFeedback` | loadMemory → findIndex → boost/penalize → saveMemory | `store.boostConfidence()` (tek UPDATE) |
| `handleMemoryForget` | loadMemory → validate → deleteMemory | Zaten kısmen targeted, sadece validasyon için `store.getMemoryById()` |
| `handleMemoryMerge` | loadMemory → filter/push/complex → saveMemory | `store.mergeMemories()` (transactional) |
| `handleMemoryRelate` | loadMemory → validate → addRelation → saveMemory | `store.addRelation()` (tek INSERT) + validasyon için `store.getMemoryById()` |
| `handleGuideCreate` | loadGuides → push → saveGuides | `guides/core.ts`'e `addGuideToDb()` ekle |
| `handleGuidePractice` | loadGuides → practiceGuide → loadMemory → mutate → saveAll | `practiceGuide()` zaten `upsertGuideToDb()` kullanıyor, array katı kaldırılabilir |
| `handleGuideDistill` | loadMemory → mutate → saveMemory + loadGuides → saveGuides | Targeted UPDATE + upsertGuideToDb |
| `handleGuideUpdate` | loadGuides → updateGuide → saveGuides | `updateGuide()` zaten `upsertGuideToDb()` kullanıyor, saveGuides kaldırılabilir |
| `handleGuideForget` | loadGuides → deleteGuide → saveGuides | `deleteGuide()` zaten SQL DELETE kullanıyor, saveGuides kaldırılabilir |
| `handleGuideMerge` | loadGuides → push/filter → saveGuides | Transactional SQL merge |

### Sadece Okuma İçin loadMemory Gerekenler (load kalır, save kaldırılır)

| Handler | Açıklama |
|---|---|
| `handleMemoryRead` | Arama/filtreleme için gerekli ama yazma zaten `boostOnAccess` ve `addRelation` üzerinden targeted SQL yapıyor. Son `saveMemory` kaldırılabilir |
| `handleMemoryStats` | `store.getMemoryStats()` ile değiştirilebilir (SQL aggregation) |
| `handleMemoryAudit` | Tam dataset gerekli, `loadMemory()` kalabilir ama read-only |
| `handleSessionStart` | Preload ve boost için gerekli, saveMemory kaldırılabilir |
| `handleSessionEnd` | Auto-link için gerekli, saveMemory kaldırılabilir |

## Adımlar

### 1. `memory/core.ts`'e Eksik Targeted Fonksiyonlar Ekle

`store` (`db/memory-store.ts`) zaten fonksiyonlara sahip ama `core.ts` adapter fonksiyonları eksik:

```ts
// memory/core.ts'e eklenecekler:
export function addFragmentToDb(fragment: MemoryFragment): void { ... }
export function updateFragmentInDb(id: string, updates: {...}): boolean { ... }
export function getFragmentById(id: string): MemoryFragment | null { ... }
export function mergeFragmentsInDb(ids: string[], title: string, fragment: string): string | null { ... }
```

### 2. `guides/core.ts`'e Eksik Targeted Fonksiyonlar Ekle

```ts
// guides/core.ts'e eklenecekler:
export function addGuideToDb(guide: Guide): void { ... }    // zaten upsertGuideToDb var, export et
export function getGuideById(id: string): Guide | null { ... }
export function removeGuideFromDb(name: string): boolean { ... }
export function mergeGuidesInDb(names: string[], newName: string, ...): string | null { ... }
```

### 3. `handlers.ts`'i Sırayla Güncelle

Önce basit handler'lar, sonra karmaşık olanlar:

1. `handleMemoryForget` — zaten neredeyse hazır
2. `handleMemoryRelate` — validasyon + `store.addRelation()`
3. `handleMemoryFeedback` — `store.boostConfidence()`
4. `handleMemoryUpdate` — `store.updateMemory()`
5. `handleMemoryAdd` — `addFragmentToDb()`
6. `handleMemoryStats` — `store.getMemoryStats()`
7. `handleMemoryMerge` — `mergeFragmentsInDb()`
8. `handleGuideCreate` — `addGuideToDb()`
9. `handleGuideForget` — sadece `saveGuides` kaldır
10. `handleGuideUpdate` — sadece `saveGuides` kaldır
11. `handleGuidePractice` — `saveGuides` + `saveMemory` kaldır
12. `handleGuideDistill` — targeted UPDATE
13. `handleGuideMerge` — transactional merge
14. `handleMemoryRead` — `saveMemory` kaldır, boost zaten targeted
15. `handleSessionStart` / `handleSessionEnd` — `saveMemory` kaldır

### 4. `saveMemory()` ve `saveGuides()` Kullanımını Kaldır

Tüm handler'lar targeted SQL kullandığında, `saveMemory()` ve `saveGuides()` sadece `applySessionDecay` ve `migrateConfidenceFloor`'da kullanılacak (onlar da zaten SQL'e taşındı). Bu fonksiyonlar ya kaldırılır ya da sadece migration/export için tutulur.

### 5. `loadMemory()` Kullanımını Minimize Et

Sadece arama, filtreleme ve listeleme için `loadMemory()` kalır. Tek ID lookup'lar `getFragmentById()`, aggregation'lar SQL ile yapılır.

### 6. Test Güncelleme

- Handler testleri artık DB state'i kontrol etmeli, array state'i değil
- `loadMemory` mock'ları `store.*` mock'larına dönüşecek
- Test izolasyonu için `beforeEach`'te DB reset (tek DB dosyası, `setDataDir` + migration)

## Riskler

- **Veri kaybı**: Transactional merge ve relation inheritance dikkatli yapılmalı
- **Race condition**: Şimdiki array pattern atomik (tüm değişiklikler bir array'de). Targeted SQL'de birden fazla SQL statement arasında hata olursa yarım kalabilir. `db.transaction()` kullanılmalı
- **Auto-link logic**: `handleMemoryRead` ve `handleMemoryAdd`'deki auto-relation, auto-association logic'i array mutation'a bağlı. Bu logic'i SQL'e taşımak karmaşık

## Performans Beklentisi

- Yazma: O(n) → O(1) (her yazma tüm tabloyu re-upsert etmek yerine tek satır)
- Okuma: Değişmez (zaten SQLite'dan okuyor)
- Bellek: Artık tüm tabloyu RAM'e yükleyip sonra yazmaya gerek yok
