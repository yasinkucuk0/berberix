// Dukkan sahibi paneli. TUM sorgular req.shopId ile sinirlidir (kiraci izolasyonu).
const express = require("express");
const { db } = require("../lib/db");
const {
  HttpError, idOf, slugify, cleanText, cleanPhone, isColor, toInt, toMinutes, isDate, localNow, addDays,
  RESERVED_SLUGS,
} = require("../lib/util");
const { ownerShop, formatAppointment, DAY_NAMES } = require("../lib/shop");
const { requireAuth, requireShop } = require("../middleware/auth");

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
      return { dayOfWeek: day, isOpen: Boolean(h.isOpen), openTime: h.openTime || "09:00", closeTime: h.closeTime || "20:00" };
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

// ---------- Randevular ----------
router.get("/appointments", async (req, res, next) => {
  try {
    const from = isDate(req.query.from) ? req.query.from : localNow().date;
    const to = isDate(req.query.to) ? req.query.to : from;
    if (to < from || to > addDays(from, 92)) throw new HttpError(400, "Tarih aralığı geçersiz (en fazla 3 ay).");
    const list = await db().appointment.findMany({
      where: { shopId: req.shopId, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    });
    res.json({ success: true, data: list.map(formatAppointment) });
  } catch (error) {
    next(error);
  }
});

router.patch("/appointments/:id", async (req, res, next) => {
  try {
    const status = String(req.body.status || "");
    if (!STATUSES.includes(status)) throw new HttpError(400, "Durum geçersiz.");
    const existing = await db().appointment.findFirst({ where: { id: idOf(req.params.id, "Randevu"), shopId: req.shopId } });
    if (!existing) throw new HttpError(404, "Randevu bulunamadı.");
    const updated = await db().appointment.update({ where: { id: existing.id }, data: { status } });
    res.json({ success: true, data: formatAppointment(updated) });
  } catch (error) {
    next(error);
  }
});

// ---------- Ozet ----------
router.get("/stats", async (req, res, next) => {
  try {
    const today = localNow().date;
    const weekStart = addDays(today, -6);
    const [todayList, weekList] = await Promise.all([
      db().appointment.findMany({ where: { shopId: req.shopId, date: today } }),
      db().appointment.findMany({ where: { shopId: req.shopId, date: { gte: weekStart, lte: today } } }),
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
