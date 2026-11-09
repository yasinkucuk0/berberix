// Calistir: npm test   (gercek veritabanina dokunmaz)
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const db = global.__TEST_DB__;
const { createApp } = require("../src/app");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");

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

// Pazar disinda, yarindan itibaren ilk acik gun
function nextOpenDate() {
  let d = addDays(localNow().date, 1);
  while (dayOfWeek(d) === 6) d = addDays(d, 1);
  return d;
}

const ctx = {};

test("dukkan kaydi: marka + varsayilan hizmet ve saatler", async () => {
  const r = await call("POST", "/auth/register-shop", {
    shopName: "Ahmet Berber", ownerName: "Ahmet", email: "ahmet@test.com", password: "gizli1234", phone: "0555 111 22 33",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.shop.slug, "ahmet-berber");
  assert.equal(r.body.data.shop.status, "TRIAL");
  assert.ok(!("passwordHash" in r.body.data.user));
  ctx.a = r.body.data.token;

  const b = await call("POST", "/auth/register-shop", {
    shopName: "Mehmet Kuaför", slug: "mehmet", ownerName: "Mehmet", email: "mehmet@test.com", password: "gizli1234",
  });
  assert.equal(b.status, 201);
  ctx.b = b.body.data.token;
});

test("ayni adres / e-posta / ayrilmis adres reddedilir", async () => {
  assert.equal((await call("POST", "/auth/register-shop", {
    shopName: "Ahmet Berber", ownerName: "Xa", email: "x@test.com", password: "gizli1234" })).status, 409);
  assert.equal((await call("POST", "/auth/register-shop", {
    shopName: "Baska", ownerName: "Xa", email: "ahmet@test.com", password: "gizli1234" })).status, 409);
  assert.equal((await call("POST", "/auth/register-shop", {
    shopName: "Panel", slug: "panel", ownerName: "Xa", email: "y@test.com", password: "gizli1234" })).status, 400);
  assert.equal((await call("POST", "/auth/register-shop", {
    shopName: "Kisa", ownerName: "Xa", email: "z@test.com", password: "123" })).status, 400);
});

test("giris ve hatali sifre", async () => {
  assert.equal((await call("POST", "/auth/login", { email: "ahmet@test.com", password: "yanlis123" })).status, 401);
  const ok = await call("POST", "/auth/login", { email: "AHMET@test.com", password: "gizli1234" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.shop.slug, "ahmet-berber");
});

test("panel token olmadan ve sahte token ile acilmaz", async () => {
  assert.equal((await call("GET", "/shop")).status, 401);
  assert.equal((await call("GET", "/shop", null, "abc.def.ghi")).status, 401);
});

test("marka ayarlari guncellenir, gecersiz renk reddedilir", async () => {
  const r = await call("PATCH", "/shop", { primaryColor: "#123456", about: "En iyi tıraş", city: "İzmir" }, ctx.a);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.primaryColor, "#123456");
  assert.equal((await call("PATCH", "/shop", { primaryColor: "red" }, ctx.a)).status, 400);
  assert.equal((await call("PATCH", "/shop", { slug: "mehmet" }, ctx.a)).status, 409);
});

test("KIRACI IZOLASYONU: A, B'nin hizmetini ve randevusunu goremez/degistiremez", async () => {
  const bServices = await call("GET", "/shop/services", null, ctx.b);
  const bServiceId = bServices.body.data[0].id;
  assert.equal((await call("PATCH", `/shop/services/${bServiceId}`, { price: 1 }, ctx.a)).status, 404);
  const aServices = await call("GET", "/shop/services", null, ctx.a);
  assert.ok(aServices.body.data.every((s) => s.shopId === aServices.body.data[0].shopId));
  assert.ok(!aServices.body.data.some((s) => s.id === bServiceId));

  // B'ye bir randevu al, A goremesin
  const date = nextOpenDate();
  const bk = await call("POST", "/public/shops/mehmet/appointments", {
    serviceId: bServiceId, date, time: "10:00", customerName: "Ali", customerPhone: "05551112233",
  });
  assert.equal(bk.status, 201, JSON.stringify(bk.body));
  const list = await call("GET", `/shop/appointments?from=${date}&to=${date}`, null, ctx.a);
  assert.equal(list.body.data.length, 0);
  assert.equal((await call("PATCH", `/shop/appointments/${bk.body.data.id}`, { status: "CANCELLED" }, ctx.a)).status, 404);
  // A, istekle baska shopId gonderse bile kendi dukkanina yazar
  const created = await call("POST", "/shop/services", { name: "Hile", price: 1, shopId: 2 }, ctx.a);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.shopId, aServices.body.data[0].shopId);
});

