// Paket sinirlari (plan@1), calisan girisi ve sifre degistirme. Calistir: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const db = global.__TEST_DB__;
const { createApp } = require("../src/app");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");
const { decide } = require("../src/decisions/engine");
const { policy, effectivePlan } = require("../src/decisions/policies/plan");

let base;
let server;
test.before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

async function call(method, path, body, token) {
  if (body && path === "/auth/register-shop" && body.acceptTerms === undefined) body = { ...body, acceptTerms: true };
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

test("paket karari: deneme Pro sayilir, Baslangic 1 berber", () => {
  assert.equal(effectivePlan({ status: "TRIAL", plan: "BASIC" }), "PRO");
  assert.equal(effectivePlan({ status: "ACTIVE", plan: "YOK" }), "BASIC");
  assert.equal(decide(policy, { shop: { status: "ACTIVE", plan: "BASIC" }, activeBarbers: 1 }).outcome, "BLOCK");
  assert.equal(decide(policy, { shop: { status: "ACTIVE", plan: "PRO" }, activeBarbers: 4 }).outcome, "ALLOW");
  assert.equal(decide(policy, { shop: { status: "ACTIVE", plan: "SALON" }, activeBarbers: 99 }).outcome, "ALLOW");
});

test("hazirlik: dukkan, iki berber", async () => {
  const r = await call("POST", "/auth/register-shop", { shopName: "Ekip", slug: "ekip3", ownerName: "Yasin", email: "o@test.com", password: "gizli1234" });
  ctx.t = r.body.data.token;
  ctx.shopId = r.body.data.shop.id;
  ctx.ali = (await call("POST", "/shop/barbers", { name: "Ali" }, ctx.t)).body.data.id;
  ctx.veli = (await call("POST", "/shop/barbers", { name: "Veli" }, ctx.t)).body.data.id;
  ctx.svc = (await call("GET", "/shop/services", null, ctx.t)).body.data[0].id;
});

test("Baslangic paketinde 2. aktif berber engellenir; Pro'ya gecince acilir", async () => {
  const admin = await call("POST", "/admin/setup", { email: "adm@test.com", password: "yonetici12345" });
  ctx.admin = admin.body.data.token;
  assert.equal((await call("PATCH", `/admin/shops/${ctx.shopId}`, { plan: "ALTIN" }, ctx.admin)).status, 400);
  await call("PATCH", `/admin/shops/${ctx.shopId}`, { status: "ACTIVE", plan: "BASIC", extendDays: 30 }, ctx.admin);
  const meta = await call("GET", "/shop/barbers", null, ctx.t);
  assert.equal(meta.body.meta.maxBarbers, 1);
  const blocked = await call("POST", "/shop/barbers", { name: "Can" }, ctx.t);
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.message, /Başlangıç paketinde en fazla 1/);
  // pasifi aktif yapmak da sinira takilir
  await call("PATCH", `/shop/barbers/${ctx.veli}`, { isActive: false }, ctx.t);
  await call("PATCH", `/shop/barbers/${ctx.ali}`, { isActive: false }, ctx.t);
  assert.equal((await call("PATCH", `/shop/barbers/${ctx.ali}`, { isActive: true }, ctx.t)).status, 200);
  assert.equal((await call("PATCH", `/shop/barbers/${ctx.veli}`, { isActive: true }, ctx.t)).status, 403);
  await call("PATCH", `/admin/shops/${ctx.shopId}`, { plan: "PRO" }, ctx.admin);
  assert.equal((await call("PATCH", `/shop/barbers/${ctx.veli}`, { isActive: true }, ctx.t)).status, 200);
});

