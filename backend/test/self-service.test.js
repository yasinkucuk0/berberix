// Musteri iptal linki, ogle arasi, kapali gunler ve sadakat (loyalty@1). Calistir: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const db = global.__TEST_DB__;
const { createApp } = require("../src/app");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");
const { computeSlots } = require("../src/lib/availability");
const { decide } = require("../src/decisions/engine");
const { policy: loyaltyPolicy } = require("../src/decisions/policies/loyalty");

let base;
let server;
test.before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

async function call(method, path, body, token) {
  if (body && /\/public\/shops\/[^/]+\/appointments$/.test(path) && body.kvkk === undefined) body = { ...body, kvkk: true };
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
const book = (body) => call("POST", "/public/shops/self/appointments", { serviceId: ctx.svc, customerName: "Müşteri", ...body });

test("birim: ogle arasi ve kapali gun saatleri kapatir", () => {
  const date = nextOpenDate(2);
  const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, openTime: "09:00", closeTime: "14:00", breakStart: "12:00", breakEnd: "13:00" }));
  const slots = computeSlots({ date, hours, appointments: [], duration: 30, step: 30 });
  assert.ok(slots.includes("11:30"));
  assert.ok(!slots.includes("12:00"));
  assert.ok(!slots.includes("12:30"));
  assert.ok(slots.includes("13:00"));
  assert.deepEqual(computeSlots({ date, hours, appointments: [], duration: 30, step: 30, closedDates: [date] }), []);
});

test("birim: sadakat karari", () => {
  const p = (completed, upcoming = 0) => ({ completed, upcoming });
  assert.equal(decide(loyaltyPolicy, { shop: { loyaltyEvery: 0 }, profile: p(9) }).outcome, "NONE");
  assert.equal(decide(loyaltyPolicy, { shop: { loyaltyEvery: 10 }, profile: p(9) }).outcome, "REWARD");
  assert.equal(decide(loyaltyPolicy, { shop: { loyaltyEvery: 10 }, profile: p(8, 1) }).outcome, "REWARD");
  const no = decide(loyaltyPolicy, { shop: { loyaltyEvery: 10 }, profile: p(6) });
  assert.equal(no.outcome, "NONE");
  assert.match(no.reasons[0].message, /3 ziyaret kaldı/);
});

test("hazirlik", async () => {
  const r = await call("POST", "/auth/register-shop", { shopName: "Self", slug: "self", ownerName: "Yasin", email: "s@test.com", password: "gizli1234" });
  ctx.t = r.body.data.token;
  ctx.svc = (await call("GET", "/shop/services", null, ctx.t)).body.data[0].id;
  ctx.date = nextOpenDate(2);
});

test("musteri linkle randevusunu gorur ve iptal eder; saat yeniden acilir", async () => {
  const b = await book({ date: ctx.date, time: "10:00", customerPhone: "05551112233", customerName: "Ali Kaya" });
  assert.equal(b.status, 201);
  const token = b.body.data.manageToken;
  assert.ok(token && token.length >= 20);
  const view = await call("GET", `/public/appointments/${token}`);
  assert.equal(view.status, 200);
  assert.equal(view.body.data.appointment.customerName, "Ali"); // soyad ve telefon gosterilmez
  assert.ok(!JSON.stringify(view.body).includes("5551112233"));
  assert.equal(view.body.data.canCancel, true);
  assert.equal((await call("GET", "/public/appointments/uydurma")).status, 404);
  assert.equal((await call("GET", `/public/appointments/${"x".repeat(24)}`)).status, 404);

  const c = await call("POST", `/public/appointments/${token}/cancel`);
  assert.equal(c.status, 200);
  assert.equal(c.body.data.appointment.status, "CANCELLED");
  assert.equal(c.body.data.canCancel, false);
  assert.equal((await call("POST", `/public/appointments/${token}/cancel`)).status, 409);
  const row = db._tables.appointment.find((a) => a.manageToken === token);
  assert.equal(row.cancelledBy, "CUSTOMER");
  const av = await call("GET", `/public/shops/self/availability?date=${ctx.date}&serviceId=${ctx.svc}`);
  assert.ok(av.body.data.slots.includes("10:00"));
});

test("gecmis randevu iptal edilemez", async () => {
  const b = await book({ date: ctx.date, time: "11:00", customerPhone: "05559990000" });
  const row = db._tables.appointment.find((a) => a.id === b.body.data.id);
  row.date = addDays(localNow().date, -1);
  assert.equal((await call("POST", `/public/appointments/${b.body.data.manageToken}/cancel`)).status, 409);
});

