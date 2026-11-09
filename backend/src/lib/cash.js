// Kasa yardimcilari.
const { db } = require("./db");

const METHODS = ["CASH", "CARD", "TRANSFER"];
const INCOME_CATEGORIES = ["Hizmet", "Ürün satışı", "Bahşiş", "Diğer"];
const EXPENSE_CATEGORIES = ["Kira", "Malzeme", "Fatura", "Maaş", "Diğer"];

// Randevu tamamlaninca kasaya gelir yazar; tamamlandi'dan cikinca geri alir.
async function syncAppointmentCash(appointment, method = "CASH") {
  if (appointment.status === "COMPLETED") {
    const existing = await db().cashEntry.findFirst({ where: { shopId: appointment.shopId, appointmentId: appointment.id } });
    const data = {
      date: appointment.date, amount: appointment.price, method: METHODS.includes(method) ? method : "CASH",
      note: `${appointment.customerName} • ${appointment.serviceName}`,
    };
    if (existing) return db().cashEntry.update({ where: { id: existing.id }, data });
    return db().cashEntry.create({
      data: { ...data, shopId: appointment.shopId, type: "INCOME", category: "Hizmet", appointmentId: appointment.id },
    });
  }
  await db().cashEntry.deleteMany({ where: { shopId: appointment.shopId, appointmentId: appointment.id } });
  return null;
}

function summarize(entries) {
  const sum = (list) => list.reduce((s, e) => s + e.amount, 0);
  const income = entries.filter((e) => e.type === "INCOME");
  const expense = entries.filter((e) => e.type === "EXPENSE");
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, sum(income.filter((e) => e.method === m))]));
  const byCategory = {};
  for (const e of entries) {
    const k = `${e.type}:${e.category}`;
    byCategory[k] = (byCategory[k] || 0) + e.amount;
  }
  return { income: sum(income), expense: sum(expense), net: sum(income) - sum(expense), byMethod, byCategory };
}

function formatEntry(e) {
  return {
    id: e.id, date: e.date, type: e.type, category: e.category, amount: e.amount, method: e.method,
    note: e.note, auto: e.appointmentId != null, createdAt: e.createdAt,
  };
}

module.exports = { METHODS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, syncAppointmentCash, summarize, formatEntry };
