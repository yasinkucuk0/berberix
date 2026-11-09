import { useCallback, useEffect, useState } from "react";
import { api, dateLabel, money, waLink } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

const initials = (name) => String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLocaleUpperCase("tr-TR");

// Musteriler (CRM). Segmentler karar motorundan gelir (backend/src/decisions/customer.js).
const SEGMENT = {
  KAYIP_RISKI: ["Kayıp riski", "st-pending", "45+ gündür gelmedi"],
  SADIK: ["Sadık", "st-ok", "5+ ziyaret, hiç gelmeme yok"],
  RISKLI: ["Riskli", "st-cancel", "Gelmeme / iptal geçmişi var"],
  YENI: ["Yeni", "", "Henüz tamamlanmış randevusu yok"],
  DUZENLI: ["Düzenli", "st-done", ""],
};
const STATUS = { PENDING: "Bekliyor", CONFIRMED: "Onaylı", COMPLETED: "Geldi", CANCELLED: "İptal", NO_SHOW: "Gelmedi" };

function winbackText(shop, c) {
  const first = String(c.name || "").split(" ")[0];
  return `Merhaba ${first}, ${shop?.name || ""} olarak seni özledik. Uygun bir gün randevunu buradan alabilirsin: ${window.location.origin}/${shop?.slug || ""}`;
}

function Detail({ customerKey, onBack, shop }) {
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/shop/customers/${customerKey}`)
      .then((d) => { setData(d); setNote(d.note); })
      .catch((e) => setError(e.message));
  }, [customerKey]);

  const withdraw = async () => {
    try {
      await api(`/shop/customers/${customerKey}/consent`, { method: "PUT", body: { marketingConsent: false } });
      setData({ ...data, marketingConsent: false });
    } catch (err) {
      setError(err.message);
    }
  };

  const saveNote = async () => {
    setMsg("");
    try {
      await api(`/shop/customers/${customerKey}/note`, { method: "PUT", body: { note } });
      setMsg("Not kaydedildi.");
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <p className="muted center">Yükleniyor…</p>;
  const seg = SEGMENT[data.segment];
  const p = data.profile;

  return (
    <section>
      <button className="back" onClick={onBack}><Icon name="chevronLeft" />Müşteriler</button>
      <div className="card">
        <div className="cust-row">
          <span className="avatar big">{initials(data.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{data.name}</h3>
            <div className="tiny muted">{data.phone}</div>
          </div>
          <span className={`badge ${seg[1]}`}>{seg[0]}</span>
        </div>
        <div className="stats mini">
          <div className="stat"><b>{p.completed}</b><small>Ziyaret</small></div>
          <div className="stat"><b>{money(data.spent)}</b><small>Toplam</small></div>
          <div className="stat"><b>{p.noShow}</b><small>Gelmedi</small></div>
        </div>
        {p.lastVisit && <p className="tiny muted">Son ziyaret: {dateLabel(p.lastVisit)}</p>}
        <div className="row">
          <a className="btn btn-ghost btn-small" href={`tel:${data.phone}`}><Icon name="phone" />Ara</a>
          <a className="btn btn-ghost btn-small" href={waLink(data.phone, data.segment === "KAYIP_RISKI" && data.marketingConsent ? winbackText(shop, data) : "")} target="_blank" rel="noreferrer"><Icon name="message" />WhatsApp</a>
        </div>
        <p className="tiny muted inline-meta" style={{ marginTop: 14 }}>
          {data.marketingConsent
            ? <><Icon name="checkCircle" />Kampanya mesajına izin verdi. <button className="link plain tiny" onClick={withdraw}>İzni geri aldı</button></>
            : <><Icon name="lock" />Kampanya izni yok. Sadece randevuyla ilgili yazabilirsin.</>}
        </p>
      </div>
      <div className="card form-grid">
        <h3 className="section-title"><Icon name="note" />Not</h3>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn: yanlardan 2 numara, sakalı kısa sever" maxLength={500} />
        {msg && <div className="notice tiny">{msg}</div>}
        <button className="btn" onClick={saveNote}>Notu kaydet</button>
      </div>
      <div className="card">
        <h3 className="section-title"><Icon name="history" />Geçmiş</h3>
        <ul className="hours-list">
          {data.history.map((a) => (
            <li key={a.id}>
              <span>{a.serviceName}<small className="muted block">{dateLabel(a.date)} · {a.start}{a.barberName ? ` · ${a.barberName}` : ""}</small></span>
              <span className="muted" style={{ textAlign: "right" }}>{money(a.price)}<small className="block">{STATUS[a.status]}</small></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Customers() {
  const { shop } = useAuth();
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (segment) params.set("segment", segment);
      setData(await api(`/shop/customers?${params}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [q, segment]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  if (open) return <Detail customerKey={open} shop={shop} onBack={() => { setOpen(null); load(); }} />;

  return (
    <section>
      <input className="search" placeholder="Ad ya da telefon ara" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="day-strip">
        <button className={segment === "" ? "chip active" : "chip"} onClick={() => setSegment("")}>Hepsi</button>
        {Object.entries(SEGMENT).map(([key, [label]]) => (
          <button key={key} className={segment === key ? "chip active" : "chip"} onClick={() => setSegment(key)}>
            {label}{data?.counts?.[key] ? ` (${data.counts[key]})` : ""}
          </button>
        ))}
      </div>
      {segment && SEGMENT[segment][2] && <p className="tiny muted">{SEGMENT[segment][2]}</p>}
      {error && <div className="alert">{error}</div>}
      {data === null && <p className="muted center">Yükleniyor…</p>}
      {data?.customers.length === 0 && (
        <p className="muted center empty">{q || segment ? "Eşleşen müşteri yok." : "Müşterilerin, randevu aldıkça burada listelenir."}</p>
      )}
      <ul className="appt-list">
        {data?.customers.map((c) => (
          <li key={c.key} className="card cust" onClick={() => setOpen(c.key)}>
            <div className="cust-row">
              <span className="avatar">{initials(c.name)}</span>
              <div className="appt-info">
                <div className="insight-top">
                  <strong>{c.name}</strong>
                  <span className={`badge ${SEGMENT[c.segment][1]}`}>{SEGMENT[c.segment][0]}</span>
                </div>
                <div className="tiny muted">
                  {c.profile.completed} ziyaret · {money(c.spent)}{c.profile.lastVisit ? ` · son ${dateLabel(c.profile.lastVisit)}` : ""}
                </div>
                {c.note && <div className="tiny muted inline-meta"><Icon name="note" />{c.note}</div>}
                {c.segment === "KAYIP_RISKI" && !c.marketingConsent && (
                  <div className="tiny muted inline-meta"><Icon name="lock" />Kampanya izni yok (KVKK)</div>
                )}
                {c.segment === "KAYIP_RISKI" && c.marketingConsent && (
                  <a className="btn btn-small wa" onClick={(e) => e.stopPropagation()}
                    href={waLink(c.phone, winbackText(shop, c))} target="_blank" rel="noreferrer">
                    <Icon name="message" />“Seni özledik” mesajı gönder
                  </a>
                )}
              </div>
              <Icon name="chevronRight" className="chev" />
            </div>
          </li>
        ))}
      </ul>
      {data && data.total > data.customers.length && <p className="tiny muted center">İlk {data.customers.length} müşteri gösteriliyor. Aramayı daralt.</p>}
    </section>
  );
}
