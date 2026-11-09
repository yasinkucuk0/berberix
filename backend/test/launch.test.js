// Yayina hazirlik: KVKK onaylari, kampanya izni karari ve satis demosu. Calistir: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const db = global.__TEST_DB__;
const { createApp } = require("../src/app");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");
const { marketingAllowed } = require("../src/decisions/customer");
const { seedDemo } = require("../src/lib/demo");

let base;
let server;
test.before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
function nextOpenDate(offset = 1) {
  let d = addDays(localNow().date, offset);
  while (dayOfWeek(d) === 6) d = addDays(d, 1);
  return d;
}
const ctx = {};

test("kayit: kullanim kosullari onayi zorunlu", async () => {
  const base = { shopName: "Kvkk Berber", slug: "kvkk-berber", ownerName: "Yasin", email: "k@test.com", password: "gizli1234" };
  const no = await call("POST", "/auth/register-shop", base);
  assert.equal(no.status, 400);
  assert.match(no.body.message, /Kullanım Koşulları/);
  const ok = await call("POST", "/auth/register-shop", { ...base, acceptTerms: true });
  assert.equal(ok.status, 201);
  ctx.t = ok.body.data.token;
  assert.ok(db._tables.shop[0].termsAcceptedAt);
  assert.equal((await call("GET", "/auth/slug-check?slug=kvkk")).body.data.available, false);
});

test("online randevu: aydinlatma onayi zorunlu, kampanya izni istege bagli", async () => {
  const svc = (await call("GET", "/public/shops/kvkk-berber")).body.data.services[0].id;
  const body = { serviceId: svc, date: nextOpenDate(), time: "10:00", customerName: "Ali", customerPhone: "05551112233" };
  const no = await call("POST", "/public/shops/kvkk-berber/appointments", body);
  assert.equal(no.status, 400);
  assert.match(no.body.message, /Aydınlatma/);
  const ok = await call("POST", "/public/shops/kvkk-berber/appointments", { ...body, kvkk: true, marketingConsent: true });
  assert.equal(ok.status, 201);
  const row = db._tables.appointment.find((a) => a.id === ok.body.data.id);
  assert.ok(row.kvkkAcceptedAt);
  assert.equal(row.marketingConsent, true);
});

test("kampanya izni karari: en son cevap gecerli, elle eklenen randevu izin sayilmaz", () => {
  const t = (d) => new Date(`2026-01-0${d}T10:00:00Z`);
  assert.equal(marketingAllowed([]), false);
  assert.equal(marketingAllowed([{ kvkkAcceptedAt: null, marketingConsent: true }]), false);
  assert.equal(marketingAllowed([{ kvkkAcceptedAt: t(1), marketingConsent: true }]), true);
  assert.equal(marketingAllowed([
    { kvkkAcceptedAt: t(1), marketingConsent: true }, { kvkkAcceptedAt: t(2), marketingConsent: false },
  ]), false);
});

test("berber izni geri alabilir ama veremez", async () => {
  const list = await call("GET", "/shop/customers", null, ctx.t);
  assert.equal(list.body.data.customers[0].marketingConsent, true);
  assert.equal((await call("PUT", "/shop/customers/5551112233/consent", { marketingConsent: true }, ctx.t)).status, 400);
  assert.equal((await call("PUT", "/shop/customers/5551112233/consent", { marketingConsent: false }, ctx.t)).status, 200);
  const detail = await call("GET", "/shop/customers/5551112233", null, ctx.t);
  assert.equal(detail.body.data.marketingConsent, false);
});

test("demo: once yok, yonetici olusturur, ziyaretci panele girer", async () => {
  assert.equal((await call("POST", "/auth/demo")).status, 404);
  const admin = await call("POST", "/admin/setup", { email: "adm@test.com", password: "yonetici12345" });
  assert.equal((await call("POST", "/admin/demo/reset", null, ctx.t)).status, 403); // dukkan sahibi yapamaz
  const r = await call("POST", "/admin/demo/reset", null, admin.body.data.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.data.appointments > 80);

  const demo = await call("POST", "/auth/demo");
  assert.equal(demo.status, 200);
  assert.equal(demo.body.data.shop.isDemo, true);
  const dt = demo.body.data.token;
  // panel dolu gelir
  const customers = await call("GET", "/shop/customers", null, dt);
  assert.ok(customers.body.data.total >= 20);
  assert.ok(customers.body.data.counts.KAYIP_RISKI >= 1);
  const cash = await call("GET", `/shop/cash/report?to=${localNow().date}`, null, dt);
  assert.ok(cash.body.data.total.income > 0);
  assert.equal((await call("GET", "/shop/barbers", null, dt)).body.data.length, 3);
  const pub = await call("GET", "/public/shops/demo-berber");
  assert.equal(pub.status, 200);
  assert.ok(pub.body.data.acceptingBookings);
  // marka degistirilemez, ama randevu vb. denenebilir
  assert.equal((await call("PATCH", "/shop", { name: "Hack" }, dt)).status, 403);
  // demo verisi diger dukkana sizmaz
  assert.equal((await call("GET", "/shop/customers", null, ctx.t)).body.data.total, 1);
});

test("demo sifirlama tekrar calisir ve temiz baslar", async () => {
  const before = db._tables.appointment.length;
  await seedDemo(db);
  assert.equal(db._tables.shop.filter((s) => s.slug === "demo-berber").length, 1);
  assert.equal(db._tables.appointment.length, before);
});
