// SADAKAT KARARI (loyalty@1): bu randevu hediye mi?
// Dukkan "her N. ziyaret hediye" der (Shop.loyaltyEvery, 0 = kapali).
// Sayilan: tamamlanan + ileri tarihli aktif randevular (ayni hediye iki kez verilmesin).
// Gelmedi/iptal sayilmaz. Hediye randevunun ucreti 0 TL yazilir.
// ctx: { shop: { loyaltyEvery }, profile (customer.buildProfile) }
const { validatePolicy } = require("../engine");

function visitNumber({ profile }) {
  return profile.completed + profile.upcoming + 1;
}

const policy = validatePolicy({
  name: "loyalty",
  version: 1,
  outcomes: ["REWARD", "NONE"],
  fallback: { outcome: "NONE", message: "Sadakat programı kapalı." },
  rules: [
    {
      code: "HEDIYE_ZIYARET",
      outcome: "REWARD",
      when: (c) => c.shop.loyaltyEvery > 0 && visitNumber(c) % c.shop.loyaltyEvery === 0,
      message: (c) => `Bu ${visitNumber(c)}. ziyaretin. Bu randevu bizden hediye!`,
    },
    {
      code: "HEDIYEYE_KALAN",
      outcome: "NONE",
      when: (c) => c.shop.loyaltyEvery > 0 && visitNumber(c) % c.shop.loyaltyEvery !== 0,
      message: (c) => {
        const left = c.shop.loyaltyEvery - (visitNumber(c) % c.shop.loyaltyEvery);
        return `Hediye tıraşına ${left} ziyaret kaldı.`;
      },
    },
  ],
});

module.exports = { policy, visitNumber };
