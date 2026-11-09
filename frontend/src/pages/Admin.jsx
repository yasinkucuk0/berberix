import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon, { Wordmark } from "../components/Icon.jsx";

const STATUS = { TRIAL: "Deneme", ACTIVE: "Aktif", SUSPENDED: "Askıda" };
const DECISION = {
  SUSPEND_SUGGESTED: ["Askıya alma önerisi", "st-cancel"],
  REMIND_PAYMENT: ["Ödeme hatırlat", "st-pending"],
  CHURN_RISK: ["Kullanmıyor", "st-pending"],
  HEALTHY: ["Sağlıklı", "st-ok"],
};
const fmt = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "-");

function AdminLoginOrSetup() {
  const { signIn } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", setupToken: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/admin/setup-status", { auth: false }).then((d) => { setNeedsSetup(d.needsSetup); setNeedsToken(Boolean(d.needsToken)); }).catch((e) => setError(e.message));
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
        <Link to="/" className="brand"><Wordmark /></Link>
        <h2>{needsSetup ? "Platform yöneticisi oluştur" : "Yönetici girişi"}</h2>
        {needsSetup && <p className="tiny muted">Bu ekran yalnızca bir kez, ilk yönetici oluşturulurken görünür.</p>}
        {needsSetup && <label>Adın<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
        <label>E-posta<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Şifre{needsSetup && " (en az 10 karakter)"}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {needsSetup && needsToken && (
          <label>Kurulum anahtarı (barındırma panelindeki ADMIN_SETUP_TOKEN)
            <input value={form.setupToken} onChange={(e) => setForm({ ...form, setupToken: e.target.value })} required />
          </label>
        )}
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
  const [info, setInfo] = useState("");

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

  const resetDemo = async () => {
    setError("");
    setInfo("Demo hazırlanıyor… (yarım dakika sürebilir)");
    try {
      const r = await api("/admin/demo/reset", { method: "POST" });
      setInfo(`Demo hazır: ${r.appointments} randevu. Ana sayfadaki “Paneli dene” düğmesi artık çalışır.`);
      load();
    } catch (err) {
      setInfo("");
      setError(err.message);
    }
  };

  const active = shops.filter((s) => s.acceptingBookings).length;
  const needsAction = shops.filter((s) => s.decision && s.decision.outcome !== "HEALTHY").length;

  return (
    <div className="admin">
      <header className="panel-head">
        <span className="brand"><Wordmark /><span className="badge st-gold">Yönetim</span></span>
        <button className="btn btn-ghost btn-small" onClick={signOut}>Çıkış</button>
      </header>
      <div className="stats">
        <div className="stat"><b>{shops.length}</b><small>Dükkan</small></div>
        <div className="stat"><b>{active}</b><small>Randevu açık</small></div>
        <div className="stat"><b>{shops.filter((s) => s.status === "ACTIVE").length}</b><small>Ücretli</small></div>
      </div>
      {needsAction > 0 && <div className="notice tiny"><Icon name="sparkles" /><span>{needsAction} dükkan için karar önerisi var. Aşağıda nedenleriyle listelendi.</span></div>}
      <div className="card">
        <h3 className="section-title"><Icon name="sparkle" />Satış demosu</h3>
        <p className="tiny muted">Ana sayfadaki “Paneli dene” ve /demo-berber sayfası için örnek dükkanı kurar. Ziyaretçiler bozarsa buradan sıfırla.</p>
        <button className="btn btn-small" onClick={resetDemo}>Demo dükkanı kur / sıfırla</button>
        {info && <div className="notice tiny">{info}</div>}
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
            {s.decision && s.decision.outcome !== "HEALTHY" && (
              <div className="admin-decision">
                <span className={`badge ${DECISION[s.decision.outcome][1]}`}><Icon name="sparkles" />{DECISION[s.decision.outcome][0]}</span>
                <ul className="reason-list tiny">{s.decision.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            <div className="appt-buttons">
              <select className="move-select" value={s.plan} onChange={(e) => update(s.id, { plan: e.target.value })}>
                <option value="BASIC">Başlangıç</option>
                <option value="PRO">Pro</option>
                <option value="SALON">Salon</option>
              </select>
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
