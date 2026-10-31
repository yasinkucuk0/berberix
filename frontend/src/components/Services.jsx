import { useEffect, useState } from "react";
import { api, money } from "../lib/api";

const EMPTY = { name: "", price: "", durationMinutes: "30", description: "" };

export default function Services() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/shop/services").then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    const body = { ...form, price: Number(form.price), durationMinutes: Number(form.durationMinutes) };
    try {
      if (editing) await api(`/shop/services/${editing}`, { method: "PATCH", body });
      else await api("/shop/services", { method: "POST", body });
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (s) => {
    try {
      await api(`/shop/services/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = (s) => {
    setEditing(s.id);
    setForm({ name: s.name, price: String(s.price), durationMinutes: String(s.durationMinutes), description: s.description || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section>
      <form className="card form-grid" onSubmit={save}>
        <h3>{editing ? "Hizmeti düzenle" : "Yeni hizmet"}</h3>
        <label>Hizmet adı<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <div className="row">
          <label>Fiyat (₺)<input type="number" min="0" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label>Süre (dk)<input type="number" min="5" step="5" inputMode="numeric" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} required /></label>
        </div>
        <label>Açıklama (isteğe bağlı)<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        {error && <div className="alert">{error}</div>}
        <div className="row">
          <button className="btn">{editing ? "Kaydet" : "Ekle"}</button>
          {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setForm(EMPTY); }}>Vazgeç</button>}
        </div>
      </form>

      <ul className="svc-list">
        {list.map((s) => (
          <li key={s.id} className={`card svc ${s.isActive ? "" : "off"}`}>
            <div>
              <strong>{s.name}</strong>
              <div className="tiny muted">{s.durationMinutes} dk {s.isActive ? "" : "• sitede gizli"}</div>
            </div>
            <div className="svc-right">
              <b>{money(s.price)}</b>
              <div className="row">
                <button className="btn btn-ghost btn-small" onClick={() => edit(s)}>Düzenle</button>
                <button className="btn btn-ghost btn-small" onClick={() => toggle(s)}>{s.isActive ? "Gizle" : "Göster"}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
