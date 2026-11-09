# BERBERİX Karar Mimarisi

Bu belgenin iki bölümü var:

1. **Ürün içi karar motoru:** Platform bir karar verirken (randevu onaylansın mı, dükkana ne önerilsin, hangi dükkan askıya alınmalı) bunu nasıl yapıyor.
2. **Mimari karar kayıtları (ADR):** Projeyi kurarken verdiğimiz teknik kararlar ve nedenleri. Yeni bir büyük karar verince buraya eklenir.

---

## 1. Karar motoru

### Neden var?

İş kuralları rotaların içine dağılırsa ileride kimse "bu randevu neden reddedildi?" sorusunu cevaplayamaz. Bu yüzden **bütün iş kararları tek bir yerde** (`backend/src/decisions/`) toplanır. Rotalar karar vermez, sadece karar katmanını çağırır.

### İlkeler

| İlke | Anlamı |
|---|---|
| **Açıklanabilir** | Her karar, hangi kuralların çalıştığını ve nedenini Türkçe cümleyle döndürür. |
| **Saf ve deterministik** | Kurallar veritabanına dokunmaz. Aynı girdi her zaman aynı kararı verir. Bu yüzden test etmek kolaydır. |
| **Öncelik sırası** | Birden fazla kural çalışırsa en güçlü sonuç kazanır (örneğin `REJECT > REVIEW > CONFIRM`). |
| **Sürümlü** | Her politikanın bir sürümü var (`booking@1`). Kurallar değişince sürüm artar; kayıtlarda hangi sürümle karar verildiği görünür. |
| **Kayıt tutulur** | Randevu kararları `DecisionLog` tablosuna yazılır. Tam telefon numarası yazılmaz, sadece son 4 hane (`***2233`). |
| **Kiracı izolasyonu** | Müşteri geçmişi dükkan bazındadır. A dükkanında gelmeyen biri B dükkanında engellenmez. |
| **İnsan son sözü söyler** | Berberin ayarladığı randevu kuralı dışında motor sadece önerir. Askıya alma ve ödeme gibi işleri yönetici kendisi yapar. |

### Katmanlar

```
İstek (rota)  →  Karar katmanı (decisions/index.js)  →  Politika (policies/*.js)  →  Motor (engine.js)
                    │  veritabanından bağlamı toplar        kurallar listesi            kuralları çalıştırır,
                    │  kararı kaydeder                                                   sonucu ve nedenleri döner
                    ▼
               DecisionLog tablosu
```

| Dosya | Görevi |
|---|---|
| `decisions/engine.js` | Çekirdek. `decide()` tek sonuçlu karar verir, `recommend()` öneri kartları üretir, `validatePolicy()` politikayı açılışta denetler. |
| `decisions/customer.js` | Müşteri anahtarı (telefonun son 10 hanesi), müşteri profili ve risk puanı. |
| `decisions/policies/booking.js` | Online randevu kabul kararı. |
| `decisions/policies/insights.js` | Dükkan paneli "Asistan" önerileri. |
| `decisions/policies/lifecycle.js` | Platform yöneticisi için dükkan durumu kararı. |
| `decisions/assign.js` | "Fark etmez" denince randevunun hangi berbere yazılacağı. |
| `decisions/index.js` | Veritabanından bağlam toplama, politikaları çalıştırma, kayıt. Rotalar sadece bunu kullanır. |

### Karar 1: Online randevu kabulü (`booking@1`)

Müşteri online randevu alınca motor üç sonuçtan birini verir:

- **CONFIRM:** randevu doğrudan onaylanır (`decidedBy = AUTO`)
- **REVIEW:** "Bekliyor" olarak berbere düşer
- **REJECT:** randevu alınmaz, müşteriye nedeni söylenir (dükkanı araması önerilir)

| Kural | Sonuç | Ne zaman |
|---|---|---|
| `GELMEME_SINIRI` | REJECT | Bu numara bu dükkanda `noShowLimit` (varsayılan 3) kez gelmemiş |
| `AKTIF_RANDEVU_SINIRI` | REJECT | Numaranın `maxActivePerPhone` (varsayılan 2) bekleyen randevusu var |
| `ELLE_ONAY_MODU` | REVIEW | Dükkan modu `MANUAL` |
| `RISKLI_MUSTERI` | REVIEW | Risk seviyesi orta veya yüksek |
| `ILK_ZIYARET` | REVIEW | Mod `TRUSTED` ve müşteri daha önce hiç gelmemiş |
| `GUVENILIR_MUSTERI` | CONFIRM | Mod `TRUSTED` ve en az 1 kez gelmiş |
| `OTOMATIK_ONAY_MODU` | CONFIRM | Mod `ALL` |
| (hiçbiri) | REVIEW | Varsayılan: berber onaylar |

