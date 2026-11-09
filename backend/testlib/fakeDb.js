// Prisma'nin bu projede kullanilan alt kumesini taklit eden bellek ici veritabani.
// Yalnizca testler icin (gercek Prisma motoru gerektirmez).
const DEFAULTS = {
  shop: () => ({ phone: "", whatsapp: "", address: "", city: "", about: "", logo: "", primaryColor: "#c9a24b",
    accentColor: "#111111", slotMinutes: 30, status: "TRIAL", plan: "BASIC", paidUntil: null,
    confirmMode: "MANUAL", noShowLimit: 3, maxActivePerPhone: 2, isDemo: false, termsAcceptedAt: null, loyaltyEvery: 0 }),
  user: () => ({ shopId: null, barberId: null }),
  service: () => ({ description: "", durationMinutes: 30, isActive: true, sortOrder: 0 }),
  workingHour: () => ({ isOpen: true, openTime: "09:00", closeTime: "20:00", breakStart: "", breakEnd: "" }),
  closedDay: () => ({ reason: "" }),
  appointment: () => ({ note: "", status: "PENDING", customerKey: "", decidedBy: "", barberId: null, barberName: "",
    kvkkAcceptedAt: null, marketingConsent: false, manageToken: null, cancelledBy: "", loyaltyReward: false }),
  barber: () => ({ title: "", offDays: "", isActive: true, sortOrder: 0 }),
  decisionLog: () => ({ subject: "", reasons: "[]" }),
  customerNote: () => ({ note: "" }),
  cashEntry: () => ({ method: "CASH", note: "", appointmentId: null }),
};
const UNIQUE = { shop: ["slug"], user: ["email"] };
const UNIQUE_NULLABLE = { cashEntry: ["appointmentId"], appointment: ["manageToken"] };

function match(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(value)) return false;
      if ("gte" in cond && !(value >= cond.gte)) return false;
      if ("lte" in cond && !(value <= cond.lte)) return false;
      if ("gt" in cond && !(value > cond.gt)) return false;
      if ("lt" in cond && !(value < cond.lt)) return false;
      if ("not" in cond && value === cond.not) return false;
      return true;
    }
    return value === cond;
  });
}

// Prisma bilesik benzersiz anahtar: { shopId_customerKey: { shopId, customerKey } } -> duz kosul
function flat(where = {}) {
  const out = {};
  for (const [k, v] of Object.entries(where)) {
    if (k.includes("_") && v && typeof v === "object" && !(v instanceof Date)) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function sorter(orderBy) {
  const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return (a, b) => {
    for (const o of list) {
      const [key, dir] = Object.entries(o)[0];
      if (a[key] < b[key]) return dir === "asc" ? -1 : 1;
      if (a[key] > b[key]) return dir === "asc" ? 1 : -1;
    }
    return 0;
  };
}

function createFakeDb() {
  const tables = {};
  const ids = {};
  const api = {};
  for (const model of Object.keys(DEFAULTS)) {
    tables[model] = [];
    ids[model] = 0;
    const copy = (r) => (r ? { ...r } : null);
    api[model] = {
      async findUnique({ where }) { return copy(tables[model].find((r) => match(r, flat(where)))); },
      async findFirst({ where } = {}) { return copy(tables[model].find((r) => match(r, where))); },
      async findMany({ where, orderBy, take } = {}) {
        const rows = tables[model].filter((r) => match(r, where)).sort(sorter(orderBy)).map(copy);
        return take ? rows.slice(0, take) : rows;
      },
      async count({ where } = {}) { return tables[model].filter((r) => match(r, where)).length; },
      async create({ data }) {
        for (const field of UNIQUE[model] || []) {
          if (tables[model].some((r) => r[field] === data[field])) throw new Error(`Unique ${model}.${field}`);
        }
        for (const field of UNIQUE_NULLABLE[model] || []) {
          if (data[field] != null && tables[model].some((r) => r[field] === data[field])) throw new Error(`Unique ${model}.${field}`);
        }
        const now = new Date();
        const row = { ...DEFAULTS[model](), ...data, id: ++ids[model], createdAt: now, updatedAt: now };
        tables[model].push(row);
        return copy(row);
      },
      async update({ where, data }) {
        const row = tables[model].find((r) => match(r, where));
        if (!row) throw new Error(`${model} bulunamadi`);
        Object.assign(row, data, { updatedAt: new Date() });
        return copy(row);
      },
      async createMany({ data }) {
        for (const row of data) await api[model].create({ data: row });
        return { count: data.length };
      },
      async upsert({ where, create, update }) {
        const row = tables[model].find((r) => match(r, flat(where)));
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
          return copy(row);
        }
        return api[model].create({ data: create });
      },
      async delete({ where }) {
        const i = tables[model].findIndex((r) => match(r, where));
        if (i < 0) throw new Error(`${model} bulunamadi`);
        return tables[model].splice(i, 1)[0];
      },
      async deleteMany({ where } = {}) {
        const before = tables[model].length;
        tables[model] = tables[model].filter((r) => !match(r, where));
        return { count: before - tables[model].length };
      },
      async updateMany({ where, data }) {
        const rows = tables[model].filter((r) => match(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    };
  }
  api.$transaction = async (fn) => fn(api);
  api._tables = tables;
  return api;
}

module.exports = { createFakeDb };
