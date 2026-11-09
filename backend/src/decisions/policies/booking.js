// RANDEVU KABUL KARARI: musteri online randevu alinca ne olsun?
//   CONFIRM -> randevu dogrudan onaylanir
//   REVIEW  -> "onay bekliyor" olarak berbere dusar
//   REJECT  -> randevu alinmaz, musteriye nedeni soylenir
// ctx: { shop: { confirmMode, noShowLimit, maxActivePerPhone }, profile (customer.buildProfile) }
const { validatePolicy } = require("../engine");

const CONFIRM_MODES = ["MANUAL", "TRUSTED", "ALL"];

module.exports = validatePolicy({
  name: "booking",
  version: 1,
  outcomes: ["REJECT", "REVIEW", "CONFIRM"],
  fallback: { outcome: "REVIEW", message: "Berber onayı bekleniyor." },
  rules: [
    {
      code: "GELMEME_SINIRI",
      outcome: "REJECT",
      when: ({ shop, profile }) => profile.noShow >= shop.noShowLimit,
      message: ({ profile }) => `Bu numarayla alınan ${profile.noShow} randevuya gelinmemiş. Online randevu kapalı, lütfen dükkanı arayın.`,
    },
    {
      code: "AKTIF_RANDEVU_SINIRI",
      outcome: "REJECT",
      when: ({ shop, profile }) => profile.upcoming >= shop.maxActivePerPhone,
      message: ({ profile }) => `Bu numaranın zaten ${profile.upcoming} bekleyen randevusu var. Yeni randevu için önce mevcut randevunu tamamla ya da dükkanı ara.`,
    },
    {
      code: "ELLE_ONAY_MODU",
      outcome: "REVIEW",
      when: ({ shop }) => shop.confirmMode === "MANUAL",
      message: "Dükkan her randevuyu kendisi onaylıyor.",
    },
    {
      code: "RISKLI_MUSTERI",
      outcome: "REVIEW",
      when: ({ profile }) => profile.level === "HIGH" || profile.level === "MEDIUM",
      message: ({ profile }) => `Müşteri geçmişinde ${profile.noShow} gelmeme, ${profile.cancelled} iptal var; berber onaylamalı.`,
    },
    {
      code: "ILK_ZIYARET",
      outcome: "REVIEW",
      when: ({ shop, profile }) => shop.confirmMode === "TRUSTED" && profile.completed === 0,
      message: "İlk kez gelen müşteri; berber onaylamalı.",
    },
    {
      code: "GUVENILIR_MUSTERI",
      outcome: "CONFIRM",
      when: ({ shop, profile }) => shop.confirmMode === "TRUSTED" && profile.completed >= 1,
      message: ({ profile }) => `Daha önce ${profile.completed} kez gelmiş güvenilir müşteri; otomatik onaylandı.`,
    },
    {
      code: "OTOMATIK_ONAY_MODU",
      outcome: "CONFIRM",
      when: ({ shop }) => shop.confirmMode === "ALL",
      message: "Dükkan tüm randevuları otomatik onaylıyor.",
    },
  ],
});

module.exports.CONFIRM_MODES = CONFIRM_MODES;