Berber modu panelde **Asistan → Otomatik karar kuralları** bölümünden seçer:

- `MANUAL`: her randevuyu ben onaylayayım (varsayılan, eskisi gibi)
- `TRUSTED`: daha önce gelenleri otomatik onayla
- `ALL`: hepsini otomatik onayla (riskliler yine sorulur)

**Risk puanı** (`customer.js`), 0 güvenilir, 100 çok riskli:
`gelmeme × 35 + iptal × 8 − tamamlanan × 6`, 0 ile 100 arasına sıkıştırılır.
Seviye: hiç sonuçlanmış randevusu yoksa `NEW`, 60 ve üstü `HIGH`, 25 ve üstü `MEDIUM`, altı `LOW`.
5+ ziyaret ve hiç gelmeme yoksa "Sadık" rozeti alır.

### Karar 2: Müşteri segmenti (CRM)

`decisions/customer.js → segmentOf()`. Müşteriler sekmesindeki filtreler ve renkler buradan gelir. Öncelik sırası:

| Segment | Ne zaman |
|---|---|
| `RISKLI` | Risk seviyesi orta veya yüksek |
| `KAYIP_RISKI` | En az 1 kez gelmiş, son ziyareti 45 günden eski (`WINBACK_DAYS`), bekleyen randevusu yok |
| `SADIK` | 5+ ziyaret, hiç gelmeme yok |
| `YENI` | Henüz sonuçlanmış randevusu yok |
| `DUZENLI` | Diğerleri |

"Kayıp riski" müşterilere panelden tek tıkla WhatsApp'tan "seni özledik" mesajı gönderilir. Mesajı berber kendisi gönderir, otomatik mesaj yok.

**Kampanya mesajı izni (KVKK)** — `marketingAllowed()`: "Seni özledik" gibi tanıtım mesajı sadece müşteri online randevuda
**açık rıza** kutusunu işaretlediyse gönderilebilir. Geçerli olan, rızanın sorulduğu **en son** randevudaki cevaptır.
Berberin elle eklediği randevu rıza sayılmaz. Berber panelden izni sadece **geri alabilir**, müşteri adına veremez.
"Kayıp riski" müşterisi izinsizse WhatsApp düğmesi yerine "🔒 izin yok" yazar; asistan da izinli olanların sayısını söyler.

### Karar 3: Dükkan asistanı önerileri

Panelde **🧠 Asistan** sekmesi. Her kural koşulu tutarsa bir kart üretir. Kartlar önceliğe göre sıralanır: acil, önemli, öneri, bilgi.

Örnek kartlar: online randevu kapalı, aktif hizmet yok, onay bekleyen randevular, deneme bitiyor, gelmeme oranı yüksek, otomatik onaya geçme önerisi, **geri kazanılacak müşteriler (`GERI_KAZAN`)**, yarın boş, logo veya adres eksik, kazanç arttı, en yoğun gün.

### Karar 5: Berber atama (`assign@1`)

Müşteri berber seçmeyip **Fark etmez** derse:

1. O saatte boş olan (izinli değil, aktif, randevusu çakışmayan) berberler adaydır.
2. O gün **en az dolu** (dakika toplamı) berber seçilir; böylece iş yükü dengelenir.
3. Eşitlikte sıralamada önce gelen berber seçilir.

Karar, nedeni ve aday listesiyle birlikte karar geçmişine yazılır, örneğin: "Müşteri berber seçmedi; o gün en boş berber Emre (30 dk dolu) atandı."

Asistan kuralı `CALISAN_RANDEVU_SORUNU`: pasif yapılmış ya da izinli gününe randevusu düşen berber varsa "acil" kartı çıkar ve randevuyu başka berbere aktarman önerilir.

### Karar 6: Paket sınırı (`plan@1`)

`decisions/policies/plan.js`. Yeni berber eklerken ya da pasif berberi aktif yaparken çalışır.

| Paket | Aktif berber |
|---|---|
| Başlangıç (`BASIC`) | 1 |
| Pro (`PRO`) | 5 |
| Salon (`SALON`) | sınırsız |

Deneme süresindeki dükkan **Pro** sınırlarını kullanır, böylece her şeyi deneyebilir. Sınır aşılırsa `BLOCK` döner ve berbere "paketini yükselt" mesajı gösterilir. Paketi yönetici, yönetim ekranındaki seçimden değiştirir. Fiyatlar `frontend/src/config/brand.js` dosyasında.

