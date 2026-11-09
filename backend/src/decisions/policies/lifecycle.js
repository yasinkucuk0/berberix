// PLATFORM KARARI (yalnizca yonetici gorur): her dukkan icin ne yapilmali?
// Motor sadece onerir; askıya alma / uzatma gibi islemleri yonetici kendisi yapar.
//   ASKIYA_AL_ONERISI > ODEME_HATIRLAT > KAYIP_RISKI > SAGLIKLI
// ctx: { shop, now, daysToEnd, daysSinceEnd, ageDays, recentAppointments }
const { validatePolicy } = require("../engine");

module.exports = validatePolicy({
  name: "lifecycle",
  version: 1,
  outcomes: ["SUSPEND_SUGGESTED", "REMIND_PAYMENT", "CHURN_RISK", "HEALTHY"],
  fallback: { outcome: "HEALTHY", message: "Her şey yolunda." },
  rules: [
    {
      code: "SURE_BITELI_UZUN",
      outcome: "SUSPEND_SUGGESTED",
      when: (c) => c.shop.status !== "SUSPENDED" && c.daysSinceEnd !== null && c.daysSinceEnd > 7,
      message: (c) => `${c.shop.status === "TRIAL" ? "Deneme" : "Abonelik"} süresi ${c.daysSinceEnd} gün önce bitti; ödeme yoksa askıya al.`,
    },
    {
      code: "SURE_BITTI",
      outcome: "REMIND_PAYMENT",
      when: (c) => c.shop.status !== "SUSPENDED" && c.daysSinceEnd !== null && c.daysSinceEnd <= 7,
      message: "Süresi bitti, randevu alamıyor. Ödeme için ara.",
    },
    {
      code: "SURE_BITIYOR",
      outcome: "REMIND_PAYMENT",
      when: (c) => c.shop.status !== "SUSPENDED" && c.daysToEnd !== null && c.daysToEnd <= 3,
      message: (c) => `${c.daysToEnd} gün içinde süresi bitiyor; hatırlat.`,
    },
    {
      code: "KULLANILMIYOR",
      outcome: "CHURN_RISK",
      when: (c) => c.shop.status !== "SUSPENDED" && c.ageDays >= 7 && c.recentAppointments === 0,
      message: "Son 14 günde hiç randevu yok; kurulumda yardım iste ya da ara.",
    },
  ],
});
