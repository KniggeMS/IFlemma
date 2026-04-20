<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - LLM'ler için Kalıcı Bellek (MCP)

[English](../README.md) | [Türkçe](README.tr.md)

Lemma, Büyük Dil Modelleri (LLM) için kalıcı bir bellek katmanı sağlayan bir Model Bağlam Protokolü (MCP) sunucusudur. LLM'lerin oturumlar arasında gerçekleri, tercihleri ve bağlamı hatırlamasını sağlar; otomatik çürüme, öğrenme ve evrensel enjeksiyon ile biyolojik bir bellek modeli sunar.

## Lemma Nedir?

Lemma, AI asistanları için harici bir hipokampüs görevi görür. İnsan beyni her şeyi kaydetmez — sentezler, damıtır ve fragmanlar bırakır. Sık erişilen bilgiler güçlenir; kullanılmayan bilgiler solar ve unutulur.

Lemma aynı prensiple çalışır:

- **Ham konuşmalar asla saklanmaz** — sadece sentezlenmiş fragmanlar
- **Fragmanlar zamanla çürür** — sık erişilenler güçlenir
- **Kullanılan bilgi bağlam kazanır** — etiketler ve ilişkiler otomatik oluşturulur
- **Bellekler otomatik enjekte edilir** — LLM araç çağırmadan onları görür

## Nasıl Çalışır?

### Evrensel Bellek Enjeksiyonu (Universal Memory Injection)

Lemma, bellekleri `tools/list` üzerinden doğrudan araç açıklamalarına enjekte eder. Bu **her MCP istemcisinde** çalışır — Claude Desktop, Cursor, VS Code, opencode, Gemini CLI ve diğerleri.

```
tools/list → memory_read description includes:
  "YOUR MEMORIES (you already know these):
   [m8f728] React Architecture (95%)
   Full content here...
   [m1bbea] Clean Code Research (77%)
   Full content here..."
```

LLM her oturuma en önemli belleklerini zaten bilerek başlar. Açık bir araç çağrısına gerek yoktur.

**Çift katmanlı enjeksiyon:**
1. **Açıklamalar (Tool descriptions)** — evrensel, her yerde çalışır
2. **`instructions` alanı** — MCP başlatma talimatlarını destekleyen istemciler için

**3 katmanlı mimari:**
- Katman 1: En önemli bellekler için tam içerik (~3000 token, yapılandırılabilir)
- Katman 2: Kalan bellekler için özet indeksi
- Katman 3: Açıklamaları ve öğrenimleriyle aktif rehberler

### Bellek Yapısı

Her bellek fragmanı şu alanlara sahiptir:

