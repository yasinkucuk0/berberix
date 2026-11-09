// KARAR KATMANI: veritabanindan baglami toplar, politikalari calistirir, kararlari kaydeder.
// Rotalar karar mantigi icermez; yalnizca bu dosyadaki fonksiyonlari cagirir.
// KURAL: her sorgu shopId ile sinirlidir (kiraci izolasyonu).
const { db } = require("../lib/db");
const { localNow, addDays, dayOfWeek, toMinutes } = require("../lib/util");
const { DAY_NAMES } = require("../lib/shop");
const { worksOn } = require("../lib/availability");
const { decide, recommend } = require("./engine");
const { customerKey, maskPhone, buildProfile, groupCustomers } = require("./customer");
const bookingPolicy = require("./policies/booking");
const insightRules = require("./policies/insights");
const lifecyclePolicy = require("./policies/lifecycle");
const planPolicy = require("./policies/plan");
const loyaltyPolicy = require("./policies/loyalty");

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE = ["PENDING", "CONFIRMED"];

// ---------- Musteri ----------
async function customerHistory(client, shopId, key) {
  if (!key) return [];
  return client.appointment.findMany({ where: { shopId, customerKey: key } });
}

async function customerProfile(shopId, phone, client = db()) {
  const key = customerKey(phone);
  return { key, profile: buildProfile(await customerHistory(client, shopId, key)) };
}

// Randevu listesi icin: telefon anahtari -> profil
async function profilesFor(shopId, keys) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return {};
  const rows = await db().appointment.findMany({ where: { shopId, customerKey: { in: unique } } });
  const result = {};
  for (const key of unique) result[key] = buildProfile(rows.filter((r) => r.customerKey === key));
  return result;
}

// ---------- Randevu karari ----------
async function decideBooking(client, shop, phone) {
  const { key, profile } = await customerProfile(shop.id, phone, client);
  const decision = decide(bookingPolicy, { shop, profile });
  const loyalty = decide(loyaltyPolicy.policy, { shop, profile });
  return { key, profile, decision, loyalty };
}

async function logDecision(shopId, type, decision, subject = "") {
  try {
    await db().decisionLog.create({
      data: {
        shopId, type, policy: decision.policy, outcome: decision.outcome,
        subject: String(subject).slice(0, 60), reasons: JSON.stringify(decision.reasons),
      },
    });
  } catch (error) {
    // kayit tutulamamasi randevuyu bozmasin
    console.error("Karar kaydi yazilamadi:", error.message);
  }
}

async function decisionLog(shopId, limit = 50) {
  const rows = await db().decisionLog.findMany({
    where: { shopId }, orderBy: { createdAt: "desc" }, take: limit,
  });
  return rows.map((r) => {
    let reasons = [];
    try {
      reasons = JSON.parse(r.reasons);
    } catch {
      reasons = [];
    }
    return { id: r.id, type: r.type, policy: r.policy, outcome: r.outcome, subject: r.subject, reasons, createdAt: r.createdAt };
  });
}

// ---------- Dukkan asistani ----------
function occupancy(hours, appointments, date) {
  const day = hours.find((h) => h.dayOfWeek === dayOfWeek(date));
  if (!day || !day.isOpen) return { isOpen: false, occupancy: 0 };
  const open = toMinutes(day.openTime);
  const close = toMinutes(day.closeTime);
  const span = close - open;
  if (!(span > 0)) return { isOpen: false, occupancy: 0 };
  const booked = appointments
    .filter((a) => a.date === date && ACTIVE.includes(a.status))
    .reduce((sum, a) => sum + Math.max(0, Math.min(a.endMinutes, close) - Math.max(a.startMinutes, open)), 0);
  return { isOpen: true, occupancy: Math.min(1, booked / span) };
}

function revenue(list, from, to) {
  return list.filter((a) => a.status === "COMPLETED" && a.date >= from && a.date <= to).reduce((s, a) => s + a.price, 0);
}

