// MUSTERILER (CRM). TUM sorgular req.shopId ile sinirlidir (kiraci izolasyonu).
// Musteri listesi randevulardan turetilir (ayri musteri hesabi yok, bkz. ADR-007).
const express = require("express");
const { db } = require("../lib/db");
const { HttpError, cleanText, localNow, addDays } = require("../lib/util");
const { formatAppointment } = require("../lib/shop");
const { requireAuth, requireShop, requireOwner } = require("../middleware/auth");
const { customerProfile } = require("../decisions");
const {
  groupCustomers, segmentOf, buildProfile, marketingAllowed, SEGMENTS,
} = require("../decisions/customer");

const router = express.Router();
router.use(requireAuth, requireShop, requireOwner);

function keyOf(value) {
  const key = String(value || "");
  if (!/^\d{10}$/.test(key)) throw new HttpError(404, "Müşteri bulunamadı.");
  return key;
}

async function notesFor(shopId, keys) {
  if (keys.length === 0) return {};
  const rows = await db().customerNote.findMany({ where: { shopId, customerKey: { in: keys } } });
  return Object.fromEntries(rows.map((r) => [r.customerKey, r.note]));
}

// Telefonla profil (randevu eklerken "bu kim?" sorusu icin)
router.get("/profile", async (req, res, next) => {
  try {
    const { key, profile } = await customerProfile(req.shopId, req.query.phone);
    if (!key) throw new HttpError(400, "Telefon numarası geçersiz.");
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// Liste: ?q= (ad/telefon) ?segment= (RISKLI | KAYIP_RISKI | SADIK | YENI | DUZENLI)
router.get("/", async (req, res, next) => {
  try {
    const today = localNow().date;
    const rows = await db().appointment.findMany({
      where: { shopId: req.shopId, date: { gte: addDays(today, -730), lte: addDays(today, 365) } },
    });
    let list = groupCustomers(rows);

    const segment = String(req.query.segment || "");
    if (segment) {
      if (!SEGMENTS.includes(segment)) throw new HttpError(400, "Filtre geçersiz.");
      list = list.filter((c) => c.segment === segment);
    }
    const q = cleanText(req.query.q, 40).toLocaleLowerCase("tr-TR");
    if (q) {
      const digits = q.replace(/\D/g, "");
      list = list.filter((c) => c.name.toLocaleLowerCase("tr-TR").includes(q) || (digits.length >= 3 && c.key.includes(digits)));
    }

    const counts = Object.fromEntries(SEGMENTS.map((s) => [s, 0]));
    for (const c of groupCustomers(rows)) counts[c.segment] += 1;

    const page = list.slice(0, 200);
    const notes = await notesFor(req.shopId, page.map((c) => c.key));
    res.json({
      success: true,
      data: { total: list.length, counts, customers: page.map((c) => ({ ...c, note: notes[c.key] || "" })) },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:key", async (req, res, next) => {
  try {
    const key = keyOf(req.params.key);
    const history = await db().appointment.findMany({
      where: { shopId: req.shopId, customerKey: key },
      orderBy: [{ date: "desc" }, { startMinutes: "desc" }],
    });
    if (history.length === 0) throw new HttpError(404, "Müşteri bulunamadı.");
    const profile = buildProfile(history);
    const note = await db().customerNote.findUnique({ where: { shopId_customerKey: { shopId: req.shopId, customerKey: key } } });
    res.json({
      success: true,
      data: {
        key,
        name: history[0].customerName,
        phone: history[0].customerPhone,
        profile,
        segment: segmentOf(profile),
        marketingConsent: marketingAllowed(history),
        spent: history.filter((a) => a.status === "COMPLETED").reduce((sum, a) => sum + a.price, 0),
        note: note ? note.note : "",
        history: history.slice(0, 50).map(formatAppointment),
      },
    });
  } catch (error) {
    next(error);
  }
});

// KVKK: musteri kampanya mesaji iznini geri alirsa berber buradan kaydeder.
// Izin VERILEMEZ; izni sadece musteri kendisi (online randevuda) verir.
router.put("/:key/consent", async (req, res, next) => {
  try {
    const key = keyOf(req.params.key);
    if (req.body.marketingConsent !== false) {
      throw new HttpError(400, "Kampanya iznini sadece müşteri kendisi verebilir; buradan yalnızca geri alınır.");
    }
    const result = await db().appointment.updateMany({
      where: { shopId: req.shopId, customerKey: key }, data: { marketingConsent: false },
    });
    if (result.count === 0) throw new HttpError(404, "Müşteri bulunamadı.");
    res.json({ success: true, data: { marketingConsent: false } });
  } catch (error) {
    next(error);
  }
});

router.put("/:key/note", async (req, res, next) => {
  try {
    const key = keyOf(req.params.key);
    const exists = await db().appointment.findFirst({ where: { shopId: req.shopId, customerKey: key } });
    if (!exists) throw new HttpError(404, "Müşteri bulunamadı.");
    const note = cleanText(req.body.note, 500);
    const saved = await db().customerNote.upsert({
      where: { shopId_customerKey: { shopId: req.shopId, customerKey: key } },
      create: { shopId: req.shopId, customerKey: key, note },
      update: { note },
    });
    res.json({ success: true, data: { note: saved.note } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
