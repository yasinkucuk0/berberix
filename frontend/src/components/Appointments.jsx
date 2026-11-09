import { useCallback, useEffect, useState } from "react";
import { api, dateLabel, money, todayStr, waLink } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

// Randevu hatirlatmasi hizmet mesajidir (pazarlama degil); KVKK acik rizasi gerekmez.
function reminderText(a, shopName) {
  const first = String(a.customerName || "").split(" ")[0];
  const when = a.date === todayStr() ? "bugün" : a.date === todayStr(1) ? "yarın" : dateLabel(a.date);
  return `Merhaba ${first}, ${shopName} randevunu hatırlatırız: ${when} saat ${a.start}${a.barberName ? ` (${a.barberName})` : ""}. Gelemeyeceksen lütfen haber ver. Görüşmek üzere.`;
}

const STATUS = {
  PENDING: ["Bekliyor", "st-pending"],
  CONFIRMED: ["Onaylandı", "st-ok"],
  COMPLETED: ["Tamamlandı", "st-done"],
  CANCELLED: ["İptal", "st-cancel"],
  NO_SHOW: ["Gelmedi", "st-cancel"],
};

// Karar motorunun musteri profili (dukkan bazinda gecmis)
function CustomerTag({ c }) {
  if (!c) return null;
  if (c.level === "HIGH" || c.level === "MEDIUM") {
    return <span className={`badge ${c.level === "HIGH" ? "st-cancel" : "st-pending"}`}><Icon name="warning" />{c.noShow} gelmedi · {c.cancelled} iptal</span>;
  }
  if (c.loyal) return <span className="badge st-gold"><Icon name="star" />Sadık · {c.completed} ziyaret</span>;
  if (c.level === "NEW") return <span className="badge">Yeni müşteri</span>;
  return <span className="badge st-done">{c.completed} ziyaret</span>;
}

function AddAppointment({ date, barbers, barberId, onDone, onCancel }) {
  const [services, setServices] = useState([]);
  const activeBarbers = barbers.filter((b) => b.isActive);
  const [form, setForm] = useState({
    serviceId: "", date, time: "10:00", customerName: "", customerPhone: "", note: "",
    barberId: String(barberId || activeBarbers[0]?.id || ""),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/shop/services").then((list) => {
      const active = list.filter((s) => s.isActive);
      setServices(active);
      if (active[0]) setForm((f) => ({ ...f, serviceId: String(active[0].id) }));
    }).catch((e) => setError(e.message));
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/shop/appointments", {
        method: "POST",
        body: { ...form, serviceId: Number(form.serviceId), barberId: form.barberId ? Number(form.barberId) : undefined },
      });
      onDone(form.date);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h3>Randevu ekle</h3>
      <p className="tiny muted">Telefonla ya da dükkanda aldığın randevuyu buraya yaz; site o saati dolu gösterir.</p>
      <label>
        Hizmet
        <select value={form.serviceId} onChange={set("serviceId")} required>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} • {money(s.price)} • {s.durationMinutes} dk</option>)}
        </select>
      </label>
      {activeBarbers.length > 0 && (
        <label>
          Berber
          <select value={form.barberId} onChange={set("barberId")} required>
            {activeBarbers.map((b) => <option key={b.id} value={b.id}>{b.name}{b.title ? ` • ${b.title}` : ""}</option>)}
          </select>
        </label>
      )}
      <div className="row">
        <label>Tarih<input type="date" value={form.date} onChange={set("date")} required /></label>
        <label>Saat<input type="time" value={form.time} onChange={set("time")} required /></label>
      </div>
      <label>Müşteri adı<input value={form.customerName} onChange={set("customerName")} required /></label>
      <label>Telefon (isteğe bağlı)<input value={form.customerPhone} onChange={set("customerPhone")} inputMode="tel" /></label>
      <label>Not (isteğe bağlı)<input value={form.note} onChange={set("note")} /></label>
      {error && <div className="alert">{error}</div>}
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? "Ekleniyor…" : "Ekle"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Vazgeç</button>
      </div>
    </form>
  );
}

