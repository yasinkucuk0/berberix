// DUKKAN ASISTANI ONERILERI: panelde "bugun ne yapmaliyim?" kartlari.
// Motor oneri verir, karari berber verir. action: panelde acilacak sekme.
// ctx: insightsContext() ciktisi (src/decisions/index.js)
const pct = (n) => `%${Math.round(n * 100)}`;

module.exports = [
  {
    code: "RANDEVU_KAPALI",
    level: "high",
    when: (c) => !c.access.open,
    title: "Online randevu kapalı",
    detail: (c) => `${c.access.reason} Müşterilerin şu an randevu alamıyor.`,
  },
  {
    code: "AKTIF_HIZMET_YOK",
    level: "high",
    when: (c) => c.activeServices === 0,
    title: "Hiç aktif hizmet yok",
    detail: "Müşteri sayfanda seçilecek hizmet görünmüyor. En az bir hizmeti aç.",
    action: "hizmet",
  },
  {
    code: "ONAY_BEKLEYEN",
    level: "high",
    when: (c) => c.pendingUpcoming > 0,
    title: (c) => `${c.pendingUpcoming} randevu onayını bekliyor`,
    detail: "Onaylanmayan randevular müşteriyi belirsizlikte bırakır. Onayla ya da iptal et.",
    action: "randevu",
  },
  {
    code: "CALISAN_RANDEVU_SORUNU",
    level: "high",
    when: (c) => c.staffIssues.length > 0,
    title: (c) => `${c.staffIssues.reduce((n, i) => n + i.count, 0)} randevunun berberi müsait değil`,
    detail: (c) => c.staffIssues
      .map((i) => `${i.name}: ${i.count} randevu (${i.kind === "PASIF" ? "çalışan pasif" : "izinli gününe denk geliyor"})`)
      .join(" • ") + ". Randevuyu başka berbere aktar ya da müşteriyi ara.",
    action: "randevu",
  },
  {
    code: "KAPALI_GUNDE_RANDEVU",
    level: "high",
    when: (c) => c.onClosedDays > 0,
    title: (c) => `Kapalı olduğun günlere ${c.onClosedDays} randevu düşüyor`,
    detail: "Bu randevular kapalı gün eklenmeden önce alınmış. Müşterileri arayıp başka güne al ya da iptal et.",
    action: "randevu",
  },
  {
    code: "DENEME_BITIYOR",
    level: "medium",
    when: (c) => c.shop.status === "TRIAL" && c.trialDaysLeft !== null && c.trialDaysLeft <= 3 && c.access.open,
    title: (c) => `Ücretsiz deneme ${c.trialDaysLeft} gün içinde bitiyor`,
    detail: "Randevuların kesilmemesi için aboneliği başlatmak üzere bizimle iletişime geç.",
  },
  {
    code: "YUKSEK_GELMEME",
    level: "medium",
    when: (c) => c.last30.total >= 10 && c.last30.noShowRate >= 0.15,
    title: (c) => `Son 30 günde randevuların ${pct(c.last30.noShowRate)}'ine gelinmedi`,
    detail: (c) => `Gelmeme sınırını düşür (şu an ${c.shop.noShowLimit}). Böylece sürekli gelmeyen numaralar online randevu alamaz.`,
    action: "asistan",
  },
  {
    code: "OTOMATIK_ONAY_ONERISI",
    level: "low",
    when: (c) => c.shop.confirmMode === "MANUAL" && c.last30.manualConfirmed >= 15 && c.last30.noShowRate < 0.1,
    title: "Onaylamaya harcadığın zamanı azalt",
    detail: (c) => `Son 30 günde ${c.last30.manualConfirmed} randevuyu elle onayladın. "Güvenilir müşterileri otomatik onayla" modunu açabilirsin.`,
    action: "asistan",
  },
  {
    code: "GERI_KAZAN",
    level: "medium",
    when: (c) => c.winbackCount > 0,
    title: (c) => `${c.winbackCount} müşterin 45 günden uzun süredir gelmedi`,
    detail: (c) => (c.winbackReachable > 0
      ? `${c.winbackReachable} tanesi kampanya mesajına izin verdi. Müşteriler sekmesinde "Kayıp riski" filtresinden tek tıkla "seni özledik" mesajı at.`
      : "Hiçbiri kampanya mesajına izin vermemiş (KVKK). Onları dükkanda görünce bir dahaki randevuyu hatırlat."),
    action: "musteri",
  },
  {
    code: "YARIN_HATIRLAT",
    level: "low",
    when: (c) => c.tomorrowCount > 0,
    title: (c) => `Yarın ${c.tomorrowCount} randevun var`,
    detail: "Randevular sekmesinde yarını aç, her randevudaki \"Hatırlat\" ile müşteriye tek tıkla WhatsApp hatırlatması gönder. Gelmeme azalır.",
    action: "randevu",
  },
  {
    code: "YARIN_BOS",
    level: "low",
    when: (c) => c.tomorrow.isOpen && c.tomorrow.occupancy < 0.3 && c.access.open,
    title: (c) => `Yarın doluluk ${pct(c.tomorrow.occupancy)}`,
    detail: "Dükkan linkini WhatsApp durumuna ya da Instagram hikâyene koy; boş saatler dolsun.",
    action: "paylas",
  },
  {
    code: "SADAKAT_ONERISI",
    level: "info",
    when: (c) => !c.loyaltyEvery && c.last30.total >= 20,
    title: "Sadakat programı aç",
    detail: "“Her 10. tıraş bizden” gibi bir program müşteriyi geri getirir. Asistan › Otomatik kurallar'dan tek dokunuşla açabilirsin.",
    action: "asistan",
  },
  {
    code: "LOGO_YOK",
    level: "low",
    when: (c) => !c.shop.logo,
    title: "Logon yok",
    detail: "Logolu dükkan sayfası müşteriye daha güven verir.",
    action: "marka",
  },
  {
    code: "ADRES_YOK",
    level: "low",
    when: (c) => !c.shop.address,
    title: "Adresin eksik",
    detail: "Adres eklersen müşteri sayfasında \"Yol tarifi\" düğmesi çıkar.",
    action: "marka",
  },
  {
    code: "KAZANC_ARTTI",
    level: "info",
    when: (c) => c.prevWeekRevenue > 0 && c.weekRevenue > c.prevWeekRevenue,
    title: (c) => `Bu hafta kazanç ${pct(c.weekRevenue / c.prevWeekRevenue - 1)} arttı`,
    detail: "Geçen 7 güne göre tamamlanan randevulardan gelen kazanç.",
  },
  {
    code: "EN_YOGUN_GUN",
    level: "info",
    when: (c) => Boolean(c.busiestDay),
    title: (c) => `En yoğun günün: ${c.busiestDay}`,
    detail: "Son 30 güne göre. O gün için ekstra çalışan ya da uzun mesai planlayabilirsin.",
  },
];
