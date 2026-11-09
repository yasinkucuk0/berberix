// Calisanlar (berber bazli takvim) ve "fark etmez" atama karari testleri. Calistir: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const { createApp } = require("../src/app");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");
const { chooseBarber } = require("../src/decisions/assign");
const { barberSlots } = require("../src/lib/availability");

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
const book = (body) => call("POST", "/public/shops/ekip/appointments", {
  serviceId: ctx.svc, date: ctx.date, customerName: "Müşteri", ...body,
});

// ---------- Saf birim testleri ----------
test("atama karari: en bos berber, esitlikte siralama", () => {
  const a = { id: 1, name: "Ali", sortOrder: 0 };
  const v = { id: 2, name: "Veli", sortOrder: 1 };
  const appts = [{ barberId: 1, status: "CONFIRMED", startMinutes: 600, endMinutes: 660 }];
  const pick = chooseBarber([a, v], appts);
  assert.equal(pick.barber.name, "Veli");
  assert.equal(pick.decision.outcome, "ASSIGN");
  assert.match(pick.decision.reasons[0].message, /Veli \(0 dk dolu\)/);
  assert.equal(chooseBarber([a, v], []).barber.name, "Ali");
  assert.equal(chooseBarber([], []), null);
});

test("musaitlik: atanmamis eski randevu herkesi bloklar, izinli berber listelenmez", () => {
  const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isOpen: true, openTime: "09:00", closeTime: "11:00" }));
  const date = nextOpenDate(3);
  const barbers = [{ id: 1, name: "Ali", isActive: true, offDays: "" }, { id: 2, name: "Veli", isActive: true, offDays: String(dayOfWeek(date)) }];
  const appts = [{ barberId: null, status: "CONFIRMED", startMinutes: 540, endMinutes: 570 }];
  const r = barberSlots({ date, hours, appointments: appts, duration: 30, step: 30, barbers });
  assert.ok(!r.slots.includes("09:00"));
  assert.deepEqual(r.freeBy["09:30"], [1]); // Veli izinli
});

// ---------- API ----------
test("hazirlik: dukkan + iki berber", async () => {
  const r = await call("POST", "/auth/register-shop", { shopName: "Ekip Berber", slug: "ekip", ownerName: "Yasin", email: "e@test.com", password: "gizli1234" });
  ctx.t = r.body.data.token;
  ctx.svc = (await call("GET", "/public/shops/ekip")).body.data.services[0].id; // 30 dk
  ctx.date = nextOpenDate(2);

  assert.equal((await call("POST", "/shop/barbers", { name: "A" }, ctx.t)).status, 400);
  assert.equal((await call("POST", "/shop/barbers", { name: "Ali", offDays: [7] }, ctx.t)).status, 400);
  assert.equal((await call("POST", "/shop/barbers", { name: "Ali", offDays: [0, 1, 2, 3, 4, 5, 6] }, ctx.t)).status, 400);
  const ali = await call("POST", "/shop/barbers", { name: "Ali", title: "Usta" }, ctx.t);
  const veli = await call("POST", "/shop/barbers", { name: "Veli", title: "Kalfa" }, ctx.t);
  assert.equal(ali.status, 201, JSON.stringify(ali.body));
  ctx.ali = ali.body.data.id;
  ctx.veli = veli.body.data.id;
  const pub = await call("GET", "/public/shops/ekip");
  assert.deepEqual(pub.body.data.barbers.map((b) => b.name), ["Ali", "Veli"]);
});

test("ayni saate iki berber -> iki randevu; ucuncusu dolu", async () => {
  const a = await book({ time: "10:00", customerPhone: "05550000001", barberId: ctx.ali });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.data.barberName, "Ali");
  // Ali dolu ama saat hala listede (Veli bos)
  const av = await call("GET", `/public/shops/ekip/availability?date=${ctx.date}&serviceId=${ctx.svc}`);
  assert.ok(av.body.data.slots.includes("10:00"));
  const aliAv = await call("GET", `/public/shops/ekip/availability?date=${ctx.date}&serviceId=${ctx.svc}&barberId=${ctx.ali}`);
  assert.ok(!aliAv.body.data.slots.includes("10:00"));
  assert.equal((await book({ time: "10:00", customerPhone: "05550000002", barberId: ctx.ali })).status, 409);

  // Fark etmez -> bos olan Veli atanir
  const any = await book({ time: "10:00", customerPhone: "05550000003", barberId: "any" });
  assert.equal(any.status, 201);
  assert.equal(any.body.data.barberName, "Veli");
  assert.equal((await book({ time: "10:00", customerPhone: "05550000004" })).status, 409);
  const full = await call("GET", `/public/shops/ekip/availability?date=${ctx.date}&serviceId=${ctx.svc}`);
  assert.ok(!full.body.data.slots.includes("10:00"));
  // atama karari kayitta
  const log = await call("GET", "/shop/decisions/log", null, ctx.t);
  assert.ok(log.body.data.some((d) => d.type === "ASSIGN" && d.reasons[0].code === "EN_BOS_BERBER"));
});

