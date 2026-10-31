const express = require("express");
const { db } = require("../lib/db");
const {
  HttpError, idOf, slugify, cleanText, cleanPhone, isDate, toMinutes, localNow, addDays,
} = require("../lib/util");
const { publicShop, shopAccess, DAY_NAMES } = require("../lib/shop");
const { computeSlots, overlaps, ACTIVE_STATUSES } = require("../lib/availability");
const { rateLimit } = require("../middleware/auth");

const router = express.Router();
const MAX_DAYS_AHEAD = 60;
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "Çok fazla randevu denemesi. Daha sonra tekrar deneyin." });

async function loadShop(slugParam) {
  const shop = await db().shop.findUnique({ where: { slug: slugify(slugParam) } });
  if (!shop) throw new HttpError(404, "Dükkan bulunamadı.");
  return shop;
}

function checkBookableDate(date) {
  if (!isDate(date)) throw new HttpError(400, "Tarih geçersiz.");
  const today = localNow().date;
  if (date < today) throw new HttpError(400, "Geçmiş bir tarih seçilemez.");
  if (date > addDays(today, MAX_DAYS_AHEAD)) throw new HttpError(400, `En fazla ${MAX_DAYS_AHEAD} gün sonrası seçilebilir.`);
}

router.get("/shops/:slug", async (req, res, next) => {
  try {
    const shop = await loadShop(req.params.slug);
    const access = shopAccess(shop);
    const [services, hours] = await Promise.all([
      db().service.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
      db().workingHour.findMany({ where: { shopId: shop.id }, orderBy: { dayOfWeek: "asc" } }),
    ]);
    res.json({
      success: true,
      data: {
        shop: publicShop(shop),
        acceptingBookings: access.open,
        services: services.map((s) => ({
          id: s.id, name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes,
        })),
        hours: hours.map((h) => ({
          dayOfWeek: h.dayOfWeek, day: DAY_NAMES[h.dayOfWeek], isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/shops/:slug/availability", async (req, res, next) => {
  try {
    const shop = await loadShop(req.params.slug);
    if (!shopAccess(shop).open) throw new HttpError(403, "Bu dükkan şu an online randevu almıyor.");
    const date = String(req.query.date || "");
    checkBookableDate(date);
    const service = await db().service.findFirst({
      where: { id: idOf(req.query.serviceId, "Hizmet"), shopId: shop.id, isActive: true },
    });
    if (!service) throw new HttpError(404, "Hizmet bulunamadı.");
    const [hours, appointments] = await Promise.all([
      db().workingHour.findMany({ where: { shopId: shop.id } }),
      db().appointment.findMany({ where: { shopId: shop.id, date, status: { in: ACTIVE_STATUSES } } }),
    ]);
    const slots = computeSlots({ date, hours, appointments, duration: service.durationMinutes, step: shop.slotMinutes });
    res.json({ success: true, data: { date, slots } });
  } catch (error) {
    next(error);
  }
});

router.post("/shops/:slug/appointments", bookingLimiter, async (req, res, next) => {
  try {
    const shop = await loadShop(req.params.slug);
    if (!shopAccess(shop).open) throw new HttpError(403, "Bu dükkan şu an online randevu almıyor.");

    const date = String(req.body.date || "");
    checkBookableDate(date);
    const start = toMinutes(req.body.time);
    const customerName = cleanText(req.body.customerName, 60);
    const customerPhone = cleanPhone(req.body.customerPhone);
    const note = cleanText(req.body.note, 300);
    if (Number.isNaN(start)) throw new HttpError(400, "Saat geçersiz.");
    if (customerName.length < 2) throw new HttpError(400, "Adınızı yazın.");
    if (customerPhone.replace(/\D/g, "").length < 10) throw new HttpError(400, "Geçerli bir telefon numarası yazın.");

    const service = await db().service.findFirst({
      where: { id: idOf(req.body.serviceId, "Hizmet"), shopId: shop.id, isActive: true },
    });
    if (!service) throw new HttpError(404, "Hizmet bulunamadı.");

    const created = await db().$transaction(async (tx) => {
      const [hours, appointments] = await Promise.all([
        tx.workingHour.findMany({ where: { shopId: shop.id } }),
        tx.appointment.findMany({ where: { shopId: shop.id, date, status: { in: ACTIVE_STATUSES } } }),
      ]);
      const slots = computeSlots({ date, hours, appointments, duration: service.durationMinutes, step: shop.slotMinutes });
      const end = start + service.durationMinutes;
      if (!slots.includes(req.body.time) || overlaps(appointments, start, end)) {
        throw new HttpError(409, "Bu saat dolu ya da uygun değil. Lütfen başka bir saat seçin.");
      }
      return tx.appointment.create({
        data: {
          shopId: shop.id, serviceId: service.id, serviceName: service.name, price: service.price,
          customerName, customerPhone, note, date, startMinutes: start, endMinutes: end,
        },
      });
    });

    res.status(201).json({
      success: true,
      data: { id: created.id, date, time: req.body.time, serviceName: service.name, price: service.price },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