Asistan kuralı `YARIN_HATIRLAT`: yarın randevu varsa "Hatırlat" düğmesiyle WhatsApp hatırlatması önerilir. Randevu hatırlatması hizmet mesajıdır; kampanya iznine bağlı değildir.

### Karar 7: Sadakat (`loyalty@1`)

`decisions/policies/loyalty.js`. Dükkan "her N. ziyaret hediye" der (`Shop.loyaltyEvery`, 0 = kapalı, 3-50 arası).

- Sayılan ziyaret: tamamlanan + ileri tarihli aktif randevular. Böylece aynı hediye iki kez verilmez. Gelmedi ve iptal sayılmaz.
- `REWARD`: randevu `loyaltyReward = true` ve ücret **0 ₺** yazılır, kasaya da 0 düşer. Müşteri onay ekranında "Bu 10. ziyaretin. Bu randevu bizden hediye!" görür.
- `NONE`: müşteriye "Hediye tıraşına 3 ziyaret kaldı." gibi bir teşvik mesajı gösterilir.

Asistan kuralları:
- `KAPALI_GUNDE_RANDEVU` (acil): kapalı gün eklenmeden önce o güne alınmış randevular varsa uyarır.
- `SADAKAT_ONERISI` (bilgi): son 30 günde 20'den fazla randevusu olan ve sadakat programı kapalı dükkana programı açmayı önerir.

### Karar 4: Platform yöneticisi (`lifecycle@1`)

`/yonetim` ekranında her dükkanın yanında görünür. Motor sadece önerir, işlemi yönetici yapar.

| Sonuç | Ne zaman |
|---|---|
| `SUSPEND_SUGGESTED` | Deneme veya abonelik 7 günden uzun süre önce bitmiş |
| `REMIND_PAYMENT` | Süre bitti (7 gün içinde) ya da 3 gün içinde bitecek |
| `CHURN_RISK` | 7 günden eski dükkan, son 14 günde hiç randevu yok |
| `HEALTHY` | Sorun yok |

### API

| Adres | Ne yapar |
|---|---|
| `GET /api/shop/decisions/insights` | Asistan önerileri |
| `GET /api/shop/decisions/settings` | Karar ayarları |
| `PATCH /api/shop/decisions/settings` | `confirmMode`, `noShowLimit` (1-10), `maxActivePerPhone` (1-10). Sadece dükkan sahibi |
| `GET /api/shop/decisions/log?limit=30` | Karar geçmişi |
| `GET /api/shop/customers/profile?phone=...` | Müşteri profili ve riski |
| `GET /api/shop/customers?q=&segment=` | Müşteri listesi, segment sayıları |
| `GET /api/shop/customers/:key` | Müşteri detayı, geçmiş, not |
| `PUT /api/shop/customers/:key/note` | Berberin müşteri notu |
| `GET /api/shop/appointments` | Her randevuda artık `customer` (profil) ve `decidedBy` alanı var |
| `GET /api/admin/shops` | Her dükkanda `decision: { outcome, reasons }` |

### Yeni kural nasıl eklenir?

1. İlgili politika dosyasına (`policies/*.js`) bir kural ekle: `{ code, outcome, when(ctx), message(ctx) }`.
2. Kural davranışı değiştiriyorsa politikanın `version` değerini 1 artır.
3. Kuralın ihtiyaç duyduğu veri bağlamda yoksa `decisions/index.js` içinde bağlama ekle (sorgu mutlaka `shopId` ile).
4. `backend/test/decisions.test.js` içine test yaz, `npm test` çalıştır.
5. Bu belgedeki tabloya satırı ekle.

Yeni bir karar türü (örneğin kampanya veya fiyat önerisi) için `policies/` altına yeni bir dosya açılır ve aynı motor kullanılır.

### Gelecek (yapay zekâ ve Umay)

Motor bilerek kural tabanlı: henüz model eğitecek kadar veri yok, kuralları da berber anlayabiliyor. Veri biriktikçe:

- Risk puanı, gerçek gelmeme verisiyle yapay zekâ modeline dönüştürülebilir. Motorun girişi ve çıkışı değişmez, sadece `customer.js` içi değişir.
- Umay veya bir yapay zekâ, öneri kartlarını doğal dille açıklayabilir ve yeni kural önerebilir. Ama kuralı devreye almak her zaman insanın onayıyla olur.

---

## 2. Mimari karar kayıtları (ADR)

Biçim: **Karar**, **Neden**, **Bedeli**. Durum: ✅ geçerli, 🔁 değişti.