test("ogle arasi ayari: gecersiz reddedilir, gecerli saatleri kapatir", async () => {
  const hours = (await call("GET", "/shop/hours", null, ctx.t)).body.data;
  const bad = hours.map((h) => ({ ...h, breakStart: "13:00", breakEnd: "12:00" }));
  assert.equal((await call("PUT", "/shop/hours", { hours: bad }, ctx.t)).status, 400);
  const out = hours.map((h) => ({ ...h, breakStart: "07:00", breakEnd: "08:00" }));
  assert.equal((await call("PUT", "/shop/hours", { hours: out }, ctx.t)).status, 400);
  const ok = hours.map((h) => ({ ...h, breakStart: "12:30", breakEnd: "13:30" }));
  const r = await call("PUT", "/shop/hours", { hours: ok }, ctx.t);
  assert.equal(r.status, 200);
  const av = await call("GET", `/public/shops/self/availability?date=${ctx.date}&serviceId=${ctx.svc}`);
  assert.ok(!av.body.data.slots.includes("12:30"));
  assert.ok(!av.body.data.slots.includes("13:00"));
  assert.ok(av.body.data.slots.includes("13:30"));
  assert.equal((await book({ date: ctx.date, time: "13:00", customerPhone: "05550001111" })).status, 409);
});

test("kapali gun: online randevu kapanir, asistan eski randevulari uyarir", async () => {
  const day = nextOpenDate(5);
  const before = await book({ date: day, time: "10:00", customerPhone: "05553334444" });
  assert.equal(before.status, 201);
  assert.equal((await call("POST", "/shop/closed-days", { date: "2020-01-01" }, ctx.t)).status, 400);
  const add = await call("POST", "/shop/closed-days", { date: day, reason: "Bayram" }, ctx.t);
  assert.equal(add.status, 201);
  assert.equal(add.body.data.affected, 1);
  assert.equal((await call("POST", "/shop/closed-days", { date: day }, ctx.t)).status, 409);
  const av = await call("GET", `/public/shops/self/availability?date=${day}&serviceId=${ctx.svc}`);
  assert.deepEqual(av.body.data.slots, []);
  assert.equal((await book({ date: day, time: "11:00", customerPhone: "05553335555" })).status, 409);
  const ins = await call("GET", "/shop/decisions/insights", null, ctx.t);
  assert.ok(ins.body.data.some((c) => c.code === "KAPALI_GUNDE_RANDEVU"));
  const list = await call("GET", "/shop/closed-days", null, ctx.t);
  assert.equal(list.body.data[0].reason, "Bayram");
  assert.equal((await call("DELETE", `/shop/closed-days/${list.body.data[0].id}`, null, ctx.t)).status, 200);
  assert.ok((await call("GET", `/public/shops/self/availability?date=${day}&serviceId=${ctx.svc}`)).body.data.slots.length > 0);
});

test("sadakat: 3. ziyaret hediye, ucret 0 yazilir", async () => {
  assert.equal((await call("PATCH", "/shop/decisions/settings", { loyaltyEvery: 2 }, ctx.t)).status, 400);
  assert.equal((await call("PATCH", "/shop/decisions/settings", { loyaltyEvery: 3, confirmMode: "ALL" }, ctx.t)).status, 200);
  const phone = "05327778899";
  // iki tamamlanmis ziyaret
  for (const time of ["15:00", "16:00"]) {
    const r = await book({ date: ctx.date, time, customerPhone: phone, customerName: "Sadık Müşteri" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.loyalty.reward, false);
    await call("PATCH", `/shop/appointments/${r.body.data.id}`, { status: "COMPLETED" }, ctx.t);
  }
  const third = await book({ date: ctx.date, time: "17:00", customerPhone: phone, customerName: "Sadık Müşteri" });
  assert.equal(third.status, 201);
  assert.equal(third.body.data.loyalty.reward, true);
  assert.equal(third.body.data.price, 0);
  assert.match(third.body.data.loyalty.message, /3\. ziyaretin/);
  const list = await call("GET", `/shop/appointments?from=${ctx.date}&to=${ctx.date}`, null, ctx.t);
  assert.ok(list.body.data.find((a) => a.id === third.body.data.id).loyaltyReward);
});
