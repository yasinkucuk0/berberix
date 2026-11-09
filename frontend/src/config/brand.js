// BERBERIX satis ayarlari. Fiyatlari, iletisim numarasini ve yasal unvani BURADAN degistir.
// (Kod bilmeden duzenlenebilir: sadece tirnak icindeki yazilari ve rakamlari degistir.)
export const BRAND = {
  name: "BERBERİX",
  slogan: "Tarzın, Berberin, Dünyan.",
  // Satis icin WhatsApp numaran (bos birakilirsa sayfada WhatsApp dugmesi cikmaz). Ornek: "05xx xxx xx xx"
  contactWhatsApp: "0545 557 20 87",
  // Yasal metinlerde "veri sorumlusu" olarak gorunen ad. Sirket kurunca unvanini yaz.
  legalName: "BERBERİX (Yasin Küçük)",
  // KVKK basvurulari icin e-posta (bos ise WhatsApp gosterilir)
  legalEmail: "",
  // Yasal metinlerde ve sayfa altinda gorunen adres
  address: "Aktepe Mah. Gül Sok. No:1, Hassa / Hatay",
  trialDays: 14,
};

// Paketler (aylik, TL). "highlight: true" olan one cikar.
// NOT: Su an paket sinirlari (or. berber sayisi) sistemde zorlanmiyor; yonetim panelinden elle takip edilir.
export const PLANS = [
  {
    key: "BASIC",
    name: "Başlangıç",
    price: 299,
    note: "Tek koltuklu dükkan",
    features: ["Kendi markanla online randevu sayfası", "1 berber", "Randevu paneli + hatırlatma linkleri", "Müşteri listesi"],
  },
  {
    key: "PRO",
    name: "Pro",
    price: 499,
    note: "En çok tercih edilen",
    highlight: true,
    features: ["5 berbere kadar, her berbere ayrı takvim", "Kasa: gelir, gider, gün sonu", "Müşteri CRM + \"seni özledik\" mesajları", "Akıllı asistan ve otomatik onay"],
  },
  {
    key: "SALON",
    name: "Salon",
    price: 899,
    note: "Büyük salonlar",
    features: ["Sınırsız berber", "Pro'daki her şey", "Öncelikli destek", "Kurulumu biz yapalım"],
  },
];
