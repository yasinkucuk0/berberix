# BERBERİX'i internete çıkarma (ücretsiz)

Toplam ~25 dakika. Kart bilgisi gerekmez. 2. ve 3. adım telefondan da yapılabilir.

| Parça | Nerede | Ücret |
|---|---|---|
| Kod | GitHub (gizli depo) | Ücretsiz |
| Veritabanı (PostgreSQL) | Neon | Ücretsiz plan, süresiz |
| Backend (API) + site | Render | Ücretsiz (15 dk boşta kalınca uyur, ilk açılış ~1 dk) |

## 1. Kodu GitHub'a gönder (bilgisayarda, 3 dk)
VS Code'da `berberim` klasörünü aç → sağdaki **Claude Code**'a şunu yaz:

> testleri çalıştır, geçerse her şeyi commit et; GitHub'da `berberim` adında **gizli (private)** depo oluşturup gönder

(GitHub girişi isterse tarayıcıda onayla.) UMAY ile: `berberim github bağla` ve `berberim github'a gönder`.

## 2. Neon: veritabanı (telefondan olur, 5 dk)
1. **neon.com** → *Sign up* → **GitHub ile devam et**.
2. *Create project* → ad: `berberix`, bölge: **AWS Europe Central (Frankfurt)** → *Create*.
3. Açılan ekranda **Connection string**'i kopyala (`postgresql://...sslmode=require` ile biter). Kimseyle paylaşma.

## 3. Render: site + API (telefondan olur, 10 dk)
1. **render.com** → *Get Started* → **GitHub ile giriş** → `berberim` deposuna izin ver.
2. *New +* → **Blueprint** → `berberim` deposunu seç. Render `render.yaml`'ı okur, 2 servis gösterir.
3. Sorulan 3 değer:
   - `DATABASE_URL` → Neon'dan kopyaladığın adres
   - `CLIENT_ORIGIN` → `https://berberim.onrender.com`
   - `VITE_API_URL` → `https://berberim-api.onrender.com/api`
4. **Apply**. Kurulum 5-10 dk sürer (ikisi de yeşil "Live" olunca tamam).
5. Render servis adını değiştirdiyse (ör. `berberim-x1y2`), gerçek adreslerle `CLIENT_ORIGIN` (berberim-api servisinde)
   ve `VITE_API_URL` (berberim servisinde) değerlerini düzelt → **Save, rebuild and deploy**.

## 4. İlk açılış (5 dk)
1. Render → `berberim-api` → **Environment** → `ADMIN_SETUP_TOKEN` değerini kopyala.
2. `https://<site>/yonetim` → adın, e-postan, şifren (en az 10 karakter) ve bu anahtarla **yöneticini oluştur**.
3. Yönetim ekranında **"Demo dükkanı kur / sıfırla"** → ana sayfadaki "Paneli dene" düğmesi çalışır.
4. Ana sayfa → **14 gün ücretsiz başla** → Barbaros'u kaydet (ilk gerçek dükkan). Yönetimden **"Ödeme alındı (+30 gün)"** ile süresini uzat.
   Panel → Ayarlar → Marka: telefon/WhatsApp `0545 557 20 87`, adres `Aktepe Mah. Gül Sok. No:1`, şehir `Hassa / Hatay`.
5. Panelde Ayarlar → Çalışanlar, Hizmetler, Marka. Ayarlar → Paylaş → linki Instagram/WhatsApp'a koy.
6. Telefonda: panel adresini Chrome'da aç → menü ⋮ → **Uygulamayı yükle**.

## 5. Satıştan önce (kodda tek dosya)
`frontend/src/config/brand.js`:
- `contactWhatsApp`: satış numaran (✅ 0545 557 20 87 eklendi)
- `address`: adres (✅ Aktepe Mah. Gül Sok. No:1, Hassa / Hatay eklendi)
- `PLANS`: paket adları ve fiyatlar
- `legalName` / `legalEmail`: KVKK metninde görünen ad ve başvuru e-postası

> KVKK Aydınlatma Metni ve Kullanım Koşulları (`/kvkk`, `/kosullar`) genel bir taslaktır. Satışa başlamadan önce bir
> avukata ya da mali müşavire okutman önerilir. Fatura kesmek için şahıs şirketi / vergi levhası gerekir.

## Güncelleme
Her "GitHub'a gönder" sonrası Render kendiliğinden yeniden kurar. Veritabanı şeması `backend/prisma/schema.prisma`'dan
otomatik PostgreSQL'e çevrilir (`npm run build:prod`). Veri silecek bir şema değişikliğinde kurulum bilerek durur.

## Sonra (ücretli, gelir gelince)
- Kendi alan adın (ör. `berberix.com`, yıllık birkaç yüz TL) → Render → Settings → Custom Domain.
- Render ücretli plan (aylık birkaç dolar): sunucu uyumaz, ilk açılış beklemesi biter.
