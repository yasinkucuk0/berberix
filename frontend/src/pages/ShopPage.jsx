import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, dateLabel, inkFor, money, todayStr, waLink } from "../lib/api";

export default function ShopPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [service, setService] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState("");
  const [form, setForm] = useState({ customerName: "", customerPhone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    api(`/public/shops/${slug}`, { auth: false })
      .then((d) => {
        setData(d);
        document.title = `${d.shop.name} | Online Randevu`;
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    if (!service) return;
    setSlots(null);
    setTime("");
    api(`/public/shops/${slug}/availability?date=${date}&serviceId=${service.id}`, { auth: false })
      .then((d) => setSlots(d.slots))
      .catch((e) => { setSlots([]); setFormError(e.message); });
  }, [slug, service, date]);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => todayStr(i)), []);

  if (error) return <div className="center shop-missing"><h2>😕</h2><p>{error}</p></div>;
  if (!data) return <div className="center muted">Yükleniyor…</div>;

  const { shop, services, hours, acceptingBookings } = data;
  const style = { "--brand": shop.primaryColor, "--brand-ink": inkFor(shop.primaryColor), "--shop-bg": shop.accentColor };

  const book = async (e) => {
    e.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      const result = await api(`/public/shops/${slug}/appointments`, {
        method: "POST", auth: false, body: { serviceId: service.id, date, time, ...form },
      });
      setDone(result);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const msg = `Merhaba, ${dateLabel(done.date)} saat ${done.time} için ${done.serviceName} randevusu aldım. Adım: ${form.customerName}`;
    return (
      <div className="shop" style={style}>
        <div className="card done">
          <h2>Randevun alındı ✓</h2>
          <p><b>{done.serviceName}</b><br />{dateLabel(done.date)} • {done.time}<br />{money(done.price)}</p>
          {shop.whatsapp && <a className="btn btn-block wa" href={waLink(shop.whatsapp, msg)} target="_blank" rel="noreferrer">Berbere WhatsApp'tan bildir</a>}
          <button className="btn btn-ghost btn-block" onClick={() => { setDone(null); setService(null); }}>Yeni randevu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="shop" style={style}>
      <header className="shop-head">
        {shop.logo ? <img src={shop.logo} alt={shop.name} className="shop-logo" /> : <div className="shop-logo logo-fallback big">✂</div>}
        <h1>{shop.name}</h1>
        {shop.about && <p className="muted">{shop.about}</p>}
        <div className="row center-row">
          {shop.phone && <a className="btn btn-ghost btn-small" href={`tel:${shop.phone}`}>📞 Ara</a>}
          {shop.whatsapp && <a className="btn btn-ghost btn-small" href={waLink(shop.whatsapp)} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
          {shop.address && <a className="btn btn-ghost btn-small" href={`https://maps.google.com/?q=${encodeURIComponent(`${shop.address} ${shop.city}`)}`} target="_blank" rel="noreferrer">📍 Yol tarifi</a>}
        </div>
      </header>

      {!acceptingBookings && <div className="alert">Bu dükkan şu an online randevu almıyor. Telefonla ulaşabilirsiniz.</div>}

      <section className="card">
        <h3>1. Hizmet seç</h3>
        <ul className="pick-list">
          {services.map((s) => (
            <li key={s.id}>
              <button className={service?.id === s.id ? "pick active" : "pick"} onClick={() => acceptingBookings && setService(s)} disabled={!acceptingBookings}>
                <span><b>{s.name}</b><small className="muted"> {s.durationMinutes} dk</small>{s.description && <small className="muted block">{s.description}</small>}</span>
                <b>{money(s.price)}</b>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {service && (
        <section className="card">
          <h3>2. Gün ve saat</h3>
          <div className="day-strip">
            {days.map((d) => (
              <button key={d} className={d === date ? "chip active" : "chip"} onClick={() => setDate(d)}>
                {d === todayStr() ? "Bugün" : dateLabel(d)}
              </button>
            ))}
          </div>
          {slots === null && <p className="muted">Saatler yükleniyor…</p>}
          {slots && slots.length === 0 && <p className="muted">Bu gün boş saat yok. Başka bir gün seç.</p>}
          <div className="slots">
            {slots?.map((s) => (
              <button key={s} className={s === time ? "slot active" : "slot"} onClick={() => setTime(s)}>{s}</button>
            ))}
          </div>
        </section>
      )}

      {service && time && (
        <form className="card form-grid" onSubmit={book}>
          <h3>3. Bilgilerin</h3>
          <p className="tiny muted">{service.name} • {dateLabel(date)} {time} • {money(service.price)}</p>
          <label>Adın soyadın<input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required autoComplete="name" /></label>
          <label>Telefonun<input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} required inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" /></label>
          <label>Not (isteğe bağlı)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          {formError && <div className="alert">{formError}</div>}
          <button className="btn btn-block" disabled={busy}>{busy ? "Kaydediliyor…" : "Randevuyu onayla"}</button>
        </form>
      )}

      <section className="card">
        <h3>Çalışma saatleri</h3>
        <ul className="hours-list">
          {hours.map((h) => (
            <li key={h.dayOfWeek}><span>{h.day}</span><span className="muted">{h.isOpen ? `${h.openTime} – ${h.closeTime}` : "Kapalı"}</span></li>
          ))}
        </ul>
        {shop.address && <p className="tiny muted">📍 {shop.address} {shop.city}</p>}
      </section>

      <footer className="footer tiny muted">Online randevu: <a className="link" href="/">Berberim</a></footer>
    </div>
  );
}
