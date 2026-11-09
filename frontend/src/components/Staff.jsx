import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

// Calisanlar: her berberin kendi takvimi. Hic calisan yoksa dukkan tek koltuk gibi calisir.
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const EMPTY = { name: "", title: "", offDays: [] };

export default function Staff() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [meta, setMeta] = useState(null);
  const [loginFor, setLoginFor] = useState(null); // giris verilen berber id
  const [login, setLogin] = useState({ email: "", password: "" });

  const load = () => api("/shop/barbers", { full: true })
    .then((r) => { setList(r.data); setMeta(r.meta); })
    .catch((e) => setError(e.message));

  const saveLogin = async (e, b) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api(`/shop/barbers/${b.id}/login`, { method: "PUT", body: login });
      setMsg(`${b.name} artık ${login.email} ile giriş yapıp sadece kendi randevularını görebilir.`);
      setLoginFor(null);
      setLogin({ email: "", password: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeLogin = async (b) => {
    setError("");
    try {
      await api(`/shop/barbers/${b.id}/login`, { method: "DELETE" });
      setMsg(`${b.name} için giriş kaldırıldı.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleDay = (d) => setForm({
    ...form, offDays: form.offDays.includes(d) ? form.offDays.filter((x) => x !== d) : [...form.offDays, d],
  });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      if (editing) await api(`/shop/barbers/${editing}`, { method: "PATCH", body: form });
      else await api("/shop/barbers", { method: "POST", body: form });
      setMsg(editing ? "Kaydedildi." : `${form.name} eklendi. Müşteriler artık berber seçebilir.`);
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (b) => {
    setError("");
    try {
      await api(`/shop/barbers/${b.id}`, { method: "PATCH", body: { isActive: !b.isActive } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = (b) => {
    setEditing(b.id);
    setForm({ name: b.name, title: b.title, offDays: b.offDays });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section>
      {meta && (
        <p className="tiny muted">
          Paketin: <b>{meta.planLabel}</b> • {meta.maxBarbers ? `en fazla ${meta.maxBarbers} aktif berber` : "sınırsız berber"}
          {" "}({list.filter((b) => b.isActive).length} aktif)
        </p>
      )}
      {list.length === 0 && (
        <div className="notice tiny">
          Henüz çalışan yok: dükkan tek koltuk gibi çalışıyor. Çalışan eklersen her berberin kendi takvimi olur, aynı saate birden
          fazla randevu alınabilir ve müşteri berberini seçebilir.
        </div>
      )}
      {isOwner && (
        <form className="card form-grid" onSubmit={save}>
          <h3>{editing ? "Çalışanı düzenle" : "Yeni çalışan"}</h3>
          <div className="row">
            <label>Adı<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={40} /></label>
            <label>Ünvan (isteğe bağlı)<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Usta, Kalfa…" maxLength={30} /></label>
          </div>
          <div>
            <small className="muted">İzinli günleri</small>
            <div className="day-pick">
              {DAYS.map((d, i) => (
                <button type="button" key={d} className={form.offDays.includes(i) ? "chip active" : "chip"} onClick={() => toggleDay(i)}>{d}</button>
              ))}
            </div>
          </div>
          {error && <div className="alert">{error}</div>}
          {msg && <div className="notice tiny">{msg}</div>}
          <div className="row">
            <button className="btn">{editing ? "Kaydet" : "Ekle"}</button>
            {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setForm(EMPTY); }}>Vazgeç</button>}
          </div>
        </form>
      )}
      <ul className="svc-list">
        {list.map((b) => (
          <li key={b.id} className={b.isActive ? "card svc" : "card svc off"}>
            <div>
              <strong>{b.name}</strong> {b.title && <small className="muted">• {b.title}</small>}
              <div className="tiny muted">
                {b.isActive ? (b.offDayNames.length ? `İzinli: ${b.offDayNames.join(", ")}` : "Her açık gün çalışıyor") : "Pasif: müşteri seçemez"}
              </div>
              {isOwner && (
                <div className="tiny">
                  {b.login ? (
                    <span className="inline-meta"><Icon name="key" />{b.login.email}{" · "}
                      <button className="link plain tiny" onClick={() => { setLoginFor(b.id); setLogin({ email: b.login.email, password: "" }); }}>Değiştir</button>{" "}
                      <button className="link plain tiny" onClick={() => removeLogin(b)}>Kaldır</button></span>
                  ) : (
                    <button className="link plain tiny" onClick={() => { setLoginFor(b.id); setLogin({ email: "", password: "" }); }}><Icon name="key" /> Kendi telefonundan girsin</button>
                  )}
                </div>
              )}
              {loginFor === b.id && (
                <form className="form-grid login-form" onSubmit={(e) => saveLogin(e, b)}>
                  <label>E-posta<input type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required /></label>
                  <label>{b.login ? "Yeni şifre (boş = değişmesin)" : "Şifre (en az 8)"}
                    <input type="text" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} minLength={b.login ? 0 : 8} required={!b.login} autoComplete="off" />
                  </label>
                  <p className="tiny muted">Çalışan bu bilgilerle girer; sadece kendi randevularını görür. Kasa ve müşteri listesi kapalıdır.</p>
                  <div className="row">
                    <button className="btn btn-small">Kaydet</button>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => setLoginFor(null)}>Vazgeç</button>
                  </div>
                </form>
              )}
            </div>
            {isOwner && (
              <div className="svc-right">
                <button className="btn btn-ghost btn-small" onClick={() => edit(b)}>Düzenle</button>
                <button className="btn btn-ghost btn-small" onClick={() => toggleActive(b)}>{b.isActive ? "Pasif yap" : "Aktif yap"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