### ADR-001: Tek veritabanı, `shopId` ile çok kiracılı yapı ✅
- **Karar:** Tüm dükkanlar aynı veritabanında; dükkana ait her tabloda `shopId` var ve panel rotalarında `shopId` sadece giriş yapan kullanıcıdan alınır.
- **Neden:** Ücretsiz barındırmada tek veritabanı var. Yönetimi basit, binlerce dükkana kadar yeterli.
- **Bedeli:** Bir sorguda `shopId` unutulursa veri sızabilir. Bu yüzden her rotada izolasyon testi zorunlu.

### ADR-002: Geliştirmede SQLite, canlıda PostgreSQL, tek şema ✅
- **Karar:** `schema.prisma` tek kaynak; canlı şema `make-pg-schema.js` ile otomatik üretilir.
- **Neden:** Bilgisayarda kurulum gerektirmez, canlıda Neon ücretsiz.
- **Bedeli:** SQLite'a özgü bir özellik kullanılmamalı (JSON alanı yerine metin, enum yerine metin).

### ADR-003: Önce mobil web (PWA), sonra mağaza uygulaması ✅
- **Karar:** React + Vite PWA; ileride Capacitor ile Android ve iOS paketi.
- **Neden:** Tek kod tabanı, mağaza onayı beklemeden yayın, ücretsiz.
- **Bedeli:** Bildirim gibi bazı telefon özellikleri mağaza sürümüne kadar sınırlı.

### ADR-004: Ücretsiz barındırma: Render + Neon ✅
- **Karar:** `render.yaml` Blueprint ve Neon PostgreSQL.
- **Neden:** Şu an ödeme yapılamıyor; ikisi de kart istemiyor.
- **Bedeli:** Ücretsiz sunucu 15 dakika boşta kalınca uyur, ilk istek yaklaşık 1 dakika sürer. Gelir gelince ücretli plana geçilecek.

### ADR-005: Kural tabanlı, açıklanabilir karar motoru ✅
- **Karar:** İş kararları `src/decisions/` altında saf kurallarla verilir; yapay zekâ modeli şimdilik yok.
- **Neden:** Veri yok; berberin "neden?" sorusuna net cevap verilmeli; test edilebilir.
- **Bedeli:** Kurallar elle güncellenir. Veri birikince model eklenebilir (bkz. Gelecek).

### ADR-006: Kritik platform işlemlerinde insan onayı ✅
- **Karar:** Askıya alma, ödeme ve süre uzatma otomatik yapılmaz; motor sadece önerir.
- **Neden:** Yanlış otomatik askıya alma, berberin müşteri kaybetmesi demek.
- **Bedeli:** Yönetici her gün listeye bakmalı. Dükkan sayısı artınca hatırlatma bildirimi eklenecek.

### ADR-007: Müşteri kimliği = telefonun son 10 hanesi ✅
- **Karar:** Müşteri hesabı yok; aynı dükkanda aynı numara aynı müşteri sayılır (`customerKey`).
- **Neden:** Berber müşterisinden üyelik istemek randevuyu zorlaştırır.
- **Bedeli:** Başkasının numarasıyla randevu alınabilir. İleride SMS doğrulaması (ücretli) eklenebilir.

### ADR-008: Marka adı BERBERİX, teknik adlar `berberim` 🔁
- **Karar:** Görünen ad BERBERİX; klasör, Render servis adları ve tarayıcı anahtarı (`berberim_token`) eski adla kaldı.
- **Neden:** Teknik adları değiştirmek canlı adresleri ve oturumları bozar.
- **Bedeli:** Kodda iki ad görünür. Alan adı alındığında servis adları da değiştirilebilir.

### ADR-009: Kasa, randevudan otomatik beslenir ✅
- **Karar:** Randevu "Tamamlandı" yapılınca ödeme yöntemi (nakit, kart, havale) sorulur ve ücret kasaya otomatik yazılır (`CashEntry.appointmentId`). Durum geri alınınca kayıt silinir. Ürün satışı, bahşiş ve giderler elle girilir.
- **Neden:** Berber aynı şeyi iki kez yazmamalı; gün sonu kasası kendiliğinden çıkmalı.
- **Bedeli:** Randevudan gelen kayıt kasadan silinemez, ancak randevunun durumu değiştirilerek düzeltilir. Fiyat randevu anındaki hizmet fiyatıdır; indirim gerekirse ileride "tutar düzelt" eklenecek.

