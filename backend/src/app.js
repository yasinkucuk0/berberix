const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const shopRoutes = require("./routes/shop");
const adminRoutes = require("./routes/admin");
const crmRoutes = require("./routes/crm");
const cashRoutes = require("./routes/cash");
const staffRoutes = require("./routes/staff");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Canlida (Render vb.) istekler vekil sunucudan gelir; gercek IP icin.
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

  // Gelistirmede yerel adresler + ag icindeki telefon; uretimde CLIENT_ORIGIN.
  const allowed = String(process.env.CLIENT_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, cb) {
      if (!origin || allowed.includes(origin)
        || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.get("/api/health", (req, res) => res.json({ success: true, message: "BERBERİX API çalışıyor" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/shop/customers", crmRoutes);
  app.use("/api/shop/cash", cashRoutes);
  app.use("/api/shop/barbers", staffRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/admin", adminRoutes);

  app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Adres bulunamadı." }));

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    const status = error.status || (error.type === "entity.too.large" ? 413 : 500);
    if (status >= 500) console.error(error);
    res.status(status).json({
      success: false,
      message: status >= 500 ? "Sunucu hatası. Lütfen tekrar deneyin." : error.message,
    });
  });

  return app;
}

module.exports = { createApp };
