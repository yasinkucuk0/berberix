const jwt = require("jsonwebtoken");
const { db } = require("../lib/db");
const { HttpError } = require("../lib/util");

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, shopId: user.shopId ?? null },
    process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Token dogrulanir VE kullanici veritabanindan tekrar okunur:
// silinmis/yetkisi degismis kullanici eski tokenla giremez.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Giriş yapmanız gerekiyor.");
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new HttpError(401, "Oturum süresi doldu. Lütfen tekrar giriş yapın.");
    }
    const user = await db().user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) throw new HttpError(401, "Kullanıcı bulunamadı.");
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, "Bu işlem için yetkiniz yok."));
    }
    next();
  };
}

// Dukkan paneli: shopId HER ZAMAN kullanicidan gelir, istekten asla.
function requireShop(req, res, next) {
  if (!req.user || !req.user.shopId || !["OWNER", "STAFF"].includes(req.user.role)) {
    return next(new HttpError(403, "Dükkan hesabı gerekli."));
  }
  req.shopId = req.user.shopId;
  next();
}

// Sadece dukkan sahibi (kasa, musteriler, asistan, ayarlar). Calisan (STAFF) giremez.
function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== "OWNER") return next(new HttpError(403, "Bu bölüm sadece dükkan sahibine açık."));
  next();
}

// Calisan girisi: sadece kendi berberinin randevulari. Sahip icin null doner.
function staffBarberId(req) {
  if (req.user.role !== "STAFF") return null;
  if (!req.user.barberId) throw new HttpError(403, "Hesabın bir berbere bağlı değil. Dükkan sahibine sor.");
  return req.user.barberId;
}

// Basit bellek ici hiz siniri (giris / kayit / randevu icin)
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    if (list.length > max) return next(new HttpError(429, message || "Çok fazla deneme. Biraz bekleyin."));
    next();
  };
}

module.exports = {
  signToken, requireAuth, requireRole, requireShop, requireOwner, staffBarberId, rateLimit,
};
