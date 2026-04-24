<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - LLM'ler için Kalıcı Bellek (MCP)

[English](../README.md) | [Türkçe](README.tr.md)

Lemma, LLM'lere oturumlar arası kalıcı bellek sağlayan bir MCP sunucusudur. Bellekler her oturuma otomatik enjekte edilir — araç çağrısına gerek yoktur. Bilgi kullanım yoluyla evrilir: sık erişilenler güçlenir, kullanılmayanlar solar, örüntüler yeniden kullanılabilir yeteneklere dönüştürülür.

## Hızlı Başlangıç

Lemma'yı MCP istemci yapılandırmanıza ekleyin:

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

> `@latest` kullanmak npx'in her zaman en yeni sürümü çekmesini sağlar.

**Gereksinimler:** Node.js 18.0.0 veya üzeri

## Nasıl Çalışır?

### Evrensel Bellek Enjeksiyonu

Bellekler `tools/list` üzerinden araç açıklamalarına enjekte edilir. LLM her oturuma en önemli belleklerini zaten bilerek başlar — her MCP istemcisinde çalışır.

**3 katmanlı mimari:**
- Katman 1: En önemli bellekler için tam içerik (token bütçeli)
- Katman 2: Kalan bellekler için özet indeksi
- Katman 3: Öğrenimleriyle aktif rehberler

### Fragment Türleri

Her bellek fragmanının doğasını sınıflandıran bir türü vardır:

| Tür | Kullanım | Örnek |
|------|---------|---------|
| `fact` | Teknik bilgi, API davranışı, sürümler | "Node.js 22 native fetch içerir" |
| `pattern` | Tekrar eden çözüm, en iyi uygulama | "React useEffect cleanup örüntüsü" |
| `lesson` | Deneyimden öğrenilen, hata ayıklama | "JSONL parse hataları bozuksatırı sessizce yutar" |
| `warning` | Dikkat, tuzak, dikkat edilmesi gereken | "fs.writeFileSync event loop'u bloklar" |
| `context` | Ortam bilgisi, proje kurulumu | "Bu proje Python 3.11 ile py launcher kullanıyor" |

Belirtilmezse varsayılan `fact`'tir.

### Memory ↔ Guide Pipeline

Bilgi çift yönlü bir pipeline üzerinden akar:

1. **Memory** = NE biliyorsun — gerçekler, gözlemler, teknik detaylar (`memory_add`)
2. **Guide** = NASIL çalışıyorsun — birikmiş deneyim, prosedürel yetenekler (`guide_practice`, `guide_distill`)

Bağlantılar **çift yönlü** ve otomatiktir:
- `guide_distill` → memory'yi guide'a VE guide'ı memory'ye bağlar
- `guide_practice` → oturumda okunmuş memory'ler guide'ı doğrular
- `memory_merge` → ilişkiler, guide bağlantıları ve associations birleştirilen fragmana aktarılır

### Yanıt Hook'ları (Önerilen Aksiyonlar)

Araç yanıtları, anlamlı bağlantılar tespit edildiğinde bağlamsal `SUGGESTED ACTIONS` içerir. Örneğin:

- `memory_add` konu örtüşmesiyle → "Bu fragmanları bağlamak için `memory_relate` çağır"
- `memory_add` türü `pattern` ile → "Yeteneğe dönüştürmek için `guide_distill` çağır"
- `memory_feedback` pozitif → "Yeniden kullanılabilir yeteneğe dönüştürmek için `guide_distill` çağır"
- `session_end` aktivite ile → relate + distill + practice önerileriyle tam inceleme

Hook'lar sadece anlamlı bağlam olduğunda görünür — boş durumda gürültü üretmez.

### Öğrenme Sistemi

Bilgi biyolojik bir bellek modeliyle kullanım yoluyla evrilir:

- **Kalkan**: Erişilen öğeler çürümeden tamamen korunur
- **Kullanılmayan öğeler** çok yavaş çürür (oturum başına 0.002)
- **Olumsuz geri bildirim** güveni -0.02 azaltır
- **İlişkiler**: Birlikte kullanılan fragmanlar otomatik çapraz referanslar oluşturur
- **Zaman bazlı çürüme yok**: Güven sadece sistem aktif olarak kullanıldığında değişir

