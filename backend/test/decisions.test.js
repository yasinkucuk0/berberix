// Karar motoru testleri. Calistir: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createFakeDb } = require("../testlib/fakeDb");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
global.__TEST_DB__ = createFakeDb();
const db = global.__TEST_DB__;
const { createApp } = require("../src/app");
const { decide, recommend, validatePolicy } = require("../src/decisions/engine");
const { buildProfile, customerKey, maskPhone } = require("../src/decisions/customer");
const bookingPolicy = require("../src/decisions/policies/booking");
const { lifecycleFor } = require("../src/decisions");
const { localNow, addDays, dayOfWeek } = require("../src/lib/util");

// ---------- Saf birim testleri ----------
const shopCfg = (over = {}) => ({ confirmMode: "MANUAL", noShowLimit: 3, maxActivePerPhone: 2, ...over });
const past = (status, n = 1) => Array.from({ length: n }, () => ({ status, date: "2020-01-01", endMinutes: 600 }));

test("motor: en guclu sonuc kazanir, nedenler aciklanir", () => {
  const policy = validatePolicy({
    name: "deneme", outcomes: ["NO", "MAYBE", "YES"], fallback: { outcome: "MAYBE", message: "bilinmiyor" },
    rules: [
      { code: "A", outcome: "YES", when: () => true, message: "evet" },
      { code: "B", outcome: "NO", when: (c) => c.x > 5, message: (c) => `x=${c.x}` },
      { code: "C", outcome: "YES", when: () => { throw new Error("bozuk"); } },
    ],
  });
  const d = decide(policy, { x: 9 });
  assert.equal(d.outcome, "NO");
  assert.equal(d.reasons[0].code, "B");
  assert.equal(d.reasons[0].message, "x=9");
  assert.equal(d.policy, "deneme@1");
  assert.equal(decide(policy, { x: 1 }).outcome, "YES");
  assert.throws(() => validatePolicy({ name: "x", outcomes: ["A"], fallback: { outcome: "Z" }, rules: [] }));
});

test("musteri anahtari ve maske: farkli yazimlar ayni musteri", () => {
  assert.equal(customerKey("0555 111 22 33"), "5551112233");
  assert.equal(customerKey("+90 555 111 22 33"), "5551112233");
  assert.equal(customerKey("123"), "");
  assert.equal(maskPhone("05551112233"), "***2233");
});

test("risk puani: yeni, guvenilir, riskli", () => {
  assert.equal(buildProfile([]).level, "NEW");
  assert.equal(buildProfile(past("COMPLETED", 6)).level, "LOW");
  assert.equal(buildProfile(past("COMPLETED", 6)).loyal, true);
  assert.equal(buildProfile([...past("NO_SHOW", 2)]).level, "HIGH");
  assert.equal(buildProfile([...past("NO_SHOW"), ...past("COMPLETED")]).level, "MEDIUM");
});

test("randevu politikasi: modlara gore karar", () => {
  const regular = buildProfile(past("COMPLETED", 2));
  const fresh = buildProfile([]);
  assert.equal(decide(bookingPolicy, { shop: shopCfg(), profile: regular }).outcome, "REVIEW");
  assert.equal(decide(bookingPolicy, { shop: shopCfg({ confirmMode: "TRUSTED" }), profile: regular }).outcome, "CONFIRM");
  assert.equal(decide(bookingPolicy, { shop: shopCfg({ confirmMode: "TRUSTED" }), profile: fresh }).outcome, "REVIEW");
  assert.equal(decide(bookingPolicy, { shop: shopCfg({ confirmMode: "ALL" }), profile: fresh }).outcome, "CONFIRM");
  // ALL modunda bile riskli musteri berbere sorulur
  const risky = buildProfile(past("NO_SHOW", 2));
  assert.equal(decide(bookingPolicy, { shop: shopCfg({ confirmMode: "ALL" }), profile: risky }).outcome, "REVIEW");
  // gelmeme siniri asilinca red
  const blocked = buildProfile(past("NO_SHOW", 3));
  const d = decide(bookingPolicy, { shop: shopCfg({ confirmMode: "ALL" }), profile: blocked });
  assert.equal(d.outcome, "REJECT");
  assert.equal(d.reasons[0].code, "GELMEME_SINIRI");
});

