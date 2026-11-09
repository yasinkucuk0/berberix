// Musteriler (CRM) ve Kasa testleri. Calistir: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const db = global.__TEST_DB__;
const { createApp } = require("../src/app");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");
const { segmentOf, buildProfile } = require("../src/decisions/customer");

let base;
let server;
test.before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

async function call(method, path, body, token) {
  // Formlardaki zorunlu onay kutulari (KVKK / kullanim kosullari) testlerde varsayilan olarak isaretli
  if (body && /\/public\/shops\/[^/]+\/appointments$/.test(path) && body.kvkk === undefined) body = { ...body, kvkk: true };
  if (body && path === "/auth/register-shop" && body.acceptTerms === undefined) body = { ...body, acceptTerms: true };
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const today = localNow().date;
function nextOpenDate(offset = 1) {
  let d = addDays(today, offset);
  while (dayOfWeek(d) === 6) d = addDays(d, 1);
  return d;
}
const ctx = {};

test("hazirlik: iki dukkan", async () => {
  const a = await call("POST", "/auth/register-shop", { shopName: "Kasa Berber", slug: "kasa", ownerName: "Yasin", email: "a@test.com", password: "gizli1234" });
  const b = await call("POST", "/auth/register-shop", { shopName: "Öteki", slug: "oteki", ownerName: "Ozan", email: "b@test.com", password: "gizli1234" });
  ctx.a = a.body.data.token;
  ctx.b = b.body.data.token;
  ctx.svc = (await call("GET", "/shop/services", null, ctx.a)).body.data[0];
});

test("segment karari: kayip riski 45 gun", () => {
  const old = [{ status: "COMPLETED", date: addDays(today, -60), endMinutes: 600 }];
  assert.equal(segmentOf(buildProfile(old)), "KAYIP_RISKI");
  const recent = [{ status: "COMPLETED", date: addDays(today, -10), endMinutes: 600 }];
  assert.equal(segmentOf(buildProfile(recent)), "DUZENLI");
  const back = [...old, { status: "CONFIRMED", date: addDays(today, 3), endMinutes: 600 }];
  assert.notEqual(segmentOf(buildProfile(back)), "KAYIP_RISKI"); // yeni randevusu var
});

test("randevu tamamlaninca kasaya gelir yazilir, geri alininca silinir", async () => {
  const r = await call("POST", "/shop/appointments", {
    serviceId: ctx.svc.id, date: today, time: "23:00", customerName: "Ali Kaya", customerPhone: "05551112233",
  }, ctx.a);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  ctx.appt = r.body.data.id;
  await call("PATCH", `/shop/appointments/${ctx.appt}`, { status: "COMPLETED", paymentMethod: "CARD" }, ctx.a);
  let day = await call("GET", `/shop/cash?date=${today}`, null, ctx.a);
  assert.equal(day.body.data.summary.income, ctx.svc.price);
  assert.equal(day.body.data.summary.byMethod.CARD, ctx.svc.price);
  assert.equal(day.body.data.entries[0].auto, true);
  // ayni randevu tekrar tamamlandi -> cift kayit olmaz
  await call("PATCH", `/shop/appointments/${ctx.appt}`, { status: "COMPLETED", paymentMethod: "CASH" }, ctx.a);
  day = await call("GET", `/shop/cash?date=${today}`, null, ctx.a);
  assert.equal(day.body.data.entries.length, 1);
  assert.equal(day.body.data.summary.byMethod.CASH, ctx.svc.price);
  // otomatik kayit elle silinemez
  assert.equal((await call("DELETE", `/shop/cash/${day.body.data.entries[0].id}`, null, ctx.a)).status, 400);
  // iptal -> kasadan duser
  await call("PATCH", `/shop/appointments/${ctx.appt}`, { status: "CANCELLED" }, ctx.a);
  day = await call("GET", `/shop/cash?date=${today}`, null, ctx.a);
  assert.equal(day.body.data.entries.length, 0);
  await call("PATCH", `/shop/appointments/${ctx.appt}`, { status: "COMPLETED" }, ctx.a);
});

test("elle satis ve gider; gecersiz girisler reddedilir", async () => {
  const sale = await call("POST", "/shop/cash", { type: "INCOME", category: "Ürün satışı", amount: 250, method: "CASH", note: "Wax" }, ctx.a);
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  const rent = await call("POST", "/shop/cash", { type: "EXPENSE", category: "Malzeme", amount: 100 }, ctx.a);
  assert.equal(rent.status, 201);
  assert.equal((await call("POST", "/shop/cash", { type: "INCOME", category: "Kira", amount: 5 }, ctx.a)).status, 400);
  assert.equal((await call("POST", "/shop/cash", { type: "EXPENSE", category: "Kira", amount: -5 }, ctx.a)).status, 400);
  assert.equal((await call("POST", "/shop/cash", { type: "EXPENSE", category: "Kira", amount: 5, date: addDays(today, 3) }, ctx.a)).status, 400);
  const day = await call("GET", "/shop/cash", null, ctx.a);
  assert.equal(day.body.data.summary.income, ctx.svc.price + 250);
  assert.equal(day.body.data.summary.expense, 100);
  assert.equal(day.body.data.summary.net, ctx.svc.price + 150);
  const rep = await call("GET", `/shop/cash/report?from=${addDays(today, -6)}&to=${today}`, null, ctx.a);
  assert.equal(rep.body.data.days.length, 7);
  assert.equal(rep.body.data.total.net, ctx.svc.price + 150);
  assert.equal((await call("DELETE", `/shop/cash/${rent.body.data.id}`, null, ctx.a)).status, 200);
});

test("KIRACI IZOLASYONU: kasa ve musteriler baska dukkana kapali", async () => {
  const other = await call("GET", "/shop/cash", null, ctx.b);
  assert.equal(other.body.data.entries.length, 0);
  const aEntries = (await call("GET", "/shop/cash", null, ctx.a)).body.data.entries;
  assert.equal((await call("DELETE", `/shop/cash/${aEntries[0].id}`, null, ctx.b)).status, 404);
  assert.equal((await call("GET", "/shop/customers", null, ctx.b)).body.data.total, 0);
  assert.equal((await call("GET", "/shop/customers/5551112233", null, ctx.b)).status, 404);
  assert.equal((await call("PUT", "/shop/customers/5551112233/note", { note: "x" }, ctx.b)).status, 404);
});

test("musteri listesi, arama, detay ve not", async () => {
  // eski musteri: 60 gun once gelmis (dogrudan veritabanina)
  const shopId = db._tables.shop.find((s) => s.slug === "kasa").id;
  await db.appointment.create({ data: {
    shopId, serviceId: ctx.svc.id, serviceName: "Saç Kesimi", price: 300, customerName: "Eski Müşteri",
    customerPhone: "05440001122", customerKey: "5440001122", date: addDays(today, -60), startMinutes: 600, endMinutes: 630, status: "COMPLETED",
  } });
  const list = await call("GET", "/shop/customers", null, ctx.a);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.total, 2);
  assert.equal(list.body.data.counts.KAYIP_RISKI, 1);
  const lost = await call("GET", "/shop/customers?segment=KAYIP_RISKI", null, ctx.a);
  assert.equal(lost.body.data.customers[0].name, "Eski Müşteri");
  assert.equal((await call("GET", "/shop/customers?segment=YOK", null, ctx.a)).status, 400);
  const search = await call("GET", "/shop/customers?q=ali", null, ctx.a);
  assert.equal(search.body.data.customers.length, 1);
  const byPhone = await call("GET", "/shop/customers?q=0001122", null, ctx.a);
  assert.equal(byPhone.body.data.customers[0].key, "5440001122");

  const note = await call("PUT", "/shop/customers/5551112233/note", { note: "Yanlardan 2 numara" }, ctx.a);
  assert.equal(note.status, 200);
  const detail = await call("GET", "/shop/customers/5551112233", null, ctx.a);
  assert.equal(detail.body.data.note, "Yanlardan 2 numara");
  assert.equal(detail.body.data.profile.completed, 1);
  assert.equal(detail.body.data.spent, ctx.svc.price);
  assert.equal(detail.body.data.history.length, 1);
  assert.equal((await call("GET", "/shop/customers/abc", null, ctx.a)).status, 404);
});

test("asistan: geri kazanim onerisi", async () => {
  const ins = await call("GET", "/shop/decisions/insights", null, ctx.a);
  const card = ins.body.data.find((c) => c.code === "GERI_KAZAN");
  assert.ok(card, JSON.stringify(ins.body.data.map((c) => c.code)));
  assert.equal(card.action, "musteri");
});

test("telefonla profil hala calisir", async () => {
  const p = await call("GET", "/shop/customers/profile?phone=0555 111 22 33", null, ctx.a);
  assert.equal(p.status, 200);
  assert.equal(p.body.data.completed, 1);
});
