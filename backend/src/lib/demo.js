// SATIS DEMOSU: icinde gercekci veri olan "Demo Berber" dukkanini (yeniden) olusturur.
// Yonetim panelinden "Demo'yu sifirla" ile calisir; ziyaretciler /api/auth/demo ile paneli dener.
// Sabit tohumlu rastgelelik: her sifirlamada ayni guzel tablo cikar.
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { localNow, addDays, dayOfWeek } = require("./util");
const { DEFAULT_HOURS } = require("./shop");
const { customerKey } = require("../decisions/customer");

const DEMO_SLUG = "demo-berber";
const DEMO_EMAIL = "demo@berberix.app";

const SERVICES = [
  { name: "Saç Kesimi", price: 350, durationMinutes: 30, description: "Yıkama + fön dahil" },
  { name: "Sakal Tıraşı", price: 200, durationMinutes: 20, description: "Sıcak havlu ile" },
  { name: "Saç + Sakal", price: 500, durationMinutes: 45, description: "En çok tercih edilen" },
  { name: "Çocuk Tıraşı", price: 250, durationMinutes: 20, description: "12 yaş altı" },
  { name: "Cilt Bakımı", price: 400, durationMinutes: 30, description: "Siyah maske + buhar" },
];
const BARBERS = [
  { name: "Yasin", title: "Usta", offDays: "6" },
  { name: "Emre", title: "Kalfa", offDays: "0" },
  { name: "Mert", title: "Kalfa", offDays: "2" },
];
const NAMES = [
  "Ahmet Yılmaz", "Mehmet Kaya", "Mustafa Demir", "Ali Çelik", "Hüseyin Şahin", "Hasan Yıldız", "İbrahim Öztürk",
  "Emre Aydın", "Burak Arslan", "Murat Doğan", "Ömer Kılıç", "Can Aslan", "Serkan Koç", "Oğuz Kurt", "Kerem Özdemir",
  "Furkan Polat", "Yusuf Erdoğan", "Enes Güneş", "Berk Aktaş", "Onur Yalçın", "Tolga Bulut", "Selim Korkmaz",
  "Kaan Tekin", "Barış Uçar", "Cem Avcı", "Okan Şen",
];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function removeDemo(client) {
  const old = await client.shop.findUnique({ where: { slug: DEMO_SLUG } });
  if (!old) return;
  const where = { shopId: old.id };
  // Iliskili kayitlar once (canlida cascade da var; test veritabani icin acikca siliyoruz)
  await client.cashEntry.deleteMany({ where });
  await client.decisionLog.deleteMany({ where });
  await client.customerNote.deleteMany({ where });
  await client.appointment.deleteMany({ where });
  await client.barber.deleteMany({ where });
  await client.service.deleteMany({ where });
  await client.workingHour.deleteMany({ where });
  await client.closedDay.deleteMany({ where });
  await client.user.deleteMany({ where });
  await client.shop.delete({ where: { id: old.id } });
}

