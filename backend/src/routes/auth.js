const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../lib/db");
const {
  HttpError, RESERVED_SLUGS, slugify, cleanText, isEmail, cleanPhone,
} = require("../lib/util");
const { DEFAULT_SERVICES, DEFAULT_HOURS, ownerShop, publicUser } = require("../lib/shop");
const { signToken, requireAuth, rateLimit } = require("../middleware/auth");

const router = express.Router();
const TRIAL_DAYS = 14;
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.get("/slug-check", async (req, res, next) => {
  try {
    const slug = slugify(req.query.slug);
    const taken = !slug || slug.length < 3 || RESERVED_SLUGS.has(slug)
      || Boolean(await db().shop.findUnique({ where: { slug } }));
    res.json({ success: true, data: { slug, available: !taken } });
  } catch (error) {
    next(error);
  }
});

// Berber kendi dukkanini/markasini olusturur (14 gun deneme).
router.post("/register-shop", limiter, async (req, res, next) => {
  try {
    const shopName = cleanText(req.body.shopName, 60);
    const ownerName = cleanText(req.body.ownerName, 60);
    const email = cleanText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");
    const phone = cleanPhone(req.body.phone);
    const slug = slugify(req.body.slug || shopName);

    if (shopName.length < 2) throw new HttpError(400, "Dükkan adı en az 2 karakter olmalı.");
    if (ownerName.length < 2) throw new HttpError(400, "Adınızı yazın.");
    if (!isEmail(email)) throw new HttpError(400, "Geçerli bir e-posta yazın.");
    if (password.length < 8) throw new HttpError(400, "Şifre en az 8 karakter olmalı.");
    if (req.body.acceptTerms !== true) {
      throw new HttpError(400, "Devam etmek için Kullanım Koşulları ve Aydınlatma Metni'ni kabul et.");
    }
    if (slug.length < 3 || RESERVED_SLUGS.has(slug)) {
      throw new HttpError(400, "Bu dükkan adresi kullanılamaz. Başka bir adres seçin.");
    }
    if (await db().shop.findUnique({ where: { slug } })) {
      throw new HttpError(409, "Bu dükkan adresi alınmış. Başka bir adres seçin.");
    }
    if (await db().user.findUnique({ where: { email } })) {
      throw new HttpError(409, "Bu e-posta ile zaten bir hesap var.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { shop, user } = await db().$transaction(async (tx) => {
      const created = await tx.shop.create({
        data: { slug, name: shopName, phone, whatsapp: phone, trialEndsAt, termsAcceptedAt: new Date() },
      });
      const owner = await tx.user.create({
        data: { email, passwordHash, name: ownerName, role: "OWNER", shopId: created.id },
      });
      for (const [i, s] of DEFAULT_SERVICES.entries()) {
        await tx.service.create({ data: { ...s, shopId: created.id, sortOrder: i } });
      }
      for (const h of DEFAULT_HOURS) {
        await tx.workingHour.create({ data: { ...h, shopId: created.id } });
      }
      return { shop: created, user: owner };
    });

    res.status(201).json({
      success: true,
      data: { token: signToken(user), user: publicUser(user), shop: ownerShop(shop) },
    });
  } catch (error) {
    next(error);
  }
});

// Satis demosu: ziyaretci sifresiz olarak demo dukkanin paneline girer.
router.post("/demo", rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), async (req, res, next) => {
  try {
    const shop = await db().shop.findFirst({ where: { isDemo: true } });
    if (!shop) throw new HttpError(404, "Demo şu an hazır değil.");
    const user = await db().user.findFirst({ where: { shopId: shop.id, role: "OWNER" } });
    if (!user) throw new HttpError(404, "Demo şu an hazır değil.");
    res.json({ success: true, data: { token: signToken(user), user: publicUser(user), shop: ownerShop(shop) } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", limiter, async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");
    const user = email ? await db().user.findUnique({ where: { email } }) : null;
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new HttpError(401, "E-posta veya şifre hatalı.");
    const shop = user.shopId ? await db().shop.findUnique({ where: { id: user.shopId } }) : null;
    res.json({
      success: true,
      data: { token: signToken(user), user: publicUser(user), shop: shop ? ownerShop(shop) : null },
    });
  } catch (error) {
    next(error);
  }
});

// Sifre degistirme (sahip, calisan, yonetici)
router.post("/password", requireAuth, limiter, async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || "");
    const next_ = String(req.body.newPassword || "");
    if (!(await bcrypt.compare(current, req.user.passwordHash))) throw new HttpError(400, "Mevcut şifre hatalı.");
    const min = req.user.role === "PLATFORM_ADMIN" ? 10 : 8;
    if (next_.length < min) throw new HttpError(400, `Yeni şifre en az ${min} karakter olmalı.`);
    if (next_ === current) throw new HttpError(400, "Yeni şifre eskisiyle aynı olamaz.");
    const shop = req.user.shopId ? await db().shop.findUnique({ where: { id: req.user.shopId } }) : null;
    if (shop && shop.isDemo) throw new HttpError(403, "Demo hesabın şifresi değiştirilemez.");
    await db().user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(next_, 10) } });
    res.json({ success: true, data: { changed: true } });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const shop = req.user.shopId
      ? await db().shop.findUnique({ where: { id: req.user.shopId } })
      : null;
    res.json({ success: true, data: { user: publicUser(req.user), shop: shop ? ownerShop(shop) : null } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
