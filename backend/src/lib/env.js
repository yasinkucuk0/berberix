// .env yoksa gelistirme icin guvenli varsayilanlarla olusturur (rastgele JWT anahtari).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENV_PATH = path.join(__dirname, "..", "..", ".env");

function ensureEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    const secret = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(
      ENV_PATH,
      [
        `JWT_SECRET="${secret}"`,
        "PORT=5100",
        'CLIENT_ORIGIN="http://localhost:5174"',
        "",
      ].join("\n"),
      "utf8"
    );
  }
  require("dotenv").config({ path: ENV_PATH });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET eksik ya da çok kısa (.env)");
  }
}

module.exports = { ensureEnv, ENV_PATH };
