// PAKET SINIRI KARARI (plan@1): dukkan yeni bir aktif berber ekleyebilir mi?
// Fiyatlar ve paket adlari: frontend/src/config/brand.js (PLANS). Sinirlar burada.
// Deneme suresindeki dukkan Pro sinirlarini kullanir (her seyi denesin).
// ctx: { shop: { status, plan }, activeBarbers }
const { validatePolicy } = require("../engine");

const PLAN_LIMITS = {
  BASIC: { label: "Başlangıç", barbers: 1 },
  PRO: { label: "Pro", barbers: 5 },
  SALON: { label: "Salon", barbers: Infinity },
};
const PLANS = Object.keys(PLAN_LIMITS);

function effectivePlan(shop) {
  if (shop.status === "TRIAL") return "PRO";
  return PLAN_LIMITS[shop.plan] ? shop.plan : "BASIC";
}

function limitsOf(shop) {
  return { plan: effectivePlan(shop), ...PLAN_LIMITS[effectivePlan(shop)] };
}

const policy = validatePolicy({
  name: "plan",
  version: 1,
  outcomes: ["BLOCK", "ALLOW"],
  fallback: { outcome: "ALLOW", message: "Paket sınırı içinde." },
  rules: [
    {
      code: "BERBER_SINIRI",
      outcome: "BLOCK",
      when: ({ shop, activeBarbers }) => activeBarbers >= limitsOf(shop).barbers,
      message: ({ shop }) => {
        const l = limitsOf(shop);
        return `${l.label} paketinde en fazla ${l.barbers} aktif berber olabilir. Daha fazlası için paketini yükselt (bize WhatsApp'tan yaz).`;
      },
    },
  ],
});

module.exports = { policy, PLAN_LIMITS, PLANS, effectivePlan, limitsOf };
