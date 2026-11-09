# BERBERİX (klasör adı: berberim)

Berberler için çok kiracılı (multi-tenant) randevu platformu. Kurucu: Yasin (aktif berber).
Marka: premium/lüks, slogan fikri "Tarzın, Berberin, Dünyan." İlk dükkan: Barbaros.
Önce mobil (PWA, sonra Capacitor ile Android/iOS). Şu an ücretli hiçbir şey kullanılamaz.

## Teknoloji
- frontend/: React + Vite (PWA) → http://localhost:5174
- backend/: Node.js + Express + Prisma (yerelde SQLite, canlıda PostgreSQL/Neon) → http://localhost:5100
- Yayın: Render (render.yaml) + Neon. Ayrıntı: DEPLOY.md

## Komutlar
- Backend: `cd backend && npm install && npx prisma db push && node server.js`
- Frontend: `cd frontend && npm install && npm run dev`
- Test: `cd backend && npm test`

## Kurallar (README'deki GELİŞTİRME KURALLARI geçerli)
1. Kiracı izolasyonu: `/api/shop/*` rotalarında `shopId` HER ZAMAN `req.shopId`'den alınır, istekten asla. Her sorgu `shopId` ile filtrelenir.
2. Yeni tablo → `backend/prisma/schema.prisma` + `npx prisma db push`.
3. Yeni rota → `backend/src/routes/` + `src/app.js` + `backend/test/` içine test.
4. Fiyat tam sayı TL; tarih `YYYY-MM-DD`; saat gün içi dakika (`startMinutes`).
5. `.env`, şifre özeti, token asla okunmaz, yanıtta veya logda gösterilmez.
6. Değişiklikten sonra testleri çalıştır; geçmeden GitHub'a gönderme.
7. KARAR MİMARİSİ: İş kararları (onay/red, öneri, risk, platform kararı) SADECE `backend/src/decisions/` içinde yazılır; rotalar karar vermez, karar katmanını çağırır. Yeni kural → politika dosyası + test + `docs/KARAR-MIMARISI.md`. Büyük teknik karar → aynı belgeye ADR.

## Çalışma şekli
- Türkçe konuş, sade anlat (kullanıcı yazılımcı değil, berber).
- İşleri toplu yap, gereksiz onay sorma; sonunda yapılacak elle adımları tek listede ver.
- Arayüzde React/Express dokümanı gerekirse context7 MCP'yi kullan; arayüzü playwright MCP ile tarayıcıda test et.
