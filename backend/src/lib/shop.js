const { fromMinutes } = require("./util");

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const DEFAULT_SERVICES = [
  { name: "Saç Kesimi", price: 300, durationMinutes: 30 },
  { name: "Sakal Tıraşı", price: 150, durationMinutes: 20 },
  { name: "Saç + Sakal", price: 400, durationMinutes: 45 },
];

const DEFAULT_HOURS = Array.from({ length: 7 }, (_, day) => ({
  dayOfWeek: day,
  isOpen: day !== 6, // Pazar kapali
  openTime: "09:00",
  closeTime: "20:00",
}));

// Dukkan musteri kabul ediyor mu? (deneme suresi / abonelik / askiya alma)
function shopAccess(shop, now = new Date()) {
  if (shop.status === "SUSPENDED") return { open: false, reason: "Dükkan askıya alınmış." };
  if (shop.status === "TRIAL") {
    return new Date(shop.trialEndsAt) > now
      ? { open: true, reason: "" }
      : { open: false, reason: "Deneme süresi bitti." };
  }
  if (shop.status === "ACTIVE") {
    if (shop.paidUntil && new Date(shop.paidUntil) < now) {
      return { open: false, reason: "Abonelik süresi doldu." };
    }
    return { open: true, reason: "" };
  }
  return { open: false, reason: "Dükkan aktif değil." };
}

function publicShop(shop) {
  return {
    slug: shop.slug,
    name: shop.name,
    phone: shop.phone,
    whatsapp: shop.whatsapp,
    address: shop.address,
    city: shop.city,
    about: shop.about,
    logo: shop.logo,
    primaryColor: shop.primaryColor,
    accentColor: shop.accentColor,
  };
}

function ownerShop(shop) {
  const access = shopAccess(shop);
  return {
    ...publicShop(shop),
    id: shop.id,
    slotMinutes: shop.slotMinutes,
    status: shop.status,
    plan: shop.plan,
    trialEndsAt: shop.trialEndsAt,
    paidUntil: shop.paidUntil,
    acceptingBookings: access.open,
    accessReason: access.reason,
    confirmMode: shop.confirmMode,
    isDemo: Boolean(shop.isDemo),
  };
}

function publicUser(user) {
  return {
    id: user.id, email: user.email, name: user.name, role: user.role, shopId: user.shopId, barberId: user.barberId ?? null,
  };
}

function formatAppointment(a) {
  return {
    id: a.id,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
    barberId: a.barberId ?? null,
    barberName: a.barberName || "",
    price: a.price,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    note: a.note,
    date: a.date,
    start: fromMinutes(a.startMinutes),
    end: fromMinutes(a.endMinutes),
    status: a.status,
    decidedBy: a.decidedBy || "",
    cancelledBy: a.cancelledBy || "",
    loyaltyReward: Boolean(a.loyaltyReward),
    createdAt: a.createdAt,
  };
}

module.exports = {
  DAY_NAMES, DEFAULT_SERVICES, DEFAULT_HOURS, shopAccess, publicShop, ownerShop,
  publicUser, formatAppointment,
};