### ADR-010: Çalışan bazlı takvim, geriye uyumlu ✅
- **Karar:** `Barber` tablosu eklendi; her randevu bir berbere yazılır (`barberId`, `barberName` anlık görüntüsü). Hiç çalışan tanımlı olmayan dükkan eskisi gibi tek koltuk çalışır.
- **Kural:** Berbere atanmamış eski randevular **bütün berberleri** meşgul sayar. Fazla güvenli taraf seçildi: çift randevu olmasın.
- **Kural:** Çalışan silinmez, pasif yapılır; geçmiş randevular ve kasa kırılımı bozulmaz.
- **Bedeli:** Eski atanmamış randevular o saati herkese kapatır. Gerekirse panelden "Başka berbere aktar" ile bir berbere atanabilir.
- **Sonra:** Çalışanların kendi girişi (STAFF rolü), berber bazlı çalışma saati ve prim oranı.

### ADR-011: KVKK onayları formda ve veritabanında ✅
- **Karar:** Online randevuda Aydınlatma Metni onayı zorunlu (`kvkkAcceptedAt`); kampanya mesajı açık rızası isteğe bağlı ve ayrı kutu (`marketingConsent`). Dükkan kaydında Kullanım Koşulları onayı zorunlu (`termsAcceptedAt`). Metinler `/kvkk` ve `/kosullar`.
- **Neden:** Türkiye'de müşteri telefonu toplayan bir ürünü satmanın ön şartı. Pazarlama mesajı (ticari ileti) açık rıza ister.
- **Bedeli:** Metinler genel taslaktır; satıştan önce hukukçuya okutulmalı. İYS (İleti Yönetim Sistemi) kaydı, toplu/otomatik mesaj eklenince gerekecek.

### ADR-012: Satış demosu, gerçek veritabanında ayrı dükkan ✅
- **Karar:** `isDemo` işaretli "Demo Berber" (`/demo-berber`), yönetim panelinden tek tuşla kurulur ya da sıfırlanır (`lib/demo.js`, sabit tohumlu örnek veri). Ziyaretçi ana sayfadaki "Paneli dene" ile şifresiz girer (`POST /api/auth/demo`). Marka ve adres değiştirilemez, gerisi denenebilir.
- **Neden:** Berbere satarken en güçlü argüman, dolu bir paneli kendi elinde görmesi.
- **Bedeli:** Ziyaretçiler demo verisini karıştırabilir; yönetimden sıfırlanır. Demo dükkanın verisi diğer dükkanlardan kiracı izolasyonuyla ayrıdır.

### ADR-013: Çalışan girişi = berbere bağlı STAFF kullanıcısı ✅
- **Karar:** Sahip, Ayarlar → Çalışanlar'dan bir berbere e-posta ve şifre verir (`User.role = STAFF`, `User.barberId`). Çalışan yalnızca **kendi** randevularını görür, ekler, tamamlar. Kasa, müşteri listesi, asistan ve ayarlar kapalıdır (`requireOwner`). Randevuyu başka berbere sadece sahip aktarabilir.
- **Neden:** Usta-kalfa düzeninde her berber kendi telefonundan takvimini görmeli; dükkanın cirosu ve müşteri listesi sahipte kalmalı.
- **Bedeli:** E-posta doğrulaması yok (ücretsiz e-posta altyapısı yok). Şifreyi sahip verir, çalışan "Hesabım"dan değiştirir. Giriş kaldırılınca eski oturum da hemen geçersiz olur.

### ADR-014: Müşteri self-servis iptali, tahmin edilemez link ile ✅
- **Karar:** Her online randevuya 144 bitlik rastgele bir `manageToken` verilir. Müşteri `/r/<token>` sayfasından randevusunu görür ve başlama saatinden önce iptal eder (`cancelledBy = CUSTOMER`). Sayfada telefon numarası ve soyadı gösterilmez.
- **Neden:** Müşteri hesabı yok (ADR-007). Gelemeyecek müşterinin arama zahmeti olmadan iptal edebilmesi gelmemeyi azaltır ve saati başka müşteriye açar.
- **Bedeli:** Linki kaybeden müşteri dükkanı arar. Link başkasının eline geçerse randevu iptal edilebilir; değiştirme yetkisi yoktur.

### ADR-015: Öğle arası ve kapalı günler müsaitlik hesabında ✅
- **Karar:** `WorkingHour.breakStart/breakEnd` o günün saatlerini dolu sayar. `ClosedDay` (bayram, tatil) o günü tamamen kapatır. Hesap `lib/availability.computeSlots` içindedir; tüm berberler için geçerlidir.
- **Bedeli:** Kapalı gün eklenince o güne önceden alınmış randevular otomatik iptal edilmez. Berbere hem ekranda hem asistanda bildirilir, müşteriyi berber arar.