async function seedDemo(client, now = new Date()) {
  await removeDemo(client);
  const random = rng(20261109);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const today = localNow(now).date;

  const shop = await client.shop.create({
    data: {
      slug: DEMO_SLUG, name: "Demo Berber", phone: "05000000000", whatsapp: "", city: "İstanbul",
      address: "Örnek Mah. Demo Sok. No:1", about: "BERBERİX demo dükkanı. Paneli dilediğin gibi dene!",
      primaryColor: "#c9a24b", accentColor: "#111111", status: "ACTIVE", plan: "PRO", isDemo: true,
      confirmMode: "TRUSTED", loyaltyEvery: 10, trialEndsAt: now, paidUntil: new Date(now.getTime() + 3650 * 86400000),
      termsAcceptedAt: now,
    },
  });
  await client.user.create({
    data: {
      email: DEMO_EMAIL, name: "Demo Kullanıcı", role: "OWNER", shopId: shop.id,
      passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10), // sifreyle girilemez
    },
  });
  for (const h of DEFAULT_HOURS) await client.workingHour.create({ data: { ...h, shopId: shop.id } });
  const services = [];
  for (const [i, s] of SERVICES.entries()) services.push(await client.service.create({ data: { ...s, shopId: shop.id, sortOrder: i } }));
  const barbers = [];
  for (const [i, b] of BARBERS.entries()) barbers.push(await client.barber.create({ data: { ...b, shopId: shop.id, sortOrder: i } }));

  const customers = NAMES.map((name, i) => {
    const phone = `05${String(320000000 + i * 7919).padStart(9, "0")}`;
    return { name, phone, key: customerKey(phone), consent: random() < 0.6, flaky: i % 9 === 4 };
  });

  // Son 30 gun + onumuzdeki 2 gun. Her gun her berbere 3-6 randevu.
  const slotsTaken = new Set();
  const cash = []; // kasa kayitlari sonda tek seferde yazilir (canli veritabaninda hiz icin)
  let created = 0;
  for (let offset = -30; offset <= 2; offset += 1) {
    const date = addDays(today, offset);
    const dow = dayOfWeek(date);
    if (dow === 6) continue; // Pazar kapali
    for (const barber of barbers) {
      if (barber.offDays.split(",").includes(String(dow))) continue;
      const count = 3 + Math.floor(random() * 4);
      for (let n = 0; n < count; n += 1) {
        const start = 9 * 60 + Math.floor(random() * 20) * 30; // 09:00 - 18:30
        const slot = `${date}|${barber.id}|${start}`;
        if (slotsTaken.has(slot)) continue;
        slotsTaken.add(slot);
        // Bazi musteriler 50+ gundur gelmiyor (geri kazanim ornegi): son 45 gunde randevusu yok
        const pool = customers.slice(0, offset > -45 ? 22 : customers.length);
        const c = pick(pool);
        const service = pick(services);
        const end = start + service.durationMinutes;
        let status = "COMPLETED";
        if (offset > 0 || (offset === 0 && start > localNow(now).minutes)) status = random() < 0.8 ? "CONFIRMED" : "PENDING";
        else if (c.flaky && random() < 0.6) status = "NO_SHOW";
        else if (random() < 0.05) status = "CANCELLED";
        const appt = await client.appointment.create({
          data: {
            shopId: shop.id, serviceId: service.id, serviceName: service.name, price: service.price,
            barberId: barber.id, barberName: barber.name, customerName: c.name, customerPhone: c.phone, customerKey: c.key,
            date, startMinutes: start, endMinutes: end, status, decidedBy: random() < 0.5 ? "AUTO" : "",
            kvkkAcceptedAt: now, marketingConsent: c.consent,
          },
        });
        created += 1;
        if (status === "COMPLETED") {
          cash.push({
            shopId: shop.id, date, type: "INCOME", category: "Hizmet", amount: service.price,
            method: random() < 0.55 ? "CARD" : "CASH", note: `${c.name} • ${service.name}`, appointmentId: appt.id,
          });
        }
      }
    }
    if (offset <= 0 && dow !== 6) {
      if (random() < 0.5) {
        cash.push({ shopId: shop.id, date, type: "INCOME", category: "Ürün satışı", amount: 150 + Math.floor(random() * 4) * 50, method: "CASH", note: "Wax / şampuan" });
      }
      if (random() < 0.25) {
        cash.push({ shopId: shop.id, date, type: "EXPENSE", category: "Malzeme", amount: 200 + Math.floor(random() * 6) * 50, method: "CASH", note: "Jilet, havlu" });
      }
    }
  }
  // 50+ gun once gelip sonra kaybolan musteriler (geri kazanim)
  for (const c of customers.slice(22)) {
    const service = services[0];
    await client.appointment.create({
      data: {
        shopId: shop.id, serviceId: service.id, serviceName: service.name, price: service.price,
        barberId: barbers[0].id, barberName: barbers[0].name, customerName: c.name, customerPhone: c.phone, customerKey: c.key,
        date: addDays(today, -55), startMinutes: 600, endMinutes: 630, status: "COMPLETED",
        kvkkAcceptedAt: now, marketingConsent: true,
      },
    });
    created += 1;
  }
  await client.cashEntry.createMany({ data: cash });
  await client.customerNote.create({ data: { shopId: shop.id, customerKey: customers[0].key, note: "Yanlar 2 numara, üstten makasla. Çay şekersiz." } });
  return { shopId: shop.id, slug: DEMO_SLUG, appointments: created };
}

module.exports = { seedDemo, removeDemo, DEMO_SLUG, DEMO_EMAIL };
