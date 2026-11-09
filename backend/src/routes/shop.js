// Dukkan sahibi paneli. TUM sorgular req.shopId ile sinirlidir (kiraci izolasyonu).
const express = require("express");
const { db } = require("../lib/db");
const {
  HttpError, idOf, slugify, cleanText, cleanPhone, isColor, toInt, toMinutes, isDate, localNow, addDays,
  RESERVED_SLUGS,
} = require("../lib/util");
const { ownerShop, formatAppointment, DAY_NAMES } = require("../lib/shop");
const { requireAuth, requireShop, requireOwner, staffBarberId } = require("../middleware/auth");
const {
  customerKey, profilesFor, decisionLog, shopInsights,
} = require("../decisions");
const { syncAppointmentCash } = require("../lib/cash");
const { busyFor, overlaps, worksOn } = require("../lib/availability");

// Dukkanda calisan varsa randevu bir berbere yazilmali. Dukkanin aktif berberini dondurur (yoksa null).
async function barberFor(req, value, required) {
  const barbers = await db().barber.findMany({ where: { shopId: req.shopId, isActive: true } });
  if (barbers.length === 0) return null;
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, "Berber seçin.");
    return undefined;
  }
  const barber = barbers.find((b) => b.id === Number(value));
  if (!barber) throw new HttpError(404, "Berber bulunamadı.");
  return barber;
}
const { CONFIRM_MODES } = require("../decisions/policies/booking");
const { shopAccess } = require("../lib/shop");

const router = express.Router();
router.use(requireAuth, requireShop);

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const MAX_LOGO_CHARS = 400_000; // ~300 KB resim

function ownerOnly(req) {
  if (req.user.role !== "OWNER") throw new HttpError(403, "Bu ayarı sadece dükkan sahibi değiştirebilir.");
}

// ---------- Marka / dukkan ayarlari ----------
router.get("/", async (req, res, next) => {
  try {
    const shop = await db().shop.findUnique({ where: { id: req.shopId } });
    res.json({ success: true, data: ownerShop(shop) });
  } catch (error) {
    next(error);
  }
});

router.patch("/", async (req, res, next) => {
  try {
    ownerOnly(req);
    const current = await db().shop.findUnique({ where: { id: req.shopId } });
    if (current.isDemo) throw new HttpError(403, "Demo dükkanda marka ve adres ayarları değiştirilemez. Kendi dükkanını oluşturup dene!");
    const b = req.body || {};
    const data = {};
    if (b.name !== undefined) {
      data.name = cleanText(b.name, 60);
      if (data.name.length < 2) throw new HttpError(400, "Dükkan adı en az 2 karakter olmalı.");
    }
    for (const field of ["address", "city"]) if (b[field] !== undefined) data[field] = cleanText(b[field], 160);
    if (b.about !== undefined) data.about = cleanText(b.about, 1000);
    for (const field of ["phone", "whatsapp"]) if (b[field] !== undefined) data[field] = cleanPhone(b[field]);
    for (const field of ["primaryColor", "accentColor"]) {
      if (b[field] !== undefined) {
        if (!isColor(b[field])) throw new HttpError(400, "Renk #RRGGBB biçiminde olmalı.");
        data[field] = b[field];
      }
    }
    if (b.logo !== undefined) {
      const logo = String(b.logo || "");
      if (logo && !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(logo) && !/^https:\/\//.test(logo)) {
        throw new HttpError(400, "Logo bir resim dosyası olmalı.");
      }
      if (logo.length > MAX_LOGO_CHARS) throw new HttpError(400, "Logo çok büyük (en fazla ~300 KB).");
      data.logo = logo;
    }
    if (b.slotMinutes !== undefined) {
      const n = toInt(b.slotMinutes);
      if (![10, 15, 20, 30, 45, 60].includes(n)) throw new HttpError(400, "Randevu aralığı 10/15/20/30/45/60 dk olabilir.");
      data.slotMinutes = n;
    }
    if (b.slug !== undefined) {
      const slug = slugify(b.slug);
      if (slug.length < 3 || RESERVED_SLUGS.has(slug)) throw new HttpError(400, "Bu adres kullanılamaz.");
      const other = await db().shop.findUnique({ where: { slug } });
      if (other && other.id !== req.shopId) throw new HttpError(409, "Bu adres alınmış.");
      data.slug = slug;
    }
    const shop = await db().shop.update({ where: { id: req.shopId }, data });
    res.json({ success: true, data: ownerShop(shop) });
  } catch (error) {
    next(error);
  }
});

