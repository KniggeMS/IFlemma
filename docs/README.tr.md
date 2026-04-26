<p align="center">
  <img src="../assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma — LLM'ler için Kalıcı Bellek (MCP)

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

**Gereksinimler:** Node.js 20.0.0 veya üzeri

## Nasıl Çalışır?

Bellekler `tools/list` üzerinden araç açıklamalarına enjekte edilir. LLM her oturuma en önemli belleklerini zaten bilerek başlar.

**3 katmanlı enjeksiyon:**
- En önemli bellekler için tam içerik (token bütçeli)
- Kalan bellekler için özet indeksi
- Öğrenimleriyle aktif rehberler

**Bellek türleri:** `fact`, `pattern`, `lesson`, `warning`, `context`

**Bilgi akışı:** Memory (ne biliyorsun, `memory_add`) ↔ Guide (nasıl çalışıyorsun, `guide_practice`/`guide_distill`)

## Araçlar (21)

### Bellek (11)

| Araç | Açıklama |
|------|----------|
| `memory_read` | Fragmanları oku/ara. Özet modu veya ID ile tam detay |
| `memory_add` | Bulguları kaydet. Gizli bilgileri otomatik sansürler |
| `memory_update` | ID ile fragman güncelle |
| `memory_feedback` | Pozitif/negatif geri bildirim, güveni ayarlar |
| `memory_forget` | Fragman sil |
| `memory_merge` | Fragmanları birleştir, ilişkiler ve rehber bağlantıları aktarılır |
| `memory_relate` | Tipli bağlantılar oluştur (`contradicts`, `supersedes`, `supports`, `related_to`) |
| `memory_stats` | Fragman sayıları, güven, proje dağılımı |
| `memory_audit` | Bütünlük kontrolü (yetim, tekrar, anomali) |

### Rehberler (8)

| Araç | Açıklama |
|------|----------|
| `guide_get` | Kullanıma göre sıralı rehberler, kategori veya görev filtresi |
| `guide_practice` | Rehber kullanımını kaydet. Çalışma sırasında zorunlu |
| `guide_create` | Kılavuzla rehber oluştur |
| `guide_distill` | Belleği rehber öğrenimine dönüştür (çift yönlü bağlantı) |
| `guide_update` | Rehber özelliklerini güncelle |
| `guide_forget` | Rehber sil |
| `guide_merge` | Rehberleri birleştir, kaynak bellekleri aktar |

### Oturumlar (2)

| Araç | Açıklama |
|------|----------|
| `session_start` | İzlenen oturum başlat, ilgili bağlamı önceden yükle |
| `session_end` | İnceleme ve önerilerle oturumu sonlandır |
| `session_stats` | Sanal oturum istatistikleri |

## Yapılandırma

`~/.lemma/config.json` konumunda isteğe bağlı:

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

## Dosya Konumları

| İşletim Sistemi | Yol |
|---|---|
| **Windows** | `C:\Users\{username}\.lemma\` |
| **macOS/Linux** | `~/.lemma/` |

Dosyalar: `memory.jsonl`, `guides.jsonl`, `config.json`, `sessions/`, `logs/`, `.bak` yedekleri

## Anlamsal Arama

Lemma `@huggingface/transformers` ile isteğe bağlı embedding tabanlı anlamsal arama içerir. İlk kullanımda 470MB çok dilli model `~/.lemma/models/` dizinine indirilir. Hazır olana kadar Fuse.js anahtar kelime eşleştirmesine geri döner. Yapılandırmaya gerek yok — otomatik aktifleşir.

## Güvenlik

Tüm veriler yerel olarak `~/.lemma/` dizininde saklanır. Hiçbir şey harici sunuculara gönderilmez. Gizli bilgiler bellek fragmanlarından otomatik olarak sansürlenir (API anahtarları, tokenlar, bağlantı dizgileri için 17 regex deseni).

## Dokümantasyon

- [Geliştirme Rehberi](development/DEVELOPMENT.md) — Mimari, proje yapısı, test
- [Yol Haritası](development/ROADMAP.md) — v0.9, v0.10, v1.0 planları
- [Araştırmalar](research/README.md) — Lemma'nın tasarımını etkileyen akademik makaleler
- [Değişiklik Günlüğü](../CHANGELOG.md) — Sürüm geçmişi

## Lisans

MIT
