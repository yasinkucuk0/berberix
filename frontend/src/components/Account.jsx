import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

// Hesabim: sifre degistirme (sahip ve calisan).
export default function Account() {
  const { user, shop } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", again: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (form.newPassword !== form.again) return setError("Yeni şifreler aynı değil.");
    try {
      await api("/auth/password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm({ currentPassword: "", newPassword: "", again: "" });
      setMsg("Şifren değişti.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <div className="card">
        <div className="cust-row">
          <span className="avatar big"><Icon name="person" /></span>
          <div>
            <h3 style={{ margin: 0 }}>{user?.name}</h3>
            <p className="tiny muted" style={{ margin: 0 }}>{user?.email} · {user?.role === "STAFF" ? "Çalışan" : "Dükkan sahibi"} · {shop?.name}</p>
          </div>
        </div>
      </div>
      <form className="card form-grid" onSubmit={submit}>
        <h3>Şifre değiştir</h3>
        <label>Mevcut şifre<input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required autoComplete="current-password" /></label>
        <label>Yeni şifre (en az 8 karakter)<input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
        <label>Yeni şifre (tekrar)<input type="password" value={form.again} onChange={(e) => setForm({ ...form, again: e.target.value })} required autoComplete="new-password" /></label>
        {error && <div className="alert">{error}</div>}
        {msg && <div className="notice tiny">{msg}</div>}
        <button className="btn">Şifreyi değiştir</button>
      </form>
    </section>
  );
}
