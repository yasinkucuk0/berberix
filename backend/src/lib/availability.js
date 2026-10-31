const { toMinutes, fromMinutes, dayOfWeek, localNow } = require("./util");

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

// Bos saatleri hesaplar. appointments: o gunun aktif randevulari.
function computeSlots({ date, hours, appointments, duration, step, now = new Date() }) {
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

module.exports = { computeSlots, overlaps, ACTIVE_STATUSES };
