// Prisma'nin bu projede kullanilan alt kumesini taklit eden bellek ici veritabani.
// Yalnizca testler icin (gercek Prisma motoru gerektirmez).
const DEFAULTS = {
  shop: () => ({ phone: "", whatsapp: "", address: "", city: "", about: "", logo: "", primaryColor: "#c9a24b",
    accentColor: "#111111", slotMinutes: 30, status: "TRIAL", plan: "BASIC", paidUntil: null }),
  user: () => ({ shopId: null }),
  service: () => ({ description: "", durationMinutes: 30, isActive: true, sortOrder: 0 }),
  workingHour: () => ({ isOpen: true, openTime: "09:00", closeTime: "20:00" }),
  appointment: () => ({ note: "", status: "PENDING" }),
};
const UNIQUE = { shop: ["slug"], user: ["email"] };

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
      async findUnique({ where }) { return copy(tables[model].find((r) => match(r, where))); },
      async findFirst({ where } = {}) { return copy(tables[model].find((r) => match(r, where))); },
      async findMany({ where, orderBy } = {}) {
        return tables[model].filter((r) => match(r, where)).sort(sorter(orderBy)).map(copy);
      },
      async count({ where } = {}) { return tables[model].filter((r) => match(r, where)).length; },
      async create({ data }) {
        for (const field of UNIQUE[model] || []) {
          if (tables[model].some((r) => r[field] === data[field])) throw new Error(`Unique ${model}.${field}`);
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