async function insightsContext(shop, access, now = new Date()) {
  const today = localNow(now).date;
  const from = addDays(today, -30);
  const [services, hours, recent, upcoming, yearly, barbers] = await Promise.all([
    db().service.findMany({ where: { shopId: shop.id } }),
    db().workingHour.findMany({ where: { shopId: shop.id } }),
    db().appointment.findMany({ where: { shopId: shop.id, date: { gte: from, lte: today } } }),
    db().appointment.findMany({ where: { shopId: shop.id, date: { gte: today, lte: addDays(today, 60) } } }),
    db().appointment.findMany({ where: { shopId: shop.id, date: { gte: addDays(today, -365), lte: addDays(today, 60) } } }),
    db().barber.findMany({ where: { shopId: shop.id } }),
  ]);
  const closedDays = await db().closedDay.findMany({ where: { shopId: shop.id, date: { gte: today } } });
  const closedSet = new Set(closedDays.map((c) => c.date));
  const onClosedDays = upcoming.filter((a) => ACTIVE.includes(a.status) && closedSet.has(a.date)).length;
  // Calisan sorunlari: pasif ya da izinli oldugu gune randevusu olan berberler
  const live = upcoming.filter((a) => ACTIVE.includes(a.status) && a.barberId != null);
  const staffIssues = [];
  for (const b of barbers) {
    const mine = live.filter((a) => a.barberId === b.id);
    if (!b.isActive && mine.length) staffIssues.push({ kind: "PASIF", name: b.name, count: mine.length });
    else if (b.isActive) {
      const off = mine.filter((a) => !worksOn(b, a.date));
      if (off.length) staffIssues.push({ kind: "IZINLI", name: b.name, count: off.length });
    }
  }
  const customers = groupCustomers(yearly, now);

  const past = recent.filter((a) => a.date < today || ["COMPLETED", "NO_SHOW"].includes(a.status));
  const closed = past.filter((a) => ["COMPLETED", "NO_SHOW"].includes(a.status));
  const noShow = closed.filter((a) => a.status === "NO_SHOW").length;

  const perDay = Array(7).fill(0);
  for (const a of recent) if (a.status === "COMPLETED") perDay[dayOfWeek(a.date)] += 1;
  const best = Math.max(...perDay);

  return {
    shop,
    access,
    trialDaysLeft: shop.status === "TRIAL" ? Math.max(0, Math.ceil((new Date(shop.trialEndsAt) - now) / DAY_MS)) : null,
    activeServices: services.filter((s) => s.isActive).length,
    pendingUpcoming: upcoming.filter((a) => a.status === "PENDING").length,
    tomorrow: occupancy(hours, upcoming, addDays(today, 1)),
    tomorrowCount: upcoming.filter((a) => a.date === addDays(today, 1) && ACTIVE.includes(a.status)).length,
    last30: {
      total: closed.length,
      noShowRate: closed.length ? noShow / closed.length : 0,
      manualConfirmed: recent.filter((a) => a.decidedBy === "" && ["CONFIRMED", "COMPLETED"].includes(a.status)).length,
    },
    staffIssues,
    onClosedDays,
    loyaltyEvery: shop.loyaltyEvery || 0,
    winbackCount: customers.filter((c) => c.segment === "KAYIP_RISKI").length,
    winbackReachable: customers.filter((c) => c.segment === "KAYIP_RISKI" && c.marketingConsent).length,
    busiestDay: best >= 3 ? DAY_NAMES[perDay.indexOf(best)] : null,
    weekRevenue: revenue(recent, addDays(today, -6), today),
    prevWeekRevenue: revenue(recent, addDays(today, -13), addDays(today, -7)),
  };
}

async function shopInsights(shop, access, now = new Date()) {
  return recommend(insightRules, await insightsContext(shop, access, now));
}

// ---------- Platform (yonetici) ----------
function lifecycleFor(shop, recentAppointments, now = new Date()) {
  const end = shop.status === "TRIAL" ? shop.trialEndsAt : shop.paidUntil;
  const endTime = end ? new Date(end).getTime() : null;
  const ctx = {
    shop,
    now,
    daysToEnd: endTime && endTime > now.getTime() ? Math.ceil((endTime - now.getTime()) / DAY_MS) : null,
    daysSinceEnd: endTime && endTime <= now.getTime() ? Math.floor((now.getTime() - endTime) / DAY_MS) : null,
    ageDays: Math.floor((now.getTime() - new Date(shop.createdAt).getTime()) / DAY_MS),
    recentAppointments,
  };
  return decide(lifecyclePolicy, ctx);
}

// Karar motorundan onceki eski randevularin musteri anahtarini doldurur (sunucu acilisinda bir kez).
async function backfillCustomerKeys() {
  const rows = await db().appointment.findMany({ where: { customerKey: "" } });
  let fixed = 0;
  for (const row of rows) {
    const key = customerKey(row.customerPhone);
    if (!key) continue;
    await db().appointment.update({ where: { id: row.id }, data: { customerKey: key } });
    fixed += 1;
  }
  return fixed;
}

// Paket siniri: bir berber daha aktif olabilir mi? (yeni ekleme ya da pasiften aktife)
async function barberLimitDecision(shopId) {
  const [shop, activeBarbers] = await Promise.all([
    db().shop.findUnique({ where: { id: shopId } }),
    db().barber.count({ where: { shopId, isActive: true } }),
  ]);
  return decide(planPolicy.policy, { shop, activeBarbers });
}

module.exports = {
  barberLimitDecision,
  backfillCustomerKeys, customerKey, maskPhone, customerProfile, profilesFor, decideBooking, logDecision, decisionLog,
  shopInsights, insightsContext, lifecycleFor, occupancy,
};
