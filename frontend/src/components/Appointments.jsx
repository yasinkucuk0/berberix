import { useCallback, useEffect, useState } from "react";
import { api, dateLabel, money, todayStr, waLink } from "../lib/api";

const STATUS = {
  PENDING: ["Bekliyor", "st-pending"],
  CONFIRMED: ["Onaylandı", "st-ok"],
  COMPLETED: ["Tamamlandı", "st-done"],
  CANCELLED: ["İptal", "st-cancel"],
  NO_SHOW: ["Gelmedi", "st-cancel"],
};

export default function Appointments() {
  const [date, setDate] = useState(todayStr());
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  const setStatus = async (id, status) => {
    try {
      await api(`/shop/appointments/${id}`, { method: "PATCH", body: { status } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const days = [-1, 0, 1, 2, 3, 4, 5].map((o) => todayStr(o));

  return (
    <section>
      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.today}</b><small>Bugün</small></div>
          <div className="stat"><b>{stats.pending}</b><small>Onay bekleyen</small></div>
          <div className="stat"><b>{money(stats.weekRevenue)}</b><small>7 günlük kazanç</small></div>
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

      {error && <div className="alert">{error}</div>}
      {loading && list.length === 0 && <p className="muted center">Yükleniyor…</p>}
      {!loading && list.length === 0 && <p className="muted center empty">Bu gün için randevu yok.</p>}

      <ul className="appt-list">
        {list.map((a) => (
          <li key={a.id} className={`card appt ${STATUS[a.status][1]}`}>
            <div className="appt-time">{a.start}<small>{a.end}</small></div>
            <div className="appt-info">
              <strong>{a.customerName}</strong>
              <div className="tiny muted">{a.serviceName} • {money(a.price)}</div>
              {a.note && <div className="tiny">“{a.note}”</div>}
              <div className="appt-actions">
                <span className={`badge ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
                <a className="link tiny" href={`tel:${a.customerPhone}`}>Ara</a>
                <a className="link tiny" href={waLink(a.customerPhone, `Merhaba ${a.customerName}, ${dateLabel(a.date)} ${a.start} randevunuz hakkında yazıyorum.`)} target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
              {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                <div className="appt-buttons">
                  {a.status === "PENDING" && <button className="btn btn-small" onClick={() => setStatus(a.id, "CONFIRMED")}>Onayla</button>}
                  <button className="btn btn-small" onClick={() => setStatus(a.id, "COMPLETED")}>Tamamlandı</button>
                  <button className="btn btn-ghost btn-small" onClick={() => setStatus(a.id, "NO_SHOW")}>Gelmedi</button>
                  <button className="btn btn-ghost btn-small" onClick={() => setStatus(a.id, "CANCELLED")}>İptal</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