### Bellek Yapısı

| Alan | Tip | Açıklama |
|-------|------|-------------|
| `id` | string | Benzersiz kimlik (`m` + 12 hex karakter) |
| `title` | string | Kısa başlık |
| `fragment` | string | Sentezlenmiş bellek metni |
| `type` | FragmentType | `fact`, `pattern`, `lesson`, `warning` veya `context` |
| `project` | string | Proje kapsamı (küresel için `null`) |
| `confidence` | float | Güvenilirlik 0.0-1.0 |
| `source` | string | `"user"` veya `"ai"` |
| `relations` | MemoryRelation[] | Diğer fragmanlara tipli bağlantılar |
| `related_guides` | string[] | Bu fragmanın beslediği rehber adları |
| `associatedWith` | string[] | Birlikte erişilen fragman ID'leri |
| `tags` | string[] | Kullanımdan elde edilen bağlam etiketleri |
| `accessed` | int | Mevcut çürüme döngüsündeki erişim sayısı |

### Rehber Yapısı

| Alan | Tip | Açıklama |
|-------|------|-------------|
| `guide` | string | Rehber adı |
| `category` | string | Kategori (örn. `web-frontend`, `dev-tool`) |
| `description` | string | Tam kılavuz/protokoller |
| `source_memories` | string[] | Bu rehberi doğuran bellek ID'leri |
| `validated_by` | string[] | Bu rehberi uygulamada doğrulayan bellek ID'leri |
| `usage_count` | int | Uygulama sayısı |
| `success_count` | int | Başarılı kullanımlar |
| `failure_count` | int | Başarısız kullanımlar |
| `learnings` | string[] | Birikmiş öğrenimler |
| `contexts` | string[] | Kullanıldığı bağlamlar |

### Sanal Oturumlar

Araç çağrıları otomatik olarak sanal oturumlara dönüştürülür:
- İlk araç çağrısında otomatik başlar, 30 dk işlem yapılmazsa otomatik sonlanır
- Karşılaşılan teknolojileri, kullanılan rehberleri, oluşturulan/erişilen bellekleri izler
- Açık `session_start`/`session_end` gerekmez

### Yapılandırma

`~/.lemma/config.json` konumunda isteğe bağlı yapılandırma:

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

### Dosya Konumları

| İşletim Sistemi | Yol |
|---|---|
| **Windows** | `C:\Users\{username}\.lemma\` |
| **macOS** | `/Users/{username}/.lemma/` |
| **Linux** | `/home/{username}/.lemma/` |

Dosyalar: `memory.jsonl`, `guides.jsonl`, `config.json`, `sessions/`, `logs/`, `.bak` yedekleri

---

## Mevcut Araçlar (21)

### Bellek Araçları (11)

#### `memory_read`

Bellek fragmanlarını okur. ÖZET MODU sadece başlık + açıklama gösterir; tam detay için `id` kullanın.

**Parametreler:**
- `project` (string, opsiyonel): Filtrelenecek proje adı
- `query` (string, opsiyonel): Semantik arama anahtar kelimesi
- `id` (string, opsiyonel): Belirli bir fragmanın tam detayını al
- `ids` (string[], opsiyonel): Birden fazla fragmanın tam detaylarını al
- `context` (string, opsiyonel): Bu erişimi bir bağlamla etiketle (örn. "debugging")
- `all` (boolean, opsiyonel): Tüm projelerden fragmanları göster (varsayılan: false)
- `minConfidence` (number, opsiyonel): Minimum güven eşiği (0-1)
- `afterDate` (string, opsiyonel): ISO tarih — bu tarihte veya sonrasında oluşturulanlar
- `beforeDate` (string, opsiyonel): ISO tarih — bu tarihte veya öncesinde oluşturulanlar

#### `memory_add`

**ZORUNLU:** Analizi tamamladıktan SONRA bulguları kaydetmek için çağır. Gizli bilgileri otomatik sansürler, `confirm: true` ile olduğu gibi saklayabilirsiniz.

**Parametreler:**
- `fragment` (string, zorunlu): Bellek metni. Yapısal markdown kullanın: `## [Konu]\n[Bağlam]\n- [Ana noktalar]`
- `title` (string, opsiyonel): Kısa başlık (maks 80 karakter)
- `description` (string, opsiyonel): Kısa özet (maks 150 karakter)
- `project` (string, opsiyonel): Proje kapsamı (null = küresel)
- `source` (string, opsiyonel): "user" veya "ai", varsayılan "ai"
- `confirm` (boolean, opsiyonel): Gizli bilgi tespit edilse de olduğu gibi sakla (varsayılan: false)
- `type` (string, opsiyonel): Fragment türü — `fact`, `pattern`, `lesson`, `warning` veya `context` (varsayılan: `fact`)