export default function Appointments() {
  const { shop, user } = useAuth();
  const isStaff = user?.role === "STAFF";
  const [date, setDate] = useState(todayStr());
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [barbers, setBarbers] = useState([]);
  const [barberFilter, setBarberFilter] = useState("");

  useEffect(() => { api("/shop/barbers").then(setBarbers).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, s] = await Promise.all([api(`/shop/appointments?from=${date}&to=${date}`), api("/shop/stats")]);
      setList(items);
      setStats(s);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000); // yeni randevular icin dakikada bir yenile
    return () => clearInterval(timer);
  }, [load]);

  const [paying, setPaying] = useState(null); // tamamlanirken odeme yontemi sorulan randevu

  const moveTo = async (id, barberId) => {
    try {
      await api(`/shop/appointments/${id}`, { method: "PATCH", body: { barberId: Number(barberId) } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setStatus = async (id, status, paymentMethod) => {
    setPaying(null);
    try {
      await api(`/shop/appointments/${id}`, { method: "PATCH", body: { status, paymentMethod } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const days = [-1, 0, 1, 2, 3, 4, 5].map((o) => todayStr(o));
  const activeBarbers = isStaff ? [] : barbers.filter((b) => b.isActive);
  const shown = barberFilter ? list.filter((a) => a.barberId === Number(barberFilter)) : list;

  return (
    <section>
      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.today}</b><small>Bugün</small></div>
          <div className="stat"><b>{stats.pending}</b><small>Onay bekleyen</small></div>
          <div className="stat accent"><b>{money(stats.weekRevenue)}</b><small>Son 7 gün</small></div>
        </div>
      )}

      <div className="day-strip">
        {days.map((d) => (
          <button key={d} className={d === date ? "chip active" : "chip"} onClick={() => setDate(d)}>
            {d === todayStr() ? "Bugün" : dateLabel(d)}
          </button>
        ))}
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="date-input" />
      </div>
      {activeBarbers.length > 0 && (
        <div className="day-strip">
          <button className={barberFilter === "" ? "chip active" : "chip"} onClick={() => setBarberFilter("")}>Tüm berberler</button>
          {activeBarbers.map((b) => {
            const n = list.filter((a) => a.barberId === b.id && a.status !== "CANCELLED").length;
            return (
              <button key={b.id} className={barberFilter === String(b.id) ? "chip active" : "chip"} onClick={() => setBarberFilter(String(b.id))}>
                {b.name}{n ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
      )}

      {adding ? (
        <AddAppointment
          date={date}
          barbers={isStaff ? [] : barbers}
          barberId={barberFilter}
          onCancel={() => setAdding(false)}
          onDone={(d) => { setAdding(false); if (d === date) load(); else setDate(d); }}
        />
      ) : (
        <button className="btn btn-block add-btn" onClick={() => setAdding(true)}><Icon name="plus" />Randevu ekle</button>
      )}

      {error && <div className="alert">{error}</div>}
      {loading && list.length === 0 && <p className="muted center">Yükleniyor…</p>}
      {!loading && shown.length === 0 && <p className="muted center empty">Bu gün için randevu yok.</p>}

      <ul className="appt-list">
        {shown.map((a) => (
          <li key={a.id} className={`card appt ${STATUS[a.status][1]}`}>
            <div className="appt-time">{a.start}<small>{a.end}</small></div>
            <div className="appt-info">
              <strong>{a.customerName}</strong>
              <div className="tiny muted">{a.serviceName} • {money(a.price)}</div>
              {a.note && <div className="tiny">“{a.note}”</div>}
              <div className="appt-tags">
                {a.barberName && <span className="badge"><Icon name="scissors" />{a.barberName}</span>}
                <CustomerTag c={a.customer} />
                {a.decidedBy === "AUTO" && <span className="badge st-gold"><Icon name="sparkles" />Otomatik onay</span>}
                {a.loyaltyReward && <span className="badge st-gold"><Icon name="star" />Sadakat hediyesi</span>}
                {a.cancelledBy === "CUSTOMER" && <span className="badge st-cancel">Müşteri iptal etti</span>}
              </div>
              <div className="appt-actions">
                <span className={`badge ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
                <a className="link tiny" href={`tel:${a.customerPhone}`}><Icon name="phone" />Ara</a>
                {(a.status === "PENDING" || a.status === "CONFIRMED") && a.date >= todayStr() && a.customerPhone ? (
                  <a className="link tiny" href={waLink(a.customerPhone, reminderText(a, shop?.name || ""))} target="_blank" rel="noreferrer"><Icon name="bell" />Hatırlat</a>
                ) : (
                  <a className="link tiny" href={waLink(a.customerPhone, `Merhaba ${a.customerName}, ${dateLabel(a.date)} ${a.start} randevunuz hakkında yazıyorum.`)} target="_blank" rel="noreferrer"><Icon name="message" />WhatsApp</a>
                )}
              </div>
              {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                <div className="appt-buttons">
                  {a.status === "PENDING" && <button className="btn btn-small" onClick={() => setStatus(a.id, "CONFIRMED")}>Onayla</button>}
                  <button className="btn btn-small" onClick={() => setPaying(paying === a.id ? null : a.id)}>Tamamlandı</button>
                  <button className="btn btn-ghost btn-small" onClick={() => setStatus(a.id, "NO_SHOW")}>Gelmedi</button>
                  <button className="btn btn-ghost btn-small" onClick={() => setStatus(a.id, "CANCELLED")}>İptal</button>
                </div>
              )}
              {(a.status === "PENDING" || a.status === "CONFIRMED") && activeBarbers.length > 1 && (
                <select className="move-select" value="" onChange={(e) => e.target.value && moveTo(a.id, e.target.value)}>
                  <option value="">Başka berbere aktar…</option>
                  {activeBarbers.filter((b) => b.id !== a.barberId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {paying === a.id && (
                <div className="pay-pick">
                  <small className="muted">Nasıl ödedi? ({money(a.price)} kasaya yazılır)</small>
                  <div className="appt-buttons">
                    <button className="btn btn-small" onClick={() => setStatus(a.id, "COMPLETED", "CASH")}><Icon name="cash" />Nakit</button>
                    <button className="btn btn-small" onClick={() => setStatus(a.id, "COMPLETED", "CARD")}><Icon name="card" />Kart</button>
                    <button className="btn btn-ghost btn-small" onClick={() => setStatus(a.id, "COMPLETED", "TRANSFER")}><Icon name="bank" />Havale</button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
