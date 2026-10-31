import { useEffect, useState } from "react";
import { api } from "../lib/api";

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

  return (
    <section className="card">
      <h3>Çalışma saatleri</h3>
      <p className="tiny muted">Kapalı günlerde ve saat dışında müşteri randevu alamaz.</p>
      {hours.map((h, i) => (
        <div key={h.dayOfWeek} className="hour-row">
          <label className="switch">
            <input type="checkbox" checked={h.isOpen} onChange={(e) => update(i, { isOpen: e.target.checked })} />
            <span>{h.day}</span>
          </label>
          {h.isOpen ? (
            <div className="row">
              <input type="time" value={h.openTime} onChange={(e) => update(i, { openTime: e.target.value })} />
              <span className="muted">–</span>
              <input type="time" value={h.closeTime} onChange={(e) => update(i, { closeTime: e.target.value })} />
            </div>
          ) : <span className="muted tiny">Kapalı</span>}
        </div>
      ))}
      {error && <div className="alert">{error}</div>}
      {msg && <div className="notice">{msg}</div>}
      <button className="btn btn-block" onClick={save}>Kaydet</button>
    </section>
  );
}
