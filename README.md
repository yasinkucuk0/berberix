# Berberim

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
| `/panel` | Dükkan paneli: randevular, hizmetler, saatler, marka, paylaş |
| `/yonetim` | Platform yöneticisi: dükkanlar, ödeme/deneme, askıya alma |
| `/<slug>` | Müşterinin gördüğü dükkan sayfası + randevu |

## API

- `POST /api/auth/register-shop`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/slug-check`
- `GET /api/public/shops/:slug`, `GET .../availability?date&serviceId`, `POST .../appointments`
- `GET|PATCH /api/shop`, `/api/shop/services`, `/api/shop/hours`, `/api/shop/appointments`, `/api/shop/stats`
- `GET /api/admin/shops`, `PATCH /api/admin/shops/:id`, `POST /api/admin/setup`

## GELİŞTİRME KURALLARI (UMAY dahil herkes için)

1. **Kiracı izolasyonu:** Dükkana ait her tabloda `shopId` var. `/api/shop/*` rotalarında
   `shopId` HER ZAMAN `req.shopId`'den alınır (giriş yapan kullanıcıdan), istekten asla.
   Her `findMany/findFirst/update` sorgusu `shopId` ile filtrelenir.
2. Yeni tablo → `backend/prisma/schema.prisma` + `npx prisma db push`.
3. Yeni rota → `backend/src/routes/` + `src/app.js`'e bağla + `backend/test/` içine test.
4. Fiyatlar tam sayı TL. Tarih `YYYY-MM-DD`, saat gün içi dakika (`startMinutes`).
5. Şifre özeti, token, `.env` asla yanıtta/logda gösterilmez.

## Canlıya çıkış (sonra)

`schema.prisma` → `provider = "postgresql"`, `url = env("DATABASE_URL")`; frontend için
`VITE_API_URL`, backend için `CLIENT_ORIGIN` ayarlanır. Mağaza uygulaması için PWA
Capacitor ile Android/iOS paketine çevrilebilir.