test("randevu: musait saatler, cakisma ve gecmis tarih", async () => {
  const shop = await call("GET", "/public/shops/ahmet-berber");
  assert.equal(shop.status, 200);
  assert.ok(shop.body.data.acceptingBookings);
  const service = shop.body.data.services.find((s) => s.name === "Saç Kesimi");
  const date = nextOpenDate();

  const before = await call("GET", `/public/shops/ahmet-berber/availability?date=${date}&serviceId=${service.id}`);
  assert.ok(before.body.data.slots.includes("09:00"));

  const first = await call("POST", "/public/shops/ahmet-berber/appointments", {
    serviceId: service.id, date, time: "09:00", customerName: "Veli", customerPhone: "05550000000",
  });
  assert.equal(first.status, 201);
  const clash = await call("POST", "/public/shops/ahmet-berber/appointments", {
    serviceId: service.id, date, time: "09:00", customerName: "Can", customerPhone: "05550000001",
  });
  assert.equal(clash.status, 409);

  const after = await call("GET", `/public/shops/ahmet-berber/availability?date=${date}&serviceId=${service.id}`);
  assert.ok(!after.body.data.slots.includes("09:00"));

  const past = await call("POST", "/public/shops/ahmet-berber/appointments", {
    serviceId: service.id, date: "2020-01-01", time: "10:00", customerName: "Eski", customerPhone: "05550000002",
  });
  assert.equal(past.status, 400);

  // Sahip randevuyu iptal edince saat yeniden bos
  const list = await call("GET", `/shop/appointments?from=${date}&to=${date}`, null, ctx.a);
  const id = list.body.data[0].id;
  assert.equal((await call("PATCH", `/shop/appointments/${id}`, { status: "CANCELLED" }, ctx.a)).status, 200);
  const again = await call("GET", `/public/shops/ahmet-berber/availability?date=${date}&serviceId=${service.id}`);
  assert.ok(again.body.data.slots.includes("09:00"));
});

test("kapali gun (Pazar) icin saat yok", async () => {
  let d = addDays(localNow().date, 1);
  while (dayOfWeek(d) !== 6) d = addDays(d, 1);
  const shop = await call("GET", "/public/shops/ahmet-berber");
  const r = await call("GET", `/public/shops/ahmet-berber/availability?date=${d}&serviceId=${shop.body.data.services[0].id}`);
  assert.deepEqual(r.body.data.slots, []);
});

test("platform yoneticisi: kurulum, dukkan listesi, askiya alma", async () => {
  const setup = await call("POST", "/admin/setup", { email: "admin@test.com", password: "yonetici12345", name: "Yasin" });
  assert.equal(setup.status, 201);
  assert.equal((await call("POST", "/admin/setup", { email: "a2@test.com", password: "yonetici12345" })).status, 409);
  const token = setup.body.data.token;

  assert.equal((await call("GET", "/admin/shops", null, ctx.a)).status, 403); // dukkan sahibi giremez
  const shops = await call("GET", "/admin/shops", null, token);
  assert.equal(shops.status, 200);
  assert.equal(shops.body.data.length, 2);
  const mehmet = shops.body.data.find((s) => s.slug === "mehmet");

  assert.equal((await call("PATCH", `/admin/shops/${mehmet.id}`, { status: "SUSPENDED" }, token)).status, 200);
  const pub = await call("GET", "/public/shops/mehmet");
  assert.equal(pub.body.data.acceptingBookings, false);
  const svc = pub.body.data.services[0];
  const bk = await call("POST", "/public/shops/mehmet/appointments", {
    serviceId: svc.id, date: nextOpenDate(), time: "11:00", customerName: "Ali", customerPhone: "05551112233",
  });
  assert.equal(bk.status, 403);

  const act = await call("PATCH", `/admin/shops/${mehmet.id}`, { status: "ACTIVE", extendDays: 30 }, token);
  assert.equal(act.status, 200);
  assert.ok(act.body.data.acceptingBookings);
});

test("deneme suresi biten dukkan randevu almaz", async () => {
  const row = db._tables.shop.find((s) => s.slug === "ahmet-berber");
  row.trialEndsAt = new Date(Date.now() - 1000);
  const pub = await call("GET", "/public/shops/ahmet-berber");
  assert.equal(pub.body.data.acceptingBookings, false);
  const me = await call("GET", "/shop", null, ctx.a);
  assert.equal(me.body.data.acceptingBookings, false);
  assert.match(me.body.data.accessReason, /Deneme/);
});

test("berber elle randevu ekler; cakisma ve baska dukkan hizmeti reddedilir", async () => {
  const login = await call("POST", "/auth/login", { email: "mehmet@test.com", password: "gizli1234" });
  const token = login.body.data.token;
  const services = await call("GET", "/shop/services", null, token);
  const svc = services.body.data[0];
  const date = nextOpenDate();
  const r = await call("POST", "/shop/appointments", {
    serviceId: svc.id, date, time: "21:30", customerName: "Telefon Müşterisi", customerPhone: "05321112233",
  }, token);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.status, "CONFIRMED"); // calisma saati disi elle eklenebilir
  const clash = await call("POST", "/shop/appointments", {
    serviceId: svc.id, date, time: "21:40", customerName: "Başka", customerPhone: "",
  }, token);
  assert.equal(clash.status, 409);
  const aSvc = (await call("GET", "/shop/services", null, ctx.a)).body.data[0];
  const foreign = await call("POST", "/shop/appointments", {
    serviceId: aSvc.id, date, time: "08:00", customerName: "Hile", customerPhone: "",
  }, token);
  assert.equal(foreign.status, 404);
});

test("canli kurulum anahtari: yanlis anahtar reddedilir", async () => {
  process.env.ADMIN_SETUP_TOKEN = "x".repeat(32);
  const status = await call("GET", "/admin/setup-status");
  assert.equal(status.body.data.needsToken, true);
  const bad = await call("POST", "/admin/setup", { email: "z@test.com", password: "yonetici12345", setupToken: "yanlis" });
  assert.equal(bad.status, 403);
  delete process.env.ADMIN_SETUP_TOKEN;
});
