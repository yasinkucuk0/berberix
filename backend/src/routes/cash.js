// KASA. TUM sorgular req.shopId ile sinirlidir (kiraci izolasyonu).
const express = require("express");
const { db } = require("../lib/db");
const { HttpError, cleanText, toInt, idOf, isDate, localNow, addDays } = require("../lib/util");
const { requireAuth, requireShop, requireOwner } = require("../middleware/auth");
const {
  METHODS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, summarize, formatEntry,
} = require("../lib/cash");

const router = express.Router();
router.use(requireAuth, requireShop, requireOwner);

router.get("/meta", (req, res) => {
  res.json({ success: true, data: { methods: METHODS, income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES } });
});

// Gun: hareketler + ozet
router.get("/", async (req, res, next) => {
  try {
    const date = isDate(req.query.date) ? req.query.date : localNow().date;
    const entries = await db().cashEntry.findMany({
      where: { shopId: req.shopId, date }, orderBy: { createdAt: "desc" },
    });
    // Berber kirilimi (prim/komisyon hesabi icin): o gun tamamlanan randevulardan
    const done = await db().appointment.findMany({ where: { shopId: req.shopId, date, status: "COMPLETED" } });
    const byBarber = {};
    for (const a of done) {
      const name = a.barberName || "Atanmamış";
      byBarber[name] = byBarber[name] || { name, count: 0, revenue: 0 };
      byBarber[name].count += 1;
      byBarber[name].revenue += a.price;
    }
    res.json({
      success: true,
      data: {
        date, entries: entries.map(formatEntry), summary: summarize(entries),
        byBarber: Object.values(byBarber).sort((x, y) => y.revenue - x.revenue),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Donem raporu: gun gun gelir/gider
router.get("/report", async (req, res, next) => {
  try {
    const today = localNow().date;
    const to = isDate(req.query.to) ? req.query.to : today;
    const from = isDate(req.query.from) ? req.query.from : addDays(to, -29);
    if (from > to || from < addDays(to, -366)) throw new HttpError(400, "Tarih aralığı geçersiz (en fazla 1 yıl).");
    const entries = await db().cashEntry.findMany({ where: { shopId: req.shopId, date: { gte: from, lte: to } } });
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const s = summarize(entries.filter((e) => e.date === d));
      days.push({ date: d, income: s.income, expense: s.expense, net: s.net });
    }
    res.json({ success: true, data: { from, to, days, total: summarize(entries) } });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const type = b.type === "EXPENSE" ? "EXPENSE" : b.type === "INCOME" ? "INCOME" : null;
    if (!type) throw new HttpError(400, "Tür gelir ya da gider olmalı.");
    const categories = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = categories.includes(b.category) ? b.category : null;
    if (!category) throw new HttpError(400, "Kategori geçersiz.");
    const amount = toInt(b.amount);
    if (!(amount >= 1 && amount <= 1_000_000)) throw new HttpError(400, "Tutar 1 ile 1.000.000 TL arası olmalı.");
    const method = METHODS.includes(b.method) ? b.method : "CASH";
    const today = localNow().date;
    const date = b.date === undefined ? today : String(b.date);
    if (!isDate(date) || date > today || date < addDays(today, -366)) throw new HttpError(400, "Tarih geçersiz.");
    const entry = await db().cashEntry.create({
      data: { shopId: req.shopId, date, type, category, amount, method, note: cleanText(b.note, 200) },
    });
    res.status(201).json({ success: true, data: formatEntry(entry) });
  } catch (error) {
    next(error);
  }
});

// Sadece elle girilen hareket silinir; randevudan gelen kayit randevu durumundan yonetilir.
router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "OWNER") throw new HttpError(403, "Kasa kaydını sadece dükkan sahibi silebilir.");
    const entry = await db().cashEntry.findFirst({ where: { id: idOf(req.params.id, "Kayıt"), shopId: req.shopId } });
    if (!entry) throw new HttpError(404, "Kayıt bulunamadı.");
    if (entry.appointmentId != null) {
      throw new HttpError(400, "Bu kayıt bir randevudan geldi. Randevunun durumunu değiştirerek düzeltebilirsin.");
    }
    await db().cashEntry.delete({ where: { id: entry.id } });
    res.json({ success: true, data: { id: entry.id } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
