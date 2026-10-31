import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

const STATUS = { TRIAL: "Deneme", ACTIVE: "Aktif", SUSPENDED: "Askıda" };
const fmt = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "-");

function AdminLoginOrSetup() {
  const { signIn } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/admin/setup-status", { auth: false }).then((d) => setNeedsSetup(d.needsSetup)).catch((e) => setError(e.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const path = needsSetup ? "/admin/setup" : "/auth/login";
      const data = await api(path, { method: "POST", auth: false, body: form });
      if (data.user.role !== "PLATFORM_ADMIN") throw new Error("Bu hesap platform yöneticisi değil.");
      signIn(data);
    } catch (err) {
      setError(err.message);
    }
  };

  if (needsSetup === null && !error) return <div className="center muted">Yükleniyor…</div>;

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <Link to="/" className="brand">✂ Berberim</Link>
        <h2>{needsSetup ? "Platform yöneticisi oluştur" : "Yönetici girişi"}</h2>
        {needsSetup && <p className="tiny muted">Bu ekran bir kez görünür ve yalnızca sunucunun çalıştığı bilgisayardan kullanılabilir.</p>}
        {needsSetup && <label>Adın<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
        <label>E-posta<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Şifre{needsSetup && " (en az 10 karakter)"}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {error && <div className="alert">{error}</div>}
        <button className="btn btn-block">{needsSetup ? "Oluştur" : "Giriş yap"}</button>
      </form>
    </div>
  );
}

export default function Admin() {
  const { user, loading, signOut } = useAuth();
  const [shops, setShops] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("/admin/shops").then(setShops).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (user?.role === "PLATFORM_ADMIN") load();
  }, [user, load]);

  if (loading) return <div className="center muted">Yükleniyor…</div>;
  if (!user || user.role !== "PLATFORM_ADMIN") return <AdminLoginOrSetup />;

  const update = async (id, body) => {
    try {
      await api(`/admin/shops/${id}`, { method: "PATCH", body });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const active = shops.filter((s) => s.acceptingBookings).length;

  return (
    <div className="admin">
      <header className="panel-head">
        <strong>✂ Berberim Yönetim</strong>
        <button className="btn btn-ghost btn-small" onClick={signOut}>Çıkış</button>
      </header>
      <div className="stats">
        <div className="stat"><b>{shops.length}</b><small>Dükkan</small></div>
        <div className="stat"><b>{active}</b><small>Randevu açık</small></div>
        <div className="stat"><b>{shops.filter((s) => s.status === "ACTIVE").length}</b><small>Ücretli</small></div>
      </div>
      {error && <div className="alert">{error}</div>}
      <ul className="admin-list">
        {shops.map((s) => (
          <li key={s.id} className="card">
            <div className="admin-row">
              <div>
                <strong>{s.name}</strong> <a className="link tiny" href={`/${s.slug}`} target="_blank" rel="noreferrer">/{s.slug}</a>
                <div className="tiny muted">{s.owner?.name} • {s.owner?.email} • {s.phone || "telefon yok"}</div>
                <div className="tiny muted">
                  Kayıt {fmt(s.createdAt)} • {s.appointmentCount} randevu •{" "}
                  {s.status === "TRIAL" ? `deneme bitişi ${fmt(s.trialEndsAt)}` : `ödeme bitişi ${fmt(s.paidUntil)}`}
                </div>
              </div>
              <span className={`badge ${s.acceptingBookings ? "st-ok" : "st-cancel"}`}>{STATUS[s.status]}</span>
            </div>
            <div className="appt-buttons">
              <button className="btn btn-small" onClick={() => update(s.id, { status: "ACTIVE", extendDays: 30 })}>Ödeme alındı (+30 gün)</button>
              <button className="btn btn-ghost btn-small" onClick={() => update(s.id, { status: "TRIAL", extendDays: 7 })}>Deneme +7 gün</button>
              {s.status !== "SUSPENDED"
                ? <button className="btn btn-ghost btn-small" onClick={() => update(s.id, { status: "SUSPENDED" })}>Askıya al</button>
                : <button className="btn btn-ghost btn-small" onClick={() => update(s.id, { status: "ACTIVE" })}>Yeniden aç</button>}
            </div>
          </li>
        ))}
      </ul>
      {shops.length === 0 && <p className="muted center">Henüz dükkan yok. İlk dükkanı <Link className="link" to="/kayit">buradan</Link> oluştur.</p>}
    </div>
  );
}
