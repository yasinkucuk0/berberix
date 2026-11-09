const crypto = require("crypto");
const express = require("express");
const { db } = require("../lib/db");
const {
  HttpError, idOf, slugify, cleanText, cleanPhone, isDate, toMinutes, fromMinutes, localNow, addDays,
} = require("../lib/util");
const { publicShop, shopAccess, DAY_NAMES } = require("../lib/shop");
const { barberSlots, busyFor, overlaps, ACTIVE_STATUSES } = require("../lib/availability");
const { chooseBarber } = require("../decisions/assign");
const { rateLimit } = require("../middleware/auth");
const { decideBooking, logDecision, maskPhone } = require("../decisions");

const router = express.Router();
const MAX_DAYS_AHEAD = 60;
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "Çok fazla randevu denemesi. Daha sonra tekrar deneyin." });

async function closedDatesFor(client, shopId, date) {
  const rows = await client.closedDay.findMany({ where: { shopId, date } });
  return rows.map((r) => r.date);
}

async function activeBarbers(client, shopId) {
  return client.barber.findMany({ where: { shopId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

// ?barberId= : bos / "any" = fark etmez; aksi halde bu dukkanin aktif berberi olmali
function pickBarberId(value, barbers) {
  if (value === undefined || value === null || value === "" || value === "any") return null;
  const id = Number(value);
  if (!barbers.some((b) => b.id === id)) throw new HttpError(404, "Berber bulunamadı.");
  return id;
}

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
    const [services, hours, barbers] = await Promise.all([
      db().service.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
      db().workingHour.findMany({ where: { shopId: shop.id }, orderBy: { dayOfWeek: "asc" } }),
      activeBarbers(db(), shop.id),
    ]);
    res.json({
      success: true,
      data: {
        shop: publicShop(shop),
        acceptingBookings: access.open,
        services: services.map((s) => ({
          id: s.id, name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes,
        })),
        barbers: barbers.map((b) => ({ id: b.id, name: b.name, title: b.title })),
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
    const [hours, closedDates, appointments, barbers] = await Promise.all([
      db().workingHour.findMany({ where: { shopId: shop.id } }),
      closedDatesFor(db(), shop.id, date),
      db().appointment.findMany({ where: { shopId: shop.id, date, status: { in: ACTIVE_STATUSES } } }),
      activeBarbers(db(), shop.id),
    ]);
    const barberId = pickBarberId(req.query.barberId, barbers);
    const { slots } = barberSlots({
      date, hours, appointments, duration: service.durationMinutes, step: shop.slotMinutes, barbers, barberId, closedDates,
    });
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
    if (req.body.kvkk !== true) throw new HttpError(400, "Devam etmek için Aydınlatma Metni'ni okuduğunu onayla.");
    const marketingConsent = req.body.marketingConsent === true;

    const service = await db().service.findFirst({
      where: { id: idOf(req.body.serviceId, "Hizmet"), shopId: shop.id, isActive: true },
    });
    if (!service) throw new HttpError(404, "Hizmet bulunamadı.");

    // KARAR MOTORU: onayla / berbere sor / reddet (src/decisions/policies/booking.js)
    const { key, decision, loyalty } = await decideBooking(db(), shop, customerPhone);
    const reward = loyalty.outcome === "REWARD";
    if (decision.outcome === "REJECT") {
      await logDecision(shop.id, "BOOKING", decision, `red ${maskPhone(customerPhone)}`);
      throw new HttpError(403, decision.reasons[0].message);
    }
    const status = decision.outcome === "CONFIRM" ? "CONFIRMED" : "PENDING";

    let assignment = null;
    const created = await db().$transaction(async (tx) => {
      const [hours, closedDates, appointments, barbers] = await Promise.all([
        tx.workingHour.findMany({ where: { shopId: shop.id } }),
        closedDatesFor(tx, shop.id, date),
        tx.appointment.findMany({ where: { shopId: shop.id, date, status: { in: ACTIVE_STATUSES } } }),
        activeBarbers(tx, shop.id),
      ]);
      const wanted = pickBarberId(req.body.barberId, barbers);
      const { slots, freeBy } = barberSlots({
        date, hours, appointments, duration: service.durationMinutes, step: shop.slotMinutes, barbers, barberId: wanted, closedDates,
      });
      const end = start + service.durationMinutes;
      if (!slots.includes(req.body.time)) {
        throw new HttpError(409, "Bu saat dolu ya da uygun değil. Lütfen başka bir saat seçin.");
      }

      let barber = null;
      if (freeBy) {
        const free = barbers.filter((b) => (freeBy[req.body.time] || []).includes(b.id)
          && !overlaps(busyFor(appointments, b.id), start, end));
        if (wanted) barber = free.find((b) => b.id === wanted) || null;
        else {
          // KARAR MOTORU: "fark etmez" -> en bos berber (src/decisions/assign.js)
          assignment = chooseBarber(free, appointments);
          barber = assignment ? assignment.barber : null;
        }
        if (!barber) throw new HttpError(409, "Bu saat dolu ya da uygun değil. Lütfen başka bir saat seçin.");
      } else if (overlaps(appointments, start, end)) {
        throw new HttpError(409, "Bu saat dolu ya da uygun değil. Lütfen başka bir saat seçin.");
      }

      return tx.appointment.create({
        data: {
          shopId: shop.id, serviceId: service.id, serviceName: service.name, price: reward ? 0 : service.price,
          loyaltyReward: reward, manageToken: crypto.randomBytes(18).toString("base64url"),
          barberId: barber ? barber.id : null, barberName: barber ? barber.name : "",
          customerName, customerPhone, customerKey: key, note, date, startMinutes: start, endMinutes: end,
          kvkkAcceptedAt: new Date(), marketingConsent,
          status, decidedBy: status === "CONFIRMED" ? "AUTO" : "",
        },
      });
    });
    await logDecision(shop.id, "BOOKING", decision, `#${created.id} ${maskPhone(customerPhone)}`);
    if (assignment) await logDecision(shop.id, "ASSIGN", assignment.decision, `#${created.id} ${created.barberName}`);

    res.status(201).json({
      success: true,
      data: {
        id: created.id, date, time: req.body.time, serviceName: service.name, price: created.price,
        barberName: created.barberName, manageToken: created.manageToken,
        loyalty: { reward, message: loyalty.reasons[0].outcome === "NONE" && loyalty.reasons[0].code === "VARSAYILAN" ? "" : loyalty.reasons[0].message },
        status: created.status,
        message: status === "CONFIRMED"
          ? "Randevun onaylandı. Seni bekliyoruz!"
          : "Randevu isteğin berbere iletildi. Onaylayınca kesinleşir.",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------- Musterinin randevusunu yonetmesi (iptal) ----------
// Link: /r/<token>. Token tahmin edilemez (144 bit); telefon numarasi gosterilmez.
async function loadByToken(token) {
  const t = String(token || "");
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(t)) throw new HttpError(404, "Randevu bulunamadı.");
  const appt = await db().appointment.findUnique({ where: { manageToken: t } });
  if (!appt) throw new HttpError(404, "Randevu bulunamadı.");
  const shop = await db().shop.findUnique({ where: { id: appt.shopId } });
  return { appt, shop };
}

function canCancel(appt, now = new Date()) {
  if (!ACTIVE_STATUSES.includes(appt.status)) return false;
  const local = localNow(now);
  return appt.date > local.date || (appt.date === local.date && appt.startMinutes > local.minutes);
}

function manageView(appt, shop) {
  return {
    shop: publicShop(shop),
    appointment: {
      date: appt.date, start: fromMinutes(appt.startMinutes), end: fromMinutes(appt.endMinutes),
      serviceName: appt.serviceName, price: appt.price, barberName: appt.barberName,
      customerName: appt.customerName.split(" ")[0], status: appt.status, loyaltyReward: Boolean(appt.loyaltyReward),
    },
    canCancel: canCancel(appt),
  };
}

router.get("/appointments/:token", async (req, res, next) => {
  try {
    const { appt, shop } = await loadByToken(req.params.token);
    res.json({ success: true, data: manageView(appt, shop) });
  } catch (error) {
    next(error);
  }
});

router.post("/appointments/:token/cancel", bookingLimiter, async (req, res, next) => {
  try {
    const { appt, shop } = await loadByToken(req.params.token);
    if (!canCancel(appt)) throw new HttpError(409, "Bu randevu artık iptal edilemez. Lütfen dükkanı ara.");
    const updated = await db().appointment.update({
      where: { id: appt.id }, data: { status: "CANCELLED", cancelledBy: "CUSTOMER" },
    });
    res.json({ success: true, data: manageView(updated, shop) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