test("oneriler: oncelik sirasina gore", () => {
  const cards = recommend([
    { code: "I", level: "info", when: () => true, title: "bilgi" },
    { code: "H", level: "high", when: () => true, title: (c) => `acil ${c.n}` },
    { code: "X", level: "high", when: () => false, title: "yok" },
  ], { n: 2 });
  assert.deepEqual(cards.map((c) => c.code), ["H", "I"]);
  assert.equal(cards[0].title, "acil 2");
});

test("platform karari: suresi uzun suredir biten dukkana askiya alma onerisi", () => {
  const now = new Date();
  const old = new Date(now.getTime() - 30 * 86400000);
  const ended = { status: "TRIAL", trialEndsAt: new Date(now.getTime() - 10 * 86400000), createdAt: old };
  assert.equal(lifecycleFor(ended, 5, now).outcome, "SUSPEND_SUGGESTED");
  const ending = { status: "TRIAL", trialEndsAt: new Date(now.getTime() + 2 * 86400000), createdAt: old };
  assert.equal(lifecycleFor(ending, 5, now).outcome, "REMIND_PAYMENT");
  const idle = { status: "ACTIVE", paidUntil: new Date(now.getTime() + 20 * 86400000), createdAt: old };
  assert.equal(lifecycleFor(idle, 0, now).outcome, "CHURN_RISK");
  assert.equal(lifecycleFor(idle, 4, now).outcome, "HEALTHY");
});

// ---------- API ile uctan uca ----------
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

function nextOpenDate(offset = 1) {
  let d = addDays(localNow().date, offset);
  while (dayOfWeek(d) === 6) d = addDays(d, 1);
  return d;
}

const ctx = {};

test("API: varsayilan mod MANUAL -> randevu onay bekler ve kaydedilir", async () => {
  const r = await call("POST", "/auth/register-shop", {
    shopName: "Karar Berber", slug: "karar", ownerName: "Yasin", email: "k@test.com", password: "gizli1234",
  });
  assert.equal(r.status, 201);
  ctx.t = r.body.data.token;
  ctx.svc = (await call("GET", "/public/shops/karar")).body.data.services[0].id;
  const b = await call("POST", "/public/shops/karar/appointments", {
    serviceId: ctx.svc, date: nextOpenDate(), time: "10:00", customerName: "Ali", customerPhone: "0555 111 22 33",
  });
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.equal(b.body.data.status, "PENDING");
  const log = await call("GET", "/shop/decisions/log", null, ctx.t);
  assert.equal(log.body.data[0].outcome, "REVIEW");
  assert.equal(log.body.data[0].reasons[0].code, "ELLE_ONAY_MODU");
  assert.ok(!JSON.stringify(log.body.data).includes("5551112233"), "tam telefon kayitta olmamali");
});

test("API: ayarlar yalnizca gecerli degerlerle degisir", async () => {
  assert.equal((await call("PATCH", "/shop/decisions/settings", { confirmMode: "HEPSI" }, ctx.t)).status, 400);
  assert.equal((await call("PATCH", "/shop/decisions/settings", { noShowLimit: 0 }, ctx.t)).status, 400);
  const ok = await call("PATCH", "/shop/decisions/settings", { confirmMode: "TRUSTED", noShowLimit: 2 }, ctx.t);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.confirmMode, "TRUSTED");
  assert.equal((await call("GET", "/shop/decisions/settings")).status, 401);
});