#### `memory_update`

Mevcut bir fragmanı ID ile güncelle.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si
- `title` (string, opsiyonel): Yeni başlık
- `fragment` (string, opsiyonel): Yeni metin
- `confidence` (number, opsiyonel): Yeni güven değeri 0-1

#### `memory_feedback`

Kullanımdan sonra bir bellek fragmanı hakkında geri bildirim ver. Pozitif güveni artırır; negatif -0.02 düşürür.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si
- `useful` (boolean, zorunlu): Yardımcı olduysa `true`, olmadıysa `false`

#### `memory_forget`

Bir bellek fragmanını ID ile sil.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si

#### `memory_merge`

Birden fazla fragmanı birleştir. İlişkiler, guide bağlantıları ve associations birleştirilen fragmana aktarılır.

**Parametreler:**
- `ids` (string[], zorunlu): Birleştirilecek fragman ID'leri
- `title` (string, zorunlu): Birleştirilmiş fragmanın başlığı
- `fragment` (string, zorunlu): Birleştirilmiş içerik
- `project` (string, opsiyonel): Proje kapsamı

#### `memory_relate`

İki bellek fragmanı arasında tipli ilişki oluştur. Çift yönlü — ters ilişki otomatik oluşturulur.

**Parametreler:**
- `sourceId` (string, zorunlu): Kaynak fragman ID'si
- `targetId` (string, zorunlu): Hedef fragman ID'si
- `type` (string, zorunlu): `contradicts`, `supersedes`, `supports` veya `related_to`
- `note` (string, opsiyonel): İlişkiyi açıklayan not

#### `memory_stats`

Bellek deposu istatistiklerini getir.

**Parametreler:**
- `project` (string, opsiyonel): Projeye göre filtrele

#### `memory_audit`

Bellek deposunda bütünlük sorunlarını denetle.

### Rehber Araçları (8)

#### `guide_get`

Kullanım istatistikleriyle rehberleri getir, kullanım sayısına göre sıralı.

**Parametreler:**
- `category` (string, opsiyonel): Kategoriye göre filtrele
- `guide` (string, opsiyonel): Belirli rehber detayı al
- `task` (string, opsiyonel): İlgili öneriler almak için görev açıklaması

#### `guide_practice`

**ZORUNLU:** Çalışma sırasında bir rehber kullandığınızda kullanımını kaydedin.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı
- `category` (string, zorunlu): Kategori
- `description` (string, opsiyonel): Detaylı kılavuz/protokoller
- `contexts` (string[], zorunlu): Kullanıldığı bağlamlar
- `learnings` (string[], zorunlu): Keşfedilen yeni öğrenimler
- `outcome` (string, opsiyonel): "success" veya "failure"

#### `guide_create`

Detaylı bir kılavuzla rehber oluştur.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı
- `category` (string, zorunlu): Kategori
- `description` (string, zorunlu): Tam kılavuz/protokoller
- `contexts` (string[], opsiyonel): İlk bağlamlar
- `learnings` (string[], opsiyonel): İlk öğrenimler

#### `guide_distill`

Bir bellek fragmanını rehber öğrenimine dönüştür. Çift yönlü bağlantı oluşturur (memory ↔ guide).

**Parametreler:**
- `memory_id` (string, zorunlu): Bellek fragmanı ID'si
- `guide` (string, zorunlu): Hedef rehber adı
- `category` (string, opsiyonel): Kategori (yeni rehber oluşturuluyorsa gerekli)

#### `guide_update`

Mevcut bir rehberin özelliklerini güncelle.