test("calisan girisi: sahip verir, calisan sadece kendi randevularini gorur", async () => {
  assert.equal((await call("PUT", `/shop/barbers/${ctx.ali}/login`, { email: "ali@test.com", password: "123" }, ctx.t)).status, 400);
  assert.equal((await call("PUT", `/shop/barbers/${ctx.ali}/login`, { email: "o@test.com", password: "alisifre1" }, ctx.t)).status, 409);
  const give = await call("PUT", `/shop/barbers/${ctx.ali}/login`, { email: "ali@test.com", password: "alisifre1" }, ctx.t);
  assert.equal(give.status, 200, JSON.stringify(give.body));
  assert.equal(give.body.data.login.email, "ali@test.com");
  const login = await call("POST", "/auth/login", { email: "ali@test.com", password: "alisifre1" });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, "STAFF");
  assert.equal(login.body.data.user.barberId, ctx.ali);
  ctx.s = login.body.data.token;

  const date = nextOpenDate();
  const forVeli = await call("POST", "/shop/appointments", { serviceId: ctx.svc, date, time: "10:00", customerName: "Veli Müşteri", barberId: ctx.veli }, ctx.t);
  // calisan barberId gonderse bile kendi adina yazilir
  const mine = await call("POST", "/shop/appointments", { serviceId: ctx.svc, date, time: "10:00", customerName: "Ali Müşteri", barberId: ctx.veli }, ctx.s);
  assert.equal(mine.status, 201, JSON.stringify(mine.body));
  assert.equal(mine.body.data.barberName, "Ali");
  const list = await call("GET", `/shop/appointments?from=${date}&to=${date}`, null, ctx.s);
  assert.deepEqual(list.body.data.map((a) => a.customerName), ["Ali Müşteri"]);
  assert.equal((await call("PATCH", `/shop/appointments/${forVeli.body.data.id}`, { status: "CANCELLED" }, ctx.s)).status, 404);
  assert.equal((await call("PATCH", `/shop/appointments/${mine.body.data.id}`, { barberId: ctx.veli }, ctx.s)).status, 403);
  assert.equal((await call("PATCH", `/shop/appointments/${mine.body.data.id}`, { status: "COMPLETED" }, ctx.s)).status, 200);
});

test("calisan sahip bolumlerine giremez", async () => {
  for (const path of ["/shop/cash", "/shop/customers", "/shop/decisions/insights", "/shop/decisions/log"]) {
    assert.equal((await call("GET", path, null, ctx.s)).status, 403, path);
  }
  assert.equal((await call("PATCH", "/shop", { name: "Hack" }, ctx.s)).status, 403);
  assert.equal((await call("POST", "/shop/barbers", { name: "Hack" }, ctx.s)).status, 403);
  assert.equal((await call("PUT", `/shop/barbers/${ctx.veli}/login`, { email: "x@test.com", password: "12345678" }, ctx.s)).status, 403);
  const barbers = await call("GET", "/shop/barbers", null, ctx.s);
  assert.equal(barbers.status, 200);
  assert.ok(barbers.body.data.every((b) => b.login === null)); // giris bilgileri gizli
  const stats = await call("GET", "/shop/stats", null, ctx.s);
  assert.equal(stats.status, 200);
});

test("sifre degistirme; girisi kaldirinca calisan giremez", async () => {
  assert.equal((await call("POST", "/auth/password", { currentPassword: "yanlis", newPassword: "yenisifre1" }, ctx.s)).status, 400);
  assert.equal((await call("POST", "/auth/password", { currentPassword: "alisifre1", newPassword: "kisa" }, ctx.s)).status, 400);
  assert.equal((await call("POST", "/auth/password", { currentPassword: "alisifre1", newPassword: "yenisifre1" }, ctx.s)).status, 200);
  assert.equal((await call("POST", "/auth/login", { email: "ali@test.com", password: "alisifre1" })).status, 401);
  assert.equal((await call("POST", "/auth/login", { email: "ali@test.com", password: "yenisifre1" })).status, 200);
  // sahip e-postayi degistirir, sifreye dokunmaz
  const upd = await call("PUT", `/shop/barbers/${ctx.ali}/login`, { email: "ali2@test.com" }, ctx.t);
  assert.equal(upd.status, 200);
  assert.equal((await call("POST", "/auth/login", { email: "ali2@test.com", password: "yenisifre1" })).status, 200);
  assert.equal((await call("DELETE", `/shop/barbers/${ctx.ali}/login`, null, ctx.t)).status, 200);
  assert.equal((await call("POST", "/auth/login", { email: "ali2@test.com", password: "yenisifre1" })).status, 401);
  assert.equal((await call("GET", "/shop/appointments", null, ctx.s)).status, 401); // eski token da gecersiz
  assert.equal(db._tables.user.filter((u) => u.role === "STAFF").length, 0);
});

test("asistan: yarin hatirlatma onerisi", async () => {
  const ins = await call("GET", "/shop/decisions/insights", null, ctx.t);
  assert.ok(ins.body.data.some((c) => c.code === "YARIN_HATIRLAT" || c.code === "CALISAN_RANDEVU_SORUNU"));
});
