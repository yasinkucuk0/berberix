import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon, { Wordmark } from "../components/Icon.jsx";

const TR = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
const slugify = (t) =>
  String(t || "").replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR[c]).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ shopName: "", slug: "", ownerName: "", phone: "", email: "", password: "", acceptTerms: false });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const slug = slugTouched ? slugify(form.slug) : slugify(form.shopName);

  useEffect(() => {
    if (slug.length < 3) return setSlugState(null);
    const timer = setTimeout(() => {
      api(`/auth/slug-check?slug=${encodeURIComponent(slug)}`, { auth: false })
        .then((d) => setSlugState(d.available))
        .catch(() => setSlugState(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [slug]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/auth/register-shop", { method: "POST", auth: false, body: { ...form, slug } });
      signIn(data);
      navigate("/panel?hosgeldin=1");
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
        <h2>Dükkanını oluştur</h2>
        <p className="muted tiny">14 gün ücretsiz. Sonra istersen devam edersin.</p>

        <label>Dükkan adı<input value={form.shopName} onChange={set("shopName")} placeholder="Ahmet Berber" required /></label>
        <label>
          Dükkan adresin
          <div className="slug-input">
            <span>{window.location.host}/</span>
            <input value={slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} />
          </div>
          {slugState === true && <small className="ok inline-meta"><Icon name="check" />Bu adres senin olabilir</small>}
          {slugState === false && <small className="err inline-meta"><Icon name="close" />Bu adres alınmış, başka bir tane dene</small>}
        </label>
        <label>Adın soyadın<input value={form.ownerName} onChange={set("ownerName")} required /></label>
        <label>Telefon / WhatsApp<input value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="05xx xxx xx xx" /></label>
        <label>E-posta<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
        <label>Şifre (en az 8 karakter)<input type="password" value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" /></label>

        <label className="check">
          <input type="checkbox" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} required />
          <span className="tiny"><Link className="link" to="/kosullar" target="_blank">Kullanım Koşulları</Link>'nı ve <Link className="link" to="/kvkk" target="_blank">KVKK Aydınlatma Metni</Link>'ni okudum, kabul ediyorum.</span>
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn btn-block" disabled={busy || slugState === false}>{busy ? "Oluşturuluyor…" : "Dükkanımı oluştur"}</button>
        <p className="tiny muted center">Hesabın var mı? <Link className="link" to="/giris">Giriş yap</Link></p>
      </form>
    </div>
  );
}
