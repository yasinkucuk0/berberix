# BERBERİX

Berberler için çok kiracılı (multi-tenant) randevu platformu. Her berber kendi
markasıyla (ad, logo, renk, hizmet, fiyat, saat) dükkan sayfasını oluşturur;
müşteriler `adres/<dukkan>` sayfasından online randevu alır. Telefonda uygulama
olarak (PWA) ana ekrana eklenir.

## Çalıştırma

UMAY: `berberim siteyi aç` (kurulumu, veritabanını ve sunucuları kendisi yapar).

Elle:

```
cd backend   && npm install && npx prisma db push && node server.js   # http://localhost:5100
cd frontend  && npm install && npm run dev                            # http://localhost:5174
```

- İlk açılışta `backend/.env` rastgele JWT anahtarıyla otomatik oluşur.
- Platform yöneticisi: `http://localhost:5174/yonetim` (ilk açılışta bir kez oluşturulur,
  yalnızca sunucu bilgisayarından).
- Testler: `cd backend && npm test` (gerçek veritabanına dokunmaz).
- Telefondan deneme: aynı Wi-Fi'da `http://BILGISAYAR-IP:5174`.

## Sayfalar

| Adres | Ne |
|---|---|
| `/` | Platform tanıtımı |
| `/kayit` | Berber dükkanını/markasını oluşturur (14 gün deneme) |
| `/giris` | Giriş |
| `/panel` | Dükkan paneli: Randevu, Müşteri (CRM), Kasa, Asistan (karar motoru), Ayarlar (hizmet, çalışanlar, saat, marka, paylaş) |
| `/yonetim` | Platform yöneticisi: dükkanlar, ödeme/deneme, askıya alma |
| `/r/<token>` | Müşterinin randevusunu görüp iptal ettiği sayfa |
| `/kvkk`, `/kosullar` | KVKK Aydınlatma Metni, Kullanım Koşulları |
| `/demo-berber` | Satış demosu (yönetimden kurulur; ana sayfada "Paneli dene") |
| `/<slug>` | Müşterinin gördüğü dükkan sayfası + randevu (KVKK onayı zorunlu) |

## API

- `POST /api/auth/register-shop`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/slug-check`
- `GET /api/public/shops/:slug`, `GET .../availability?date&serviceId`, `POST .../appointments`
- `GET|PATCH /api/shop`, `/api/shop/services`, `/api/shop/hours`, `/api/shop/appointments`, `/api/shop/stats`
- `GET /api/admin/shops`, `PATCH /api/admin/shops/:id`, `POST /api/admin/setup`
- Demo ve KVKK: `POST /api/auth/demo`, `POST /api/admin/demo/reset`, `PUT /api/shop/customers/:key/consent { marketingConsent: false }`;
  randevu gövdesinde `kvkk: true` zorunlu, `marketingConsent` isteğe bağlı; kayıtta `acceptTerms: true` zorunlu
- Satış ayarları (fiyat, WhatsApp, yasal ad): `frontend/src/config/brand.js`
- Müşteri iptal linki: `/r/<token>` sayfası; `GET /api/public/appointments/:token`, `POST /api/public/appointments/:token/cancel`
- Kapalı günler: `GET|POST /api/shop/closed-days`, `DELETE /api/shop/closed-days/:id`; öğle arası: `PUT /api/shop/hours` (`breakStart`, `breakEnd`)
- Sadakat: `PATCH /api/shop/decisions/settings { loyaltyEvery }` (0 = kapalı)
- Çalışan girişi: `PUT|DELETE /api/shop/barbers/:id/login { email, password }`; çalışan (STAFF) sadece kendi randevularını görür.
  Şifre: `POST /api/auth/password { currentPassword, newPassword }`. Paket: `PATCH /api/admin/shops/:id { plan: BASIC|PRO|SALON }`
- Karar motoru: `GET /api/shop/decisions/insights`, `GET|PATCH /api/shop/decisions/settings`,
  `GET /api/shop/decisions/log`, `GET /api/shop/customers/profile?phone=`
- Müşteriler: `GET /api/shop/customers?q=&segment=`, `GET /api/shop/customers/:key`, `PUT /api/shop/customers/:key/note`
- Çalışanlar: `GET|POST /api/shop/barbers`, `PATCH /api/shop/barbers/:id` (ad, ünvan, izinli günler, aktif/pasif);
  randevuda `barberId` (müşteri sayfasında `any` = fark etmez → karar motoru atar), `GET /api/shop/appointments?barberId=`,
  `PATCH /api/shop/appointments/:id { barberId }` ile aktarma
- Kasa: `GET /api/shop/cash?date=` (gün içi `byBarber` kırılımı dahil), `GET /api/shop/cash/report?from&to`, `POST /api/shop/cash`, `DELETE /api/shop/cash/:id`, `GET /api/shop/cash/meta`
  (randevu `PATCH .../appointments/:id { status: "COMPLETED", paymentMethod }` kasaya otomatik gelir yazar)

## Karar mimarisi

Randevu onay/red, müşteri riski, dükkan önerileri ve platform kararları tek bir açıklanabilir
kural motorunda (`backend/src/decisions/`). Ayrıntı ve teknik karar kayıtları (ADR):
[docs/KARAR-MIMARISI.md](docs/KARAR-MIMARISI.md)

## GELİŞTİRME KURALLARI (UMAY dahil herkes için)

1. **Kiracı izolasyonu:** Dükkana ait her tabloda `shopId` var. `/api/shop/*` rotalarında
   `shopId` HER ZAMAN `req.shopId`'den alınır (giriş yapan kullanıcıdan), istekten asla.
   Her `findMany/findFirst/update` sorgusu `shopId` ile filtrelenir.
2. Yeni tablo → `backend/prisma/schema.prisma` + `npx prisma db push`.
3. Yeni rota → `backend/src/routes/` + `src/app.js`'e bağla + `backend/test/` içine test.
4. Fiyatlar tam sayı TL. Tarih `YYYY-MM-DD`, saat gün içi dakika (`startMinutes`).
5. Şifre özeti, token, `.env` asla yanıtta/logda gösterilmez.
6. **Karar mimarisi:** İş kararları sadece `backend/src/decisions/` içinde; rotalar karar vermez.

## Canlıya çıkış (sonra)

`schema.prisma` → `provider = "postgresql"`, `url = env("DATABASE_URL")`; frontend için
`VITE_API_URL`, backend için `CLIENT_ORIGIN` ayarlanır. Mağaza uygulaması için PWA
Capacitor ile Android/iOS paketine çevrilebilir.
