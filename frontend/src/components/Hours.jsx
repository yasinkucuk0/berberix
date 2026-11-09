import { useEffect, useState } from "react";
import { api, dateLabel, todayStr } from "../lib/api";
import Icon from "./Icon.jsx";

// Calisma saatleri + ogle arasi + ozel kapali gunler (bayram, tatil).
function ClosedDays() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ date: todayStr(1), reason: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = () => api("/shop/closed-days").then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const r = await api("/shop/closed-days", { method: "POST", body: form });
      setMsg(r.affected
        ? `${dateLabel(r.date)} kapatıldı. O gün daha önce alınmış ${r.affected} randevu var; müşterileri arayıp başka güne al.`
        : `${dateLabel(r.date)} kapatıldı. O gün online randevu alınmaz.`);
      setForm({ ...form, reason: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api(`/shop/closed-days/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form-grid" onSubmit={add}>
      <h3 className="section-title"><Icon name="calendar" />Kapalı günler</h3>
      <p className="tiny muted">Bayram, tatil ya da özel bir gün. Seçtiğin gün müşteriler online randevu alamaz.</p>
      <div className="row">
        <label>Tarih<input type="date" value={form.date} min={todayStr()} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
        <label>Neden (isteğe bağlı)<input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Bayram" maxLength={60} /></label>
      </div>
      {error && <div className="alert">{error}</div>}
      {msg && <div className="notice tiny">{msg}</div>}
      <button className="btn btn-ghost"><Icon name="plus" />Günü kapat</button>
      {list.length > 0 && (
        <ul className="hours-list">
          {list.map((d) => (
            <li key={d.id}>
              <span>{dateLabel(d.date)}{d.reason && <small className="muted"> · {d.reason}</small>}</span>
              <button type="button" className="link tiny plain" onClick={() => remove(d.id)}>Aç</button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default function Hours() {
  const [hours, setHours] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api("/shop/hours").then(setHours).catch((e) => setError(e.message)); }, []);

  const update = (i, patch) => setHours(hours.map((h, j) => (i === j ? { ...h, ...patch } : h)));

  const save = async () => {
    setError("");
    setMsg("");
    try {
      const saved = await api("/shop/hours", { method: "PUT", body: { hours } });
      setHours(saved);
      setMsg("Çalışma saatleri kaydedildi.");
    } catch (err) {
      setError(err.message);
    }
  };

  // Ogle arasini tek seferde tum acik gunlere uygula
  const breakForAll = (start, end) => setHours(hours.map((h) => ({ ...h, breakStart: start, breakEnd: end })));

  return (
    <section>
      <div className="card">
        <h3 className="section-title"><Icon name="clock" />Çalışma saatleri</h3>
        <p className="tiny muted">Kapalı günlerde, saat dışında ve öğle arasında müşteri randevu alamaz.</p>
        {hours.map((h, i) => (
          <div key={h.dayOfWeek} className="hour-row">
            <label className="switch">
              <input type="checkbox" checked={h.isOpen} onChange={(e) => update(i, { isOpen: e.target.checked })} />
              <span>{h.day}</span>
            </label>
            {h.isOpen ? (
              <div className="hour-times">
                <div className="row">
                  <input type="time" value={h.openTime} onChange={(e) => update(i, { openTime: e.target.value })} aria-label={`${h.day} açılış`} />
                  <span className="muted">–</span>
                  <input type="time" value={h.closeTime} onChange={(e) => update(i, { closeTime: e.target.value })} aria-label={`${h.day} kapanış`} />
                </div>
                {h.breakStart ? (
                  <div className="row break-row">
                    <small className="muted">Ara</small>
                    <input type="time" value={h.breakStart} onChange={(e) => update(i, { breakStart: e.target.value })} aria-label={`${h.day} ara başlangıç`} />
                    <span className="muted">–</span>
                    <input type="time" value={h.breakEnd} onChange={(e) => update(i, { breakEnd: e.target.value })} aria-label={`${h.day} ara bitiş`} />
                    <button type="button" className="link tiny plain" onClick={() => update(i, { breakStart: "", breakEnd: "" })}>Kaldır</button>
                  </div>
                ) : (
                  <button type="button" className="link tiny plain" onClick={() => update(i, { breakStart: "12:30", breakEnd: "13:30" })}>+ Öğle arası</button>
                )}
              </div>
            ) : <span className="muted tiny">Kapalı</span>}
          </div>
        ))}
        <p className="tiny muted" style={{ marginTop: 12 }}>
          Hızlı: <button type="button" className="link tiny plain" onClick={() => breakForAll("12:30", "13:30")}>Her güne 12:30–13:30 öğle arası</button>
          {" · "}<button type="button" className="link tiny plain" onClick={() => breakForAll("", "")}>Araları kaldır</button>
        </p>
        {error && <div className="alert">{error}</div>}
        {msg && <div className="notice tiny">{msg}</div>}
        <button className="btn btn-block" onClick={save}>Kaydet</button>
      </div>
      <ClosedDays />
    </section>
  );
}
