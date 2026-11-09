import { useCallback, useEffect, useState } from "react";
import { api, dateLabel, money, todayStr } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

// Kasa: tamamlanan randevular otomatik gelir yazar; urun satisi, bahsis ve giderler elle girilir.
const METHOD = { CASH: "Nakit", CARD: "Kart", TRANSFER: "Havale" };
const METHOD_ICON = { CASH: "cash", CARD: "card", TRANSFER: "bank" };

function EntryForm({ meta, date, onDone, onCancel }) {
  const [type, setType] = useState("INCOME");
  const [form, setForm] = useState({ category: "Ürün satışı", amount: "", method: "CASH", note: "" });
  const [error, setError] = useState("");
  const categories = type === "INCOME" ? meta.income.filter((c) => c !== "Hizmet") : meta.expense;

  const pickType = (t) => {
    setType(t);
    setForm({ ...form, category: t === "INCOME" ? "Ürün satışı" : "Malzeme" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/shop/cash", { method: "POST", body: { ...form, type, amount: Number(form.amount), date } });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <div className="seg-toggle">
        <button type="button" className={type === "INCOME" ? "chip active" : "chip"} onClick={() => pickType("INCOME")}>Gelir</button>
        <button type="button" className={type === "EXPENSE" ? "chip active" : "chip"} onClick={() => pickType("EXPENSE")}>Gider</button>
      </div>
      <div className="row">
        <label>Kategori
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Tutar (₺)
          <input type="number" inputMode="numeric" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </label>
      </div>
      <label>Ödeme
        <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
          {meta.methods.map((m) => <option key={m} value={m}>{METHOD[m]}</option>)}
        </select>
      </label>
      <label>Not (isteğe bağlı)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Örn: 2 wax, kira Kasım" /></label>
      {error && <div className="alert">{error}</div>}
      <div className="row">
        <button className="btn">Kaydet</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Vazgeç</button>
      </div>
    </form>
  );
}

export default function Cash() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState(null);
  const [report, setReport] = useState(null);
  const [meta, setMeta] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([api(`/shop/cash?date=${date}`), api(`/shop/cash/report?to=${todayStr()}`)]);
      setDay(d);
      setReport(r);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("/shop/cash/meta").then(setMeta).catch(() => {}); }, []);

  const remove = async (id) => {
    try {
      await api(`/shop/cash/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const s = day?.summary;
  const last7 = report?.days.slice(-7) || [];
  const max = Math.max(1, ...last7.map((d) => d.income));

  return (
    <section>
      <div className="day-strip">
        {[-2, -1, 0].map((o) => todayStr(o)).map((d) => (
          <button key={d} className={d === date ? "chip active" : "chip"} onClick={() => setDate(d)}>
            {d === todayStr() ? "Bugün" : dateLabel(d)}
          </button>
        ))}
        <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="date-input" />
      </div>

      {s && (
        <div className="stats">
          <div className="stat"><b>{money(s.income)}</b><small>Gelir</small></div>
          <div className="stat"><b className="err">{money(s.expense)}</b><small>Gider</small></div>
          <div className="stat accent"><b>{money(s.net)}</b><small>Net kasa</small></div>
        </div>
      )}
      {s && s.income > 0 && (
        <p className="tiny muted pay-split">
          {Object.entries(s.byMethod).filter(([, v]) => v > 0).map(([m, v]) => (
            <span key={m}><Icon name={METHOD_ICON[m]} />{METHOD[m]} {money(v)}</span>
          ))}
        </p>
      )}

      {day?.byBarber?.length > 0 && (day.byBarber.length > 1 || day.byBarber[0].name !== "Atanmamış") && (
        <div className="card">
          <h3 className="section-title"><Icon name="scissors" />Berberlere göre</h3>
          <p className="tiny muted">Bu gün tamamlanan randevular (prim hesabı için).</p>
          <ul className="hours-list">
            {day.byBarber.map((b) => (
              <li key={b.name}><span>{b.name} <small className="muted">• {b.count} müşteri</small></span><b>{money(b.revenue)}</b></li>
            ))}
          </ul>
        </div>
      )}

      {adding && meta
        ? <EntryForm meta={meta} date={date} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
        : <button className="btn btn-block add-btn" onClick={() => setAdding(true)}><Icon name="plus" />Satış ya da gider ekle</button>}

      {error && <div className="alert">{error}</div>}

      <div className="card">
        <h3 className="section-title"><Icon name="history" />Hareketler</h3>
        <p className="tiny muted">Randevuyu “Tamamlandı” yapınca ücreti buraya kendiliğinden yazılır.</p>
        {day?.entries.length === 0 && <p className="muted">Bu gün kasa hareketi yok.</p>}
        <ul className="hours-list">
          {day?.entries.map((e) => (
            <li key={e.id} className="entry">
              <span className="avatar"><Icon name={METHOD_ICON[e.method]} /></span>
              <span className="entry-main">
                <span>{e.category}</span>
                <small className="muted block">{e.note || METHOD[e.method]}{e.auto ? " · randevudan" : ""}</small>
              </span>
              <span className="entry-side">
                <span className={e.type === "EXPENSE" ? "entry-amount err" : "entry-amount"}>{e.type === "EXPENSE" ? "−" : "+"}{money(e.amount)}</span>
                {!e.auto && user?.role === "OWNER" && <button className="link tiny plain block" onClick={() => remove(e.id)}>Sil</button>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {report && (
        <div className="card">
          <h3 className="section-title"><Icon name="chart" />Son 7 gün</h3>
          <div className="bars">
            {last7.map((d) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${money(d.income)}`}>
                <small className="muted">{d.income ? money(d.income).replace(" ₺", "") : ""}</small>
                <div className="bar" style={{ height: `${Math.round((d.income / max) * 100)}%` }} />
                <small className="muted">{dateLabel(d.date).split(" ")[0]}</small>
              </div>
            ))}
          </div>
          <p className="tiny muted">Son 30 gün: gelir {money(report.total.income)} • gider {money(report.total.expense)} • net <b>{money(report.total.net)}</b></p>
        </div>
      )}
    </section>
  );
}