**Parametreler:**
- `guide` (string, zorunlu): Mevcut rehber adı
- `new_name` (string, opsiyonel): Yeni ad
- `category` (string, opsiyonel): Yeni kategori
- `description` (string, opsiyonel): Yeni açıklama/kılavuz
- `add_anti_patterns` (string[], opsiyonel): Anti-pattern'ler ekle
- `add_pitfalls` (string[], opsiyonel): Bilinen tuzaklar ekle
- `superseded_by` (string, opsiyonel): Başka bir rehberle değiştirildi olarak işaretle
- `deprecated` (boolean, opsiyonel): Kullanımdan kaldırıldı olarak işaretle

#### `guide_forget`

Bir rehberi sil.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı

#### `guide_merge`

Birden fazla rehberi birleştir. Kaynak memory'ler ve doğrulamalar aktarılır.

**Parametreler:**
- `guides` (string[], zorunlu): Birleştirilecek rehber adları
- `guide` (string, zorunlu): Birleştirilmiş rehberin adı
- `category` (string, zorunlu): Kategori
- `description` (string, opsiyonel): Birleştirilmiş açıklama
- `contexts` (string[], opsiyonel): Birleştirilmiş bağlamlar
- `learnings` (string[], opsiyonel): Birleştirilmiş öğrenimler

### Oturum Araçları (2)

#### `session_start`

İzlenen bir çalışma oturumu başlat. İlgili rehberleri ve bellekleri önceden yükler.

**Parametreler:**
- `task_type` (string, zorunlu): "debugging", "implementation", "refactoring", "testing", "research", "documentation", "optimization" veya "other"
- `technologies` (string[], opsiyonel): İlgili teknolojiler
- `initial_approach` (string, opsiyonel): İlk plan

#### `session_end`

Mevcut oturumu sonlandır. Aktivite özeti ve önerilerle SESSION REVIEW gösterir.

**Parametreler:**
- `outcome` (string, zorunlu): "success", "partial", "failure" veya "abandoned"
- `final_approach` (string, opsiyonel): Hangi yaklaşım işe yaradı
- `lessons` (string[], opsiyonel): Öğrenilenler

#### `session_stats`

Sanal oturum istatistiklerini getir.

**Parametreler:**
- `count` (number, opsiyonel): Son oturum sayısı (varsayılan 10)

---

## Manuel Kurulum

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

## Geliştirme

```bash
npm test            # 481 test
npm run typecheck   # TypeScript tip kontrolü
npm run build       # dist/ dizinine derle
```

### Proje Yapısı

```
Lemma/
├── src/
│   ├── index.ts              # MCP sunucu giriş noktası
│   ├── types.ts              # Paylaşılan TypeScript arayüzleri (MemoryFragment, Guide, FragmentType...)
│   ├── memory/
│   │   ├── core.ts           # Temel bellek mantığı, çürüme, arama, tekilleştirme, ilişkiler, associations
│   │   ├── config.ts         # Kullanıcı yapılandırma yükleyici
│   │   ├── seed.ts           # Yerleşik tohum bilgi fragmanları
│   │   └── privacy.ts        # Gizli bilgi tarama ve sansürleme
│   ├── guides/
│   │   ├── core.ts           # Temel rehber mantığı, bulanık tekilleştirme, source_memories, validated_by
│   │   └── task-map.ts       # Görev-rehber eşlemesi
│   ├── server/
│   │   ├── index.ts          # Sunucu kurulumu, enjeksiyon, bildirimler
│   │   ├── handlers.ts       # Araç işleyicileri (21 araç) + yanıt hook'ları
│   │   ├── tools.ts          # Araç tanımları
│   │   ├── hooks.ts          # Hook sistemi ve istem değiştiriciler
│   │   └── system-prompt.ts  # Dinamik sistem istemi
│   └── sessions/
│       ├── core.ts           # Oturum yaşam döngüsü
│       └── virtual.ts        # Sanal oturum izleme
├── tests/                    # 36 test dosyası, 481 test
├── docs/                     # Araştırma makaleleri ve referanslar
├── package.json
├── tsconfig.json
├── CHANGELOG.md
└── README.md
```

## Güvenlik

Tüm veriler yerel olarak `~/.lemma/` dizininde saklanır. Hiçbir şey harici sunuculara gönderilmez. Gizli bilgiler bellek fragmanlarından otomatik olarak sansürlenir.

## Lisans

MIT License