| Alan | Tip | Açıklama |
|-------|------|-------------|
| `id` | string | Benzersiz kimlik (`m` + crypto.randomUUID'den 12 hex karakter) |
| `title` | string | Hızlı tarama için kısa başlık |
| `fragment` | string | Sentezlenmiş bellek metni |
| `project` | string | Proje kapsamı (küresel için `null`) |
| `confidence` | float | Güvenilirlik 0.0-1.0 (zamanla çürür ve güçlenir) |
| `source` | string | `"user"` veya `"ai"` |
| `created` | string | Oluşturulma tarihi (YYYY-MM-DD) |
| `lastAccessed` | string | Son okuma zamanı (ISO timestamp) |
| `accessed` | int | Mevcut çürüme döngüsündeki erişim sayısı |
| `tags` | string[] | Kullanımdan elde edilen bağlam etiketleri (örn. "debugging", "refactoring") |
| `associatedWith` | string[] | Aynı oturumda erişilen fragman ID'leri |
| `negativeHits` | int | Bu belleğin yardımcı olmadığı işaretlenme sayısı (oturum başına sıfırlanır) |

### Öğrenme Sistemi

Statik belleğin aksine, Lemma bilginin kullanım yoluyla evrildiği biyolojik bir model kullanır:

**Güçlendirme (erişimde):**
```
confidence = min(1.0, confidence + 0.015)
tags += context_tag  (örn. "debugging")
associatedWith += co_accessed_fragment_ids
```

**Çürüme (oturum başına, sadece kullanılmayan fragmanlar):**
```
if accessed == 0:
    confidence = confidence - 0.002
if accessed > 0:
    çürüme yok (kalkan — kullanılan bilgi korunur)
```

- **Kalkan**: Sık erişilen öğeler çürümeden tamamen korunur
- **Kullanılmayan öğeler** oturum başına sadece 0.002 çürür (çok yavaş)
- **Olumsuz geri bildirim** güveni -0.02 azaltır (eskiden -0.1 idi)
- **İlişkiler**: Birlikte kullanılan fragmanlar gelecekteki hatırlama için çapraz referanslar oluşturur
- **Zaman bazlı çürüme yok**: Güven sadece sistem aktif olarak kullanıldığında değişir

### Tekilleştirme (Deduplication)

Lemma, tekilleştirme için **Fuse.js bulanık eşleştirme** (Jaccard değil) kullanır:
- "Use React hooks" vs "Don't use React hooks" — doğru şekilde farklı algılanır
- "react", "reactjs", "React.js" — doğru şekilde aynı algılanır (rehberler için)
- Hem kullanıcı hem de AI kaynaklı belleklere uygulanır

### Sanal Oturumlar (Virtual Sessions)

Araç çağrıları otomatik olarak sanal oturumlara dönüştürülür:
- İlk araç çağrısında otomatik başlar
- 30 dakikalık işlem yapılmadığında otomatik sonlanır
- Karşılaşılan teknolojileri, kullanılan rehberleri, oluşturulan bellekleri izler
- Açık `session_start`/`session_end` gerekmez
- Oturumlar `~/.lemma/sessions/` dizininde saklanır

### Veri Güvenliği

- **Kümülatif yedekleme**: `.bak` dosyaları ID tabanlı birleştirmedir — mevcut girdilerin üzerine asla yazmaz
- **Dosya kilitleme**: Modül düzeyinde yazma kilidi eşzamanlı veri bozulmasını önler
- **Güvenli I/O**: Boş/null diziler yazılmadan önce reddedilir
- **Örtük silme yok**: Çürüme sadece güveni azaltır, fragmanları asla kaldırmaz

### Yapılandırma

`~/.lemma/config.json` konumunda isteğe bağlı yapılandırma dosyası:

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

Dosyalar:
- `memory.jsonl` — bellek fragmanları
- `guides.jsonl` — deneyim rehberleri
- `config.json` — kullanıcı yapılandırması (isteğe bağlı)
- `sessions/` — sanal oturum kayıtları
- `.bak` dosyaları — kümülatif yedekler

## Hızlı Başlangıç

Lemma'yı MCP istemci yapılandırmanıza ekleyin:

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

## Hook Sistemi

Lemma, sunucu davranışını genişletmek için eklenti tabanlı bir hook sistemi sağlar:

### Yaşam Döngüsü Hook'ları

```javascript
import { registerHook, HookTypes } from "@lemma/lemma/server";

registerHook(HookTypes.ON_START, async (context) => {
  console.log("Server started!", context);
});

registerHook(HookTypes.ON_PROJECT_CHANGE, async (context) => {
  console.log(`Project changed to: ${context.project}`);
});
```

### İstem Değiştiricileri

Sistem istemi oluşturmayı özel dönüşümlerle genişletin:

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

## Manuel Kurulum

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

**Gereksinimler:** Node.js 18.0.0 veya üzeri

### Yerel Yapılandırma

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

**ZORUNLU:** Analizi tamamladıktan SONRA bulguları kaydetmek için çağır. Gizli bilgileri otomatik olarak sansürler, `confirm: true` ile olduğu gibi saklayabilirsiniz.

**Parametreler:**
- `fragment` (string, zorunlu): Saklanacak bellek metni
- `title` (string, opsiyonel): Kısa başlık
- `description` (string, opsiyonel): Kısa özet
- `project` (string, opsiyonel): Proje kapsamı (null = küresel)
- `source` (string, opsiyonel): "user" veya "ai", varsayılan "ai"
- `confirm` (boolean, opsiyonel): Gizli bilgi tespit edilse de olduğu gibi sakla (varsayılan: false)

#### `memory_update`

Mevcut bir fragmanı ID ile güncelle.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si
- `title` (string, opsiyonel): Yeni başlık
- `fragment` (string, opsiyonel): Yeni metin
- `confidence` (number, opsiyonel): Yeni güven değeri 0-1

#### `memory_feedback`

Kullanımdan sonra bir bellek fragmanı hakkında geri bildirim ver. Pozitif geri bildirim güveni artırır; negatif -0.02 düşürür.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si
- `useful` (boolean, zorunlu): Yardımcı olduysa `true`, olmadıysa `false`

#### `memory_forget`

Bir bellek fragmanını ID ile sil.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si

#### `memory_merge`

Birden fazla fragmanı birleştir. Yeni ID oluşturur, orijinalleri siler.

**Parametreler:**
- `ids` (string[], zorunlu): Birleştirilecek fragman ID'leri
- `title` (string, zorunlu): Birleştirilmiş fragmanın başlığı
- `fragment` (string, zorunlu): Birleştirilmiş içerik
- `project` (string, opsiyonel): Proje kapsamı

#### `memory_relate`

İki bellek fragmanı arasında tipli ilişki oluştur.

**Parametreler:**
- `sourceId` (string, zorunlu): Kaynak fragman ID'si
- `targetId` (string, zorunlu): Hedef fragman ID'si
- `type` (string, zorunlu): `contradicts`, `supersedes`, `supports` veya `related_to`
- `note` (string, opsiyonel): İlişkiyi açıklayan not

#### `memory_stats`

Bellek deposu istatistiklerini getir: fragman sayıları, ortalama güven, proje dağılımı.

**Parametreler:**
- `project` (string, opsiyonel): Projeye göre filtrele

#### `memory_audit`

Bellek deposunda bütünlük sorunlarını denetle: yetim referanslar, yinelenen ID'ler, güven anomalileri.

### Rehber Araçları (8)

#### `guide_get`

Kullanım istatistikleriyle takip edilen rehberleri getir. Kullanım sayısına göre sıralı (en çok kullanılan önce).

**Parametreler:**
- `category` (string, opsiyonel): Kategoriye göre filtrele
- `guide` (string, opsiyonel): Belirli rehber detayı al
- `task` (string, opsiyonel): İlgili rehber önerileri almak için görev açıklaması

#### `guide_practice`

**ZORUNLU:** Çalışma sırasında bir rehber kullandığınızda kullanımını kaydedin.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı
- `category` (string, zorunlu): Kategori
- `description` (string, opsiyonel): Detaylı kılavuz/protokoller
- `contexts` (string[], zorunlu): Kullanıldığı bağlamlar
- `learnings` (string[], zorunlu): Keşfedilen yeni öğrenimler
- `outcome` (string, opsiyonel): "success" veya "failure" — başarı oranını izler

#### `guide_create`

Detaylı bir kılavuzla rehber oluştur.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı
- `category` (string, zorunlu): Kategori
- `description` (string, zorunlu): Tam kılavuz/protokoller
- `contexts` (string[], opsiyonel): İlk bağlamlar
- `learnings` (string[], opsiyonel): İlk öğrenimler

#### `guide_distill`

Bir bellek fragmanını rehber öğrenimine dönüştür.

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

Birden fazla rehberi birleştir. Kullanım sayıları toplanır.

**Parametreler:**
- `guides` (string[], zorunlu): Birleştirilecek rehber adları
- `guide` (string, zorunlu): Birleştirilmiş rehberin adı
- `category` (string, zorunlu): Kategori
- `description` (string, opsiyonel): Birleştirilmiş açıklama
- `contexts` (string[], opsiyonel): Birleştirilmiş bağlamlar
- `learnings` (string[], opsiyonel): Birleştirilmiş öğrenimler

### Oturum Araçları (2)

#### `session_start`

İzlenen bir çalışma oturumu başlat. Görev metaverisini kaydeder, ilgili rehberleri ve önceden yüklenmiş bellekleri getirir.

**Parametreler:**
- `task_type` (string, zorunlu): "debugging", "implementation", "refactoring", "testing", "research", "documentation", "optimization" veya "other"
- `technologies` (string[], opsiyonel): İlgili teknolojiler
- `initial_approach` (string, opsiyonel): İlk plan

#### `session_end`

Mevcut oturumu sonlandır. Sonucu kaydeder ve rehber başarı takibini günceller.

**Parametreler:**
- `outcome` (string, zorunlu): "success", "partial", "failure" veya "abandoned"
- `final_approach` (string, opsiyonel): Hangi yaklaşım işe yaradı
- `lessons` (string[], opsiyonel): Öğrenilenler

#### `session_stats`

Sanal oturum istatistiklerini getir: son araç kullanım örüntüleri ve teknolojiler.

**Parametreler:**
- `count` (number, opsiyonel): Son oturum sayısı (varsayılan 10)

## Felsefe

### Saklanması Gerekenler

**Kullanıcı Katmanı:**
- Kullanıcı tercihleri (iletişim tarzı, format, dil)
- Proje bağlamı (teknoloji yığını, klasör yapısı, konvansiyonlar)
- Açıkça istenen anılar

**Yetenek Katmanı:**
- Kullanılan başarılı çözümler ve yaklaşımlar
- Tekrar eden görevler için keşfedilen kısayollar
- Denenen ve başarısız olan yaklaşımlar

### Saklanmaması Gerekenler

- Ham konuşma içeriği
- Tekrar etmeyecek tek seferlik sorular
- Geçici veya yüksek bağlama özgü bilgiler
- Kişisel veya hassas veriler

## Geliştirme

### Testleri Çalıştırma

```bash
npm test
```

415 test: bellek çekirdeği, rehber çekirdeği, işleyiciler, öğrenme yaşam döngüsü, hook sistemi, dinamik istem oluşturma, sanal oturumlar, gizlilik filtreleme, sorgu filtreleri, konu örtüşmesi, ilişkiler, enjeksiyon sıralaması ve oturum önyüklemesi kapsar. Tüm I/O geçici dizinlere izole edilir.

```bash
npm run typecheck   # TypeScript tip kontrolü
npm run build       # TypeScript'i dist/ dizinine derle
```

### Proje Yapısı

```
Lemma/
├── src/
│   ├── index.ts              # MCP sunucu giriş noktası
│   ├── types.ts              # Paylaşılan TypeScript arayüzleri
│   ├── memory/
│   │   ├── index.ts          # Bellek modülü yeniden dışa aktarmalar
│   │   ├── core.ts           # Temel bellek mantığı, çürüme, arama, tekilleştirme, ilişkiler
│   │   ├── config.ts         # Kullanıcı yapılandırma yükleyici
│   │   └── privacy.ts        # Gizli bilgi tarama ve sansürleme
│   ├── guides/
│   │   ├── index.ts          # Rehber modülü yeniden dışa aktarmalar
│   │   ├── core.ts           # Temel rehber mantığı, bulanık tekilleştirme
│   │   └── task-map.ts       # Görev-rehber eşlemesi
│   ├── server/
│   │   ├── index.ts          # Sunucu kurulumu, enjeksiyon, bildirimler
│   │   ├── handlers.ts       # Araç işleyicileri (21 araç)
│   │   ├── tools.ts          # Araç tanımları
│   │   ├── hooks.ts          # Hook sistemi ve istem değiştiriciler
│   │   └── system-prompt.ts  # Dinamik sistem istemi
│   └── sessions/
│       ├── index.ts          # Oturum modülü yeniden dışa aktarmalar
│       ├── core.ts           # Oturum yaşam döngüsü
│       └── virtual.ts        # Sanal oturum izleme
├── tests/
│   ├── memory/               # 7 test dosyası
│   ├── guides/               # 6 test dosyası
│   ├── sessions/             # 2 test dosyası
│   └── server/               # 10 test dosyası
├── docs/                     # Araştırma makaleleri ve referanslar
├── package.json
├── tsconfig.json
├── CHANGELOG.md
└── README.md
```

## Güvenlik

Tüm veriler yerel olarak `~/.lemma/` dizininde saklanır. Hiçbir şey harici sunuculara gönderilmez. Kullanıcılar istedikleri zaman MCP araçları üzerinden veya doğrudan verileri inceleyebilir, düzenleyebilir veya temizleyebilir.

## Lisans

MIT License
