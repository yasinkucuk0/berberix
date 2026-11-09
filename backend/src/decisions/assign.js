// BERBER ATAMA KARARI (assign@1): musteri "Fark etmez" deyince randevu hangi berbere yazilsin?
// Kural (aciklanabilir, adil):
//   1. O saatte bos olan berberler adaydir.
//   2. O gun en az dolu (dakika) olan berber secilir -> is yuku dengelenir.
//   3. Esitlikte siralamada once gelen (sortOrder) berber secilir.
// Saf fonksiyon: veritabanina dokunmaz.
const { ACTIVE_STATUSES } = require("../lib/availability");

const POLICY = "assign@1";

function bookedMinutes(appointments, barberId) {
  return appointments
    .filter((a) => a.barberId === barberId && ACTIVE_STATUSES.includes(a.status))
    .reduce((sum, a) => sum + (a.endMinutes - a.startMinutes), 0);
}

// candidates: bos berberler (Barber kayitlari); appointments: o gunun randevulari
function chooseBarber(candidates, appointments) {
  if (!candidates || candidates.length === 0) return null;
  const scored = candidates
    .map((b) => ({ barber: b, load: bookedMinutes(appointments, b.id) }))
    .sort((x, y) => x.load - y.load || (x.barber.sortOrder || 0) - (y.barber.sortOrder || 0) || x.barber.id - y.barber.id);
  const pick = scored[0];
  const reasons = [{
    code: "EN_BOS_BERBER",
    outcome: "ASSIGN",
    message: `Müşteri berber seçmedi; o gün en boş berber ${pick.barber.name} (${pick.load} dk dolu) atandı.`,
  }];
  if (scored.length > 1) {
    reasons.push({
      code: "ADAYLAR",
      outcome: "INFO",
      message: `Adaylar: ${scored.map((s) => `${s.barber.name} ${s.load} dk`).join(", ")}.`,
    });
  }
  return { barber: pick.barber, decision: { policy: POLICY, outcome: "ASSIGN", reasons } };
}

module.exports = { chooseBarber, bookedMinutes, POLICY };
