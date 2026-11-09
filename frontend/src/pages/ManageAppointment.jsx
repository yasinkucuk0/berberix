import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, dateLabel, inkFor, money, waLink } from "../lib/api";
import Icon, { Wordmark } from "../components/Icon.jsx";

// Musterinin randevusunu gordugu ve iptal edebildigi sayfa: /r/<token>
export default function ManageAppointment() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/public/appointments/${token}`, { auth: false }).then(setData).catch((e) => setError(e.message));
  }, [token]);

  const cancel = async () => {
    setBusy(true);
    try {
      setData(await api(`/public/appointments/${token}/cancel`, { method: "POST", auth: false }));
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return <div className="center shop-missing"><h2>Randevu bulunamadı</h2><p className="muted">{error}</p></div>;
  }
  if (!data) return <div className="center muted">Yükleniyor…</div>;

  const { shop, appointment: a, canCancel } = data;
  const style = { "--brand": shop.primaryColor, "--brand-ink": inkFor(shop.primaryColor), "--shop-bg": shop.accentColor };
  const cancelled = a.status === "CANCELLED";
  const status = {
    PENDING: ["Onay bekliyor", "st-pending"], CONFIRMED: ["Onaylandı", "st-ok"], COMPLETED: ["Tamamlandı", "st-done"],
    CANCELLED: ["İptal edildi", "st-cancel"], NO_SHOW: ["Gelinmedi", "st-cancel"],
  }[a.status];

  return (
    <div className="shop" style={style}>
      <header className="shop-head">
        {shop.logo ? <img src={shop.logo} alt={shop.name} className="shop-logo" /> : <div className="shop-logo logo-fallback big"><Icon name="scissors" /></div>}
        <h1>{shop.name}</h1>
        <p className="muted">Merhaba {a.customerName}, randevun:</p>
      </header>

      <div className="card">
        <div className="insight-top">
          <h3 style={{ margin: 0 }}>{a.serviceName}</h3>
          <span className={`badge ${status[1]}`}>{status[0]}</span>
        </div>
        <ul className="hours-list" style={{ marginTop: 10 }}>
          <li><span className="inline-meta muted"><Icon name="calendar" />Tarih</span><span>{dateLabel(a.date)}</span></li>
          <li><span className="inline-meta muted"><Icon name="clock" />Saat</span><span>{a.start} – {a.end}</span></li>
          {a.barberName && <li><span className="inline-meta muted"><Icon name="scissors" />Berber</span><span>{a.barberName}</span></li>}
          <li><span className="inline-meta muted"><Icon name="wallet" />Ücret</span><span>{a.loyaltyReward ? "Hediye" : money(a.price)}</span></li>
        </ul>
        {a.loyaltyReward && <p className="tiny gold inline-meta"><Icon name="star" />Bu randevu sadakat hediyen.</p>}
      </div>

      {error && <div className="alert"><Icon name="warning" /><span>{error}</span></div>}

      {canCancel && !confirming && (
        <button className="btn btn-ghost btn-block" onClick={() => setConfirming(true)}>Randevuyu iptal et</button>
      )}
      {confirming && (
        <div className="card">
          <h3>İptal edilsin mi?</h3>
          <p className="muted">Saatin başka bir müşteriye açılacak. Bu işlem geri alınamaz.</p>
          <button className="btn btn-block" style={{ background: "var(--danger)", color: "#fff" }} onClick={cancel} disabled={busy}>
            {busy ? "İptal ediliyor…" : "Evet, iptal et"}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirming(false)}>Vazgeç</button>
        </div>
      )}
      {cancelled && (
        <div className="notice"><Icon name="checkCircle" /><span>Randevun iptal edildi. Haber verdiğin için teşekkürler.</span></div>
      )}
      <a className="btn btn-block" href={`/${shop.slug}`}>{cancelled ? "Yeni randevu al" : "Başka bir randevu al"}</a>
      {(shop.whatsapp || shop.phone) && (
        <div className="shop-actions" style={{ marginTop: 22 }}>
          {shop.phone && <a className="shop-action" href={`tel:${shop.phone}`}><span><Icon name="phone" /></span>Ara</a>}
          {shop.whatsapp && <a className="shop-action" href={waLink(shop.whatsapp)} target="_blank" rel="noreferrer"><span><Icon name="message" /></span>Mesaj</a>}
        </div>
      )}
      <footer className="powered"><a href="/"><Wordmark /></a> ile online randevu</footer>
    </div>
  );
}
