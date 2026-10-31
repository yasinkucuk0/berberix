const TR = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };

const RESERVED_SLUGS = new Set([
  "api", "admin", "yonetim", "panel", "giris", "kayit", "cikis", "assets", "static",
  "berberim", "destek", "hakkinda", "fiyatlar", "iletisim", "sw", "manifest", "icons",
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function slugify(text) {
  return String(text || "")
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function cleanText(value, max = 200) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || ""));
}

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 16);
}

function isColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || ""));
}

// URL/govde kimligi: pozitif tamsayi degilse 404 (Prisma'ya NaN gitmesin)
function idOf(value, what = "Kayıt") {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, `${what} bulunamadı.`);
  return n;
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

// "09:30" -> 570
function toMinutes(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

function fromMinutes(total) {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// 0 = Pazartesi ... 6 = Pazar
function dayOfWeek(dateStr) {
  const js = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return (js + 6) % 7;
}

// Dukkan yerel saati (Turkiye, UTC+3, yaz saati yok)
function localNow(now = new Date()) {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  HttpError, RESERVED_SLUGS, slugify, cleanText, isEmail, cleanPhone, isColor, toInt, idOf,
  toMinutes, fromMinutes, isDate, dayOfWeek, localNow, addDays,
};
