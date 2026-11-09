// CALISANLAR (berberler / koltuklar). TUM sorgular req.shopId ile sinirlidir.
// Calisan silinmez, pasif yapilir (gecmis randevular ve kasa kirilimi bozulmasin).
const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../lib/db");
const { HttpError, cleanText, idOf, toInt, isEmail } = require("../lib/util");
const { barberLimitDecision } = require("../decisions");
const { limitsOf } = require("../decisions/policies/plan");
const { DAY_NAMES } = require("../lib/shop");
const { offDaysOf } = require("../lib/availability");
const { requireAuth, requireShop } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireShop);

const MAX_BARBERS = 20;

function ownerOnly(req) {
  if (req.user.role !== "OWNER") throw new HttpError(403, "Çalışanları sadece dükkan sahibi düzenleyebilir.");
}

function format(b, login) {
  const off = offDaysOf(b);
  return {
    id: b.id, name: b.name, title: b.title, isActive: b.isActive, sortOrder: b.sortOrder,
    offDays: off, offDayNames: off.map((d) => DAY_NAMES[d]),
    login: login ? { email: login.email } : null,
  };
}

// KARAR MOTORU: paket siniri (src/decisions/policies/plan.js)
async function assertCanActivate(shopId) {
  const decision = await barberLimitDecision(shopId);
  if (decision.outcome === "BLOCK") throw new HttpError(403, decision.reasons[0].message);
}

function cleanOffDays(value) {
  if (!Array.isArray(value)) throw new HttpError(400, "İzin günleri liste olmalı.");
  const days = [...new Set(value.map(toInt))].sort();
  if (days.some((d) => !(d >= 0 && d <= 6))) throw new HttpError(400, "İzin günü geçersiz.");
  if (days.length === 7) throw new HttpError(400, "Her gün izinli olamaz; çalışanı pasif yap.");
  return days.join(",");
}

function barberData(body, partial) {
  const data = {};
  if (!partial || body.name !== undefined) {
    data.name = cleanText(body.name, 40);
    if (data.name.length < 2) throw new HttpError(400, "Çalışan adı en az 2 karakter olmalı.");
  }
  if (body.title !== undefined) data.title = cleanText(body.title, 30);
  if (body.offDays !== undefined) data.offDays = cleanOffDays(body.offDays);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = toInt(body.sortOrder) || 0;
  return data;
}

router.get("/", async (req, res, next) => {
  try {
    const [list, logins, shop] = await Promise.all([
      db().barber.findMany({ where: { shopId: req.shopId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      db().user.findMany({ where: { shopId: req.shopId, role: "STAFF" } }),
      db().shop.findUnique({ where: { id: req.shopId } }),
    ]);
    const limits = limitsOf(shop);
    res.json({
      success: true,
      data: list.map((b) => format(b, req.user.role === "OWNER" ? logins.find((u) => u.barberId === b.id) : null)),
      meta: { plan: limits.plan, planLabel: limits.label, maxBarbers: Number.isFinite(limits.barbers) ? limits.barbers : null },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    ownerOnly(req);
    const count = await db().barber.count({ where: { shopId: req.shopId } });
    if (count >= MAX_BARBERS) throw new HttpError(400, `En fazla ${MAX_BARBERS} çalışan eklenebilir.`);
    await assertCanActivate(req.shopId);
    const barber = await db().barber.create({ data: { ...barberData(req.body || {}, false), shopId: req.shopId, sortOrder: count } });
    res.status(201).json({ success: true, data: format(barber) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    ownerOnly(req);
    const existing = await db().barber.findFirst({ where: { id: idOf(req.params.id, "Çalışan"), shopId: req.shopId } });
    if (!existing) throw new HttpError(404, "Çalışan bulunamadı.");
    const data = barberData(req.body || {}, true);
    if (data.isActive === true && !existing.isActive) await assertCanActivate(req.shopId);
    const barber = await db().barber.update({ where: { id: existing.id }, data });
    // Ad degisirse ileri tarihli randevulardaki gorunen ad da guncellenir
    if (data.name && data.name !== existing.name) {
      await db().appointment.updateMany({ where: { shopId: req.shopId, barberId: existing.id }, data: { barberName: data.name } });
    }
    res.json({ success: true, data: format(barber) });
  } catch (error) {
    next(error);
  }
});

// ---------- Calisan girisi (her berber kendi telefonundan kendi randevularini gorur) ----------
router.put("/:id/login", async (req, res, next) => {
  try {
    ownerOnly(req);
    const barber = await db().barber.findFirst({ where: { id: idOf(req.params.id, "Çalışan"), shopId: req.shopId } });
    if (!barber) throw new HttpError(404, "Çalışan bulunamadı.");
    const email = cleanText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");
    if (!isEmail(email)) throw new HttpError(400, "Geçerli bir e-posta yazın.");
    const current = await db().user.findFirst({ where: { shopId: req.shopId, role: "STAFF", barberId: barber.id } });
    if (!current || password) {
      if (password.length < 8) throw new HttpError(400, "Şifre en az 8 karakter olmalı.");
    }
    const other = await db().user.findUnique({ where: { email } });
    if (other && (!current || other.id !== current.id)) throw new HttpError(409, "Bu e-posta başka bir hesapta kullanılıyor.");
    const data = { email, name: barber.name };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    const user = current
      ? await db().user.update({ where: { id: current.id }, data })
      : await db().user.create({ data: { ...data, role: "STAFF", shopId: req.shopId, barberId: barber.id } });
    res.json({ success: true, data: format(barber, user) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/login", async (req, res, next) => {
  try {
    ownerOnly(req);
    const barber = await db().barber.findFirst({ where: { id: idOf(req.params.id, "Çalışan"), shopId: req.shopId } });
    if (!barber) throw new HttpError(404, "Çalışan bulunamadı.");
    await db().user.deleteMany({ where: { shopId: req.shopId, role: "STAFF", barberId: barber.id } });
    res.json({ success: true, data: format(barber, null) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