test("fark etmez: is yuku dengelenir", async () => {
  // Ali'nin 10:00 + 11:00, Veli'nin 10:00 randevusu var -> 12:00 icin Veli
  await book({ time: "11:00", customerPhone: "05550000005", barberId: ctx.ali });
  const r = await book({ time: "12:00", customerPhone: "05550000006" });
  assert.equal(r.body.data.barberName, "Veli");
});

test("yabanci / pasif berber reddedilir", async () => {
  const other = await call("POST", "/auth/register-shop", { shopName: "Diğer", slug: "diger2", ownerName: "Ozan", email: "o2@test.com", password: "gizli1234" });
  const foreign = await call("POST", "/shop/barbers", { name: "Yabancı" }, other.body.data.token);
  assert.equal((await book({ time: "15:00", customerPhone: "05550000007", barberId: foreign.body.data.id })).status, 404);
  assert.equal((await call("PATCH", `/shop/barbers/${ctx.ali}`, { name: "Hack" }, other.body.data.token)).status, 404);
  assert.equal((await call("GET", "/shop/barbers", null, other.body.data.token)).body.data.length, 1);
});

test("panel: elle randevu berber ister, cakisma berber bazli; filtre ve aktarma", async () => {
  assert.equal((await call("POST", "/shop/appointments", {
    serviceId: ctx.svc, date: ctx.date, time: "14:00", customerName: "Tel",
  }, ctx.t)).status, 400); // berber secilmedi
  const ok = await call("POST", "/shop/appointments", {
    serviceId: ctx.svc, date: ctx.date, time: "10:00", customerName: "Tel", barberId: ctx.ali,
  }, ctx.t);
  assert.equal(ok.status, 409); // Ali 10:00 dolu
  const v = await call("POST", "/shop/appointments", {
    serviceId: ctx.svc, date: ctx.date, time: "14:00", customerName: "Tel", barberId: ctx.veli,
  }, ctx.t);
  assert.equal(v.status, 201);
  const aliList = await call("GET", `/shop/appointments?from=${ctx.date}&to=${ctx.date}&barberId=${ctx.ali}`, null, ctx.t);
  assert.ok(aliList.body.data.every((a) => a.barberName === "Ali"));
  assert.equal(aliList.body.data.length, 2);

  // Veli'nin 14:00 randevusu Ali'ye aktarilir; Ali'nin 10:00'i Veli'ye aktarilamaz (Veli 10:00 dolu)
  const moved = await call("PATCH", `/shop/appointments/${v.body.data.id}`, { barberId: ctx.ali }, ctx.t);
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.barberName, "Ali");
  const ali10 = aliList.body.data.find((a) => a.start === "10:00");
  assert.equal((await call("PATCH", `/shop/appointments/${ali10.id}`, { barberId: ctx.veli }, ctx.t)).status, 409);
});

test("izin gunu ve pasif calisan: musaitlik + asistan uyarisi", async () => {
  // Veli o gun izinli -> 16:00 fark etmez -> Ali
  await call("PATCH", `/shop/barbers/${ctx.veli}`, { offDays: [dayOfWeek(ctx.date)] }, ctx.t);
  const r = await book({ time: "16:00", customerPhone: "05550000008" });
  assert.equal(r.body.data.barberName, "Ali");
  // Veli'nin izinli gunde randevulari var -> asistan uyarir
  let ins = await call("GET", "/shop/decisions/insights", null, ctx.t);
  let card = ins.body.data.find((c) => c.code === "CALISAN_RANDEVU_SORUNU");
  assert.ok(card);
  assert.match(card.detail, /Veli/);
  // Veli pasif -> musteri listesinde gorunmez
  await call("PATCH", `/shop/barbers/${ctx.veli}`, { isActive: false, offDays: [] }, ctx.t);
  const pub = await call("GET", "/public/shops/ekip");
  assert.deepEqual(pub.body.data.barbers.map((b) => b.name), ["Ali"]);
  ins = await call("GET", "/shop/decisions/insights", null, ctx.t);
  card = ins.body.data.find((c) => c.code === "CALISAN_RANDEVU_SORUNU");
  assert.match(card.detail, /pasif/);
});

test("kasa: berber kirilimi", async () => {
  const list = await call("GET", `/shop/appointments?from=${ctx.date}&to=${ctx.date}`, null, ctx.t);
  const first = list.body.data.find((a) => a.barberName === "Ali");
  await call("PATCH", `/shop/appointments/${first.id}`, { status: "COMPLETED", paymentMethod: "CASH" }, ctx.t);
  const cash = await call("GET", `/shop/cash?date=${ctx.date}`, null, ctx.t);
  assert.equal(cash.body.data.byBarber[0].name, "Ali");
  assert.equal(cash.body.data.byBarber[0].count, 1);
});

test("calisan adi degisince randevulardaki ad da guncellenir", async () => {
  await call("PATCH", `/shop/barbers/${ctx.ali}`, { name: "Ali Usta" }, ctx.t);
  const list = await call("GET", `/shop/appointments?from=${ctx.date}&to=${ctx.date}&barberId=${ctx.ali}`, null, ctx.t);
  assert.ok(list.body.data.every((a) => a.barberName === "Ali Usta"));
});
