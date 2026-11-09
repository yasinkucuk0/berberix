const { toMinutes, fromMinutes, dayOfWeek, localNow } = require("./util");

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

// Bos saatleri hesaplar. appointments: o gunun aktif randevulari.
// closedDates: dukkanin ozel kapali gunleri (bayram, tatil). day.breakStart/breakEnd: ogle arasi.
function computeSlots({ date, hours, appointments, duration, step, now = new Date(), closedDates = [] }) {
  if (closedDates.includes(date)) return [];
  const day = hours.find((h) => h.dayOfWeek === dayOfWeek(date));
  if (!day || !day.isOpen) return [];

  const open = toMinutes(day.openTime);
  const close = toMinutes(day.closeTime);
  if (Number.isNaN(open) || Number.isNaN(close) || close <= open) return [];

  const local = localNow(now);
  if (date < local.date) return [];
  const earliest = date === local.date ? local.minutes + 15 : 0; // en az 15 dk sonrasi

  const busy = appointments
    .filter((a) => ACTIVE_STATUSES.includes(a.status))
    .map((a) => [a.startMinutes, a.endMinutes]);
  const bStart = toMinutes(day.breakStart);
  const bEnd = toMinutes(day.breakEnd);
  if (!Number.isNaN(bStart) && !Number.isNaN(bEnd) && bEnd > bStart) busy.push([bStart, bEnd]);

  const slots = [];
  for (let start = open; start + duration <= close; start += step) {
    if (start < earliest) continue;
    const end = start + duration;
    const clash = busy.some(([s, e]) => start < e && end > s);
    if (!clash) slots.push(fromMinutes(start));
  }
  return slots;
}

function overlaps(appointments, start, end) {
  return appointments.some(
    (a) => ACTIVE_STATUSES.includes(a.status) && start < a.endMinutes && end > a.startMinutes
  );
}

// ---------- Calisanlar (berber bazli takvim) ----------
function offDaysOf(barber) {
  return String(barber.offDays || "").split(",").filter((x) => x !== "").map(Number);
}

function worksOn(barber, date) {
  return barber.isActive !== false && !offDaysOf(barber).includes(dayOfWeek(date));
}

// Bir berberi mesgul eden randevular: kendisininkiler + kimseye atanmamis eski kayitlar (guvenli taraf).
function busyFor(appointments, barberId) {
  return appointments.filter((a) => a.barberId == null || a.barberId === barberId);
}

// barbers bos -> dukkan tek koltuk (eski davranis).
// barberId verilirse sadece o berber; verilmezse calisan herhangi bir berber bos ise saat bostur.
// Donus: { slots: ["09:00", ...], freeBy: { "09:00": [barberId, ...] } | null }
function barberSlots({ date, hours, appointments, duration, step, barbers, barberId, now, closedDates }) {
  if (!barbers || barbers.length === 0) {
    return { slots: computeSlots({ date, hours, appointments, duration, step, now, closedDates }), freeBy: null };
  }
  const pool = barbers.filter((b) => worksOn(b, date) && (barberId == null || b.id === barberId));
  const freeBy = {};
  for (const b of pool) {
    for (const slot of computeSlots({ date, hours, appointments: busyFor(appointments, b.id), duration, step, now, closedDates })) {
      (freeBy[slot] = freeBy[slot] || []).push(b.id);
    }
  }
  const slots = Object.keys(freeBy).sort();
  return { slots, freeBy };
}

module.exports = {
  computeSlots, overlaps, ACTIVE_STATUSES, offDaysOf, worksOn, busyFor, barberSlots,
};
