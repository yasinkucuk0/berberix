// Ortam degiskenleri.
// Gelistirme: .env yoksa rastgele JWT anahtariyla otomatik olusturulur.
// Canli (NODE_ENV=production): degiskenler barindirma panelinden gelir, dosya yazilmaz.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENV_PATH = path.join(__dirname, "..", "..", ".env");
const isProduction = () => process.env.NODE_ENV === "production";

function ensureEnv() {
  if (!isProduction() && !fs.existsSync(ENV_PATH)) {
    const secret = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(
      ENV_PATH,
      [`JWT_SECRET="${secret}"`, "PORT=5100", 'CLIENT_ORIGIN="http://localhost:5174"', ""].join("\n"),
      "utf8"
    );
  }
  if (fs.existsSync(ENV_PATH)) require("dotenv").config({ path: ENV_PATH });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET eksik ya da çok kısa");
  }
  if (isProduction() && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL eksik (canlı veritabanı adresi)");
  }
}

module.exports = { ensureEnv, ENV_PATH, isProduction };
