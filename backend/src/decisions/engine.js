// BERBERIX KARAR MOTORU - cekirdek.
// Ayrintili anlatim: docs/KARAR-MIMARISI.md
//
// Ilkeler:
// 1. Saf fonksiyon: veritabanina dokunmaz. Girdi (ctx) -> karar. Ayni girdi her zaman ayni karari verir.
// 2. Aciklanabilir: her karar, hangi kurallarin calistigini ve nedenini (Turkce mesaj) dondurur.
// 3. Oncelik sirasi: birden fazla kural calisirsa en guclu sonuc kazanir (orn. REJECT > REVIEW > CONFIRM).
// 4. Surumlu: politika degisince version artar; kayitlarda hangi surumle karar verildigi gorulur.
//
// Politika bicimi:
// {
//   name: "booking", version: 1,
//   outcomes: ["REJECT", "REVIEW", "CONFIRM"],   // guclu olandan zayifa
//   fallback: { outcome: "REVIEW", message: "..." },
//   rules: [{ code, outcome, when(ctx) -> bool, message(ctx) -> string }]
// }

function validatePolicy(policy) {
  if (!policy || !policy.name || !Array.isArray(policy.outcomes) || !Array.isArray(policy.rules)) {
    throw new Error("Karar politikasi eksik tanimli");
  }
  if (!policy.outcomes.includes(policy.fallback?.outcome)) {
    throw new Error(`${policy.name}: varsayilan sonuc outcomes icinde degil`);
  }
  const codes = new Set();
  for (const rule of policy.rules) {
    if (!rule.code || typeof rule.when !== "function") throw new Error(`${policy.name}: kural eksik`);
    if (codes.has(rule.code)) throw new Error(`${policy.name}: ${rule.code} iki kez tanimli`);
    if (!policy.outcomes.includes(rule.outcome)) throw new Error(`${policy.name}: ${rule.code} sonucu gecersiz`);
    codes.add(rule.code);
  }
  return policy;
}

function messageOf(rule, ctx) {
  return typeof rule.message === "function" ? rule.message(ctx) : String(rule.message || rule.code);
}

function decide(policy, ctx) {
  const fired = [];
  for (const rule of policy.rules) {
    let hit = false;
    try {
      hit = Boolean(rule.when(ctx));
    } catch {
      hit = false; // bozuk bir kural tum karari dusurmesin
    }
    if (hit) fired.push({ code: rule.code, outcome: rule.outcome, message: messageOf(rule, ctx) });
  }

  const outcome = policy.outcomes.find((o) => fired.some((f) => f.outcome === o)) || policy.fallback.outcome;
  const reasons = fired.length
    ? fired
    : [{ code: "VARSAYILAN", outcome: policy.fallback.outcome, message: policy.fallback.message }];

  return {
    policy: `${policy.name}@${policy.version || 1}`,
    outcome,
    // kazanan sonucu belirleyen nedenler once
    reasons: [...reasons.filter((r) => r.outcome === outcome), ...reasons.filter((r) => r.outcome !== outcome)],
  };
}

// Oneri politikasi: tek bir sonuc yerine, kosulu tutan her kural bir oneri karti uretir.
// Karar insanda kalir; motor yalnizca ne yapilabilecegini ve nedenini soyler.
// kural: { code, level: "high"|"medium"|"low"|"info", when(ctx), title(ctx), detail(ctx), action? }
const LEVEL_ORDER = { high: 0, medium: 1, low: 2, info: 3 };

function recommend(rules, ctx) {
  const cards = [];
  for (const rule of rules) {
    let hit = false;
    try {
      hit = Boolean(rule.when(ctx));
    } catch {
      hit = false;
    }
    if (!hit) continue;
    cards.push({
      code: rule.code,
      level: rule.level || "info",
      title: messageOf({ message: rule.title, code: rule.code }, ctx),
      detail: rule.detail ? messageOf({ message: rule.detail, code: rule.code }, ctx) : "",
      action: rule.action || null,
    });
  }
  return cards.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

module.exports = { decide, recommend, validatePolicy };
