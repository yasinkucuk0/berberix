import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, dateLabel, inkFor, money, todayStr, waLink } from "../lib/api";
import Icon, { Wordmark } from "../components/Icon.jsx";

const Step = ({ n, children }) => <h3 className="step-title"><span className="step-no">{n}</span>{children}</h3>;

export default function ShopPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [service, setService] = useState(null);
  const [barber, setBarber] = useState("any"); // "any" = fark etmez
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState("");
  const [form, setForm] = useState({ customerName: "", customerPhone: "", note: "", kvkk: false, marketingConsent: false });
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
    setFormError("");
    const who = barber === "any" ? "" : `&barberId=${barber}`;
    api(`/public/shops/${slug}/availability?date=${date}&serviceId=${service.id}${who}`, { auth: false })
      .then((d) => setSlots(d.slots))
      .catch((e) => { setSlots([]); setFormError(e.message); });
  }, [slug, service, date, barber]);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => todayStr(i)), []);

  if (error) return <div className="center shop-missing"><h2>Sayfa bulunamadı</h2><p className="muted">{error}</p><a className="link" href="/">Ana sayfaya dön</a></div>;
  if (!data) return <div className="center muted">Yükleniyor…</div>;

  const { shop, services, hours, acceptingBookings } = data;
  const barbers = data.barbers || [];
  const step = (n) => (barbers.length ? n + 1 : n);
  const style = { "--brand": shop.primaryColor, "--brand-ink": inkFor(shop.primaryColor), "--shop-bg": shop.accentColor };

  const book = async (e) => {
    e.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      const result = await api(`/public/shops/${slug}/appointments`, {
        method: "POST", auth: false, body: { serviceId: service.id, date, time, barberId: barber, ...form },
      });
      setDone(result);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const msg = `Merhaba, ${dateLabel(done.date)} saat ${done.time} için ${done.serviceName} randevusu aldım${done.barberName ? ` (${done.barberName})` : ""}. Adım: ${form.customerName}`;
    return (
      <div className="shop" style={style}>
        <div className="card done">
          <div className={done.status === "CONFIRMED" ? "done-mark" : "done-mark wait"}>
            <Icon name={done.status === "CONFIRMED" ? "check" : "clock"} stroke={2} />
          </div>
          <h2>{done.status === "CONFIRMED" ? "Randevun onaylandı" : "İsteğin alındı"}</h2>
          {done.message && <p className="muted">{done.message}</p>}
          <div className="done-detail">
            <b>{done.serviceName}</b><br />{dateLabel(done.date)} · {done.time}
            {done.barberName && <><br />Berberin: {done.barberName}</>}<br />{done.loyalty?.reward ? "Hediye" : money(done.price)}
          </div>
          {done.loyalty?.message && (
            <p className={done.loyalty.reward ? "gold inline-meta" : "tiny muted inline-meta"} style={{ justifyContent: "center" }}>
              <Icon name="star" />{done.loyalty.message}
            </p>
          )}
          {done.manageToken && (
            <p className="tiny muted">
              Planın değişirse <a className="link" href={`/r/${done.manageToken}`}>randevunu buradan iptal edebilirsin</a>.
              Bu sayfayı yer imlerine ekle ya da linki sakla.
            </p>
          )}
          {shop.whatsapp && <a className="btn btn-block wa" href={waLink(shop.whatsapp, msg)} target="_blank" rel="noreferrer"><Icon name="message" />Berbere WhatsApp'tan yaz</a>}
          <button className="btn btn-ghost btn-block" onClick={() => { setDone(null); setService(null); }}>Yeni randevu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="shop" style={style}>
      <header className="shop-head">
        {shop.logo ? <img src={shop.logo} alt={shop.name} className="shop-logo" /> : <div className="shop-logo logo-fallback big"><Icon name="scissors" /></div>}
        <h1>{shop.name}</h1>
        {shop.about && <p className="muted">{shop.about}</p>}
        <div className="shop-actions">
          {shop.phone && <a className="shop-action" href={`tel:${shop.phone}`}><span><Icon name="phone" /></span>Ara</a>}
          {shop.whatsapp && <a className="shop-action" href={waLink(shop.whatsapp)} target="_blank" rel="noreferrer"><span><Icon name="message" /></span>Mesaj</a>}
          {shop.address && <a className="shop-action" href={`https://maps.google.com/?q=${encodeURIComponent(`${shop.address} ${shop.city}`)}`} target="_blank" rel="noreferrer"><span><Icon name="pin" /></span>Yol tarifi</a>}
        </div>
      </header>

      {!acceptingBookings && <div className="alert"><Icon name="info" /><span>Bu dükkan şu an online randevu almıyor. Telefonla ulaşabilirsiniz.</span></div>}

      <section className="card">
        <Step n={1}>Hizmet seç</Step>
        <ul className="pick-list">
          {services.map((s) => (
            <li key={s.id}>
              <button className={service?.id === s.id ? "pick active" : "pick"} onClick={() => acceptingBookings && setService(s)} disabled={!acceptingBookings}>
                <span><span className="block">{s.name}</span><small className="muted">{s.durationMinutes} dk{s.description ? ` · ${s.description}` : ""}</small></span>
                <b className="gold">{money(s.price)}</b>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {service && barbers.length > 0 && (
        <section className="card">
          <Step n={2}>Berber seç</Step>
          <div className="barber-pick">
            <button className={barber === "any" ? "pick active" : "pick"} onClick={() => setBarber("any")}>
              <span>Fark etmez</span><small className="muted">En erken boş saat</small>
            </button>
            {barbers.map((b) => (
              <button key={b.id} className={barber === String(b.id) ? "pick active" : "pick"} onClick={() => setBarber(String(b.id))}>
                <span>{b.name}</span>{b.title && <small className="muted">{b.title}</small>}
              </button>
            ))}
          </div>
        </section>
      )}

      {service && (
        <section className="card">
          <Step n={step(2)}>Gün ve saat</Step>
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
          <Step n={step(3)}>Bilgilerin</Step>
          <p className="tiny muted">{service.name} · {dateLabel(date)} {time} · {money(service.price)}</p>
          <label>Adın soyadın<input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required autoComplete="name" /></label>
          <label>Telefonun<input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} required inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" /></label>
          <label>Not (isteğe bağlı)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <label className="check">
            <input type="checkbox" checked={form.kvkk} onChange={(e) => setForm({ ...form, kvkk: e.target.checked })} required />
            <span className="tiny"><a className="link" href="/kvkk" target="_blank" rel="noreferrer">Aydınlatma Metni</a>'ni okudum. Bilgilerim randevu için kullanılacak.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />
            <span className="tiny muted">İsteğe bağlı: {shop.name}'den kampanya ve hatırlatma mesajı (WhatsApp/SMS) almak istiyorum.</span>
          </label>
          {formError && <div className="alert">{formError}</div>}
          <button className="btn btn-block" disabled={busy}>{busy ? "Kaydediliyor…" : "Randevuyu al"}</button>
        </form>
      )}

      <section className="card">
        <h3 className="section-title"><Icon name="clock" />Çalışma saatleri</h3>
        <ul className="hours-list">
          {hours.map((h) => (
            <li key={h.dayOfWeek}><span>{h.day}</span><span className="muted">{h.isOpen ? `${h.openTime} – ${h.closeTime}` : "Kapalı"}</span></li>
          ))}
        </ul>
        {shop.address && <p className="tiny muted inline-meta" style={{ marginTop: 12 }}><Icon name="pin" />{shop.address} {shop.city}</p>}
      </section>

      <footer className="powered">
        <a href="/"><Wordmark /></a> ile online randevu · <a href="/kvkk">KVKK</a>
      </footer>
    </div>
  );
}