// ---------- Hizmetler ----------
function serviceData(body, partial) {
  const data = {};
  if (!partial || body.name !== undefined) {
    data.name = cleanText(body.name, 60);
    if (data.name.length < 2) throw new HttpError(400, "Hizmet adı en az 2 karakter olmalı.");
  }
  if (body.description !== undefined) data.description = cleanText(body.description, 300);
  if (!partial || body.price !== undefined) {
    data.price = toInt(body.price);
    if (!(data.price >= 0 && data.price <= 100000)) throw new HttpError(400, "Fiyat geçersiz.");
  }
  if (!partial || body.durationMinutes !== undefined) {
    data.durationMinutes = toInt(body.durationMinutes ?? 30);
    if (!(data.durationMinutes >= 5 && data.durationMinutes <= 480)) throw new HttpError(400, "Süre 5-480 dk olmalı.");
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = toInt(body.sortOrder) || 0;
  return data;
}

async function ownService(req, id) {
  const service = await db().service.findFirst({ where: { id: idOf(id, "Hizmet"), shopId: req.shopId } });
  if (!service) throw new HttpError(404, "Hizmet bulunamadı.");
  return service;
}

router.get("/services", async (req, res, next) => {
  try {
    const services = await db().service.findMany({ where: { shopId: req.shopId }, orderBy: { sortOrder: "asc" } });
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
});

router.post("/services", async (req, res, next) => {
  try {
    ownerOnly(req);
    const count = await db().service.count({ where: { shopId: req.shopId } });
    if (count >= 100) throw new HttpError(400, "En fazla 100 hizmet eklenebilir.");
    const service = await db().service.create({
      data: { ...serviceData(req.body, false), shopId: req.shopId, sortOrder: count },
    });
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

router.patch("/services/:id", async (req, res, next) => {
  try {
    ownerOnly(req);
    const existing = await ownService(req, req.params.id);
    const service = await db().service.update({ where: { id: existing.id }, data: serviceData(req.body, true) });
    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

// ---------- Calisma saatleri ----------
router.get("/hours", async (req, res, next) => {
  try {
    const hours = await db().workingHour.findMany({ where: { shopId: req.shopId }, orderBy: { dayOfWeek: "asc" } });
    res.json({ success: true, data: hours.map((h) => ({ ...h, day: DAY_NAMES[h.dayOfWeek] })) });
  } catch (error) {
    next(error);
  }
});

router.put("/hours", async (req, res, next) => {
  try {
    ownerOnly(req);
    const list = Array.isArray(req.body.hours) ? req.body.hours : [];
    if (list.length !== 7) throw new HttpError(400, "7 günün saatleri gönderilmeli.");
    const clean = list.map((h) => {
      const day = toInt(h.dayOfWeek);
      const open = toMinutes(h.openTime);
      const close = toMinutes(h.closeTime);
      if (!(day >= 0 && day <= 6)) throw new HttpError(400, "Gün geçersiz.");
      if (h.isOpen && (Number.isNaN(open) || Number.isNaN(close) || close <= open)) {
        throw new HttpError(400, `${DAY_NAMES[day]}: kapanış saati açılıştan sonra olmalı.`);
      }
      // Ogle arasi: ikisi de bos ya da acik saatler icinde gecerli bir aralik
      let breakStart = String(h.breakStart || "");
      let breakEnd = String(h.breakEnd || "");
      if (breakStart || breakEnd) {
        const bs = toMinutes(breakStart);
        const be = toMinutes(breakEnd);
        if (Number.isNaN(bs) || Number.isNaN(be) || be <= bs) throw new HttpError(400, `${DAY_NAMES[day]}: öğle arası bitişi başlangıçtan sonra olmalı.`);
        if (h.isOpen && (bs < open || be > close)) throw new HttpError(400, `${DAY_NAMES[day]}: öğle arası çalışma saatleri içinde olmalı.`);
      }
      if (!breakStart || !breakEnd) { breakStart = ""; breakEnd = ""; }
      return {
        dayOfWeek: day, isOpen: Boolean(h.isOpen), openTime: h.openTime || "09:00", closeTime: h.closeTime || "20:00",
        breakStart, breakEnd,
      };
    });
    if (new Set(clean.map((h) => h.dayOfWeek)).size !== 7) throw new HttpError(400, "Her gün bir kez olmalı.");
    await db().$transaction(async (tx) => {
      for (const h of clean) {
        await tx.workingHour.updateMany({ where: { shopId: req.shopId, dayOfWeek: h.dayOfWeek }, data: h });
      }
    });
    const hours = await db().workingHour.findMany({ where: { shopId: req.shopId }, orderBy: { dayOfWeek: "asc" } });
    res.json({ success: true, data: hours.map((h) => ({ ...h, day: DAY_NAMES[h.dayOfWeek] })) });
  } catch (error) {
    next(error);
  }
});

// ---------- Kapali gunler (bayram, tatil) ----------
router.get("/closed-days", async (req, res, next) => {
  try {
    const list = await db().closedDay.findMany({
      where: { shopId: req.shopId, date: { gte: localNow().date } }, orderBy: { date: "asc" },
    });
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

router.post("/closed-days", async (req, res, next) => {
  try {
    ownerOnly(req);
    const date = String(req.body.date || "");
    const today = localNow().date;
    if (!isDate(date) || date < today || date > addDays(today, 365)) throw new HttpError(400, "Tarih bugünden 1 yıl sonrasına kadar olmalı.");
    const exists = await db().closedDay.findFirst({ where: { shopId: req.shopId, date } });
    if (exists) throw new HttpError(409, "Bu gün zaten kapalı.");
    const count = await db().closedDay.count({ where: { shopId: req.shopId, date: { gte: today } } });
    if (count >= 60) throw new HttpError(400, "En fazla 60 kapalı gün eklenebilir.");
    const row = await db().closedDay.create({ data: { shopId: req.shopId, date, reason: cleanText(req.body.reason, 60) } });
    // O gun zaten alinmis randevular silinmez; asistan uyarir (CALISAN/KAPALI_GUNDE_RANDEVU)
    const affected = await db().appointment.count({ where: { shopId: req.shopId, date, status: { in: ["PENDING", "CONFIRMED"] } } });
    res.status(201).json({ success: true, data: { ...row, affected } });
  } catch (error) {
    next(error);
  }
});

router.delete("/closed-days/:id", async (req, res, next) => {
  try {
    ownerOnly(req);
    const row = await db().closedDay.findFirst({ where: { id: idOf(req.params.id, "Gün"), shopId: req.shopId } });
    if (!row) throw new HttpError(404, "Gün bulunamadı.");
    await db().closedDay.delete({ where: { id: row.id } });
    res.json({ success: true, data: { id: row.id } });
  } catch (error) {
    next(error);
  }
});

// ---------- Randevular ----------
router.get("/appointments", async (req, res, next) => {
  try {
    const from = isDate(req.query.from) ? req.query.from : localNow().date;
    const to = isDate(req.query.to) ? req.query.to : from;
    if (to < from || to > addDays(from, 92)) throw new HttpError(400, "Tarih aralığı geçersiz (en fazla 3 ay).");
    const where = { shopId: req.shopId, date: { gte: from, lte: to } };
    if (req.query.barberId) where.barberId = idOf(req.query.barberId, "Berber");
    const own = staffBarberId(req);
    if (own) where.barberId = own; // calisan sadece kendi randevularini gorur
    const list = await db().appointment.findMany({
      where,
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    });
    const profiles = await profilesFor(req.shopId, list.map((a) => a.customerKey));
    res.json({
      success: true,
      data: list.map((a) => ({ ...formatAppointment(a), customer: profiles[a.customerKey] || null })),
    });
  } catch (error) {
    next(error);
  }
});

// Berber telefonla/dukkanda aldigi randevuyu kendisi ekler (calisma saati disina da izin verilir,
// ama baska randevuyla cakisamaz).
router.post("/appointments", async (req, res, next) => {
  try {
    const date = String(req.body.date || "");
    if (!isDate(date)) throw new HttpError(400, "Tarih geçersiz.");
    if (date < addDays(localNow().date, -1) || date > addDays(localNow().date, 365)) {
      throw new HttpError(400, "Tarih dün ile 1 yıl sonrası arasında olmalı.");
    }
    const start = toMinutes(req.body.time);
    if (Number.isNaN(start)) throw new HttpError(400, "Saat geçersiz.");
    const customerName = cleanText(req.body.customerName, 60);
    if (customerName.length < 2) throw new HttpError(400, "Müşteri adını yazın.");
    const customerPhone = cleanPhone(req.body.customerPhone);
    const service = await db().service.findFirst({ where: { id: idOf(req.body.serviceId, "Hizmet"), shopId: req.shopId } });
    if (!service) throw new HttpError(404, "Hizmet bulunamadı.");
    const end = start + service.durationMinutes;
    if (end > 24 * 60) throw new HttpError(400, "Randevu gece yarısını geçemez.");

    const own = staffBarberId(req);
    const barber = await barberFor(req, own || req.body.barberId, true);

    const created = await db().$transaction(async (tx) => {
      const sameDay = await tx.appointment.findMany({
        where: { shopId: req.shopId, date, status: { in: ["PENDING", "CONFIRMED"] } },
      });
      if (overlaps(barber ? busyFor(sameDay, barber.id) : sameDay, start, end)) {
        throw new HttpError(409, barber ? `${barber.name} bu saatte dolu.` : "Bu saatte başka bir randevu var.");
      }
      return tx.appointment.create({
        data: {
          shopId: req.shopId, serviceId: service.id, serviceName: service.name, price: service.price,
          barberId: barber ? barber.id : null, barberName: barber ? barber.name : "",
          customerName, customerPhone, customerKey: customerKey(customerPhone), note: cleanText(req.body.note, 300), date,
          startMinutes: start, endMinutes: end, status: "CONFIRMED", decidedBy: "OWNER",
        },
      });
    });
    res.status(201).json({ success: true, data: formatAppointment(created) });
  } catch (error) {
    next(error);
  }
});

router.patch("/appointments/:id", async (req, res, next) => {
  try {
    const existing = await db().appointment.findFirst({ where: { id: idOf(req.params.id, "Randevu"), shopId: req.shopId } });
    if (!existing) throw new HttpError(404, "Randevu bulunamadı.");
    const own = staffBarberId(req);
    if (own && existing.barberId !== own) throw new HttpError(404, "Randevu bulunamadı.");
    if (own && req.body.barberId !== undefined) throw new HttpError(403, "Randevuyu başka berbere sadece dükkan sahibi aktarabilir.");
    const data = {};
    if (req.body.status !== undefined) {
      const status = String(req.body.status || "");
      if (!STATUSES.includes(status)) throw new HttpError(400, "Durum geçersiz.");
      data.status = status;
    }
    // Baska berbere aktarma (orn. berber hastalandi)
    if (req.body.barberId !== undefined) {
      const barber = await barberFor(req, req.body.barberId, true);
      if (barber) {
        const sameDay = await db().appointment.findMany({
          where: { shopId: req.shopId, date: existing.date, status: { in: ["PENDING", "CONFIRMED"] } },
        });
        const others = busyFor(sameDay, barber.id).filter((a) => a.id !== existing.id);
        if (overlaps(others, existing.startMinutes, existing.endMinutes)) throw new HttpError(409, `${barber.name} bu saatte dolu.`);
        if (!worksOn(barber, existing.date)) throw new HttpError(409, `${barber.name} o gün izinli.`);
        data.barberId = barber.id;
        data.barberName = barber.name;
      }
    }
    if (Object.keys(data).length === 0) throw new HttpError(400, "Değişiklik yok.");
    const status = data.status || existing.status;
    const updated = await db().appointment.update({ where: { id: existing.id }, data });
    // Kasa: tamamlaninca gelir yazilir, geri alininca silinir
    if (data.status && (status === "COMPLETED" || existing.status === "COMPLETED")) {
      await syncAppointmentCash(updated, String(req.body.paymentMethod || "CASH"));
    }
    res.json({ success: true, data: formatAppointment(updated) });
  } catch (error) {
    next(error);
  }
});

// ---------- Karar motoru / asistan ----------
router.use("/decisions", requireOwner);
router.get("/decisions/insights", async (req, res, next) => {
  try {
    const shop = await db().shop.findUnique({ where: { id: req.shopId } });
    res.json({ success: true, data: await shopInsights(shop, shopAccess(shop)) });
  } catch (error) {
    next(error);
  }
});

router.get("/decisions/log", async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit) || 30));
    res.json({ success: true, data: await decisionLog(req.shopId, limit) });
  } catch (error) {
    next(error);
  }
});

function decisionSettings(shop) {
  return {
    confirmMode: shop.confirmMode, noShowLimit: shop.noShowLimit, maxActivePerPhone: shop.maxActivePerPhone,
    loyaltyEvery: shop.loyaltyEvery || 0,
  };
}

router.get("/decisions/settings", async (req, res, next) => {
  try {
    const shop = await db().shop.findUnique({ where: { id: req.shopId } });
    res.json({ success: true, data: decisionSettings(shop) });
  } catch (error) {
    next(error);
  }
});

router.patch("/decisions/settings", async (req, res, next) => {
  try {
    ownerOnly(req);
    const b = req.body || {};
    const data = {};
    if (b.confirmMode !== undefined) {
      if (!CONFIRM_MODES.includes(b.confirmMode)) throw new HttpError(400, "Onay modu geçersiz.");
      data.confirmMode = b.confirmMode;
    }
    if (b.loyaltyEvery !== undefined) {
      const n = toInt(b.loyaltyEvery);
      if (!(n === 0 || (n >= 3 && n <= 50))) throw new HttpError(400, "Sadakat: kapalı ya da 3-50 arası bir ziyaret sayısı olmalı.");
      data.loyaltyEvery = n;
    }
    for (const [field, label] of [["noShowLimit", "Gelmeme sınırı"], ["maxActivePerPhone", "Aktif randevu sınırı"]]) {
      if (b[field] !== undefined) {
        const n = toInt(b[field]);
        if (!(n >= 1 && n <= 10)) throw new HttpError(400, `${label} 1-10 arası olmalı.`);
        data[field] = n;
      }
    }
    const shop = await db().shop.update({ where: { id: req.shopId }, data });
    res.json({ success: true, data: decisionSettings(shop) });
  } catch (error) {
    next(error);
  }
});

// ---------- Ozet ----------
router.get("/stats", async (req, res, next) => {
  try {
    const today = localNow().date;
    const weekStart = addDays(today, -6);
    const mine = staffBarberId(req) ? { barberId: req.user.barberId } : {};
    const [todayList, weekList] = await Promise.all([
      db().appointment.findMany({ where: { shopId: req.shopId, date: today, ...mine } }),
      db().appointment.findMany({ where: { shopId: req.shopId, date: { gte: weekStart, lte: today }, ...mine } }),
    ]);
    const active = (a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW";
    res.json({
      success: true,
      data: {
        today: todayList.filter(active).length,
        pending: todayList.filter((a) => a.status === "PENDING").length,
        weekCompleted: weekList.filter((a) => a.status === "COMPLETED").length,
        weekRevenue: weekList.filter((a) => a.status === "COMPLETED").reduce((sum, a) => sum + a.price, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
