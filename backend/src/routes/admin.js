// Platform yonetimi (sen): tum dukkanlar, durum ve abonelik.
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../lib/db");
const { HttpError, cleanText, isEmail, toInt, idOf } = require("../lib/util");
const { ownerShop, publicUser } = require("../lib/shop");
const { signToken, requireAuth, requireRole, rateLimit } = require("../middleware/auth");
const { lifecycleFor } = require("../decisions");
const { PLANS } = require("../decisions/policies/plan");
const { localNow, addDays } = require("../lib/util");

const router = express.Router();

function isLocalRequest(req) {
  const ip = String(req.socket.remoteAddress || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

router.get("/setup-status", async (req, res, next) => {
  try {
    const count = await db().user.count({ where: { role: "PLATFORM_ADMIN" } });
    res.json({ success: true, data: { needsSetup: count === 0, needsToken: Boolean(process.env.ADMIN_SETUP_TOKEN) } });
  } catch (error) {
    next(error);
  }
});

// Ilk platform yoneticisi: yalnizca hic yonetici yokken; ya bu bilgisayardan
// ya da canlida barindirma panelindeki ADMIN_SETUP_TOKEN ile.
function setupAllowed(req) {
  const token = String(process.env.ADMIN_SETUP_TOKEN || "");
  if (token.length >= 16) {
    const given = String(req.body.setupToken || "");
    const a = Buffer.from(given);
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return process.env.NODE_ENV !== "production" && isLocalRequest(req);
}

router.post("/setup", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req, res, next) => {
  try {
    if (!setupAllowed(req)) {
      throw new HttpError(403, process.env.ADMIN_SETUP_TOKEN
        ? "Kurulum anahtarı hatalı."
        : "Kurulum yalnızca sunucu bilgisayarından yapılabilir.");
    }
    if ((await db().user.count({ where: { role: "PLATFORM_ADMIN" } })) > 0) {
      throw new HttpError(409, "Platform yöneticisi zaten var.");
    }
    const email = cleanText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");
    const name = cleanText(req.body.name, 60) || "Yönetici";
    if (!isEmail(email)) throw new HttpError(400, "Geçerli bir e-posta yazın.");
    if (password.length < 10) throw new HttpError(400, "Yönetici şifresi en az 10 karakter olmalı.");
    if (await db().user.findUnique({ where: { email } })) throw new HttpError(409, "Bu e-posta kullanılıyor.");
    const user = await db().user.create({
      data: { email, name, role: "PLATFORM_ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
    res.status(201).json({ success: true, data: { token: signToken(user), user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth, requireRole("PLATFORM_ADMIN"));

// Satis demosunu (yeniden) olustur: ziyaretcilerin bozdugu demo temize doner.
router.post("/demo/reset", async (req, res, next) => {
  try {
    const result = await require("../lib/demo").seedDemo(db());
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/shops", async (req, res, next) => {
  try {
    const shops = await db().shop.findMany({ orderBy: { createdAt: "desc" } });
    const result = [];
    for (const shop of shops) {
      const today = localNow().date;
      const [owner, appointmentCount, recentAppointments] = await Promise.all([
        db().user.findFirst({ where: { shopId: shop.id, role: "OWNER" } }),
        db().appointment.count({ where: { shopId: shop.id } }),
        db().appointment.count({ where: { shopId: shop.id, date: { gte: addDays(today, -14), lte: today } } }),
      ]);
      const decision = lifecycleFor(shop, recentAppointments);
      const { logo, ...rest } = ownerShop(shop);
      result.push({
        ...rest,
        hasLogo: Boolean(logo),
        createdAt: shop.createdAt,
        owner: owner ? { name: owner.name, email: owner.email } : null,
        appointmentCount,
        decision: { outcome: decision.outcome, reasons: decision.reasons.map((r) => r.message) },
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// status: TRIAL | ACTIVE | SUSPENDED ; extendDays: abonelik/deneme uzatma
router.patch("/shops/:id", async (req, res, next) => {
  try {
    const shop = await db().shop.findUnique({ where: { id: idOf(req.params.id, "Dükkan") } });
    if (!shop) throw new HttpError(404, "Dükkan bulunamadı.");
    const data = {};
    if (req.body.status !== undefined) {
      if (!["TRIAL", "ACTIVE", "SUSPENDED"].includes(req.body.status)) throw new HttpError(400, "Durum geçersiz.");
      data.status = req.body.status;
    }
    if (req.body.plan !== undefined) {
      if (!PLANS.includes(req.body.plan)) throw new HttpError(400, `Paket ${PLANS.join(" / ")} olmalı.`);
      data.plan = req.body.plan;
    }
    if (req.body.extendDays !== undefined) {
      const days = toInt(req.body.extendDays);
      if (!(days >= 1 && days <= 400)) throw new HttpError(400, "Gün sayısı 1-400 olmalı.");
      const field = (data.status || shop.status) === "TRIAL" ? "trialEndsAt" : "paidUntil";
      const base = shop[field] && new Date(shop[field]) > new Date() ? new Date(shop[field]) : new Date();
      data[field] = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    }
    const updated = await db().shop.update({ where: { id: shop.id }, data });
    res.json({ success: true, data: ownerShop(updated) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