test("API: gelen musteri sonraki randevuda otomatik onaylanir; gelmeyen engellenir", async () => {
  const list = await call("GET", `/shop/appointments?from=${nextOpenDate()}&to=${nextOpenDate()}`, null, ctx.t);
  const first = list.body.data[0];
  assert.equal(first.customer.level, "NEW");
  await call("PATCH", `/shop/appointments/${first.id}`, { status: "COMPLETED" }, ctx.t);

  const again = await call("POST", "/public/shops/karar/appointments", {
    serviceId: ctx.svc, date: nextOpenDate(), time: "12:00", customerName: "Ali", customerPhone: "+90 555 111 22 33",
  });
  assert.equal(again.body.data.status, "CONFIRMED");
  const row = db._tables.appointment.find((a) => a.id === again.body.data.id);
  assert.equal(row.decidedBy, "AUTO");

  // Baska numara 2 kez gelmedi -> sinir 2 -> red
  for (const time of ["14:00", "15:00"]) {
    const x = await call("POST", "/public/shops/karar/appointments", {
      serviceId: ctx.svc, date: nextOpenDate(), time, customerName: "Veli", customerPhone: "05329998877",
    });
    assert.equal(x.status, 201, JSON.stringify(x.body));
    await call("PATCH", `/shop/appointments/${x.body.data.id}`, { status: "NO_SHOW" }, ctx.t);
  }
  const blocked = await call("POST", "/public/shops/karar/appointments", {
    serviceId: ctx.svc, date: nextOpenDate(), time: "16:00", customerName: "Veli", customerPhone: "05329998877",
  });
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.message, /gelinmemiş/);
  const profile = await call("GET", "/shop/customers/profile?phone=05329998877", null, ctx.t);
  assert.equal(profile.body.data.noShow, 2);
  assert.equal(profile.body.data.level, "HIGH");
});

test("API: ayni numaradan fazla aktif randevu reddedilir", async () => {
  await call("PATCH", "/shop/decisions/settings", { confirmMode: "ALL", maxActivePerPhone: 1 }, ctx.t);
  const ok = await call("POST", "/public/shops/karar/appointments", {
    serviceId: ctx.svc, date: nextOpenDate(2), time: "10:00", customerName: "Can", customerPhone: "05441234567",
  });
  assert.equal(ok.status, 201);
  const second = await call("POST", "/public/shops/karar/appointments", {
    serviceId: ctx.svc, date: nextOpenDate(2), time: "11:00", customerName: "Can", customerPhone: "05441234567",
  });
  assert.equal(second.status, 403);
});

test("API: asistan onerileri ve kiraci izolasyonu", async () => {
  const ins = await call("GET", "/shop/decisions/insights", null, ctx.t);
  assert.equal(ins.status, 200);
  const codes = ins.body.data.map((c) => c.code);
  assert.ok(codes.includes("LOGO_YOK"));
  assert.ok(codes.includes("ADRES_YOK"));
  assert.ok(!codes.includes("ONAY_BEKLEYEN")); // ALL modunda bekleyen kalmadi

  // Baska dukkan bu dukkanin kararlarini ve musterisini goremez
  const other = await call("POST", "/auth/register-shop", {
    shopName: "Diger", slug: "diger", ownerName: "Ozan", email: "o@test.com", password: "gizli1234",
  });
  const t2 = other.body.data.token;
  assert.equal((await call("GET", "/shop/decisions/log", null, t2)).body.data.length, 0);
  const p = await call("GET", "/shop/customers/profile?phone=05329998877", null, t2);
  assert.equal(p.body.data.total, 0);
  // Gelmeme gecmisi baska dukkanda engel olmaz
  const svc2 = (await call("GET", "/public/shops/diger")).body.data.services[0].id;
  const b = await call("POST", "/public/shops/diger/appointments", {
    serviceId: svc2, date: nextOpenDate(), time: "10:00", customerName: "Veli", customerPhone: "05329998877",
  });
  assert.equal(b.status, 201);
});

test("API: yonetici dukkan listesinde karar onerisi gorur", async () => {
  const setup = await call("POST", "/admin/setup", { email: "adm@test.com", password: "yonetici12345" });
  const shops = await call("GET", "/admin/shops", null, setup.body.data.token);
  assert.equal(shops.status, 200);
  for (const s of shops.body.data) {
    assert.ok(["SUSPEND_SUGGESTED", "REMIND_PAYMENT", "CHURN_RISK", "HEALTHY"].includes(s.decision.outcome));
    assert.ok(Array.isArray(s.decision.reasons));
  }
});
