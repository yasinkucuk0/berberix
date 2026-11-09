// Musteri profili ve risk puani (dukkan bazinda; bir dukkan baska dukkanin musteri gecmisini goremez).
const { localNow, addDays } = require("../lib/util");

// Bu kadar gundur gelmeyen (ve randevusu olmayan) eski musteri "geri kazanilmali" sayilir.
const WINBACK_DAYS = 45;

// Telefonun son 10 hanesi: "0555 111 22 33", "+90 555..." ve "5551112233" ayni musteri sayilir.
function customerKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

// Kayitlarda tam numara tutulmaz.
function maskPhone(phone) {
  const key = customerKey(phone);
  return key ? `***${key.slice(-4)}` : "";
}

// history: bu dukkanda bu musteriye ait randevular
function buildProfile(history, now = new Date()) {
  const today = localNow(now);
  const count = (status) => history.filter((a) => a.status === status).length;
  const completed = count("COMPLETED");
  const noShow = count("NO_SHOW");
  const cancelled = count("CANCELLED");
  const upcoming = history.filter((a) => ["PENDING", "CONFIRMED"].includes(a.status)
    && (a.date > today.date || (a.date === today.date && a.endMinutes > today.minutes))).length;
  const lastVisit = history.filter((a) => a.status === "COMPLETED").map((a) => a.date).sort().pop() || null;

  // Basit, aciklanabilir puan (0 = guvenilir, 100 = cok riskli)
  const raw = noShow * 35 + cancelled * 8 - completed * 6;
  const score = Math.max(0, Math.min(100, raw));
  let level = "LOW";
  if (completed + noShow + cancelled === 0) level = "NEW"; // henuz sonuclanmis randevusu yok
  else if (score >= 60) level = "HIGH";
  else if (score >= 25) level = "MEDIUM";

  return {
    total: history.length,
    completed,
    noShow,
    cancelled,
    upcoming,
    lastVisit,
    score,
    level, // NEW | LOW | MEDIUM | HIGH
    loyal: completed >= 5 && noShow === 0,
  };
}

// CRM SEGMENTI (bir karar): musteri listesinde filtre ve renk icin.
//   RISKLI > KAYIP_RISKI > SADIK > YENI > DUZENLI
function segmentOf(profile, now = new Date()) {
  if (profile.level === "HIGH" || profile.level === "MEDIUM") return "RISKLI";
  const today = localNow(now).date;
  if (profile.completed >= 1 && profile.upcoming === 0 && profile.lastVisit
    && profile.lastVisit <= addDays(today, -WINBACK_DAYS)) return "KAYIP_RISKI";
  if (profile.loyal) return "SADIK";
  if (profile.level === "NEW") return "YENI";
  return "DUZENLI";
}

const SEGMENTS = ["RISKLI", "KAYIP_RISKI", "SADIK", "YENI", "DUZENLI"];

// KVKK / ticari ileti: kampanya mesaji yalnizca musteri online randevuda acik riza verdiyse ve
// sonra geri almadiysa gonderilebilir. Gecerli olan, riza sorulan EN SON randevudaki cevaptir.
function marketingAllowed(history) {
  const asked = history.filter((a) => a.kvkkAcceptedAt);
  if (asked.length === 0) return false;
  const latest = [...asked].sort((x, y) => new Date(x.kvkkAcceptedAt) - new Date(y.kvkkAcceptedAt)).pop();
  return latest.marketingConsent === true;
}

// Musterileri randevulardan turetir: anahtar -> { key, name, phone, profile, segment, spent, lastActivity }
function groupCustomers(appointments, now = new Date()) {
  const byKey = new Map();
  for (const a of appointments) {
    if (!a.customerKey) continue;
    if (!byKey.has(a.customerKey)) byKey.set(a.customerKey, []);
    byKey.get(a.customerKey).push(a);
  }
  const list = [];
  for (const [key, history] of byKey) {
    const latest = [...history].sort((x, y) => (x.date + x.startMinutes).localeCompare(y.date + y.startMinutes)).pop();
    const profile = buildProfile(history, now);
    list.push({
      key,
      name: latest.customerName,
      phone: latest.customerPhone,
      profile,
      segment: segmentOf(profile, now),
      marketingConsent: marketingAllowed(history),
      spent: history.filter((a) => a.status === "COMPLETED").reduce((sum, a) => sum + a.price, 0),
      lastActivity: latest.date,
    });
  }
  return list.sort((x, y) => y.lastActivity.localeCompare(x.lastActivity));
}

const LEVEL_LABEL = { NEW: "Yeni müşteri", LOW: "Güvenilir", MEDIUM: "Dikkat", HIGH: "Riskli" };

module.exports = {
  customerKey, maskPhone, buildProfile, segmentOf, groupCustomers, marketingAllowed, SEGMENTS, WINBACK_DAYS, LEVEL_LABEL,
};
