import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import { Wordmark } from "../components/Icon.jsx";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/auth/login", { method: "POST", auth: false, body: form });
      signIn(data);
      navigate(data.user.role === "PLATFORM_ADMIN" ? "/yonetim" : "/panel");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <Link to="/" className="brand"><Wordmark /></Link>
        <h2>Giriş yap</h2>
        <label>E-posta<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" /></label>
        <label>Şifre<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" /></label>
        {error && <div className="alert">{error}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button>
        <p className="tiny muted center">Dükkanın yok mu? <Link className="link" to="/kayit">Ücretsiz oluştur</Link></p>
      </form>
    </div>
  );
}
